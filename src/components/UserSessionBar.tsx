import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Props = {
  /** מסתיר את שורת האימייל (למשל כשכבר מוצג למעלה) */
  hideEmail?: boolean;
};

/**
 * פעולות סשן אחידות: חשבון, ניווט בין אפליקציה לניהול, התנתקות.
 * מיועד ל־topbar או לכותרת עמודים עצמאיים (חשבון / רשימת חנויות).
 */
export function UserSessionBar({ hideEmail }: Props) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const onAccount = loc.pathname === "/account";
  const inAdmin = loc.pathname.startsWith("/admin");

  return (
    <div className="user-session-bar" role="navigation" aria-label="משתמש מחובר">
      {!hideEmail && (
        <span className="user-session-email" title={user?.email ?? ""}>
          {user?.email}
        </span>
      )}

      {onAccount ? (
        <span className="user-session-pill user-session-pill--current">חשבון</span>
      ) : (
        <NavLink to="/account" className="user-session-link">
          חשבון
        </NavLink>
      )}

      <NavLink
        to="/shops"
        end
        className={({ isActive }) =>
          isActive ? "user-session-link user-session-link--active" : "user-session-link"
        }
      >
        החנויות שלי
      </NavLink>

      {user?.is_admin && !inAdmin && (
        <NavLink to="/admin" className="user-session-link user-session-link--accent">
          פאנל ניהול
        </NavLink>
      )}

      {user?.is_admin && inAdmin && (
        <NavLink to="/shops" className="user-session-link">
          חזרה לאפליקציה
        </NavLink>
      )}

      <button
        type="button"
        className="btn secondary sm user-session-logout"
        onClick={() => logout()}
      >
        התנתק
      </button>
    </div>
  );
}
