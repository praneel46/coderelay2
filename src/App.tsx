import React from 'react';
import AppRouter from './router/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { CompetitionProvider } from './context/CompetitionContext';

export default function App() {
  return (
    <AuthProvider>
      <CompetitionProvider>
        <AppRouter />
      </CompetitionProvider>
    </AuthProvider>
  );
}
