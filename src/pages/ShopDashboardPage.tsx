import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  apiAccountHealth,
  apiCompetitorIntelligence,
  apiDashboardStats,
  apiDismissRecommendations,
  apiDismissSetupChecklist,
  apiListAlerts,
  apiPriceSeries,
  apiReadAlert,
  apiSetupChecklist,
  apiWeeklyReportCsv,
  type AccountHealth,
  type AlertOut,
  type DashboardStats,
  type CompetitorIntelligenceOut,
  type PriceSeriesPoint,
  type SetupChecklistResponse,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

function ProgressRing({ percent, className }: { percent: number; className?: string }) {
  const gid = useId().replace(/:/g, "");
  const gradId = `progGrad-${gid}`;
  const p = Math.min(100, Math.max(0, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <svg className={className} width="88" height="88" viewBox="0 0 88 88" aria-hidden>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <text
        x="44"
        y="48"
        textAnchor="middle"
        fill="#f8fafc"
        fontSize="15"
        fontWeight="700"
      >
        {p}%
      </text>
    </svg>
  );
}

function formatPriceTick(n: number): string {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

/** מגמת מחיר מינימלי בשוק לפי שעה — צירים, רשת, בלי זיגזג ממוצרים שונים */
function MarketFloorChart({ points }: { points: PriceSeriesPoint[] }) {
  const gid = useId().replace(/:/g, "");
  const fillGrad = `dashFill-${gid}`;
  const strokeGrad = `dashStroke-${gid}`;

  if (points.length === 0) {
    return (
      <p className="dash-v2-chart__empty">אין עדיין נתוני מחיר מתועדים מהמתחרים — אחרי סריקות יוצג כאן המגמה.</p>
    );
  }

  if (points.length === 1) {
    const p = points[0];
    const when = new Date(p.t).toLocaleString("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      <div className="dash-v2-chart__single" role="img" aria-label="נקודת מחיר יחידה">
        <p className="dash-v2-chart__single-val tabular-nums">{p.price.toFixed(2)}</p>
        <p className="dash-v2-chart__single-meta">המחיר הנמוך בשוק בשעה {when}</p>
        {p.samples != null && p.samples > 1 && (
          <p className="dash-v2-chart__single-samples">מבוסס על {p.samples} דגימות באותה שעה</p>
        )}
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const spread = maxP - minP || Math.abs(maxP) * 0.02 || 1;
  const padY = Math.max(spread * 0.1, 0.01);
  const y0 = minP - padY;
  const y1 = maxP + padY;
  const yRange = y1 - y0 || 1;

  const W = 560;
  const H = 200;
  const padL = 46;
  const padR = 14;
  const padT = 10;
  const padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = points.length;

  const linePts = points.map((p, i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padT + (1 - (p.price - y0) / yRange) * innerH;
    return `${x},${y}`;
  });
  const line = linePts.join(" ");
  const last = linePts[linePts.length - 1].split(",").map(Number);
  const areaD = `M ${padL},${padT + innerH} L ${linePts.join(" L ")} L ${padL + innerW},${padT + innerH} Z`;

  const yTicks = [0, 0.33, 0.66, 1].map((t) => y0 + (1 - t) * yRange);
  const xLabelIdx =
    n <= 4 ? points.map((_, i) => i) : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  return (
    <svg
      className="dash-v2-chart__svg dash-v2-chart__svg--axes"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="מגמת מחיר מינימלי בשוק לפי שעה"
    >
      <defs>
        <linearGradient id={fillGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(129, 140, 248, 0.28)" />
          <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
        </linearGradient>
        <linearGradient id={strokeGrad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>

      {yTicks.map((yv, i) => {
        const yy = padT + (1 - (yv - y0) / yRange) * innerH;
        return (
          <g key={`g-${i}`}>
            <line
              x1={padL}
              y1={yy}
              x2={padL + innerW}
              y2={yy}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={yy + 4}
              textAnchor="end"
              fill="#64748b"
              fontSize="10"
              className="tabular-nums"
            >
              {formatPriceTick(yv)}
            </text>
          </g>
        );
      })}

      <text x={padL} y={14} fill="#94a3b8" fontSize="10" fontWeight="600">
        מחיר (מינ׳ בשוק)
      </text>

      <path d={areaD} fill={`url(#${fillGrad})`} />
      <polyline
        fill="none"
        stroke={`url(#${strokeGrad})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="#e0e7ff" stroke="#3730a3" strokeWidth="2" />

      {xLabelIdx.map((idx) => {
        const p = points[idx];
        const x = padL + (n === 1 ? innerW / 2 : (idx / (n - 1)) * innerW);
        const label = new Date(p.t).toLocaleString("he-IL", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <text
            key={`x-${idx}`}
            x={x}
            y={H - 10}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="9"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function dedupeAlerts(items: AlertOut[], max = 6): AlertOut[] {
  const seen = new Set<string>();
  const out: AlertOut[] = [];
  for (const a of items) {
    const k = a.message.trim();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

const alertKindLabel: Record<string, string> = {
  competitor_cheaper: "יתרון מתחרה",
  price_change: "שינוי מחיר",
  auto_pricing: "תמחור אוטומטי",
  sanity_failed: "אמינות",
  general: "כללי",
};

export function ShopDashboardPage() {
  const { shopId } = useParams();
  const { token } = useAuth();
  const sid = Number(shopId);
  const base = `/app/${shopId}`;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<AlertOut[]>([]);
  const [chart, setChart] = useState<PriceSeriesPoint[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<SetupChecklistResponse | null>(null);
  const [health, setHealth] = useState<AccountHealth | null>(null);
  const [intel, setIntel] = useState<CompetitorIntelligenceOut | null>(null);
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [dismissBusy, setDismissBusy] = useState(false);
  const [recBusy, setRecBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "market" | "intel" | "ops">("overview");
  const [opsTab, setOpsTab] = useState<"recommendations" | "alerts">("recommendations");

  const loadData = useCallback(async () => {
    if (!token || Number.isNaN(sid)) return;
    const [d, a, s, cl, h, ci] = await Promise.all([
      apiDashboardStats(token, sid),
      apiListAlerts(token, sid, true),
      apiPriceSeries(token, sid, undefined, undefined, "hourly_min"),
      apiSetupChecklist(token, sid),
      apiAccountHealth(token, sid),
      apiCompetitorIntelligence(token, sid, 30),
    ]);
    setStats(d);
    setAlerts(a);
    setChart(s.points.slice(-96));
    setChecklist(cl);
    setHealth(h);
    setIntel(ci);
  }, [token, sid]);

  useEffect(() => {
    if (!token || Number.isNaN(sid)) return;
    let cancelled = false;
    (async () => {
      try {
        await loadData();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "שגיאה");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sid, loadData]);

  async function onDismissChecklist() {
    if (!token || dismissBusy) return;
    setDismissBusy(true);
    try {
      await apiDismissSetupChecklist(token, sid);
      setChecklist((c) => (c ? { ...c, dismissed: true } : c));
    } catch {
      /* ignore */
    } finally {
      setDismissBusy(false);
    }
  }

  async function onWeeklyExport() {
    if (!token || weeklyBusy) return;
    setWeeklyBusy(true);
    try {
      const blob = await apiWeeklyReportCsv(token, sid);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weekly-report-shop-${sid}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("לא ניתן להוריד את הדוח כרגע");
    } finally {
      setWeeklyBusy(false);
    }
  }

  async function onDismissRecommendation(id: string) {
    if (!token || recBusy) return;
    setRecBusy(id);
    setErr(null);
    try {
      await apiDismissRecommendations(token, sid, [id]);
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setRecBusy(null);
    }
  }

  async function onReadAlert(alertId: number) {
    if (!token) return;
    try {
      await apiReadAlert(token, sid, alertId);
      await loadData();
    } catch {
      /* ignore */
    }
  }

  const alertFeed = useMemo(() => dedupeAlerts(alerts), [alerts]);

  const priceSummary = useMemo(() => {
    if (chart.length === 0) return null;
    const prices = chart.map((p) => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      latest: prices[prices.length - 1],
    };
  }, [chart]);

  const healthOk = alertFeed.length === 0;
  const showOnboarding =
    checklist && !checklist.dismissed && checklist.percent_complete < 100;

  const recs = stats?.recommendations ?? [];
  const healthScore = health?.score ?? 0;
  const level = Math.max(1, Math.min(10, Math.ceil(healthScore / 10)));
  const levelTitle = healthScore >= 85 ? "אליטה תפעולית" : healthScore >= 65 ? "שליטה מתקדמת" : "בבנייה";

  return (
    <div className="dash-v2 dash-v3">
      <header className="dash-v3-hero">
        <div>
          <p className="dash-v3-kicker">Premium Command Experience</p>
          <h1 className="dash-v3-title">מרכז שליטה פרימיום</h1>
          <p className="dash-v3-lead">כל נתוני החנות מסודרים לפי אזורים, טאבים ותתי-טאבים.</p>
        </div>
        <div className="dash-v3-level">
          <span className="dash-v3-level__badge">Level {level}</span>
          <strong>{levelTitle}</strong>
          <small className="tabular-nums">Score: {healthScore}</small>
        </div>
      </header>

      <section className="dash-v3-toolbar">
        <div className="dash-v3-tabs" role="tablist" aria-label="ניווט דאשבורד">
          {[
            { key: "overview", label: "סקירה" },
            { key: "market", label: "שוק ומחירים" },
            { key: "intel", label: "מודיעין מתחרים" },
            { key: "ops", label: "בקרה ותפעול" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`dash-v3-tab ${activeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key as "overview" | "market" | "intel" | "ops")}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="dash-v3-actions">
          <button
            type="button"
            className="btn secondary sm"
            disabled={weeklyBusy || !token}
            onClick={() => void onWeeklyExport()}
          >
            {weeklyBusy ? "מכין…" : "דוח שבועי"}
          </button>
          <Link to={`${base}/settings`} className="btn ghost sm">
            התראות והגדרות
          </Link>
        </div>
      </section>

      {err && (
        <div className="dash-banner dash-banner--error" role="alert">
          {err}
        </div>
      )}

      {activeTab === "overview" && health && (
        <section className="dash-v2-section dash-v2-section--compact" aria-label="בריאות חשבון">
          <div className="dash-v2-health">
            <p className="dash-v2-health__summary">{health.summary}</p>
            {health.issues.length === 0 ? (
              <p className="dash-v2-health__ok">המערכת מחוברת ופועלת כמצופה.</p>
            ) : (
              <ul className="dash-v2-health__list">
                {health.issues.slice(0, 6).map((issue) => (
                  <li key={issue.code} className={`dash-v2-health__li dash-v2-health__li--${issue.severity}`}>
                    <strong>{issue.title}</strong>
                    <span>{issue.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeTab === "overview" && showOnboarding && checklist && (
        <section className="dash-v2-section" aria-label="הקמת חנות">
          <div className="dash-v2-onboard">
            <div className="dash-v2-onboard__head">
              <ProgressRing percent={checklist.percent_complete} />
              <div>
                <h2 className="dash-v2-onboard__title">התחלה חכמה</h2>
                <p className="dash-v2-onboard__sub">
                  השלימו את הצעדים — מעקב מחירים מלא לפני הפתעות מהמתחרים.
                </p>
              </div>
            </div>
            <ol className="dash-v2-onboard__steps">
              {checklist.steps.map((step) => (
                <li key={step.id} className={step.done ? "is-done" : ""}>
                  <span className="dash-v2-onboard__mark" aria-hidden>
                    {step.done ? "✓" : "○"}
                  </span>
                  <div>
                    <div className="dash-v2-onboard__step-title">{step.title}</div>
                    <p className="dash-v2-onboard__step-desc">{step.description}</p>
                    {!step.done && (
                      <Link className="dash-v2-onboard__link" to={`${base}/${step.cta_path}`}>
                        {step.cta_label} →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="btn ghost sm"
              disabled={dismissBusy}
              onClick={() => void onDismissChecklist()}
            >
              {dismissBusy ? "מסתיר…" : "הסתר כרטיס"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "overview" && stats && (
        <section className="dash-v3-kpis">
          <div className="dash-v3-kpi-card">
            <span>בריאות מערכת</span>
            <strong className="tabular-nums">{healthScore}</strong>
            <small>{healthOk ? "סטטוס יציב" : "נדרשת תשומת לב"}</small>
          </div>
          <div className="dash-v3-kpi-card">
            <span>מוצרים במעקב</span>
            <strong className="tabular-nums">{stats.products_with_competitors}</strong>
            <small>מתוך {stats.product_count}</small>
          </div>
          <div className="dash-v3-kpi-card">
            <span>התראות פתוחות</span>
            <strong className="tabular-nums">{alertFeed.length}</strong>
            <small>{healthOk ? "אין עומס" : "מצריך טיפול"}</small>
          </div>
          <div className="dash-v3-kpi-card">
            <span>סריקות מצטברות</span>
            <strong className="tabular-nums">{stats.total_scans}</strong>
            <small>רצף ניטור פעיל</small>
          </div>
        </section>
      )}

      {activeTab === "market" && stats && (
        <section className="dash-v2-bento" aria-label="נתונים">
          <article className="dash-v2-panel dash-v2-panel--chart">
            <div className="dash-v2-panel__head">
              <h2 className="dash-v2-panel__title">מחיר המתחרה הנמוך בשוק</h2>
              <p className="dash-v2-panel__sub">
                לפי שעה — המחיר הנמוך ביותר מבין כל המוצרים והמתחרים שמעקבים אחריהם (לא מערבב דגימות
                של מוצרים שונים בקו אחד)
              </p>
            </div>
            <div className="dash-v2-chart__wrap">
              <MarketFloorChart points={chart} />
            </div>
            <p className="dash-v2-chart__hint">
              כל נקודה בגרף = מינימום מחירי מתחרים באותה שעה. כך רואים אם &quot;רצפת&quot; השוק עלתה או
              ירדה בזמן, בלי זיגזג מטעה.
            </p>
            {priceSummary && (
              <dl className="dash-v2-statline">
                <div>
                  <dt>אחרון (שעה אחרונה בתרשים)</dt>
                  <dd className="tabular-nums">{priceSummary.latest.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>טווח בתקופה</dt>
                  <dd className="tabular-nums">
                    {priceSummary.min.toFixed(2)} – {priceSummary.max.toFixed(2)}
                  </dd>
                </div>
              </dl>
            )}
            <div className="dash-v2-microtable-wrap">
              <table className="dash-v2-microtable">
                <thead>
                  <tr>
                    <th>שעה</th>
                    <th>מחיר נמוך בשוק</th>
                    <th>דגימות בשעה</th>
                  </tr>
                </thead>
                <tbody>
                  {chart
                    .slice()
                    .reverse()
                    .slice(0, 6)
                    .map((p, i) => (
                      <tr key={`${p.t}-${i}`}>
                        <td>
                          {new Date(p.t).toLocaleString("he-IL", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="tabular-nums">{p.price.toFixed(2)}</td>
                        <td className="tabular-nums">{p.samples != null ? p.samples : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="dash-v2-side" aria-label="מדדים">
            <div className="dash-v2-metric">
              <span className="dash-v2-metric__label">מוצרים במעקב</span>
              <span className="dash-v2-metric__value tabular-nums">
                {stats.products_with_competitors}
                <small> / {stats.product_count}</small>
              </span>
            </div>
            <div className="dash-v2-metric">
              <span className="dash-v2-metric__label">קישורי מתחרים</span>
              <span className="dash-v2-metric__value tabular-nums">{stats.competitor_links}</span>
            </div>
            <div className="dash-v2-metric">
              <span className="dash-v2-metric__label">מרווח סריקה</span>
              <span className="dash-v2-metric__value tabular-nums">
                {stats.check_interval_minutes}
                <small> דק׳</small>
              </span>
            </div>
            <div className="dash-v2-metric dash-v2-metric--muted">
              <span className="dash-v2-metric__label">סריקות בחלון האחרון</span>
              <span className="dash-v2-metric__value tabular-nums">
                {stats.scans_in_last_interval_window}
              </span>
            </div>
            <div className="dash-v2-metric dash-v2-metric--muted">
              <span className="dash-v2-metric__label">סה״כ סריקות מתועדות</span>
              <span className="dash-v2-metric__value tabular-nums">{stats.total_scans}</span>
            </div>
            <p className="dash-v2-hint">
              מחזור מלא משוער ~{stats.estimated_full_queue_minutes_rounded} דק׳ · בודקים כל{" "}
              {stats.worker_interval_seconds} שניות אם הגיע תור לחנות.
            </p>
          </aside>
        </section>
      )}

      {activeTab === "intel" && (
        <section className="dash-v2-section">
        <div className="dash-v2-section-head dash-v2-section-head--row">
          <div>
            <h2 className="dash-v2-section-title">מודיעין מתחרים</h2>
            <p className="dash-v2-section-sub">
              מצב נוכחי מול המתחרים + שינויי מחיר ב־{intel?.period_days ?? 30} הימים האחרונים.
            </p>
          </div>
        </div>
        {!intel ? (
          <p className="text-muted">טוען מודיעין…</p>
        ) : (
          <>
            <div className="dash-v2-intel-kpis">
              <div className="dash-v2-intel-kpi">
                <span>אנחנו זולים</span>
                <strong className="tabular-nums">{intel.current_overall.cheaper}</strong>
              </div>
              <div className="dash-v2-intel-kpi">
                <span>אנחנו יקרים</span>
                <strong className="tabular-nums">{intel.current_overall.expensive}</strong>
              </div>
              <div className="dash-v2-intel-kpi">
                <span>שוויון מחיר</span>
                <strong className="tabular-nums">{intel.current_overall.tie}</strong>
              </div>
              <div className="dash-v2-intel-kpi">
                <span>שינויי מחיר ({intel.period_days} ימים)</span>
                <strong className="tabular-nums">{intel.total_price_changes_in_period}</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>מתחרה</th>
                    <th>זולים</th>
                    <th>יקרים</th>
                    <th>שווים</th>
                    <th>שינויי מחיר</th>
                    <th>שינוי אחרון</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.competitors.slice(0, 12)?.map((r) => (
                    <tr key={`${r.tracked_competitor_id ?? "d"}-${r.domain}`}>
                      <td>
                        <strong>{r.competitor_name}</strong>
                        <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                          {r.domain} · {r.links_count} קישורים
                        </div>
                      </td>
                      <td className="tabular-nums">{r.current_cheaper}</td>
                      <td className="tabular-nums">{r.current_expensive}</td>
                      <td className="tabular-nums">{r.current_tie}</td>
                      <td className="tabular-nums">{r.price_changes_in_period}</td>
                      <td className="tabular-nums">
                        {r.last_price_change_at
                          ? new Date(r.last_price_change_at).toLocaleString("he-IL", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </section>
      )}

      {activeTab === "ops" && (
        <section className="dash-v2-section">
          <div className="dash-v3-subtabs">
            <button
              type="button"
              className={`dash-v3-subtab ${opsTab === "recommendations" ? "is-active" : ""}`}
              onClick={() => setOpsTab("recommendations")}
            >
              המלצות
            </button>
            <button
              type="button"
              className={`dash-v3-subtab ${opsTab === "alerts" ? "is-active" : ""}`}
              onClick={() => setOpsTab("alerts")}
            >
              התראות
            </button>
          </div>

          {opsTab === "recommendations" && (
            <>
              <div className="dash-v2-section-head">
                <h2 className="dash-v2-section-title">המלצות</h2>
                <p className="dash-v2-section-sub">סימון &quot;הבנתי&quot; מסתיר פריט עד שתנאים משתנים</p>
              </div>
              <ul className="dash-v2-recs">
                {!stats ? (
                  <li className="dash-v2-rec">
                    <p className="dash-v2-rec__text">טוען…</p>
                  </li>
                ) : recs?.length === 0 ? (
                  <li className="dash-v2-rec">
                    <p className="dash-v2-rec__text">אין המלצות חדשות כרגע.</p>
                  </li>
                ) : (
                  recs?.map((r) => (
                    <li key={r.id} className="dash-v2-rec">
                      <p className="dash-v2-rec__text">{r.text}</p>
                      <button
                        type="button"
                        className="dash-v2-rec__dismiss"
                        disabled={recBusy === r.id}
                        onClick={() => void onDismissRecommendation(r.id)}
                      >
                        {recBusy === r.id ? "…" : "הבנתי"}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}

          {opsTab === "alerts" && (
            <>
              <div className="dash-v2-section-head dash-v2-section-head--row">
                <div>
                  <h2 className="dash-v2-section-title">התראות אחרונות</h2>
                  <p className="dash-v2-section-sub">לפי ההעדפות שלך בהגדרות — סמן נקרא כשטיפלת</p>
                </div>
                <Link to={`${base}/alerts`} className="btn secondary sm">
                  כל ההתראות
                </Link>
              </div>
              <div className="dash-v2-alerts">
                {alertFeed?.length === 0 ? (
                  <p className="dash-v2-alerts__empty">אין התראות שלא נקראו — מצוין.</p>
                ) : (
                  alertFeed?.map((a) => (
                    <div key={a.id} className={`dash-v2-alert dash-v2-alert--${a.severity === "hot" ? "hot" : "info"}`}>
                      <div className="dash-v2-alert__top">
                        <span className="dash-v2-alert__kind">{alertKindLabel[a.kind] ?? a.kind}</span>
                        <time dateTime={a.created_at}>
                          {new Date(a.created_at).toLocaleString("he-IL", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                      <p className="dash-v2-alert__msg">{a.message}</p>
                      {!a.read && (
                        <button
                          type="button"
                          className="btn ghost sm dash-v2-alert__read"
                          onClick={() => void onReadAlert(a.id)}
                        >
                          סמן כנקרא
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
