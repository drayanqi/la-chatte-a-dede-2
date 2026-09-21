/**
 * Header - Main toolbar with user menu
 * OWNER: Dev Team
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface HeaderProps {
  /** True when all 5 lineup slots have a script assigned (story 3.2 AC #7) */
  lineupComplete: boolean;
  /** True while a practice match simulation is running (blocks double-start) */
  isSimulating: boolean;
  /** Start a practice match (story 3.5 wiring) */
  onStartPractice: () => void;
  /** Open the ranked matchmaking view (Epic 4 v2, story 4.3 wiring) */
  onOpenRanked: () => void;
  /** Open the public leaderboard view (story 4.5 wiring) */
  onOpenLeaderboard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lineupComplete,
  isSimulating,
  onStartPractice,
  onOpenRanked,
  onOpenLeaderboard,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const userSectionRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

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
    <header style={styles.header}>
      <div style={styles.logo}>
        <span style={styles.logoIcon}>⚽</span>
        <span style={styles.logoText}>Lachatadede</span>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.startPracticeGroup}>
          <button
            data-testid="test-vs-bot-button"
            style={{
              ...styles.button,
              ...(!lineupComplete || isSimulating ? styles.buttonDisabled : {}),
            }}
            onClick={onStartPractice}
            disabled={!lineupComplete || isSimulating}
          >
            ▶ Test vs Bot
          </button>
          <button
            data-testid="ranked-nav-button"
            style={styles.button}
            onClick={onOpenRanked}
          >
            ⚔ Ranked
          </button>
          <button
            data-testid="leaderboard-nav-button"
            style={styles.button}
            onClick={onOpenLeaderboard}
          >
            🏆 Leaderboard
          </button>
          {!lineupComplete && (
            <span data-testid="lineup-incomplete-message" style={styles.helperMessage}>
              Assign AIs to all 5 positions
            </span>
          )}
        </div>
      </div>

      <div style={styles.spacer} />

      {isAuthenticated && user && (
        <div style={styles.userSection} ref={userSectionRef}>
          <button
            data-testid="user-menu"
            style={styles.userButton}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span style={styles.userAvatar}>
              {user.username.charAt(0).toUpperCase()}
            </span>
            <span style={styles.userName}>{user.username}</span>
            <span style={styles.chevron}>▼</span>
          </button>

          {menuOpen && (
            <div style={styles.dropdown} role="menu">
              <div style={styles.dropdownHeader}>
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
  startPracticeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  buttonDisabled: {
    backgroundColor: '#3c3c3c',
    color: '#808080',
    cursor: 'not-allowed',
  },
  helperMessage: {
    fontSize: '12px',
    color: '#808080',
    whiteSpace: 'nowrap',
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
