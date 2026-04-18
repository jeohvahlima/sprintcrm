import { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';

interface Props {
  whatsapp: string;
  mensagem?: string;
  empresa?: string;
}

export function WhatsAppFloating({ whatsapp, mensagem, empresa }: Props) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const numero = whatsapp.replace(/\D/g, '');
  const msgPadrao = mensagem || `Olá${empresa ? `, ${empresa}` : ''}! Gostaria de mais informações.`;
  const link = `https://wa.me/${numero}?text=${encodeURIComponent(msgPadrao)}`;

  if (!numero) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="bg-[#075E54] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 text-white">
              <div className="font-semibold text-sm">{empresa || 'Atendimento'}</div>
              <div className="text-xs opacity-80 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Online agora
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 bg-[#ECE5DD]">
            <div className="bg-white rounded-lg p-3 shadow-sm text-sm text-slate-700 mb-3">
              👋 Olá! Em que posso te ajudar?
            </div>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center bg-[#25D366] hover:bg-[#1ea855] text-white font-semibold py-3 rounded-lg transition"
            >
              Iniciar conversa
            </a>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#1ea855] shadow-2xl flex items-center justify-center text-white transition-transform hover:scale-110 ${pulse && !open ? 'animate-pulse' : ''}`}
        aria-label="Abrir WhatsApp"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-7 h-7" />}
        {!open && pulse && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center">1</span>
        )}
      </button>
    </>
  );
}
