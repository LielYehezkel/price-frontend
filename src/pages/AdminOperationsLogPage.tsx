import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiAdminOperationsLog, type OperationalLogRow } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

const PAGE = 40;

function levelClass(level: string): string {
  if (level === "error") return "admin-log--error";
  if (level === "warning") return "admin-log--warn";
  return "admin-log--info";
}

export function AdminOperationsLogPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<OperationalLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [level, setLevel] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const page = await apiAdminOperationsLog(token, {
          limit: PAGE,
          offset,
          level: level || null,
        });
        if (!cancelled) {
          setItems(page.items);
          setTotal(page.total);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "שגיאה");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, offset, level]);

  return (
    <div className="content-area admin-dash admin-dash--wide">
      <header className="admin-dash-hero">
        <div>
          <h1 className="admin-dash-title">יומן תפעול</h1>
          <p className="admin-dash-sub text-muted">
            כל כשל בסריקה מתועד עם קוד, כותרת ופירוט — לזיהוי מהיר של מקור הבעיה.
          </p>
        </div>
        <Link to="/admin/scan-engine" className="btn ghost">
          חזרה למוניטור
        </Link>
      </header>

      {err && <p className="error">{err}</p>}

      <div className="admin-log-filters card">
        <label>
          רמת חומרה
          <select
            value={level}
            onChange={(ev) => {
              setLevel(ev.target.value);
              setOffset(0);
            }}
            className="input"
          >
            <option value="">הכל</option>
            <option value="error">שגיאה</option>
            <option value="warning">אזהרה</option>
            <option value="info">מידע</option>
          </select>
        </label>
        <span className="text-muted admin-log-count">
          {total} רשומות
          {offset > 0 && ` · מוצגות ${offset + 1}–${Math.min(offset + PAGE, total)}`}
        </span>
      </div>

      <div className="admin-log-list">
        {items.length === 0 && !err && <p className="text-muted">אין רשומות.</p>}
        {items.map((row) => (
          <article
            key={row.id}
            className={`card admin-log-row ${levelClass(row.level)}`}
          >
            <header className="admin-log-row__head">
              <span className={`admin-log-badge admin-log-badge--${row.level}`}>{row.level}</span>
              <span className="admin-log-code">{row.code}</span>
              <time dateTime={row.created_at} className="text-muted admin-log-time">
                {new Date(row.created_at).toLocaleString("he-IL")}
              </time>
            </header>
            <h3 className="admin-log-title">{row.title}</h3>
            <div className="admin-log-refs text-muted">
              {row.shop_id != null && <span>חנות #{row.shop_id}</span>}
              {row.competitor_link_id != null && (
                <span> · קישור מתחרה #{row.competitor_link_id}</span>
              )}
            </div>
            <button
              type="button"
              className="btn linkish sm"
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
            >
              {expanded === row.id ? "הסתר פירוט" : "הצג פירוט מלא"}
            </button>
            {expanded === row.id && <pre className="admin-log-detail">{row.detail}</pre>}
          </article>
        ))}
      </div>

      <div className="admin-log-pager">
        <button
          type="button"
          className="btn ghost sm"
          disabled={offset <= 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE))}
        >
          קודם
        </button>
        <button
          type="button"
          className="btn ghost sm"
          disabled={offset + PAGE >= total}
          onClick={() => setOffset(offset + PAGE)}
        >
          הבא
        </button>
      </div>
    </div>
  );
}
