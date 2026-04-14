import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import {
  apiAiActionLogs,
  apiAiChatConfirm,
  apiAiChatPlan,
  apiAiUndoAction,
  type AiActionLogOut,
  type AiChatPlanOut,
} from "../api/apiSaaS";

type ChatLog =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string };

const QUICK_PROMPTS = [
  'תוריד את בורדו 4 מושבים מהמלאי',
  'תחזיר את מערכת ישיבה ספרד למלאי',
  'תוריד מחיר של סנטיאגו 4 מושבים ב-50 ש"ח',
  'תעלה את המחיר של מערכת ישיבה ספרד ב-50 ש"ח',
];

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
  const [metaLoaded, setMetaLoaded] = useState(false);

  useEffect(() => {
    void loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sid]);

  async function loadMeta() {
    if (!token || !sid) return;
    const l = await apiAiActionLogs(token, sid, 20);
    setActionLogs(l);
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

  async function useQuickPrompt(prompt: string) {
    setInput(prompt);
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

  return (
    <div className="ai-premium">
      <section className="ai-premium-hero">
        <div>
          <p className="ai-premium-eyebrow">AI Commerce Copilot</p>
          <h1 style={{ marginTop: 0 }}>עוזר AI לניהול מוצרים</h1>
          <p className="text-muted">
            כתוב פקודה טבעית בעברית, והמערכת תזהה מוצר, פעולה ותבקש אישור לפני ביצוע.
          </p>
        </div>
        <div className="ai-premium-hero__actions">
          <Link className="btn btn-secondary" to={`/app/${sid}/assistant/whatsapp`}>
            אשף WhatsApp החדש
          </Link>
          <button className="btn btn-secondary" type="button" onClick={() => loadMeta()} disabled={loading}>
            רענן יומן
          </button>
        </div>
      </section>

      <section className="ai-premium-grid">
        <div className="ai-main">
          <div className="card ai-command-card">
            <h3 style={{ marginTop: 0 }}>Command Center</h3>
            <form onSubmit={onSend} className="ai-command-form">
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="כתוב פעולה לניהול החנות... (למשל: תעלה מחיר של מערכת ישיבה ספרד ב-50 ש״ח)"
                disabled={loading}
              />
              <button className="btn" type="submit" disabled={loading || !input.trim()}>
                {loading ? "מעבד..." : "שלח פקודה"}
              </button>
            </form>
            <div className="ai-quick-prompts">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  className="ai-chip"
                  type="button"
                  onClick={() => useQuickPrompt(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              ))}
            </div>
            {err && <div className="ai-error-banner">{err}</div>}
          </div>

          <div className="card ai-chat-card">
            <div className="ai-chat-head">
              <h3 style={{ margin: 0 }}>שיחה</h3>
              <span className="badge neutral">{logs.length} הודעות</span>
            </div>
            <div className="ai-chat-stream">
              {logs.length === 0 && <div className="text-muted">עוד אין הודעות. בחר פקודה מהירה או כתוב משלך.</div>}
              {logs.map((row, i) => (
                <div key={i} className={`ai-msg ai-msg--${row.role}`}>
                  <div className="ai-msg__role">{row.role === "user" ? "אתה" : "העוזר"}</div>
                  <div className="ai-msg__bubble">{row.text}</div>
                </div>
              ))}
            </div>
          </div>

          {plan?.status === "needs_disambiguation" && (
            <div className="card ai-disambiguation-card">
              <h3 style={{ marginTop: 0 }}>נדרש חידוד מוצר</h3>
              <p className="text-muted" style={{ marginTop: 0 }}>
                {plan.question}
              </p>
              <div className="ai-candidates">
                {(plan.candidates || []).map((c) => (
                  <div key={c.product_id} className="ai-candidate">
                    <strong>{c.name}</strong>
                    <span>ציון התאמה: {c.score.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan?.status === "needs_confirmation" && plan.confirm_payload && (
            <div className="card ai-confirm-card">
              <h3 style={{ marginTop: 0 }}>אישור פעולה לפני ביצוע</h3>
              <p>{plan.question}</p>
              <div className="flex-row" style={{ gap: "0.75rem" }}>
                <button className="btn btn-danger" onClick={() => onConfirm(true)} disabled={loading}>
                  כן, בצע עכשיו
                </button>
                <button className="btn btn-secondary" onClick={() => onConfirm(false)} disabled={loading}>
                  לא, בטל
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="ai-side">
          <div className="card ai-audit-card">
            <h3 style={{ marginTop: 0 }}>Audit + Undo (5 דקות)</h3>
            {!metaLoaded && <div className="text-muted">טוען יומן פעולות...</div>}
            {metaLoaded && actionLogs.length === 0 && <div className="text-muted">עדיין אין פעולות AI ביומן.</div>}
            <div className="ai-audit-list">
              {actionLogs.map((row) => (
                <div key={row.id} className="ai-audit-row">
                  <div className="ai-audit-row__meta">
                    <strong>#{row.id}</strong>
                    <span>{row.action}</span>
                    <span className={`badge ${row.status === "executed" ? "success" : "neutral"}`}>
                      {row.status}
                    </span>
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
          </div>
        </aside>
      </section>
    </div>
  );
}

