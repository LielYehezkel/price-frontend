import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  apiDownloadWpPluginZip,
  apiGetShop,
  apiShopifyConfig,
  apiSyncShop,
  type ShopOut,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

const STEPS_WP = ["כתובת האתר", "הורדת התוסף", "התקנה בוורדפרס", "סנכרון מוצרים"];

const STEPS_SHOPIFY = ["פרטי Custom App", "סנכרון מוצרים"];

export function ShopSetupPage() {
  const { shopId } = useParams();
  const { token } = useAuth();
  const sid = Number(shopId);
  const [step, setStep] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [apiBaseForPlugin, setApiBaseForPlugin] = useState("");
  const [shop, setShop] = useState<ShopOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [shDomain, setShDomain] = useState("");
  const [shToken, setShToken] = useState("");
  const [shClientSecret, setShClientSecret] = useState("");
  const [shApiVer, setShApiVer] = useState("");
  const [shSaving, setShSaving] = useState(false);
  const [lastWebhookHint, setLastWebhookHint] = useState<string | null>(null);

  async function refreshShop() {
    if (!token || Number.isNaN(sid)) return;
    try {
      setShop(await apiGetShop(token, sid));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    }
  }

  useEffect(() => {
    void refreshShop();
  }, [token, sid]);

  async function onDownloadPlugin() {
    if (!token || Number.isNaN(sid)) return;
    setErr(null);
    try {
      const apiBase = apiBaseForPlugin.trim();
      const blob = await apiDownloadWpPluginZip(token, sid, {
        apiBase: apiBase ? apiBase : null,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `price-resolver-connect-shop-${sid}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("הקובץ הורד — המשיכו לשלב ההתקנה.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    }
  }

  async function onSync(e?: FormEvent) {
    e?.preventDefault();
    if (!token || Number.isNaN(sid)) return;
    setErr(null);
    setSyncing(true);
    try {
      await apiSyncShop(token, sid);
      setMsg("סנכרון הושלם בהצלחה.");
      await refreshShop();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setSyncing(false);
    }
  }

  async function onSaveShopify(e: FormEvent) {
    e.preventDefault();
    if (!token || Number.isNaN(sid)) return;
    setErr(null);
    setShSaving(true);
    setLastWebhookHint(null);
    try {
      const r = await apiShopifyConfig(token, sid, {
        shop_domain: shDomain.trim(),
        admin_access_token: shToken.trim(),
        api_version: shApiVer.trim() || null,
        client_secret: shClientSecret.trim() || null,
      });
      setMsg(
        r.woo_currency
          ? `Shopify נשמר — מטבע החנות: ${r.woo_currency}`
          : "Shopify נשמר — אימות הצליח.",
      );
      const path = r.shopify_orders_webhook_path || "";
      const hookMsg = path
        ? `Webhook הזמנות (אחרי הוספת Client secret): POST ${path} — אימות HMAC עם ה-API secret של האפליקציה ב-Shopify.`
        : "";
      setLastWebhookHint(hookMsg || null);
      if (r.shopify_webhook_secret) {
        setLastWebhookHint(
          (hookMsg ? `${hookMsg}\n` : "") +
            `מפתח פנימי (אופציונלי): ${r.shopify_webhook_secret.slice(0, 8)}…`,
        );
      }
      await refreshShop();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setShSaving(false);
    }
  }

  const base = `/app/${sid}`;
  const plat = shop?.store_platform === "shopify" ? "shopify" : "wordpress";

  if (plat === "shopify") {
    return (
      <>
        <p className="page-sub">
          חיבור Shopify באמצעות <strong>Custom App</strong> — הדביקו דומיין myshopify.com וטוקן Admin API.
          למוצרים עם כמה וריאנטים: בשלב זה נבחר הווריאנט הראשון לכל מוצר (MVP).
        </p>
        {err && <p className="error">{err}</p>}
        {msg && <p className="text-muted">{msg}</p>}
        {lastWebhookHint && (
          <p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>
            {lastWebhookHint}
          </p>
        )}

        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="flex-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            {STEPS_SHOPIFY.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`btn sm ${step === i ? "" : "secondary"}`}
                onClick={() => setStep(i)}
              >
                {i + 1}. {label}
              </button>
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>שלב 1 — Custom App ב-Shopify Admin</h2>
            <ol style={{ lineHeight: 1.7 }}>
              <li>הגדרות → אפליקציות וערוצי מכירות → אפליקציות שפיתחת → צרו אפליקציה מותאמת אישית.</li>
              <li>
                הרשאות Admin API מינימליות: <code>read_products</code>, <code>write_products</code>,{" "}
                <code>read_inventory</code>, <code>write_inventory</code>, <code>read_locations</code>,{" "}
                <code>read_orders</code> (לדוחות; לעיתים נדרש <code>read_all_orders</code> — דורש אישור מסחרי
                ב-Shopify).
              </li>
              <li>התקינו את האפליקציה בחנות והעתיקו את <strong>Admin API access token</strong>.</li>
              <li>
                להתראות מכירה ב-WhatsApp: העתיקו גם את <strong>Client secret</strong> של האפליקציה (API secret) —
                ישמש לאימות חתימת webhook של הזמנות.
              </li>
            </ol>
            <form onSubmit={(e) => void onSaveShopify(e)}>
              <div className="field">
                <label>דומיין חנות (למשל my-store.myshopify.com)</label>
                <input
                  className="input"
                  placeholder="my-store.myshopify.com"
                  value={shDomain}
                  onChange={(e) => setShDomain(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Admin API access token</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={shToken}
                  onChange={(e) => setShToken(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>גרסת API (אופציונלי, ברירת מחדל בשרת)</label>
                <input
                  className="input"
                  placeholder="2024-10"
                  value={shApiVer}
                  onChange={(e) => setShApiVer(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Client secret (לאימות webhook — אופציונלי בשמירה ראשונה)</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={shClientSecret}
                  onChange={(e) => setShClientSecret(e.target.value)}
                />
                <small className="text-muted">
                  ב-Shopify Admin → האפליקציה המותאמת → Client credentials → Secret.
                </small>
              </div>
              <div className="flex-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
                <button type="submit" className="btn" disabled={shSaving}>
                  {shSaving ? "שומר…" : "שמירה ובדיקת חיבור"}
                </button>
                <button type="button" className="btn secondary" onClick={() => setStep(1)}>
                  המשך לסנכרון
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 1 && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>שלב 2 — סנכרון מוצרים</h2>
            <p className="text-muted" style={{ marginTop: 0 }}>
              לאחר שמירת פרטי Shopify, משכו את המוצרים. אפשר לחזור לשלב הקודם לעדכון טוקן.
            </p>
            <p>
              סטטוס Shopify:{" "}
              {shop?.shopify_configured ? (
                <span className="badge success">מחובר</span>
              ) : (
                <span className="badge neutral">עדיין לא מחובר — השלימו שלב 1</span>
              )}
            </p>
            <form onSubmit={(e) => void onSync(e)}>
              <button type="submit" className="btn" disabled={syncing}>
                {syncing ? "מסנכרן…" : "סנכרון מוצרים עכשיו"}
              </button>
            </form>
            <div className="flex-row mt-2" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" className="btn secondary" onClick={() => setStep(0)}>
                חזרה
              </button>
              <Link className="btn secondary" to={`${base}/products`}>
                למוצרים ומתחרים
              </Link>
              <Link className="btn secondary" to={`${base}/settings`}>
                להגדרות חנות
              </Link>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <p className="page-sub">
        אשף שלב־אחר־שלב לחיבור WooCommerce דרך תוסף שיוצר מפתחות REST ושולח אותם אוטומטית — בלי
        הזנה ידנית של Consumer key/secret.
      </p>
      {err && <p className="error">{err}</p>}
      {msg && <p className="text-muted">{msg}</p>}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="flex-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {STEPS_WP.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`btn sm ${step === i ? "" : "secondary"}`}
              onClick={() => setStep(i)}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>שלב 1 — כתובת האתר</h2>
          <p className="text-muted" style={{ marginTop: 0 }}>
            רשמו את כתובת חנות הוורדפרס שלכם (לתיעוד בתהליך). החיבור בפועל ייקלט אוטומטית מהתוסף
            אחרי לחיצה על &quot;חבר עכשיו&quot; בלוח הניהול של וורדפרס.
          </p>
          <div className="field">
            <label>כתובת האתר (למשל https://example.co.il)</label>
            <input
              className="input"
              type="url"
              placeholder="https://"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label>כתובת API ציבורית לתוסף (חשוב בפרודקשן)</label>
            <input
              className="input"
              type="url"
              placeholder="https://api.your-domain.com"
              value={apiBaseForPlugin}
              onChange={(e) => setApiBaseForPlugin(e.target.value)}
            />
            <small className="text-muted">
              אם משאירים ריק, המערכת תשתמש בברירת המחדל של השרת. אם קיבלתם שגיאת 127.0.0.1 בתוסף —
              מלאו כאן דומיין API ציבורי והורידו ZIP חדש.
            </small>
          </div>
          <div className="flex-row" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn" onClick={() => setStep(1)}>
              המשך
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>שלב 2 — הורדת התוסף</h2>
          <p className="text-muted" style={{ marginTop: 0 }}>
            הורידו את קובץ ה־ZIP והתקינו אותו פעם אחת. התוסף נבנה עם טוקן חיבור קבוע לחנות, כך שלא
            צריך לרענן או להוריד גרסה חדשה בכל פעם.
          </p>
          <div className="flex-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => void onDownloadPlugin()}>
              הורדת price-resolver-connect.zip
            </button>
            <button type="button" className="btn secondary" onClick={() => setStep(0)}>
              חזרה
            </button>
            <button type="button" className="btn secondary" onClick={() => setStep(2)}>
              המשך
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>שלב 3 — התקנה והפעלה</h2>
          <ol style={{ lineHeight: 1.7 }}>
            <li>בוורדפרס: תוספים → הוסף חדש → העלאה — בחרו את קובץ ה־ZIP והפעילו.</li>
            <li>ודאו ש־WooCommerce פעיל.</li>
            <li>בתפריט: WooCommerce → Price Resolver (או לפי שם התוסף במסך התוספים).</li>
            <li>
              לחצו <strong>חבר עכשיו (יצירת מפתחות + שליחה)</strong> — המערכת תיצור מפתחות REST ותשלח
              אותם לשרת Price Resolver. נדרשת גישת ניהול ל־WooCommerce.
            </li>
          </ol>
          <p className="text-muted">
            אם מופיעה שגיאה, בדקו שהאתר יכול לגשת לכתובת ה־API של המערכת (חומת אש / SSL).
          </p>
          <div className="flex-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" className="btn secondary" onClick={() => setStep(1)}>
              חזרה
            </button>
            <button type="button" className="btn" onClick={() => setStep(3)}>
              המשך לסנכרון
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>שלב 4 — סנכרון מוצרים</h2>
          <p className="text-muted" style={{ marginTop: 0 }}>
            לאחר חיבור מוצלח, משכו את רשימת המוצרים מ־WooCommerce. אפשר לחזור לכאן בכל עת לסנכרון
            נוסף.
          </p>
          <p>
            סטטוס WooCommerce:{" "}
            {shop?.woocommerce_configured ? (
              <span className="badge success">מחובר</span>
            ) : (
              <span className="badge neutral">עדיין לא מחובר — השלימו את שלב 3</span>
            )}
          </p>
          <form onSubmit={(e) => void onSync(e)}>
            <button type="submit" className="btn" disabled={syncing}>
              {syncing ? "מסנכרן…" : "סנכרון מוצרים עכשיו"}
            </button>
          </form>
          <div className="flex-row mt-2" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" className="btn secondary" onClick={() => setStep(2)}>
              חזרה
            </button>
            <Link className="btn secondary" to={`${base}/products`}>
              למוצרים ומתחרים
            </Link>
            <Link className="btn secondary" to={`${base}/settings`}>
              להגדרות חנות
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
