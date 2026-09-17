import React, { useState } from 'react';
import { 
  Zap, 
  BookOpen, 
  Smartphone, 
  Search, 
  Radio, 
  Database, 
  Send, 
  ShieldCheck, 
  Filter, 
  Code, 
  Layers, 
  HelpCircle, 
  ExternalLink,
  CheckCircle2,
  Terminal,
  Settings,
  ArrowRight,
  Download,
  FileArchive,
  Server
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CyberButton } from '../components/CyberButton';

export function Help() {
  const [guideMode, setGuideMode] = useState<'QUICK' | 'DETAILED'>('QUICK');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            CENTRAL<span className="text-cyber-green">_AJUDA</span>
          </h1>
          <p className="text-xs md:text-sm text-cyber-cyan/70">
            Guia de utilização operacional do FILTERBYKAKE CyberDash.
          </p>
        </div>

        {/* Toggle Mode: Resumido / Detalhado */}
        <div className="flex items-center p-1 bg-cyber-card border border-cyber-cyan/30 rounded-lg self-start sm:self-auto font-mono text-xs">
          <button
            onClick={() => setGuideMode('QUICK')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              guideMode === 'QUICK'
                ? 'bg-cyber-green text-black font-bold shadow-[0_0_10px_rgba(0,255,157,0.4)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Modo Rápido (Leigos)
          </button>

          <button
            onClick={() => setGuideMode('DETAILED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              guideMode === 'DETAILED'
                ? 'bg-cyber-cyan text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Modo Detalhado (Técnico)
          </button>
        </div>
      </header>

      {/* Banner de Download do Servidor Backend (.zip) */}
      <div className="p-4 bg-gradient-to-r from-[#06101e] to-[#0a1829] border-2 border-cyber-cyan/40 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(0,229,255,0.08)] font-mono">
        <div className="flex items-start sm:items-center gap-3.5 flex-1">
          <div className="p-3 bg-cyber-cyan/15 border border-cyber-cyan/40 rounded-lg text-cyber-cyan shrink-0 shadow-[0_0_12px_rgba(0,229,255,0.2)]">
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

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <a
            href="/downloads/filterbykake-backend.zip"
            download="filterbykake-backend.zip"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyber-green text-black font-bold text-xs md:text-sm rounded-lg hover:bg-cyber-green/90 transition-all shadow-[0_0_15px_rgba(0,255,157,0.4)] active:scale-95"
          >
            <Download className="w-4 h-4" />
            Baixar Backend (.zip)
          </a>

          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-cyber-cyan border border-cyber-cyan/30 rounded-lg hover:bg-cyber-cyan/10 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Ver Guia Windows
          </Link>
        </div>
      </div>

      {/* MODO RÁPIDO (INICIANTES / LEIGOS) */}
      {guideMode === 'QUICK' && (
        <div className="space-y-6">
          <div className="p-4 bg-cyber-green/10 border border-cyber-green/30 rounded-lg flex items-center gap-3">
            <Zap className="w-5 h-5 text-cyber-green shrink-0" />
            <span className="text-xs md:text-sm text-gray-200 font-mono">
              <strong>Fluxo simplificado em 4 etapas:</strong> siga a ordem abaixo para capturar contatos do Google Maps e disparar mensagens com rapidez.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
            {/* Passo 1 */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 relative overflow-hidden space-y-3 hover:border-cyber-green/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-cyber-green/20 text-cyber-green border border-cyber-green/40 flex items-center justify-center font-bold text-sm">
                  1
                </span>
                <Smartphone className="w-5 h-5 text-cyber-green" />
              </div>
              <h3 className="text-base font-bold text-white">Conecte o WhatsApp</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Vá até a tela de <strong>Configurações</strong> e clique em Conectar WhatsApp. Escaneie o QR Code que aparecer na tela usando o aplicativo do WhatsApp no celular. Quando aparecer "CONECTADO", seu número já está pronto para disparos.
              </p>
              <Link to="/settings" className="inline-flex items-center gap-1 text-xs text-cyber-green hover:underline pt-1">
                Ir para Configurações <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Passo 2 */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 relative overflow-hidden space-y-3 hover:border-cyber-cyan/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 flex items-center justify-center font-bold text-sm">
                  2
                </span>
                <Search className="w-5 h-5 text-cyber-cyan" />
              </div>
              <h3 className="text-base font-bold text-white">Faça uma Nova Busca</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Acesse <strong>Nova Busca</strong>, dê um nome para o seu projeto (ex: <em>Restaurantes Moema</em>), digite o nicho comercial e a cidade desejada. Escolha a quantidade e clique no botão verde para iniciar a extração automática.
              </p>
              <Link to="/search" className="inline-flex items-center gap-1 text-xs text-cyber-cyan hover:underline pt-1">
                Iniciar Nova Busca <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Passo 3 */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 relative overflow-hidden space-y-3 hover:border-cyber-yellow/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/40 flex items-center justify-center font-bold text-sm">
                  3
                </span>
                <Radio className="w-5 h-5 text-cyber-yellow" />
              </div>
              <h3 className="text-base font-bold text-white">Acompanhe no Monitoramento</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Na aba <strong>Monitoramento</strong>, você vê em tempo real os contatos sendo encontrados no Google Maps, com contador ao vivo e registros. Os dados são salvos automaticamente na sua pasta sem precisar recarregar a página.
              </p>
              <Link to="/monitoring" className="inline-flex items-center gap-1 text-xs text-cyber-yellow hover:underline pt-1">
                Abrir Monitoramento <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Passo 4 */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 relative overflow-hidden space-y-3 hover:border-cyber-green/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-cyber-green/20 text-cyber-green border border-cyber-green/40 flex items-center justify-center font-bold text-sm">
                  4
                </span>
                <Send className="w-5 h-5 text-cyber-green" />
              </div>
              <h3 className="text-base font-bold text-white">Selecione e Dispare</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Abra a pasta do projeto em <strong>Leads Capturados</strong>. Marque os contatos que deseja contatar e clique em <em>Disparar WhatsApp</em>. O sistema envia as mensagens automaticamente com intervalos humanos para segurança da sua conta.
              </p>
              <Link to="/leads" className="inline-flex items-center gap-1 text-xs text-cyber-green hover:underline pt-1">
                Ver Leads Capturados <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MODO DETALHADO (QUEM JÁ MANJA / TÉCNICO) */}
      {guideMode === 'DETAILED' && (
        <div className="space-y-6 font-mono">
          <div className="p-4 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded-lg flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-cyber-cyan shrink-0" />
            <span className="text-xs md:text-sm text-gray-200">
              <strong>Documentação Arquitetural e Operacional Detalhada:</strong> entenda como funcionam os filtros de qualificação da Apify, a persistência local e as travas anti-bloqueio de disparos.
            </span>
          </div>

          <div className="space-y-4">
            {/* Seção 1: Filtros Apify */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 space-y-3">
              <h3 className="text-sm md:text-base font-bold text-cyber-green flex items-center gap-2">
                <Filter className="w-4 h-4" /> 1. Filtros Avançados de Qualificação (Apify Google Places)
              </h3>
              <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                <p>
                  Ao executar uma busca, os dados brutos retornados pelo crawler oficial da Apify (<code>compass~crawler-google-places</code>) passam por uma camada intermediária de validação antes de serem salvos no banco:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-400">
                  <li>
                    <strong className="text-white">Apenas sem website:</strong> descarta automaticamente empresas que já possuem site cadastrado, isolando oportunidades de alta conversão para venda de desenvolvimento web.
                  </li>
                  <li>
                    <strong className="text-white">Filtro de Avaliações e Rating:</strong> permite buscar apenas comércios com nota abaixo de 4.0 (oportunidade de gestão de reputação) ou com menos de 10 avaliações.
                  </li>
                  <li>
                    <strong className="text-white">Normalização telefônica:</strong> números são higienizados e validados com código de país (+55) para compatibilidade nativa com a API do Baileys.
                  </li>
                </ul>
              </div>
            </div>

            {/* Seção 2: Fila de Disparos e Anti-Bloqueio */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 space-y-3">
              <h3 className="text-sm md:text-base font-bold text-cyber-cyan flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> 2. Fila de Disparos e Proteção Anti-Ban (Baileys)
              </h3>
              <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                <p>
                  O motor de disparos utiliza a biblioteca <strong>Baileys (WebSockets)</strong> rodando embutida no backend Node.js, com as seguintes políticas de segurança:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-400">
                  <li>
                    <strong className="text-white">Intervalo randômico:</strong> cada mensagem é enviada com um atraso entre 18 e 35 segundos (configurável no <code>.env</code> com <code>DISPARO_INTERVALO_MIN</code> e <code>DISPARO_INTERVALO_MAX</code>), emulando o comportamento de digitação humano.
                  </li>
                  <li>
                    <strong className="text-white">Variáveis dinâmicas:</strong> use tags como <code className="text-cyber-green">{'{nome}'}</code>, <code className="text-cyber-green">{'{cidade}'}</code> e <code className="text-cyber-green">{'{categoria}'}</code> para que cada mensagem seja única, reduzindo heurísticas de spam no WhatsApp.
                  </li>
                  <li>
                    <strong className="text-white">Persistência da sessão:</strong> as chaves criptográficas da sessão são salvas em <code>baileys_auth/</code>, permitindo reconexão automática sem novo QR Code após reiniciar o servidor.
                  </li>
                </ul>
              </div>
            </div>

            {/* Seção 3: Organização por Pastas e Ações Destrutivas */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 space-y-3">
              <h3 className="text-sm md:text-base font-bold text-cyber-yellow flex items-center gap-2">
                <Database className="w-4 h-4" /> 3. Organização por Pastas e Confirmação de Segurança
              </h3>
              <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                <p>
                  A aba <strong>Leads Capturados</strong> adota o paradigma de projetos/pastas em primeiro lugar. Cada extração cria ou vincula-se a um projeto.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-400">
                  <li>
                    <strong className="text-white">Ações em massa:</strong> você pode selecionar leads pontuais ou clicar em "Selecionar Todos" dentro da pasta ou na visão geral.
                  </li>
                  <li>
                    <strong className="text-white">Confirmação dupla em exclusões:</strong> ações como "Remover Selecionados" e "Limpar Seção" exibem modais de alerta destrutivo para prevenir remoções acidentais.
                  </li>
                  <li>
                    <strong className="text-white">Exportação:</strong> baixe os dados da pasta ou de leads selecionados a qualquer momento em formato <strong>CSV (compatível com Excel)</strong> ou <strong>JSON</strong>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Seção 4: Troubleshooting */}
            <div className="bg-cyber-card border border-cyber-cyan/20 rounded-xl p-5 space-y-3">
              <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyber-red" /> 4. Resolução de Problemas Comuns (FAQ)
              </h3>
              <div className="text-xs text-gray-300 space-y-3 leading-relaxed">
                <div className="p-3 bg-cyber-bg rounded border border-cyber-cyan/15">
                  <strong className="text-cyber-green block mb-1">Q: O QR Code do WhatsApp expirou antes de escanear.</strong>
                  <span className="text-gray-400">R: Basta clicar em "Reconectar WhatsApp" na tela de Configurações para gerar um novo QR Code atualizado.</span>
                </div>
                <div className="p-3 bg-cyber-bg rounded border border-cyber-cyan/15">
                  <strong className="text-cyber-green block mb-1">Q: A busca no Apify falhou ou retornou 0 resultados.</strong>
                  <span className="text-gray-400">R: Verifique se o seu <code>APIFY_TOKEN</code> possui créditos válidos e se o termo de busca não está excessivamente restrito.</span>
                </div>
                <div className="p-3 bg-cyber-bg rounded border border-cyber-cyan/15">
                  <strong className="text-cyber-green block mb-1">Q: Como rodar o backend localmente no meu computador?</strong>
                  <span className="text-gray-400">R: Siga as instruções passo a passo numeradas na aba de Configurações, utilizando terminal PowerShell ou CMD.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
