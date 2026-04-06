import { FormEvent, useEffect, useState } from "react";
import { apiAdminPatchUser, apiAdminSetPassword, apiAdminUsers, type AdminUserRow } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

export function AdminUsersPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<number, { email: string; name: string; is_admin: boolean; new_password: string }>
  >({});

  async function load() {
    if (!token) return;
    const list = await apiAdminUsers(token);
    setRows(list);
    const d: Record<number, { email: string; name: string; is_admin: boolean; new_password: string }> =
      {};
    for (const r of list) {
      d[r.id] = {
        email: r.email,
        name: r.name ?? "",
        is_admin: r.is_admin,
        new_password: "",
      };
    }
    setDrafts(d);
  }

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "שגיאה"));
  }, [token]);

  async function saveDetails(e: FormEvent, id: number) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setMsg(null);
    const d = drafts[id];
    if (!d) return;
    try {
      await apiAdminPatchUser(token, id, {
        email: d.email,
        name: d.name || null,
        is_admin: d.is_admin,
      });
      setMsg("פרטים עודכנו");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  function patchDraft(
    id: number,
    row: AdminUserRow,
    partial: Partial<{ email: string; name: string; is_admin: boolean; new_password: string }>,
  ) {
    setDrafts((prev) => {
      const cur = prev[id] ?? {
        email: row.email,
        name: row.name ?? "",
        is_admin: row.is_admin,
        new_password: "",
      };
      return { ...prev, [id]: { ...cur, ...partial } };
    });
  }

  async function savePassword(id: number) {
    if (!token) return;
    setErr(null);
    setMsg(null);
    const pw = drafts[id]?.new_password?.trim();
    if (!pw || pw.length < 6) {
      setErr("סיסמה חדשה — לפחות 6 תווים");
      return;
    }
    try {
      await apiAdminSetPassword(token, id, pw);
      setDrafts((prev) => ({
        ...prev,
        [id]: { ...prev[id], new_password: "" },
      }));
      setMsg("סיסמה עודכנה");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  return (
    <div className="content-area" style={{ maxWidth: 1200 }}>
      <h1 style={{ marginTop: 0 }}>ניהול משתמשים</h1>
      <div className="card" style={{ marginTop: "0.5rem" }}>
        <p style={{ marginTop: 0 }}>
          <strong>סיסמאות:</strong> במערכת הסיסמאות נשמרות מוצפנות (bcrypt) ולכן{" "}
          <strong>אי אפשר להציג את הסיסמה המקורית</strong>. ניתן לאפס סיסמה בשדה &quot;סיסמה
          חדשה&quot; לכל משתמש.
        </p>
      </div>

      {err && <p className="error">{err}</p>}
      {msg && <p>{msg}</p>}

      <div className="card" style={{ overflowX: "auto", marginTop: "1rem" }}>
        <table>
          <thead>
            <tr>
              <th>מזהה</th>
              <th>אימייל</th>
              <th>שם</th>
              <th>מנהל</th>
              <th>סיסמה (מצב אחסון)</th>
              <th>נוצר</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = drafts[r.id];
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <input
                      value={d?.email ?? r.email}
                      onChange={(e) => patchDraft(r.id, r, { email: e.target.value })}
                      style={{ minWidth: 200 }}
                    />
                  </td>
                  <td>
                    <input
                      value={d?.name ?? ""}
                      onChange={(e) => patchDraft(r.id, r, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={d?.is_admin ?? r.is_admin}
                      onChange={(e) => patchDraft(r.id, r, { is_admin: e.target.checked })}
                    />
                  </td>
                  <td style={{ fontSize: "0.85rem", maxWidth: 220 }}>{r.password_note}</td>
                  <td style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td>
                    <form
                      onSubmit={(e) => void saveDetails(e, r.id)}
                      className="row"
                      style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}
                    >
                      <button type="submit" className="btn secondary">
                        שמור פרטים
                      </button>
                      <input
                        placeholder="סיסמה חדשה"
                        type="password"
                        autoComplete="new-password"
                        value={d?.new_password ?? ""}
                        onChange={(e) => patchDraft(r.id, r, { new_password: e.target.value })}
                      />
                      <button type="button" className="btn" onClick={() => void savePassword(r.id)}>
                        אפס סיסמה
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
