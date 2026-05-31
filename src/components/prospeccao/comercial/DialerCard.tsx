import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export function DialerCard() {
  const [callActive, setCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  const formatTime = (seconds: number) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleToggleCall = () => {
    setCallActive(!callActive);
  };

  const handleEndCall = () => {
    setCallActive(false);
    setCallSeconds(0);
  };

  const handleOutcome = (outcome: string) => {
    setSelectedOutcome(outcome);
    handleEndCall();
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 border border-blue-800/50 p-6 text-white overflow-hidden relative">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-radial-gradient opacity-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Próximo na fila — Cold Call</span>
        <Badge className="bg-blue-500/30 text-blue-200 border-blue-400/30 text-[10px]">🤖 Score IA: 87/100</Badge>
      </div>

      {/* Lead Info */}
      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
          🏢
        </div>
        <div className="flex-1">
          <div className="text-lg font-bold text-white">Clínica Saúde Total</div>
          <div className="text-sm text-blue-200">CEO: Dr. Marcos Lima · São Paulo · 45 func.</div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">✓ ICP Perfeito</Badge>
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-[10px]">🔥 Alta intenção</Badge>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">3ª tentativa</Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black font-mono text-white">{formatTime(callSeconds)}</div>
          <div className="text-xs text-blue-200">{callActive ? "Em ligação…" : "Aguardando ligação"}</div>
        </div>
      </div>

      {/* Call Buttons */}
      <div className="flex justify-center gap-3 mb-6 relative z-10">
        <button className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-lg hover:bg-white/20 transition">
          🔇
        </button>
        <button
          onClick={handleToggleCall}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition ${
            callActive
              ? "bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/50"
              : "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/50"
          }`}
        >
          {callActive ? "⏸️" : "📞"}
        </button>
        <button onClick={handleEndCall} className="w-11 h-11 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center text-lg">
          ☎️
        </button>
        <button className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-lg hover:bg-white/20 transition">
          📝
        </button>
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-4 gap-2 relative z-10">
        {["✅ Conectou", "📭 C. Postal", "🔕 Não atend.", "❌ Desqual."].map((outcome) => (
          <button
            key={outcome}
            onClick={() => handleOutcome(outcome)}
            className={`py-2 rounded-lg text-xs font-semibold transition ${
              selectedOutcome === outcome
                ? "bg-white/30 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/15"
            }`}
          >
            {outcome}
          </button>
        ))}
      </div>
    </div>
  );
}
