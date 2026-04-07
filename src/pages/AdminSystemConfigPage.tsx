import { FormEvent, useEffect, useState } from "react";
import {
  apiAdminGetSystemConfig,
  apiAdminPatchSystemConfig,
  type AdminSystemConfig,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

export function AdminSystemConfigPage() {
  const { token } = useAuth();
  const [cfg, setCfg] = useState<AdminSystemConfig | null>(null);
  const [mode, setMode] = useState<"local" | "custom">("local");
  const [apiBase, setApiBase] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const c = await apiAdminGetSystemConfig(token);
        setCfg(c);
        setMode(c.backend_mode === "custom" ? "custom" : "local");
        setApiBase(c.backend_api_base ?? "");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    })();
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const c = await apiAdminPatchSystemConfig(token, {
        backend_mode: mode,
        backend_api_base: mode === "custom" ? apiBase.trim() || null : null,
      });
      setCfg(c);
      setMsg("הגדרות מערכת נשמרו");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-area" style={{ maxWidth: 760 }}>
      <h1 style={{ marginTop: 0 }}>הגדרות שרת מערכת</h1>
      <p className="text-muted">
        כאן מגדירים מה הכתובת הציבורית של ה־Backend עבור רכיבים כמו תוסף WordPress.
      </p>
      {cfg && (
        <p className="text-muted" style={{ fontSize: "0.9rem" }}>
          עודכן לאחרונה: {new Date(cfg.updated_at).toLocaleString("he-IL")}
        </p>
      )}
      {err && <p className="error">{err}</p>}
      {msg && <p className="text-muted">{msg}</p>}

      <form className="card" onSubmit={onSave}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>מצב ריצה</h2>
        <label className="settings-notif-row" style={{ alignItems: "center" }}>
          <input
            type="radio"
            name="backend_mode"
            checked={mode === "local"}
            onChange={() => setMode("local")}
          />
          <span>
            <strong>Local (ברירת מחדל קיימת)</strong>
            <small className="text-muted">
              שומר על ההתנהגות של היום: שימוש ב־ENV המקומי והתאמות אוטומטיות לפי בקשה.
            </small>
          </span>
        </label>
        <label className="settings-notif-row" style={{ alignItems: "center", marginTop: "0.65rem" }}>
          <input
            type="radio"
            name="backend_mode"
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
          />
          <span>
            <strong>Custom Backend URL</strong>
            <small className="text-muted">
              לשימוש בפרודקשן: כתובת ציבורית קבועה שהמערכת תטמיע בתוסף ותשתמש היכן שצריך.
            </small>
          </span>
        </label>

        <div className="field" style={{ marginTop: "0.85rem" }}>
          <label>כתובת Backend ציבורית</label>
          <input
            className="input"
            type="url"
            placeholder="https://api.your-domain.com"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            disabled={mode !== "custom"}
          />
        </div>

        <button className="btn" type="submit" disabled={saving}>
          {saving ? "שומר…" : "שמור הגדרות מערכת"}
        </button>
      </form>
    </div>
  );
}

