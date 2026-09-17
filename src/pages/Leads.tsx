import React, { useEffect, useState, useMemo } from 'react';
import { 
  Filter, 
  Send, 
  Loader2, 
  AlertTriangle, 
  MessageSquare, 
  X, 
  Download, 
  Folder, 
  FolderCheck, 
  Trash2, 
  Search,
  ExternalLink,
  CheckCircle2,
  Edit2,
  Calendar,
  Users,
  ArrowLeft,
  PhoneOff,
  Layers,
  Sparkles,
  ChevronRight,
  Upload,
  ShieldCheck,
  FileText,
  Shield,
  Zap,
  Flame,
  Info
} from 'lucide-react';
import { CyberButton } from '../components/CyberButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lead } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

export function Leads() {
  const { user, role, getIdToken } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state: 'FOLDERS' (Default primary view) or 'PROJECT_LEADS' or 'ALL_LEADS'
  const [activeView, setActiveView] = useState<'FOLDERS' | 'PROJECT_LEADS' | 'ALL_LEADS'>('FOLDERS');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Filter & Search state inside leads list
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState<'ALL' | 'NO_SITE' | 'HAS_SITE'>('ALL');
  const [whatsappFilter, setWhatsappFilter] = useState<'ALL' | 'NO_WHATSAPP' | 'WITH_WHATSAPP'>('ALL');
  const [ratingFilter, setRatingFilter] = useState<'ALL' | 'LOW_RATING' | 'HIGH_RATING'>('ALL');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  // Project Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [newProjectNameInput, setNewProjectNameInput] = useState('');

  // Dispatch modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('Olá {nome}, tudo bem? Encontrei sua empresa e gostaria de apresentar uma oportunidade.');
  const [isSending, setIsSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ success: boolean; message: string } | null>(null);
  const [warmupInfo, setWarmupInfo] = useState<any | null>(null);

  // CSV Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProjectName, setImportProjectName] = useState('');
  const [csvRawText, setCsvRawText] = useState('');
  const [parsedCsvLeads, setParsedCsvLeads] = useState<Array<{
    nome: string;
    telefone: string;
    categoria?: string;
    cidade?: string;
    estado?: string;
    site?: string;
  }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Usage info (Quota of 150 leads)
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; remaining: number; percentage: number } | null>(null);

  // Destructive actions state & ConfirmModal
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {},
  });
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Client-Side Read-Only Subscription to Leads Collection
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const q = query(collection(db, 'leads'), orderBy('capturedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const data: Lead[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Lead);
      });
      setLeads(data);
      setError(null);
      setLoading(false);
    }, (err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.error("Error fetching leads list:", err);
      setError(`Erro ao ler leads do Firestore [${err.code || 'UNKNOWN'}]: ${err.message}`);
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'leads');
      } catch (e) {
        // Logged
      }
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  // Isolate by account: Filter leads to ONLY those captured/created by this logged-in account
  // (Applies to everyone including the Admin, so admin's personal screen only shows their own projects)
  const myLeads = useMemo(() => {
    if (!user) return [];
    return leads.filter((l) => {
      const ownerId = l.capturedBy || l.createdBy || l.userId;
      if (ownerId) {
        return ownerId === user.uid;
      }
      // If legacy lead with no ownerId, only show if user is admin
      return role === 'admin';
    });
  }, [leads, user, role]);

  // Extract list of distinct projects / folders with metadata (count, latest capture date)
  const projectsList = useMemo(() => {
    const map = new Map<string, { 
      name: string; 
      count: number; 
      searchId?: string;
      latestDate?: number | string;
      withoutSiteCount: number;
    }>();

    myLeads.forEach(l => {
      const proj = l.projectName || (l.searchId ? `Lote ${l.searchId.slice(-6)}` : 'Geral (Sem Pasta)');
      const key = l.searchId || proj;
      const current = map.get(key) || { 
        name: proj, 
        count: 0, 
        searchId: l.searchId,
        latestDate: l.capturedAt,
        withoutSiteCount: 0
      };

      current.count++;
      if (l.semSite) current.withoutSiteCount++;
      if (l.capturedAt) {
        current.latestDate = l.capturedAt;
      }
      map.set(key, current);
    });

    return Array.from(map.entries()).map(([key, val]) => ({ id: key, ...val }));
  }, [myLeads]);

  // Current active project object
  const currentProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projectsList.find(p => p.id === selectedProjectId) || null;
  }, [projectsList, selectedProjectId]);

  // Filtered Leads based on current view and filters
  const visibleLeads = useMemo(() => {
    return myLeads.filter(lead => {
      // If we are in project view, filter by project
      if (activeView === 'PROJECT_LEADS' && selectedProjectId) {
        const leadProjectKey = lead.searchId || lead.projectName || 'Geral (Sem Pasta)';
        if (leadProjectKey !== selectedProjectId) return false;
      }

      // Website filter
      if (websiteFilter === 'NO_SITE' && !lead.semSite) return false;
      if (websiteFilter === 'HAS_SITE' && lead.semSite) return false;

      // WhatsApp filter (Sem WhatsApp incorporado como filtro)
      if (whatsappFilter === 'NO_WHATSAPP' && lead.whatsappStatus !== 'sem_whatsapp' && lead.whatsappStatus !== 'invalido') return false;
      if (whatsappFilter === 'WITH_WHATSAPP' && (lead.whatsappStatus === 'sem_whatsapp' || lead.whatsappStatus === 'invalido')) return false;

      // Rating filter
      if (ratingFilter === 'LOW_RATING' && (!lead.nota || lead.nota >= 4.0)) return false;
      if (ratingFilter === 'HIGH_RATING' && (!lead.nota || lead.nota < 4.0)) return false;

      // Text query
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
  }, [myLeads, activeView, selectedProjectId, websiteFilter, whatsappFilter, ratingFilter, searchQuery]);

  // Selection handlers
  const toggleSelection = (id: string) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const toggleAll = () => {
    if (selectedLeads.size === visibleLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(visibleLeads.map(l => l.id)));
    }
  };

  // EXPORT FUNCTIONS (CSV & JSON)
  const exportToCSV = (targetLeads: Lead[], fileNamePrefix = 'leads') => {
    if (targetLeads.length === 0) return;
    const headers = ['Nome', 'Categoria', 'Telefone', 'Site', 'Avaliações', 'Nota', 'Endereço', 'Cidade', 'Estado', 'Projeto'];
    const rows = targetLeads.map(l => [
      `"${(l.nome || '').replace(/"/g, '""')}"`,
      `"${(l.categoria || '').replace(/"/g, '""')}"`,
      `"${(l.telefone || '').replace(/"/g, '""')}"`,
      `"${(l.site || '').replace(/"/g, '""')}"`,
      l.avaliacoes || 0,
      l.nota || 0,
      `"${(l.endereco || '').replace(/"/g, '""')}"`,
      `"${(l.cidade || '').replace(/"/g, '""')}"`,
      `"${(l.estado || '').replace(/"/g, '""')}"`,
      `"${(l.projectName || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = (targetLeads: Lead[], fileNamePrefix = 'leads') => {
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
  };

  // OPEN CONFIRM MODAL: Delete Selected Leads
  const requestDeleteSelected = () => {
    if (selectedLeads.size === 0) return;
    setConfirmModalConfig({
      isOpen: true,
      title: "REMOVER LEADS SELECIONADOS",
      description: `Isso vai remover ${selectedLeads.size} lead(s) permanentemente do banco de dados. Esta ação não poderá ser desfeita. Deseja prosseguir?`,
      action: async () => {
        setIsActionLoading(true);
        try {
          const token = await getIdToken();
          const res = await fetch('/api/leads/batch-delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ leadIds: Array.from(selectedLeads) })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao excluir leads selecionados.');
          setSelectedLeads(new Set());
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
          setFeedback({ type: 'success', message: `${data.deletedCount || selectedLeads.size} leads removidos com sucesso.` });
        } catch (err: any) {
          setFeedback({ type: 'error', message: err.message });
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  // OPEN CONFIRM MODAL: Clear Section / Clear Folder
  const requestClearSection = (folderTarget?: { id: string; name: string; count: number }) => {
    const isFolder = !!folderTarget;
    const count = isFolder ? folderTarget.count : (activeView === 'PROJECT_LEADS' && currentProject ? currentProject.count : myLeads.length);
    const targetName = isFolder ? folderTarget.name : (activeView === 'PROJECT_LEADS' && currentProject ? currentProject.name : 'todos os projetos');
    const folderId = isFolder ? folderTarget.id : (activeView === 'PROJECT_LEADS' ? selectedProjectId : undefined);

    setConfirmModalConfig({
      isOpen: true,
      title: isFolder || activeView === 'PROJECT_LEADS' ? `LIMPAR PASTA "${targetName.toUpperCase()}"` : "LIMPAR BANCO DE LEADS GERAL",
      description: `Isso vai remover ${count} leads permanentemente ${isFolder || activeView === 'PROJECT_LEADS' ? `da pasta "${targetName}"` : 'de todas as pastas'}. Todos os dados vinculados serão excluídos. Confirmar exclusão?`,
      action: async () => {
        setIsActionLoading(true);
        try {
          const token = await getIdToken();
          const res = await fetch('/api/leads/clear-section', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              folderId: folderId || undefined,
              clearAll: !folderId
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao limpar seção de leads.');
          
          setSelectedLeads(new Set());
          if (activeView === 'PROJECT_LEADS') {
            setActiveView('FOLDERS');
            setSelectedProjectId(null);
          }
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
          setFeedback({ type: 'success', message: `Seção limpa com sucesso: ${data.deletedCount || count} leads excluídos.` });
        } catch (err: any) {
          setFeedback({ type: 'error', message: err.message });
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  // SECURE BACKEND OPERATION: Rename Project
  const handleRenameProject = async () => {
    if (!newProjectNameInput.trim() || !renameTargetId) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/projects/rename', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          searchId: renameTargetId,
          newProjectName: newProjectNameInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao renomear');

      setIsRenaming(false);
      setRenameTargetId(null);
      setNewProjectNameInput('');
      setFeedback({ type: 'success', message: 'Pasta renomeada com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: "Erro ao renomear: " + err.message });
    }
  };

  // SECURE BACKEND OPERATION: Start WhatsApp Dispatch via Baileys & Admin SDK
  const handleStartDispatch = async () => {
    const targets = myLeads.filter(l => selectedLeads.has(l.id));
    if (targets.length === 0) return;

    setIsSending(true);
    setDispatchResult(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          leads: targets.map(t => ({ id: t.id, nome: t.nome, telefone: t.telefone })),
          templateText: messageText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao disparar mensagens.');
      }

      setDispatchResult({
        success: true,
        message: data.message || `Disparo iniciado para ${targets.length} leads via Baileys.`,
      });
      setSelectedLeads(new Set());
      fetchUsageAndWarmup();
    } catch (err: any) {
      setDispatchResult({
        success: false,
        message: err.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Usage and WhatsApp Warmup Fetcher
  const fetchUsageAndWarmup = async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const [uRes, wRes] = await Promise.all([
        fetch('/api/user/usage', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/whatsapp/status')
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsageInfo(uData);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        setWarmupInfo(wData.warmup || null);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (user) {
      fetchUsageAndWarmup();
    }
  }, [user]);

  // CSV Parser with header detection
  const parseCsvContent = (text: string) => {
    setCsvRawText(text);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setParsedCsvLeads([]);
      return;
    }
    const headerLine = lines[0].toLowerCase();
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    const nomeIdx = headers.findIndex(h => h.includes('nome') || h.includes('name') || h.includes('cliente') || h.includes('empresa') || h.includes('contato'));
    const telIdx = headers.findIndex(h => h.includes('tel') || h.includes('fone') || h.includes('phone') || h.includes('cel') || h.includes('whats'));
    const catIdx = headers.findIndex(h => h.includes('cat') || h.includes('nicho') || h.includes('ramo') || h.includes('segmento'));
    const cidIdx = headers.findIndex(h => h.includes('cid') || h.includes('city') || h.includes('municipio'));
    const estIdx = headers.findIndex(h => h.includes('uf') || h.includes('est') || h.includes('state'));
    const siteIdx = headers.findIndex(h => h.includes('site') || h.includes('web') || h.includes('url'));

    const items: Array<{ nome: string; telefone: string; categoria?: string; cidade?: string; estado?: string; site?: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const nome = nomeIdx >= 0 ? cols[nomeIdx] : cols[0];
      const telefone = telIdx >= 0 ? cols[telIdx] : (cols[1] || '');
      if (!nome || !telefone) continue;
      items.push({
        nome,
        telefone,
        categoria: catIdx >= 0 && cols[catIdx] ? cols[catIdx] : 'Lista Importada',
        cidade: cidIdx >= 0 ? cols[cidIdx] : '',
        estado: estIdx >= 0 ? cols[estIdx] : '',
        site: siteIdx >= 0 ? cols[siteIdx] : ''
      });
    }
    setParsedCsvLeads(items);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!importProjectName) {
      setImportProjectName(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        parseCsvContent(content);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleExecuteImport = async () => {
    if (parsedCsvLeads.length === 0) {
      setImportFeedback({ type: 'error', message: 'Nenhum contato válido encontrado no CSV.' });
      return;
    }
    setIsImporting(true);
    setImportFeedback(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/leads/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projectName: importProjectName || 'Importação Manual',
          leads: parsedCsvLeads
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao importar leads do arquivo.');
      }
      setFeedback({ type: 'success', message: `${data.importedCount} leads importados para a pasta "${data.projectName}".` });
      setIsImportModalOpen(false);
      setParsedCsvLeads([]);
      setCsvRawText('');
      setImportProjectName('');
      fetchUsageAndWarmup();
    } catch (err: any) {
      setImportFeedback({ type: 'error', message: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-mono">
      {/* Top Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              LEADS<span className="text-cyber-green">_CAPTURADOS</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30">
              {myLeads.length} leads totais
            </span>
          </div>
          <p className="text-xs md:text-sm text-cyber-cyan/70">
            {activeView === 'FOLDERS' 
              ? 'Pastas e projetos organizados por captura do Google Places.' 
              : activeView === 'PROJECT_LEADS'
              ? `Explorando pasta: ${currentProject?.name || 'Projeto'}`
              : 'Visão geral com todos os leads consolidados.'}
          </p>
        </div>

        {/* Action Controls & Navigation between Views */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle buttons */}
          {activeView === 'FOLDERS' ? (
            <CyberButton
              variant="secondary"
              onClick={() => {
                setActiveView('ALL_LEADS');
                setSelectedProjectId(null);
                setSelectedLeads(new Set());
              }}
              className="flex items-center gap-1.5 text-xs py-2"
              title="Acessar listagem completa misturando todos os projetos"
            >
              <Layers className="w-3.5 h-3.5 text-cyber-cyan" />
              Ver Todos os Leads
            </CyberButton>
          ) : (
            <CyberButton
              variant="secondary"
              onClick={() => {
                setActiveView('FOLDERS');
                setSelectedProjectId(null);
                setSelectedLeads(new Set());
              }}
              className="flex items-center gap-1.5 text-xs py-2 text-cyber-green"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Pastas
            </CyberButton>
          )}

          {/* Import CSV Button */}
          <CyberButton 
            variant="secondary" 
            onClick={() => {
              setImportFeedback(null);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs py-2 text-cyber-yellow border-cyber-yellow/40 hover:bg-cyber-yellow/10"
            title="Importar lista própria de contatos em formato CSV"
          >
            <Upload className="w-3.5 h-3.5 text-cyber-yellow" /> Importar CSV
          </CyberButton>

          {/* Export Buttons */}
          <CyberButton 
            variant="secondary" 
            onClick={() => exportToCSV(
              selectedLeads.size > 0 ? myLeads.filter(l => selectedLeads.has(l.id)) : visibleLeads, 
              currentProject ? `projeto_${currentProject.name.replace(/\s+/g, '_')}` : 'leads_export'
            )}
            className="flex items-center gap-1.5 text-xs py-2"
            disabled={visibleLeads.length === 0}
          >
            <Download className="w-3.5 h-3.5 text-cyber-green" /> 
            {selectedLeads.size > 0 ? `CSV (${selectedLeads.size})` : 'Exportar CSV'}
          </CyberButton>

          <CyberButton 
            variant="secondary" 
            onClick={() => exportToJSON(
              selectedLeads.size > 0 ? myLeads.filter(l => selectedLeads.has(l.id)) : visibleLeads, 
              currentProject ? `projeto_${currentProject.name.replace(/\s+/g, '_')}` : 'leads_export'
            )}
            className="flex items-center gap-1.5 text-xs py-2"
            disabled={visibleLeads.length === 0}
          >
            <Download className="w-3.5 h-3.5 text-cyber-cyan" /> JSON
          </CyberButton>

          {/* Remover selecionados */}
          {selectedLeads.size > 0 && (
            <CyberButton 
              variant="danger" 
              onClick={requestDeleteSelected}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 text-xs py-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover Selecionados ({selectedLeads.size})
            </CyberButton>
          )}

          {/* Limpar Seção (Visão ativa ou todas) */}
          <CyberButton 
            variant="danger" 
            onClick={() => requestClearSection()}
            disabled={isActionLoading || myLeads.length === 0}
            className="flex items-center gap-1.5 text-xs py-2"
            title={activeView === 'PROJECT_LEADS' ? 'Apaga todos os leads desta pasta' : 'Apaga todos os leads'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Seção
          </CyberButton>

          {/* WhatsApp Dispatch */}
          <CyberButton 
            variant="primary" 
            disabled={selectedLeads.size === 0} 
            onClick={() => {
              setDispatchResult(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 text-xs py-2"
          >
            <Send className="w-4 h-4" /> DISPARAR WHATSAPP ({selectedLeads.size})
          </CyberButton>
        </div>
      </header>

      {/* Quota Tracker & Tier Limits (Limite Cumulativo de 150 Leads) */}
      <div className="bg-[#0b111c] border border-cyber-cyan/30 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyber-cyan/15 border border-cyber-cyan/30 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-cyber-cyan" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold tracking-wider">COTA DA CONTA:</span>
              <span className="text-cyber-green font-bold text-sm">
                {usageInfo ? usageInfo.used : myLeads.length} / 150 leads
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40">
                Plano Gratuito
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Limite cumulativo de 150 leads (Google Maps + CSV importados) com proteção de segurança e anti-abuso.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="w-36 bg-gray-800 rounded-full h-2.5 overflow-hidden border border-cyber-cyan/20">
            <div 
              className={`h-full transition-all duration-500 ${
                (usageInfo?.percentage ?? Math.round((myLeads.length / 150) * 100)) >= 90 
                  ? 'bg-cyber-red' 
                  : (usageInfo?.percentage ?? Math.round((myLeads.length / 150) * 100)) >= 70 
                  ? 'bg-cyber-yellow' 
                  : 'bg-cyber-green'
              }`}
              style={{ width: `${Math.min(100, usageInfo?.percentage ?? Math.round((myLeads.length / 150) * 100))}%` }}
            />
          </div>
          <span className="text-[11px] text-cyber-cyan/90 font-mono font-semibold">
            {usageInfo ? `${usageInfo.remaining} restantes` : `${Math.max(0, 150 - myLeads.length)} restantes`}
          </span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-lg flex items-center justify-between gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green' 
            : 'bg-cyber-red/10 border-cyber-red/40 text-cyber-red'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-mono">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cyber-red shrink-0 mt-0.5" />
          <p className="text-sm text-cyber-red">{error}</p>
        </div>
      )}

      {/* RENAME MODAL / INLINE BAR */}
      {isRenaming && (
        <div className="flex items-center gap-2 bg-[#0c121d] p-3 rounded-lg border border-cyber-cyan/30">
          <Folder className="w-4 h-4 text-cyber-green shrink-0" />
          <input 
            type="text" 
            value={newProjectNameInput}
            onChange={(e) => setNewProjectNameInput(e.target.value)}
            placeholder="Novo nome para a pasta do projeto"
            className="bg-transparent text-white text-xs flex-1 outline-none px-2 border-b border-cyber-cyan/40 py-1"
          />
          <CyberButton variant="primary" onClick={handleRenameProject} className="text-xs py-1 px-3">Salvar</CyberButton>
          <CyberButton variant="secondary" onClick={() => { setIsRenaming(false); setRenameTargetId(null); }} className="text-xs py-1 px-3">Cancelar</CyberButton>
        </div>
      )}

      {/* VIEW 1: FOLDERS / PROJECTS GRID (DEFAULT PRIMARY VIEW) */}
      {activeView === 'FOLDERS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-cyber-cyan/15 pb-2">
            <span className="text-xs font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-cyber-green" /> Pastas de Projetos ({projectsList.length})
            </span>
            <span className="text-[11px] text-gray-500">
              Clique em uma pasta para gerenciar seus leads
            </span>
          </div>

          {loading ? (
            <div className="p-16 text-center text-cyber-cyan">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-xs">Carregando pastas e projetos...</p>
            </div>
          ) : projectsList.length === 0 ? (
            <div className="p-16 bg-cyber-card border border-cyber-cyan/20 rounded-xl text-center space-y-3">
              <Folder className="w-12 h-12 text-cyber-cyan/40 mx-auto" />
              <h3 className="text-white font-bold text-sm">Nenhuma pasta ou projeto encontrado</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Realize sua primeira captura de estabelecimentos no Google Places para gerar pastas automáticas.
              </p>
              <div className="pt-2">
                <Link to="/search">
                  <CyberButton variant="primary" className="text-xs">
                    Iniciar Nova Busca
                  </CyberButton>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectsList.map((project) => {
                const formattedDate = project.latestDate
                  ? new Date(project.latestDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : 'Recente';

                return (
                  <div
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setActiveView('PROJECT_LEADS');
                      setSelectedLeads(new Set());
                    }}
                    className="p-5 bg-cyber-card border border-cyber-cyan/20 hover:border-cyber-cyan/60 rounded-xl transition-all duration-200 cursor-pointer group hover:bg-[#0d1422] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex flex-col justify-between gap-4"
                  >
                    {/* Folder Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan group-hover:bg-cyber-cyan/20 group-hover:text-cyber-green transition-colors">
                          <Folder className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-cyber-cyan transition-colors truncate max-w-[180px]">
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>Captura: {formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTargetId(project.id);
                          setNewProjectNameInput(project.name);
                          setIsRenaming(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors"
                        title="Renomear Pasta"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cyber-cyan/10">
                      <div className="bg-[#050912] p-2.5 rounded border border-cyber-cyan/15 text-center">
                        <span className="text-[10px] text-gray-400 block">TOTAL LEADS</span>
                        <span className="text-base font-bold text-cyber-green">{project.count}</span>
                      </div>
                      <div className="bg-[#050912] p-2.5 rounded border border-cyber-cyan/15 text-center">
                        <span className="text-[10px] text-gray-400 block">SEM SITE</span>
                        <span className="text-base font-bold text-cyber-yellow">{project.withoutSiteCount}</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestClearSection(project);
                        }}
                        className="text-[11px] text-gray-500 hover:text-cyber-red flex items-center gap-1 transition-colors"
                        title="Limpar todos os leads desta pasta"
                      >
                        <Trash2 className="w-3 h-3" />
                        Limpar Pasta
                      </button>

                      <span className="text-xs text-cyber-cyan group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
                        Abrir Pasta <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2 & 3: LEADS LIST VIEW (PROJECT SPECIFIC OR ALL LEADS) */}
      {(activeView === 'PROJECT_LEADS' || activeView === 'ALL_LEADS') && (
        <div className="space-y-4">
          
          {/* Current Path Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-cyber-card border border-cyber-cyan/20 rounded-lg">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveView('FOLDERS');
                  setSelectedProjectId(null);
                  setSelectedLeads(new Set());
                }}
                className="text-xs text-cyber-cyan hover:underline flex items-center gap-1"
              >
                <Folder className="w-3.5 h-3.5" /> Pastas
              </button>
              <span className="text-gray-500">/</span>
              <span className="text-xs font-bold text-white">
                {activeView === 'PROJECT_LEADS' ? (currentProject?.name || 'Projeto') : 'Todos os Leads'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyber-green/20 text-cyber-green text-[10px] font-bold">
                {visibleLeads.length} leads filtrados
              </span>
            </div>

            {activeView === 'PROJECT_LEADS' && currentProject && (
              <button
                onClick={() => {
                  setRenameTargetId(currentProject.id);
                  setNewProjectNameInput(currentProject.name);
                  setIsRenaming(true);
                }}
                className="text-xs text-cyber-cyan hover:text-white flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" /> Renomear esta pasta
              </button>
            )}
          </div>

          {/* SEARCH & ADVANCED FILTERS BAR */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome, telefone, cidade ou categoria..."
                className="w-full bg-cyber-card border border-cyber-cyan/20 rounded pl-9 pr-4 py-2 text-xs text-white focus:border-cyber-cyan outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Filter: Site Status */}
              <select
                value={websiteFilter}
                onChange={(e) => setWebsiteFilter(e.target.value as any)}
                className="bg-cyber-card border border-cyber-cyan/20 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyber-cyan"
              >
                <option value="ALL">Status Web (Todos)</option>
                <option value="NO_SITE">Sem Site (Oportunidade)</option>
                <option value="HAS_SITE">Com Site Ativo</option>
              </select>

              {/* Filter: WhatsApp Status (incluindo filtro sem WhatsApp) */}
              <select
                value={whatsappFilter}
                onChange={(e) => setWhatsappFilter(e.target.value as any)}
                className="bg-cyber-card border border-cyber-cyan/20 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyber-cyan"
              >
                <option value="ALL">WhatsApp (Todos)</option>
                <option value="NO_WHATSAPP">Sem WhatsApp Confirmado</option>
                <option value="WITH_WHATSAPP">Com WhatsApp</option>
              </select>

              {/* Filter: Rating */}
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value as any)}
                className="bg-cyber-card border border-cyber-cyan/20 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyber-cyan"
              >
                <option value="ALL">Avaliações (Todas)</option>
                <option value="LOW_RATING">Nota Baixa (&lt; 4.0)</option>
                <option value="HIGH_RATING">Nota Alta (≥ 4.0)</option>
              </select>

              <button
                onClick={toggleAll}
                className="bg-cyber-card border border-cyber-cyan/20 px-3 py-2 rounded text-xs text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors whitespace-nowrap"
              >
                {selectedLeads.size === visibleLeads.length && visibleLeads.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>
          </div>

          {/* LEADS TABLE */}
          <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg overflow-hidden relative min-h-[320px]">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-cyber-cyan p-8">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-xs">SINCRONIZANDO COM BANCO DE DADOS...</p>
              </div>
            ) : visibleLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-gray-500 text-center space-y-2">
                <p className="text-sm">Nenhum lead encontrado com os filtros selecionados.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setWebsiteFilter('ALL');
                    setWhatsappFilter('ALL');
                    setRatingFilter('ALL');
                  }}
                  className="text-cyber-cyan text-xs underline"
                >
                  Limpar filtros de busca
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="text-[11px] text-cyber-cyan uppercase bg-[#090e18] border-b border-cyber-cyan/20">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input 
                          type="checkbox" 
                          className="accent-cyber-green cursor-pointer" 
                          checked={selectedLeads.size === visibleLeads.length && visibleLeads.length > 0} 
                          onChange={toggleAll} 
                        />
                      </th>
                      <th className="px-4 py-3">Empresa / Categoria</th>
                      <th className="px-4 py-3">Contato WhatsApp</th>
                      <th className="px-4 py-3">Avaliações / Nota</th>
                      <th className="px-4 py-3">Status Web</th>
                      <th className="px-4 py-3">Localização / Pasta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-cyan/10">
                    {visibleLeads.map((lead) => {
                      const isSelected = selectedLeads.has(lead.id);
                      return (
                        <tr 
                          key={lead.id} 
                          className={`transition-colors ${isSelected ? 'bg-cyber-cyan/10' : 'hover:bg-cyber-cyan/5'}`}
                        >
                          <td className="px-4 py-3">
                            <input 
                              type="checkbox" 
                              className="accent-cyber-green cursor-pointer" 
                              checked={isSelected} 
                              onChange={() => toggleSelection(lead.id)} 
                            />
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {lead.nome}
                              {lead.googleMapsUrl && (
                                <a href={lead.googleMapsUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-cyber-cyan">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400">{lead.categoria}</div>
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
                              <span className="text-cyber-yellow font-bold">★ {lead.nota ? Number(lead.nota).toFixed(1) : 'N/A'}</span>
                              <span className="text-gray-500">({lead.avaliacoes || 0})</span>
                            </div>
                            {lead.notaBaixa && (
                              <span className="text-[10px] text-cyber-red block mt-0.5">Nota baixa (&lt; 4.0)</span>
                            )}
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer counts */}
            <div className="p-3 bg-[#070b13] border-t border-cyber-cyan/20 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-400 gap-2">
              <span>Mostrando <strong className="text-white">{visibleLeads.length}</strong> leads</span>
              <span>Selecionados para ação: <strong className="text-cyber-green">{selectedLeads.size}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH MODAL WITH WARM-UP & SPINTAX */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-cyan/40 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-[0_0_30px_rgba(0,255,249,0.15)]">
            <div className="flex items-center justify-between border-b border-cyber-cyan/20 pb-3">
              <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyber-green" /> DISPARO BAILEYS WHATSAPP
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warm-up Status Card */}
            {warmupInfo && (
              <div className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2.5 ${
                warmupInfo.isWarmupActive ? 'bg-cyber-yellow/10 border-cyber-yellow/30 text-cyber-yellow' : 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green'
              }`}>
                <Flame className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-2">
                    <span>{warmupInfo.stageDescription}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 border border-current">
                      Dia {warmupInfo.daysConnected}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90">
                    Enviadas hoje: <strong>{warmupInfo.sentToday}</strong> / limite diário de <strong>{warmupInfo.dailyLimit}</strong> mensagens.
                    {warmupInfo.remainingToday <= 0 && (
                      <span className="block font-bold text-cyber-red mt-1">
                        Limite diário atingido. Novos disparos pausados até amanhã para proteção de reputação.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-cyber-cyan/80 font-mono">
                <span>Destinatários selecionados: <strong className="text-white">{selectedLeads.size} leads</strong></span>
                <span className="text-[11px] text-gray-400">Intervalo humano: 18s - 35s</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-cyber-cyan font-bold block">
                    Mensagem (com suporte a Spintax e Tags):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMessageText(prev => prev + ' {nome}')}
                      className="px-1.5 py-0.5 text-[10px] bg-cyber-bg border border-cyber-cyan/30 text-cyber-cyan rounded hover:bg-cyber-cyan/10"
                      title="Insere tag do nome do lead"
                    >
                      +{'{nome}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageText(prev => prev + ' {cidade}')}
                      className="px-1.5 py-0.5 text-[10px] bg-cyber-bg border border-cyber-cyan/30 text-cyber-cyan rounded hover:bg-cyber-cyan/10"
                      title="Insere tag da cidade"
                    >
                      +{'{cidade}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageText(prev => prev + ' {Olá|Oi|Opa|Bom dia}')}
                      className="px-1.5 py-0.5 text-[10px] bg-cyber-bg border border-cyber-green/40 text-cyber-green rounded hover:bg-cyber-green/10"
                      title="Insere bloco de variação Spintax"
                    >
                      +Spintax
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-3 text-white text-xs focus:border-cyber-green outline-none font-mono"
                  placeholder="Ex: {Olá|Oi} {nome}, vi sua empresa em {cidade}..."
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  💡 <strong>Anti-Ban Spintax:</strong> Utilize chaves e barras como <code className="text-cyber-green">{"{Olá|Oi|Opa}"}</code> para que cada mensagem enviada tenha texto único e evite identificação de spam pelo WhatsApp.
                </p>
              </div>

              {/* Circuit-Breaker Notice */}
              <div className="p-2.5 bg-cyber-bg/70 border border-cyber-cyan/20 rounded flex items-center gap-2 text-[11px] text-gray-300">
                <ShieldCheck className="w-4 h-4 text-cyber-green shrink-0" />
                <span>
                  <strong>Circuit-Breaker Ativo:</strong> Se 3 mensagens falharem em sequência, o lote pausará automaticamente para salvar o chip.
                </span>
              </div>

              {dispatchResult && (
                <div className={`p-3 rounded text-xs font-mono border ${
                  dispatchResult.success 
                    ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green' 
                    : 'bg-cyber-red/10 border-cyber-red/30 text-cyber-red'
                }`}>
                  {dispatchResult.message}
                  {!dispatchResult.success && dispatchResult.message.includes('desconectado') && (
                    <div className="mt-2">
                      <Link to="/settings" className="underline text-cyber-cyan font-bold">
                        → Ir para Configurações e escanear o QR Code
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-cyber-cyan/20">
              <CyberButton 
                variant="secondary" 
                onClick={() => setIsModalOpen(false)}
                disabled={isSending}
              >
                Cancelar
              </CyberButton>
              <CyberButton 
                variant="primary" 
                onClick={handleStartDispatch}
                disabled={isSending || (warmupInfo?.isWarmupActive && warmupInfo?.remainingToday <= 0)}
                className="flex items-center gap-2"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSending ? 'Iniciando...' : 'Confirmar e Iniciar Disparo'}
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT CSV MODAL (Lista Própria com Quota de 150 Leads) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-yellow/40 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-[0_0_30px_rgba(255,184,0,0.15)]">
            <div className="flex items-center justify-between border-b border-cyber-cyan/20 pb-3">
              <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyber-yellow" /> IMPORTAR LISTA PRÓPRIA (CSV)
              </h3>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <p className="text-gray-300">
                Suba uma planilha CSV ou cole os dados abaixo. Suporte automático a separadores por vírgula (,) ou ponto-e-vírgula (;).
              </p>

              {/* Project Name Input */}
              <div>
                <label className="text-xs text-cyber-cyan block mb-1 font-bold">
                  Nome da Pasta / Projeto:
                </label>
                <input
                  type="text"
                  value={importProjectName}
                  onChange={(e) => setImportProjectName(e.target.value)}
                  placeholder="Ex: Clientes Farmácias SP ou Minha Lista Antiga"
                  className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded px-3 py-2 text-white outline-none focus:border-cyber-yellow"
                />
              </div>

              {/* File Upload Button */}
              <div>
                <label className="text-xs text-cyber-cyan block mb-1 font-bold">
                  Arquivo CSV (.csv):
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-cyber-cyan/20 file:text-cyber-cyan hover:file:bg-cyber-cyan/30 cursor-pointer"
                />
              </div>

              {/* Textarea for Direct Paste */}
              <div>
                <label className="text-xs text-cyber-cyan block mb-1">
                  Ou cole o conteúdo CSV diretamente:
                </label>
                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={(e) => parseCsvContent(e.target.value)}
                  placeholder={`Nome,Telefone,Categoria,Cidade,Site\nClinica Silva,11999998888,Odontologia,São Paulo,clinicasilva.com.br\nBarbearia Santos,21988887777,Barbearia,Rio de Janeiro,`}
                  className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2.5 text-white text-[11px] focus:border-cyber-yellow outline-none font-mono"
                />
              </div>

              {/* Preview of Parsed Contacts */}
              {parsedCsvLeads.length > 0 && (
                <div className="bg-[#080d16] border border-cyber-green/30 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between text-cyber-green font-bold">
                    <span>✓ {parsedCsvLeads.length} contatos válidos identificados</span>
                    <span className="text-[10px] text-gray-400">
                      Exibindo primeiros {Math.min(3, parsedCsvLeads.length)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {parsedCsvLeads.slice(0, 3).map((lead, idx) => (
                      <div key={idx} className="text-[11px] text-gray-300 truncate">
                        • <strong>{lead.nome}</strong> ({lead.telefone}) - {lead.categoria || 'Importado'} {lead.cidade ? `| ${lead.cidade}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quota & Safety Notice */}
              <div className="p-2.5 bg-cyber-bg border border-cyber-cyan/20 rounded flex items-center justify-between text-[11px] text-gray-300">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyber-cyan" />
                  Cota livre atual: <strong className="text-white">{usageInfo ? usageInfo.remaining : Math.max(0, 150 - myLeads.length)}</strong> leads
                </span>
                <span className="text-gray-400">Máximo: 150 por conta</span>
              </div>

              {/* Import Feedback */}
              {importFeedback && (
                <div className={`p-3 rounded text-xs border ${
                  importFeedback.type === 'success' ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green' : 'bg-cyber-red/10 border-cyber-red/30 text-cyber-red'
                }`}>
                  {importFeedback.message}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-cyber-cyan/20">
              <CyberButton 
                variant="secondary" 
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
              >
                Cancelar
              </CyberButton>
              <CyberButton 
                variant="primary" 
                onClick={handleExecuteImport}
                disabled={isImporting || parsedCsvLeads.length === 0}
                className="flex items-center gap-2 text-black bg-cyber-yellow hover:bg-cyber-yellow/80 border-cyber-yellow"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Upload className="w-4 h-4 text-black" />}
                {isImporting ? 'Importando...' : `Importar ${parsedCsvLeads.length} Leads`}
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL FOR DESTRUCTIVE ACTIONS */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalConfig.action}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        isLoading={isActionLoading}
      />
    </div>
  );
}
