/**
 * Templates as an organization manages them from the dashboard.
 *
 * Same table and same field format the API already renders from, so a template
 * made here can be used by slug from /issueCredential and vice versa.
 *
 * A template that has issued credentials is frozen: the verification page and
 * previews still read its layout, and moving a field under 300 issued
 * certificates would change what their holders see. Changes go into a copy.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.js";
import { normalizeSlug } from "./accounts.js";

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const MAX_FIELDS = 20;
const MAX_PAGE = 8000;
const BACKGROUND_BUCKET = "backgrounds";
const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024;

const COLUMNS =
  "id, entity_id, name, slug, visibility, background_url, page_width, page_height, fields_json, created_at, updated_at";

/** The entity's own templates plus the public catalog, own first. */
export async function listTemplates(entityId) {
  const { data, error } = await supabase
    .from("templates")
    .select(COLUMNS)
    .or(`entity_id.eq.${entityId},visibility.eq.public`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`database: ${error.message}`);
  return (data || [])
    .map((t) => ({ ...t, own: t.entity_id === entityId }))
    .sort((a, b) => Number(b.own) - Number(a.own));
}

/** Validate and normalize a layout. Throws with a message naming the field at fault. */
export function validateLayout({ page_width, page_height, fields_json }) {
  const w = Math.trunc(Number(page_width));
  const h = Math.trunc(Number(page_height));
  if (!(w >= 100 && w <= MAX_PAGE) || !(h >= 100 && h <= MAX_PAGE)) {
    throw new Error(`page_width and page_height must be between 100 and ${MAX_PAGE} pixels`);
  }
  if (!Array.isArray(fields_json) || fields_json.length === 0) {
    throw new Error("fields_json must have at least one field");
  }
  if (fields_json.length > MAX_FIELDS) throw new Error(`fields_json must have at most ${MAX_FIELDS} fields`);

  const seen = new Set();
  const fields = fields_json.map((f, i) => {
    const key = String(f?.key || "");
    if (!KEY_RE.test(key)) {
      throw new Error(`field ${i + 1}: key must be lowercase letters, numbers and underscores, starting with a letter`);
    }
    if (seen.has(key)) throw new Error(`field ${i + 1}: key "${key}" must be unique`);
    seen.add(key);

    const x = Math.round(Number(f.x));
    const y = Math.round(Number(f.y));
    const width = Math.round(Number(f.width));
    const fontSize = Math.round(Number(f.font_size));
    if (!(x >= 0 && x < w) || !(y >= 0 && y < h)) throw new Error(`field "${key}": x and y must be inside the page`);
    if (!(width >= 10 && x + width <= w)) throw new Error(`field "${key}": width must fit inside the page`);
    if (!(fontSize >= 6 && fontSize <= 200)) throw new Error(`field "${key}": font_size must be between 6 and 200`);

    const color = f.font_color ?? "#000000";
    if (!COLOR_RE.test(color)) throw new Error(`field "${key}": font_color must be a hex color like #1a1a2e`);
    const align = ["left", "center", "right"].includes(f.align) ? f.align : "left";

    return {
      key,
      x,
      y,
      width,
      height: Math.round(fontSize * 1.3),
      font_size: fontSize,
      font_color: color.toLowerCase(),
      align,
      required: f.required === true,
      ...(f.bold === true && { bold: true }),
      ...(f.italic === true && { italic: true }),
    };
  });

  return { page_width: w, page_height: h, fields_json: fields };
}

export async function createTemplate({ entity, name, slug, background_url, page_width, page_height, fields_json }) {
  const label = String(name || "").trim().slice(0, 120);
  if (label.length < 2) throw new Error("name must be at least 2 characters");
  const bg = validateBackgroundUrl(background_url);
  const layout = validateLayout({ page_width, page_height, fields_json });

  // Slugs are global. Prefixing with the organization's own slug keeps one
  // organization from taking a generic name ("diploma") from everyone else.
  let clean = normalizeSlug(slug || label);
  if (!clean.startsWith(`${entity.slug}-`)) clean = `${entity.slug}-${clean}`.slice(0, 80);

  const { data, error } = await supabase
    .from("templates")
    .insert({ entity_id: entity.id, name: label, slug: clean, visibility: "private", background_url: bg, ...layout })
    .select(COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") {
      const err = new Error("A template with this slug already exists; choose another name");
      err.status = 409;
      err.code = "template_conflict";
      throw err;
    }
    throw new Error(`database: ${error.message}`);
  }
  return { ...data, own: true };
}

export async function updateTemplate({ entityId, templateId, name, background_url, page_width, page_height, fields_json }) {
  const current = await getOwnTemplate(entityId, templateId);

  const { count, error: countErr } = await supabase
    .from("credentials")
    .select("id", { count: "exact", head: true })
    .eq("template_id", current.id);
  if (countErr) throw new Error(`database: ${countErr.message}`);
  if ((count ?? 0) > 0) {
    const err = new Error("This template has issued credentials and can no longer change. Duplicate it to make a new version.");
    err.status = 409;
    err.code = "template_in_use";
    throw err;
  }

  const patch = {
    ...(name !== undefined && { name: String(name).trim().slice(0, 120) }),
    ...(background_url !== undefined && { background_url: validateBackgroundUrl(background_url) }),
    ...validateLayout({
      page_width: page_width ?? current.page_width,
      page_height: page_height ?? current.page_height,
      fields_json: fields_json ?? current.fields_json,
    }),
  };
  const { data, error } = await supabase
    .from("templates")
    .update(patch)
    .eq("id", current.id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`database: ${error.message}`);
  return { ...data, own: true };
}

export async function getOwnTemplate(entityId, templateId) {
  const { data, error } = await supabase
    .from("templates")
    .select(COLUMNS)
    .eq("id", templateId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  if (!data) throw new Error("Template not found");
  return data;
}

function validateBackgroundUrl(value) {
  try {
    const u = new URL(String(value || ""));
    if (u.protocol !== "https:") throw new Error();
    return u.toString();
  } catch {
    throw new Error("background_url must be an https URL");
  }
}

/**
 * Store an uploaded background and return its public URL. Checks the bytes,
 * not the declared type: a PNG or JPEG signature, and the pixel size read from
 * the header, which the template's page size has to match.
 */
export async function uploadBackground({ entityId, buffer }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("image is required");
  if (buffer.length > MAX_BACKGROUND_BYTES) throw new Error("image must be 8 MB or smaller");

  const info = readImageInfo(buffer);
  if (!info) throw new Error("image must be a PNG or JPEG");

  const name = `${entityId}/${crypto.randomUUID()}.${info.ext}`;
  const { error } = await supabase.storage
    .from(BACKGROUND_BUCKET)
    .upload(name, buffer, { contentType: info.mime, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`storage: ${error.message}`);

  const { data } = supabase.storage.from(BACKGROUND_BUCKET).getPublicUrl(name);
  return { url: data.publicUrl, width: info.width, height: info.height, mime: info.mime };
}

/** PNG or JPEG dimensions from the header, or null. */
export function readImageInfo(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR") {
    return { mime: "image/png", ext: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      // SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: "image/jpeg", ext: "jpg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}
