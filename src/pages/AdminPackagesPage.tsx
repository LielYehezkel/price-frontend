import { useEffect, useMemo, useState } from "react";

import {
  apiAdminPatchShopPackage,
  apiAdminShopPackageAudit,
  apiAdminShopPackages,
  type AdminShopPackageAuditRow,
  type AdminShopPackageRow,
} from "../api/apiSaaS";
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
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [auditRows, setAuditRows] = useState<AdminShopPackageAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const shops = await apiAdminShopPackages(token);
      setRows(shops);
      if (shops.length > 0 && selectedShopId == null) {
        setSelectedShopId(shops[0].shop_id);
      }
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
      const updated = await apiAdminPatchShopPackage(token, shopId, tier, "Updated from Admin Packages page");
      setRows((prev) => prev.map((r) => (r.shop_id === shopId ? updated : r)));
      if (selectedShopId === shopId) {
        void loadAudit(shopId);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusyShopId(null);
    }
  }

  async function loadAudit(shopId: number) {
    if (!token) return;
    setAuditLoading(true);
    try {
      setAuditRows(await apiAdminShopPackageAudit(token, shopId, 100));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    if (selectedShopId == null) {
      setAuditRows([]);
      return;
    }
    void loadAudit(selectedShopId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShopId, token]);

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
          <p className="text-muted">מדד שימוש: run = מחזור סריקה מלא לחנות (לא כמות קישורי מתחרים).</p>
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

      <div className="card" style={{ marginTop: "0.9rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
          <h2 className="admin-section-h">Package Audit Trail</h2>
          <select
            value={selectedShopId ?? ""}
            onChange={(e) => setSelectedShopId(e.target.value ? Number(e.target.value) : null)}
          >
            {rows.map((r) => (
              <option key={r.shop_id} value={r.shop_id}>
                #{r.shop_id} · {r.shop_name}
              </option>
            ))}
          </select>
        </div>
        {auditLoading ? (
          <p className="text-muted">טוען היסטוריית שינויים…</p>
        ) : auditRows.length === 0 ? (
          <p className="text-muted">אין עדיין שינויים מתועדים לחנות זו.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: "0.6rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>מתי</th>
                  <th>משתמש</th>
                  <th>Tier</th>
                  <th>Max/day</th>
                  <th>Windows/day</th>
                  <th>Min interval</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                    <td>{a.changed_by_user_id}</td>
                    <td>
                      {a.previous_tier} → {a.new_tier}
                    </td>
                    <td>
                      {a.previous_max_scan_runs_per_day} → {a.new_max_scan_runs_per_day}
                    </td>
                    <td>
                      {a.previous_max_scans_per_day_window} → {a.new_max_scans_per_day_window}
                    </td>
                    <td>
                      {a.previous_min_interval_minutes} → {a.new_min_interval_minutes}
                    </td>
                    <td>{a.change_note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
