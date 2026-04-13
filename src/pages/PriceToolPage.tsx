import { FormEvent, useState } from "react";
import {
  apiAdminPriceResolve,
  apiPriceConfirm,
  apiPriceResolve,
  type PriceCandidate,
  type PriceResolveOut,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((x) => JSON.stringify(x)).join("; ");
  return JSON.stringify(detail);
}

function isAbortError(ex: unknown): boolean {
  if (ex instanceof DOMException && ex.name === "AbortError") return true;
  if (ex instanceof Error && ex.name === "AbortError") return true;
  return false;
}

export function PriceToolPage() {
  const { token } = useAuth();
  const [url, setUrl] = useState("");
  const [ignoreSaved, setIgnoreSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<PriceResolveOut | null>(null);
  const [pick, setPick] = useState<PriceCandidate | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runResolve(nextUrl: string, forceIgnoreSaved: boolean) {
    if (!token) {
      setErr("אין הרשאה — התחברו מחדש.");
      return;
    }
    setLoading(true);
    setErr(null);
    setPick(null);
    try {
      const r = forceIgnoreSaved
        ? await apiAdminPriceResolve(token, { url: nextUrl, ignore_saved_selector: true })
        : await apiPriceResolve({ url: nextUrl });
      setRes(r);
    } catch (ex: unknown) {
      if (isAbortError(ex)) {
        setErr("הבקשה ארכה יותר מדי — נסו שוב או קישור אחר.");
      } else {
        setErr(ex instanceof Error ? ex.message : detailMessage(ex));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResolve(e: FormEvent) {
    e.preventDefault();
    await runResolve(url, ignoreSaved);
  }

  async function onConfirm() {
    if (!res || !pick || !token) return;
    setLoading(true);
    setErr(null);
    try {
      await apiPriceConfirm({
        url: res.url,
        css_selector: pick.selector,
        resolution_token: res.resolution_token,
        selector_alternates: pick.selector_alternates,
        fetch_strategy: res.fetch_strategy_used ?? undefined,
      });
      alert("נשמר לפי דומיין");
    } catch (ex: unknown) {
      if (isAbortError(ex)) {
        setErr("הבקשה ארכה יותר מדי — נסו שוב.");
      } else {
        setErr(ex instanceof Error ? ex.message : detailMessage(ex));
      }
    } finally {
      setLoading(false);
    }
  }

  const learnedOnly = Boolean(res?.learned_selector && (res.candidates?.length ?? 0) === 0);
  const hasCandidates = (res?.candidates?.length ?? 0) > 0;

  return (
    <div className="content-area" style={{ maxWidth: 960 }}>
      <h1 style={{ marginTop: 0 }}>כלי זיהוי מחיר</h1>
      <p className="text-muted" style={{ marginTop: 0 }}>
        הדביקו כתובת מוצר — המערכת תוריד את הדף ותנסה למצוא מחיר. אם כבר נשמר סלקטור לדומיין, ברירת
        המחדל היא להשתמש בו; אפשר להתעלם ממנו ולבחור סלקטור אחר אם המחיר שגוי.
      </p>

      <div className="card">
        <form onSubmit={onResolve} className="flex-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "מעבד…" : "זהה מחיר"}
          </button>
        </form>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
            marginTop: "1rem",
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          <input
            type="checkbox"
            checked={ignoreSaved}
            onChange={(e) => setIgnoreSaved(e.target.checked)}
          />
          <span>
            <strong>טעות במחיר / סלקטור שגוי</strong> — התעלם מסלקטור שמור לדומיין וגלה מחירים
            מחדש (מועמדים מלאים)
          </span>
        </label>
        {err && <p className="error mt-1">{err}</p>}
      </div>

      {res && (
        <div className="card mt-2">
          <h2 style={{ marginTop: 0 }}>תוצאה</h2>
          <p>
            <strong>דומיין:</strong> {res.domain}
          </p>
          <p>
            <strong>מחיר:</strong> {res.price ?? "לא נמצא"}{" "}
            {res.currency && <span>({res.currency})</span>}
          </p>
          <p>
            <strong>מקור:</strong> {res.source ?? "—"}
          </p>
          {res.learned_selector && (
            <p>
              <strong>סלקטור שנלמד (שמור):</strong> <code>{res.learned_selector}</code>
            </p>
          )}

          {learnedOnly && (
            <div
              className="card"
              style={{
                marginTop: "1rem",
                background: "var(--accent-soft, rgba(100, 120, 200, 0.12))",
                border: "1px solid var(--accent, #6b7fd7)",
              }}
            >
              <p style={{ marginTop: 0 }}>
                <strong>מצב סלקטור שמור:</strong> המחיר מגיע רק מהסלקטור הקיים בדומיין — אין רשימת
                מועמדים להחלפה.
              </p>
              <p className="text-muted" style={{ marginBottom: "0.75rem" }}>
                אם המחיר שגוי, סמנו למעלה &quot;טעות במחיר&quot; והריצו שוב, או לחצו כאן.
              </p>
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={() => {
                  setIgnoreSaved(true);
                  void runResolve(res.url, true);
                }}
              >
                גלה מחירים מחדש (מתעלם מסלקטור שמור)
              </button>
            </div>
          )}

          {hasCandidates && (
            <>
              <h3>מועמדים — בחרו סלקטור לשמירה</h3>
              <p className="text-muted" style={{ fontSize: "0.9rem" }}>
                לחיצה על &quot;בחר&quot; מסמנת את השורה לשמירה; המחיר שיישמר ייאומת בשרת לפי הסלקטור
                (לא רק לפי הטקסט במועמד).
              </p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>טקסט</th>
                      <th>ציון</th>
                      <th>סלקטור</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {res.candidates.map((c, i) => (
                      <tr key={`${c.selector}-${i}`}>
                        <td>{c.price_text}</td>
                        <td>{c.score.toFixed(1)}</td>
                        <td style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>{c.selector}</td>
                        <td>
                          <button
                            type="button"
                            className={pick?.selector === c.selector ? "btn sm" : "btn secondary sm"}
                            onClick={() => setPick(c)}
                          >
                            בחר
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!hasCandidates && !learnedOnly && (
            <p className="text-muted">לא נמצאו מועמדים — נסו כתובת אחרת או בדקו שהדף נטען.</p>
          )}

          {pick && (
            <div style={{ marginTop: "1rem" }}>
              <p>
                נבחר: <code>{pick.selector}</code> (טקסט במועמד: {pick.price_text})
              </p>
              <button type="button" className="btn" onClick={() => void onConfirm()} disabled={loading}>
                שמור סלקטור לדומיין
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
