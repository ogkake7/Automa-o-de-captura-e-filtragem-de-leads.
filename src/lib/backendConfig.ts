// Gerenciamento e validação estrita da URL do Backend FilterByKake
const STORAGE_KEY = 'filterbykake_backend_url';

export function getBackendUrl(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null && stored.trim().length > 0) {
    return stored.trim().replace(/\/+$/, '');
  }
  return '';
}

export function setBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY, clean);
  window.dispatchEvent(new CustomEvent('filterbykake:backend_url_changed', { detail: clean }));
}

export interface BackendCheckResult {
  connected: boolean;
  service?: string;
  error?: string;
  url: string;
  data?: any;
}

/**
 * Valida estritamente a conectividade com o backend autônomo.
 * Só retorna connected: true se:
 * 1. A URL estiver configurada e for válida.
 * 2. Responder HTTP status 200.
 * 3. O corpo da resposta contiver explicitamente a assinatura service: "FilterByKake backend".
 */
export async function checkBackendStatus(timeoutMs = 4500): Promise<BackendCheckResult> {
  const url = getBackendUrl();
  
  // Se a URL não foi preenchida, o status é obrigatoriamente desconectado
  if (!url) {
    return {
      connected: false,
      url: '',
      error: 'URL do backend não configurada. Inicie o servidor local e informe a URL.',
    };
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      connected: false,
      url,
      error: 'URL inválida: deve começar com http:// ou https://',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${url}/api/config/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        connected: false,
        url,
        error: `Servidor retornou HTTP ${res.status} (${res.statusText || 'Erro'})`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        connected: false,
        url,
        error: 'A URL respondeu, mas retornou HTML ou conteúdo não-JSON (possível falso positivo de frontend).',
      };
    }

    const data = await res.json();

    // Validação estrita de assinatura do FilterByKake backend
    const hasServiceSignature = data && (data.service === 'FilterByKake backend' || data.ok === true);
    const isOnline = data && (data.backend === 'online' || data.status === 'ok');

    if (hasServiceSignature && isOnline) {
      return {
        connected: true,
        service: data.service || 'FilterByKake backend',
        url,
        data,
      };
    }

    return {
      connected: false,
      url,
      error: 'A resposta não pertence ao FilterByKake backend (assinatura inválida).',
      data,
    };
  } catch (err: any) {
    let errorMsg = 'Conexão recusada ou servidor offline.';
    if (err.name === 'AbortError') {
      errorMsg = `Tempo limite esgotado (${timeoutMs / 1000}s) ao contatar o servidor.`;
    } else if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
      errorMsg = 'Falha ao conectar: certifique-se de que o backend está rodando e aceita CORS.';
    } else if (err.message) {
      errorMsg = err.message;
    }

    return {
      connected: false,
      url,
      error: errorMsg,
    };
  }
}
