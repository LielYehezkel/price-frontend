import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import {
  apiAiActionLogs,
  apiAiChatConfirm,
  apiAiChatPlan,
  apiAiUndoAction,
  apiGetWhatsappConfig,
  apiPutWhatsappConfig,
  apiWhatsappSendTest,
  apiWhatsappGuide,
  apiWhatsappValidateCredentials,
  apiWhatsappWizard,
  type AiActionLogOut,
  type AiChatPlanOut,
  type WhatsappGuideOut,
  type WhatsappWizardOut,
} from "../api/apiSaaS";

type ChatLog =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string };

export function ShopAiChatPage() {
  const { token } = useAuth();
  const { shopId } = useParams();
  const sid = Number(shopId || 0);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [plan, setPlan] = useState<AiChatPlanOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [actionLogs, setActionLogs] = useState<AiActionLogOut[]>([]);
  const [guide, setGuide] = useState<WhatsappGuideOut | null>(null);
  const [waEnabled, setWaEnabled] = useState(false);
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waBusinessId, setWaBusinessId] = useState("");
  const [waVerifyToken, setWaVerifyToken] = useState("");
  const [waAccessToken, setWaAccessToken] = useState("");
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [waWizard, setWaWizard] = useState<WhatsappWizardOut | null>(null);
  const [waValidation, setWaValidation] = useState<string>("");
  const [waTestPhone, setWaTestPhone] = useState("");
  const [waTestText, setWaTestText] = useState("בדיקת חיבור מהעוזר האוטומטי - ההתחברות הצליחה");
  const [copiedField, setCopiedField] = useState<string>("");

  useEffect(() => {
    void loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sid]);

  async function loadMeta() {
    if (!token || !sid) return;
    const [l, g, c, w] = await Promise.all([
      apiAiActionLogs(token, sid, 20),
      apiWhatsappGuide(token, sid),
      apiGetWhatsappConfig(token, sid),
      apiWhatsappWizard(token, sid),
    ]);
    setActionLogs(l);
    setGuide(g);
    setWaEnabled(c.enabled);
    setWaPhoneNumberId(c.phone_number_id ?? "");
    setWaBusinessId(c.business_account_id ?? "");
    setWaVerifyToken(c.verify_token ?? "");
    setWaWizard(w);
    setMetaLoaded(true);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!token || !sid || !input.trim()) return;
    const txt = input.trim();
    setLoading(true);
    setErr(null);
    setPlan(null);
    setLogs((prev) => [...prev, { role: "user", text: txt }]);
    try {
      const res = await apiAiChatPlan(token, sid, txt);
      setPlan(res);
      setLogs((prev) => [...prev, { role: "assistant", text: res.question }]);
    } catch (ex: unknown) {
      const msg = ex instanceof Error ? ex.message : "שגיאה לא צפויה";
      setErr(msg);
    } finally {
      setLoading(false);
      setInput("");
    }
  }

  async function onConfirm(approved: boolean) {
    if (!token || !sid || !plan?.confirm_payload) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiAiChatConfirm(token, sid, {
        approved,
        payload: plan.confirm_payload,
      });
      if (res.status === "executed") {
        const after = res.after ? JSON.stringify(res.after) : "";
        setLogs((prev) => [
          ...prev,
          { role: "assistant", text: `בוצע בהצלחה. ${after}`.trim() },
        ]);
        await loadMeta();
      } else {
        setLogs((prev) => [...prev, { role: "assistant", text: "בוטל." }]);
      }
      setPlan(null);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בביצוע הפעולה");
    } finally {
      setLoading(false);
    }
  }

  async function onUndo(actionId: number) {
    if (!token || !sid) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiAiUndoAction(token, sid, actionId);
      setLogs((prev) => [...prev, { role: "assistant", text: `Undo: ${res.detail}` }]);
      await loadMeta();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בביטול הפעולה");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveWhatsapp(e: FormEvent) {
    e.preventDefault();
    if (!token || !sid) return;
    setLoading(true);
    setErr(null);
    try {
      await apiPutWhatsappConfig(token, sid, {
        enabled: waEnabled,
        phone_number_id: waPhoneNumberId,
        business_account_id: waBusinessId || null,
        verify_token: waVerifyToken,
        access_token: waAccessToken,
      });
      setWaValidation("שלב 1 הושלם: ההגדרות נשמרו. אפשר להמשיך לבדיקת Meta.");
      await loadMeta();
      setLogs((prev) => [...prev, { role: "assistant", text: "הגדרות WhatsApp נשמרו." }]);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בשמירת הגדרות WhatsApp");
    } finally {
      setLoading(false);
    }
  }

  async function onValidateWhatsapp() {
    if (!token || !sid) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiWhatsappValidateCredentials(token, sid);
      setWaValidation(res.detail);
      await loadMeta();
      if (res.ok) {
        setLogs((prev) => [...prev, { role: "assistant", text: "מעולה, החיבור מול Meta תקין." }]);
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בבדיקת חיבור Meta");
    } finally {
      setLoading(false);
    }
  }

  async function onSendWhatsappTest() {
    if (!token || !sid || !waTestPhone.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiWhatsappSendTest(token, sid, {
        to_phone_e164: waTestPhone.trim(),
        text: waTestText,
      });
      setWaValidation(res.detail);
      if (res.ok) {
        setLogs((prev) => [
          ...prev,
          { role: "assistant", text: `הודעת בדיקה נשלחה ל-${waTestPhone.trim()} בהצלחה.` },
        ]);
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "שגיאה בשליחת הודעת בדיקה");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(label: string, text: string | null | undefined) {
    const val = (text ?? "").trim();
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(label);
      setTimeout(() => setCopiedField(""), 1500);
    } catch {
      setErr("לא ניתן להעתיק אוטומטית. אפשר להעתיק ידנית.");
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>עוזר AI לניהול מוצרים</h1>
      <p className="text-muted">
        אפשר לכתוב למשל: "תוריד את בורדו 4 מושבים מהמלאי" או "תוריד מחיר ב-50 ש&quot;ח לסנטיאגו 4
        מושבים".
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <form onSubmit={onSend} className="flex-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 260 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="כתוב פעולה לניהול החנות..."
            disabled={loading}
          />
          <button className="btn" type="submit" disabled={loading || !input.trim()}>
            {loading ? "מעבד..." : "שלח"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => loadMeta()}
            disabled={loading}
          >
            רענן יומן/ווצאפ
          </button>
        </form>
        {err && <div style={{ marginTop: "0.75rem", color: "#b91c1c" }}>{err}</div>}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>שיחה</h3>
        {logs.length === 0 && <div className="text-muted">עדיין אין הודעות.</div>}
        {logs.map((row, i) => (
          <div key={i} style={{ marginBottom: "0.5rem" }}>
            <strong>{row.role === "user" ? "אתה" : "העוזר"}:</strong> {row.text}
          </div>
        ))}
      </div>

      {plan?.status === "needs_disambiguation" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>נדרשת בחירה</h3>
          <div style={{ marginBottom: "0.5rem" }}>{plan.question}</div>
          <ul style={{ margin: 0 }}>
            {(plan.candidates || []).map((c) => (
              <li key={c.product_id}>
                {c.name} (ציון התאמה: {c.score.toFixed(2)})
              </li>
            ))}
          </ul>
          <div className="text-muted" style={{ marginTop: "0.5rem" }}>
            כתוב שוב את הפקודה עם שם מוצר מדויק יותר.
          </div>
        </div>
      )}

      {plan?.status === "needs_confirmation" && plan.confirm_payload && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>אישור פעולה</h3>
          <div style={{ marginBottom: "0.75rem" }}>{plan.question}</div>
          <div className="flex-row" style={{ gap: "0.75rem" }}>
            <button className="btn btn-danger" onClick={() => onConfirm(true)} disabled={loading}>
              כן, בצע
            </button>
            <button className="btn btn-secondary" onClick={() => onConfirm(false)} disabled={loading}>
              לא, בטל
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Audit + Undo (5 דקות)</h3>
        {!metaLoaded && (
          <div className="text-muted">לחץ "רענן יומן/ווצאפ" כדי לטעון את היומן.</div>
        )}
        {metaLoaded && actionLogs.length === 0 && (
          <div className="text-muted">עדיין אין פעולות AI ביומן.</div>
        )}
        {actionLogs.map((row) => (
          <div
            key={row.id}
            style={{ borderTop: "1px solid #eee", paddingTop: "0.5rem", marginTop: "0.5rem" }}
          >
            <div>
              <strong>#{row.id}</strong> | {row.action} | {row.status}
            </div>
            <div className="text-muted">{new Date(row.created_at).toLocaleString()}</div>
            {row.status === "executed" && (
              <button className="btn btn-secondary" disabled={loading} onClick={() => onUndo(row.id)}>
                Undo
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>חיבור WhatsApp (אשף מודרך)</h3>
        {!metaLoaded && (
          <div className="text-muted">לחץ "רענן יומן/ווצאפ" כדי לטעון מדריך וחיבור.</div>
        )}
        {guide && (
          <>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>{guide.title}</strong>
            </div>
            <ol style={{ marginTop: 0 }}>
              {guide.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {guide.webhook_url && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div>
                  <strong>Webhook URL:</strong> <code>{guide.webhook_url}</code>
                </div>
                <div>
                  <strong>Verify Token:</strong> <code>{guide.verify_token ?? "-"}</code>
                </div>
              </div>
            )}
            <ul>
              {guide.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </>
        )}
        {waWizard && (
          <div style={{ marginBottom: "0.75rem", padding: "0.75rem", border: "1px solid #eee" }}>
            <strong>מצב חיבור:</strong>{" "}
            {waWizard.completed ? "הושלם" : `בביצוע (${waWizard.current_step_key})`}
            <ol style={{ marginBottom: 0 }}>
              {waWizard.steps.map((s) => (
                <li key={s.key} style={{ color: s.done ? "#15803d" : "#111827" }}>
                  {s.done ? "✓" : "•"} {s.title} — {s.help_text}
                </li>
              ))}
            </ol>
            {waWizard.blocking_issues.length > 0 && (
              <div style={{ marginTop: "0.75rem", color: "#b91c1c" }}>
                <strong>חסמים לטיפול:</strong>
                <ul>
                  {waWizard.blocking_issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <form onSubmit={onSaveWhatsapp}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            <input
              type="checkbox"
              checked={waEnabled}
              onChange={(e) => setWaEnabled(e.target.checked)}
              disabled={loading}
            />{" "}
            הפעל חיבור WhatsApp לחנות
          </label>
          <input
            className="input"
            style={{ marginBottom: "0.5rem" }}
            placeholder="Phone Number ID"
            value={waPhoneNumberId}
            onChange={(e) => setWaPhoneNumberId(e.target.value)}
            disabled={loading}
          />
          <input
            className="input"
            style={{ marginBottom: "0.5rem" }}
            placeholder="Business Account ID (optional)"
            value={waBusinessId}
            onChange={(e) => setWaBusinessId(e.target.value)}
            disabled={loading}
          />
          <input
            className="input"
            style={{ marginBottom: "0.5rem" }}
            placeholder="Verify Token"
            value={waVerifyToken}
            onChange={(e) => setWaVerifyToken(e.target.value)}
            disabled={loading}
          />
          <input
            className="input"
            style={{ marginBottom: "0.75rem" }}
            placeholder="Access Token"
            value={waAccessToken}
            onChange={(e) => setWaAccessToken(e.target.value)}
            disabled={loading}
          />
          <button className="btn" type="submit" disabled={loading}>
            שלב 1: שמור הגדרות
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            style={{ marginInlineStart: "0.5rem" }}
            onClick={onValidateWhatsapp}
            disabled={loading || !waPhoneNumberId.trim() || !waAccessToken.trim()}
          >
            שלב 2: בדוק חיבור מול Meta
          </button>
        </form>
        <div style={{ marginTop: "0.75rem", padding: "0.75rem", border: "1px dashed #d1d5db" }}>
          <strong>שלב 2.5: העתקה מהירה ל-Meta</strong>
          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ marginBottom: "0.35rem" }}>
              <strong>Webhook URL:</strong>{" "}
              <code>{waWizard?.webhook_url || guide?.webhook_url || "לא זמין עדיין"}</code>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => copyText("webhook", waWizard?.webhook_url || guide?.webhook_url)}
              disabled={loading || !(waWizard?.webhook_url || guide?.webhook_url)}
            >
              העתק Webhook URL
            </button>
          </div>
          <div style={{ marginTop: "0.65rem" }}>
            <div style={{ marginBottom: "0.35rem" }}>
              <strong>Verify Token:</strong>{" "}
              <code>{waWizard?.verify_token || guide?.verify_token || "לא זמין עדיין"}</code>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => copyText("verify_token", waWizard?.verify_token || guide?.verify_token)}
              disabled={loading || !(waWizard?.verify_token || guide?.verify_token)}
            >
              העתק Verify Token
            </button>
          </div>
          {copiedField && (
            <div style={{ marginTop: "0.5rem", color: "#15803d" }}>הועתק: {copiedField}</div>
          )}
        </div>
        <div style={{ marginTop: "0.75rem", borderTop: "1px solid #eee", paddingTop: "0.75rem" }}>
          <strong>שלב 3: בדיקת שליחת הודעה</strong>
          <div className="text-muted" style={{ marginBottom: "0.5rem" }}>
            הזן מספר יעד בפורמט בינלאומי, למשל: +9725XXXXXXXX
          </div>
          <input
            className="input"
            style={{ marginBottom: "0.5rem" }}
            placeholder="מספר יעד לבדיקה (+972...)"
            value={waTestPhone}
            onChange={(e) => setWaTestPhone(e.target.value)}
            disabled={loading}
          />
          <input
            className="input"
            style={{ marginBottom: "0.5rem" }}
            placeholder="טקסט בדיקה"
            value={waTestText}
            onChange={(e) => setWaTestText(e.target.value)}
            disabled={loading}
          />
          <button className="btn btn-secondary" type="button" onClick={onSendWhatsappTest} disabled={loading}>
            שלח הודעת בדיקה
          </button>
        </div>
        <div style={{ marginTop: "0.75rem", borderTop: "1px solid #eee", paddingTop: "0.75rem" }}>
          <strong>שלב 4: הפעלה סופית</strong>
          <div className="text-muted" style={{ marginTop: "0.35rem" }}>
            לאחר ששלחת הודעת בדיקה בהצלחה, סמן "הפעל חיבור WhatsApp לחנות" ולחץ שוב על "שמור הגדרות".
          </div>
        </div>
        {waValidation && (
          <div style={{ marginTop: "0.75rem", color: "#0369a1" }}>
            <strong>סטטוס:</strong> {waValidation}
          </div>
        )}
      </div>
    </div>
  );
}

