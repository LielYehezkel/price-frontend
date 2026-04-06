import { useEffect, useState } from "react";
import {
  apiAdminApproveDomain,
  apiAdminDomainReviews,
  apiAdminRescanDomainCandidates,
  type DomainReviewRow,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

/** תואם ללוגיקת parse בשרת — להצגת מחירים ולקיבוץ */
function parsePriceFromText(raw: string | undefined): number | null {
  if (!raw) return null;
  let t = raw.trim().replace(/[^\d.,]/g, "");
  if (!t) return null;
  t = t.replace(",", ".");
  const parts = t.split(".");
  if (parts.length > 2) {
    t = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n <= 0 || n >= 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

function groupCandidatesByPrice(
  candidates: DomainReviewRow["candidates"],
): { value: number; primarySelector: string; alternates: string[] }[] {
  const map = new Map<number, string[]>();
  const order: number[] = [];
  for (const c of candidates) {
    const v = parsePriceFromText(c.price_text);
    if (v == null || !c.selector?.trim()) continue;
    if (!map.has(v)) {
      order.push(v);
      map.set(v, []);
    }
    const arr = map.get(v)!;
    if (!arr.includes(c.selector)) arr.push(c.selector);
  }
  order.sort((a, b) => a - b);
  return order.map((value) => {
    const sels = map.get(value)!;
    return {
      value,
      primarySelector: sels[0],
      alternates: sels.slice(1),
    };
  });
}

type PriceGroup = { value: number; primarySelector: string; alternates: string[] };

function groupContainingSelector(groups: PriceGroup[], sel: string): PriceGroup | undefined {
  const s = sel.trim();
  if (!s) return undefined;
  return groups.find((g) => g.primarySelector === s || g.alternates.includes(s));
}

/** רק סלקטורים מאותה קבוצת מחיר — כדי שלא ייבחר fallback עם מחיר שונה בשרת */
function selectorsForApprove(
  r: DomainReviewRow,
  chosenSelector: string,
  priceGroups: PriceGroup[],
  manualAltLines?: string[],
): { primary: string; alternates: string[] } {
  const s = chosenSelector.trim();
  if (!s) return { primary: "", alternates: [] };
  const g = groupContainingSelector(priceGroups, s);
  if (g) {
    const all = [g.primarySelector, ...g.alternates];
    const rest = all.filter((x) => x !== s);
    return { primary: s, alternates: rest };
  }
  const fromManual = (manualAltLines ?? []).map((x) => x.trim()).filter(Boolean);
  if (fromManual.length) {
    return { primary: s, alternates: fromManual };
  }
  const fallback = otherSelectors(r, s);
  fallback.sort((a, b) => a.localeCompare(b));
  return { primary: s, alternates: fallback };
}

function formatPriceLabel(value: number, currency: string | null | undefined): string {
  const cur = (currency || "").trim();
  if (cur === "ILS" || cur === "₪") return `${value.toFixed(2)} ₪`;
  if (cur) return `${value.toFixed(2)} ${cur}`;
  return value.toFixed(2);
}

function systemSuggestedSelector(r: DomainReviewRow): string {
  return (r.suggested_selector || r.candidates[0]?.selector || "").trim();
}

/** כל שאר הסלקטורים מהמועמדים — לשימוש כ־fallback באימות */
function otherSelectors(r: DomainReviewRow, primary: string, limit = 15): string[] {
  const p = primary.trim();
  const seen = new Set<string>([p]);
  const out: string[] = [];
  for (const c of r.candidates) {
    const s = (c.selector || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function reviewKey(r: DomainReviewRow): string {
  return r.queue_item_id != null ? `q-${r.queue_item_id}` : `legacy-${r.domain}`;
}

function sourceLabel(source: string): string {
  if (source === "user_report") return "דיווח לקוח";
  if (source === "scan") return "סריקה";
  if (source === "rescan_admin") return "סריקה מחדש (ניהול)";
  return source;
}

export function AdminDomainsPage() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<DomainReviewRow[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { selector: string; alts: string }>
  >({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [rescanningKey, setRescanningKey] = useState<string | null>(null);

  async function loadReviews() {
    if (!token) return;
    const list = await apiAdminDomainReviews(token, "pending");
    setReviews(list);
    setReviewDrafts((prev) => {
      const next = { ...prev };
      for (const r of list) {
        const k = reviewKey(r);
        if (!next[k]) {
          const sug = systemSuggestedSelector(r);
          next[k] = {
            selector: sug,
            alts: "",
          };
        }
      }
      return next;
    });
  }

  useEffect(() => {
    void loadReviews().catch((e) => setErr(e instanceof Error ? e.message : "שגיאה"));
  }, [token]);

  async function rescanRow(r: DomainReviewRow) {
    if (!token) return;
    const rk = reviewKey(r);
    setErr(null);
    setMsg(null);
    setRescanningKey(rk);
    try {
      const out = await apiAdminRescanDomainCandidates(token, {
        queue_item_id: r.queue_item_id ?? undefined,
        domain: r.queue_item_id == null ? r.domain : undefined,
      });
      setMsg(
        `סריקה מחדש הושלמה: ${out.candidates_count} מועמדים${out.pending_price != null ? `, מחיר מוצע ${out.pending_price}` : ""} (${out.rows_updated} שורות).`,
      );
      await loadReviews();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setRescanningKey(null);
    }
  }

  async function submitApprove(
    r: DomainReviewRow,
    priceGroups: PriceGroup[],
    cssSelector: string,
    manualAltLines?: string[],
  ) {
    if (!token) return;
    const { primary, alternates } = selectorsForApprove(r, cssSelector, priceGroups, manualAltLines);
    const sel = primary.trim();
    if (!sel) {
      setErr("לא נמצא סלקטור — בחרו מחיר מהרשימה או הזינו ידנית.");
      return;
    }
    setErr(null);
    setMsg(null);
    setSubmittingKey(reviewKey(r));
    try {
      const out = await apiAdminApproveDomain(token, {
        domain: r.domain,
        css_selector: sel,
        selector_alternates: alternates.length ? alternates : undefined,
        queue_item_id: r.queue_item_id ?? undefined,
      });
      let successMsg = `דומיין ${out.domain} אושר. אומת מחיר ${out.validated_price}. סריקות חוזרות: ${out.re_scanned}.`;
      if (out.re_scan_errors?.length) {
        successMsg += ` (אזהרות סריקה: ${out.re_scan_errors.join("; ")})`;
      }
      setMsg(successMsg);
      await loadReviews();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setSubmittingKey(null);
    }
  }

  function pickPrice(rowKey: string, primarySelector: string, alternates: string[]) {
    setReviewDrafts((prev) => ({
      ...prev,
      [rowKey]: {
        selector: primarySelector,
        alts: alternates.join("\n"),
      },
    }));
  }

  function applySystemRecommendation(r: DomainReviewRow, priceGroups: PriceGroup[], sysSel: string) {
    const sysGroup = groupContainingSelector(priceGroups, sysSel);
    const alts = sysGroup
      ? [sysGroup.primarySelector, ...sysGroup.alternates].filter((x) => x !== sysSel)
      : otherSelectors(r, sysSel).sort((a, b) => a.localeCompare(b));
    pickPrice(reviewKey(r), sysSel, alts);
  }

  return (
    <div className="content-area" style={{ maxWidth: 1200 }}>
      <h1 style={{ marginTop: 0 }}>בדיקת דומיינים חדשים</h1>
      <p className="text-muted" style={{ marginTop: 0 }}>
        דומיין שלא אושר עדיין מוצג ללקוחות כ־<strong>בעיבוד</strong>. לכל קישור מתחרה נוצרת שורה נפרדת
        בתור (גם כמה מאות לאותו דומיין). אשרו סלקטור אחד לדומיין — כל הפריטים לדומיין ייסגרו וייסרקו מחדש.
      </p>

      {err && <p className="error">{err}</p>}
      {msg && <p>{msg}</p>}

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>ממתינים לאישור</h2>
          <button type="button" className="btn secondary sm" onClick={() => void loadReviews()}>
            רענן רשימה
          </button>
        </div>
        {reviews.length === 0 ? (
          <p className="text-muted" style={{ marginBottom: 0, marginTop: "1rem" }}>
            אין דומיינים ממתינים לאישור.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>דומיין / מקור</th>
                  <th>דף דוגמה</th>
                  <th style={{ minWidth: 260 }}>בחירת מחיר</th>
                  <th style={{ minWidth: 200 }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => {
                  const rk = reviewKey(r);
                  const draft = reviewDrafts[rk] ?? {
                    selector: systemSuggestedSelector(r),
                    alts: "",
                  };
                  const priceGroups = groupCandidatesByPrice(r.candidates);
                  const sysSel = systemSuggestedSelector(r);
                  const sysGroup = sysSel ? groupContainingSelector(priceGroups, sysSel) : undefined;
                  const sysPrice =
                    sysGroup?.value ??
                    (r.pending_price != null && Number.isFinite(r.pending_price)
                      ? r.pending_price
                      : parsePriceFromText(r.candidates[0]?.price_text));
                  const canAuto = Boolean(sysSel) && sysPrice != null && Number.isFinite(sysPrice);
                  const selectedGroup = groupContainingSelector(priceGroups, draft.selector);
                  const busy = submittingKey === rk;
                  const rescanBusy = rescanningKey === rk;

                  return (
                    <tr key={rk} style={{ verticalAlign: "top" }}>
                      <td>
                        <code>{r.domain}</code>
                        <div style={{ marginTop: "0.35rem" }}>
                          <span className="badge neutral">{sourceLabel(r.source)}</span>
                          {r.shop_id != null && (
                            <span className="text-muted" style={{ fontSize: "0.75rem", marginInlineStart: "0.35rem" }}>
                              חנות #{r.shop_id}
                            </span>
                          )}
                        </div>
                        {r.product_name && (
                          <div className="text-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                            מוצר: {r.product_name}
                          </div>
                        )}
                        {r.reporter_note && (
                          <div style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                            <strong>הערת לקוח:</strong> {r.reporter_note}
                          </div>
                        )}
                        <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                          עודכן: {new Date(r.updated_at).toLocaleString()}
                          {r.queue_item_id != null && <> · מזהה #{r.queue_item_id}</>}
                        </div>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        {r.sample_url ? (
                          <a href={r.sample_url} target="_blank" rel="noreferrer">
                            פתח דף
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {canAuto && (
                          <div style={{ marginBottom: "0.75rem" }}>
                            <div className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                              המלצת המערכת ({formatPriceLabel(sysPrice, r.pending_currency)})
                            </div>
                            <div className="flex-row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
                              <button
                                type="button"
                                className="btn secondary sm"
                                disabled={busy}
                                onClick={() => applySystemRecommendation(r, priceGroups, sysSel)}
                              >
                                החל המלצה על הבחירה
                              </button>
                              <button
                                type="button"
                                className="btn sm"
                                style={{ fontWeight: 600 }}
                                disabled={busy}
                                onClick={() => void submitApprove(r, priceGroups, sysSel, undefined)}
                              >
                                אשר מיד
                              </button>
                            </div>
                            <p className="text-muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
                              &quot;החל המלצה&quot; מעדכן את כפתור האישור בצד; &quot;אשר מיד&quot; שולח בלי לשנות
                              את הבחירה קודם.
                            </p>
                          </div>
                        )}

                        {priceGroups.length > 0 && (
                          <div>
                            <div className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                              מחירים שזוהו בדף — בחרו אחד
                            </div>
                            <div className="flex-row" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
                              {priceGroups.map((g) => {
                                const selected =
                                  draft.selector === g.primarySelector ||
                                  g.alternates.some((a) => a === draft.selector);
                                return (
                                  <button
                                    key={`${rk}-${g.value}`}
                                    type="button"
                                    className={selected ? "btn sm" : "btn secondary sm"}
                                    style={{
                                      minWidth: "4.5rem",
                                      borderWidth: selected ? 2 : undefined,
                                      borderColor: selected ? "var(--accent)" : undefined,
                                    }}
                                    title="לחיצה בוחרת את הסלקטור המשויך למחיר זה"
                                    onClick={() => pickPrice(rk, g.primarySelector, g.alternates)}
                                  >
                                    {formatPriceLabel(g.value, r.pending_currency)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {priceGroups.length === 0 && !canAuto && (
                          <p className="text-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                            לא נמצאו מועמדי מחיר — השתמשו בהזנה ידנית למטה.
                          </p>
                        )}

                        <div style={{ marginTop: "0.65rem" }}>
                          <button
                            type="button"
                            className="btn secondary sm"
                            disabled={busy || rescanBusy}
                            onClick={() => void rescanRow(r)}
                          >
                            {rescanBusy ? "סורק…" : "סריקה מחדש למועמדים"}
                          </button>
                          <p className="text-muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
                            שולף שוב את דף המתחרה ומחפש סלקטורים ומחירים פוטנציאליים (לא משנה אישור דומיין).
                          </p>
                        </div>

                        <details
                          style={{ marginTop: "0.75rem" }}
                          open={manualOpen[rk] ?? false}
                          onToggle={(e) =>
                            setManualOpen((prev) => ({
                              ...prev,
                              [rk]: (e.target as HTMLDetailsElement).open,
                            }))
                          }
                        >
                          <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>
                            הזנת סלקטור ידנית (מתקדם)
                          </summary>
                          <div className="field" style={{ marginTop: "0.5rem" }}>
                            <label style={{ fontSize: "0.8rem" }}>סלקטור CSS ראשי</label>
                            <input
                              className="input"
                              style={{ width: "100%", maxWidth: 420 }}
                              value={draft.selector}
                              onChange={(e) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [rk]: { ...draft, selector: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="field" style={{ marginTop: "0.35rem" }}>
                            <label style={{ fontSize: "0.8rem" }}>סלקטורי גיבוי (שורה לכל אחד)</label>
                            <textarea
                              className="code-area"
                              style={{ minHeight: 48, fontSize: "0.8rem", width: "100%", maxWidth: 420 }}
                              value={draft.alts}
                              onChange={(e) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [rk]: { ...draft, alts: e.target.value },
                                }))
                              }
                            />
                          </div>
                        </details>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy || !draft.selector.trim()}
                          onClick={() =>
                            void submitApprove(
                              r,
                              priceGroups,
                              draft.selector,
                              draft.alts.split("\n").map((x) => x.trim()),
                            )
                          }
                        >
                          {selectedGroup
                            ? `אשר ${formatPriceLabel(selectedGroup.value, r.pending_currency)} והפעל מחירים`
                            : "אשר והפעל מחירים (ייאומת בשרת)"}
                        </button>
                        <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem", marginBottom: 0 }}>
                          הבחירה הנוכחית:{" "}
                          <strong>
                            {selectedGroup
                              ? formatPriceLabel(selectedGroup.value, r.pending_currency)
                              : draft.selector.trim() || "לא נבחר"}
                          </strong>
                          . גיבויים נשלחים רק מאותה קבוצת מחיר כדי למנוע מחיר שגוי.
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
