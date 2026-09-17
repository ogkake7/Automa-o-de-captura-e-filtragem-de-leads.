import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Lock, Mail, AlertTriangle, Loader2 } from 'lucide-react';
import { CyberButton } from '../components/CyberButton';
import { CyberInput } from '../components/CyberInput';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            setError('Credenciais inválidas. Verifique seu e-mail e senha.');
            break;
          case 'auth/too-many-requests':
            setError('Muitas tentativas falhas. Tente novamente mais tarde.');
            break;
          default:
            setError(`Erro na autenticação: ${err.message}`);
        }
      } else {
        setError('Ocorreu um erro inesperado.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        if (err.code !== 'auth/popup-closed-by-user') {
          setError(`Erro no login com Google: ${err.message}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center font-mono p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Activity className="w-16 h-16 text-cyber-green drop-shadow-[0_0_10px_rgba(0,255,157,0.8)] mb-4" />
          <h1 className="text-4xl font-bold text-white tracking-widest">FILTERBY<span className="text-cyber-green">KAKE</span></h1>
          <p className="text-cyber-cyan/70 mt-2 text-sm tracking-widest uppercase">System Authentication</p>
        </div>

        <div className="bg-cyber-card border border-cyber-cyan/30 p-8 rounded-lg shadow-[0_0_30px_rgba(0,229,255,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent opacity-50"></div>
          
          {error && (
            <div className="mb-6 p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-md flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-cyber-red shrink-0 mt-0.5" />
              <p className="text-sm text-cyber-red">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div className="relative">
              <div className="absolute left-3 top-9 text-cyber-cyan/50"><Mail className="w-4 h-4" /></div>
              <CyberInput 
                label="Identificação (E-mail)" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@filterbykake.com"
                className="pl-9"
                required
              />
            </div>
            
            <div className="relative">
              <div className="absolute left-3 top-9 text-cyber-cyan/50"><Lock className="w-4 h-4" /></div>
              <CyberInput 
                label="Senha de Acesso" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
                required
              />
            </div>

            <CyberButton 
              type="submit" 
              className="w-full mt-6 py-3 flex justify-center items-center gap-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'AUTENTICAR SESSÃO'}
            </CyberButton>
          </form>

          <div className="mt-8 pt-6 border-t border-cyber-cyan/20">
            <CyberButton 
              variant="secondary"
              type="button" 
              onClick={handleGoogleLogin}
              className="w-full flex justify-center items-center gap-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ENTRAR COM GOOGLE SSO'}
            </CyberButton>
          </div>
        </div>
        
        <div className="text-center mt-6 text-xs text-gray-500 uppercase">
          Acesso restrito a membros autorizados.<br/>Logs de auditoria ativos.
        </div>
      </div>
    </div>
  );
}
