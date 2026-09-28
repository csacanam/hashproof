import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getSession, onSessionChange, signOut } from "./api.js";
import { createTranslator, getPreferredLocale } from "../i18n.js";
import { appMessages } from "../locales/app.js";

import { DashboardContext } from "./useDashboard.js";

const ORG_KEY = "hp.org";

export function DashboardProvider({ children }) {
  const locale = useMemo(() => getPreferredLocale(), []);
  const t = useMemo(() => {
    const base = createTranslator(appMessages, locale);
    // {name}-style interpolation, as the other locale files use.
    return (key, vars) => {
      let s = base(key);
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    };
  }, [locale]);

  const [session, setSessionState] = useState(getSession());
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(Boolean(getSession()));
  const [orgId, setOrgIdState] = useState(() => {
    try {
      return localStorage.getItem(ORG_KEY);
    } catch {
      return null;
    }
  });
  const [overview, setOverview] = useState(null);
  const [buyOpen, setBuyOpen] = useState(false);

  useEffect(() => onSessionChange(setSessionState), []);

  const loadMe = useCallback(async () => {
    if (!getSession()) {
      setMe(null);
      setLoadingMe(false);
      return null;
    }
    setLoadingMe(true);
    try {
      const data = await api("/me");
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoadingMe(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [session?.user?.id, loadMe]);

  const organizations = me?.organizations ?? [];
  const org = organizations.find((o) => o.id === orgId) ?? organizations[0] ?? null;

  const setOrgId = useCallback((id) => {
    setOrgIdState(id);
    try {
      localStorage.setItem(ORG_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshOverview = useCallback(async () => {
    if (!org) return null;
    try {
      const data = await api(`/organizations/${org.id}`);
      setOverview(data);
      return data;
    } catch {
      return null;
    }
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOverview(null);
    refreshOverview();
  }, [refreshOverview]);

  const value = {
    t,
    locale,
    session,
    user: me?.user ?? session?.user ?? null,
    loadingMe,
    organizations,
    org,
    role: org?.role ?? null,
    canManage: org?.role === "owner" || org?.role === "admin",
    setOrgId,
    reloadMe: loadMe,
    overview,
    refreshOverview,
    orgPath: (p = "") => `/organizations/${org?.id}${p}`,
    buyOpen,
    openBuy: () => setBuyOpen(true),
    closeBuy: () => setBuyOpen(false),
    signOut: () => {
      signOut();
      setMe(null);
      setOverview(null);
    },
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
