import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { apiAiChatConfirm, apiAiChatPlan, type AiChatPlanOut } from "../api/apiSaaS";

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
    </div>
  );
}

