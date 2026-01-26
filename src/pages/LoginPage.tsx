/**
 * LoginPage - User login page
 * OWNER: Dev Team
 */

import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/workspace');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Sign In</h1>

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
            placeholder="Enter your email"
            required
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            data-testid="password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            placeholder="Enter your password"
            required
          />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button
          type="submit"
          data-testid="login-button"
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {}),
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>

        <p style={styles.linkText}>
          Don't have an account?{' '}
          <a href="/register" style={styles.link}>
            Create one
          </a>
        </p>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  form: {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    padding: '32px',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '24px',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    color: '#d4d4d4',
    fontSize: '14px',
    marginBottom: '6px',
  },
  input: {
    backgroundColor: '#2d2d2d',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    padding: '10px 12px',
    width: '100%',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    backgroundColor: '#007acc',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '12px 20px',
    cursor: 'pointer',
    width: '100%',
    fontSize: '14px',
    fontWeight: 500,
    marginTop: '8px',
  },
  buttonDisabled: {
    backgroundColor: '#4a4a4a',
    cursor: 'not-allowed',
  },
  error: {
    color: '#f14c4c',
    fontSize: '13px',
    marginTop: '8px',
    marginBottom: '8px',
    padding: '8px',
    backgroundColor: 'rgba(241, 76, 76, 0.1)',
    borderRadius: '4px',
  },
  linkText: {
    color: '#808080',
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '16px',
  },
  link: {
    color: '#007acc',
    textDecoration: 'none',
  },
};
