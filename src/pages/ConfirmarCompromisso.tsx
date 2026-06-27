import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  CalendarClock,
  CalendarSync,
  CheckCircle2,
  Loader2,
  Mail,
  Sparkles,
  Target,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface CompromissoData {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string | null;
  tipo_servico: string | null;
  titulo: string | null;
  observacoes: string | null;
  status_confirmacao: string;
  paciente: string;
  profissional_nome: string;
  empresa_nome: string;
}

type ViewMode = "inicial" | "remarcar" | "sucesso-remarcacao";

const BRAND = {
  bg: "#0c3b2e",
  bgLight: "#f4f7f5",
  green: "#16a34a",
  greenDark: "#15803d",
  card: "#ffffff",
};

export default function ConfirmarCompromisso() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [data, setData] = useState<CompromissoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"confirmado" | "recusado" | null>(null);
  const [view, setView] = useState<ViewMode>("inicial");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [novoHorarioConfirmado, setNovoHorarioConfirmado] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Confirmar Agendamento";
    document.documentElement.style.background = BRAND.bgLight;
    document.body.style.background = BRAND.bgLight;
    document.body.style.margin = "0";

    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((r) => r.unregister()));
            if ("caches" in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          }
        }
      } catch {
        // ignore
      }
    })();

    if (!token) {
      setError("Link inválido.");
      setLoading(false);
      return;
    }

    (async () => {
      const { data: rows, error: rpcError } = await supabase.rpc("get_compromisso_by_token", {
        _token: token,
      });

      if (rpcError) {
        setError("Não foi possível carregar o agendamento.");
      } else if (!rows || (rows as unknown[]).length === 0) {
        setError("Agendamento não encontrado ou link expirado.");
      } else {
        const row = (rows as unknown[])[0] as CompromissoData;
        setData(row);
        if (row.status_confirmacao === "confirmado") setResultado("confirmado");
        if (row.status_confirmacao === "recusado") setResultado("recusado");
      }
      setLoading(false);
    })();
  }, [token]);

  const empresaLabel = data?.empresa_nome?.trim() || "GROW OS";

  const handleAcao = async (acao: "confirmar" | "recusar") => {
    if (!token) return;
    setActing(true);
    const { data: resp, error: rpcError } = await supabase.rpc("confirmar_compromisso_by_token", {
      _token: token,
      _acao: acao,
    });

    if (rpcError || !(resp as { success?: boolean })?.success) {
      setActing(false);
      toast.error("Erro ao registrar resposta. Tente novamente.");
      return;
    }

    try {
      await supabase.functions.invoke("notificar-confirmacao-compromisso", {
        body: { token, acao },
      });
    } catch (e) {
      console.warn("Falha ao notificar via WhatsApp:", e);
    }

    setActing(false);
    setResultado(acao === "confirmar" ? "confirmado" : "recusado");
  };

  const abrirReagendamento = async () => {
    if (!token) return;
    setView("remarcar");
    setLoadingSlots(true);
    const hoje = new Date();
    const dataInicio = hoje.toISOString().slice(0, 10);
    const { data: rows, error: rpcErr } = await supabase.rpc("get_horarios_disponiveis_by_token", {
      _token: token,
      _data_inicio: dataInicio,
      _dias: 14,
    });
    setLoadingSlots(false);

    if (rpcErr) {
      toast.error("Erro ao buscar horários disponíveis.");
      return;
    }

    setSlots(((rows as { slot?: string }[]) || []).map((r) => r.slot).filter(Boolean) as string[]);
  };

  const handleReagendar = async (slot: string) => {
    if (!token) return;
    setActing(true);
    const { data: resp, error: rpcErr } = await supabase.rpc("reagendar_compromisso_by_token", {
      _token: token,
      _nova_data: slot,
    });
    setActing(false);

    if (rpcErr || !(resp as { success?: boolean })?.success) {
      toast.error((resp as { error?: string })?.error || "Erro ao remarcar. Tente outro horário.");
      return;
    }

    setNovoHorarioConfirmado(slot);
    setView("sucesso-remarcacao");
    setResultado(null);
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatFullDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const getDuration = () => {
    if (!data?.data_hora_fim) return "30 minutos";
    const start = new Date(data.data_hora_inicio).getTime();
    const end = new Date(data.data_hora_fim).getTime();
    const minutes = Math.max(0, Math.round((end - start) / 60000));
    return minutes > 0 ? `${minutes} minutos` : "30 minutos";
  };

  const getInitials = (name?: string | null) =>
    (name || "C")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();

  const addToCalendar = () => {
    if (!data) return;
    const start = new Date(data.data_hora_inicio).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const endDate = data.data_hora_fim
      ? new Date(data.data_hora_fim)
      : new Date(new Date(data.data_hora_inicio).getTime() + 30 * 60000);
    const end = endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const title = encodeURIComponent(data.titulo || data.tipo_servico || "Compromisso");
    const details = encodeURIComponent(data.observacoes || "Compromisso confirmado.");
    const location = encodeURIComponent(data.empresa_nome || "");
    window.open(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const slotsPorDia: Record<string, string[]> = {};
  for (const s of slots) {
    const key = new Date(s).toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
    if (!slotsPorDia[key]) slotsPorDia[key] = [];
    slotsPorDia[key].push(s);
  }

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = useMemo(() => {
    if (!data) return null;
    const target = new Date(data.data_hora_inicio).getTime() - 30 * 60 * 1000;
    const diff = Math.max(0, target - now);
    if (diff === 0 && new Date(data.data_hora_inicio).getTime() < now) return null;
    const totalSec = Math.floor(diff / 1000);
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return Number(hh) > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  }, [data, now]);

  const headerTitle = useMemo(() => {
    if (resultado === "confirmado") return "Presença confirmada ✅";
    if (resultado === "recusado") return "Resposta recebida";
    if (view === "remarcar") return "Escolha um novo horário";
    return "Seu compromisso está quase confirmado ✅";
  }, [resultado, view]);

  const headerSubtitle = useMemo(() => {
    if (view === "remarcar") return "Selecione uma opção disponível para reagendar.";
    if (resultado === "confirmado") return "Obrigado! Veja os detalhes abaixo.";
    if (resultado === "recusado") return "Recebemos sua resposta. Você pode remarcar se preferir.";
    return "Revise os detalhes abaixo e confirme sua presença.";
  }, [resultado, view]);

  return (
    <div className="min-h-screen" style={{ background: BRAND.bgLight, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes confirmPulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
        .confirm-pulse { animation: confirmPulse 2s ease-in-out infinite }
      `}</style>

      {/* Header verde — igual mockup GROW OS */}
      <div
        className="relative overflow-hidden px-4 pb-28 pt-8 text-white"
        style={{ background: `linear-gradient(160deg, ${BRAND.bg} 0%, #145a42 55%, #1a6b4f 100%)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(74,222,128,.22),transparent_50%)]" />
        <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="mb-6 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 text-lg"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              🚀
            </div>
            <div className="text-left">
              <div className="text-sm font-extrabold tracking-wide">{empresaLabel}</div>
              <div className="text-[11px] text-white/70">Plataforma Comercial</div>
            </div>
          </div>
          <h1 className="text-[1.35rem] font-extrabold leading-snug sm:text-2xl">{headerTitle}</h1>
          <p className="mt-2 max-w-sm text-sm text-white/80">{headerSubtitle}</p>
        </div>
      </div>

      <main className="relative z-10 mx-auto -mt-20 w-full max-w-[480px] px-4 pb-10">
        <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_rgba(12,59,46,0.18)]">
          {loading && (
            <div className="flex min-h-[360px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND.green }} />
            </div>
          )}

          {!loading && error && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <XCircle className="h-9 w-9 text-red-500" />
              </div>
              <p className="font-semibold text-slate-900">{error}</p>
            </div>
          )}

          {!loading && data && !error && (
            <>
              {/* Perfil do consultor */}
              {view === "inicial" && (
                <div
                  className="flex items-center gap-4 border-b px-5 py-5"
                  style={{ borderColor: "#d1fae5", background: "linear-gradient(135deg,#f0fdf4,#ecfdf5)" }}
                >
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-xl font-bold text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenDark})` }}
                  >
                    {getInitials(data.profissional_nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-extrabold text-slate-950">
                      {data.profissional_nome || "Consultor"}
                    </div>
                    <div className="text-xs font-semibold" style={{ color: BRAND.greenDark }}>
                      Consultor Comercial Sênior
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
                      <span className="text-amber-500">★★★★★</span>
                      <span>4.9 · 128 atendimentos</span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-white"
                    style={{ background: BRAND.green }}
                  >
                    ✓ Verificado
                  </span>
                </div>
              )}

              {view === "sucesso-remarcacao" && novoHorarioConfirmado && (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50">
                    <CalendarSync className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-slate-950">Reagendamento confirmado!</h2>
                  <p className="text-sm leading-6 text-slate-600">
                    Te esperamos em{" "}
                    <span className="font-semibold text-slate-950">{formatDateTime(novoHorarioConfirmado)}</span>
                  </p>
                </div>
              )}

              {view === "inicial" && resultado === "confirmado" && (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50 text-4xl">
                    🎉
                  </div>
                  <h2 className="mb-2 text-xl font-extrabold text-slate-950">Confirmado com sucesso!</h2>
                  <p className="mx-auto max-w-xs text-sm leading-6 text-slate-600">
                    Ótimo, {data.paciente}! Seu compromisso foi confirmado.
                    {data.profissional_nome ? ` ${data.profissional_nome} está esperando por você.` : ""}
                  </p>
                  <div
                    className="mx-auto mt-6 rounded-xl border p-4 text-left text-sm leading-7"
                    style={{ borderColor: "#bbf7d0", background: "#f0fdf4", color: "#065f46" }}
                  >
                    <div>
                      <strong>{formatFullDate(data.data_hora_inicio)}</strong> · {formatTime(data.data_hora_inicio)} às{" "}
                      {data.data_hora_fim ? formatTime(data.data_hora_fim) : ""}
                    </div>
                    <div>
                      <strong>{data.profissional_nome || "Consultor"}</strong> — Consultor Comercial Sênior
                    </div>
                    <div>
                      <strong>{data.titulo || data.tipo_servico || "Compromisso"}</strong> — {getDuration()}
                    </div>
                    <div>Link da reunião enviado para seu WhatsApp</div>
                  </div>
                  <button
                    type="button"
                    onClick={addToCalendar}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    <CalendarClock className="h-4 w-4" />
                    Adicionar ao calendário
                  </button>
                </div>
              )}

              {view === "inicial" && resultado === "recusado" && (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-200 bg-red-50">
                    <XCircle className="h-11 w-11 text-red-500" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-slate-950">Que pena, {data.paciente}...</h2>
                  <p className="mx-auto max-w-xs text-sm leading-6 text-slate-600">
                    Recebemos sua resposta. Você pode remarcar para outro horário se preferir.
                  </p>
                  <button
                    type="button"
                    onClick={abrirReagendamento}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: BRAND.green }}
                  >
                    <CalendarSync className="h-4 w-4" />
                    Remarcar agendamento
                  </button>
                </div>
              )}

              {view === "inicial" && !resultado && (
                <>
                  <div className="border-b border-slate-200 px-5 py-5">
                    <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Detalhes do agendamento
                    </div>

                    {data.paciente && (
                      <div className="flex gap-3 border-b border-slate-100 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                          <User className="h-4 w-4 text-emerald-700" />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Cliente / Lead</p>
                          <p className="text-sm font-bold text-slate-950">{data.paciente}</p>
                          <p className="text-xs text-slate-500">{empresaLabel}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 border-b border-slate-100 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <CalendarClock className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Data e horário</p>
                        <p className="text-sm font-bold capitalize text-slate-950">{formatFullDate(data.data_hora_inicio)}</p>
                        <p className="text-xs text-slate-500">
                          {formatTime(data.data_hora_inicio)} às {data.data_hora_fim ? formatTime(data.data_hora_fim) : ""} · {getDuration()}
                        </p>
                      </div>
                    </div>

                    {(data.tipo_servico || data.titulo) && (
                      <div className="flex gap-3 border-b border-slate-100 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                          <Target className="h-4 w-4 text-violet-700" />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Tipo de compromisso</p>
                          <p className="text-sm font-bold text-slate-950">{data.titulo || data.tipo_servico}</p>
                          <p className="text-xs text-slate-500">Videoconferência · link enviado por WhatsApp</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                        <Sparkles className="h-4 w-4 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Status atual</p>
                        <span className="confirm-pulse mt-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                          ⏳ Aguardando sua confirmação
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mx-5 mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-700">
                      O que esperar desta reunião
                    </div>
                    <div className="space-y-2.5 text-sm leading-6 text-indigo-950">
                      <p>
                        • Nessa conversa vamos mapear os <strong>desafios do seu time comercial</strong> e entender seu momento atual.
                      </p>
                      <p>
                        • Você terá uma <strong>demonstração personalizada</strong> da nossa solução, sem compromisso.
                      </p>
                      <p>
                        • Duração: cerca de <strong>{getDuration()}</strong> — direto ao ponto, sem enrolação.
                      </p>
                    </div>
                  </div>

                  {data.observacoes && (
                    <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                        <Mail className="h-3.5 w-3.5" /> Observações
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.observacoes}</p>
                    </div>
                  )}

                  <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
                    <Zap className="h-5 w-5 shrink-0 text-amber-600" />
                    <span>
                      {countdown ? (
                        <>
                          Confirme em até <strong>{countdown}</strong> para garantir seu horário. Outros leads podem ocupar esta vaga.
                        </>
                      ) : (
                        "Confirme sua presença para garantir esse horário na agenda."
                      )}
                    </span>
                  </div>

                  <div className="space-y-3 px-5 py-5">
                    <button
                      type="button"
                      onClick={() => handleAcao("confirmar")}
                      disabled={acting}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-white shadow-lg disabled:opacity-60"
                      style={{ background: BRAND.green, boxShadow: "0 8px 24px rgba(22,163,74,0.28)" }}
                    >
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Confirmar presença</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcao("recusar")}
                      disabled={acting}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      Não vou conseguir comparecer
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline"
                      style={{ color: BRAND.greenDark }}
                      onClick={abrirReagendamento}
                      disabled={acting}
                    >
                      <CalendarSync className="h-4 w-4" />
                      Quero remarcar para outro horário
                    </button>

                    <div className="flex items-center justify-center gap-2 pt-3">
                      <div className="flex">
                        {[
                          { i: "MR", bg: "from-indigo-500 to-purple-500" },
                          { i: "AC", bg: "from-emerald-500 to-emerald-700" },
                          { i: "BL", bg: "from-amber-500 to-amber-700" },
                        ].map((a) => (
                          <div
                            key={a.i}
                            className={`-ml-2 first:ml-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white bg-gradient-to-br ${a.bg}`}
                          >
                            {a.i}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        <strong className="text-slate-700">+128 pessoas</strong> já confirmaram com{" "}
                        {data.profissional_nome?.split(" ")[0] || "este consultor"}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {view === "remarcar" && (
                <div className="px-5 py-5">
                  <button
                    type="button"
                    onClick={() => setView("inicial")}
                    className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Voltar
                  </button>

                  {loadingSlots && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND.green }} />
                    </div>
                  )}

                  {!loadingSlots && slots.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-sm leading-6 text-slate-500">
                        Nenhum horário disponível nos próximos 14 dias.
                        <br />
                        Entre em contato com a empresa.
                      </p>
                    </div>
                  )}

                  {!loadingSlots && slots.length > 0 && (
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                      {Object.entries(slotsPorDia).map(([dia, listaSlots]) => (
                        <div key={dia}>
                          <p className="mb-2 text-sm font-bold capitalize text-slate-950">{dia}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {listaSlots.map((s) => {
                              const horario = new Date(s).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  disabled={acting}
                                  onClick={() => handleReagendar(s)}
                                  className="rounded-lg border border-emerald-200 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  {horario}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 text-center text-xs leading-5 text-slate-400">
          Mensagem automática enviada pelo{" "}
          <span className="font-bold" style={{ color: BRAND.greenDark }}>
            {empresaLabel}
          </span>
          <br />
          <span style={{ color: BRAND.green }}>Política de privacidade</span> ·{" "}
          <span style={{ color: BRAND.green }}>Suporte</span>
        </div>
      </main>
    </div>
  );
}
