import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  Activity, 
  Search, 
  Radio, 
  Database, 
  FileText, 
  Send, 
  Settings,
  User,
  HelpCircle,
  LogOut, 
  X,
  ChevronRight,
  Server,
  MessageSquare,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useSystemStatus } from '../hooks/useSystemStatus';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { role, signOut, user } = useAuth();
  const systemStatus = useSystemStatus(5000);

  const links = [
    { to: '/', icon: Activity, label: 'Dashboard' },
    { to: '/search', icon: Search, label: 'Nova Busca' },
    { to: '/monitoring', icon: Radio, label: 'Monitoramento' },
    { to: '/leads', icon: Database, label: 'Leads Capturados' },
    { to: '/templates', icon: FileText, label: 'Templates' },
    { to: '/campaigns', icon: Send, label: 'Disparos' },
    { to: '/profile', icon: User, label: 'Meu Perfil' },
    { to: '/help', icon: HelpCircle, label: 'Ajuda' },
  ];

  if (role === 'admin') {
    links.push({ to: '/admin/users', icon: Users, label: 'Histórico de Usuários' });
    links.push({ to: '/settings', icon: Settings, label: 'Configurações' });
  }

  const isBackendOnline = systemStatus.backend === 'connected';
  const isWaConnected = systemStatus.whatsapp === 'connected';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside className={cn(
        "w-64 bg-cyber-card border-r border-cyber-cyan/20 h-screen flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out font-mono",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-5 border-b border-cyber-cyan/20 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-cyber-green drop-shadow-[0_0_5px_rgba(0,255,157,0.8)] flex items-center gap-2">
              <Activity className="w-6 h-6" />
              FILTERBYKAKE
            </h1>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-white p-1"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200",
                      isActive 
                        ? "bg-cyber-cyan/10 text-cyber-cyan border-l-2 border-cyber-cyan shadow-[inset_4px_0_10px_rgba(0,229,255,0.1)] font-bold" 
                        : "text-gray-400 hover:text-cyber-cyan hover:bg-cyber-cyan/5"
                    )
                  }
                >
                  <link.icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs md:text-sm">{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* PERSISTENT SYSTEM INDICATORS (Sessão, Backend, WhatsApp) */}
        <div className="p-3 border-t border-cyber-cyan/20 space-y-2 bg-[#060a12]/80 shrink-0">
          
          <div className="p-2.5 bg-cyber-bg rounded-lg border border-cyber-cyan/15 space-y-2">
            {/* 1. Sessão Ativa */}
            <Link
              to="/profile"
              onClick={onClose}
              className="flex items-center justify-between group hover:opacity-90 transition-opacity"
              title="Acessar Meu Perfil"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-2 h-2 rounded-full bg-cyber-green shadow-[0_0_8px_rgba(0,255,157,1)] shrink-0"></div>
                <div className="truncate">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Sessão Ativa</span>
                  <span className="text-xs text-cyber-cyan font-bold truncate block max-w-[150px]">
                    {user?.displayName || user?.email}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyber-cyan transition-colors shrink-0" />
            </Link>

            <div className="border-t border-cyber-cyan/10 pt-2 space-y-1.5 text-[11px]">
              {/* 2. Backend Health Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-400">Backend:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    systemStatus.backend === 'connected' 
                      ? 'bg-cyber-green shadow-[0_0_6px_rgba(0,255,157,0.9)]' 
                      : systemStatus.backend === 'checking'
                      ? 'bg-cyber-yellow animate-pulse'
                      : 'bg-cyber-red shadow-[0_0_6px_rgba(255,0,85,0.9)]'
                  }`} />
                  <span className={`font-bold ${
                    systemStatus.backend === 'connected' 
                      ? 'text-cyber-green' 
                      : systemStatus.backend === 'checking'
                      ? 'text-cyber-yellow'
                      : 'text-cyber-red'
                  }`}>
                    {systemStatus.backend === 'connected' 
                      ? 'Conectado' 
                      : systemStatus.backend === 'checking'
                      ? 'Checando...'
                      : 'Desconectado'}
                  </span>
                </div>
              </div>

              {/* 3. WhatsApp Real Status */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400">WhatsApp:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      isWaConnected 
                        ? 'bg-cyber-green shadow-[0_0_6px_rgba(0,255,157,0.9)]' 
                        : 'bg-cyber-red shadow-[0_0_6px_rgba(255,0,85,0.9)]'
                    }`} />
                    <span className={`font-bold ${isWaConnected ? 'text-cyber-green' : 'text-cyber-red'}`}>
                      {isWaConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>

                {/* Show connected phone number if connected */}
                {isWaConnected && systemStatus.whatsappPhone && (
                  <div className="text-[10px] text-cyber-cyan font-bold text-right pl-4 truncate">
                    {systemStatus.whatsappPhone}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Sign out button */}
          <button 
            onClick={signOut}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs text-cyber-red border border-cyber-red/30 rounded-md hover:bg-cyber-red/10 transition-colors font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            FINALIZAR SESSÃO
          </button>
        </div>
      </aside>
    </>
  );
}
