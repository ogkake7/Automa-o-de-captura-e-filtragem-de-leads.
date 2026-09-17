import { useState, useEffect, useCallback } from 'react';
import { getBackendUrl, checkBackendStatus } from '../lib/backendConfig';

export interface SystemStatus {
  backend: 'connected' | 'unavailable' | 'checking';
  backendUrl: string;
  backendError: string | null;
  whatsapp: 'connected' | 'disconnected' | 'connecting' | 'qr' | 'checking';
  whatsappPhone: string | null;
  whatsappName: string | null;
  apify: 'connected' | 'not_configured' | 'checking';
  lastChecked: Date | null;
}

// Helper para formatar JID do WhatsApp (ex: "5511999998888:1@s.whatsapp.net") para "+55 11 99999-8888"
export function formatWhatsAppPhone(jidOrNumber?: string | null): string {
  if (!jidOrNumber) return '';
  const rawDigits = jidOrNumber.replace(/@.*$/, '').replace(/:.*$/, '').replace(/\D/g, '');
  if (!rawDigits) return '';

  if (rawDigits.length >= 12 && rawDigits.startsWith('55')) {
    const ddd = rawDigits.slice(2, 4);
    const num = rawDigits.slice(4);
    if (num.length === 9) {
      return `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    if (num.length === 8) {
      return `+55 ${ddd} ${num.slice(0, 4)}-${num.slice(4)}`;
    }
    return `+55 ${ddd} ${num}`;
  }

  return `+${rawDigits}`;
}

export function useSystemStatus(pollIntervalMs = 12000) {
  const currentUrl = typeof window !== 'undefined' ? getBackendUrl() : '';

  // NUNCA começa como 'connected'. Se não há URL configurada, começa imediatamente como 'unavailable'.
  const [status, setStatus] = useState<SystemStatus>({
    backend: currentUrl ? 'checking' : 'unavailable',
    backendUrl: currentUrl,
    backendError: currentUrl ? null : 'URL do backend não configurada',
    whatsapp: 'disconnected',
    whatsappPhone: null,
    whatsappName: null,
    apify: 'not_configured',
    lastChecked: null,
  });

  const checkStatus = useCallback(async () => {
    const url = getBackendUrl();

    // 1. Se a URL não está configurada, o backend está categoricamente DESCONECTADO
    if (!url) {
      setStatus({
        backend: 'unavailable',
        backendUrl: '',
        backendError: 'URL do backend não configurada. Inicie o backend local e preencha a URL nas Configurações.',
        whatsapp: 'disconnected',
        whatsappPhone: null,
        whatsappName: null,
        apify: 'not_configured',
        lastChecked: new Date(),
      });
      return;
    }

    // 2. Chama a validação estrita HTTP 200 + corpo com assinatura de serviço
    const result = await checkBackendStatus(4500);

    if (result.connected && result.data) {
      const waData = result.data.whatsapp || {};
      const isWaConnected = waData.connected === true;
      const rawUser = waData.user;
      const formattedPhone = rawUser?.id ? formatWhatsAppPhone(rawUser.id) : null;
      const userName = rawUser?.name || null;
      const isApifyConfigured = result.data.apify?.configured === true;

      setStatus({
        backend: 'connected',
        backendUrl: url,
        backendError: null,
        whatsapp: isWaConnected ? 'connected' : (waData.status || 'disconnected'),
        whatsappPhone: isWaConnected ? formattedPhone : null,
        whatsappName: isWaConnected ? userName : null,
        apify: isApifyConfigured ? 'connected' : 'not_configured',
        lastChecked: new Date(),
      });
    } else {
      // Qualquer falha: timeout, conexão recusada, 404, 500, ou assinatura ausente
      setStatus({
        backend: 'unavailable',
        backendUrl: url,
        backendError: result.error || 'Servidor indisponível ou offline',
        whatsapp: 'disconnected',
        whatsappPhone: null,
        whatsappName: null,
        apify: 'not_configured',
        lastChecked: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    // Executa a primeira checagem imediatamente
    checkStatus();

    // Repete a cada intervalo (padrão 12 segundos)
    const timer = setInterval(checkStatus, pollIntervalMs);

    // Reage instantaneamente quando a URL do backend for alterada nas configurações
    const handleUrlChange = () => {
      checkStatus();
    };
    window.addEventListener('filterbykake:backend_url_changed', handleUrlChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('filterbykake:backend_url_changed', handleUrlChange);
    };
  }, [checkStatus, pollIntervalMs]);

  return { ...status, refreshStatus: checkStatus };
}
