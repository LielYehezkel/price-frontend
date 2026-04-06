import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  apiDownloadWpPluginZip,
  apiGetShop,
  apiSyncShop,
  type ShopOut,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

const STEPS = [
  "כתובת האתר",
  "הורדת התוסף",
  "התקנה בוורדפרס",
  "סנכרון מוצרים",
];

export function ShopSetupPage() {
  const { shopId } = useParams();
  const { token } = useAuth();
  const sid = Number(shopId);
  const [step, setStep] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [shop, setShop] = useState<ShopOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
      const blob = await apiDownloadWpPluginZip(token, sid);
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

  const base = `/app/${sid}`;

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
          {STEPS.map((label, i) => (
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
            הורידו את קובץ ה־ZIP — בכל הורדה נוצר טוקן הקמה חדש (תוקף שבוע). התקינו את התוסף באתר
            הוורדפרס שלכם.
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
