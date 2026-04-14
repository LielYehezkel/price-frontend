import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import {
  apiGetWhatsappConfig,
  apiPutWhatsappConfig,
  apiWhatsappSendTest,
  apiWhatsappValidateCredentials,
  apiWhatsappWizard,
  type WhatsappWizardOut,
} from "../api/apiSaaS";

export function ShopWhatsappOnboardingPage() {
  const { token } = useAuth();
  const { shopId } = useParams();
  const sid = Number(shopId || 0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [wizard, setWizard] = useState<WhatsappWizardOut | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testText, setTestText] = useState("בדיקת חיבור מהמערכת - הצלחה");
  const [editMode, setEditMode] = useState(false);

  const steps = useMemo(() => wizard?.steps ?? [], [wizard]);
  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length || 4;
  const progress = Math.round((doneCount / totalCount) * 100);
  const activeKey = wizard?.current_step_key ?? "save_config";
  const isConnected = Boolean(wizard?.completed && enabled);

  async function load() {
    if (!token || !sid) return;
    const [w, cfg] = await Promise.all([apiWhatsappWizard(token, sid), apiGetWhatsappConfig(token, sid)]);
    setWizard(w);
    setEnabled(cfg.enabled);
    setPhoneNumberId(cfg.phone_number_id ?? "");
    setBusinessId(cfg.business_account_id ?? "");
    setVerifyToken(cfg.verify_token ?? "");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sid]);

  async function saveConfig(e: FormEvent) {
    e.preventDefault();
    if (!token || !sid) return;
    setLoading(true);
    setErr(null);
    try {
      await apiPutWhatsappConfig(token, sid, {
        enabled,
        phone_number_id: phoneNumberId,
        business_account_id: businessId || null,
        verify_token: verifyToken,
        access_token: accessToken,
      });
      setStatusMsg("שמירה בוצעה. ממשיכים לשלב הבא.");
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בשמירת הגדרות");
    } finally {
      setLoading(false);
    }
  }

  async function saveActivation() {
    if (!token || !sid) return;
    setLoading(true);
    setErr(null);
    try {
      await apiPutWhatsappConfig(token, sid, {
        enabled,
        phone_number_id: phoneNumberId,
        business_account_id: businessId || null,
        verify_token: verifyToken,
        access_token: accessToken,
      });
      setStatusMsg(enabled ? "החיבור הופעל בהצלחה." : "החיבור נשמר ככבוי.");
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בשמירת סטטוס הפעלה");
    } finally {
      setLoading(false);
    }
  }

  async function validateMeta() {
    if (!token || !sid) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiWhatsappValidateCredentials(token, sid);
      setStatusMsg(res.detail);
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בבדיקת Meta");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    if (!token || !sid || !testPhone.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiWhatsappSendTest(token, sid, {
        to_phone_e164: testPhone.trim(),
        text: testText,
      });
      setStatusMsg(res.detail);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בשליחת הודעת בדיקה");
    } finally {
      setLoading(false);
    }
  }

  async function copyValue(v: string | null | undefined) {
    const val = (v ?? "").trim();
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setStatusMsg("הועתק ללוח.");
    } catch {
      setErr("לא ניתן היה להעתיק אוטומטית.");
    }
  }

  return (
    <div className="wa-onboard">
      <div className="wa-onboard-hero">
        <div>
          <h1>חיבור WhatsApp לחנות</h1>
          <p>
            אשף אינטראקטיבי בסגנון משימות: כל שלב ברור, עם בדיקה מיידית והכוונה עד חיבור מלא.
          </p>
        </div>
        <div className="wa-onboard-progress">
          <div className="wa-onboard-progress__label">התקדמות</div>
          <div className="wa-onboard-progress__value">{progress}%</div>
          <div className="wa-onboard-progress__bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="wa-onboard-progress__sub">
            {doneCount}/{totalCount} שלבים הושלמו
          </div>
        </div>
      </div>

      {isConnected && !editMode ? (
        <section className="wa-connected-banner">
          <div>
            <h3>החנות כבר מחוברת ל-WhatsApp</h3>
            <p>
              מצב פעיל. אפשר להשאיר כמו שהוא, או לעבור לעריכת הגדרות (Token/Phone/Webhook) בלי להריץ שוב את
              כל האשף.
            </p>
          </div>
          <div className="wa-connected-banner__actions">
            <span className="badge success">Connected</span>
            <button className="btn btn-secondary" type="button" onClick={() => setEditMode(true)}>
              עריכת הגדרות
            </button>
            <Link className="btn" to={`/app/${sid}/assistant`}>
              חזרה לעוזר AI
            </Link>
          </div>
        </section>
      ) : null}

      <div className="wa-onboard-guide">
        <h2>מדריך קצר לפני שמתחילים</h2>
        <p>
          המטרה: לקחת חנות שלא מחוברת בכלל, ולהגיע לחיבור פעיל עם בדיקת הודעה מוצלחת תוך כמה דקות.
        </p>
        <h3>שלב 1 - מה בדיוק צריך להכין לפני שממלאים</h3>
        <ol>
          <li>
            היכנס ל-Meta Developers &gt; האפליקציה שלך &gt; WhatsApp.
          </li>
          <li>
            העתק <strong>Phone Number ID</strong> מתוך אזור ה-API Setup.
          </li>
          <li>
            צור <strong>Access Token</strong> (זמני או קבוע) עם הרשאות WhatsApp Cloud API.
          </li>
          <li>
            בחר <strong>Verify Token</strong> משלך (טקסט חופשי, לדוגמה: <code>my-shop-verify-2026</code>).
          </li>
          <li>
            אם יש לך, הוסף גם <strong>Business Account ID</strong> (לא חובה להפעלה ראשונית).
          </li>
        </ol>
        <p className="text-muted">
          טיפ חשוב: אם אין לך עדיין `PUBLIC_API_BASE` ציבורי בשרת, המערכת תציג זאת בחסמים ותעצור אותך לפני שלב ה-Webhook.
        </p>
      </div>

      {wizard?.blocking_issues?.length ? (
        <div className="wa-onboard-alert wa-onboard-alert--danger">
          <strong>לפני שממשיכים:</strong>
          <ul>
            {wizard.blocking_issues.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {err ? <div className="wa-onboard-alert wa-onboard-alert--danger">{err}</div> : null}
      {statusMsg ? <div className="wa-onboard-alert wa-onboard-alert--info">{statusMsg}</div> : null}

      <section className={`wa-step wa-step--quest ${activeKey === "save_config" ? "is-active" : ""}`}>
        <header>
          <span className="wa-step__badge">{steps.find((s) => s.key === "save_config")?.done ? "✓" : "1"}</span>
          <div>
            <h3>שלב 1: שמירת פרטי החיבור</h3>
            <p>הדבק את הפרטים מהשלב המקדמי למעלה ולחץ "שמור והמשך".</p>
          </div>
          <span className="wa-step__state">{steps.find((s) => s.key === "save_config")?.done ? "הושלם" : "פעיל"}</span>
        </header>
        <form onSubmit={saveConfig} className="wa-step__body">
          <input className="input" placeholder="Phone Number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} disabled={loading} />
          <input className="input" placeholder="Business Account ID (אופציונלי)" value={businessId} onChange={(e) => setBusinessId(e.target.value)} disabled={loading} />
          <input className="input" placeholder="Verify Token" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} disabled={loading} />
          <input className="input" placeholder="Access Token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} disabled={loading} />
          <div className="text-muted">אם אתה כבר מחובר ורוצה לערוך - הזן Access Token חדש ורק אז שמור.</div>
          <button className="btn" type="submit" disabled={loading || !phoneNumberId.trim() || !verifyToken.trim() || !accessToken.trim()}>
            שמור והמשך
          </button>
        </form>
      </section>

      <section className={`wa-step wa-step--quest ${activeKey === "verify_credentials" ? "is-active" : ""}`}>
        <header>
          <span className="wa-step__badge">{steps.find((s) => s.key === "verify_credentials")?.done ? "✓" : "2"}</span>
          <div>
            <h3>שלב 2: אימות מול Meta</h3>
            <p>בדיקת תקינות אוטומטית לקרדנצ'לים.</p>
          </div>
          <span className="wa-step__state">{steps.find((s) => s.key === "verify_credentials")?.done ? "הושלם" : "ממתין"}</span>
        </header>
        <div className="wa-step__body">
          <button className="btn" onClick={validateMeta} disabled={loading}>
            בדוק חיבור מול Meta
          </button>
        </div>
      </section>

      <section className={`wa-step wa-step--quest ${activeKey === "set_webhook" ? "is-active" : ""}`}>
        <header>
          <span className="wa-step__badge">{steps.find((s) => s.key === "set_webhook")?.done ? "✓" : "3"}</span>
          <div>
            <h3>שלב 3: הגדרת Webhook ב-Meta</h3>
            <p>העתק בלחיצה והדבק במסך ה-Webhook של האפליקציה.</p>
          </div>
          <span className="wa-step__state">{steps.find((s) => s.key === "set_webhook")?.done ? "הושלם" : "ממתין"}</span>
        </header>
        <div className="wa-step__body">
          <div className="wa-copy-row">
            <code>{wizard?.webhook_url || "Webhook URL לא זמין עדיין"}</code>
            <button className="btn secondary" onClick={() => copyValue(wizard?.webhook_url)} disabled={loading || !wizard?.webhook_url}>
              העתק URL
            </button>
          </div>
          <div className="wa-copy-row">
            <code>{wizard?.verify_token || "Verify Token לא זמין עדיין"}</code>
            <button className="btn secondary" onClick={() => copyValue(wizard?.verify_token)} disabled={loading || !wizard?.verify_token}>
              העתק Token
            </button>
          </div>
        </div>
      </section>

      <section className={`wa-step wa-step--quest ${activeKey === "enable_bot" ? "is-active" : ""}`}>
        <header>
          <span className="wa-step__badge">{steps.find((s) => s.key === "enable_bot")?.done ? "✓" : "4"}</span>
          <div>
            <h3>שלב 4: טסט והפעלה</h3>
            <p>שלח הודעת בדיקה ואז הפעל את החיבור.</p>
          </div>
          <span className="wa-step__state">{steps.find((s) => s.key === "enable_bot")?.done ? "הושלם" : "ממתין"}</span>
        </header>
        <div className="wa-step__body">
          <input
            className="input"
            placeholder="מספר בדיקה בפורמט +972..."
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            disabled={loading}
          />
          <input className="input" placeholder="טקסט בדיקה" value={testText} onChange={(e) => setTestText(e.target.value)} disabled={loading} />
          <div className="flex-row">
            <button className="btn secondary" onClick={sendTest} disabled={loading || !testPhone.trim()}>
              שלח הודעת בדיקה
            </button>
            <label className="text-muted" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={loading} />
              הפעל חיבור לחנות
            </label>
            <button className="btn" onClick={saveActivation} disabled={loading || !enabled}>
              שמור הפעלה
            </button>
          </div>
        </div>
      </section>

      {wizard?.completed ? (
        <div className="wa-onboard-success">
          <h3>החיבור הושלם בהצלחה 🎉</h3>
          <p>המערכת מוכנה לעבודה עם WhatsApp עבור החנות הזו.</p>
          <Link className="btn" to={`/app/${sid}/assistant`}>
            חזרה לעוזר AI
          </Link>
        </div>
      ) : null}
    </div>
  );
}
