import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  apiCreateApiKey,
  apiDeleteApiKey,
  apiDownloadWpPluginZip,
  apiGetNotificationPreferences,
  apiGetShop,
  apiInvite,
  apiListApiKeys,
  apiMembers,
  apiOwnershipTransferCancel,
  apiOwnershipTransferCreate,
  apiOwnershipTransferOutgoing,
  apiPatchNotificationPreferences,
  apiShopifyConfig,
  apiUpdateShop,
  apiWooConfig,
  type ApiKeyOut,
  type MemberOut,
  type NotificationPreferences,
  type OwnershipTransferRow,
  type ShopOut,
} from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

const PRESETS = [5, 15, 30, 60, 360, 1440];

export function ShopSettingsPage() {
  const { shopId } = useParams();
  const { token, user } = useAuth();
  const sid = Number(shopId);
  const [minutes, setMinutes] = useState(360);
  const [site, setSite] = useState("");
  const [ck, setCk] = useState("");
  const [cs, setCs] = useState("");
  const [members, setMembers] = useState<MemberOut[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [keys, setKeys] = useState<ApiKeyOut[]>([]);
  const [newKeyName, setNewKeyName] = useState("default");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [wooCurrency, setWooCurrency] = useState<string | null>(null);
  const [notif, setNotif] = useState<NotificationPreferences | null>(null);
  const [transferToEmail, setTransferToEmail] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transfers, setTransfers] = useState<OwnershipTransferRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [shopOut, setShopOut] = useState<ShopOut | null>(null);
  const [shDomain, setShDomain] = useState("");
  const [shToken, setShToken] = useState("");
  const [shClientSecret, setShClientSecret] = useState("");
  const [shApiVer, setShApiVer] = useState("");

  const owner = members.find((m) => m.role === "owner");
  const isOwner = !!owner && owner.user_id === user?.id;
  const pendingTransfer = transfers.find((t) => t.shop_id === sid && t.status === "pending");

  useEffect(() => {
    if (!token || Number.isNaN(sid)) return;
    void (async () => {
      try {
        const shop = await apiGetShop(token, sid);
        setShopOut(shop);
        setMinutes(shop.check_interval_minutes);
        setWooCurrency(shop.woo_currency ?? null);
        setMembers(await apiMembers(token, sid));
        setKeys(await apiListApiKeys(token, sid));
        setNotif(await apiGetNotificationPreferences(token, sid));
        setTransfers(await apiOwnershipTransferOutgoing(token));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    })();
  }, [token, sid]);

  async function saveNotif(patch: Partial<NotificationPreferences>) {
    if (!token) return;
    setErr(null);
    try {
      const n = await apiPatchNotificationPreferences(token, sid, patch);
      setNotif(n);
      setMsg("העדפות התראות עודכנו");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function saveInterval(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    try {
      await apiUpdateShop(token, sid, { check_interval_minutes: minutes });
      setMsg("מרווח הסריקה עודכן (בדקות)");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function saveShopify(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    try {
      const r = await apiShopifyConfig(token, sid, {
        shop_domain: shDomain.trim(),
        admin_access_token: shToken.trim(),
        api_version: shApiVer.trim() || null,
        client_secret: shClientSecret.trim() || null,
      });
      setWooCurrency(r.woo_currency ?? null);
      setShopOut(await apiGetShop(token, sid));
      setMsg(
        r.shopify_orders_webhook_path
          ? `Shopify נשמר. Webhook הזמנות: POST ${r.shopify_orders_webhook_path} (HMAC עם Client secret).`
          : "Shopify נשמר",
      );
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function downloadConnectPlugin() {
    if (!token) return;
    setErr(null);
    try {
      const blob = await apiDownloadWpPluginZip(token, sid, { apiBase: null });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `price-resolver-connect-shop-${sid}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("התוסף הורד.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    }
  }

  async function saveWoo(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    try {
      const r = await apiWooConfig(token, sid, { site_url: site, consumer_key: ck, consumer_secret: cs });
      setWooCurrency(r.woo_currency ?? null);
      setMsg(
        r.woo_currency
          ? `WooCommerce נשמר — מטבע החנות שזוהה: ${r.woo_currency}`
          : "WooCommerce נשמר",
      );
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const r = await apiInvite(token, sid, { email: inviteEmail });
    setInviteEmail("");
    alert(`הזמנה נוצרה. טוקן: ${r.token}`);
  }

  async function onCreateKey(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const r = await apiCreateApiKey(token, sid, { name: newKeyName });
    setShownKey(r.raw_key);
    setKeys(await apiListApiKeys(token, sid));
  }

  async function onCreateTransfer(e: FormEvent) {
    e.preventDefault();
    if (!token || !isOwner || transferBusy) return;
    setErr(null);
    setMsg(null);
    setTransferBusy(true);
    try {
      const t = await apiOwnershipTransferCreate(token, sid, {
        target_email: transferToEmail,
        note: transferNote || undefined,
      });
      setTransferToEmail("");
      setTransferNote("");
      setTransfers((prev) => [t, ...prev.filter((x) => x.id !== t.id)]);
      setMsg("בקשת העברת בעלות נשלחה למשתמש היעד וממתינה לאישור שלו.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setTransferBusy(false);
    }
  }

  async function onCancelTransfer(requestId: number) {
    if (!token || transferBusy) return;
    setTransferBusy(true);
    setErr(null);
    try {
      const t = await apiOwnershipTransferCancel(token, requestId);
      setTransfers((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      setMsg("בקשת העברת הבעלות בוטלה.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setTransferBusy(false);
    }
  }

  const storePlatform = shopOut?.store_platform === "shopify" ? "shopify" : "wordpress";

  return (
    <>
      <p className="page-sub">
        מרווח הסריקה נקבע בדקות — לבדיקות אפשר 5–15 דקות; לייצור מומלץ שעות ומעלה.
      </p>
      {err && <p className="error">{err}</p>}
      {msg && <p className="text-muted">{msg}</p>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>תדירות סריקה (דקות)</h2>
        <p className="text-muted" style={{ marginTop: 0 }}>
          כל קישור מתחרה ייכנס לתור וייסרק מחדש לפחות כל כך זמן. הסורק הכללי רץ כל 15 שניות על{" "}
          <strong>קישור אחד</strong> בכל פעם.
        </p>
        <form onSubmit={saveInterval}>
          <div className="flex-row" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`btn sm secondary ${minutes === p ? "" : ""}`}
                style={
                  minutes === p
                    ? { outline: "2px solid var(--accent)", background: "var(--accent-soft)" }
                    : {}
                }
                onClick={() => setMinutes(p)}
              >
                {p < 60 ? `${p} דק׳` : p === 60 ? "שעה" : p === 360 ? "6 שעות" : "24 שעות"}
              </button>
            ))}
          </div>
          <div className="field">
            <label>ערך מותאם (דקות)</label>
            <input
              type="number"
              min={1}
              max={20160}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              style={{ maxWidth: 200 }}
            />
          </div>
          <button className="btn" type="submit">
            שמור מרווח
          </button>
        </form>
      </div>

      <div className="card mt-2">
        <h2 style={{ marginTop: 0 }}>התראות במערכת</h2>
        <p className="text-muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
          בחרו אילו סוגי התראות יוצגו לכם ברשימת ההתראות ובדשבורד. ההודעות נשמרות ביומן — רק התצוגה
          מסוננת לפי בחירתכם.
        </p>
        {notif && (
          <div className="settings-notif-grid">
            <label className="settings-notif-row">
              <input
                type="checkbox"
                checked={notif.notify_competitor_cheaper}
                onChange={(e) => void saveNotif({ notify_competitor_cheaper: e.target.checked })}
              />
              <span>
                <strong>המתחרה זול ממני</strong>
                <small className="text-muted">כשסריקה מזהה מחיר מתחרה נמוך יותר</small>
              </span>
            </label>
            <label className="settings-notif-row">
              <input
                type="checkbox"
                checked={notif.notify_price_change}
                onChange={(e) => void saveNotif({ notify_price_change: e.target.checked })}
              />
              <span>
                <strong>שינוי מחיר אצל מתחרה</strong>
                <small className="text-muted">כשמחיר המתחרה השתנה לעומת הסריקה הקודמת</small>
              </span>
            </label>
            <label className="settings-notif-row">
              <input
                type="checkbox"
                checked={notif.notify_auto_pricing}
                onChange={(e) => void saveNotif({ notify_auto_pricing: e.target.checked })}
              />
              <span>
                <strong>תמחור אוטומטי</strong>
                <small className="text-muted">עדכוני מחיר בקטלוג (Woo/Shopify) לפי כללי התמחור</small>
              </span>
            </label>
            <label className="settings-notif-row">
              <input
                type="checkbox"
                checked={notif.notify_sanity}
                onChange={(e) => void saveNotif({ notify_sanity: e.target.checked })}
              />
              <span>
                <strong>חשד למחיר לא סביר</strong>
                <small className="text-muted">כשסריקה נדחית בגלל סף אמינות</small>
              </span>
            </label>
            <label className="settings-notif-row">
              <input
                type="checkbox"
                checked={notif.notify_sale_live}
                onChange={(e) => void saveNotif({ notify_sale_live: e.target.checked })}
              />
              <span>
                <strong>התראת מכירה בלייב ל-WhatsApp</strong>
                <small className="text-muted">מיד כשמגיעה רכישה (Woo webhook או Shopify orders webhook)</small>
              </span>
            </label>
            <label className="settings-notif-row">
              <input
                type="checkbox"
                checked={notif.notify_sales_daily}
                onChange={(e) => void saveNotif({ notify_sales_daily: e.target.checked })}
              />
              <span>
                <strong>דוח מכירות יומי</strong>
                <small className="text-muted">סיכום מכירות והכנסות להיום ב-WhatsApp</small>
              </span>
            </label>
            <label className="settings-notif-row">
              <input
                type="checkbox"
                checked={notif.notify_sales_monthly}
                onChange={(e) => void saveNotif({ notify_sales_monthly: e.target.checked })}
              />
              <span>
                <strong>דוח מכירות חודשי</strong>
                <small className="text-muted">סיכום מכירות והכנסות לחודש הנוכחי ב-WhatsApp</small>
              </span>
            </label>
          </div>
        )}
      </div>

      {storePlatform === "wordpress" && (
        <div className="card mt-2">
          <h2 style={{ marginTop: 0 }}>WooCommerce REST</h2>
          <p className="text-muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
            מטבע התצוגה נשלף אוטומטית מהחנות ב־WooCommerce לאחר שמירת המפתחות או סנכרון מוצרים.
            {wooCurrency && (
              <>
                {" "}
                <strong>מטבע נוכחי: {wooCurrency}</strong>
              </>
            )}
          </p>
          <form onSubmit={saveWoo}>
            <div className="field">
              <label>כתובת אתר (כולל https)</label>
              <input value={site} onChange={(e) => setSite(e.target.value)} required />
            </div>
            <div className="field">
              <label>Consumer key</label>
              <input value={ck} onChange={(e) => setCk(e.target.value)} required />
            </div>
            <div className="field">
              <label>Consumer secret</label>
              <input value={cs} onChange={(e) => setCs(e.target.value)} required type="password" />
            </div>
            <button className="btn" type="submit">
              שמור והתחבר
            </button>
          </form>
        </div>
      )}

      {storePlatform === "shopify" && (
        <div className="card mt-2">
          <h2 style={{ marginTop: 0 }}>Shopify (Custom App)</h2>
          <p className="text-muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
            דומיין myshopify.com וטוקן Admin API. Client secret של האפליקציה נדרש לאימות webhook הזמנות
            (X-Shopify-Hmac-Sha256).
            {wooCurrency && (
              <>
                {" "}
                <strong>מטבע נוכחי: {wooCurrency}</strong>
              </>
            )}
          </p>
          <form onSubmit={(e) => void saveShopify(e)}>
            <div className="field">
              <label>דומיין חנות</label>
              <input
                className="input"
                placeholder="my-store.myshopify.com"
                value={shDomain}
                onChange={(e) => setShDomain(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Admin API access token</label>
              <input
                className="input"
                type="password"
                value={shToken}
                onChange={(e) => setShToken(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>גרסת API (אופציונלי)</label>
              <input className="input" placeholder="2024-10" value={shApiVer} onChange={(e) => setShApiVer(e.target.value)} />
            </div>
            <div className="field">
              <label>Client secret (לאימות webhook)</label>
              <input
                className="input"
                type="password"
                value={shClientSecret}
                onChange={(e) => setShClientSecret(e.target.value)}
              />
            </div>
            <button className="btn" type="submit">
              שמור ובדוק חיבור
            </button>
          </form>
          <p className="text-muted mt-2" style={{ fontSize: "0.88rem" }}>
            רשמו ב-Shopify Admin → הגדרות → התראות → Webhooks: כתובת{" "}
            <code>
              {"{API}"}/api/shops/{sid}/shopify/webhooks/orders
            </code>{" "}
            לאירועי Order creation (פורמט JSON).
          </p>
        </div>
      )}

      {storePlatform === "wordpress" && (
        <div className="card mt-2">
          <h2 style={{ marginTop: 0 }}>תוסף WordPress (חיבור אוטומטי)</h2>
          <p className="text-muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
            מומלץ להשתמש באשף ההקמה — הוא יוצר טוקן, מוריד תוסף עם ההגדרות, ומנחה לחיבור בלי להזין
            מפתחות ידנית.
          </p>
          <div className="flex-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to={`/app/${sid}/setup`}>
              אשף הקמת חנות
            </Link>
            <button type="button" className="btn secondary" onClick={() => void downloadConnectPlugin()}>
              הורדת תוסף (ZIP)
            </button>
          </div>
        </div>
      )}

      <div className="card mt-2">
        <h2 style={{ marginTop: 0 }}>חברי צוות</h2>
        <ul>
          {members.map((m) => (
            <li key={m.user_id}>
              {m.email} — {m.role}
            </li>
          ))}
        </ul>
        <form onSubmit={onInvite} className="flex-row">
          <input
            className="input"
            type="email"
            placeholder="אימייל להזמנה"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button className="btn secondary" type="submit">
            שלח הזמנה
          </button>
        </form>
      </div>

      <div className="card mt-2">
        <h2 style={{ marginTop: 0 }}>העברת בעלות חנות</h2>
        <p className="text-muted" style={{ marginTop: 0 }}>
          הבעלות עוברת רק אחרי שהמשתמש המקבל מאשר. עד לאישור — הכל נשאר אצל הבעלים הנוכחי.
        </p>
        {owner && (
          <p className="text-muted" style={{ marginTop: "-0.25rem", fontSize: "0.9rem" }}>
            בעלים נוכחי: <strong>{owner.email}</strong>
          </p>
        )}

        {!isOwner && (
          <div className="dash-banner" style={{ marginBottom: "0.75rem" }}>
            רק בעל החנות הנוכחי יכול לשלוח בקשת העברת בעלות.
          </div>
        )}

        {isOwner && (
          <form onSubmit={onCreateTransfer} className="transfer-form">
            <div className="field">
              <label>אימייל המשתמש שיקבל בעלות</label>
              <input
                type="email"
                className="input"
                value={transferToEmail}
                onChange={(e) => setTransferToEmail(e.target.value)}
                required
                disabled={!!pendingTransfer || transferBusy}
                placeholder="user@example.com"
              />
            </div>
            <div className="field">
              <label>הודעה למקבל (אופציונלי)</label>
              <textarea
                className="input"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                rows={3}
                maxLength={400}
                disabled={!!pendingTransfer || transferBusy}
                placeholder="לדוגמה: מעביר לך בעלות כי אתה מנהל החנות בפועל."
              />
            </div>
            <button className="btn secondary" type="submit" disabled={!!pendingTransfer || transferBusy}>
              {transferBusy ? "שולח…" : "שלח בקשת העברת בעלות"}
            </button>
          </form>
        )}

        {pendingTransfer && (
          <div className="transfer-pending">
            <p style={{ margin: 0 }}>
              בקשה ממתינה ל־<strong>{pendingTransfer.to_email}</strong> עד{" "}
              {new Date(pendingTransfer.expires_at).toLocaleString("he-IL")}.
            </p>
            {pendingTransfer.note && (
              <p className="text-muted" style={{ margin: "0.35rem 0 0" }}>
                הודעה: {pendingTransfer.note}
              </p>
            )}
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => void onCancelTransfer(pendingTransfer.id)}
              disabled={transferBusy}
            >
              בטל בקשה
            </button>
          </div>
        )}
      </div>

      <div className="card mt-2">
        <h2 style={{ marginTop: 0 }}>מפתחות API</h2>
        {shownKey && (
          <p>
            מפתח חדש (יוצג פעם אחת בלבד): <code>{shownKey}</code>
          </p>
        )}
        <form onSubmit={onCreateKey} className="flex-row">
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
          <button className="btn" type="submit">
            צור מפתח
          </button>
        </form>
        <div className="table-wrap mt-2">
          <table className="data-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>קידומת</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td>{k.prefix}</td>
                  <td>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={async () => {
                        if (!token) return;
                        await apiDeleteApiKey(token, sid, k.id);
                        setKeys(await apiListApiKeys(token, sid));
                      }}
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
