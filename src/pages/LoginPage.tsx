import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiLogin } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const nav = useNavigate();
  const { setToken, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await apiLogin({ email, password });
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
        <h1>התחברות</h1>
        <p className="text-muted" style={{ marginTop: "-0.5rem" }}>
          PriceIntel — ניטור מחירים מול מתחרים
        </p>
        <form onSubmit={onSubmit}>
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
            />
          </div>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-block" type="submit">
            כניסה
          </button>
        </form>
        <p style={{ marginTop: "1.25rem" }}>
          אין חשבון? <Link to="/register">הרשמה</Link>
        </p>
      </div>
    </div>
  );
}
