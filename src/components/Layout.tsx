import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, Terminal, Server, MessageSquare, Mail, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { useAuth } from '../contexts/AuthContext';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isEmailVerified, sendVerificationEmail } = useAuth();
  const systemStatus = useSystemStatus(6000);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  const isBackendOnline = systemStatus.backend === 'connected';
  const isWaConnected = systemStatus.whatsapp === 'connected';

  const handleSendVerification = async () => {
    setSendingVerification(true);
    setVerificationFeedback(null);
    try {
      const res = await sendVerificationEmail();
      setVerificationFeedback(res.message);
    } catch (e: any) {
      setVerificationFeedback(e.message || 'Erro ao enviar.');
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="flex h-screen bg-cyber-bg text-gray-300 font-mono overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden lg:ml-64 w-full">
        {/* Mobile Topbar with quick system health lights */}
        <header className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-cyber-card border-b border-cyber-cyan/20 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-cyber-cyan hover:bg-cyber-cyan/10 rounded-md transition-colors"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-cyber-green drop-shadow-[0_0_5px_rgba(0,255,157,0.8)]">
              FILTERBYKAKE
            </span>
          </div>

          {/* Quick status lights on mobile */}
          <Link to="/settings" className="flex items-center gap-2.5 bg-cyber-bg/80 px-2.5 py-1 rounded border border-cyber-cyan/20 text-[10px]">
            <div className="flex items-center gap-1" title={systemStatus.backend === 'connected' ? 'Backend Conectado' : systemStatus.backend === 'checking' ? 'Verificando Backend' : 'Backend Desconectado'}>
              <Server className="w-3 h-3 text-gray-400" />
              <div className={`w-1.5 h-1.5 rounded-full ${
                systemStatus.backend === 'connected' 
                  ? 'bg-cyber-green shadow-[0_0_4px_rgba(0,255,157,1)]' 
                  : systemStatus.backend === 'checking'
                  ? 'bg-cyber-yellow animate-pulse'
                  : 'bg-cyber-red'
              }`} />
            </div>

            <div className="w-px h-3 bg-cyber-cyan/20" />

            <div className="flex items-center gap-1" title={isWaConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}>
              <MessageSquare className="w-3 h-3 text-gray-400" />
              <div className={`w-1.5 h-1.5 rounded-full ${
                isWaConnected 
                  ? 'bg-cyber-green shadow-[0_0_4px_rgba(0,255,157,1)]' 
                  : 'bg-cyber-red'
              }`} />
            </div>
          </Link>
        </header>

        {/* Content area with Scroll */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden flex flex-col justify-between">
          <div className="max-w-7xl mx-auto w-full flex-1 pb-8 space-y-4">
            {/* Aviso de e-mail não verificado (Boas práticas e segurança) */}
            {user && !isEmailVerified && (
              <div className="p-3 bg-cyber-yellow/10 border border-cyber-yellow/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-cyber-yellow shrink-0" />
                  <div>
                    <span className="text-cyber-yellow font-bold">Verificação de E-mail:</span>{' '}
                    <span className="text-gray-300">
                      Seu e-mail ({user.email}) ainda não foi confirmado. Verifique sua caixa de entrada para garantir a segurança da conta e manter acesso contínuo.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {verificationFeedback ? (
                    <span className="text-[11px] text-cyber-green flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {verificationFeedback}
                    </span>
                  ) : (
                    <button
                      onClick={handleSendVerification}
                      disabled={sendingVerification}
                      className="px-2.5 py-1 bg-cyber-yellow/20 hover:bg-cyber-yellow/30 text-cyber-yellow border border-cyber-yellow/40 rounded transition-all flex items-center gap-1 text-[11px]"
                    >
                      {sendingVerification ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Mail className="w-3 h-3" />
                      )}
                      Reenviar E-mail
                    </button>
                  )}
                </div>
              </div>
            )}

            <Outlet />
          </div>

          {/* Cyberpunk System Footer */}
          <footer className="w-full border-t border-cyber-cyan/10 pt-4 pb-2 mt-auto text-center shrink-0">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                <Terminal className="w-3.5 h-3.5 text-cyber-cyan/60" />
                <span>FILTERBYKAKE // CYBERDASH ENTERPRISE v1.2</span>
              </div>

              {/* Required credit by <ogkake7/> */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="text-gray-500">by</span>
                <span className="text-cyber-green font-bold px-2 py-0.5 rounded bg-cyber-green/10 border border-cyber-green/30 tracking-wider font-mono">
                  &lt;ogkake7/&gt;
                </span>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
