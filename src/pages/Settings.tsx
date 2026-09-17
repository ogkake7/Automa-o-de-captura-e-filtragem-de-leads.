import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  QrCode, 
  Smartphone, 
  Send, 
  LogOut,
  Terminal,
  Copy,
  Check,
  Server,
  Radio,
  MessageSquare,
  Download,
  FileArchive
} from 'lucide-react';
import { CyberButton } from '../components/CyberButton';
import { CyberInput } from '../components/CyberInput';
import { useAuth } from '../contexts/AuthContext';
import { useSystemStatus, formatWhatsAppPhone } from '../hooks/useSystemStatus';
import { getBackendUrl, setBackendUrl, checkBackendStatus } from '../lib/backendConfig';

interface WhatsAppStatus {
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  connected: boolean;
  user: { id?: string; name?: string } | null;
  qrCode: string | null;
  hasSession: boolean;
  config?: {
    intervalMin: number;
    intervalMax: number;
  };
}

export function Settings() {
  const { role } = useAuth();
  const systemStatus = useSystemStatus(4000);

  // Backend URL Config State
  const [backendUrlInput, setBackendUrlInput] = useState(() => getBackendUrl());
  const [savingBackendUrl, setSavingBackendUrl] = useState(false);
  const [backendTestFeedback, setBackendTestFeedback] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);

  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({
    status: 'disconnected',
    connected: false,
    user: null,
    qrCode: null,
    hasSession: false,
  });
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Test message state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do LeadGen CyberDash.');
  const [sendingTest, setSendingTest] = useState(false);

  // Clipboard copy state for instructions
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Salvar e testar URL do Backend
  const handleSaveBackendUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingBackendUrl(true);
    setBackendTestFeedback(null);
    setBackendUrl(backendUrlInput);

    // Se estiver vazio, define feedback de limpeza
    if (!backendUrlInput.trim()) {
      setBackendTestFeedback({
        connected: false,
        message: 'URL do backend removida. O sistema agora está categorizado como Desconectado.',
      });
      systemStatus.refreshStatus();
      setSavingBackendUrl(false);
      return;
    }

    const check = await checkBackendStatus(4500);
    systemStatus.refreshStatus();

    if (check.connected) {
      setBackendTestFeedback({
        connected: true,
        message: `✔ Conectado com sucesso! Servidor ativo: ${check.service || 'FilterByKake backend'}`,
      });
    } else {
      setBackendTestFeedback({
        connected: false,
        message: `✖ Falha na conexão: ${check.error || 'Servidor offline ou endereço inacessível.'}`,
      });
    }
    setSavingBackendUrl(false);
  };

  // Fetch real WhatsApp status directly from configured backend endpoint GET /api/whatsapp/status
  const checkStatus = async () => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      setWaStatus({
        status: 'disconnected',
        connected: false,
        user: null,
        qrCode: null,
        hasSession: false,
      });
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/api/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      } else {
        setWaStatus((prev) => ({ ...prev, status: 'disconnected', connected: false }));
      }
    } catch (err) {
      setWaStatus((prev) => ({ ...prev, status: 'disconnected', connected: false }));
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, waStatus.status === 'qr' || waStatus.status === 'connecting' ? 3000 : 8000);
    return () => clearInterval(interval);
  }, [waStatus.status]);

  // Request QR code or connect
  const handleConnect = async (force = false) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl || systemStatus.backend !== 'connected') {
      setFeedback({ 
        type: 'error', 
        message: 'O servidor backend local não está conectado. Inicie o backend no seu computador e informe a URL acima antes de conectar o WhatsApp.' 
      });
      return;
    }

    setLoadingAction(true);
    setFeedback(null);
    try {
      const res = await fetch(`${backendUrl}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      setWaStatus(data);
      systemStatus.refreshStatus();
      if (data.connected) {
        setFeedback({ type: 'success', message: 'WhatsApp já conectado com sucesso!' });
      } else {
        setFeedback({ type: 'success', message: 'Iniciando Baileys. Aguarde o QR Code...' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao conectar WhatsApp: ' + err.message });
    } finally {
      setLoadingAction(false);
      checkStatus();
    }
  };

  // Disconnect / reset local auth folder
  const handleDisconnect = async () => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) return;

    if (!window.confirm('Tem certeza que deseja desconectar o WhatsApp e remover a sessão local?')) return;
    setLoadingAction(true);
    setFeedback(null);
    try {
      const res = await fetch(`${backendUrl}/api/whatsapp/disconnect`, { method: 'POST' });
      const data = await res.json();
      setWaStatus({
        status: 'disconnected',
        connected: false,
        user: null,
        qrCode: null,
        hasSession: false,
      });
      systemStatus.refreshStatus();
      setFeedback({ type: 'success', message: data.message || 'Desconectado com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao desconectar: ' + err.message });
    } finally {
      setLoadingAction(false);
      checkStatus();
    }
  };

  // Send test message
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) {
      setFeedback({ type: 'error', message: 'Informe o número de telefone com DDD.' });
      return;
    }
    const backendUrl = getBackendUrl();
    if (!backendUrl || systemStatus.backend !== 'connected') {
      setFeedback({ type: 'error', message: 'Backend desconectado. Inicie o servidor local primeiro.' });
      return;
    }

    setSendingTest(true);
    setFeedback(null);
    try {
      const res = await fetch(`${backendUrl}/api/whatsapp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no envio.');
      setFeedback({ type: 'success', message: data.message });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSendingTest(false);
    }
  };

  const backendSteps = [
    {
      num: 1,
      title: "Extrair o arquivo .zip do backend",
      desc: "Baixe o código do projeto ou exporte o ZIP e extraia os arquivos em uma pasta de sua preferência no computador (exemplo: C:\\leadgen-backend).",
      command: null
    },
    {
      num: 2,
      title: "Abrir o terminal na pasta",
      desc: "Abra o Prompt de Comando (CMD) ou PowerShell dentro da pasta extraída onde está localizado o package.json.",
      command: "cd C:\\leadgen-backend"
    },
    {
      num: 3,
      title: "Instalar dependências",
      desc: "Instale todos os pacotes necessários do Node.js (Express, Baileys, Apify Client, etc).",
      command: "npm install"
    },
    {
      num: 4,
      title: "Configurar variáveis de ambiente (.env)",
      desc: "Copie o arquivo de exemplo .env.example criando o arquivo .env definitivo e preencha seu token da Apify.",
      command: "copy .env.example .env"
    },
    {
      num: 5,
      title: "Iniciar o servidor backend",
      desc: "Inicie o servidor Node.js com TypeScript embutido na porta 3000.",
      command: "npm start"
    },
    {
      num: 6,
      title: "Expor via túnel ngrok (se o painel estiver na nuvem)",
      desc: "Caso o painel web esteja hospedado na nuvem (Cloud Run ou Vercel), execute o comando abaixo no terminal do seu computador, copie o link público gerado (ex: https://...ngrok-free.app) e cole no campo 'URL do Backend' acima.",
      command: "npx ngrok http 3000"
    },
    {
      num: 7,
      title: "Conectar WhatsApp no painel",
      desc: "Na seção abaixo, clique no botão 'Conectar WhatsApp (Gerar QR Code)', aponte a câmera do WhatsApp no celular e aguarde o status mudar para 'CONECTADO' antes de disparar campanhas.",
      command: null
    }
  ];

  const connectedPhoneNumber = waStatus.user?.id ? formatWhatsAppPhone(waStatus.user.id) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl font-mono">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          SYS<span className="text-cyber-green">_CONFIG</span> & GUIA BACKEND
        </h1>
        <p className="text-xs md:text-sm text-cyber-cyan/70">
          Gerenciamento de integrações, execução do servidor local e conexão com WhatsApp Baileys.
        </p>
      </header>

      {/* STATUS DE CONECTIVIDADE DISCRETO EM TEMPO REAL (SEM EXPOSIÇÃO TÉCNICA) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Backend Status */}
        <div className="p-3.5 bg-cyber-card border border-cyber-cyan/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-cyber-cyan" />
            <div>
              <span className="text-[10px] text-gray-400 block uppercase">Backend</span>
              <span className="text-xs font-bold text-white">
                {systemStatus.backend === 'connected' ? 'Servidor Online' : 'Indisponível'}
              </span>
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${
            systemStatus.backend === 'connected' 
              ? 'bg-cyber-green shadow-[0_0_8px_rgba(0,255,157,1)]' 
              : 'bg-cyber-red shadow-[0_0_8px_rgba(255,0,85,1)] animate-pulse'
          }`} />
        </div>

        {/* WhatsApp Status */}
        <div className="p-3.5 bg-cyber-card border border-cyber-cyan/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-cyber-green" />
            <div>
              <span className="text-[10px] text-gray-400 block uppercase">WhatsApp Baileys</span>
              <span className="text-xs font-bold text-white">
                {waStatus.status === 'connected' 
                  ? (connectedPhoneNumber || 'Conectado') 
                  : waStatus.status === 'qr' 
                  ? 'Aguardando QR Code' 
                  : 'Desconectado'}
              </span>
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${
            waStatus.status === 'connected' 
              ? 'bg-cyber-green shadow-[0_0_8px_rgba(0,255,157,1)]' 
              : waStatus.status === 'qr'
              ? 'bg-cyber-yellow shadow-[0_0_8px_rgba(234,179,8,1)] animate-pulse'
              : 'bg-cyber-red shadow-[0_0_8px_rgba(255,0,85,1)]'
          }`} />
        </div>

        {/* Apify Discreto Status (sem exposição técnica de token ou actor ID) */}
        <div className="p-3.5 bg-cyber-card border border-cyber-cyan/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-cyber-cyan" />
            <div>
              <span className="text-[10px] text-gray-400 block uppercase">Apify Crawler</span>
              <span className="text-xs font-bold text-white">
                {systemStatus.apify === 'connected' ? 'Conectado' : 'Não configurado'}
              </span>
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${
            systemStatus.apify === 'connected' 
              ? 'bg-cyber-green shadow-[0_0_8px_rgba(0,255,157,1)]' 
              : 'bg-cyber-yellow shadow-[0_0_8px_rgba(234,179,8,1)]'
          }`} />
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-md flex items-start gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green' 
            : 'bg-cyber-red/10 border-cyber-red/40 text-cyber-red'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-mono">{feedback.message}</p>
        </div>
      )}

      {role !== 'admin' && (
        <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-md flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-cyber-red" />
          <p className="text-sm text-cyber-red">Esta área é restrita a administradores.</p>
        </div>
      )}

      {role === 'admin' && (
        <div className="space-y-8">
          
          {/* SEÇÃO: CONEXÃO DO SERVIDOR BACKEND (LOCAL OU NGROK) */}
          <section className="bg-cyber-card border-2 border-cyber-cyan/30 rounded-xl p-6 space-y-4 shadow-[0_0_25px_rgba(0,229,255,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-cyan/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded-lg text-cyber-cyan">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    ENDEREÇO DO BACKEND (LOCAL OU NGROK)
                  </h2>
                  <p className="text-xs text-cyber-cyan/70">
                    Sincronize este painel com o servidor Node.js/Baileys que roda no seu computador.
                  </p>
                </div>
              </div>

              {/* Status Badge em tempo real */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyber-bg border border-cyber-cyan/20 text-xs self-start sm:self-auto">
                <div className={`w-2 h-2 rounded-full ${
                  systemStatus.backend === 'connected' 
                    ? 'bg-cyber-green shadow-[0_0_6px_rgba(0,255,157,1)]' 
                    : systemStatus.backend === 'checking'
                    ? 'bg-cyber-yellow animate-pulse'
                    : 'bg-cyber-red shadow-[0_0_6px_rgba(255,0,85,1)]'
                }`} />
                <span className={`font-bold ${
                  systemStatus.backend === 'connected' 
                    ? 'text-cyber-green' 
                    : systemStatus.backend === 'checking'
                    ? 'text-cyber-yellow'
                    : 'text-cyber-red'
                }`}>
                  {systemStatus.backend === 'connected' 
                    ? 'Backend Conectado' 
                    : systemStatus.backend === 'checking' 
                    ? 'Verificando...' 
                    : 'Backend Desconectado'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveBackendUrl} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs uppercase text-cyber-cyan/80 font-bold mb-1.5">
                  URL do Servidor Backend
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="flex-1">
                    <CyberInput
                      type="url"
                      value={backendUrlInput}
                      onChange={(e) => setBackendUrlInput(e.target.value)}
                      placeholder="Ex: http://localhost:3000 ou https://seu-ngrok.ngrok-free.app"
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <CyberButton
                      type="submit"
                      disabled={savingBackendUrl}
                      className="flex items-center gap-2 whitespace-nowrap text-xs"
                    >
                      {savingBackendUrl ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Salvar e Testar
                    </CyberButton>
                    {backendUrlInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setBackendUrlInput('');
                          setBackendUrl('');
                          systemStatus.refreshStatus();
                          setBackendTestFeedback({
                            connected: false,
                            message: 'URL removida. O status foi alterado para Desconectado.',
                          });
                        }}
                        className="px-3 py-2 text-xs border border-cyber-red/40 text-cyber-red hover:bg-cyber-red/10 rounded transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {backendTestFeedback && (
                <div className={`p-3 rounded text-xs flex items-center gap-2 border ${
                  backendTestFeedback.connected
                    ? 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green'
                    : 'bg-cyber-red/10 border-cyber-red/40 text-cyber-red'
                }`}>
                  {backendTestFeedback.connected ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{backendTestFeedback.message}</span>
                </div>
              )}

              {systemStatus.backend !== 'connected' && !backendTestFeedback && (
                <div className="p-3 bg-cyber-bg/70 border border-cyber-cyan/20 rounded text-xs text-gray-400 space-y-1">
                  <div className="text-cyber-red font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Status atual: Backend Desconectado
                  </div>
                  <p>
                    {systemStatus.backendError || 'Nenhum servidor detectado. Inicie o backend e informe a URL acima.'}
                  </p>
                </div>
              )}

              <div className="text-[11px] text-gray-400 bg-black/40 p-3 rounded border border-cyber-cyan/10 space-y-1">
                <div className="text-cyber-cyan font-bold">Como obter a URL do seu backend:</div>
                <div>• <strong>Painel e backend no mesmo PC:</strong> Digite <code className="text-cyber-green font-bold">http://localhost:3000</code>.</div>
                <div>• <strong>Painel aberto na nuvem (web):</strong> No terminal do computador onde você iniciou o backend, execute <code className="text-cyber-green font-bold">npx ngrok http 3000</code>, copie o link gerado (ex: <code className="text-cyber-cyan font-bold">https://xxxx.ngrok-free.app</code>) e cole acima.</div>
              </div>
            </form>
          </section>

          {/* SEÇÃO 1: GUIA NUMERADO - COMO RODAR O BACKEND NO WINDOWS E CONECTAR O WHATSAPP */}
          <section className="bg-cyber-card border-2 border-cyber-cyan/30 rounded-xl p-6 space-y-6 shadow-[0_0_25px_rgba(0,229,255,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-cyan/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded-lg text-cyber-cyan">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    GUIA PASSO A PASSO: RODAR O BACKEND NO WINDOWS
                  </h2>
                  <p className="text-xs text-cyber-cyan/70">
                    Siga o roteiro numerado para subir a API local e parear o WhatsApp dedicado.
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-cyber-green/15 text-cyber-green border border-cyber-green/40 self-start sm:self-auto">
                Ambiente Windows
              </span>
            </div>

            {/* Banner de Download Direto do Backend (.zip) */}
            <div className="p-4 bg-gradient-to-r from-[#06101e] to-[#0a1829] border-2 border-cyber-green/40 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(0,255,157,0.1)]">
              <div className="flex items-start sm:items-center gap-3.5 flex-1">
                <div className="p-3 bg-cyber-green/20 border border-cyber-green/50 rounded-lg text-cyber-green shrink-0 shadow-[0_0_12px_rgba(0,255,157,0.3)]">
                  <FileArchive className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm md:text-base font-bold text-white tracking-wide">
                      ARQUIVO DO SERVIDOR: FILTERBYKAKE-BACKEND (.ZIP)
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyber-green/20 text-cyber-green border border-cyber-green/40 font-bold">
                      v1.2 PRONTO
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Esse arquivo contém o servidor que roda no seu computador — depois de baixar, siga o guia abaixo para instalar.
                  </p>
                </div>
              </div>

              <a
                href="/downloads/filterbykake-backend.zip"
                download="filterbykake-backend.zip"
                className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyber-green text-black font-bold text-xs md:text-sm rounded-lg hover:bg-cyber-green/90 transition-all shadow-[0_0_15px_rgba(0,255,157,0.4)] active:scale-95"
              >
                <Download className="w-4 h-4" />
                Baixar Backend (.zip)
              </a>
            </div>

            {/* Grid dos 7 Passos Numerados */}
            <div className="space-y-3">
              {backendSteps.map((step) => (
                <div 
                  key={step.num}
                  className="p-4 bg-[#070b13] border border-cyber-cyan/20 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-cyber-cyan/40 transition-colors"
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {step.num}
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-xs md:text-sm font-bold text-white">
                        {step.title}
                      </h4>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>

                  {step.num === 1 && (
                    <a
                      href="/downloads/filterbykake-backend.zip"
                      download="filterbykake-backend.zip"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyber-green/20 text-cyber-green border border-cyber-green/50 rounded text-xs hover:bg-cyber-green/30 transition-colors font-bold self-start md:self-auto"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar .zip
                    </a>
                  )}

                  {step.command && (
                    <div className="flex items-center gap-2 bg-[#02050b] border border-cyber-cyan/30 rounded px-3 py-1.5 shrink-0 self-start md:self-auto">
                      <code className="text-xs text-cyber-green">
                        {step.command}
                      </code>
                      <button
                        onClick={() => copyToClipboard(step.command!, step.num)}
                        className="p-1 text-gray-400 hover:text-cyber-cyan transition-colors"
                        title="Copiar comando"
                      >
                        {copiedIndex === step.num ? (
                          <Check className="w-3.5 h-3.5 text-cyber-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* SEÇÃO 2: PAINEL WHATSAPP BAILEYS EMBUTIDO */}
          <section className="bg-cyber-card border border-cyber-cyan/20 p-6 rounded-lg space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyber-cyan/20 pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyber-green" />
                <h2 className="text-lg md:text-xl font-bold text-white">
                  WHATSAPP // BAILEYS EMBUTIDO
                </h2>
              </div>

              {/* Status Badge */}
              <div>
                {waStatus.status === 'connected' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-cyber-green/20 text-cyber-green border border-cyber-green/40 rounded-full animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CONECTADO {connectedPhoneNumber ? `(${connectedPhoneNumber})` : ''}
                  </span>
                )}
                {waStatus.status === 'qr' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/40 rounded-full animate-pulse">
                    <QrCode className="w-3.5 h-3.5" /> AGUARDANDO QR CODE
                  </span>
                )}
                {waStatus.status === 'connecting' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 rounded-full">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> CONECTANDO...
                  </span>
                )}
                {waStatus.status === 'disconnected' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-cyber-red/20 text-cyber-red border border-cyber-red/40 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" /> DESCONECTADO
                  </span>
                )}
              </div>
            </div>

            {/* Architecture Explainer */}
            <div className="p-3.5 bg-cyber-cyan/5 border border-cyber-cyan/15 rounded-md text-xs text-cyber-cyan/80 space-y-1">
              <p className="font-bold text-cyber-cyan">ARQUITETURA EMBUTIDA LOCAL:</p>
              <p>• Roda diretamente no mesmo processo do backend Node.js (sem dependência de serviços pagos ou terceiros).</p>
              <p>• A autenticação é gravada em arquivo local (<code className="text-white">baileys_auth/</code>) e reconecta automaticamente ao reiniciar.</p>
              {waStatus.config && (
                <p>• Intervalo anti-bloqueio configurado: <strong className="text-white">{waStatus.config.intervalMin}s a {waStatus.config.intervalMax}s</strong> por mensagem.</p>
              )}
            </div>

            {/* Connection View States */}
            {waStatus.status === 'connected' ? (
              <div className="space-y-6">
                <div className="p-4 bg-cyber-green/5 border border-cyber-green/30 rounded-md flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-8 h-8 text-cyber-green" />
                    <div>
                      <h4 className="text-white font-bold text-sm">Dispositivo Ativo</h4>
                      <p className="text-xs text-cyber-green font-bold mt-0.5">
                        {connectedPhoneNumber || 'Número conectado'} {waStatus.user?.name ? `• ${waStatus.user.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <CyberButton
                    variant="danger"
                    onClick={handleDisconnect}
                    disabled={loadingAction}
                    className="flex items-center gap-2 text-xs"
                  >
                    <LogOut className="w-4 h-4" /> Desconectar Sessão
                  </CyberButton>
                </div>

                {/* Test Message Section */}
                <div className="p-4 bg-cyber-card border border-cyber-cyan/20 rounded-md space-y-4">
                  <h3 className="text-sm font-bold text-cyber-cyan uppercase flex items-center gap-2">
                    <Send className="w-4 h-4" /> Enviar Mensagem de Teste (Validação em Tempo Real)
                  </h3>

                  <form onSubmit={handleSendTest} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-cyber-cyan block mb-1">Telefone (com DDD)</label>
                        <CyberInput
                          placeholder="Ex: 11999999999"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs text-cyber-cyan block mb-1">Texto da Mensagem</label>
                        <CyberInput
                          placeholder="Texto de teste"
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <CyberButton
                        type="submit"
                        variant="primary"
                        disabled={sendingTest}
                        className="flex items-center gap-2 text-xs"
                      >
                        {sendingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sendingTest ? 'Enviando...' : 'Testar Disparo Agora'}
                      </CyberButton>
                    </div>
                  </form>
                </div>
              </div>
            ) : waStatus.status === 'qr' && waStatus.qrCode ? (
              <div className="p-6 bg-cyber-card border border-cyber-yellow/40 rounded-lg flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-lg border-2 border-cyber-yellow shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                  <img
                    src={waStatus.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>

                <div className="space-y-3 text-sm flex-1">
                  <h3 className="text-cyber-yellow font-bold text-base flex items-center gap-2">
                    <QrCode className="w-5 h-5" /> ESCANEIE O QR CODE COM SEU WHATSAPP
                  </h3>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-300 text-xs">
                    <li>Abra o WhatsApp no smartphone com o número dedicado.</li>
                    <li>Toque nos 3 pontinhos ou Configurações &gt; <strong className="text-white">Aparelhos Conectados</strong>.</li>
                    <li>Toque em <strong className="text-white">Conectar um aparelho</strong>.</li>
                    <li>Aponte a câmera para este QR Code ao lado.</li>
                  </ol>
                  <p className="text-xs text-cyber-cyan/80">
                    O status mudará para <strong>CONECTADO</strong> imediatamente após a leitura.
                  </p>

                  <div className="pt-2 flex gap-3">
                    <CyberButton
                      variant="secondary"
                      onClick={() => handleConnect(true)}
                      disabled={loadingAction}
                      className="flex items-center gap-2 text-xs"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingAction ? 'animate-spin' : ''}`} />
                      Gerar Novo QR Code
                    </CyberButton>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-cyber-cyan/30 rounded-md text-center space-y-4">
                <Smartphone className="w-12 h-12 text-cyber-cyan mx-auto opacity-60" />
                <div>
                  <h4 className="text-white font-bold text-sm">Nenhum WhatsApp Conectado</h4>
                  <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                    Conecte seu WhatsApp para habilitar os disparos automatizados com intervalos humanos anti-ban.
                  </p>
                </div>

                {systemStatus.backend !== 'connected' && (
                  <div className="p-3 max-w-md mx-auto bg-cyber-red/10 border border-cyber-red/30 rounded text-xs text-cyber-red flex items-center gap-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>O servidor backend local precisa estar online para iniciar a sessão do WhatsApp. Inicie o backend e informe a URL no card acima.</span>
                  </div>
                )}

                <CyberButton
                  variant="primary"
                  onClick={() => handleConnect(false)}
                  disabled={loadingAction || systemStatus.backend !== 'connected'}
                  className="flex items-center gap-2 mx-auto text-xs py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <QrCode className="w-4 h-4" />
                  {loadingAction ? 'Inicializando Baileys...' : 'Conectar WhatsApp (Gerar QR Code)'}
                </CyberButton>
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
