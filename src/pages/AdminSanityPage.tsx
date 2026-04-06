import { FormEvent, useEffect, useState } from "react";
import { apiAdminGetPriceSanity, apiAdminPatchPriceSanity, type PriceSanitySettings } from "../api/apiSaaS";
import { useAuth } from "../auth/AuthContext";

export function AdminSanityPage() {
  const { token } = useAuth();
  const [cfg, setCfg] = useState<PriceSanitySettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [absMin, setAbsMin] = useState("0.01");
  const [absMax, setAbsMax] = useState("999999");
  const [vsPrev, setVsPrev] = useState("5");
  const [vsOurs, setVsOurs] = useState("15");

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const c = await apiAdminGetPriceSanity(token);
        setCfg(c);
        setEnabled(c.enabled);
        setAbsMin(String(c.abs_min));
        setAbsMax(String(c.abs_max));
        setVsPrev(String(c.vs_prev_max_multiplier));
        setVsOurs(String(c.vs_ours_max_multiplier));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    })();
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setSaving(true);
    try {
      const abs_min = parseFloat(absMin.replace(",", "."));
      const abs_max = parseFloat(absMax.replace(",", "."));
      const vs_prev_max_multiplier = parseFloat(vsPrev.replace(",", "."));
      const vs_ours_max_multiplier = parseFloat(vsOurs.replace(",", "."));
      if (![abs_min, abs_max, vs_prev_max_multiplier, vs_ours_max_multiplier].every(Number.isFinite)) {
        setErr("יש למלא מספרים תקינים");
        return;
      }
      const next = await apiAdminPatchPriceSanity(token, {
        enabled,
        abs_min,
        abs_max,
        vs_prev_max_multiplier,
        vs_ours_max_multiplier,
      });
      setCfg(next);
      setMsg("הגדרות נשמרו");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-area" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>סף אמינות מחירים</h1>
      <p className="text-muted">
        מחירי מתחרים חריגים (ביחס למחיר הקודם או למחיר שלכם) נרשמים ביומן כ־&quot;נדחה&quot; ולא
        מתעדכנים כמחיר נוכחי. כאן ניתן לכוון את הטווחים.
      </p>
      {cfg && (
        <p className="text-muted" style={{ fontSize: "0.9rem" }}>
          עדכון אחרון: {new Date(cfg.updated_at).toLocaleString("he-IL")}
        </p>
      )}
      {err && <p className="error">{err}</p>}
      {msg && <p className="text-muted">{msg}</p>}

      <form onSubmit={onSave} className="card">
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            הפעלת בדיקת אמינות
          </label>
        </div>
        <div className="field">
          <label>מחיר מינימום מוחלט</label>
          <input value={absMin} onChange={(e) => setAbsMin(e.target.value)} />
        </div>
        <div className="field">
          <label>מחיר מקסימום מוחלט</label>
          <input value={absMax} onChange={(e) => setAbsMax(e.target.value)} />
        </div>
        <div className="field">
          <label>מכפיל מקסימלי מול מחיר מתחרה קודם (למשל 5 ⇒ טווח עד פי 5)</label>
          <input value={vsPrev} onChange={(e) => setVsPrev(e.target.value)} />
        </div>
        <div className="field">
          <label>מכפיל מקסימלי מול מחיר המוצר אצלכם</label>
          <input value={vsOurs} onChange={(e) => setVsOurs(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "שומר…" : "שמור"}
        </button>
      </form>
    </div>
  );
}
