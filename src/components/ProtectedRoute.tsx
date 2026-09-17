import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { CyberButton } from './CyberButton';

export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { user, role, loading, error, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-bg flex flex-col items-center justify-center font-mono text-cyber-cyan">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="animate-pulse tracking-widest">VERIFICANDO_SESSÃO...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cyber-bg flex flex-col items-center justify-center font-mono p-4">
        <div className="bg-cyber-card border border-cyber-red/50 p-8 rounded-lg max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-cyber-red mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">ACESSO_BLOQUEADO</h2>
          <p className="text-cyber-red/80 mb-6">{error}</p>
          <CyberButton variant="danger" onClick={signOut} className="w-full">
            FAZER LOGOUT
          </CyberButton>
        </div>
      </div>
    );
  }

  if (requireAdmin && role !== 'admin') {
    return (
      <div className="min-h-screen bg-cyber-bg flex flex-col items-center justify-center font-mono p-4">
        <div className="bg-cyber-card border border-cyber-yellow/50 p-8 rounded-lg max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-cyber-yellow mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">PERMISSÃO_NEGADA</h2>
          <p className="text-cyber-yellow/80 mb-6">Apenas usuários administradores podem acessar esta área.</p>
          <CyberButton variant="secondary" onClick={() => window.history.back()} className="w-full">
            VOLTAR
          </CyberButton>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
