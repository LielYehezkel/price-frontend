import { FormEvent, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiChangePassword } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";
import { UserSessionBar } from "../components/UserSessionBar";

export function AccountPage() {
  const { token } = useAuth();
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (n1 !== n2) {
      setErr("הסיסמאות אינן תואמות");
      return;
    }
    if (!token) return;
    try {
      await apiChangePassword(token, { current_password: cur, new_password: n1 });
      setCur("");
      setN1("");
      setN2("");
      setMsg("עודכן");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  return (
    <div className="standalone-shell">
      <header className="standalone-session-header">
        <NavLink to="/shops" className="standalone-brand">
          PriceIntel
        </NavLink>
        <UserSessionBar />
      </header>
      <main className="standalone-session-main">
        <h1 className="page-heading">חשבון</h1>
        <div className="card" style={{ maxWidth: 480 }}>
        <h2>שינוי סיסמה</h2>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>סיסמה נוכחית</label>
            <input value={cur} onChange={(e) => setCur(e.target.value)} required type="password" />
          </div>
          <div className="field">
            <label>סיסמה חדשה</label>
            <input value={n1} onChange={(e) => setN1(e.target.value)} required type="password" />
          </div>
          <div className="field">
            <label>אימות סיסמה</label>
            <input value={n2} onChange={(e) => setN2(e.target.value)} required type="password" />
          </div>
          {err && <p className="error">{err}</p>}
          {msg && <p>{msg}</p>}
          <button className="btn" type="submit">
            עדכן
          </button>
        </form>
      </div>
      </main>
    </div>
  );
}
