/**
 * Header - Main toolbar with user menu
 * OWNER: Winston (Software Architect)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface HeaderProps {
  onRunSimulation: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRunSimulation }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={styles.header}>
      <div style={styles.logo}>
        <span style={styles.logoIcon}>⚽</span>
        <span style={styles.logoText}>Lachatadede</span>
      </div>

      <div style={styles.toolbar}>
        <button style={styles.button} onClick={onRunSimulation}>
          ▶ Simulate
        </button>
        <button style={styles.buttonSecondary}>
          💾 Save
        </button>
        <button style={styles.buttonSecondary}>
          📂 Load
        </button>
      </div>

      <div style={styles.spacer} />

      {isAuthenticated && user && (
        <div style={styles.userSection}>
          <button
            data-testid="user-menu"
            style={styles.userButton}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span style={styles.userAvatar}>
              {user.username.charAt(0).toUpperCase()}
            </span>
            <span style={styles.userName}>{user.username}</span>
            <span style={styles.chevron}>▼</span>
          </button>

          {menuOpen && (
            <div style={styles.dropdown}>
              <div style={styles.dropdownHeader}>
                <div style={styles.userEmail}>{user.email}</div>
                <div style={styles.userPoints}>{user.points} pts</div>
              </div>
              <div style={styles.dropdownDivider} />
              <button
                data-testid="logout-button"
                style={styles.dropdownItem}
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    height: '48px',
    padding: '0 16px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3c3c3c',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoIcon: {
    fontSize: '24px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  toolbar: {
    display: 'flex',
    gap: '8px',
    marginLeft: '32px',
  },
  button: {
    padding: '6px 16px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  buttonSecondary: {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  spacer: {
    flex: 1,
  },
  userSection: {
    position: 'relative',
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  userAvatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    backgroundColor: '#007acc',
    color: '#ffffff',
    borderRadius: '50%',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  userName: {
    color: '#ffffff',
  },
  chevron: {
    fontSize: '10px',
    color: '#808080',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: '0',
    marginTop: '4px',
    minWidth: '200px',
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
  dropdownHeader: {
    padding: '12px',
  },
  userEmail: {
    color: '#d4d4d4',
    fontSize: '13px',
    marginBottom: '4px',
  },
  userPoints: {
    color: '#808080',
    fontSize: '12px',
  },
  dropdownDivider: {
    height: '1px',
    backgroundColor: '#3c3c3c',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    color: '#d4d4d4',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
  },
};
