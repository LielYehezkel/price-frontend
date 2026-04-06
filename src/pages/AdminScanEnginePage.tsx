import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiAdminScanEngineSummary, type ScanEngineSummary } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

function healthTone(status: string): string {
  if (status === "ok") return "ok";
  if (status === "warning") return "warn";
  if (status === "error") return "err";
  if (status === "critical") return "crit";
  return "unknown";
}

export function AdminScanEnginePage() {
  const { token } = useAuth();
  const [data, setData] = useState<ScanEngineSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const d = await apiAdminScanEngineSummary(token);
        if (!cancelled) {
          setData(d);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "שגיאה");
      }
    }
    void load();
    const id = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token]);

  const maxHour = useMemo(() => {
    if (!data?.hourly_scans.length) return 1;
    return Math.max(1, ...data.hourly_scans.map((h) => h.count));
  }, [data]);

  if (!data && !err) {
    return (
      <div className="content-area admin-dash">
        <p className="text-muted">טוען מוניטור…</p>
      </div>
    );
  }

  const tone = data ? healthTone(data.health.status) : "unknown";

  return (
    <div className="content-area admin-dash admin-dash--wide">
      <header className="admin-dash-hero">
        <div>
          <h1 className="admin-dash-title">מנוע סריקות</h1>
          <p className="admin-dash-sub text-muted">
            הלב של המערכת — מתזמן כל {data?.scheduler_interval_seconds ?? 5} שניות, מחזור מלא לפי חנות.
          </p>
        </div>
        <Link to="/admin/operations" className="btn ghost">
          יומן תפעול
        </Link>
      </header>

      {err && <p className="error">{err}</p>}

      {data && (
        <>
          <section className={`admin-heart-card admin-heart-card--${tone}`}>
            <div className="admin-heart-card__row">
              <div className={`admin-pulse admin-pulse--${tone}`} aria-hidden />
              <div>
                <div className="admin-heart-label">מצב בריאות</div>
                <div className="admin-heart-status">{data.health.message_he}</div>
                <div className="admin-heart-meta text-muted">
                  סטטוס טכני: <code>{data.health.status}</code>
                  {data.health.stale_seconds != null && (
                    <> · {Math.round(data.health.stale_seconds)} ש׳׳ מאז דופק</>
                  )}
                </div>
              </div>
            </div>
            {(data.health.status === "error" || data.health.status === "critical") &&
              data.heartbeat.last_error_message && (
                <div className="admin-heart-alert">
                  <strong>מה קרה:</strong> {data.heartbeat.last_error_message}
                  {data.heartbeat.last_error_at && (
                    <span className="text-muted">
                      {" "}
                      ({new Date(data.heartbeat.last_error_at).toLocaleString("he-IL")})
                    </span>
                  )}
                  {data.heartbeat.last_error_detail && (
                    <div className="admin-trace-toggle">
                      <button type="button" className="btn linkish sm" onClick={() => setShowTrace((s) => !s)}>
                        {showTrace ? "הסתר מעקב מלא" : "הצג מעקב מלא (stack)"}
                      </button>
                      {showTrace && (
                        <pre className="admin-trace">{data.heartbeat.last_error_detail}</pre>
                      )}
                    </div>
                  )}
                </div>
              )}
          </section>

          <div className="admin-kpi-grid">
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.scanlog_total}</span>
              <span className="admin-kpi-tile__label">סה״כ רשומות יומן סריקה</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.scanlog_last_24h}</span>
              <span className="admin-kpi-tile__label">סריקות ב־24 שעות (יומן)</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.heartbeat.last_tick_scans}</span>
              <span className="admin-kpi-tile__label">סריקות במחזור אחרון</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.heartbeat.last_tick_shops_touched}</span>
              <span className="admin-kpi-tile__label">חנויות שעברו מחזור (אחרון)</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.heartbeat.last_tick_duration_ms}ms</span>
              <span className="admin-kpi-tile__label">משך מחזור אחרון</span>
            </div>
            <div className="admin-kpi-tile">
              <span className="admin-kpi-tile__val">{data.heartbeat.total_ticks}</span>
              <span className="admin-kpi-tile__label">סה״כ דיווחי מתזמן מאז ההפעלה</span>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--accent">
              <span className="admin-kpi-tile__val">
                {data.ops_errors_24h} / {data.ops_warnings_24h}
              </span>
              <span className="admin-kpi-tile__label">שגיאות / אזהרות תפעול (24ש׳)</span>
            </div>
          </div>

          <section className="card admin-chart-card">
            <h2 className="admin-section-h">סריקות לפי שעה (24 שעות אחרונות)</h2>
            <p className="text-muted admin-chart-hint">מבוסס על רשומות יומן הסריקה במערכת.</p>
            <div className="admin-chart" role="img" aria-label="גרף עמודות סריקות לשעה">
              {data.hourly_scans.map((h) => (
                <div key={h.bucket} className="admin-chart__col">
                  <div
                    className="admin-chart__bar"
                    style={{ height: `${Math.max(6, (h.count / maxHour) * 100)}%` }}
                    title={`${h.bucket}: ${h.count}`}
                  />
                  <span className="admin-chart__tick">
                    {h.bucket.slice(11, 13)}:00
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card admin-meta-card">
            <h2 className="admin-section-h">הקשר עסקי</h2>
            <ul className="admin-meta-list">
              <li>
                <strong>{data.users_count}</strong> משתמשים רשומים
              </li>
              <li>
                <strong>{data.shops_count}</strong> חנויות
              </li>
              <li>
                <strong>{data.competitor_links_count}</strong> קישורי מתחרים פעילים
              </li>
              <li>
                <strong>{data.pending_domain_reviews}</strong> דומיינים ממתינים לאישור מחיר
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
