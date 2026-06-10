import { useState } from "react";
import { Sparkles, X, Loader2, Copy, Check, RefreshCw, AlertTriangle, ThermometerSun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoachIAFloatingButtonProps {
  contactPhone?: string;
  companyId?: string;
  leadId?: string;
  contactName?: string;
  leadName?: string;
}

interface CoachReport {
  resumo_interacao: string;
  estagio_percebido: string;
  temperatura: "quente" | "morno" | "frio";
  pontos_fortes: string[];
  erros_e_perdas: string[];
  abordagem_ideal: string;
  comunicacao_mais_assertiva: string;
  objecoes_detectadas?: string[];
  proximos_passos: string[];
  mensagem_sugerida: string;
  risco_de_perda: number;
}

const tempColors: Record<string, string> = {
  quente: "bg-red-500/15 text-red-400 border-red-500/30",
  morno: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  frio: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

export function CoachIAFloatingButton({
  contactPhone,
  companyId,
  leadId,
  contactName,
  leadName,
}: CoachIAFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CoachReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canRun = !!companyId && (!!leadId || !!contactPhone);

  const runCoach = async () => {
    if (!canRun) {
      toast.error("Sem dados suficientes para analisar");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("lead-coach-analyze", {
        body: {
          lead_id: leadId,
          phone: contactPhone,
          company_id: companyId,
          contact_name: contactName,
          lead_name: leadName,
        },
      });
      if (err) throw err;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReport((data as any)?.report || null);
    } catch (e: any) {
      setError(e?.message || "Erro ao analisar");
    } finally {
      setLoading(false);
    }
  };

  const copyMsg = async () => {
    if (!report?.mensagem_sugerida) return;
    try {
      await navigator.clipboard.writeText(report.mensagem_sugerida);
      setCopied(true);
      toast.success("Mensagem copiada");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!report && !loading) runCoach();
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="absolute bottom-24 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/40 flex items-center justify-center text-white hover:scale-110 transition-transform group"
          title="Coach IA — Análise da conversa"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Side Panel */}
      {open && (
        <div className="absolute bottom-6 right-6 z-50 w-[360px] max-h-[78vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-violet-500/10 to-purple-500/10">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Coach IA</div>
                <div className="text-[10px] text-muted-foreground">Análise da conversa</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={runCoach}
                disabled={loading}
                className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Reanalisar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {loading && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="text-xs">Analisando histórico da conversa...</div>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {report && !loading && (
              <>
                {/* Temperatura + Risco */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${tempColors[report.temperatura] || tempColors.frio} inline-flex items-center gap-1`}>
                    <ThermometerSun className="h-3 w-3" />
                    {report.temperatura}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border bg-muted text-foreground">
                    Estágio: {report.estagio_percebido}
                  </span>
                  {report.risco_de_perda >= 60 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-red-500/40 bg-red-500/10 text-red-400 inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Risco {report.risco_de_perda}%
                    </span>
                  )}
                </div>

                {/* Resumo */}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Situação</div>
                  <p className="text-xs text-foreground leading-relaxed">{report.resumo_interacao}</p>
                </div>

                {/* Objeções */}
                {report.objecoes_detectadas && report.objecoes_detectadas.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Objeções</div>
                    <div className="flex flex-wrap gap-1">
                      {report.objecoes_detectadas.map((o, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mensagem Sugerida */}
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-violet-400 font-semibold">📨 Envie agora</div>
                    <button
                      onClick={copyMsg}
                      className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{report.mensagem_sugerida}</p>
                </div>

                {/* Próximos passos */}
                {report.proximos_passos?.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Próximos passos</div>
                    <ol className="space-y-1">
                      {report.proximos_passos.map((p, i) => (
                        <li key={i} className="text-xs text-foreground flex gap-2">
                          <span className="text-violet-400 font-semibold">{i + 1}.</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Onde se perdeu */}
                {report.erros_e_perdas?.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Onde se perdeu oportunidade</div>
                    <ul className="space-y-1">
                      {report.erros_e_perdas.map((e, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2">
                          <span className="text-red-400">•</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Abordagem ideal */}
                {report.abordagem_ideal && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Abordagem ideal</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{report.abordagem_ideal}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
