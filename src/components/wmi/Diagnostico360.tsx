import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ClipboardCheck, ChevronLeft, ChevronRight, Sparkles, Loader2, Trophy,
  AlertTriangle, RotateCcw, Target, TrendingUp, Heart, Users, BarChart3,
  Flame, Lightbulb, ShieldCheck, ShieldAlert, CheckCircle2, Circle, Clock,
  Zap, DollarSign, Calendar, Map,
} from "lucide-react";
import {
  useAlavancas, usePerguntas, usePerguntasSegmento, useUltimoDiagnostico,
  useSalvarDiagnostico, useGargalos, useUpdateGargaloStatus,
  detectarGargalos, CLASSIFICACOES,
  type Pergunta, type DoresDesejos, type GargaloDetectado,
} from "@/hooks/useDiagnostico360";
import { useGenerateRoadmap, useWMIRoadmap, useUpdateRoadmapItem } from "@/hooks/useWMI";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import { SEGMENTOS_EMPRESA } from "@/lib/segmentos";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = { Target, TrendingUp, Heart, Users, BarChart3 };

type Step = "intro" | "dores" | "swot" | "alavancas" | "result";

const EMPTY_DORES: DoresDesejos = {
  principal_dor: "",
  principal_desejo: "",
  o_que_travou: "",
  faturamento_atual: undefined,
  meta_faturamento: undefined,
  prazo_meta_meses: 6,
  swot_forcas: "",
  swot_fraquezas: "",
  swot_oportunidades: "",
  swot_ameacas: "",
  observacoes_alavanca: {},
};

export function Diagnostico360() {
  const { data: alavancas, isLoading: loadAlav } = useAlavancas();
  const { data: perguntasGerais, isLoading: loadPerg } = usePerguntas();
  const { segmento: segmentoEmpresa } = useCompanySegmento();
  const { data: ultimo } = useUltimoDiagnostico();
  const salvar = useSalvarDiagnostico();
  const genRoadmap = useGenerateRoadmap();
  const { data: roadmap } = useWMIRoadmap();
  const updateRoadmap = useUpdateRoadmapItem();

  // Permite usuário sobrescrever o segmento (caso queira responder como outro)
  const [segmentoEscolhido, setSegmentoEscolhido] = useState<string>("");
  const segmentoAtivo = segmentoEscolhido || segmentoEmpresa || "";
  const { data: perguntasSeg } = usePerguntasSegmento(segmentoAtivo);

  const [step, setStep] = useState<Step>(ultimo ? "result" : "intro");
  const [respostasMap, setRespostasMap] = useState<Record<string, boolean>>({});
  const [dores, setDores] = useState<DoresDesejos>(EMPTY_DORES);
  const [currentAlavanca, setCurrentAlavanca] = useState(0);

  // Mescla perguntas gerais + as do segmento
  const perguntas = useMemo<Pergunta[]>(() => {
    const base = perguntasGerais || [];
    const extras = perguntasSeg || [];
    return [...base, ...extras];
  }, [perguntasGerais, perguntasSeg]);

  // Pontuação por alavanca
  const pontuacoes = useMemo(() => {
    if (!alavancas || !perguntas) return {};
    const out: Record<string, number> = {};
    alavancas.forEach((a) => {
      const pAlav = perguntas.filter((p) => p.alavanca_id === a.id);
      const marcadas = pAlav.filter((p) => respostasMap[p.id]).length;
      out[a.id] = pAlav.length > 0 ? Math.round((marcadas / pAlav.length) * 10) : 0;
    });
    return out;
  }, [alavancas, perguntas, respostasMap]);

  const totalScore = Object.values(pontuacoes).reduce((a, b) => a + b, 0);
  const maxScore = (alavancas?.length || 0) * 10;
  const percentual = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const segmentoLabel = SEGMENTOS_EMPRESA.find((s) => s.value === segmentoAtivo)?.label || segmentoAtivo || "Genérico";

  if (loadAlav || loadPerg) return <Skeleton className="h-96 w-full" />;

  // ============ STEP: INTRO ============
  if (step === "intro") {
    return (
      <Card className="border-2 overflow-hidden animate-fade-in">
        <div className="h-2 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
        <CardContent className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
              <ClipboardCheck className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">Avaliação 360° + SWOT · Metodologia Waze</Badge>
              <h2 className="text-2xl font-bold">Diagnóstico Comercial Estratégico</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Em 4 etapas guiadas você terá: dores mapeadas, análise SWOT, score por pilar e plano de ação IA com roadmap de 90 dias gerado automaticamente.
              </p>
            </div>
          </div>

          {/* Trilha das fases */}
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              { icon: Flame, label: "1. Dores & Metas", desc: "O que dói e onde quer chegar" },
              { icon: Map, label: "2. SWOT", desc: "Forças, fraquezas, oportunidades" },
              { icon: BarChart3, label: "3. Alavancas", desc: `5 pilares + perguntas de ${segmentoLabel}` },
              { icon: Sparkles, label: "4. Plano IA", desc: "Roadmap 90 dias + acompanhamento" },
            ].map((f, i) => (
              <div key={i} className="border rounded-lg p-3 hover-scale bg-gradient-to-br from-card to-muted/20">
                <div className="inline-flex p-2 rounded-lg bg-primary/10 text-primary mb-2">
                  <f.icon className="h-4 w-4" />
                </div>
                <div className="text-xs font-semibold">{f.label}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Selector de segmento */}
          <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Segmento para personalização</Label>
            <select
              className="w-full bg-background border rounded-md px-3 py-2 text-sm"
              value={segmentoAtivo}
              onChange={(e) => setSegmentoEscolhido(e.target.value)}
            >
              <option value="">Genérico (todas empresas)</option>
              {SEGMENTOS_EMPRESA.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Detectado da empresa: <strong>{SEGMENTOS_EMPRESA.find(s => s.value === segmentoEmpresa)?.label || "não definido"}</strong>. Mude se quiser responder por outro segmento.
            </p>
          </div>

          {/* Classificações */}
          <div className="grid sm:grid-cols-4 gap-2 text-center">
            {(["A", "B", "C", "D"] as const).map((n) => {
              const c = CLASSIFICACOES[n];
              return (
                <div key={n} className={`border rounded-lg p-3 bg-gradient-to-br ${c.cor} bg-opacity-10`}>
                  <div className="text-2xl">{c.emoji}</div>
                  <div className="text-xs font-bold mt-1">Nota {n}</div>
                  <div className="text-[10px] text-muted-foreground">{c.range}</div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              size="lg" className="gap-2 flex-1"
              onClick={() => {
                setRespostasMap({}); setDores(EMPTY_DORES); setCurrentAlavanca(0);
                setStep("dores");
              }}
            >
              <Sparkles className="h-4 w-4" />
              {ultimo ? "Refazer diagnóstico" : "Iniciar diagnóstico"}
            </Button>
            {ultimo && (
              <Button size="lg" variant="outline" onClick={() => setStep("result")}>
                Ver último resultado
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ STEP: DORES & DESEJOS ============
  if (step === "dores") {
    return (
      <Card className="border-2 animate-fade-in">
        <div className="h-2 bg-gradient-to-r from-rose-500 to-orange-400" />
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-1">Etapa 1 de 4</Badge>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-rose-500" />
            Dores, desejos e meta
          </CardTitle>
          <CardDescription>
            Quanto mais profundo aqui, mais preciso será o plano de ação da IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={25} className="h-1.5" />

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Flame className="h-3 w-3 text-rose-500" /> Qual a sua maior dor comercial hoje? *</Label>
            <Textarea
              placeholder="Ex: Leads chegam mas a equipe não consegue converter; falta follow-up; CAC altíssimo..."
              value={dores.principal_dor || ""}
              onChange={(e) => setDores({ ...dores, principal_dor: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Lightbulb className="h-3 w-3 text-amber-500" /> Qual o seu maior desejo / onde quer chegar?</Label>
            <Textarea
              placeholder="Ex: Ter previsibilidade de receita, escalar para R$500k/mês, montar máquina de vendas..."
              value={dores.principal_desejo || ""}
              onChange={(e) => setDores({ ...dores, principal_desejo: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-500" /> O que travou seu crescimento até hoje?</Label>
            <Textarea
              placeholder="Ex: Falta de estrutura comercial, equipe pequena, dependência só de indicação..."
              value={dores.o_que_travou || ""}
              onChange={(e) => setDores({ ...dores, o_que_travou: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Faturamento atual / mês</Label>
              <Input
                type="number" placeholder="R$ 100.000"
                value={dores.faturamento_atual ?? ""}
                onChange={(e) => setDores({ ...dores, faturamento_atual: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Target className="h-3 w-3 text-emerald-500" /> Meta de faturamento / mês</Label>
              <Input
                type="number" placeholder="R$ 200.000"
                value={dores.meta_faturamento ?? ""}
                onChange={(e) => setDores({ ...dores, meta_faturamento: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Prazo (meses)</Label>
              <Input
                type="number" placeholder="6"
                value={dores.prazo_meta_meses ?? ""}
                onChange={(e) => setDores({ ...dores, prazo_meta_meses: Number(e.target.value) || undefined })}
              />
            </div>
          </div>

          {dores.faturamento_atual && dores.meta_faturamento && dores.meta_faturamento > dores.faturamento_atual && (
            <div className="border rounded-lg p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-amber-500/30">
              <div className="text-xs text-muted-foreground">GAP a fechar</div>
              <div className="text-lg font-bold text-amber-600">
                R$ {(dores.meta_faturamento - dores.faturamento_atual).toLocaleString("pt-BR")} / mês
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  ({Math.round(((dores.meta_faturamento - dores.faturamento_atual) / dores.faturamento_atual) * 100)}% acima do atual)
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2 gap-2">
            <Button variant="outline" onClick={() => setStep("intro")} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep("swot")}
              disabled={!dores.principal_dor?.trim()}
              className="gap-2"
            >
              Próxima: SWOT <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ STEP: SWOT ============
  if (step === "swot") {
    const swotItems = [
      { key: "swot_forcas", label: "Forças (internas)", icon: ShieldCheck, color: "from-emerald-500 to-green-400", placeholder: "Ex: Time comprometido, produto validado, clientes recorrentes..." },
      { key: "swot_fraquezas", label: "Fraquezas (internas)", icon: ShieldAlert, color: "from-rose-500 to-orange-400", placeholder: "Ex: Sem CRM, falta de follow-up, sem playbook..." },
      { key: "swot_oportunidades", label: "Oportunidades (externas)", icon: Lightbulb, color: "from-amber-500 to-yellow-400", placeholder: "Ex: Mercado aquecido, concorrente fraco, novos canais..." },
      { key: "swot_ameacas", label: "Ameaças (externas)", icon: AlertTriangle, color: "from-purple-500 to-fuchsia-400", placeholder: "Ex: Concorrência agressiva, mudança regulatória, sazonalidade..." },
    ];

    return (
      <Card className="border-2 animate-fade-in">
        <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-1">Etapa 2 de 4</Badge>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5 text-purple-500" />
            Análise SWOT estratégica
          </CardTitle>
          <CardDescription>
            Identifique forças e ameaças. A IA vai cruzar isso com seus pilares para gerar estratégia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={50} className="h-1.5" />

          <div className="grid md:grid-cols-2 gap-3">
            {swotItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <div className={`p-1 rounded bg-gradient-to-br ${item.color} text-white`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    {item.label}
                  </Label>
                  <Textarea
                    placeholder={item.placeholder}
                    value={(dores as any)[item.key] || ""}
                    onChange={(e) => setDores({ ...dores, [item.key]: e.target.value } as any)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-2 gap-2">
            <Button variant="outline" onClick={() => setStep("dores")} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => { setCurrentAlavanca(0); setStep("alavancas"); }} className="gap-2">
              Próxima: Alavancas <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ STEP: ALAVANCAS ============
  if (step === "alavancas" && alavancas) {
    const alav = alavancas[currentAlavanca];
    const pAlavGerais = (perguntasGerais || []).filter((p) => p.alavanca_id === alav.id);
    const pAlavSeg = (perguntasSeg || []).filter((p) => p.alavanca_id === alav.id);
    const Icon = ICON_MAP[alav.icon] || Target;
    const isLast = currentAlavanca === alavancas.length - 1;
    const progressoTotal = 50 + ((currentAlavanca + 1) / alavancas.length) * 50;

    return (
      <Card className="border-2 animate-fade-in">
        <div className={`h-2 bg-gradient-to-r ${alav.cor}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-gradient-to-br ${alav.cor} text-white shadow-md`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <Badge variant="outline" className="mb-1 text-xs">
                  Etapa 3 · Alavanca {alav.numero} de {alavancas.length}
                </Badge>
                <CardTitle className="text-lg">{alav.nome}</CardTitle>
                <CardDescription className="text-xs">{alav.foco}</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="font-mono">{pontuacoes[alav.id] || 0}/10</Badge>
          </div>
          <Progress value={progressoTotal} className="h-1.5 mt-3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Marque apenas o que sua empresa <strong>realmente faz hoje</strong>. Pontuação automática.
          </p>

          {/* Perguntas gerais */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" /> Perguntas universais
            </div>
            {pAlavGerais.map((p) => (
              <label key={p.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition cursor-pointer">
                <Checkbox
                  checked={!!respostasMap[p.id]}
                  onCheckedChange={(v) => setRespostasMap((m) => ({ ...m, [p.id]: !!v }))}
                  className="mt-0.5"
                />
                <span className="text-sm flex-1">{p.pergunta}</span>
              </label>
            ))}
          </div>

          {/* Perguntas do segmento */}
          {pAlavSeg.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Específicas para {segmentoLabel}
              </div>
              {pAlavSeg.map((p) => (
                <label key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition cursor-pointer">
                  <Checkbox
                    checked={!!respostasMap[p.id]}
                    onCheckedChange={(v) => setRespostasMap((m) => ({ ...m, [p.id]: !!v }))}
                    className="mt-0.5"
                  />
                  <span className="text-sm flex-1">{p.pergunta}</span>
                </label>
              ))}
            </div>
          )}

          {/* Observação aberta por alavanca */}
          <div className="space-y-2 pt-2">
            <Label className="text-xs">Observações sobre {alav.nome} (opcional)</Label>
            <Textarea
              placeholder="Detalhes específicos sobre essa alavanca na sua empresa..."
              rows={2}
              value={dores.observacoes_alavanca?.[alav.id] || ""}
              onChange={(e) => setDores({
                ...dores,
                observacoes_alavanca: { ...(dores.observacoes_alavanca || {}), [alav.id]: e.target.value },
              })}
            />
          </div>

          <div className="flex justify-between pt-4 gap-2">
            <Button variant="outline" onClick={() => {
              if (currentAlavanca === 0) setStep("swot");
              else setCurrentAlavanca((i) => i - 1);
            }} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            {!isLast ? (
              <Button onClick={() => setCurrentAlavanca((i) => i + 1)} className="gap-2">
                Próxima alavanca <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                disabled={salvar.isPending}
                className="gap-2 bg-gradient-to-r from-primary to-primary/70"
                onClick={async () => {
                  const gargalos = detectarGargalos(alavancas, pontuacoes, dores);
                  salvar.mutate(
                    {
                      pontuacoes,
                      respostas_perguntas: respostasMap,
                      dores,
                      segmento: segmentoAtivo || null,
                      gargalos,
                    },
                    {
                      onSuccess: async () => {
                        toast.success("Diagnóstico salvo! Gerando roadmap de 90 dias...");
                        setStep("result");
                        // Dispara roadmap automaticamente
                        try {
                          await genRoadmap.mutateAsync();
                          toast.success("Roadmap gerado!");
                        } catch (e: any) {
                          toast.error("Roadmap: " + (e.message || "falha"));
                        }
                      },
                      onError: (e: any) => toast.error(e.message),
                    }
                  );
                }}
              >
                {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Finalizar e gerar plano + roadmap
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ STEP: RESULT ============
  return <ResultadoDiagnostico
    onRefazer={() => { setRespostasMap({}); setDores(EMPTY_DORES); setCurrentAlavanca(0); setStep("dores"); }}
    onGerarRoadmap={() => genRoadmap.mutate()}
    roadmap={roadmap}
    updateRoadmap={updateRoadmap}
    isGenerating={genRoadmap.isPending}
  />;
}

// ============================================================
// RESULTADO + GARGALOS + ROADMAP
// ============================================================
function ResultadoDiagnostico({
  onRefazer, onGerarRoadmap, roadmap, updateRoadmap, isGenerating,
}: {
  onRefazer: () => void;
  onGerarRoadmap: () => void;
  roadmap: any[] | undefined;
  updateRoadmap: ReturnType<typeof useUpdateRoadmapItem>;
  isGenerating: boolean;
}) {
  const { data: result } = useUltimoDiagnostico();
  const { data: alavancas } = useAlavancas();
  const { data: gargalos } = useGargalos(result?.id);
  const updateGargalo = useUpdateGargaloStatus();

  if (!result || !alavancas) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum diagnóstico realizado.</p>
          <Button onClick={onRefazer} className="mt-4">Iniciar diagnóstico</Button>
        </CardContent>
      </Card>
    );
  }

  const c = CLASSIFICACOES[result.nota];
  const gargalosCorrigidos = (gargalos || []).filter(g => g.status === "corrigido").length;
  const gargalosTotal = (gargalos || []).length;
  const pctCorrigido = gargalosTotal > 0 ? Math.round((gargalosCorrigidos / gargalosTotal) * 100) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* HEADER do resultado */}
      <Card className="border-2 overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${c.cor}`} />
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2 space-y-3">
              <Badge variant="outline" className="text-xs">
                Diagnóstico de {format(new Date(result.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </Badge>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="text-3xl">{c.emoji}</span>{c.titulo}
              </h3>
              <p className="text-sm text-muted-foreground">{c.cenario}</p>
              <div className="p-3 rounded-lg bg-muted/40 border">
                <div className="text-xs font-semibold text-muted-foreground mb-1">📌 RECOMENDAÇÃO</div>
                <p className="text-sm">{c.recomendacao}</p>
              </div>
              {result.principal_dor && (
                <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <div className="text-xs font-semibold text-rose-600 mb-1 flex items-center gap-1">
                    <Flame className="h-3 w-3" /> SUA DOR REPORTADA
                  </div>
                  <p className="text-sm italic">"{result.principal_dor}"</p>
                </div>
              )}
            </div>
            <div className="text-center space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Sua nota</div>
              <div className={`text-7xl font-bold bg-gradient-to-br ${c.cor} bg-clip-text text-transparent`}>
                {result.nota}
              </div>
              <Badge className={`bg-gradient-to-r ${c.cor} text-white border-0`}>
                <Trophy className="h-3 w-3 mr-1" />
                {result.percentual}% — {result.total_score}/{(alavancas.length || 0) * 10}
              </Badge>
              {gargalosTotal > 0 && (
                <div className="pt-3 border-t">
                  <div className="text-xs text-muted-foreground">Correções</div>
                  <div className="text-2xl font-bold text-emerald-500">{gargalosCorrigidos}/{gargalosTotal}</div>
                  <Progress value={pctCorrigido} className="h-1.5 mt-1" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* META & GAP */}
      {result.faturamento_atual && result.meta_faturamento && (
        <Card>
          <CardContent className="p-4 grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Faturamento atual</div>
              <div className="text-xl font-bold">R$ {Number(result.faturamento_atual).toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Meta</div>
              <div className="text-xl font-bold text-emerald-500">R$ {Number(result.meta_faturamento).toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">GAP em {result.prazo_meta_meses || 6} meses</div>
              <div className="text-xl font-bold text-amber-500">
                R$ {(Number(result.meta_faturamento) - Number(result.faturamento_atual)).toLocaleString("pt-BR")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ALAVANCAS - Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        {alavancas.map((a) => {
          const Icon = ICON_MAP[a.icon] || Target;
          const score = result.pontuacoes[a.id] || 0;
          const fraca = score < 5;
          return (
            <Card key={a.id} className={cn(fraca && "border-rose-500/40", "hover-scale")}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`p-1.5 rounded bg-gradient-to-br ${a.cor} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {fraca && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                </div>
                <div className="text-xs font-semibold leading-tight">{a.nome}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{score}</span>
                  <span className="text-xs text-muted-foreground">/10</span>
                </div>
                <Progress value={(score / 10) * 100} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* GARGALOS DETECTADOS — Toggle de correção */}
      {gargalosTotal > 0 && (
        <Card className="border-2 border-rose-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Gargalos detectados — marque conforme for corrigindo
            </CardTitle>
            <CardDescription>
              Cada item corrigido melhora seu score na próxima medição.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(gargalos || []).map((g) => (
              <div
                key={g.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition",
                  g.status === "corrigido" && "bg-emerald-500/5 border-emerald-500/30",
                  g.status === "em_andamento" && "bg-amber-500/5 border-amber-500/30",
                  g.status === "pendente" && "hover:bg-muted/30"
                )}
              >
                <button
                  onClick={() => {
                    const next = g.status === "corrigido" ? "pendente"
                      : g.status === "pendente" ? "em_andamento" : "corrigido";
                    updateGargalo.mutate({ id: g.id, status: next });
                  }}
                  className="mt-0.5"
                >
                  {g.status === "corrigido" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : g.status === "em_andamento" ? (
                    <Clock className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1">
                  <div className={cn("text-sm", g.status === "corrigido" && "line-through text-muted-foreground")}>
                    {g.gargalo_titulo}
                  </div>
                  {g.corrigido_em && (
                    <div className="text-[10px] text-emerald-600 mt-0.5">
                      ✓ Corrigido em {format(new Date(g.corrigido_em), "dd/MM/yyyy")}
                    </div>
                  )}
                </div>
                <Badge variant={g.status === "corrigido" ? "default" : "secondary"} className="text-[10px]">
                  {g.status === "corrigido" ? "Corrigido" : g.status === "em_andamento" ? "Em andamento" : "Pendente"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PLANO IA */}
      {result.diagnostico_ia ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Plano de Ação gerado pelo Waze Advisor IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{result.diagnostico_ia}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Plano de ação sendo gerado pela IA…
          </CardContent>
        </Card>
      )}

      {/* ROADMAP 90 DIAS */}
      <Card className="border-2 border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" /> Roadmap 90 dias
              </CardTitle>
              <CardDescription>Plano semanal de correção dos gargalos.</CardDescription>
            </div>
            <Button size="sm" onClick={onGerarRoadmap} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {roadmap?.length ? "Regenerar" : "Gerar roadmap"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!roadmap?.length ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {isGenerating ? "Gerando..." : "Clique em 'Gerar roadmap' para criar o plano de 12 semanas."}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {roadmap.map((item: any) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition",
                    item.status === "done" && "bg-emerald-500/5 border-emerald-500/30",
                    item.status === "in_progress" && "bg-amber-500/5 border-amber-500/30"
                  )}
                >
                  <button
                    onClick={() => {
                      const next = item.status === "done" ? "pending"
                        : item.status === "pending" ? "in_progress" : "done";
                      updateRoadmap.mutate({ id: item.id, status: next });
                    }}
                  >
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : item.status === "in_progress" ? (
                      <Clock className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[10px]">Semana {item.week}</Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">{item.pillar}</Badge>
                      <Badge className={cn(
                        "text-[10px]",
                        item.priority === "high" && "bg-rose-500",
                        item.priority === "medium" && "bg-amber-500",
                        item.priority === "low" && "bg-emerald-500",
                      )}>
                        {item.priority}
                      </Badge>
                    </div>
                    <div className={cn("text-sm font-medium", item.status === "done" && "line-through text-muted-foreground")}>
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                    )}
                    {item.expected_impact && (
                      <div className="text-xs text-emerald-600 mt-1">📈 {item.expected_impact}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onRefazer} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Refazer diagnóstico
        </Button>
      </div>
    </div>
  );
}
