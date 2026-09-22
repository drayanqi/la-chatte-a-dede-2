/**
 * RegisterPage - User registration page (La Ronde identity, story 7.8)
 * OWNER: Dev Team
 *
 * Auth pages have no Appbar (unauthenticated routes): the acard carries the
 * DD crest + wordmark itself. Client-side validation strings ('Passwords do
 * not match', 'Password must be at least 8 characters') are asserted
 * verbatim by the e2e — never reword them here.
 */

import { useState, FormEvent, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import watermarkUrl from '@/assets/watermark.png';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const { register, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  const from = (location.state as { from?: string } | null)?.from || '/play';

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    // Client-side password validation
    if (password !== confirmPassword) {
      useAuthStore.setState({ error: 'Passwords do not match' });
      return;
    }

    if (password.length < 8) {
      useAuthStore.setState({ error: 'Password must be at least 8 characters' });
      return;
    }

    await register(email, password, confirmPassword, name);
  };

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.crest}>
          <img src={watermarkUrl} alt="DD" style={styles.crestMark} />
          <span style={styles.crestName}>LACHATADEDE</span>
        </div>
        <h1 style={styles.title}>Créer un compte</h1>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="name">
            Nom d'entraîneur
          </label>
          <input
            id="name"
            type="text"
            data-testid="name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            placeholder="Pelo"
            autoComplete="nickname"
            required
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            data-testid="email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="ton@email.fr"
            autoComplete="email"
            required
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            data-testid="password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            required
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="confirmPassword">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            data-testid="confirm-password-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="register-button"
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {}),
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Création...' : 'Créer le compte'}
        </button>

        <p style={styles.linkText}>
          Déjà un compte ?{' '}
          <Link to="/login" style={styles.link}>
            Connecte-toi
          </Link>
        </p>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: '26px',
    boxShadow: 'var(--shadow-lg)',
    padding: '36px 32px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
  },
  crest: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '9px',
    marginBottom: '18px',
  },
  crestMark: {
    width: '30px',
    height: '30px',
    objectFit: 'contain',
  },
  crestName: {
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: 'var(--ink)',
  },
  title: {
    color: 'var(--ink)',
    fontSize: '24px',
    fontWeight: 800,
    marginBottom: '24px',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    color: 'var(--muted)',
    fontSize: '13px',
    fontWeight: 700,
    marginBottom: '6px',
  },
  input: {
    backgroundColor: 'var(--panel2)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--ink)',
    padding: '11px 13px',
    width: '100%',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--r-btn)',
    padding: '12px 20px',
    cursor: 'pointer',
    width: '100%',
    fontSize: '14px',
    fontWeight: 800,
    marginTop: '8px',
    boxShadow: 'var(--shadow)',
  },
  buttonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  error: {
    color: 'var(--corail)',
    fontSize: '13px',
    fontWeight: 600,
    marginTop: '8px',
    marginBottom: '8px',
    padding: '9px 12px',
    backgroundColor: 'rgba(255, 107, 87, 0.1)',
    border: '1px solid rgba(255, 107, 87, 0.35)',
    borderRadius: 'var(--r-sm)',
  },
  linkText: {
    color: 'var(--muted)',
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '16px',
  },
  link: {
    color: 'var(--corail)',
    fontWeight: 700,
    textDecoration: 'none',
  },
};
