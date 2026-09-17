import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

/**
 * Gera um identificador único de dispositivo/navegador combinando
 * múltiplos atributos de hardware, canvas, fontes e sistema.
 * Não utiliza métodos intrusivos ou ilegais (como tentativa de HWID).
 */
export async function getBrowserFingerprint(): Promise<string> {
  try {
    if (!fpPromise) {
      fpPromise = FingerprintJS.load();
    }
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  } catch (err) {
    console.warn('[FINGERPRINT] Não foi possível carregar o FingerprintJS:', err);
    // Fallback pseudo-identificador caso o script seja bloqueado por extensões
    const nav = typeof window !== 'undefined' ? window.navigator : ({} as any);
    const raw = [
      nav.userAgent || '',
      nav.language || '',
      screen.colorDepth || '',
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset()
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(36);
  }
}

/**
 * Registra o fingerprint do dispositivo no backend associado ao IP do usuário
 * para prevenção realista de abuso e criação de contas em massa.
 */
export async function registerDeviceFingerprint(idToken: string): Promise<{ success: boolean; flaggedForReview?: boolean } | null> {
  try {
    if (!idToken) return null;
    const visitorId = await getBrowserFingerprint();
    const res = await fetch('/api/auth/register-fingerprint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ visitorId })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[FINGERPRINT] Erro ao registrar fingerprint no servidor:', err);
    return null;
  }
}
