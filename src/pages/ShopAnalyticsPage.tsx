import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiShopSalesInsights, type SalesInsightsOut } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

function storageKey(shopId: number, days: number) {
  return `priceintel:salesInsights:v1:${shopId}:${days}`;
}

function loadStored(shopId: number, days: number): SalesInsightsOut | null {
  try {
    const raw = sessionStorage.getItem(storageKey(shopId, days));
    if (!raw) return null;
    return JSON.parse(raw) as SalesInsightsOut;
  } catch {
    return null;
  }
}

function saveStored(shopId: number, days: number, data: SalesInsightsOut) {
  try {
    if (data.ok) sessionStorage.setItem(storageKey(shopId, days), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function ShopAnalyticsPage() {
  const { shopId } = useParams();
  const { token } = useAuth();
  const sid = Number(shopId);
  const [days, setDays] = useState(90);
  const [data, setData] = useState<SalesInsightsOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** רשת: טעינה / רענון */
  const [fetching, setFetching] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxBandRev = useMemo(() => {
    if (!data?.ok || !data.price_bands?.length) return 1;
    return Math.max(...data.price_bands.map((b) => b.revenue), 1);
  }, [data]);

  // טעינה: sessionStorage לפי תקופה → API (מטמון שרת מהיר)
  useEffect(() => {
    if (!token || Number.isNaN(sid)) {
      setFetching(false);
      return;
    }
    const stored = loadStored(sid, days);
    if (stored?.ok) {
      setData(stored);
    } else {
      setData(null);
    }
    let cancelled = false;
    setErr(null);
    setFetching(true);
    void (async () => {
      try {
        const r = await apiShopSalesInsights(token, sid, days);
        if (!cancelled) {
          setData(r);
          if (r.ok) saveStored(sid, days, r);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "שגיאה");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sid, days]);

  // כשהשרת מחזיר stale — נסה לקבל רענון אחרי חישוב ברקע
  useEffect(() => {
    if (!token || Number.isNaN(sid) || !data?.ok || !data.cache?.stale) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    let n = 0;
    pollRef.current = setInterval(() => {
      n += 1;
      if (n > 12) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }
      void (async () => {
        try {
          const r = await apiShopSalesInsights(token, sid, days);
          if (r.ok && r.cache && !r.cache.stale) {
            setData(r);
            saveStored(sid, days, r);
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          /* ignore */
        }
      })();
    }, 10000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [token, sid, days, data?.ok === true ? data.cache?.stale : undefined]);

  async function handleForceRefresh() {
    if (!token || Number.isNaN(sid)) return;
    setErr(null);
    setFetching(true);
    try {
      const r = await apiShopSalesInsights(token, sid, days, { forceRefresh: true });
      setData(r);
      if (r.ok) saveStored(sid, days, r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setFetching(false);
    }
  }

  if (!data && fetching) {
    return (
      <div className="analytics-skeleton" aria-busy="true">
        <div className="skeleton-line lg" />
        <div className="skeleton-line" />
        <div className="kpi-grid" style={{ marginTop: "1.25rem" }}>
          <div className="skeleton-kpi" />
          <div className="skeleton-kpi" />
          <div className="skeleton-kpi" />
        </div>
        <p className="text-muted page-sub" style={{ marginTop: "1rem" }}>
          טוען נתוני מכירות…
        </p>
      </div>
    );
  }

  if (err && !data) {
    return <p className="error">{err}</p>;
  }

  if (!data) {
    return null;
  }

  if (!data.ok && "message_he" in data && data.message_he) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>סטטיסטיקות מכירות</h2>
        <p>{data.message_he}</p>
      </div>
    );
  }

  if (!data.ok) {
    return <p className="error">{err ?? "לא ניתן לטעון נתונים"}</p>;
  }

  const cur = data.currency || "";
  const cacheHint =
    data.cache?.computed_at != null
      ? new Date(data.cache.computed_at).toLocaleString("he-IL")
      : null;

  return (
    <>
      {fetching && (
        <div className="analytics-refresh-bar" role="status">
          {data.cache?.stale ? "מעדכן נתונים מהחנות…" : "מרענן…"}
        </div>
      )}

      {data.cache?.stale && !fetching && (
        <div className="card" style={{ marginBottom: "0.75rem", padding: "0.65rem 1rem" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            מוצגים נתונים שמורים (מהיר) — עדכון מלא מהחנות רץ ברקע. אפשר גם{" "}
            <button type="button" className="btn linkish sm" onClick={() => void handleForceRefresh()}>
              לרענן עכשיו
            </button>
            {cacheHint ? (
              <>
                {" "}
                · נשמר: {cacheHint}
              </>
            ) : null}
          </p>
        </div>
      )}

      {!data.cache?.stale && cacheHint && (
        <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>
          נתונים עדכניים · חישוב אחרון: {cacheHint}
          {" · "}
          <button type="button" className="btn linkish sm" onClick={() => void handleForceRefresh()}>
            רענון מלא
          </button>
        </p>
      )}

      <p className="page-sub">
        נתונים אמיתיים מ־WooCommerce: הזמנות שהושלמו / בעיבוד / בהמתנה, רק עבור מוצרים שמסונכרנים
        במערכת. כך רואים איפה נמכר הכי הרבה לפי טווחי מחיר, ומה קורה במוצרים עם תמחור אוטומטי.
      </p>

      <div className="flex-between" style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem" }}>השפעה עסקית ומכירות</h1>
        <label className="flex-row" style={{ alignItems: "center", gap: "0.5rem" }}>
          <span className="text-muted">תקופה (ימים)</span>
          <select
            className="input"
            style={{ width: "auto", minWidth: 100 }}
            value={days}
            disabled={fetching}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>30</option>
            <option value={90}>90</option>
            <option value={180}>180</option>
            <option value={365}>365</option>
          </select>
        </label>
      </div>

      <div className="kpi-grid" style={{ opacity: fetching ? 0.72 : 1, transition: "opacity 0.2s" }}>
        <div className="kpi">
          <div className="kpi-label">הכנסות (מוצרים במעקב)</div>
          <div className="kpi-value">
            {data.total_revenue_tracked.toLocaleString("he-IL")}
            {cur ? ` ${cur}` : ""}
          </div>
          <div className="kpi-hint">
            {data.tracked_line_items} שורות הזמנה · {data.orders_with_tracked_lines} הזמנות עם מוצרים
            אלה
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">יחידות שנמכרו</div>
          <div className="kpi-value">{data.total_units_tracked.toLocaleString("he-IL")}</div>
          <div className="kpi-hint">מתוך {data.orders_fetched} הזמנות שנמשכו מהחנות</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">הכנסות — תמחור אוטומטי פעיל</div>
          <div className="kpi-value">
            {data.auto_pricing_revenue.toLocaleString("he-IL")}
            {cur ? ` ${cur}` : ""}
          </div>
          <div className="kpi-hint">{data.auto_pricing_units.toLocaleString("he-IL")} יחידות (מוצרים עם
            תמחור אוטומטי מופעל היום)</div>
        </div>
      </div>

      {data.period_split && (
        <div className="card mt-2">
          <h3 style={{ marginTop: 0 }}>מגמה בתוך התקופה</h3>
          <p className="text-muted" style={{ marginTop: 0 }}>
            חצי תקופה מוקדם מול מאוחר (לפי תאריך הזמנה ב־UTC).
          </p>
          <div className="flex-row" style={{ gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <strong>חצי ראשון</strong>
              <div className="kpi-value" style={{ fontSize: "1.35rem" }}>
                {data.period_split.first_half_revenue.toLocaleString("he-IL")} {cur}
              </div>
            </div>
            <div>
              <strong>חצי שני</strong>
              <div className="kpi-value" style={{ fontSize: "1.35rem" }}>
                {data.period_split.second_half_revenue.toLocaleString("he-IL")} {cur}
              </div>
            </div>
          </div>
          {data.period_split.comparison_note && (
            <p className="text-muted mt-1" style={{ fontSize: "0.9rem" }}>
              {data.period_split.comparison_note}
            </p>
          )}
        </div>
      )}

      <div className="card mt-2">
        <h3 style={{ marginTop: 0 }}>איפה המחיר „מביא” הכי הרבה הכנסות</h3>
        <p className="text-muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
          כל שורת הזמנה נספרת לפי <strong>מחיר ליחידה בפועל</strong> (סכום השורה חלקי כמות). הגרף מראה
          באיזה טווחי מחיר נרשמה ההכנסה הגבוהה ביותר — לא תחזית, אלא מה שכבר נמכר.
        </p>
        {data.price_bands.length === 0 ? (
          <p className="text-muted">אין מספיק נתונים בטווח התאריכים.</p>
        ) : (
          data.price_bands.map((b) => (
            <div key={b.label} className="bar-row">
              <span style={{ fontWeight: 600 }}>{b.label}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.max(4, (b.revenue / maxBandRev) * 100)}%` }}
                />
              </div>
              <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {b.revenue.toLocaleString("he-IL")} {cur} · {b.units.toFixed(1)} יח׳
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card mt-2">
        <h3 style={{ marginTop: 0 }}>מובילים לפי הכנסה</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>מוצר</th>
                <th>הכנסות</th>
                <th>יחידות</th>
              </tr>
            </thead>
            <tbody>
              {data.top_products.map((row) => (
                <tr key={row.product_id}>
                  <td>{row.name}</td>
                  <td>
                    {row.revenue.toLocaleString("he-IL")} {cur}
                  </td>
                  <td>{row.units.toLocaleString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="card mt-2" style={{ cursor: "pointer" }}>
        <summary style={{ fontWeight: 600 }}>שקיפות ומגבלות (חשוב לקרוא)</summary>
        <p className="text-muted" style={{ marginTop: "0.75rem", fontSize: "0.9rem", lineHeight: 1.65 }}>
          {data.methodology_he}
        </p>
      </details>
    </>
  );
}
