import { useState } from "react";
import { Sparkles, X, Loader2, Copy, Check, RefreshCw, Send, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoachIAFloatingButtonProps {
  contactPhone?: string;
  companyId?: string;
  leadId?: string;
  contactName?: string;
  leadName?: string;
  onSendSuggested?: (text: string) => void;
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

type TabKey = "now" | "analise" | "roteiro";

const tempTag: Record<string, { label: string; cls: string; icon: string }> = {
  quente: { label: "Lead quente", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: "🔥" },
  morno: { label: "Lead morno", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: "🌡" },
  frio: { label: "Lead frio", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: "❄" },
};

export function CoachIAFloatingButton({
  contactPhone,
  companyId,
  leadId,
  contactName,
  leadName,
  onSendSuggested,
}: CoachIAFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("now");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CoachReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [variantIdx, setVariantIdx] = useState(0);

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
      setVariantIdx(0);
    } catch (e: any) {
      setError(e?.message || "Erro ao analisar");
    } finally {
      setLoading(false);
    }
  };

  const scriptVariants = (): string[] => {
    if (!report) return [];
    const arr = [report.mensagem_sugerida, report.comunicacao_mais_assertiva, report.abordagem_ideal].filter(Boolean) as string[];
    return arr.length ? arr : [report.mensagem_sugerida];
  };
  const currentScript = scriptVariants()[variantIdx] || report?.mensagem_sugerida || "";

  const copyScript = async () => {
    if (!currentScript) return;
    try {
      await navigator.clipboard.writeText(currentScript);
      setCopied(true);
      toast.success("Mensagem copiada");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  const sendScript = () => {
    if (!currentScript) return;
    if (onSendSuggested) {
      onSendSuggested(currentScript);
      toast.success("Mensagem enviada para o campo");
    } else {
      copyScript();
    }
  };
  const newScript = () => {
    const v = scriptVariants();
    if (v.length > 1) setVariantIdx((i) => (i + 1) % v.length);
    else toast("Sem outra variação — clique em Reanalisar");
  };

  const handleOpen = () => {
    setOpen(true);
    if (!report && !loading) runCoach();
  };

  const temp = report ? tempTag[report.temperatura] : null;
  const stageTag = report
    ? { label: `📍 ${report.estagio_percebido.replace(/_/g, " ")}`, cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" }
    : null;
  const risco = report?.risco_de_perda ?? 0;
  const riscoCls =
    risco >= 60 ? "bg-red-500/15 text-red-400 border-red-500/40" :
    risco >= 30 ? "bg-amber-500/15 text-amber-400 border-amber-500/40" :
                  "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="absolute bottom-24 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/40 flex items-center justify-center text-white hover:scale-110 transition-transform"
          title="Coach IA — Análise da conversa"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Side Panel */}
      {open && (
        <div className="absolute bottom-6 right-6 z-50 w-[360px] max-h-[82vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Coach IA</div>
                <div className="text-[10px] text-muted-foreground">Análise da conversa</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {report && (
                <span className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${riscoCls}`}>
                  Risco {risco}%
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-3">
            {([
              { k: "now", label: "Agora" },
              { k: "analise", label: "Análise" },
              { k: "roteiro", label: "Roteiro" },
            ] as { k: TabKey; label: string }[]).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.k
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="text-xs">Analisando conversa...</div>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* ───────── TAB: AGORA ───────── */}
            {!loading && report && tab === "now" && (
              <>
                <Section label="Situação detectada agora">
                  <div className="flex flex-wrap gap-1.5">
                    {report.objecoes_detectadas?.slice(0, 1).map((o, i) => (
                      <Tag key={i} cls="bg-red-500/15 text-red-400 border-red-500/30">⚠ {o}</Tag>
                    ))}
                    {temp && <Tag cls={temp.cls}>{temp.icon} {temp.label}</Tag>}
                    {stageTag && <Tag cls={stageTag.cls}>{stageTag.label}</Tag>}
                  </div>
                </Section>

                <Divider />

                <Section label="Script ideal para responder agora">
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap mb-2">
                    "{currentScript}"
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <ScriptBtn onClick={copyScript} icon={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}>
                      {copied ? "Copiado" : "Copiar"}
                    </ScriptBtn>
                    <ScriptBtn primary onClick={sendScript} icon={<Send className="h-3 w-3" />}>Enviar</ScriptBtn>
                    <ScriptBtn onClick={newScript} icon={<Shuffle className="h-3 w-3" />}>Outro</ScriptBtn>
                  </div>
                </Section>

                <Divider />

                {report.proximos_passos?.length > 0 && (
                  <Section label="Próximos passos">
                    <ul className="space-y-2">
                      {report.proximos_passos.map((p, i) => (
                        <li key={i} className="flex gap-2 text-xs text-foreground">
                          <span className="h-5 w-5 flex-shrink-0 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                          <span className="leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Divider />

                <button
                  onClick={runCoach}
                  className="w-full py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reanalisar agora
                </button>
              </>
            )}

            {/* ───────── TAB: ANÁLISE ───────── */}
            {!loading && report && tab === "analise" && (
              <>
                <Section label="Resumo da conversa">
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.resumo_interacao}</p>
                </Section>

                <Divider />

                {report.pontos_fortes?.length > 0 && (
                  <Section label="✓ O que foi bem" labelClass="text-emerald-400">
                    <div className="space-y-1.5">
                      {report.pontos_fortes.map((g, i) => (
                        <div key={i} className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-2.5 py-1.5 text-xs text-foreground">
                          {g}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {report.erros_e_perdas?.length > 0 && (
                  <Section label="✗ Onde perdeu oportunidade" labelClass="text-red-400">
                    <div className="space-y-1.5">
                      {report.erros_e_perdas.map((e, i) => (
                        <div key={i} className="rounded-md bg-red-500/5 border border-red-500/20 px-2.5 py-1.5 text-xs text-foreground">
                          {e}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {report.objecoes_detectadas && report.objecoes_detectadas.length > 0 && (
                  <>
                    <Divider />
                    <Section label="Objeções detectadas">
                      <div className="flex flex-wrap gap-1.5">
                        {report.objecoes_detectadas.map((o, i) => (
                          <Tag key={i} cls="bg-amber-500/15 text-amber-400 border-amber-500/30">{o}</Tag>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                <Divider />

                <Section label="Risco de perda">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">Probabilidade de perder este lead</span>
                    <span className="text-xs font-semibold text-red-400">{risco}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${risco}%`,
                        background: risco >= 60 ? "linear-gradient(90deg,#f87171,#ef4444)" : risco >= 30 ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#34d399,#10b981)",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Se nenhuma ação for tomada hoje</p>
                </Section>
              </>
            )}

            {/* ───────── TAB: ROTEIRO ───────── */}
            {!loading && report && tab === "roteiro" && (
              <>
                <Section label={`Estágio atual: ${report.estagio_percebido.replace(/_/g, " ")}`}>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Roteiro sugerido para este lead com base no histórico e nas objeções detectadas.
                  </p>
                </Section>

                <ScriptCard label="Mensagem 1 — responder agora" text={report.mensagem_sugerida} />
                {report.comunicacao_mais_assertiva && (
                  <>
                    <Divider />
                    <ScriptCard label="Mensagem 2 — comunicação mais assertiva" text={report.comunicacao_mais_assertiva} />
                  </>
                )}
                {report.abordagem_ideal && (
                  <>
                    <Divider />
                    <ScriptCard label="Abordagem ideal — contorno de objeção" text={report.abordagem_ideal} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ───────── helpers ───────── */
function Section({ label, labelClass, children }: { label: string; labelClass?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wide font-semibold mb-2 ${labelClass || "text-muted-foreground"}`}>{label}</div>
      {children}
    </div>
  );
}
function Divider() { return <hr className="border-border/60" />; }
function Tag({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`px-2 py-1 rounded-md text-[10px] font-medium border ${cls}`}>{children}</span>;
}
function ScriptBtn({ onClick, icon, children, primary }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`py-1.5 rounded-md text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors ${
        primary
          ? "bg-violet-600 hover:bg-violet-500 text-white"
          : "bg-muted hover:bg-muted/70 text-foreground border border-border"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
function ScriptCard({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast.success("Copiado"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Falha ao copiar"); }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
        <button onClick={copy} className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
        "{text}"
      </div>
    </div>
  );
}
