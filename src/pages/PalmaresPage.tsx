/**
 * PalmaresPage - Trophies & records (story 7.2 placeholder)
 *
 * The community trophies table needs a dedicated API; until it exists this
 * route renders an honest empty state in the La Ronde identity.
 */

import { Appbar } from '@/components/layout/Appbar';

export const PalmaresPage: React.FC = () => {
  return (
    <div style={styles.page}>
      <Appbar />
      <div style={styles.body}>
        <div style={styles.card}>
          <h1 style={styles.title}>Palmarès</h1>
          <p style={styles.sub}>
            Trophées et records de la communauté — bientôt sur cet écran.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    overflow: 'auto',
  },
  card: {
    width: '680px',
    maxWidth: '100%',
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow-lg)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '13px',
    textAlign: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'var(--ink)',
  },
  sub: {
    color: 'var(--muted)',
    fontSize: '12.5px',
    lineHeight: 1.5,
  },
};
