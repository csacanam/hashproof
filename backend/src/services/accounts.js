/**
 * Organizations and who belongs to them, for the dashboard.
 *
 * An organization is an ordinary entity: the same row the API issues as, the
 * same public profile, the same verification flow. Creating one from the
 * dashboard leaves it `unverified` — anyone can sign up, and a name is only a
 * claim until the verification process says otherwise.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.js";
import { sendTelegramAlert } from "../utils/notify.js";
import { appError } from "../utils/appError.js";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROLES = ["owner", "admin", "issuer"];

// Names that would read as HashProof itself speaking.
const RESERVED_SLUGS = new Set(["hashproof", "admin", "api", "app", "docs", "support", "verify", "www"]);

/** Roles allowed to spend credits, manage keys and templates. `issuer` only issues and revokes. */
export const MANAGER_ROLES = ["owner", "admin"];

export function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** The organizations a user belongs to, with their role and balance. */
export async function listMemberships(userId) {
  const { data, error } = await supabase
    .from("entity_members")
    .select("role, entity_id, entities(id, display_name, slug, status, website, logo_url)")
    .eq("user_id", userId);
  if (error) throw new Error(`database: ${error.message}`);
  return (data || [])
    .filter((m) => m.entities)
    .map((m) => ({ role: m.role, ...m.entities }));
}

/** The user's role in an entity, or null when they don't belong to it. */
export async function getMembership(userId, entityId) {
  const { data, error } = await supabase
    .from("entity_members")
    .select("role")
    .eq("user_id", userId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  return data?.role ?? null;
}

/**
 * Create an organization with the user as owner, plus its panel key.
 * @returns {Promise<{ id: string, display_name: string, slug: string, status: string }>}
 */
export async function createOrganization({ user, displayName, slug, website }) {
  const name = String(displayName || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) throw new Error("display_name must be 2 to 120 characters");

  const cleanSlug = normalizeSlug(slug || name);
  if (cleanSlug.length < 3 || !SLUG_RE.test(cleanSlug)) {
    throw new Error("slug must be at least 3 characters: lowercase letters, numbers and hyphens");
  }
  if (RESERVED_SLUGS.has(cleanSlug)) throw appError("That slug is reserved; choose another", 400, "invalid_payload", { field: "slug" });

  let cleanWebsite = null;
  if (website) {
    try {
      const u = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      cleanWebsite = `${u.protocol}//${u.host}`;
    } catch {
      throw new Error("website must be a valid URL");
    }
  }

  const { data: entity, error } = await supabase
    .from("entities")
    .insert({ display_name: name, slug: cleanSlug, website: cleanWebsite })
    .select("id, display_name, slug, status, website")
    .single();
  if (error) {
    if (error.code === "23505") {
      // Both slug and display name are unique; say which, so the form can point at it.
      const which = /display_name/.test(error.message) ? "name" : "slug";
      const err = new Error(`An organization with this ${which} already exists`);
      err.status = 409;
      err.code = "organization_exists";
      err.field = which === "name" ? "display_name" : "slug";
      throw err;
    }
    throw new Error(`database: ${error.message}`);
  }

  const { error: memberErr } = await supabase
    .from("entity_members")
    .insert({ user_id: user.id, entity_id: entity.id, role: "owner" });
  if (memberErr) throw new Error(`database: ${memberErr.message}`);

  await ensurePanelKey(entity.id, user.id);

  sendTelegramAlert(
    "org_created",
    `🏢 <b>New organization</b>\n${escapeHtml(entity.display_name)} (<code>${entity.slug}</code>)\n` +
      `by ${escapeHtml(user.email || user.id)}${cleanWebsite ? `\n${escapeHtml(cleanWebsite)}` : ""}`,
  ).catch(() => {});

  return entity;
}

/**
 * The key the dashboard spends from. Created on demand, one per entity (a
 * partial unique index guarantees it). Its secret is generated and thrown
 * away: nothing outside the backend can ever authenticate with it.
 * @returns {Promise<{ id: string, credits_balance: number }>}
 */
export async function ensurePanelKey(entityId, userId = null) {
  const existing = await getPanelKey(entityId);
  if (existing) return existing;

  const unusableHash = crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      entity_id: entityId,
      key_hash: unusableHash,
      name: "Dashboard",
      kind: "panel",
      credits_balance: 0,
      created_by: userId,
    })
    .select("id, credits_balance")
    .single();
  if (error) {
    // Lost a race with another request creating it: use theirs.
    if (error.code === "23505") return getPanelKey(entityId);
    throw new Error(`database: ${error.message}`);
  }
  return data;
}

export async function getPanelKey(entityId) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, credits_balance")
    .eq("entity_id", entityId)
    .eq("kind", "panel")
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  return data;
}

export function isValidRole(role) {
  return ROLES.includes(role);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/** Members of an entity with their email. */
export async function listMembers(entityId) {
  const { data, error } = await supabase
    .from("entity_members")
    .select("user_id, role, created_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`database: ${error.message}`);
  const members = await Promise.all(
    (data || []).map(async (m) => {
      const { data: u } = await supabase.auth.admin.getUserById(m.user_id);
      return { ...m, email: u?.user?.email ?? null };
    }),
  );
  return members;
}

/**
 * Add someone to an organization by email. A new address gets Supabase's
 * invitation email; an existing account is added directly and sees the
 * organization the next time it signs in.
 */
export async function addMember({ entityId, email, role, redirectTo }) {
  const clean = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("email must be a valid email address");
  if (!isValidRole(role)) throw new Error("role must be owner, admin or issuer");

  let userId = null;
  const invited = await supabase.auth.admin.inviteUserByEmail(clean, { redirectTo });
  if (invited.data?.user) {
    userId = invited.data.user.id;
  } else {
    // Already registered: resolve the id without sending anything.
    const link = await supabase.auth.admin.generateLink({ type: "magiclink", email: clean });
    userId = link.data?.user?.id ?? null;
    if (!userId) throw appError(`Could not add ${clean}: ${invited.error?.message || link.error?.message || "unknown error"}`);
  }

  const { error } = await supabase
    .from("entity_members")
    .upsert({ user_id: userId, entity_id: entityId, role }, { onConflict: "user_id,entity_id" });
  if (error) throw new Error(`database: ${error.message}`);
  return { user_id: userId, email: clean, role };
}

/** Remove a member. The last owner cannot be removed, or nobody could manage the organization. */
export async function removeMember({ entityId, userId }) {
  const members = await listMembers(entityId);
  const target = members.find((m) => m.user_id === userId);
  if (!target) throw new Error("Member not found");
  if (target.role === "owner" && members.filter((m) => m.role === "owner").length === 1) {
    throw appError("An organization must keep at least one owner");
  }
  const { error } = await supabase.from("entity_members").delete().eq("entity_id", entityId).eq("user_id", userId);
  if (error) throw new Error(`database: ${error.message}`);
}
