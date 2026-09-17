import React, { useState } from 'react';
import { 
  Search, 
  Loader2, 
  AlertTriangle, 
  Globe, 
  Sliders, 
  MapPin, 
  Plus, 
  Trash2, 
  CheckCircle,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  Activity,
  ArrowRight,
  Info
} from 'lucide-react';
import { CyberButton } from '../components/CyberButton';
import { useAuth } from '../contexts/AuthContext';
import { ApifySearchOptions } from '../types';
import { useNavigate } from 'react-router-dom';

export function NewSearch() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();

  // Core Essential Search Parameters
  const [searchTermInput, setSearchTermInput] = useState('restaurante');
  const [searchTerms, setSearchTerms] = useState<string[]>(['restaurante']);
  const [locationQuery, setLocationQuery] = useState('');
  const [projectName, setProjectName] = useState('');

  // Expandable sections
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const [showQualificationFilters, setShowQualificationFilters] = useState(false);
  const [showDataSettings, setShowDataSettings] = useState(false);

  // Advanced Location (Optional)
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState(''); // Empty string by default; only 2-letter code if user enters (e.g. 'br')
  const [zoom, setZoom] = useState<number>(14);
  const [useCoordinates, setUseCoordinates] = useState(false);
  const [centerLat, setCenterLat] = useState('');
  const [centerLng, setCenterLng] = useState('');

  // Language & Volume Settings (Optional)
  const [language, setLanguage] = useState('pt-BR');
  const [allPlaces, setAllPlaces] = useState(false);
  const [maxCrawledPlaces, setMaxCrawledPlaces] = useState(50);
  const [maxImages, setMaxImages] = useState(0);
  const [maxReviews, setMaxReviews] = useState(0);
  const [reviewsSort, setReviewsSort] = useState<'newest' | 'mostRelevant'>('newest');

  // Qualification Filters (Optional)
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(false);
  const [skipClosed, setSkipClosed] = useState(true);
  const [minRating, setMinRating] = useState('');
  const [maxRating, setMaxRating] = useState('');
  const [minReviews, setMinReviews] = useState('');
  const [maxReviewsFilter, setMaxReviewsFilter] = useState('');

  // Execution State
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLaunch, setSuccessLaunch] = useState<{ runId: string; projectName: string } | null>(null);

  // Multiple search terms helper
  const handleAddTerm = () => {
    const trimmed = searchTermInput.trim();
    if (trimmed && !searchTerms.includes(trimmed)) {
      setSearchTerms([...searchTerms, trimmed]);
      setSearchTermInput('');
    }
  };

  const handleRemoveTerm = (index: number) => {
    if (searchTerms.length > 1) {
      setSearchTerms(searchTerms.filter((_, i) => i !== index));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure at least one term is present
    const effectiveTerms = [...searchTerms];
    if (searchTermInput.trim() && !effectiveTerms.includes(searchTermInput.trim())) {
      effectiveTerms.push(searchTermInput.trim());
    }

    if (effectiveTerms.length === 0) {
      setError("Insira pelo menos um termo de busca (ex: 'dentista', 'restaurante').");
      return;
    }

    setIsSearching(true);
    setError(null);
    setSuccessLaunch(null);

    const generatedProjectName = projectName.trim() || `Busca_${effectiveTerms[0]}_${new Date().toISOString().slice(0, 10)}`;

    // CountryCode logic:
    // Only send countryCode if explicitly filled and valid 2 letters (lowercase 'br', 'us')
    // Otherwise send undefined or empty string, NEVER locale like "pt-BR"
    let cleanCountryCode: string | undefined = undefined;
    if (countryCode && countryCode.trim()) {
      const code = countryCode.trim().toLowerCase();
      if (/^[a-z]{2}$/.test(code)) {
        cleanCountryCode = code;
      }
    }

    const payload: ApifySearchOptions = {
      projectName: generatedProjectName,
      searchStrings: effectiveTerms,
      locationQuery: locationQuery.trim() || undefined,
      countryCode: cleanCountryCode,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      zoom: Number(zoom),
      ...(useCoordinates && centerLat && centerLng ? {
        customCircle: {
          lat: Number(centerLat),
          lng: Number(centerLng),
          radiusKm: 10
        }
      } : {}),
      language, // Maps strictly to Apify language parameter (e.g. 'pt-BR' or 'pt')
      maxCrawledPlacesPerSearch: allPlaces ? undefined : maxCrawledPlaces,
      allPlaces,
      minRating: minRating ? Number(minRating) : undefined,
      maxRating: maxRating ? Number(maxRating) : undefined,
      onlyWithoutWebsite,
      onlyWithWebsite,
      skipClosed,
      minReviewsCount: minReviews ? Number(minReviews) : undefined,
      maxReviewsCount: maxReviewsFilter ? Number(maxReviewsFilter) : undefined,
      maxImages: Number(maxImages),
      maxReviews: Number(maxReviews),
      reviewsSort
    };

    try {
      const token = await getIdToken();
      if (!token) throw new Error("Usuário não autenticado.");

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar busca no servidor.');
      }

      setSuccessLaunch({
        runId: data.runId,
        projectName: generatedProjectName
      });

      // Auto-navigate to Monitoring tab after a short feedback display
      setTimeout(() => {
        navigate(`/monitoring?runId=${data.runId}`);
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com backend');
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyber-cyan/20 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
            NOVA<span className="text-cyber-green">_BUSCA</span>
          </h1>
          <p className="text-xs md:text-sm text-cyber-cyan/70">
            Encontre estabelecimentos e empresas no Google Maps via Apify de forma rápida e qualificada.
          </p>
        </div>

        <button 
          type="button"
          onClick={() => navigate('/monitoring')}
          className="text-xs text-cyber-cyan hover:text-cyber-green flex items-center gap-1.5 self-start sm:self-auto py-1 px-2.5 rounded border border-cyber-cyan/30 hover:border-cyber-green/50 transition-colors font-mono"
        >
          <Activity className="w-3.5 h-3.5 text-cyber-green" />
          Acessar Monitoramento →
        </button>
      </header>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-cyber-red/10 border border-cyber-red/40 rounded-lg flex items-start gap-3 text-cyber-red">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs md:text-sm">
            <strong>Falha na validação ou requisição:</strong>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Success launch banner */}
      {successLaunch && (
        <div className="p-4 bg-cyber-green/15 border border-cyber-green/50 rounded-lg flex items-center justify-between gap-3 text-cyber-green shadow-[0_0_20px_rgba(0,255,157,0.15)]">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-bold font-mono">Extração iniciada com sucesso!</p>
              <p className="text-xs text-gray-300">
                Projeto: <strong className="text-white">{successLaunch.projectName}</strong> | Redirecionando para o Console de Monitoramento...
              </p>
            </div>
          </div>
          <CyberButton 
            variant="primary" 
            onClick={() => navigate(`/monitoring?runId=${successLaunch.runId}`)}
            className="text-xs py-1.5 px-3 flex items-center gap-1"
          >
            Ver Agora <ArrowRight className="w-3.5 h-3.5" />
          </CyberButton>
        </div>
      )}

      <form onSubmit={handleSearch} className="space-y-5">
        
        {/* ========================================================
            CARD PRINCIPAL: CAMPOS ESSENCIAIS (SIMPLIFICADO)
           ======================================================== */}
        <div className="bg-cyber-card border border-cyber-cyan/30 rounded-lg p-5 space-y-4 shadow-[0_0_15px_rgba(0,229,255,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyber-green uppercase font-mono tracking-wider flex items-center gap-2">
              <Search className="w-4 h-4" /> Parâmetros Principais da Pesquisa
            </span>
            <span className="text-[11px] text-gray-400 font-mono">
              * Apenas Termo e Localização são obrigatórios
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. TERMO DE BUSCA */}
            <div>
              <label className="text-xs font-medium text-gray-200 block mb-1">
                Termo de Busca / Segmento <span className="text-cyber-green">*</span>
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={searchTermInput}
                  onChange={(e) => setSearchTermInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTerm();
                    }
                  }}
                  placeholder="Ex: restaurantes, clínicas odontológicas, imobiliárias"
                  className="flex-1 bg-[#0d131f] border border-cyber-cyan/40 rounded p-2.5 text-white text-sm focus:border-cyber-green outline-none"
                  required={searchTerms.length === 0}
                />
                <button
                  type="button"
                  onClick={handleAddTerm}
                  title="Adicionar mais um termo para varredura combinada"
                  className="px-3 bg-cyber-bg border border-cyber-cyan/40 hover:border-cyber-green text-cyber-cyan hover:text-cyber-green rounded text-xs flex items-center gap-1 font-mono transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> +Termo
                </button>
              </div>

              {/* Multiple terms chips */}
              {searchTerms.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {searchTerms.map((term, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-cyber-bg border border-cyber-green/30 text-cyber-green text-xs font-mono"
                    >
                      {term}
                      {searchTerms.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveTerm(i)}
                          className="text-gray-400 hover:text-cyber-red ml-0.5"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <span className="text-[11px] text-gray-500 block mt-1">
                Você pode pesquisar múltiplos nichos na mesma varredura adicionando termos.
              </span>
            </div>

            {/* 2. LOCALIZAÇÃO GERAL */}
            <div>
              <label className="text-xs font-medium text-gray-200 block mb-1">
                Localização (Cidade, Bairro ou Região) <span className="text-cyber-green">*</span>
              </label>
              <input 
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Ex: São Paulo, SP ou Copacabana, Rio de Janeiro"
                className="w-full bg-[#0d131f] border border-cyber-cyan/40 rounded p-2.5 text-white text-sm focus:border-cyber-green outline-none"
                required
              />
              <span className="text-[11px] text-gray-500 block mt-1">
                Texto livre como no Google Maps (cidade, estado ou avenida).
              </span>
            </div>
          </div>

          {/* PROJETO / PASTA (Opcional com default inteligente) */}
          <div className="pt-2 border-t border-cyber-cyan/15">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-300 block mb-1">
                  Nome do Projeto / Pasta de Destino: <span className="text-gray-500 text-[11px] font-normal">(opcional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-cyber-cyan shrink-0" />
                  <input 
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={`Ex: Prospecção ${searchTermInput || searchTerms[0] || 'Geral'} - ${new Date().toLocaleDateString('pt-BR')}`}
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs focus:border-cyber-green outline-none font-mono"
                  />
                </div>
              </div>

              <div className="sm:w-56">
                <label className="text-xs text-gray-300 block mb-1">
                  Limite de Locais:
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    min={5}
                    max={500}
                    value={maxCrawledPlaces}
                    disabled={allPlaces}
                    onChange={(e) => setMaxCrawledPlaces(Number(e.target.value))}
                    className="w-24 bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs disabled:opacity-50"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={allPlaces}
                      onChange={(e) => setAllPlaces(e.target.checked)}
                      className="accent-cyber-green"
                    />
                    Todos
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            SEÇÕES AVANÇADAS COLAPSÁVEIS (REDUÇÃO DE DENSIDADE)
           ======================================================== */}

        {/* SEÇÃO 1: REFINAMENTO DE LOCALIZAÇÃO (Colapsável) */}
        <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvancedLocation(!showAdvancedLocation)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-cyber-cyan/5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-cyber-cyan" />
              <div>
                <span className="text-xs md:text-sm font-bold text-white font-mono">
                  Refinamento Geográfico Avançado
                </span>
                <span className="text-[11px] text-gray-400 block">
                  {city || state || countryCode ? `Ativo: ${[city, state, countryCode].filter(Boolean).join(', ')}` : 'Cidade, Estado, Código de País (ISO), Zoom e Raio (opcional)'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyber-cyan font-mono">
              <span>{showAdvancedLocation ? 'Ocultar' : 'Configurar'}</span>
              {showAdvancedLocation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showAdvancedLocation && (
            <div className="p-5 border-t border-cyber-cyan/20 space-y-4 bg-[#080d16]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">Cidade específica:</label>
                  <input 
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Campinas"
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs focus:border-cyber-green outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">Estado (UF):</label>
                  <input 
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Ex: SP"
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs focus:border-cyber-green outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">CEP / Postal Code:</label>
                  <input 
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Ex: 01310-100"
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs focus:border-cyber-green outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">
                    País (Código ISO de 2 letras):
                  </label>
                  <input 
                    type="text"
                    maxLength={2}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toLowerCase())}
                    placeholder="Ex: br (ou vazio para global)"
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs focus:border-cyber-green outline-none font-mono lowercase"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Ex: <code>br</code>, <code>us</code>. Se vazio, busca sem restrição estrita.
                  </span>
                </div>
              </div>

              {/* Zoom & Coordenadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-cyber-cyan/10">
                <div>
                  <div className="flex justify-between text-xs text-gray-300 mb-1">
                    <span>Nível de Zoom da Varredura:</span>
                    <strong className="text-cyber-green font-mono">{zoom}</strong>
                  </div>
                  <input 
                    type="range"
                    min={8}
                    max={19}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-cyber-green cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>8 (Estado)</span>
                    <span>14 (Cidade/Bairro)</span>
                    <span>19 (Rua)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={useCoordinates}
                      onChange={(e) => setUseCoordinates(e.target.checked)}
                      className="accent-cyber-green"
                    />
                    Usar Coordenadas Geográficas Centrais (Lat/Lng)
                  </label>

                  {useCoordinates && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input 
                        type="text"
                        value={centerLat}
                        onChange={(e) => setCenterLat(e.target.value)}
                        placeholder="Latitude (ex: -23.5505)"
                        className="bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs"
                      />
                      <input 
                        type="text"
                        value={centerLng}
                        onChange={(e) => setCenterLng(e.target.value)}
                        placeholder="Longitude (ex: -46.6333)"
                        className="bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 2: FILTROS DE QUALIFICAÇÃO DE LEADS (Colapsável) */}
        <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowQualificationFilters(!showQualificationFilters)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-cyber-cyan/5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-cyber-cyan" />
              <div>
                <span className="text-xs md:text-sm font-bold text-white font-mono">
                  Filtros de Qualificação Comercial
                </span>
                <span className="text-[11px] text-gray-400 block">
                  {onlyWithoutWebsite ? 'Apenas sem site • ' : ''}
                  {minRating || maxRating ? `Nota: ${minRating || '0'}-${maxRating || '5'} • ` : ''}
                  Sites, reputação no Google Maps, notas e avaliações mínimas
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyber-cyan font-mono">
              <span>{showQualificationFilters ? 'Ocultar' : 'Configurar'}</span>
              {showQualificationFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showQualificationFilters && (
            <div className="p-5 border-t border-cyber-cyan/20 space-y-4 bg-[#080d16]">
              {/* Presença de website */}
              <div>
                <span className="text-xs font-medium text-gray-200 block mb-2">Presença Digital (Site):</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={`p-3 rounded border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                    !onlyWithoutWebsite && !onlyWithWebsite 
                      ? 'bg-cyber-cyan/15 border-cyber-cyan text-white' 
                      : 'bg-[#0d131f] border-cyber-cyan/20 text-gray-400'
                  }`}>
                    <input 
                      type="radio" 
                      name="siteFilter" 
                      checked={!onlyWithoutWebsite && !onlyWithWebsite}
                      onChange={() => { setOnlyWithoutWebsite(false); setOnlyWithWebsite(false); }}
                      className="accent-cyber-cyan"
                    />
                    Todos (com ou sem site)
                  </label>

                  <label className={`p-3 rounded border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                    onlyWithoutWebsite 
                      ? 'bg-cyber-green/15 border-cyber-green text-cyber-green font-bold' 
                      : 'bg-[#0d131f] border-cyber-cyan/20 text-gray-400'
                  }`}>
                    <input 
                      type="radio" 
                      name="siteFilter" 
                      checked={onlyWithoutWebsite}
                      onChange={() => { setOnlyWithoutWebsite(true); setOnlyWithWebsite(false); }}
                      className="accent-cyber-green"
                    />
                    🎯 Apenas SEM Site (Alvos ideais)
                  </label>

                  <label className={`p-3 rounded border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                    onlyWithWebsite 
                      ? 'bg-cyber-cyan/15 border-cyber-cyan text-white' 
                      : 'bg-[#0d131f] border-cyber-cyan/20 text-gray-400'
                  }`}>
                    <input 
                      type="radio" 
                      name="siteFilter" 
                      checked={onlyWithWebsite}
                      onChange={() => { setOnlyWithoutWebsite(false); setOnlyWithWebsite(true); }}
                      className="accent-cyber-cyan"
                    />
                    Apenas com Site
                  </label>
                </div>
              </div>

              {/* Status do estabelecimento e notas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-cyber-cyan/10">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="skipClosedCheck"
                    checked={skipClosed}
                    onChange={(e) => setSkipClosed(e.target.checked)}
                    className="accent-cyber-green w-4 h-4"
                  />
                  <label htmlFor="skipClosedCheck" className="text-xs text-gray-300 cursor-pointer">
                    Ignorar locais permanentemente fechados
                  </label>
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">Faixa de Nota (0 - 5.0):</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="5"
                      value={minRating} 
                      onChange={(e) => setMinRating(e.target.value)}
                      placeholder="Min" 
                      className="w-1/2 bg-[#0d131f] border border-cyber-cyan/30 rounded p-1.5 text-white text-xs"
                    />
                    <span className="text-gray-500 text-xs">a</span>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="5"
                      value={maxRating} 
                      onChange={(e) => setMaxRating(e.target.value)}
                      placeholder="Max" 
                      className="w-1/2 bg-[#0d131f] border border-cyber-cyan/30 rounded p-1.5 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">Nº de Avaliações:</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      value={minReviews} 
                      onChange={(e) => setMinReviews(e.target.value)}
                      placeholder="Min" 
                      className="w-1/2 bg-[#0d131f] border border-cyber-cyan/30 rounded p-1.5 text-white text-xs"
                    />
                    <span className="text-gray-500 text-xs">a</span>
                    <input 
                      type="number" 
                      min="0" 
                      value={maxReviewsFilter} 
                      onChange={(e) => setMaxReviewsFilter(e.target.value)}
                      placeholder="Max" 
                      className="w-1/2 bg-[#0d131f] border border-cyber-cyan/30 rounded p-1.5 text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 3: IDIOMA E DADOS EXTRAS DO SCRAPER (Colapsável) */}
        <div className="bg-cyber-card border border-cyber-cyan/20 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDataSettings(!showDataSettings)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-cyber-cyan/5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-cyber-cyan" />
              <div>
                <span className="text-xs md:text-sm font-bold text-white font-mono">
                  Idioma & Detalhes Extras (Imagens e Avaliações)
                </span>
                <span className="text-[11px] text-gray-400 block">
                  Idioma padrão: {language} • Fotos por local: {maxImages} • Avaliações por local: {maxReviews}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyber-cyan font-mono">
              <span>{showDataSettings ? 'Ocultar' : 'Configurar'}</span>
              {showDataSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showDataSettings && (
            <div className="p-5 border-t border-cyber-cyan/20 space-y-4 bg-[#080d16]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">Idioma da Consulta (Language):</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs focus:border-cyber-green outline-none"
                  >
                    <option value="pt-BR">Português do Brasil (pt-BR)</option>
                    <option value="pt">Português Geral (pt)</option>
                    <option value="en">Inglês (en)</option>
                    <option value="es">Espanhol (es)</option>
                  </select>
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Controla o campo <code>language</code> da Apify (nunca afeta countryCode).
                  </span>
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">Fotos por Local ({maxImages}):</label>
                  <input 
                    type="number"
                    min={0}
                    max={10}
                    value={maxImages}
                    onChange={(e) => setMaxImages(Number(e.target.value))}
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    0 para economia de cota e velocidade máxima.
                  </span>
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">Reviews por Local ({maxReviews}):</label>
                  <input 
                    type="number"
                    min={0}
                    max={20}
                    value={maxReviews}
                    onChange={(e) => setMaxReviews(Number(e.target.value))}
                    className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2 text-white text-xs"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Extrai comentários textuais detalhados.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3">
          <div className="flex items-center gap-2 text-xs text-cyber-cyan/70 font-mono">
            <Info className="w-4 h-4 text-cyber-green shrink-0" />
            <span>Gravação segura via Firebase Admin SDK. O progresso será transmitido em tempo real.</span>
          </div>

          <CyberButton 
            type="submit" 
            variant="primary" 
            disabled={isSearching} 
            className="w-full sm:w-auto px-8 py-3 text-sm font-bold flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(0,255,157,0.25)]"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isSearching ? 'INICIALIZANDO EXTRAÇÃO...' : 'INICIAR EXTRAÇÃO GOOGLE PLACES'}
          </CyberButton>
        </div>

      </form>
    </div>
  );
}
