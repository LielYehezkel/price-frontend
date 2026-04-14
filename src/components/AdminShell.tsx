import { NavLink, Outlet } from "react-router-dom";
import { UserSessionBar } from "./UserSessionBar";

export function AdminShell() {
  return (
    <div className="layout-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          פאנל ניהול
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-section">לוח בקרה</div>
          <NavLink to="/admin" end>
            סקירה
          </NavLink>
          <NavLink to="/admin/scan-engine" className="sidebar-nav-priority">
            מנוע סריקות
          </NavLink>
          <NavLink to="/admin/operations">יומן תפעול</NavLink>
          <NavLink to="/admin/system">שרת ותקשורת</NavLink>
          <div className="sidebar-nav-section">ניהול</div>
          <NavLink to="/admin/domains">בדיקת דומיינים</NavLink>
          <NavLink to="/admin/users">ניהול משתמשים</NavLink>
          <NavLink to="/admin/packages">חבילות SaaS</NavLink>
          <NavLink to="/admin/tool">כלי מחיר</NavLink>
          <NavLink to="/admin/price-sanity">סף אמינות</NavLink>
        </nav>
      </aside>

      <div className="layout-main">
        <header className="topbar topbar--with-session">
          <span className="topbar-title">ניהול מערכת</span>
          <UserSessionBar />
        </header>
        <nav className="mobile-nav">
          <NavLink to="/admin" end>
            סקירה
          </NavLink>
          <NavLink to="/admin/scan-engine">סריקות</NavLink>
          <NavLink to="/admin/operations">לוג</NavLink>
          <NavLink to="/admin/system">שרת</NavLink>
          <NavLink to="/admin/domains">דומיינים</NavLink>
          <NavLink to="/admin/users">משתמשים</NavLink>
          <NavLink to="/admin/packages">חבילות</NavLink>
          <NavLink to="/admin/tool">כלי מחיר</NavLink>
          <NavLink to="/admin/price-sanity">סף</NavLink>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
