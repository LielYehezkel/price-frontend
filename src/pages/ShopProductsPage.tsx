import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  apiAddCompetitor,
  apiBulkAddCompetitors,
  apiCheckCompetitor,
  apiCompetitorLabels,
  apiDownloadCompetitorsTemplate,
  apiImportCompetitorsExcel,
  apiListCompetitors,
  apiListTrackedCompetitors,
  apiProductCategories,
  apiReportCompetitorPriceIssue,
  apiListProducts,
  apiPatchProductAutoPricing,
  apiSnapshots,
  apiSyncShop,
  type CompetitorOut,
  type ProductCategoryRow,
  type ProductOut,
  type TrackedCompetitorRow,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

function currencySuffix(code: string | null | undefined): string {
  if (!code) return "";
  if (code === "ILS" || code === "₪") return " ₪";
  return ` ${code}`;
}

function parseDomainFromInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
    const h = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}

export function ShopProductsPage() {
  const { shopId } = useParams();
  const { token } = useAuth();
  const sid = Number(shopId);
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<ProductOut[]>([]);
  const [categories, setCategories] = useState<ProductCategoryRow[]>([]);
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<string>("__all__");
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(80);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selected, setSelected] = useState<ProductOut | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorOut[]>([]);
  const [labelSuggestions, setLabelSuggestions] = useState<string[]>([]);
  const [trackedCompetitors, setTrackedCompetitors] = useState<TrackedCompetitorRow[]>([]);
  const [url, setUrl] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [snapOpen, setSnapOpen] = useState<number | null>(null);
  const [snaps, setSnaps] = useState<{ id: number; price: number | null; fetched_at: string }[]>(
    [],
  );
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<number | null>(null);
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const [apEnabled, setApEnabled] = useState(false);
  const [apMin, setApMin] = useState("");
  const [apTrigKind, setApTrigKind] = useState<"percent" | "amount">("percent");
  const [apTrigVal, setApTrigVal] = useState("");
  const [apActKind, setApActKind] = useState<"percent" | "amount">("percent");
  const [apActVal, setApActVal] = useState("");
  const [apStrategy, setApStrategy] = useState<"reactive_down" | "smart_anchor">("reactive_down");
  const [apSaving, setApSaving] = useState(false);

  const domainPreview = useMemo(() => parseDomainFromInput(url), [url]);
  const matchedTracked = useMemo(() => {
    if (!domainPreview) return undefined;
    return trackedCompetitors.find((t) => t.domain === domainPreview);
  }, [domainPreview, trackedCompetitors]);

  async function loadProducts(nextSkip: number = skip): Promise<ProductOut[]> {
    if (!token || Number.isNaN(sid)) return [];
    const page = await apiListProducts(token, sid, {
      q: q || undefined,
      category: activeCategory,
      skip: nextSkip,
      limit,
    });
    setProducts(page.items);
    setTotalProducts(page.total);
    setSkip(page.skip);
    return page.items;
  }

  useEffect(() => {
    void loadProducts(0);
  }, [token, sid, q, activeCategory, limit]);

  useEffect(() => {
    if (!token || Number.isNaN(sid)) return;
    void apiCompetitorLabels(token, sid)
      .then((r) => setLabelSuggestions(r.labels))
      .catch(() => setLabelSuggestions([]));
    void apiListTrackedCompetitors(token, sid)
      .then((r) => setTrackedCompetitors(r))
      .catch(() => setTrackedCompetitors([]));
  }, [token, sid]);

  useEffect(() => {
    if (!token || Number.isNaN(sid)) return;
    void apiProductCategories(token, sid)
      .then((r) => {
        setCategories(r);
      })
      .catch(() => setCategories([]));
  }, [token, sid]);

  useEffect(() => {
    if (!selected) {
      setApEnabled(false);
      setApMin("");
      setApTrigKind("percent");
      setApTrigVal("");
      setApActKind("percent");
      setApActVal("");
      return;
    }
    setApEnabled(selected.auto_pricing_enabled);
    setApMin(selected.auto_pricing_min_price != null ? String(selected.auto_pricing_min_price) : "");
    setApTrigKind(selected.auto_pricing_trigger_kind === "amount" ? "amount" : "percent");
    setApTrigVal(
      selected.auto_pricing_trigger_value != null ? String(selected.auto_pricing_trigger_value) : "",
    );
    setApActKind(selected.auto_pricing_action_kind === "amount" ? "amount" : "percent");
    setApActVal(
      selected.auto_pricing_action_value != null ? String(selected.auto_pricing_action_value) : "",
    );
    setApStrategy(selected.auto_pricing_strategy === "smart_anchor" ? "smart_anchor" : "reactive_down");
  }, [selected?.id]);

  async function pickProduct(p: ProductOut) {
    setSelected(p);
    setErr(null);
    setMsg(null);
    if (!token) return;
    setCompetitors(await apiListCompetitors(token, sid, p.id));
  }

  async function onAddCompetitor(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected) return;
    setErr(null);
    if (!url.trim()) {
      setErr("נא להזין קישור למתחרה");
      return;
    }
    if (!matchedTracked && !competitorName.trim()) {
      setErr("דומיין חדש בחנות: יש למלא שם מתחרה (פעם אחת לכל אתר).");
      return;
    }
    try {
      const payload: Parameters<typeof apiAddCompetitor>[3] = { url: url.trim() };
      if (matchedTracked) {
        payload.tracked_competitor_id = matchedTracked.id;
      } else if (competitorName.trim()) {
        payload.competitor_name = competitorName.trim();
      }
      await apiAddCompetitor(token, sid, selected.id, payload);
      setUrl("");
      setCompetitorName("");
      setMsg("נוסף קישור מתחרה");
      setCompetitors(await apiListCompetitors(token, sid, selected.id));
      const list = await loadProducts();
      const upd = list.find((x) => x.id === selected.id);
      if (upd) setSelected(upd);
      const labs = await apiCompetitorLabels(token, sid);
      setLabelSuggestions(labs.labels);
      const tr = await apiListTrackedCompetitors(token, sid);
      setTrackedCompetitors(tr);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function onBulkSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected) return;
    setErr(null);
    try {
      const r = await apiBulkAddCompetitors(token, sid, selected.id, {
        urls_text: bulkText,
      });
      setMsg(`נוספו ${r.added} קישורים חדשים (${r.lines_processed} שורות)`);
      setBulkText("");
      setBulkOpen(false);
      setCompetitors(await apiListCompetitors(token, sid, selected.id));
      const list = await loadProducts();
      const upd = list.find((x) => x.id === selected.id);
      if (upd) setSelected(upd);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function onSync() {
    if (!token) return;
    setErr(null);
    try {
      await apiSyncShop(token, sid);
      const list = await loadProducts();
      setMsg("סנכרון הושלם");
      if (selected) {
        const upd = list.find((x) => x.id === selected.id);
        if (upd) setSelected(upd);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function onDownloadCompetitorsTemplate() {
    if (!token || Number.isNaN(sid)) return;
    setErr(null);
    try {
      const useCategory = templateCategory !== "all" ? templateCategory : null;
      const blob = await apiDownloadCompetitorsTemplate(token, sid, useCategory);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `competitors-import-template-${sid}${useCategory ? `-${useCategory}` : "-all"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(
        useCategory
          ? `תבנית קטגוריה "${useCategory}" ירדה בהצלחה כולל גיליון הוראות.`
          : "תבנית מלאה ירדה בהצלחה כולל גיליון הוראות.",
      );
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function onCompetitorsExcelSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !token || Number.isNaN(sid)) return;
    setErr(null);
    try {
      const r = await apiImportCompetitorsExcel(token, sid, file);
      setMsg(`ייבוא מתחרים: נוספו ${r.added}, עודכנו ${r.updated}, דולגו ${r.skipped}.`);
      if (r.errors.length) {
        setErr(`חלק מהשורות נדחו: ${r.errors.slice(0, 8).join(" · ")}`);
      }
      const list = await loadProducts();
      if (selected) {
        const upd = list.find((x) => x.id === selected.id);
        if (upd) {
          setSelected(upd);
          setCompetitors(await apiListCompetitors(token, sid, selected.id));
        }
      }
      const labs = await apiCompetitorLabels(token, sid);
      setLabelSuggestions(labs.labels);
      const tr = await apiListTrackedCompetitors(token, sid);
      setTrackedCompetitors(tr);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function onSaveAutoPricing(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected) return;
    setErr(null);
    setApSaving(true);
    try {
      if (!apEnabled) {
        const upd = await apiPatchProductAutoPricing(token, sid, selected.id, {
          auto_pricing_enabled: false,
          auto_pricing_strategy: apStrategy,
        });
        setSelected(upd);
        setMsg("תמחור אוטומטי כובה");
        await loadProducts();
        return;
      }
      const minV = parseFloat(apMin.replace(",", "."));
      const trigParsed = parseFloat(apTrigVal.replace(",", "."));
      const actV = parseFloat(apActVal.replace(",", "."));
      if (!Number.isFinite(minV) || minV <= 0) {
        setErr("מחיר מינימום חייב להיות מספר חיובי");
        return;
      }
      let trigSend = 0;
      if (apStrategy === "reactive_down") {
        if (!Number.isFinite(trigParsed) || trigParsed < 0) {
          setErr("ערך תנאי לא תקין");
          return;
        }
        trigSend = trigParsed;
      } else {
        trigSend = Number.isFinite(trigParsed) && trigParsed >= 0 ? trigParsed : 0;
      }
      if (!Number.isFinite(actV) || actV < 0) {
        setErr("ערך פעולה לא תקין");
        return;
      }
      const upd = await apiPatchProductAutoPricing(token, sid, selected.id, {
        auto_pricing_enabled: true,
        auto_pricing_min_price: minV,
        auto_pricing_trigger_kind: apTrigKind,
        auto_pricing_trigger_value: trigSend,
        auto_pricing_action_kind: apActKind,
        auto_pricing_action_value: actV,
        auto_pricing_strategy: apStrategy,
      });
      setSelected(upd);
      setMsg("הגדרות תמחור אוטומטי נשמרו");
      await loadProducts();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setApSaving(false);
    }
  }

  async function onCheck(c: CompetitorOut) {
    if (!token) return;
    await apiCheckCompetitor(token, sid, c.id);
    if (selected) {
      setCompetitors(await apiListCompetitors(token, sid, selected.id));
      const list = await loadProducts();
      const upd = list.find((x) => x.id === selected.id);
      if (upd) setSelected(upd);
    }
  }

  async function showSnaps(c: CompetitorOut) {
    if (!token) return;
    setSnapOpen(c.id);
    setSnaps(await apiSnapshots(token, sid, c.id));
  }

  async function submitPriceReport() {
    if (!token || reportFor == null) return;
    setErr(null);
    setReportBusy(true);
    try {
      await apiReportCompetitorPriceIssue(token, sid, reportFor, {
        note: reportNote.trim() || undefined,
      });
      setMsg("הדיווח נשלח לבדיקה. הצוות יוכל לעדכן את סלקטור המחיר לדומיין.");
      setReportFor(null);
      setReportNote("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בשליחה");
    } finally {
      setReportBusy(false);
    }
  }

  const cur = selected?.shop_currency;
  const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
  const currentPage = Math.floor(skip / limit) + 1;

  return (
    <>
      <p className="page-sub">
        בחרו מוצר — הדביקו קישור לעמוד מוצר אצל מתחרה. <strong>הדומיין</strong> מזהה את המתחרה:
        בפעם הראשונה לאתר חדש תתנו שם; בהמשך המערכת תזהה אוטומטית. תמחור אוטומטי תומך במצב
        &quot;חכם&quot; — מחיר עוגן מול השוק (עולה ויורד), או &quot;רק הורדה&quot; כמו בעבר.
      </p>
      {err && <p className="error">{err}</p>}
      {msg && <p className="text-muted">{msg}</p>}

      <div className="flex-between">
        <div className="flex-row">
          <button type="button" className="btn secondary sm" onClick={() => void onSync()}>
            סנכרון WooCommerce
          </button>
        </div>
      </div>

      <div className="card mt-2">
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>ייבוא מתחרים מ־Excel</h3>
        <p className="text-muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
          אפשר להוריד תבנית לכל החנות או לקטגוריה אחת, למלא רק את עמודות המתחרים, ולהעלות חזרה.
          שורות בלי קישור מתחרה יידלגו.
        </p>
        <div className="products-template-toolbar">
          <label className="field" style={{ margin: 0 }}>
            <span>קטגוריה לתבנית</span>
            <select
              className="input"
              value={templateCategory}
              onChange={(e) => setTemplateCategory(e.target.value)}
              style={{ minWidth: 250 }}
            >
              <option value="all">כל הקטגוריות</option>
              {categories?.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </label>
          <div className="products-template-help">
            <strong>איך ממלאים נכון:</strong> לא משנים `product_id`; ממלאים `competitor_url`; `competitor_label`
            אופציונלי; אפשר כמה שורות לאותו מוצר; מעלים בחזרה.
          </div>
        </div>
        <div className="flex-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn secondary sm"
            onClick={() => void onDownloadCompetitorsTemplate()}
          >
            הורדת תבנית Excel
          </button>
          <label className="btn sm secondary" style={{ cursor: "pointer", margin: 0 }}>
            העלאת קובץ מולא
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: "none" }}
              onChange={(e) => {
                void onCompetitorsExcelSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <datalist id="competitor-name-list">
        {labelSuggestions?.map((lab) => (
          <option key={lab} value={lab} />
        ))}
      </datalist>

      <div className="products-split mt-2">
        <div className="card">
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>מוצרים</h3>
          <div className="products-header-controls">
            <label className="field" style={{ margin: 0 }}>
              <span>קטגוריה</span>
              <select
                className="input"
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
              >
                <option value="__all__">כל הקטגוריות</option>
                <option value="__uncategorized__">ללא קטגוריה</option>
                {categories?.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>חיפוש מוצר</span>
              <input
                className="input"
                placeholder="שם / SKU…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>
          <div className="products-toolbar-row">
            <span className="text-muted">
              מציגים {products.length} מתוך {totalProducts} מוצרים
              {activeCategory !== "__all__" && ` · קטגוריה: ${activeCategory === "__uncategorized__" ? "ללא קטגוריה" : activeCategory}`}
            </span>
            <div className="flex-row" style={{ gap: "0.5rem" }}>
              <label className="text-muted" style={{ fontSize: "0.85rem" }}>
                לעמוד:
              </label>
              <select
                className="input"
                style={{ width: 90, padding: "0.35rem 0.5rem" }}
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value) || 80)}
              >
                <option value="40">40</option>
                <option value="80">80</option>
                <option value="120">120</option>
                <option value="200">200</option>
              </select>
            </div>
          </div>
          <div className="table-wrap products-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }} />
                  <th>מוצר</th>
                  <th>קטגוריה</th>
                  <th>מחיר</th>
                  <th>מעקב</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => void pickProduct(p)}
                    style={{
                      cursor: "pointer",
                      outline: selected?.id === p.id ? "2px solid var(--accent)" : undefined,
                      outlineOffset: "-2px",
                    }}
                  >
                    <td>
                      {p.image_url ? (
                        <img className="product-thumb" src={p.image_url} alt="" loading="lazy" />
                      ) : (
                        <div className="product-thumb product-thumb--placeholder" aria-hidden />
                      )}
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                      {p.sku && (
                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                          SKU: {p.sku}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="text-muted">{p.category_name || "—"}</span>
                    </td>
                    <td>
                      {p.regular_price != null ? p.regular_price.toFixed(2) : "—"}
                      {currencySuffix(p.shop_currency)}
                    </td>
                    <td>
                      {p.competitors_count > 0 ? (
                        <span className="badge success">{p.competitors_count} מתחרים</span>
                      ) : (
                        <span className="badge neutral">ללא מעקב</span>
                      )}
                      {p.auto_pricing_enabled && (
                        <span className="badge warn" style={{ marginInlineStart: "0.25rem" }}>
                          אוטו
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="products-pager">
            <button
              type="button"
              className="btn secondary sm"
              disabled={skip <= 0}
              onClick={() => void loadProducts(Math.max(0, skip - limit))}
            >
              הקודם
            </button>
            <span className="text-muted">עמוד {currentPage} / {totalPages}</span>
            <button
              type="button"
              className="btn secondary sm"
              disabled={skip + limit >= totalProducts}
              onClick={() => void loadProducts(skip + limit)}
            >
              הבא
            </button>
          </div>
          {products.length === 0 && (
            <p className="text-muted">אין מוצרים — הריצו סנכרון מ־WooCommerce.</p>
          )}
        </div>

        <div className="card panel-sticky">
          {!selected && (
            <p className="text-muted">בחרו מוצר משמאל כדי להוסיף או לנהל מתחרים.</p>
          )}
          {selected && (
            <>
              <div className="flex-between" style={{ marginBottom: "1rem" }}>
                <div className="flex-row" style={{ gap: "0.75rem", alignItems: "center" }}>
                  {selected.image_url ? (
                    <img
                      className="product-thumb product-thumb--lg"
                      src={selected.image_url}
                      alt=""
                    />
                  ) : (
                    <div className="product-thumb product-thumb--lg product-thumb--placeholder" />
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{selected.name}</h3>
                    <p className="text-muted" style={{ margin: "0.25rem 0 0" }}>
                      המחיר בחנות:{" "}
                      <strong>
                        {selected.regular_price != null ? selected.regular_price.toFixed(2) : "—"}
                        {currencySuffix(selected.shop_currency)}
                      </strong>
                    </p>
                  </div>
                </div>
                <button type="button" className="btn sm" onClick={() => setBulkOpen(true)}>
                  הוספה מרוכזת
                </button>
              </div>

              <form onSubmit={onAddCompetitor} className="competitor-add-form" style={{ marginBottom: "1.25rem" }}>
                <div className="field" style={{ marginBottom: "0.5rem" }}>
                  <label>קישור לעמוד המוצר אצל המתחרה</label>
                  <input
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    autoFocus
                    dir="ltr"
                  />
                  {domainPreview && (
                    <p className="domain-hint" dir="ltr">
                      <span className="domain-hint__label">דומיין:</span>{" "}
                      <code className="domain-hint__code">{domainPreview}</code>
                      {matchedTracked ? (
                        <span className="domain-hint__badge domain-hint__badge--ok">
                          מזוהה: {matchedTracked.display_name}
                        </span>
                      ) : (
                        <span className="domain-hint__badge domain-hint__badge--new">דומיין חדש בחנות</span>
                      )}
                    </p>
                  )}
                </div>
                {!matchedTracked && (
                  <div className="field" style={{ marginBottom: "0.5rem" }}>
                    <label>שם המתחרה (נרשם פעם אחת לדומיין)</label>
                    <input
                      placeholder="למשל: רשת כלבו — יוצג בכל המוצרים מאותו אתר"
                      value={competitorName}
                      onChange={(e) => setCompetitorName(e.target.value)}
                      list="competitor-name-list"
                      autoComplete="off"
                    />
                  </div>
                )}
                <button className="btn" type="submit" disabled={!url.trim()}>
                  הוסף קישור מעקב
                </button>
              </form>

              <div
                className="card"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  marginBottom: "1.25rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>תמחור אוטומטי מול מתחרים</h4>
                <p className="text-muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
                  מחושבים מול המחיר הנמוך מבין כל קישורי המתחרים בדומיינים פעילים.{" "}
                  <strong>חכם (עוגן)</strong> — המחיר שלכם נשאר עם הפרש קבוע מהשוק (עולה כשהשוק עולה).
                  <strong> רק הורדה</strong> — מעדכן בעיקר כשצריך להזיל. לא מתחת למינימום שקבעתם.
                </p>
                <form onSubmit={(e) => void onSaveAutoPricing(e)}>
                  <label className="flex-row" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <input
                      type="checkbox"
                      checked={apEnabled}
                      onChange={(e) => setApEnabled(e.target.checked)}
                    />
                    <span>הפעלת תמחור אוטומטי למוצר זה</span>
                  </label>
                  {apEnabled && (
                    <>
                      <div className="field">
                        <label>אסטרטגיה</label>
                        <select
                          value={apStrategy}
                          onChange={(e) =>
                            setApStrategy(e.target.value === "smart_anchor" ? "smart_anchor" : "reactive_down")
                          }
                          style={{ maxWidth: "100%" }}
                        >
                          <option value="smart_anchor">
                            חכם — עוגן מול מחיר השוק (עלייה וירידה לפי הכלל)
                          </option>
                          <option value="reactive_down">
                            רק הורדה — כשהמתחרה זול משמעותית (מצב קלאסי)
                          </option>
                        </select>
                        <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                          {apStrategy === "smart_anchor"
                            ? "מתאים כשהמטרה לשמור על מרווח מהמחיר הנמוך בשוק, גם כשהמחירים עולים."
                            : "מתאים כשמעדכנים רק כדי לא להפסיד מול מתחרה זול — בלי להעלות מחיר כשהשוק עולה."}
                        </span>
                      </div>
                      <div className="field">
                        <label>מחיר מינימום (מוכנים למכור ב־{cur || "מטבע החנות"})</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={apMin}
                          onChange={(e) => setApMin(e.target.value)}
                          required
                          style={{ maxWidth: 200 }}
                        />
                      </div>
                      <div className="field">
                        <label>
                          תנאי (רלוונטי ל־&quot;רק הורדה&quot;): המתחרה זול ממני ב־
                        </label>
                        <div className="flex-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                          <select
                            value={apTrigKind}
                            onChange={(e) =>
                              setApTrigKind(e.target.value === "amount" ? "amount" : "percent")
                            }
                            style={{ maxWidth: 140 }}
                            disabled={apStrategy === "smart_anchor"}
                          >
                            <option value="percent">אחוזים ממחירי</option>
                            <option value="amount">סכום ב־{cur || "מטבע"}</option>
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={apTrigKind === "percent" ? "למשל 5" : "למשל 10"}
                            value={apTrigVal}
                            onChange={(e) => setApTrigVal(e.target.value)}
                            style={{ maxWidth: 120 }}
                            required={apStrategy === "reactive_down"}
                            disabled={apStrategy === "smart_anchor"}
                          />
                        </div>
                        <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                          {apStrategy === "smart_anchor"
                            ? "במצב חכם התנאי לא משמש — העדכון לפי עוגן מול המחיר הנמוך בשוק."
                            : apTrigKind === "percent"
                              ? "הפרש בין המחיר שלכם למחיר המתחרה הנמוך, כאחוז מהמחיר שלכם."
                              : "הפרש מינימלי במטבע בין המחיר שלכם למחיר המתחרה הנמוך."}
                        </span>
                      </div>
                      <div className="field">
                        <label>פעולה: קבעו מחיר חדש ביחס למחיר המתחרה הנמוך — </label>
                        <div className="flex-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                          <select
                            value={apActKind}
                            onChange={(e) =>
                              setApActKind(e.target.value === "amount" ? "amount" : "percent")
                            }
                            style={{ maxWidth: 200 }}
                          >
                            <option value="percent">נמוך ב־X% ממחיר המתחרה</option>
                            <option value="amount">נמוך ב־X ממחיר המתחרה</option>
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={apActKind === "percent" ? "למשל 2" : "למשל 5"}
                            value={apActVal}
                            onChange={(e) => setApActVal(e.target.value)}
                            style={{ maxWidth: 120 }}
                            required
                          />
                        </div>
                        <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                          {apActKind === "percent"
                            ? "המחיר החדש = מחיר המתחרה × (1 − X/100)."
                            : "המחיר החדש = מחיר המתחרה − X."}
                        </span>
                      </div>
                    </>
                  )}
                  <button type="submit" className="btn secondary sm" disabled={apSaving}>
                    {apSaving ? "שומר…" : "שמור הגדרות תמחור"}
                  </button>
                </form>
              </div>

              <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>מתחרים במעקב</h4>
              <div className="table-wrap">
                <table className="data-table competitors-table">
                  <thead>
                    <tr>
                      <th>דומיין / קישור</th>
                      <th>מחיר אחרון</th>
                      <th className="cell-actions">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitors?.map((c) => {
                      const dom = c.domain ||
                        (() => {
                          try {
                            return new URL(c.url).hostname.replace(/^www\./, "");
                          } catch {
                            return c.url.slice(0, 32);
                          }
                        })();
                      return (
                        <tr key={c.id}>
                          <td className="cell-competitor-link">
                            <div style={{ fontWeight: 700 }}>{c.display_name || c.label}</div>
                            <div className="text-muted" style={{ fontSize: "0.82rem" }}>
                              {dom}
                            </div>
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              {c.url}
                            </div>
                          </td>
                          <td className="cell-price">
                            <div className="cell-price-stack">
                              <div>
                                {c.price_status === "processing" ? (
                                  <span className="badge neutral">בעיבוד</span>
                                ) : c.last_price != null ? (
                                  <>
                                    {c.last_price.toFixed(2)}
                                    {currencySuffix(cur)}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </div>
                              <button
                                type="button"
                                className="btn ghost sm"
                                style={{
                                  padding: "0.15rem 0",
                                  fontSize: "0.78rem",
                                  height: "auto",
                                }}
                                onClick={() => {
                                  setReportFor(c.id);
                                  setReportNote("");
                                }}
                              >
                                מחיר שגוי או חשד לבעיה? שלחו לבדיקה
                              </button>
                            </div>
                          </td>
                          <td className="cell-actions">
                            <div className="cell-actions-stack">
                              <button
                                type="button"
                                className="btn secondary sm"
                                onClick={() => void onCheck(c)}
                              >
                                סריקה עכשיו
                              </button>
                              <button
                                type="button"
                                className="btn ghost sm"
                                disabled={c.price_status === "processing"}
                                title={
                                  c.price_status === "processing"
                                    ? "היסטוריית מחיר תהיה זמינה לאחר אישור הדומיין בפאנל הניהול"
                                    : undefined
                                }
                                onClick={() => void showSnaps(c)}
                              >
                                היסטוריה
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {competitors.length === 0 && (
                <p className="text-muted">עדיין אין מתחרים — הוסיפו קישור או שימוש בהוספה מרוכזת.</p>
              )}
            </>
          )}
        </div>
      </div>

      {reportFor != null && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!reportBusy) setReportFor(null);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>שליחה לבדיקת מחיר</h2>
            <p className="text-muted" style={{ marginTop: 0 }}>
              אם המחיר שמוצג לא נכון או שנראה חשוד, נשלח את הקישור והדף לצוות לבדיקת סלקטור המחיר בפאנל
              הניהול. אפשר להוסיף הערה קצרה.
            </p>
            <div className="field">
              <label>הערה (אופציונלי)</label>
              <textarea
                className="code-area"
                style={{ minHeight: 72 }}
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="למשל: מוצג מחיר הורדה במקום מחיר רגיל"
              />
            </div>
            <div className="flex-row" style={{ justifyContent: "flex-end", marginTop: "1rem", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn secondary"
                disabled={reportBusy}
                onClick={() => setReportFor(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn"
                disabled={reportBusy}
                onClick={() => void submitPriceReport()}
              >
                {reportBusy ? "שולח…" : "שלח לבדיקה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && selected && (
        <div className="modal-backdrop" onClick={() => setBulkOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>הוספה מרוכזת — {selected.name}</h2>
            <p className="text-muted" style={{ marginTop: 0 }}>
              הדביקו שורה לכל כתובת (מלא או חלקי). שורות ריקות יתעלמו. כפילויות לא יתווספו.
            </p>
            <form onSubmit={onBulkSubmit}>
              <textarea
                className="code-area"
                placeholder={
                  "https://competitor.com/product/a\nhttps://other.co.il/p/b\nshop.example/מוצר"
                }
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <div className="flex-row" style={{ justifyContent: "flex-end", marginTop: "1rem" }}>
                <button type="button" className="btn secondary" onClick={() => setBulkOpen(false)}>
                  ביטול
                </button>
                <button type="submit" className="btn">
                  הוסף הכל
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {snapOpen != null && (
        <div className="modal-backdrop" onClick={() => setSnapOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>צילומי מחיר</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>זמן</th>
                    <th>מחיר</th>
                  </tr>
                </thead>
                <tbody>
                  {snaps?.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.fetched_at).toLocaleString()}</td>
                      <td>{s.price ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn secondary mt-2" onClick={() => setSnapOpen(null)}>
              סגור
            </button>
          </div>
        </div>
      )}
    </>
  );
}
