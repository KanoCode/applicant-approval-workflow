import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand" style={{ textDecoration: 'none' }}>
        <span className="mark">CW-01</span>
        <h1>Casework</h1>
      </Link>
      {user && (
        <div className="topbar__user">
          <span>{user.name}</span>
          <span className="topbar__role-chip">{user.role}</span>
          <button className="topbar__signout" onClick={logout}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
