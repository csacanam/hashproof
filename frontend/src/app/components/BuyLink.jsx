import { useDashboard } from "../useDashboard.js";

/** "Buy credits" anywhere in the dashboard: opens the purchase dialog, for managers only. */
export default function BuyLink({ className = "dash-link", children }) {
  const { t, canManage, openBuy } = useDashboard();
  if (!canManage) return null;
  return (
    <button type="button" className={className} onClick={openBuy}>
      {children ?? t("nav.buyCredits")}
    </button>
  );
}
