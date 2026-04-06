import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  apiListAlerts,
  apiReadAlert,
  apiReadAllAlerts,
  type AlertOut,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

const kindLabel: Record<string, string> = {
  competitor_cheaper: "יתרון מתחרה",
  price_change: "שינוי מחיר",
  auto_pricing: "תמחור אוטומטי",
  sanity_failed: "אמינות",
  general: "כללי",
};

export function ShopAlertsPage() {
  const { shopId } = useParams();
  const { token } = useAuth();
  const sid = Number(shopId);
  const base = `/app/${shopId}`;
  const [items, setItems] = useState<AlertOut[]>([]);

  async function load() {
    if (!token || Number.isNaN(sid)) return;
    setItems(await apiListAlerts(token, sid));
  }

  useEffect(() => {
    void load();
  }, [token, sid]);

  async function readOne(id: number) {
    if (!token) return;
    await apiReadAlert(token, sid, id);
    await load();
  }

  async function readAll() {
    if (!token) return;
    await apiReadAllAlerts(token, sid);
    await load();
  }

  const unread = items.filter((a) => !a.read).length;

  return (
    <>
      <p className="page-sub">
        התראות לפי סוג — ניתן לסנן מה יוצג ברשימה ב
        <Link to={`${base}/settings`}>הגדרות → התראות במערכת</Link>.
      </p>
      <div className="alerts-page-toolbar">
        <span className="alerts-page-count">
          {unread > 0 ? `${unread} לא נקראו` : "הכל נקרא"}
        </span>
        <button type="button" className="btn secondary sm" onClick={() => void readAll()}>
          סמן הכל כנקרא
        </button>
      </div>
      <div className="alerts-page-list">
        {items.length === 0 ? (
          <p className="text-muted alerts-page-empty">אין התראות — או שהסינון בהגדרות מסתיר את כולן.</p>
        ) : (
          items.map((a) => (
            <article
              key={a.id}
              className={`alerts-page-card ${a.read ? "is-read" : ""} ${a.severity === "hot" ? "is-hot" : ""}`}
            >
              <div className="alerts-page-card__meta">
                <span className="alerts-page-kind">{kindLabel[a.kind] ?? a.kind}</span>
                <time dateTime={a.created_at}>
                  {new Date(a.created_at).toLocaleString("he-IL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              <p className="alerts-page-card__msg">{a.message}</p>
              {!a.read && (
                <button
                  type="button"
                  className="btn ghost sm alerts-page-read"
                  onClick={() => void readOne(a.id)}
                >
                  סמן כנקרא
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </>
  );
}
