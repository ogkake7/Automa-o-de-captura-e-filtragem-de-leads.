import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  User, 
  Database, 
  Folder, 
  FolderOpen, 
  Search, 
  Filter, 
  Download, 
  ArrowLeft, 
  ExternalLink, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  ChevronRight,
  Phone,
  PhoneOff,
  Star,
  Globe,
  X,
  Layers,
  Info
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lead, TeamUser } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { CyberButton } from '../components/CyberButton';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

export function UserHistory() {
  const { user: currentAdminUser, role } = useAuth();

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search in users list
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');

  // Selected User for Drilldown (null = Master List of Users)
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);

  // Drilldown View State: 'FOLDERS' | 'ALL_LEADS' | 'PROJECT_LEADS'
  const [drilldownView, setDrilldownView] = useState<'FOLDERS' | 'ALL_LEADS' | 'PROJECT_LEADS'>('FOLDERS');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Filters inside user's leads view
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [websiteFilter, setWebsiteFilter] = useState<'ALL' | 'NO_SITE' | 'HAS_SITE'>('ALL');
  const [whatsappFilter, setWhatsappFilter] = useState<'ALL' | 'WITH_WHATSAPP' | 'NO_WHATSAPP'>('ALL');
  const [ratingFilter, setRatingFilter] = useState<'ALL' | 'LOW_RATING' | 'HIGH_RATING'>('ALL');

  // Selected lead for detail inspection modal
  const [inspectingLead, setInspectingLead] = useState<Lead | null>(null);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-clear feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // 1. Listen to teamUsers
  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'teamUsers'),
      (snap) => {
        const list: TeamUser[] = [];
        snap.forEach((d) => {
          list.push({ uid: d.id, ...d.data() } as TeamUser);
        });
        setTeamUsers(list);
      },
      (err) => {
        console.warn('Erro ao carregar teamUsers:', err);
        handleFirestoreError(err, OperationType.LIST, 'teamUsers');
      }
    );

    return () => unsubUsers();
  }, []);

  // 2. Listen to all leads (Admin has permission to list leads)
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'leads'), orderBy('capturedAt', 'desc'));
    const unsubLeads = onSnapshot(
      q,
      (snap) => {
        const list: Lead[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Lead);
        });
        setAllLeads(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao ler leads para visão consolidada:', err);
        setError(`Erro ao carregar histórico de leads: ${err.message}`);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'leads');
      }
    );

    return () => unsubLeads();
  }, []);

  // 3. Consolidate Users: Combine Firestore teamUsers with any accounts found in leads
  const consolidatedUsers = useMemo(() => {
    const map = new Map<string, {
      uid: string;
      email: string;
      displayName: string;
      role: 'admin' | 'vendedor';
      lastLoginAt?: string;
      updatedAt?: string;
      photoURL?: string;
    }>();

    // Insert teamUsers
    teamUsers.forEach((u) => {
      map.set(u.uid, {
        uid: u.uid,
        email: u.email || 'sem-email@sistema.local',
        displayName: u.displayName || u.email?.split('@')[0] || 'Usuário',
        role: u.role || 'vendedor',
        lastLoginAt: u.lastLoginAt,
        updatedAt: u.updatedAt,
        photoURL: u.photoURL
      });
    });

    // Detect any user IDs from leads
    allLeads.forEach((l) => {
      const ownerId = l.capturedBy || l.createdBy || l.userId;
      if (ownerId && !map.has(ownerId)) {
        const isCurrent = ownerId === currentAdminUser?.uid;
        map.set(ownerId, {
          uid: ownerId,
          email: isCurrent ? (currentAdminUser?.email || 'Admin') : `Conta [${ownerId.slice(0, 8)}...]`,
          displayName: isCurrent ? (currentAdminUser?.displayName || 'Você (Admin)') : `Operador ${ownerId.slice(-4)}`,
          role: isCurrent ? 'admin' : 'vendedor',
          updatedAt: typeof l.capturedAt === 'string' ? l.capturedAt : undefined
        });
      }
    });

    // Ensure current admin user is always in the list
    if (currentAdminUser && !map.has(currentAdminUser.uid)) {
      map.set(currentAdminUser.uid, {
        uid: currentAdminUser.uid,
        email: currentAdminUser.email || '',
        displayName: currentAdminUser.displayName || currentAdminUser.email?.split('@')[0] || 'Administrador',
        role: 'admin',
        lastLoginAt: new Date().toISOString()
      });
    }

    return Array.from(map.values());
  }, [teamUsers, allLeads, currentAdminUser]);

  // 4. Calculate stats per user
  const userStats = useMemo(() => {
    const statsMap = new Map<string, {
      leadsCount: number;
      foldersCount: number;
      folders: Array<{
        id: string;
        name: string;
        count: number;
        withoutSiteCount: number;
        latestDate?: string | number;
      }>;
      withoutSiteCount: number;
      latestActivity?: string;
    }>();

    consolidatedUsers.forEach((u) => {
      // Find all leads belonging to this user
      const userLeads = allLeads.filter((l) => {
        const ownerId = l.capturedBy || l.createdBy || l.userId;
        if (ownerId) return ownerId === u.uid;
        return u.role === 'admin';
      });

      // Group into folders/projects
      const foldersMap = new Map<string, {
        id: string;
        name: string;
        count: number;
        withoutSiteCount: number;
        latestDate?: string | number;
      }>();

      let noSiteTotal = 0;
      let latestCaptureDate: string | undefined;

      userLeads.forEach((l) => {
        const proj = l.projectName || (l.searchId ? `Lote ${l.searchId.slice(-6)}` : 'Geral (Sem Pasta)');
        const key = l.searchId || proj;
        const current = foldersMap.get(key) || {
          id: key,
          name: proj,
          count: 0,
          withoutSiteCount: 0,
          latestDate: l.capturedAt
        };

        current.count++;
        if (l.semSite) {
          current.withoutSiteCount++;
          noSiteTotal++;
        }
        if (l.capturedAt) {
          current.latestDate = l.capturedAt;
          if (!latestCaptureDate || String(l.capturedAt) > latestCaptureDate) {
            latestCaptureDate = String(l.capturedAt);
          }
        }
        foldersMap.set(key, current);
      });

      statsMap.set(u.uid, {
        leadsCount: userLeads.length,
        foldersCount: foldersMap.size,
        folders: Array.from(foldersMap.values()),
        withoutSiteCount: noSiteTotal,
        latestActivity: latestCaptureDate || u.lastLoginAt || u.updatedAt
      });
    });

    return statsMap;
  }, [consolidatedUsers, allLeads]);

  // Overall consolidated metrics
  const systemTotals = useMemo(() => {
    let totalLeads = allLeads.length;
    let totalFolders = 0;
    const allFolderKeys = new Set<string>();

    allLeads.forEach((l) => {
      const proj = l.projectName || (l.searchId ? `Lote ${l.searchId.slice(-6)}` : 'Geral');
      allFolderKeys.add(l.searchId || proj);
    });
    totalFolders = allFolderKeys.size;

    return {
      usersCount: consolidatedUsers.length,
      totalLeads,
      totalFolders
    };
  }, [allLeads, consolidatedUsers]);

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return consolidatedUsers;
    const q = userSearchTerm.toLowerCase();
    return consolidatedUsers.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.uid?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [consolidatedUsers, userSearchTerm]);

  // Get currently selected user for drilldown
  const activeUser = useMemo(() => {
    if (!selectedUserUid) return null;
    return consolidatedUsers.find((u) => u.uid === selectedUserUid) || null;
  }, [consolidatedUsers, selectedUserUid]);

  // Active user's leads
  const activeUserLeads = useMemo(() => {
    if (!selectedUserUid) return [];
    return allLeads.filter((l) => {
      const ownerId = l.capturedBy || l.createdBy || l.userId;
      if (ownerId) return ownerId === selectedUserUid;
      return activeUser?.role === 'admin';
    });
  }, [allLeads, selectedUserUid, activeUser]);

  // Active user's folders
  const activeUserFolders = useMemo(() => {
    if (!selectedUserUid) return [];
    return userStats.get(selectedUserUid)?.folders || [];
  }, [userStats, selectedUserUid]);

  // Active folder object
  const currentFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return activeUserFolders.find((f) => f.id === selectedFolderId) || null;
  }, [activeUserFolders, selectedFolderId]);

  // Visible leads for active user (filtered by folder, search, and status)
  const visibleUserLeads = useMemo(() => {
    return activeUserLeads.filter((lead) => {
      if (drilldownView === 'PROJECT_LEADS' && selectedFolderId) {
        const leadProjectKey = lead.searchId || lead.projectName || 'Geral (Sem Pasta)';
        if (leadProjectKey !== selectedFolderId) return false;
      }

      if (websiteFilter === 'NO_SITE' && !lead.semSite) return false;
      if (websiteFilter === 'HAS_SITE' && lead.semSite) return false;

      if (whatsappFilter === 'NO_WHATSAPP' && lead.whatsappStatus !== 'sem_whatsapp' && lead.whatsappStatus !== 'invalido') return false;
      if (whatsappFilter === 'WITH_WHATSAPP' && (lead.whatsappStatus === 'sem_whatsapp' || lead.whatsappStatus === 'invalido')) return false;

      if (ratingFilter === 'LOW_RATING' && (!lead.nota || lead.nota >= 4.0)) return false;
      if (ratingFilter === 'HIGH_RATING' && (!lead.nota || lead.nota < 4.0)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = lead.nome?.toLowerCase().includes(q);
        const matchesPhone = lead.telefone?.includes(q);
        const matchesCity = lead.cidade?.toLowerCase().includes(q);
        const matchesCat = lead.categoria?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesCity && !matchesCat) return false;
      }

      return true;
    });
  }, [activeUserLeads, drilldownView, selectedFolderId, websiteFilter, whatsappFilter, ratingFilter, searchQuery]);

  // Export handlers for active user's leads
  const exportUserCSV = (targetLeads: Lead[], fileNamePrefix = 'leads_usuario') => {
    if (targetLeads.length === 0) return;
    const headers = [
      'Nome', 'Categoria', 'Telefone', 'WhatsApp Status', 'Cidade', 'Estado',
      'Endereço', 'Site', 'Sem Site', 'Nota', 'Avaliações', 'Score',
      'Pasta/Projeto', 'Capturado Em'
    ];
    const rows = targetLeads.map((l) => [
      `"${(l.nome || '').replace(/"/g, '""')}"`,
      `"${(l.categoria || '').replace(/"/g, '""')}"`,
      `"${(l.telefone || '').replace(/"/g, '""')}"`,
      `"${(l.whatsappStatus || 'desconhecido').replace(/"/g, '""')}"`,
      `"${(l.cidade || '').replace(/"/g, '""')}"`,
      `"${(l.estado || '').replace(/"/g, '""')}"`,
      `"${(l.endereco || '').replace(/"/g, '""')}"`,
      `"${(l.site || '').replace(/"/g, '""')}"`,
      l.semSite ? 'SIM' : 'NAO',
      l.nota || '',
      l.avaliacoes || '',
      l.score || '',
      `"${(l.projectName || '').replace(/"/g, '""')}"`,
      l.capturedAt ? new Date(l.capturedAt).toLocaleString('pt-BR') : ''
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedback({ type: 'success', message: `${targetLeads.length} leads exportados com sucesso!` });
  };

  const exportUserJSON = (targetLeads: Lead[], fileNamePrefix = 'leads_usuario') => {
    if (targetLeads.length === 0) return;
    const jsonStr = JSON.stringify(targetLeads, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedback({ type: 'success', message: `${targetLeads.length} leads exportados em JSON!` });
  };

  // Helper for formatting date
  const formatActivityDate = (dateVal?: string | number) => {
    if (!dateVal) return 'Sem atividade recente';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateVal);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-mono">
      {/* Toast Feedback Notification */}
      {feedback && (
        <div className={`p-4 rounded-lg border text-sm font-mono flex items-center justify-between shadow-lg transition-all ${
          feedback.type === 'success'
            ? 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green'
            : 'bg-cyber-red/10 border-cyber-red/40 text-cyber-red'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 bg-cyber-red/10 border border-cyber-red/40 rounded-lg text-cyber-red text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: MASTER LIST OF USERS (CONSOLIDATED OVERVIEW)                       */}
      {/* ========================================================================= */}
      {!selectedUserUid && (
        <>
          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                  HISTÓRICO<span className="text-cyber-green">_DE_USUÁRIOS</span>
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> ADMIN_ONLY
                </span>
              </div>
              <p className="text-xs md:text-sm text-cyber-cyan/70">
                Visão consolidada de todas as contas, projetos e leads capturados no sistema.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-cyber-cyan/80 bg-cyber-card border border-cyber-cyan/20 px-3 py-1.5 rounded">
                Total de Contas: <strong className="text-white">{consolidatedUsers.length}</strong>
              </span>
            </div>
          </header>

          {/* Consolidated System Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-cyber-card border border-cyber-cyan/30 rounded-lg p-4 relative overflow-hidden">
              <div className="flex items-center justify-between text-cyber-cyan/80 text-xs mb-2">
                <span>CONTAS / OPERADORES</span>
                <Users className="w-4 h-4 text-cyber-cyan" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {systemTotals.usersCount}
              </div>
              <div className="text-[11px] text-cyber-cyan/60 mt-1">
                {consolidatedUsers.filter(u => u.role === 'admin').length} Administrador(es) / {consolidatedUsers.filter(u => u.role !== 'admin').length} Operador(es)
              </div>
            </div>

            <div className="bg-cyber-card border border-cyber-green/30 rounded-lg p-4 relative overflow-hidden">
              <div className="flex items-center justify-between text-cyber-green/80 text-xs mb-2">
                <span>TOTAL GERAL DE LEADS</span>
                <Database className="w-4 h-4 text-cyber-green" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-cyber-green">
                {systemTotals.totalLeads}
              </div>
              <div className="text-[11px] text-cyber-green/60 mt-1">
                Leads gravados em todas as contas
              </div>
            </div>

            <div className="bg-cyber-card border border-cyber-purple/30 rounded-lg p-4 relative overflow-hidden">
              <div className="flex items-center justify-between text-cyber-purple/80 text-xs mb-2">
                <span>PASTAS & PROJETOS</span>
                <Folder className="w-4 h-4 text-cyber-purple" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {systemTotals.totalFolders}
              </div>
              <div className="text-[11px] text-cyber-purple/60 mt-1">
                Lotes de busca organizados
              </div>
            </div>

            <div className="bg-cyber-card border border-cyber-yellow/30 rounded-lg p-4 relative overflow-hidden">
              <div className="flex items-center justify-between text-cyber-yellow/80 text-xs mb-2">
                <span>MÉDIA POR CONTA</span>
                <Clock className="w-4 h-4 text-cyber-yellow" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {systemTotals.usersCount > 0 ? Math.round(systemTotals.totalLeads / systemTotals.usersCount) : 0}
              </div>
              <div className="text-[11px] text-cyber-yellow/60 mt-1">
                Leads médios capturados por usuário
              </div>
            </div>
          </div>

          {/* Search bar for users */}
          <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-4">
            <div className="relative">
              <Search className="w-4 h-4 text-cyber-cyan absolute left-3 top-3" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Filtrar contas por nome, email, papel ou UID..."
                className="w-full bg-[#0d131f] border border-cyber-cyan/20 rounded pl-9 pr-4 py-2 text-xs md:text-sm text-white focus:border-cyber-green outline-none"
              />
            </div>
          </div>

          {/* Users Grid */}
          {loading ? (
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-12 text-center text-cyber-cyan">
              <div className="animate-spin w-8 h-8 border-2 border-cyber-green border-t-transparent rounded-full mx-auto mb-3" />
              Carregando contas e estatísticas consolidadas...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-12 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30 text-cyber-cyan" />
              <p className="text-sm">Nenhum usuário encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredUsers.map((u) => {
                const stats = userStats.get(u.uid) || {
                  leadsCount: 0,
                  foldersCount: 0,
                  folders: [],
                  withoutSiteCount: 0,
                  latestActivity: undefined
                };

                const isMe = u.uid === currentAdminUser?.uid;

                return (
                  <div 
                    key={u.uid}
                    className="bg-cyber-card border border-cyber-cyan/20 hover:border-cyber-green/50 rounded-lg p-5 flex flex-col justify-between transition-all group relative overflow-hidden"
                  >
                    <div>
                      {/* Top row: Avatar & Role badge */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cyber-bg border border-cyber-cyan/40 flex items-center justify-center font-bold text-cyber-green text-base shrink-0">
                            {u.displayName ? u.displayName.slice(0, 2).toUpperCase() : u.email.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                              {u.displayName}
                              {isMe && (
                                <span className="text-[10px] bg-cyber-green/20 text-cyber-green px-1.5 py-0.2 rounded border border-cyber-green/40">
                                  VOCÊ
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-cyber-cyan/80 truncate">{u.email}</p>
                          </div>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0 border ${
                          u.role === 'admin'
                            ? 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/40'
                            : 'bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/40'
                        }`}>
                          {u.role === 'admin' ? 'ADMIN' : 'OPERADOR'}
                        </span>
                      </div>

                      {/* UID info snippet */}
                      <div className="text-[11px] text-gray-500 bg-[#070b13] px-2.5 py-1 rounded border border-cyber-cyan/10 font-mono mb-4 truncate" title={u.uid}>
                        UID: <span className="text-gray-300">{u.uid}</span>
                      </div>

                      {/* User Metrics */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-[#0b101b] border border-cyber-cyan/10 rounded p-2.5">
                          <span className="text-[10px] text-cyber-cyan/70 block">LEADS CAPTURADOS</span>
                          <span className="text-lg font-bold text-cyber-green flex items-center gap-1">
                            <Database className="w-3.5 h-3.5" />
                            {stats.leadsCount}
                          </span>
                        </div>

                        <div className="bg-[#0b101b] border border-cyber-cyan/10 rounded p-2.5">
                          <span className="text-[10px] text-cyber-cyan/70 block">PASTAS / PROJETOS</span>
                          <span className="text-lg font-bold text-white flex items-center gap-1">
                            <Folder className="w-3.5 h-3.5 text-cyber-cyan" />
                            {stats.foldersCount}
                          </span>
                        </div>
                      </div>

                      {/* Pastas previews */}
                      {stats.folders.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[10px] text-gray-400 block mb-1.5 uppercase font-bold">
                            Projetos Principais:
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-hidden">
                            {stats.folders.slice(0, 4).map((f) => (
                              <span 
                                key={f.id} 
                                className="text-[11px] bg-cyber-bg border border-cyber-cyan/20 text-cyber-cyan px-2 py-0.5 rounded truncate max-w-[150px]"
                                title={`${f.name} (${f.count} leads)`}
                              >
                                📁 {f.name} <strong className="text-white">({f.count})</strong>
                              </span>
                            ))}
                            {stats.folders.length > 4 && (
                              <span className="text-[11px] text-gray-400 self-center">
                                +{stats.folders.length - 4} mais
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Latest Activity timestamp */}
                      <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mb-4">
                        <Clock className="w-3.5 h-3.5 text-cyber-cyan/60" />
                        <span>Última Atividade:</span>
                        <strong className="text-cyber-cyan/90">{formatActivityDate(stats.latestActivity)}</strong>
                      </div>
                    </div>

                    {/* Action Button: Open User History */}
                    <CyberButton
                      variant="primary"
                      onClick={() => {
                        setSelectedUserUid(u.uid);
                        setDrilldownView('FOLDERS');
                        setSelectedFolderId(null);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center justify-center gap-2 text-xs py-2 mt-2"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Acessar Histórico & Leads
                      <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                    </CyberButton>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: ISOLATED USER DRILLDOWN VIEW (PASTAS & LEADS DA CONTA ESCOLHIDA)  */}
      {/* ========================================================================= */}
      {selectedUserUid && activeUser && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top navigation back button & Account Isolation Banner */}
          <div className="bg-[#0b101b] border-2 border-cyber-cyan/40 rounded-lg p-4 shadow-[0_0_20px_rgba(0,255,249,0.1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <CyberButton
                variant="secondary"
                onClick={() => {
                  setSelectedUserUid(null);
                  setSelectedFolderId(null);
                  setDrilldownView('FOLDERS');
                }}
                className="flex items-center gap-2 text-xs text-cyber-green border-cyber-green/40 hover:bg-cyber-green/10"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar à Lista de Contas
              </CyberButton>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40 font-bold uppercase">
                    VISÃO ISOLADA DE CONTA
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                    activeUser.role === 'admin' 
                      ? 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/40' 
                      : 'bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/40'
                  }`}>
                    {activeUser.role === 'admin' ? 'ADMIN' : 'OPERADOR'}
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                  {activeUser.displayName} 
                  <span className="text-xs text-cyber-cyan font-normal font-mono">({activeUser.email})</span>
                </h2>
                <p className="text-[11px] text-gray-400">
                  UID: <code className="text-cyber-cyan/80">{activeUser.uid}</code> • Esta visualização permanece estritamente isolada e não interfere na sua tela pessoal.
                </p>
              </div>
            </div>

            {/* Quick Metrics of this user */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right bg-cyber-bg px-3 py-1.5 rounded border border-cyber-cyan/20">
                <span className="text-[10px] text-gray-400 block">LEADS DA CONTA</span>
                <span className="text-base font-bold text-cyber-green">{activeUserLeads.length}</span>
              </div>
              <div className="text-right bg-cyber-bg px-3 py-1.5 rounded border border-cyber-cyan/20">
                <span className="text-[10px] text-gray-400 block">PASTAS</span>
                <span className="text-base font-bold text-white">{activeUserFolders.length}</span>
              </div>
            </div>
          </div>

          {/* Sub-view switcher & Export actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cyber-card border border-cyber-cyan/20 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <CyberButton
                variant={drilldownView === 'FOLDERS' ? 'primary' : 'secondary'}
                onClick={() => {
                  setDrilldownView('FOLDERS');
                  setSelectedFolderId(null);
                }}
                className="flex items-center gap-1.5 text-xs py-1.5"
              >
                <Folder className="w-3.5 h-3.5" />
                Pastas & Projetos ({activeUserFolders.length})
              </CyberButton>

              <CyberButton
                variant={drilldownView === 'ALL_LEADS' ? 'primary' : 'secondary'}
                onClick={() => {
                  setDrilldownView('ALL_LEADS');
                  setSelectedFolderId(null);
                }}
                className="flex items-center gap-1.5 text-xs py-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                Ver Todos os Leads ({activeUserLeads.length})
              </CyberButton>

              {drilldownView === 'PROJECT_LEADS' && currentFolder && (
                <span className="text-xs text-cyber-green bg-cyber-green/10 border border-cyber-green/30 px-3 py-1.5 rounded flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Pasta: <strong className="text-white">{currentFolder.name}</strong>
                </span>
              )}
            </div>

            {/* Export buttons for this user's leads */}
            <div className="flex items-center gap-2">
              <CyberButton
                variant="secondary"
                onClick={() => exportUserCSV(
                  visibleUserLeads,
                  `leads_${activeUser.displayName?.replace(/\s+/g, '_') || 'usuario'}${currentFolder ? `_${currentFolder.name.replace(/\s+/g, '_')}` : ''}`
                )}
                disabled={visibleUserLeads.length === 0}
                className="flex items-center gap-1.5 text-xs py-1.5"
              >
                <Download className="w-3.5 h-3.5 text-cyber-green" />
                Exportar CSV ({visibleUserLeads.length})
              </CyberButton>

              <CyberButton
                variant="secondary"
                onClick={() => exportUserJSON(
                  visibleUserLeads,
                  `leads_${activeUser.displayName?.replace(/\s+/g, '_') || 'usuario'}${currentFolder ? `_${currentFolder.name.replace(/\s+/g, '_')}` : ''}`
                )}
                disabled={visibleUserLeads.length === 0}
                className="flex items-center gap-1.5 text-xs py-1.5"
              >
                <Download className="w-3.5 h-3.5 text-cyber-cyan" />
                JSON
              </CyberButton>
            </div>
          </div>

          {/* SUB-VIEW 1: FOLDERS OF THE SELECTED USER */}
          {drilldownView === 'FOLDERS' && (
            <div>
              {activeUserFolders.length === 0 ? (
                <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-12 text-center text-gray-400">
                  <Folder className="w-12 h-12 mx-auto mb-3 opacity-30 text-cyber-cyan" />
                  <p className="text-sm font-bold text-white mb-1">NENHUMA PASTA CAPTURADA POR ESTA CONTA</p>
                  <p className="text-xs text-gray-500">
                    O usuário {activeUser.email} ainda não realizou buscas ou capturas no Google Places.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeUserFolders.map((folder) => {
                    const noSitePercent = folder.count > 0 ? Math.round((folder.withoutSiteCount / folder.count) * 100) : 0;

                    return (
                      <div
                        key={folder.id}
                        className="bg-cyber-card border border-cyber-cyan/20 hover:border-cyber-cyan/60 rounded-lg p-5 flex flex-col justify-between transition-all group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="w-10 h-10 rounded bg-cyber-bg border border-cyber-cyan/30 flex items-center justify-center text-cyber-cyan group-hover:text-cyber-green group-hover:border-cyber-green/40 transition-colors">
                              <Folder className="w-5 h-5" />
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-cyber-green/15 text-cyber-green border border-cyber-green/30 font-bold">
                              {folder.count} leads
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white mb-1 group-hover:text-cyber-cyan transition-colors truncate">
                            {folder.name}
                          </h3>
                          <p className="text-[11px] text-gray-400 mb-4">
                            ID: <code className="text-cyber-cyan/70">{folder.id.slice(0, 16)}...</code>
                          </p>

                          <div className="space-y-1.5 text-xs text-gray-300 mb-4 bg-[#070b13] p-2.5 rounded border border-cyber-cyan/10">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Sem site:</span>
                              <span className="text-cyber-red font-bold">
                                {folder.withoutSiteCount} ({noSitePercent}%)
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Capturado em:</span>
                              <span className="text-cyber-cyan">{formatActivityDate(folder.latestDate)}</span>
                            </div>
                          </div>
                        </div>

                        <CyberButton
                          variant="primary"
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setDrilldownView('PROJECT_LEADS');
                          }}
                          className="w-full flex items-center justify-center gap-2 text-xs py-2"
                        >
                          <FolderOpen className="w-4 h-4" />
                          Explorar Leads desta Pasta
                        </CyberButton>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 2 & 3: LEADS TABLE (EITHER SPECIFIC FOLDER OR ALL LEADS OF THIS USER) */}
          {(drilldownView === 'PROJECT_LEADS' || drilldownView === 'ALL_LEADS') && (
            <div className="space-y-4">
              {/* Back to Folders link if in PROJECT_LEADS */}
              {drilldownView === 'PROJECT_LEADS' && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setDrilldownView('FOLDERS');
                      setSelectedFolderId(null);
                    }}
                    className="text-xs text-cyber-green flex items-center gap-1.5 hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para Pastas da Conta
                  </button>
                  <span className="text-xs text-gray-400">
                    Mostrando leads do projeto: <strong className="text-white">{currentFolder?.name}</strong>
                  </span>
                </div>
              )}

              {/* Filters & Search Toolbar */}
              <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  {/* Search text */}
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-cyber-cyan absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nome da empresa, telefone, categoria, cidade..."
                      className="w-full bg-[#0d131f] border border-cyber-cyan/20 rounded pl-9 pr-4 py-2 text-xs md:text-sm text-white focus:border-cyber-green outline-none"
                    />
                  </div>

                  {/* Filter: Website */}
                  <div className="flex items-center gap-1 bg-[#0d131f] p-1 rounded border border-cyber-cyan/20 text-xs">
                    <button
                      onClick={() => setWebsiteFilter('ALL')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        websiteFilter === 'ALL' ? 'bg-cyber-cyan/20 text-cyber-cyan font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setWebsiteFilter('NO_SITE')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        websiteFilter === 'NO_SITE' ? 'bg-cyber-red/20 text-cyber-red font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Sem Site
                    </button>
                    <button
                      onClick={() => setWebsiteFilter('HAS_SITE')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        websiteFilter === 'HAS_SITE' ? 'bg-cyber-green/20 text-cyber-green font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Com Site
                    </button>
                  </div>

                  {/* Filter: WhatsApp */}
                  <div className="flex items-center gap-1 bg-[#0d131f] p-1 rounded border border-cyber-cyan/20 text-xs">
                    <button
                      onClick={() => setWhatsappFilter('ALL')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        whatsappFilter === 'ALL' ? 'bg-cyber-cyan/20 text-cyber-cyan font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Whats: Todos
                    </button>
                    <button
                      onClick={() => setWhatsappFilter('WITH_WHATSAPP')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        whatsappFilter === 'WITH_WHATSAPP' ? 'bg-cyber-green/20 text-cyber-green font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Válidos
                    </button>
                    <button
                      onClick={() => setWhatsappFilter('NO_WHATSAPP')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        whatsappFilter === 'NO_WHATSAPP' ? 'bg-cyber-red/20 text-cyber-red font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Sem WhatsApp
                    </button>
                  </div>
                </div>
              </div>

              {/* Table of Leads */}
              <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg overflow-hidden">
                {visibleUserLeads.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <Database className="w-10 h-10 mx-auto mb-2 opacity-30 text-cyber-cyan" />
                    <p className="text-sm font-bold text-white">Nenhum lead encontrado com estes filtros.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-cyber-cyan/20 bg-[#070b13] text-cyber-cyan">
                          <th className="px-4 py-3 font-semibold">EMPRESA / CATEGORIA</th>
                          <th className="px-4 py-3 font-semibold">TELEFONE / WHATSAPP</th>
                          <th className="px-4 py-3 font-semibold">AVALIAÇÃO</th>
                          <th className="px-4 py-3 font-semibold">SITE</th>
                          <th className="px-4 py-3 font-semibold">LOCALIDADE / PASTA</th>
                          <th className="px-4 py-3 font-semibold text-right">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyber-cyan/10">
                        {visibleUserLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-cyber-cyan/5 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-white text-xs truncate max-w-[200px]">
                                {lead.nome}
                              </div>
                              <div className="text-[11px] text-cyber-cyan/70 truncate max-w-[200px]">
                                {lead.categoria || 'Geral'}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="text-cyber-cyan font-bold text-xs">{lead.telefone || 'Sem telefone'}</div>
                              {lead.whatsappStatus === 'sem_whatsapp' ? (
                                <span className="text-[10px] text-cyber-red flex items-center gap-1 mt-0.5">
                                  <PhoneOff className="w-3 h-3" /> Sem WhatsApp
                                </span>
                              ) : lead.whatsappStatus === 'ativo' ? (
                                <span className="text-[10px] text-cyber-green flex items-center gap-1 mt-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> Disparado
                                </span>
                              ) : null}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-cyber-yellow font-bold">
                                  ★ {lead.nota ? Number(lead.nota).toFixed(1) : 'N/A'}
                                </span>
                                <span className="text-gray-500">({lead.avaliacoes || 0})</span>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              {lead.semSite ? (
                                <span className="px-2 py-0.5 text-[10px] bg-cyber-red/20 text-cyber-red rounded border border-cyber-red/30 font-bold">
                                  SEM SITE
                                </span>
                              ) : (
                                <a
                                  href={lead.site?.startsWith('http') ? lead.site : `http://${lead.site}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyber-green text-xs hover:underline truncate max-w-[140px] block"
                                >
                                  {lead.site}
                                </a>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="text-xs text-gray-300 truncate max-w-[150px]">
                                {lead.cidade ? `${lead.cidade}, ${lead.estado || 'BR'}` : (lead.endereco || '-')}
                              </div>
                              <span className="text-[10px] text-cyber-cyan/70 bg-cyber-bg px-2 py-0.5 rounded border border-cyber-cyan/10 inline-block mt-0.5 truncate max-w-[140px]">
                                {lead.projectName || 'Geral'}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setInspectingLead(lead)}
                                className="px-2 py-1 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 rounded text-[11px] transition-colors inline-flex items-center gap-1"
                              >
                                <Info className="w-3 h-3" /> Detalhes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer counts */}
                <div className="p-3 bg-[#070b13] border-t border-cyber-cyan/20 flex justify-between items-center text-xs text-gray-400">
                  <span>Mostrando <strong className="text-white">{visibleUserLeads.length}</strong> de <strong className="text-white">{activeUserLeads.length}</strong> leads deste usuário</span>
                  <span className="text-cyber-cyan">Conta: {activeUser.displayName}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEAD DETAIL INSPECTION MODAL */}
      {inspectingLead && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-cyan/40 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-[0_0_30px_rgba(0,255,249,0.15)] font-mono">
            <div className="flex items-center justify-between border-b border-cyber-cyan/20 pb-3">
              <div>
                <span className="text-[10px] text-cyber-cyan block uppercase">DETALHES DO LEAD</span>
                <h3 className="text-base md:text-lg font-bold text-white">{inspectingLead.nome}</h3>
              </div>
              <button 
                onClick={() => setInspectingLead(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0d131f] p-2.5 rounded border border-cyber-cyan/15">
                  <span className="text-gray-400 block text-[10px]">CATEGORIA</span>
                  <strong className="text-white">{inspectingLead.categoria || 'Não informada'}</strong>
                </div>
                <div className="bg-[#0d131f] p-2.5 rounded border border-cyber-cyan/15">
                  <span className="text-gray-400 block text-[10px]">TELEFONE</span>
                  <strong className="text-cyber-cyan">{inspectingLead.telefone || 'Sem telefone'}</strong>
                </div>
              </div>

              <div className="bg-[#0d131f] p-2.5 rounded border border-cyber-cyan/15">
                <span className="text-gray-400 block text-[10px]">ENDEREÇO</span>
                <strong className="text-white">{inspectingLead.endereco || 'Não informado'}</strong>
                <div className="text-gray-400 text-[11px] mt-1">
                  Cidade: {inspectingLead.cidade || '-'} • Estado: {inspectingLead.estado || '-'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0d131f] p-2.5 rounded border border-cyber-cyan/15">
                  <span className="text-gray-400 block text-[10px]">STATUS DO SITE</span>
                  {inspectingLead.semSite ? (
                    <span className="text-cyber-red font-bold">SEM SITE CADASTRADO</span>
                  ) : (
                    <a 
                      href={inspectingLead.site?.startsWith('http') ? inspectingLead.site : `http://${inspectingLead.site}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyber-green hover:underline truncate block"
                    >
                      {inspectingLead.site}
                    </a>
                  )}
                </div>

                <div className="bg-[#0d131f] p-2.5 rounded border border-cyber-cyan/15">
                  <span className="text-gray-400 block text-[10px]">AVALIAÇÕES GOOGLE</span>
                  <strong className="text-cyber-yellow">
                    ★ {inspectingLead.nota ? Number(inspectingLead.nota).toFixed(1) : 'N/A'} ({inspectingLead.avaliacoes || 0})
                  </strong>
                </div>
              </div>

              <div className="bg-[#0d131f] p-2.5 rounded border border-cyber-cyan/15">
                <span className="text-gray-400 block text-[10px]">PASTA / PROJETO DE ORIGEM</span>
                <strong className="text-white">{inspectingLead.projectName || 'Geral'}</strong>
                <span className="text-gray-500 block text-[10px] mt-0.5">
                  ID do Run: {inspectingLead.searchId || 'N/A'} • Conta Capturadora: {inspectingLead.capturedBy || 'N/A'}
                </span>
              </div>

              {inspectingLead.googleMapsUrl && (
                <div className="pt-1">
                  <a
                    href={inspectingLead.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/30 text-cyber-cyan rounded transition-colors text-xs"
                  >
                    <Globe className="w-3.5 h-3.5" /> Abrir no Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-cyber-cyan/20">
              <CyberButton
                variant="secondary"
                onClick={() => setInspectingLead(null)}
                className="text-xs"
              >
                Fechar
              </CyberButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
