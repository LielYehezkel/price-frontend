import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { UserSessionBar } from "../components/UserSessionBar";
import {
  apiCreateShop,
  apiListShops,
  apiOwnershipTransferApprove,
  apiOwnershipTransferDecline,
  apiOwnershipTransferIncoming,
  type OwnershipTransferRow,
  type ShopOut,
} from "../api/apiSaaS";

export function ShopListPage() {
  const { token } = useAuth();
  const [shops, setShops] = useState<ShopOut[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<OwnershipTransferRow[]>([]);
  const [transferBusyId, setTransferBusyId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [storePlatform, setStorePlatform] = useState<"wordpress" | "shopify">("wordpress");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    const [allShops, incoming] = await Promise.all([
      apiListShops(token),
      apiOwnershipTransferIncoming(token),
    ]);
    setShops(allShops);
    setIncomingTransfers(incoming.filter((r) => r.status === "pending"));
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    try {
      await apiCreateShop(token, { name, store_platform: storePlatform });
      setName("");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    }
  }

  async function onApproveTransfer(requestId: number) {
    if (!token) return;
    setTransferBusyId(requestId);
    setErr(null);
    setMsg(null);
    try {
      await apiOwnershipTransferApprove(token, requestId);
      await load();
      setMsg("הבעלות אושרה והועברה אליך בהצלחה.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setTransferBusyId(null);
    }
  }

  async function onDeclineTransfer(requestId: number) {
    if (!token) return;
    setTransferBusyId(requestId);
    setErr(null);
    setMsg(null);
    try {
      await apiOwnershipTransferDecline(token, requestId);
      await load();
      setMsg("בקשת ההעברה נדחתה.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setTransferBusyId(null);
    }
  }

  return (
    <div className="content-area" style={{ maxWidth: 960 }}>
      <div className="shop-list-session-strip">
        <UserSessionBar />
      </div>

      <div className="shop-list-hero">
        <h1>החנויות שלך</h1>
        <p>ניהול מרכזי של מעקב מחירים מול מתחרים — בחרו חנות כדי להיכנס לדשבורד.</p>
      </div>
      {msg && <p className="text-muted">{msg}</p>}
      {err && <p className="error">{err}</p>}

      {incomingTransfers.length > 0 && (
        <div className="card shop-transfer-inbox" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>בקשות העברת בעלות שממתינות לאישור שלך</h2>
          <p className="text-muted" style={{ marginTop: "-0.25rem" }}>
            ברגע אישור — אתה הופך לבעלים של החנות, והבעלים הקודם נשאר חבר צוות.
          </p>
          <div className="shop-transfer-inbox__list">
            {incomingTransfers.map((t) => (
              <div key={t.id} className="shop-transfer-inbox__item">
                <div>
                  <div>
                    <strong>{t.shop_name}</strong> · נשלח על ידי {t.from_email}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.86rem" }}>
                    נוצר: {new Date(t.created_at).toLocaleString("he-IL")} · פג תוקף:{" "}
                    {new Date(t.expires_at).toLocaleString("he-IL")}
                  </div>
                  {t.note && <div className="text-muted">הודעה: {t.note}</div>}
                </div>
                <div className="flex-row" style={{ gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={transferBusyId === t.id}
                    onClick={() => void onApproveTransfer(t.id)}
                  >
                    {transferBusyId === t.id ? "מאשר…" : "אשר בעלות"}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={transferBusyId === t.id}
                    onClick={() => void onDeclineTransfer(t.id)}
                  >
                    דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <form onSubmit={onCreate} className="flex-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="שם חנות חדשה"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: 1, minWidth: 200 }}
          />
          <select
            className="input"
            style={{ minWidth: 160 }}
            value={storePlatform}
            onChange={(e) => setStorePlatform(e.target.value as "wordpress" | "shopify")}
            aria-label="פלטפורמת חנות"
          >
            <option value="wordpress">WordPress / WooCommerce</option>
            <option value="shopify">Shopify</option>
          </select>
          <button className="btn" type="submit">
            צור חנות
          </button>
        </form>
      </div>

      <div className="card mt-2">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>פלטפורמה</th>
                <th>מרווח סריקה</th>
                <th>חיבור קטלוג</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>{s.store_platform === "shopify" ? "Shopify" : "WordPress"}</td>
                  <td>{s.check_interval_minutes} דק׳</td>
                  <td>
                    {s.store_platform === "shopify" ? (
                      s.shopify_configured ? (
                        <span className="badge success">Shopify מחובר</span>
                      ) : (
                        <span className="badge neutral">Shopify לא מחובר</span>
                      )
                    ) : s.woocommerce_configured ? (
                      <span className="badge success">Woo מחובר</span>
                    ) : (
                      <span className="badge neutral">Woo לא מחובר</span>
                    )}
                  </td>
                  <td className="flex-row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                    <Link className="btn sm secondary" to={`/app/${s.id}/setup`}>
                      הקמת חנות
                    </Link>
                    <Link className="btn sm" to={`/app/${s.id}/dashboard`}>
                      כניסה לחנות
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shops.length === 0 && (
          <p className="text-muted">עדיין אין חנויות — צרו אחת למעלה.</p>
        )}
      </div>
    </div>
  );
}
