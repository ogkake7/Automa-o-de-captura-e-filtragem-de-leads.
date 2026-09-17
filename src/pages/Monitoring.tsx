import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Terminal, 
  Radio, 
  Layers, 
  Folder, 
  MapPin, 
  MessageSquare,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ArrowRight,
  BookmarkCheck,
  Trash2,
  Download,
  Save,
  CheckCircle2
} from 'lucide-react';
import { CyberButton } from '../components/CyberButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';

interface SearchRunItem {
  runId: string;
  projectName: string;
  status: 'STARTING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED' | string;
  itemCount: number;
  totalTarget?: number;
  elapsedSeconds?: number;
  startedAt?: number;
  finishedAt?: number;
  recentBatch?: string[];
  logs?: Array<{ timestamp: string; message: string; type: string }>;
  error?: string;
  isLiveInMemory?: boolean;
  searchStrings?: string[];
  locationQuery?: string;
}

interface IntegrationsSummary {
  apify: {
    configured: boolean;
    actorId: string;
    status: string;
  };
  whatsapp: {
    status: string;
    connected: boolean;
    user?: any;
    hasSession: boolean;
    minDelay: number;
    maxDelay: number;
  };
}

export function Monitoring() {
  const { getIdToken } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedRunId = searchParams.get('runId');

  const [searches, setSearches] = useState<SearchRunItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(focusedRunId);
  const [activeConsoleData, setActiveConsoleData] = useState<SearchRunItem | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Clear modal and save feedback state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch searches history & integrations summary
  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const [searchesRes, intRes] = await Promise.all([
        fetch('/api/searches', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/integrations/summary', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (searchesRes.ok) {
        const sData = await searchesRes.json();
        const list: SearchRunItem[] = sData.searches || [];
        setSearches(list);

        // Auto select the first active or focused one
        if (!selectedRunId && list.length > 0) {
          const activeOne = list.find(s => s.status === 'RUNNING' || s.status === 'STARTING');
          setSelectedRunId(activeOne ? activeOne.runId : list[0].runId);
        }
      }

      if (intRes.ok) {
        const iData = await intRes.json();
        setIntegrations(iData);
      }
    } catch (err) {
      console.warn("Erro ao buscar dados de monitoramento:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(), 4000);
    return () => clearInterval(timer);
  }, []);

  // Update selectedRunId if URL query changes
  useEffect(() => {
    if (focusedRunId) {
      setSelectedRunId(focusedRunId);
    }
  }, [focusedRunId]);

  // Poll live details for currently selected run
  useEffect(() => {
    if (!selectedRunId) return;

    let isSubscribed = true;

    const fetchRunDetails = async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/search/status/${selectedRunId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setActiveConsoleData(data);
          }
        } else {
          if (isSubscribed) {
            const fallback = searches.find(s => s.runId === selectedRunId);
            if (fallback) setActiveConsoleData(fallback);
          }
        }
      } catch (e) {
        const fallback = searches.find(s => s.runId === selectedRunId);
        if (isSubscribed && fallback) setActiveConsoleData(fallback);
      }
    };

    fetchRunDetails();
    const interval = setInterval(fetchRunDetails, 2500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [selectedRunId, searches]);

  // ACTION: Salvar dados coletados (Persistir resumo da execução ativa no histórico permanente)
  const handleSaveCollectedData = async (targetRun?: SearchRunItem) => {
    const runToSave = targetRun || activeConsoleData || (selectedRunId ? searches.find(s => s.runId === selectedRunId) : null);
    if (!runToSave) {
      setFeedback({ type: 'error', message: 'Selecione uma execução para salvar o resumo.' });
      return;
    }

    setSavingSummary(true);
    setFeedback(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/searches/save-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          runId: runToSave.runId,
          projectName: runToSave.projectName,
          itemCount: runToSave.itemCount,
          status: runToSave.status,
          startedAt: runToSave.startedAt,
          finishedAt: runToSave.finishedAt,
          notes: `Resumo de captura preservado com ${runToSave.itemCount} leads capturados.`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar resumo da execução');

      // Also trigger a quick JSON download of the execution summary
      const summaryBlob = new Blob([JSON.stringify(runToSave, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(summaryBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resumo_execucao_${runToSave.projectName.replace(/\s+/g, '_')}_${runToSave.runId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setFeedback({
        type: 'success',
        message: `Resumo da execução "${runToSave.projectName}" salvo no histórico permanente e baixado em JSON!`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingSummary(false);
    }
  };

  // ACTION: Limpar seção (reseta o painel de monitoramento para iniciar uma nova busca do zero)
  const handleConfirmClearSection = async () => {
    setIsClearing(true);
    setFeedback(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/searches', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao limpar histórico do monitoramento.');

      setSelectedRunId(null);
      setActiveConsoleData(null);
      await fetchData(true);
      setIsClearModalOpen(false);
      setFeedback({ type: 'success', message: 'Painel de monitoramento resetado com sucesso para nova busca!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsClearing(false);
    }
  };

  // ACTION: Remover busca específica do histórico
  const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getIdToken();
      await fetch(`/api/searches/${runId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setActiveConsoleData(null);
      }
      fetchData(true);
    } catch (err) {
      console.warn("Erro ao remover busca:", err);
    }
  };

  const activeSearchesCount = searches.filter(s => s.status === 'RUNNING' || s.status === 'STARTING').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            MONITORAMENTO<span className="text-cyber-green">_HUB</span>
          </h1>
          <p className="text-xs md:text-sm text-cyber-cyan/70">
            Acompanhe buscas em tempo real, logs do crawler, salve execuções e resete o painel.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Salvar dados coletados */}
          <CyberButton 
            variant="secondary" 
            onClick={() => handleSaveCollectedData()}
            className="flex items-center gap-1.5 text-xs py-2"
            disabled={savingSummary || !activeConsoleData}
            title="Guarda o resumo consolidado da execução no histórico e faz download do JSON"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-cyber-green" />
            {savingSummary ? 'Salvando...' : 'Salvar Dados Coletados'}
          </CyberButton>

          {/* Limpar seção */}
          <CyberButton 
            variant="danger" 
            onClick={() => setIsClearModalOpen(true)}
            className="flex items-center gap-1.5 text-xs py-2"
            disabled={searches.length === 0 && !activeConsoleData}
            title="Reseta o painel de monitoramento para iniciar uma nova busca do zero"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Seção
          </CyberButton>

          <CyberButton 
            variant="secondary" 
            onClick={() => fetchData(true)}
            className="flex items-center gap-1.5 text-xs py-2"
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyber-cyan ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </CyberButton>

          <Link to="/search">
            <CyberButton variant="primary" className="flex items-center gap-1.5 text-xs py-2">
              <Search className="w-3.5 h-3.5" />
              Nova Busca
            </CyberButton>
          </Link>
        </div>
      </header>

      {/* Feedback banner */}
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

      {/* INTEGRATIONS COMPACT BAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Apify status */}
        <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              integrations?.apify.configured 
                ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green shadow-[0_0_10px_rgba(0,255,157,0.2)]' 
                : 'bg-cyber-red/10 border-cyber-red/30 text-cyber-red'
            }`}>
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">Apify Google Places</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                  integrations?.apify.configured 
                    ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30 font-bold' 
                    : 'bg-cyber-red/20 text-cyber-red border border-cyber-red/30'
                }`}>
                  {integrations?.apify.configured ? 'Operacional' : 'Token Ausente'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Crawler oficial: <code className="text-cyber-cyan">{integrations?.apify.actorId || 'compass~crawler-google-places'}</code>
              </p>
            </div>
          </div>
          <Link to="/settings" className="text-gray-400 hover:text-cyber-cyan p-1.5" title="Configurar Token Apify">
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        {/* WhatsApp status */}
        <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              integrations?.whatsapp.connected 
                ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green shadow-[0_0_10px_rgba(0,255,157,0.2)]' 
                : integrations?.whatsapp.status === 'qr' 
                ? 'bg-cyber-yellow/10 border-cyber-yellow/30 text-cyber-yellow'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}>
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">Baileys WhatsApp</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                  integrations?.whatsapp.connected 
                    ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30 font-bold' 
                    : integrations?.whatsapp.status === 'qr'
                    ? 'bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/30 font-bold'
                    : 'bg-cyber-red/20 text-cyber-red border border-cyber-red/30'
                }`}>
                  {integrations?.whatsapp.connected ? 'Conectado' : (integrations?.whatsapp.status || 'Desconectado')}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {integrations?.whatsapp.connected 
                  ? `Sessão ativa (${integrations?.whatsapp.user?.id?.split(':')[0] || 'Pronto'})`
                  : 'Necessário escanear QR Code em Configurações'}
              </p>
            </div>
          </div>
          <Link to="/settings" className="text-gray-400 hover:text-cyber-cyan p-1.5" title="Gerenciar Sessão WhatsApp">
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ACTIVE SEARCHES BANNER */}
      {activeSearchesCount > 0 && (
        <div className="p-4 bg-cyber-cyan/10 border border-cyber-cyan/40 rounded-lg flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(0,229,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-cyber-green animate-ping shrink-0" />
            <span className="text-xs md:text-sm text-white font-mono">
              Existe <strong className="text-cyber-green">{activeSearchesCount}</strong> busca em andamento no momento. Os leads capturados estão sendo gravados em tempo real na pasta do projeto.
            </span>
          </div>
          <Link to="/leads" className="text-xs text-cyber-green hover:underline flex items-center gap-1 font-mono shrink-0">
            Ver Banco de Leads <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* MAIN MONITORING CONTENT: Split screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: LIVE CONSOLE & METRICS OF SELECTED RUN (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0b101b] border border-cyber-cyan/30 rounded-lg p-5 space-y-4 shadow-[0_0_20px_rgba(0,229,255,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-cyan/20 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-cyber-green" />
                <div>
                  <h3 className="text-sm md:text-base font-bold text-white font-mono flex items-center gap-2">
                    {activeConsoleData?.projectName || 'Selecione uma execução'}
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    ID: {activeConsoleData?.runId || selectedRunId || '---'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {activeConsoleData && (
                  <>
                    <CyberButton
                      variant="secondary"
                      onClick={() => handleSaveCollectedData(activeConsoleData)}
                      disabled={savingSummary}
                      className="text-[11px] py-1 px-2.5 flex items-center gap-1"
                      title="Salvar resumo desta execução no histórico"
                    >
                      <Save className="w-3 h-3 text-cyber-green" />
                      Salvar Dados
                    </CyberButton>

                    <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase ${
                      activeConsoleData.status === 'RUNNING' ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 animate-pulse' :
                      activeConsoleData.status === 'SUCCEEDED' ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/40' :
                      activeConsoleData.status === 'STARTING' ? 'bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/40' :
                      'bg-cyber-red/20 text-cyber-red border border-cyber-red/40'
                    }`}>
                      {activeConsoleData.status}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Metrics cards */}
            {activeConsoleData ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#050911] border border-cyber-cyan/15 rounded p-3 text-center">
                    <span className="text-[10px] text-gray-400 block font-mono">LEADS CAPTURADOS</span>
                    <span className="text-xl md:text-2xl font-bold text-cyber-green font-mono">
                      {activeConsoleData.itemCount}
                    </span>
                    {activeConsoleData.totalTarget && (
                      <span className="text-[10px] text-gray-500 block">de {activeConsoleData.totalTarget}</span>
                    )}
                  </div>

                  <div className="bg-[#050911] border border-cyber-cyan/15 rounded p-3 text-center">
                    <span className="text-[10px] text-gray-400 block font-mono">TEMPO DECORRIDO</span>
                    <span className="text-xl md:text-2xl font-bold text-cyber-cyan font-mono">
                      {activeConsoleData.elapsedSeconds !== undefined ? `${activeConsoleData.elapsedSeconds}s` : '---'}
                    </span>
                    <span className="text-[10px] text-gray-500 block">duração</span>
                  </div>

                  <div className="bg-[#050911] border border-cyber-cyan/15 rounded p-3 text-center flex flex-col justify-center">
                    <span className="text-[10px] text-gray-400 block font-mono">DESTINO</span>
                    <span className="text-xs font-bold text-white font-mono truncate mt-1">
                      {activeConsoleData.projectName}
                    </span>
                    <Link to="/leads" className="text-[10px] text-cyber-cyan hover:underline mt-0.5">
                      Abrir Pasta →
                    </Link>
                  </div>
                </div>

                {/* Recent items badge */}
                {activeConsoleData.recentBatch && activeConsoleData.recentBatch.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400 font-mono">Últimos estabelecimentos processados:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeConsoleData.recentBatch.map((name, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-cyber-bg border border-cyber-cyan/25 text-cyber-cyan text-xs font-mono truncate max-w-[220px]">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error banner if any */}
                {activeConsoleData.error && (
                  <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded text-xs text-cyber-red font-mono flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{activeConsoleData.error}</span>
                  </div>
                )}

                {/* Terminal Logs stream */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <span>Logs de Execução & Ator Apify:</span>
                    <span>{activeConsoleData.logs?.length || 0} eventos registrados</span>
                  </div>
                  <div className="bg-[#04070e] border border-cyber-cyan/20 rounded p-3.5 h-64 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin">
                    {activeConsoleData.logs && activeConsoleData.logs.length > 0 ? (
                      activeConsoleData.logs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-gray-500 shrink-0 select-none">[{log.timestamp}]</span>
                          <span className={
                            log.type === 'error' ? 'text-cyber-red font-bold' :
                            log.type === 'success' ? 'text-cyber-green font-bold' :
                            log.type === 'warn' ? 'text-cyber-yellow' : 'text-gray-300'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 italic py-4 text-center">
                        Sem logs na memória ativa para esta execução. Os dados consolidados estão salvos no histórico ao lado.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-gray-500 font-mono">
                <Layers className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">Selecione uma execução no histórico ao lado para inspecionar os detalhes e logs.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SEARCHES EXECUTION HISTORY (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyber-cyan uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyber-green" /> Histórico de Buscas ({searches.length})
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Auto-atualização ativa
            </span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
            {loading ? (
              <div className="p-8 text-center text-cyber-cyan font-mono text-xs">
                Carregando histórico...
              </div>
            ) : searches.length === 0 ? (
              <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg p-8 text-center text-gray-500 font-mono text-xs">
                Nenhuma busca registrada no monitoramento ativo.
                <div className="mt-3">
                  <Link to="/search" className="text-cyber-green underline">
                    → Iniciar nova extração
                  </Link>
                </div>
              </div>
            ) : (
              searches.map((run) => {
                const isSelected = selectedRunId === run.runId;
                const isRunning = run.status === 'RUNNING' || run.status === 'STARTING';
                const formattedDate = run.startedAt 
                  ? new Date(run.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Recente';

                return (
                  <div
                    key={run.runId}
                    onClick={() => setSelectedRunId(run.runId)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer font-mono group ${
                      isSelected
                        ? 'bg-cyber-cyan/15 border-cyber-cyan shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                        : 'bg-cyber-card border-cyber-cyan/20 hover:border-cyber-cyan/50 hover:bg-cyber-cyan/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs truncate">
                            {run.projectName}
                          </span>
                          {isRunning && (
                            <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                          <span>{formattedDate}</span>
                          <span>•</span>
                          <span className="text-cyber-green font-bold">{run.itemCount} leads</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          run.status === 'RUNNING' ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30' :
                          run.status === 'SUCCEEDED' ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30' :
                          run.status === 'STARTING' ? 'bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/30' :
                          'bg-cyber-red/20 text-cyber-red border border-cyber-red/30'
                        }`}>
                          {run.status}
                        </span>

                        <button
                          onClick={(e) => handleDeleteRun(run.runId, e)}
                          className="p-1 text-gray-500 hover:text-cyber-red opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover do histórico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* CONFIRM CLEAR MODAL */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClearSection}
        title="LIMPAR PAINEL DE MONITORAMENTO"
        description="Esta ação removerá as execuções antigas da tela de monitoramento, permitindo iniciar o acompanhamento de uma nova busca do zero com a tela limpa. Se desejar guardar os dados coletados antes de limpar, utilize o botão 'Salvar Dados Coletados'."
        isLoading={isClearing}
      />
    </div>
  );
}
