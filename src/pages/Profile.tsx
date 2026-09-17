import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Clock, 
  Activity, 
  Send, 
  Database, 
  LogOut, 
  CheckCircle2, 
  Camera, 
  Sparkles, 
  Edit3, 
  Save, 
  Calendar,
  AlertCircle,
  Server,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CyberButton } from '../components/CyberButton';
import { updateProfile } from 'firebase/auth';
import { useSystemStatus } from '../hooks/useSystemStatus';

const CYBER_AVATARS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
];

export function Profile() {
  const { user, role, signOut, getIdToken } = useAuth();
  const systemStatus = useSystemStatus(4000);
  
  const [displayName, setDisplayName] = useState(user?.displayName || user?.email?.split('@')[0] || 'Operador');
  const [isEditingName, setIsEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL || CYBER_AVATARS[0]);
  const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // User Stats
  const [stats, setStats] = useState({
    totalSearches: 0,
    totalDispatches: 0,
    totalLeads: 0,
    lastActive: 'Agora'
  });

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
    if (user?.photoURL) {
      setAvatarUrl(user.photoURL);
    }

    // Load user activity stats from server / local storage
    const loadStats = async () => {
      try {
        const token = await getIdToken();
        if (!token) return;

        const res = await fetch('/api/searches', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const searches = data.searches || [];
          const totalCollected = searches.reduce((acc: number, curr: any) => acc + (curr.itemCount || 0), 0);
          
          setStats(prev => ({
            ...prev,
            totalSearches: searches.length,
            totalLeads: totalCollected,
            lastActive: searches.length > 0 && searches[0].startedAt 
              ? new Date(searches[0].startedAt).toLocaleString('pt-BR') 
              : new Date().toLocaleDateString('pt-BR')
          }));
        }
      } catch (e) {
        console.warn("Erro ao carregar estatísticas do usuário:", e);
      }
    };

    loadStats();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateProfile(user, {
        displayName: displayName.trim(),
        photoURL: avatarUrl
      });

      // Also persist in local profile storage
      localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify({
        displayName: displayName.trim(),
        photoURL: avatarUrl,
        updatedAt: new Date().toISOString()
      }));

      setIsEditingName(false);
      setIsSelectingAvatar(false);
      setFeedback({ type: 'success', message: 'Perfil atualizado com sucesso no sistema!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao salvar perfil: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            MEU<span className="text-cyber-green">_PERFIL</span>
          </h1>
          <p className="text-xs md:text-sm text-cyber-cyan/70">
            Painel do operador, credenciais ativas, identidade visual e histórico de atividade.
          </p>
        </div>

        <CyberButton
          variant="danger"
          onClick={signOut}
          className="flex items-center gap-2 text-xs py-2 px-4 self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          Encerrar Sessão
        </CyberButton>
      </header>

      {feedback && (
        <div className={`p-4 rounded-lg flex items-center gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green' 
            : 'bg-cyber-red/10 border-cyber-red/40 text-cyber-red'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-mono">{feedback.message}</span>
        </div>
      )}

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Identity & Card (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#0b101b] border-2 border-cyber-cyan/30 rounded-xl p-6 relative overflow-hidden shadow-[0_0_25px_rgba(0,229,255,0.1)] space-y-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-cyan/5 rounded-full blur-2xl pointer-events-none" />
            
            {/* Avatar & Badges */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative group">
                <img 
                  src={avatarUrl} 
                  alt="Avatar do Usuário" 
                  className="w-28 h-28 rounded-full object-cover border-2 border-cyber-green p-1 bg-cyber-bg shadow-[0_0_15px_rgba(0,255,157,0.4)]"
                />
                <button
                  onClick={() => setIsSelectingAvatar(!isSelectingAvatar)}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-cyber-card border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan hover:text-black transition-colors"
                  title="Alterar Avatar"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Avatar Selector Tray */}
              {isSelectingAvatar && (
                <div className="p-3 bg-cyber-bg border border-cyber-cyan/30 rounded-lg space-y-2 w-full animate-in zoom-in-95 duration-150">
                  <span className="text-[11px] text-gray-400 font-mono block">Selecione um Avatar Cyber:</span>
                  <div className="flex justify-center gap-2">
                    {CYBER_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setAvatarUrl(url)}
                        className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${
                          avatarUrl === url ? 'border-cyber-green scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="Cyber avatar option" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <CyberButton variant="primary" onClick={handleSaveProfile} disabled={saving} className="w-full text-xs py-1 mt-2">
                    Salvar Avatar
                  </CyberButton>
                </div>
              )}

              <div>
                <h3 className="text-lg md:text-xl font-bold text-white font-mono flex items-center justify-center gap-2">
                  {displayName}
                  <button 
                    onClick={() => setIsEditingName(!isEditingName)} 
                    className="text-gray-400 hover:text-cyber-cyan"
                    title="Editar Nome"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </h3>
                <p className="text-xs text-cyber-cyan/80 font-mono mt-0.5">{user?.email}</p>
              </div>

              {/* Role & Status Pill */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                  role === 'admin'
                    ? 'bg-cyber-yellow/15 text-cyber-yellow border-cyber-yellow/40 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                    : 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/40'
                }`}>
                  <Shield className="w-3.5 h-3.5" />
                  Cargo: {role === 'admin' ? 'Administrador' : 'Operador'}
                </span>

                <span className="px-3 py-1 rounded-full text-xs font-mono bg-cyber-green/15 text-cyber-green border border-cyber-green/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                  Sessão Ativa
                </span>
              </div>
            </div>

            {/* Name Edit Mode */}
            {isEditingName && (
              <div className="p-3 bg-cyber-bg border border-cyber-cyan/30 rounded-lg space-y-2">
                <label className="text-[11px] text-gray-400 font-mono block">Nome de Exibição:</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 bg-[#050811] border border-cyber-cyan/40 rounded px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-cyber-green"
                  />
                  <CyberButton variant="primary" onClick={handleSaveProfile} disabled={saving} className="text-xs py-1.5 px-3 flex items-center gap-1">
                    <Save className="w-3.5 h-3.5" />
                    Salvar
                  </CyberButton>
                </div>
              </div>
            )}

            {/* Credentials details */}
            <div className="border-t border-cyber-cyan/15 pt-4 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyber-cyan" /> E-mail Oficial:
                </span>
                <span className="text-white truncate max-w-[190px]">{user?.email}</span>
              </div>

              <div className="flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyber-green" /> UID do Sistema:
                </span>
                <span className="text-gray-400 text-[10px] truncate max-w-[160px]">{user?.uid}</span>
              </div>

              <div className="flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyber-yellow" /> Provedor de Auth:
                </span>
                <span className="text-cyber-green">Firebase Identity</span>
              </div>
            </div>

            {/* Prontidão Operacional Real (Sessão, Backend, WhatsApp) */}
            <div className="border-t border-cyber-cyan/15 pt-4 space-y-2 font-mono">
              <h4 className="text-[11px] font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Prontidão Operacional
              </h4>
              
              <div className="space-y-2 text-xs bg-[#050811] p-3 rounded border border-cyber-cyan/15">
                {/* 1. Sessão */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyber-cyan" /> Sessão:
                  </span>
                  <span className="text-cyber-green font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyber-green shadow-[0_0_6px_rgba(0,255,157,1)]" />
                    Ativa
                  </span>
                </div>

                {/* 2. Backend */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-cyber-cyan" /> Backend API:
                  </span>
                  <span className={`font-bold flex items-center gap-1 ${
                    systemStatus.backend === 'connected' ? 'text-cyber-green' : 'text-cyber-red'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      systemStatus.backend === 'connected' 
                        ? 'bg-cyber-green shadow-[0_0_6px_rgba(0,255,157,1)]' 
                        : 'bg-cyber-red shadow-[0_0_6px_rgba(255,0,85,1)] animate-pulse'
                    }`} />
                    {systemStatus.backend === 'connected' ? 'Conectado' : 'Indisponível'}
                  </span>
                </div>

                {/* 3. WhatsApp */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-cyber-green" /> WhatsApp:
                    </span>
                    <span className={`font-bold flex items-center gap-1 ${
                      systemStatus.whatsapp === 'connected' ? 'text-cyber-green' : 'text-cyber-red'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        systemStatus.whatsapp === 'connected' 
                          ? 'bg-cyber-green shadow-[0_0_6px_rgba(0,255,157,1)]' 
                          : 'bg-cyber-red shadow-[0_0_6px_rgba(255,0,85,1)]'
                      }`} />
                      {systemStatus.whatsapp === 'connected' ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                  {systemStatus.whatsapp === 'connected' && systemStatus.whatsappPhone && (
                    <span className="text-[10px] text-cyber-cyan font-bold text-right pl-4">
                      {systemStatus.whatsappPhone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity History & Metrics (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#0b101b] border border-cyber-cyan/20 rounded-lg p-4 font-mono text-center">
              <span className="text-[10px] text-gray-400 block uppercase">Buscas Realizadas</span>
              <span className="text-2xl font-bold text-cyber-green block my-1">
                {stats.totalSearches}
              </span>
              <span className="text-[10px] text-cyber-cyan">execuções Apify</span>
            </div>

            <div className="bg-[#0b101b] border border-cyber-cyan/20 rounded-lg p-4 font-mono text-center">
              <span className="text-[10px] text-gray-400 block uppercase">Total Leads Capturados</span>
              <span className="text-2xl font-bold text-cyber-cyan block my-1">
                {stats.totalLeads}
              </span>
              <span className="text-[10px] text-gray-400">empresas catalogadas</span>
            </div>

            <div className="bg-[#0b101b] border border-cyber-cyan/20 rounded-lg p-4 font-mono text-center">
              <span className="text-[10px] text-gray-400 block uppercase">Última Atividade</span>
              <span className="text-xs font-bold text-white block my-2 truncate">
                {stats.lastActive}
              </span>
              <span className="text-[10px] text-cyber-green">status sincronizado</span>
            </div>
          </div>

          {/* Activity Timeline Card */}
          <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-5 space-y-4 font-mono">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2 border-b border-cyber-cyan/15 pb-2">
              <Activity className="w-4 h-4 text-cyber-green" />
              Histórico Recente de Ações do Operador
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#080d17] border border-cyber-cyan/15 rounded-lg flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyber-green" />
                    <strong className="text-white">Sessão Autenticada</strong>
                    <span className="text-[10px] text-cyber-green font-mono">[Online]</span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Operador autenticado com ID token verificado e permissões de perfil ({role}).
                  </p>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">Hoje</span>
              </div>

              <div className="p-3 bg-[#080d17] border border-cyber-cyan/15 rounded-lg flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyber-cyan" />
                    <strong className="text-white">Permissões de Backend & Disparos</strong>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Acesso liberado a disparo de campanhas, gerenciamento de templates e exportação de relatórios.
                  </p>
                </div>
                <span className="text-[10px] text-cyber-cyan shrink-0">Ativo</span>
              </div>

              <div className="p-3 bg-[#080d17] border border-cyber-cyan/15 rounded-lg flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyber-yellow" />
                    <strong className="text-white">Conexão WhatsApp Baileys</strong>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Sessão embutida local para disparos com intervalo randômico de proteção contra bloqueios.
                  </p>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">Configurado</span>
              </div>
            </div>
          </div>

          {/* Quick Security Notice */}
          <div className="p-4 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded-lg flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-cyber-green shrink-0 mt-0.5" />
            <div className="text-xs text-gray-300 font-mono space-y-1">
              <strong className="text-white block">Dica de Segurança:</strong>
              <p>
                Para alterar a senha ou gerenciar métodos de login, utilize o fluxo de autenticação do Firebase. 
                Sempre encerre sua sessão em computadores públicos antes de desconectar.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
