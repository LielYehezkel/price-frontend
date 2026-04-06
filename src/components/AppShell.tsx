import { NavLink, Outlet, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { UserSessionBar } from "./UserSessionBar";

const titles: Record<string, string> = {
  dashboard: "דשבורד",
  products: "מוצרים ומתחרים",
  alerts: "התראות",
  settings: "הגדרות",
  logs: "יומן סריקות",
  setup: "הקמת חנות",
  analytics: "השפעה ומכירות",
};

export function AppShell() {
  const { shopId } = useParams();
  const { user } = useAuth();
  const loc = useLocation();
  const seg = loc.pathname.split("/").pop() || "dashboard";
  const title = titles[seg] ?? "חנות";

  const sid = shopId ?? "";
  const base = `/app/${sid}`;

  return (
    <div className="layout-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          PriceIntel
        </div>
        <nav className="sidebar-nav">
          <NavLink to={`${base}/dashboard`} end={false}>
            דשבורד
          </NavLink>
          <NavLink to={`${base}/products`}>מוצרים ומתחרים</NavLink>
          <NavLink to={`${base}/analytics`}>השפעה ומכירות</NavLink>
          <NavLink to={`${base}/logs`}>יומן סריקות</NavLink>
          <NavLink to={`${base}/alerts`}>התראות</NavLink>
          <NavLink to={`${base}/settings`}>הגדרות</NavLink>
          <NavLink to={`${base}/setup`}>הקמת חנות</NavLink>
          <NavLink to="/shops">כל החנויות</NavLink>
          {user?.is_admin && <NavLink to="/admin">פאנל ניהול</NavLink>}
        </nav>
      </aside>

      <div className="layout-main">
        <header className="topbar topbar--with-session">
          <span className="topbar-title">{title}</span>
          <UserSessionBar />
        </header>
        <nav className="mobile-nav">
          <NavLink to={`${base}/dashboard`}>דשבורד</NavLink>
          <NavLink to={`${base}/products`}>מוצרים</NavLink>
          <NavLink to={`${base}/analytics`}>מכירות</NavLink>
          <NavLink to={`${base}/logs`}>לוגים</NavLink>
          <NavLink to={`${base}/alerts`}>התראות</NavLink>
          <NavLink to={`${base}/settings`}>הגדרות</NavLink>
          <NavLink to={`${base}/setup`}>הקמה</NavLink>
          {user?.is_admin && <NavLink to="/admin">ניהול</NavLink>}
        </nav>
        <div className="content-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
