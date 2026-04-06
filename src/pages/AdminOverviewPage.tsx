import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiAdminDashboardOverview, type AdminDashboardOverview } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

function healthTone(status: string): string {
  if (status === "ok") return "ok";
  if (status === "warning") return "warn";
  if (status === "error") return "err";
  if (status === "critical") return "crit";
  return "unknown";
}

export function AdminOverviewPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminDashboardOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const d = await apiAdminDashboardOverview(token);
        if (!cancelled) {
          setData(d);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "שגיאה");
      }
    }
    void load();
    const id = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token]);

  if (!data && !err) {
    return (
      <div className="content-area admin-dash">
        <p className="text-muted">טוען סקירה…</p>
      </div>
    );
  }

  const tone = data ? healthTone(data.health.status) : "unknown";

  return (
    <div className="content-area admin-dash">
      <header className="admin-dash-hero">
        <div>
          <h1 className="admin-dash-title">סקירת מערכת</h1>
          <p className="admin-dash-sub text-muted">מבט אחד על הלב התפעולי ועל העומס.</p>
        </div>
        <Link to="/admin/scan-engine" className="btn primary">
          מוניטור מנוע סריקות
        </Link>
      </header>

      {err && <p className="error">{err}</p>}

      {data && (
        <>
          <section className={`admin-heart-card admin-heart-card--${tone}`}>
            <div className="admin-heart-card__row">
              <div className={`admin-pulse admin-pulse--${tone}`} aria-hidden />
              <div>
                <div className="admin-heart-label">מצב מנוע הסריקות</div>
                <div className="admin-heart-status">{data.health.message_he}</div>
                {data.health.stale_seconds != null && (
                  <div className="admin-heart-meta text-muted">
                    זמן מאז דופק אחרון: {Math.round(data.health.stale_seconds)} ש׳׳
                  </div>
                )}
              </div>
            </div>
            <div className="admin-heart-metrics">
              <div>
                <span className="admin-kpi-val">{data.heartbeat.last_tick_scans}</span>
                <span className="admin-kpi-label">סריקות במחזור אחרון</span>
              </div>
              <div>
                <span className="admin-kpi-val">{data.heartbeat.last_tick_duration_ms}ms</span>
                <span className="admin-kpi-label">משך מחזור אחרון</span>
              </div>
              <div>
                <span className="admin-kpi-val">{data.scanlog_last_24h}</span>
                <span className="admin-kpi-label">רשומות יומן (24 שעות)</span>
              </div>
            </div>
            {(data.health.status === "error" || data.health.status === "critical") &&
              data.heartbeat.last_error_message && (
                <div className="admin-heart-alert">
                  <strong>שגיאה אחרונה:</strong> {data.heartbeat.last_error_message}
                </div>
              )}
          </section>

          <div className="admin-kpi-grid">
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.users_count}</span>
              <span className="admin-kpi-tile__label">משתמשים</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.shops_count}</span>
              <span className="admin-kpi-tile__label">חנויות</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.competitor_links_count}</span>
              <span className="admin-kpi-tile__label">קישורי מתחרים</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.pending_domain_reviews}</span>
              <span className="admin-kpi-tile__label">דומיינים ממתינים לאישור</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.scanlog_total}</span>
              <span className="admin-kpi-tile__label">סה״כ רשומות יומן סריקה</span>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--accent">
              <span className="admin-kpi-tile__val">
                {data.ops_errors_24h} / {data.ops_warnings_24h}
              </span>
              <span className="admin-kpi-tile__label">שגיאות / אזהרות תפעול (24ש׳)</span>
            </div>
          </div>

          <nav className="admin-quick-links card">
            <h2 className="admin-section-h">ניהול מהיר</h2>
            <div className="admin-quick-links__grid">
              <Link to="/admin/scan-engine">מוניטור סריקות מלא</Link>
              <Link to="/admin/operations">יומן תפעול ואבחון</Link>
              <Link to="/admin/domains">בדיקת דומיינים</Link>
              <Link to="/admin/users">משתמשים</Link>
              <Link to="/admin/tool">כלי מחיר</Link>
              <Link to="/admin/price-sanity">סף אמינות</Link>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
