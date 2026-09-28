import { useDashboard } from "../useDashboard.js";

export default function StatusPill({ status }) {
  const { t } = useDashboard();
  return <span className={`dash-pill dash-pill--${status}`}>{t(`status.${status}`)}</span>;
}
