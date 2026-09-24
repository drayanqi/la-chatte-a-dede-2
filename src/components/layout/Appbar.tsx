/**
 * Appbar - La Ronde floating rounded navigation capsule (story 7.1)
 * OWNER: Dev Team
 */

import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import watermarkUrl from '@/assets/watermark.png';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const NAV_LINKS = [
  { to: '/play', label: 'Jouer', testid: 'nav-play' },
  { to: '/teams', label: 'Équipes', testid: 'nav-teams' },
  { to: '/palmares', label: 'Palmarès', testid: 'nav-palmares' },
  { to: '/classement', label: 'Classement', testid: 'nav-leaderboard' },
  { to: '/guide', label: 'Guide', testid: 'nav-guide' },
];

export const Appbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const userSectionRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();

  // Close the dropdown on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (userSectionRef.current && !userSectionRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  return (
    <header style={styles.appbar}>
      <NavLink to="/play" style={styles.logo} aria-label="LACHATADEDE — accueil">
        <img src={watermarkUrl} alt="DD" style={styles.logoMark} />
        LACHATADEDE
      </NavLink>

      <nav style={styles.nav} aria-label="Navigation principale">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            data-testid={link.testid}
            style={({ isActive }) => ({
              ...styles.navlink,
              ...(isActive ? styles.navlinkActive : {}),
            })}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div style={styles.spacer} />

      <button
        type="button"
        data-testid="theme-toggle"
        style={styles.iconbtn}
        onClick={toggle}
        aria-label={theme === 'light' ? 'Activer le thème sombre' : 'Activer le thème clair'}
        title={theme === 'light' ? 'Thème sombre' : 'Thème clair'}
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      {isAuthenticated && user && (
        <div style={styles.userSection} ref={userSectionRef}>
          <button
            data-testid="user-menu"
            style={styles.avatar}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={user.username}
          >
            <span style={styles.avatarInitial}>{user.username.charAt(0).toUpperCase()}</span>
            <span style={styles.userNameShort}>{user.username}</span>
          </button>

          {menuOpen && (
            <div style={styles.dropdown} role="menu">
              <div style={styles.dropdownHeader}>
                <div style={styles.userName}>{user.username}</div>
                <div style={styles.userEmail}>{user.email}</div>
                <div style={styles.userPoints}>{user.points} pts</div>
              </div>
              <div style={styles.dropdownDivider} />
              <button
                data-testid="logout-button"
                style={styles.dropdownItem}
                onClick={handleLogout}
                role="menuitem"
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  appbar: {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '8px 8px 0',
    height: '52px',
    padding: '0 14px',
    background: 'var(--panel)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow)',
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.06em',
    color: 'var(--ink)',
    textDecoration: 'none',
  },
  logoMark: {
    width: '24px',
    height: '24px',
    objectFit: 'contain',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  navlink: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
    padding: '7px 13px',
    borderRadius: '11px',
    textDecoration: 'none',
  },
  navlinkActive: {
    color: 'var(--ink)',
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  spacer: {
    flex: 1,
  },
  iconbtn: {
    width: '32px',
    height: '32px',
    borderRadius: '11px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '14px',
    color: 'var(--muted)',
  },
  userSection: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  avatar: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    height: '32px',
    padding: '0 11px 0 3px',
    borderRadius: '16px',
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--ink)',
  },
  avatarInitial: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'var(--sun)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '12px',
    color: '#12241b',
  },
  userNameShort: {
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: '200px',
    background: 'var(--panel)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)',
    padding: '7px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    zIndex: 1000,
  },
  dropdownHeader: {
    padding: '10px 12px',
  },
  userName: {
    fontWeight: 700,
    fontSize: '13px',
    color: 'var(--ink)',
  },
  userEmail: {
    color: 'var(--muted)',
    fontSize: '12px',
    marginTop: '2px',
  },
  userPoints: {
    color: 'var(--muted)',
    fontSize: '11px',
    marginTop: '4px',
    fontFamily: 'var(--mono)',
  },
  dropdownDivider: {
    height: '1px',
    background: 'var(--line)',
  },
  dropdownItem: {
    textAlign: 'left',
    padding: '9px 12px',
    borderRadius: '11px',
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'var(--corail)',
  },
};
