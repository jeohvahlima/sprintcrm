import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./pwa/registerSW";

// Registra o PWA (com guards para iframe/preview da Lovable)
setupPWA();

// Silenciar avisos específicos que atrapalham a verificação visual em dev
const originalWarn = console.warn;
console.warn = (...args) => {
  const first = args?.[0];
  const skip =
    (typeof first === 'string' && first.includes('Missing `Description`') && first.includes('{DialogContent}')) ||
    (typeof first === 'string' && first.includes('React Router Future Flag Warning')) ||
    (typeof first === 'string' && first.includes('[REALTIME] Canal desconectado'));
  if (skip) return;
  return originalWarn.apply(console, args);
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("❌ Elemento root não encontrado!");
  throw new Error("Failed to find the root element");
}

// Tratamento de erros não capturados
window.addEventListener('error', (event) => {
  console.error("❌ Erro não capturado:", event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error("❌ Promise rejeitada não tratada:", event.reason);
});

try {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("❌ Erro ao renderizar aplicação:", error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: system-ui; padding: 20px; text-align: center;">
      <h1 style="color: #dc2626; margin-bottom: 16px;">Erro ao carregar aplicação</h1>
      <p style="color: #6b7280; margin-bottom: 16px;">${error instanceof Error ? error.message : 'Erro desconhecido'}</p>
      <button onclick="window.location.reload()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Recarregar Página
      </button>
      <p style="color: #9ca3af; margin-top: 16px; font-size: 12px;">Verifique o console (F12) para mais detalhes</p>
    </div>
  `;
}
