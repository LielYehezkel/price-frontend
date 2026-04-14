import { useEffect, useMemo, useState } from "react";

import { apiAdminPatchShopPackage, apiAdminShopPackages, type AdminShopPackageRow } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

const TIERS: Array<"free" | "basic" | "premium"> = ["free", "basic", "premium"];

const tierLabel: Record<string, string> = {
  free: "חינמית",
  basic: "בסיסית",
  premium: "פרימיום",
};

export function AdminPackagesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminShopPackageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyShopId, setBusyShopId] = useState<number | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await apiAdminShopPackages(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onChangeTier(shopId: number, tier: "free" | "basic" | "premium") {
    if (!token) return;
    setBusyShopId(shopId);
    setErr(null);
    try {
      const updated = await apiAdminPatchShopPackage(token, shopId, tier);
      setRows((prev) => prev.map((r) => (r.shop_id === shopId ? updated : r)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusyShopId(null);
    }
  }

  const totals = useMemo(() => {
    return {
      free: rows.filter((r) => r.package_tier === "free").length,
      basic: rows.filter((r) => r.package_tier === "basic").length,
      premium: rows.filter((r) => r.package_tier === "premium").length,
    };
  }, [rows]);

  return (
    <div className="content-area">
      <header className="admin-dash-hero">
        <div>
          <h1 className="admin-dash-title">חבילות SaaS לחנויות</h1>
          <p className="admin-dash-sub text-muted">ניהול מכסות סריקה ותדירות לפי חבילה — מקור אמת יחיד לתזמון.</p>
        </div>
      </header>

      {err && <p className="error">{err}</p>}

      <div className="admin-kpi-grid" style={{ marginBottom: "0.9rem" }}>
        <div className="admin-kpi-tile">
          <span className="admin-kpi-tile__val">{totals.free}</span>
          <span className="admin-kpi-tile__label">חנויות חינמיות</span>
        </div>
        <div className="admin-kpi-tile">
          <span className="admin-kpi-tile__val">{totals.basic}</span>
          <span className="admin-kpi-tile__label">חנויות בסיסיות</span>
        </div>
        <div className="admin-kpi-tile admin-kpi-tile--accent">
          <span className="admin-kpi-tile__val">{totals.premium}</span>
          <span className="admin-kpi-tile__label">חנויות פרימיום</span>
        </div>
      </div>

      <div className="table-wrap card">
        {loading ? (
          <p className="text-muted">טוען חבילות…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>חנות</th>
                <th>בעלים</th>
                <th>חבילה</th>
                <th>מכסה יומית</th>
                <th>חלונות סריקה/יום</th>
                <th>מרווח מינימלי</th>
                <th>ניצול היום</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.shop_id}>
                  <td>{r.shop_name}</td>
                  <td>{r.owner_email || "—"}</td>
                  <td>
                    <select
                      value={r.package_tier}
                      onChange={(e) => void onChangeTier(r.shop_id, e.target.value as "free" | "basic" | "premium")}
                      disabled={busyShopId === r.shop_id}
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {tierLabel[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="tabular-nums">{r.package_max_scan_runs_per_day}</td>
                  <td className="tabular-nums">{r.package_max_scans_per_day_window}</td>
                  <td className="tabular-nums">{r.package_min_interval_minutes} דק׳</td>
                  <td className="tabular-nums">
                    {r.today_runs_used} / {r.package_max_scan_runs_per_day}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
