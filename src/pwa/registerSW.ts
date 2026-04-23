/**
 * Registro do Service Worker do PWA com guards rígidos:
 * - Nunca registra dentro de iframe (preview da Lovable)
 * - Nunca registra em hosts de preview (id-preview--, lovableproject.com)
 * - Em ambientes de preview, faz UNREGISTER de qualquer SW preexistente
 *   para evitar cache antigo atrapalhando a edição.
 */
export async function setupPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isInIframe || isPreviewHost) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      // ignora
    }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch (e) {
    console.warn("[PWA] Falha ao registrar service worker:", e);
  }
}
