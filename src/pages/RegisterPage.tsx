import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRegister } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

export function RegisterPage() {
  const nav = useNavigate();
  const { setToken, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await apiRegister({ email, password, name: name || undefined });
      setToken(r.access_token);
      const u = await refresh(r.access_token);
      nav(u?.is_admin ? "/admin" : "/shops", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>הרשמה</h1>
        <p className="text-muted" style={{ marginTop: "-0.5rem" }}>
          צור חשבון והתחל לעקוב אחרי מתחרים
        </p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>שם (אופציונלי)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>אימייל</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
          </div>
          <div className="field">
            <label>סיסמה</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              minLength={6}
            />
          </div>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-block" type="submit">
            צור חשבון
          </button>
        </form>
        <p style={{ marginTop: "1.25rem" }}>
          כבר רשומים? <Link to="/login">התחברות</Link>
        </p>
      </div>
    </div>
  );
}
