import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CalendarClock,
  CalendarSync,
  CheckCircle2,
  Loader2,
  Stethoscope,
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
            const reloadedKey = "__confirm_sw_reloaded__";
            if (!sessionStorage.getItem(reloadedKey)) {
              sessionStorage.setItem(reloadedKey, "1");
              window.location.reload();
              return;
            }
          }
        }
      } catch {
        // Ignore old PWA cache cleanup failures on the public confirmation route.
      }
    })();

    if (!token) {
      setError("Link invalido.");
      setLoading(false);
      return;
    }

    (async () => {
      const { data: rows, error: rpcError } = await supabase.rpc("get_compromisso_by_token", {
        _token: token,
      });

      if (rpcError) {
        setError("Nao foi possivel carregar o agendamento.");
      } else if (!rows || (rows as any[]).length === 0) {
        setError("Agendamento nao encontrado ou link expirado.");
      } else {
        const row = (rows as any[])[0] as CompromissoData;
        setData(row);
        if (row.status_confirmacao === "confirmado") setResultado("confirmado");
        if (row.status_confirmacao === "recusado") setResultado("recusado");
      }
      setLoading(false);
    })();
  }, [token]);

  const handleAcao = async (acao: "confirmar" | "recusar") => {
    if (!token) return;
    setActing(true);
    const { data: resp, error: rpcError } = await supabase.rpc("confirmar_compromisso_by_token", {
      _token: token,
      _acao: acao,
    });

    if (rpcError || !(resp as any)?.success) {
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
    const { data: rows, error } = await supabase.rpc("get_horarios_disponiveis_by_token", {
      _token: token,
      _data_inicio: dataInicio,
      _dias: 14,
    });
    setLoadingSlots(false);

    if (error) {
      toast.error("Erro ao buscar horarios disponiveis.");
      return;
    }

    const ss = ((rows as any[]) || []).map((r) => r.slot).filter(Boolean);
    setSlots(ss);
  };

  const handleReagendar = async (slot: string) => {
    if (!token) return;
    setActing(true);
    const { data: resp, error } = await supabase.rpc("reagendar_compromisso_by_token", {
      _token: token,
      _nova_data: slot,
    });
    setActing(false);

    if (error || !(resp as any)?.success) {
      toast.error((resp as any)?.error || "Erro ao remarcar. Tente outro horario.");
      return;
    }

    setNovoHorarioConfirmado(slot);
    setView("sucesso-remarcacao");
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFullDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDuration = () => {
    if (!data?.data_hora_fim) return "30 min";
    const start = new Date(data.data_hora_inicio).getTime();
    const end = new Date(data.data_hora_fim).getTime();
    const minutes = Math.max(0, Math.round((end - start) / 60000));
    return minutes > 0 ? `${minutes} min` : "30 min";
  };

  const getInitials = (name?: string | null) => {
    const clean = (name || "Consultor").trim();
    return clean
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

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
    const d = new Date(s);
    const key = d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
    if (!slotsPorDia[key]) slotsPorDia[key] = [];
    slotsPorDia[key].push(s);
  }

  // Countdown até 30 minutos antes do compromisso (ou até o início, se já estiver perto)
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <style>{`@keyframes confirmPulse{0%,100%{opacity:1}50%{opacity:.55}} .confirm-pulse{animation:confirmPulse 2s ease-in-out infinite}`}</style>
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-700 px-4 pb-24 pt-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(74,222,128,.28),transparent_45%)]" />
        <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-lg font-bold">
              OS
            </div>
            <div className="text-left">
              <div className="text-sm font-bold tracking-wide">{data?.empresa_nome || "GROW OS"}</div>
              <div className="text-[11px] text-white/65">Plataforma Comercial</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            {resultado === "confirmado"
              ? "Presenca confirmada"
              : resultado === "recusado"
                ? "Resposta recebida"
                : view === "remarcar"
                  ? "Escolha um novo horario"
                  : "Seu compromisso esta quase confirmado"}
          </h1>
          <p className="mt-2 text-sm text-white/75">
            {view === "remarcar"
              ? "Selecione uma opcao disponivel para reagendar."
              : "Revise os detalhes abaixo e confirme sua presenca."}
          </p>
        </div>
      </div>

      <main className="relative z-10 mx-auto -mt-14 w-full max-w-[480px] px-4 pb-10">
        <div className="overflow-hidden rounded-[22px] bg-white shadow-2xl shadow-slate-950/15">
          {loading && (
            <div className="flex min-h-[360px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
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
              <div className="flex items-center gap-4 border-b border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-100 px-5 py-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-gradient-to-br from-emerald-500 to-emerald-700 text-xl font-bold text-white shadow-lg shadow-emerald-700/20">
                  {getInitials(data.profissional_nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-950">
                    {data.profissional_nome || "Consultor"}
                  </div>
                  <div className="text-xs font-medium text-emerald-700">Consultor Comercial</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
                    <span className="text-amber-500">*****</span>
                    <span>4.9 · atendimento verificado</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white">
                  Verificado
                </span>
              </div>

              {view === "sucesso-remarcacao" && novoHorarioConfirmado && (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50">
                    <CalendarSync className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-slate-950">Reagendamento confirmado!</h2>
                  <p className="text-sm leading-6 text-slate-600">
                    Te esperamos em{" "}
                    <span className="font-semibold text-slate-950">
                      {formatDateTime(novoHorarioConfirmado)}
                    </span>
                  </p>
                </div>
              )}

              {view === "inicial" && resultado === "confirmado" && (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50">
                    <CheckCircle2 className="h-11 w-11 text-emerald-600" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-slate-950">Confirmado com sucesso!</h2>
                  <p className="mx-auto max-w-xs text-sm leading-6 text-slate-600">
                    Otimo, {data.paciente}! Seu compromisso foi confirmado.
                    {data.profissional_nome ? ` ${data.profissional_nome} esta esperando por voce.` : ""}
                  </p>
                  <div className="mx-auto mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm leading-7 text-emerald-800">
                    <div>
                      <strong>{formatFullDate(data.data_hora_inicio)}</strong> ·{" "}
                      {formatTime(data.data_hora_inicio)} às{" "}
                      {data.data_hora_fim ? formatTime(data.data_hora_fim) : ""}
                    </div>
                    <div>
                      <strong>{data.profissional_nome || "Consultor"}</strong> — Consultor Comercial
                    </div>
                    <div>
                      <strong>{data.titulo || data.tipo_servico || "Compromisso"}</strong> — {getDuration()}
                    </div>
                    <div>Link da reuniao enviado para seu WhatsApp</div>
                  </div>
                  <Button onClick={addToCalendar} className="mt-5 bg-slate-950 text-white hover:bg-slate-800">
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Adicionar ao calendario
                  </Button>
                </div>
              )}

              {view === "inicial" && resultado === "recusado" && (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-200 bg-red-50">
                    <XCircle className="h-11 w-11 text-red-500" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-slate-950">Que pena, {data.paciente}...</h2>
                  <p className="mx-auto max-w-xs text-sm leading-6 text-slate-600">
                    Recebemos sua resposta. Voce pode remarcar para outro horario se preferir.
                  </p>
                  <Button onClick={abrirReagendamento} className="mt-5 bg-emerald-600 text-white hover:bg-emerald-700">
                    <CalendarSync className="mr-2 h-4 w-4" />
                    Remarcar agendamento
                  </Button>
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
                          <p className="text-xs text-slate-500">{data.empresa_nome}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 border-b border-slate-100 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <CalendarClock className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Data e horario</p>
                        <p className="text-sm font-bold capitalize text-slate-950">
                          {formatFullDate(data.data_hora_inicio)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatTime(data.data_hora_inicio)} às{" "}
                          {data.data_hora_fim ? formatTime(data.data_hora_fim) : ""} · {getDuration()}
                        </p>
                      </div>
                    </div>

                    {(data.tipo_servico || data.titulo) && (
                      <div className="flex gap-3 border-b border-slate-100 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                          <Stethoscope className="h-4 w-4 text-purple-700" />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Tipo de compromisso</p>
                          <p className="text-sm font-bold text-slate-950">{data.titulo || data.tipo_servico}</p>
                          <p className="text-xs text-slate-500">Videoconferencia · link enviado por WhatsApp</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                        <CalendarSync className="h-4 w-4 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Status atual</p>
                        <span className="confirm-pulse mt-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                          ⏳ Aguardando sua confirmacao
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mx-5 mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-700">
                      O que esperar desta reuniao
                    </div>
                    <div className="space-y-2 text-sm leading-6 text-indigo-900">
                      <p>• Vamos entender seus desafios e como podemos ajudar.</p>
                      <p>• Voce tera uma conversa objetiva e personalizada.</p>
                      <p>• Sem compromisso, com foco no melhor proximo passo.</p>
                    </div>
                  </div>

                  {data.observacoes && (
                    <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-slate-400">Observacoes</p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.observacoes}</p>
                    </div>
                  )}

                  <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-800">
                    <Zap className="h-5 w-5 shrink-0 text-amber-600" />
                    <span>
                      {countdown ? (
                        <>
                          Confirme em ate <span className="font-bold text-amber-900">{countdown}</span> para garantir
                          seu horario. Outros leads podem ocupar esta vaga.
                        </>
                      ) : (
                        "Confirme sua presenca para garantir esse horario na agenda."
                      )}
                    </span>
                  </div>

                  <div className="space-y-3 px-5 py-5">
                    <Button
                      size="lg"
                      onClick={() => handleAcao("confirmar")}
                      disabled={acting}
                      className="h-12 w-full rounded-xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-700/20 hover:bg-emerald-700"
                    >
                      {acting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Confirmar presenca
                        </>
                      )}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => handleAcao("recusar")}
                      disabled={acting}
                      className="h-11 w-full rounded-xl border-slate-200 font-semibold text-slate-700"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Nao vou conseguir comparecer
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={abrirReagendamento}
                      disabled={acting}
                    >
                      <CalendarSync className="h-4 w-4 mr-1.5" />
                      Quero remarcar para outro horario
                    </Button>

                    <div className="flex items-center justify-center gap-2 pt-3">
                      <div className="flex">
                        {[
                          { i: "MR", bg: "from-indigo-500 to-purple-500" },
                          { i: "AC", bg: "from-emerald-500 to-emerald-700" },
                          { i: "BL", bg: "from-amber-500 to-amber-700" },
                        ].map((a, idx) => (
                          <div
                            key={a.i}
                            className={`-ml-2 first:ml-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white bg-gradient-to-br ${a.bg}`}
                          >
                            {a.i}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        <strong className="text-slate-700">+128 pessoas</strong> ja confirmaram com{" "}
                        {data.profissional_nome?.split(" ")[0] || "este consultor"}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {view === "remarcar" && (
                <div className="px-5 py-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("inicial")}
                    className="mb-4 text-slate-600"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Voltar
                  </Button>

                  {loadingSlots && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
                    </div>
                  )}

                  {!loadingSlots && slots.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm leading-6 text-slate-500">
                        Nenhum horario disponivel nos proximos 14 dias.
                        <br />
                        Entre em contato com a empresa.
                      </p>
                    </div>
                  )}

                  {!loadingSlots && slots.length > 0 && (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
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
                                <Button
                                  key={s}
                                  variant="outline"
                                  size="sm"
                                  disabled={acting}
                                  onClick={() => handleReagendar(s)}
                                  className="rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                                >
                                  {horario}
                                </Button>
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
          Mensagem automatica enviada pelo{" "}
          <span className="font-bold text-emerald-700">{data?.empresa_nome || "GROW OS"}</span>
          <br />
          <span className="text-emerald-700">Politica de privacidade</span> ·{" "}
          <span className="text-emerald-700">Suporte</span>
        </div>
      </main>
    </div>
  );
}
