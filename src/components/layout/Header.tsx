/**
 * Header - Barre d'outils principale
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

interface HeaderProps {
  onRunSimulation: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRunSimulation }) => {
  return (
    <header style={styles.header}>
      <div style={styles.logo}>
        <span style={styles.logoIcon}>⚽</span>
        <span style={styles.logoText}>Lachatadede</span>
      </div>

      <div style={styles.toolbar}>
        <button style={styles.button} onClick={onRunSimulation}>
          ▶ Simuler
        </button>
        <button style={styles.buttonSecondary}>
          💾 Sauvegarder
        </button>
        <button style={styles.buttonSecondary}>
          📂 Charger
        </button>
      </div>

      <div style={styles.spacer} />
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
};
