/**
 * App - Application entry point with routing (La Ronde, story 7.2)
 *
 * Three real activity routes (play / teams / match), the ladder pages and
 * the auth pages. `/` opens the lobby.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  RegisterPage,
  LoginPage,
  PlayPage,
  TeamsPage,
  MatchPage,
  PalmaresPage,
  LeaderboardPage,
  GuidePage,
} from './pages';
import { ProtectedRoute } from './components/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';

function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const initTheme = useThemeStore((state) => state.init);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/play"
            element={
              <ProtectedRoute>
                <PlayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <TeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/match/:id"
            element={
              <ProtectedRoute>
                <MatchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/palmares"
            element={
              <ProtectedRoute>
                <PalmaresPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/classement"
            element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guide"
            element={
              <ProtectedRoute>
                <GuidePage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/play" replace />} />
          <Route path="*" element={<Navigate to="/play" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
