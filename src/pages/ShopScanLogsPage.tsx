import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiScanLogs, type ScanLogRow } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

const PAGE_SIZE = 40;

export function ShopScanLogsPage() {
  const { shopId } = useParams();
  const { token } = useAuth();
  const sid = Number(shopId);
  const [rows, setRows] = useState<ScanLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || Number.isNaN(sid)) return;
    setLoading(true);
    setErr(null);
    const skip = page * PAGE_SIZE;
    void apiScanLogs(token, sid, skip, PAGE_SIZE)
      .then((res) => {
        setRows(res.items);
        setTotal(res.total);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "שגיאה"))
      .finally(() => setLoading(false));
  }, [token, sid, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <p className="page-sub">
        כל סריקה מתועדת — השוואת המחיר שלך מול מחיר המתחרה (לפי דומיין), וזיהוי שינוי במחיר אצל
        המתחרה.
      </p>
      {err && <p className="error">{err}</p>}
      <div className="flex-between" style={{ marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <span className="text-muted" style={{ fontSize: "0.9rem" }}>
          {loading ? "טוען…" : `סה״כ ${total} רשומות — עמוד ${page + 1} מתוך ${totalPages}`}
        </span>
        <div className="flex-row" style={{ gap: "0.35rem" }}>
          <button
            type="button"
            className="btn secondary sm"
            disabled={page <= 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            הקודם
          </button>
          <button
            type="button"
            className="btn secondary sm"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            הבא
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>תאריך ושעה</th>
              <th>מוצר</th>
              <th>דומיין מתחרה</th>
              <th>המחיר שלך</th>
              <th>מחיר מתחרה</th>
              <th>שינוי אצל מתחרה</th>
              <th>השוואה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td>{r.product_name}</td>
                <td>
                  <code style={{ fontSize: "0.8rem" }}>{r.competitor_domain}</code>
                </td>
                <td>{r.our_price != null ? r.our_price.toFixed(2) : "—"}</td>
                <td>{r.competitor_price != null ? r.competitor_price.toFixed(2) : "—"}</td>
                <td>
                  {r.price_changed ? (
                    <span className="badge warn">כן</span>
                  ) : (
                    <span className="badge neutral">לא</span>
                  )}
                </td>
                <td>
                  <span className={`log-comparison ${r.comparison}`}>{r.comparison_label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !err && !loading && (
          <p style={{ padding: "1rem" }} className="text-muted">
            עדיין אין סריקות מתועדות — הן יופיעו אוטומטית אחרי ריצת הסורק.
          </p>
        )}
      </div>
    </>
  );
}
