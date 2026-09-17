export interface Lead {
  id: string;
  nome: string;
  categoria: string;
  endereco: string;
  cidade: string;
  estado: string;
  telefone: string;
  site: string | null;
  semSite: boolean;
  siteRuim: boolean;
  avaliacoes: number;
  nota: number;
  poucasAvaliacoes: boolean;
  notaBaixa: boolean;
  whatsappStatus: string; // 'ativo', 'inativo', 'desconhecido'
  score: number;
  googleMapsUrl?: string;
  capturedAt: any; // Firestore Timestamp
  searchId?: string; // ID do run/projeto
  projectName?: string; // Nome do projeto/pasta
  capturedBy?: string; // UID da conta que realizou a captura
  createdBy?: string;
  userId?: string;
  manual: Record<string, any>;
  source?: 'apify' | 'manual_import' | 'manual';
}

export interface TeamUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'vendedor';
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
  flaggedForReview?: boolean;
  flagReason?: string;
  visitorId?: string;
  lastKnownIp?: string;
}

export interface ProjectFolder {
  id: string; // searchId ou slug
  name: string;
  leadsCount: number;
  createdAt?: any;
  category?: string;
  location?: string;
}

export interface CampaignLog {
  id: string; // batch item id
  leadId: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  timestamp: any; // Firestore Timestamp
}

export interface ApifySearchOptions {
  projectName: string;
  // Localização e área
  searchStrings: string[]; // Múltiplos termos (ex: restaurante, pizzaria)
  locationQuery: string; // Texto livre (ex: São Paulo, SP)
  countryCode?: string; // Código de país (ex: br, us)
  state?: string; // Estado
  city?: string; // Cidade
  postalCode?: string; // CEP
  zoom?: number; // Nível de zoom da área de busca (1 a 21)
  customCircle?: {
    lat: number;
    lng: number;
    radiusKm: number;
  };
  // Volume e idioma
  language?: string; // Idioma dos resultados (ex: pt, en)
  maxCrawledPlacesPerSearch?: number; // Limite numérico ou indefinido para todos
  allPlaces?: boolean; // Capturar todos os lugares disponíveis
  // Filtros de qualificação
  maxRating?: number; // Nota máxima (para prospectar quem precisa melhorar reputação)
  minRating?: number; // Nota mínima
  onlyWithoutWebsite?: boolean; // Apenas sem site cadastrado
  onlyWithWebsite?: boolean; // Apenas com site
  skipClosed?: boolean; // Pular estabelecimentos fechados permanentemente
  minReviewsCount?: number; // Mínimo de avaliações
  maxReviewsCount?: number; // Máximo de avaliações
  // Dados extras opcionais
  maxImages?: number; // Quantidade de fotos (0 para desativar)
  maxReviews?: number; // Quantidade de reviews a extrair
  reviewsSort?: 'newest' | 'mostRelevant';
  scrapePopularTimes?: boolean; // Horários populares
  scrapePeopleAlsoSearch?: boolean; // Concorrentes "pessoas também buscaram"
}
