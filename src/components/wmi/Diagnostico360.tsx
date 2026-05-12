import { useState, useMemo, useEffect } from "react";
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
  Zap, DollarSign, Calendar, Map, Settings, Download,
} from "lucide-react";
import jsPDF from "jspdf";
import {
  useAlavancas, usePerguntas, usePerguntasSegmento, useUltimoDiagnostico,
  useSalvarDiagnostico, useGargalos, useUpdateGargaloStatus, useGerarRoadmapDiagnostico,
  detectarGargalos, calcularRevenueLeak, CLASSIFICACOES,
  type Pergunta, type DoresDesejos, type GargaloDetectado, type RevenueLeak,
  type DiagnosticoResposta,
} from "@/hooks/useDiagnostico360";
import { useWMIRoadmap, useUpdateRoadmapItem } from "@/hooks/useWMI";
import { PlanoIARenderer } from "./PlanoIARenderer";
import { ImpactoFinanceiroExpandido } from "./ImpactoFinanceiroExpandido";
import { TimeComercialInputs, TimeComercialResultCard } from "./TimeComercialAnalysis";
import { CurvaABCEditor } from "./CurvaABCEditor";
import { ResumoExecutivoConsultivo } from "./ResumoExecutivoConsultivo";
import { GrowSalesIntelligence } from "./GrowSalesIntelligence";
import { useNavigate } from "react-router-dom";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import { SEGMENTOS_EMPRESA } from "@/lib/segmentos";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = { Target, TrendingUp, Heart, Users, BarChart3 };

type Step = "intro" | "dores" | "swot" | "intel" | "alavancas" | "result";

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
  curva_abc: [],
};

export function Diagnostico360() {
  const { data: alavancas, isLoading: loadAlav } = useAlavancas();
  const { data: perguntasGerais, isLoading: loadPerg } = usePerguntas();
  const { segmento: segmentoEmpresa } = useCompanySegmento();
  const { data: ultimo } = useUltimoDiagnostico();
  const salvar = useSalvarDiagnostico();
  const genRoadmap = useGerarRoadmapDiagnostico();
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
              <Badge variant="outline" className="mb-2">Avaliação 360° + SWOT · Metodologia GROW</Badge>
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

          <div className="grid sm:grid-cols-2 gap-3">
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

          {/* === KPIs operacionais — alimenta o motor "Custo da Inação" === */}
          <div className="border-2 border-rose-500/30 rounded-lg p-4 space-y-3 bg-gradient-to-br from-rose-500/5 to-orange-500/5">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-rose-500" />
              <Label className="text-sm font-semibold">KPIs operacionais (motor Custo da Inação)</Label>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Esses números são usados para calcular <strong>quanto sua empresa deixa de faturar por dia</strong> com a operação atual.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ticket médio (R$)</Label>
                <Input type="number" placeholder="1500"
                  value={dores.ticket_medio ?? ""}
                  onChange={(e) => setDores({ ...dores, ticket_medio: Number(e.target.value) || undefined })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa de conversão (%)</Label>
                <Input type="number" placeholder="20"
                  value={dores.taxa_conversao ?? ""}
                  onChange={(e) => setDores({ ...dores, taxa_conversao: Number(e.target.value) || undefined })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dias úteis / mês</Label>
                <Input type="number" placeholder="20"
                  value={dores.dias_uteis_mes ?? 20}
                  onChange={(e) => setDores({ ...dores, dias_uteis_mes: Number(e.target.value) || undefined })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prospecções/dia <span className="text-muted-foreground">(atual)</span></Label>
                <Input type="number" placeholder="5"
                  value={dores.prospeccoes_dia_atual ?? ""}
                  onChange={(e) => setDores({ ...dores, prospeccoes_dia_atual: Number(e.target.value) || undefined })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prospecções/dia <span className="text-emerald-500">(ideal p/ meta)</span></Label>
                <Input type="number" placeholder="30"
                  value={dores.prospeccoes_dia_ideal ?? ""}
                  onChange={(e) => setDores({ ...dores, prospeccoes_dia_ideal: Number(e.target.value) || undefined })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo p/ atingir meta (meses)</Label>
                <Input type="number" placeholder="3"
                  value={dores.prazo_meta_meses ?? ""}
                  onChange={(e) => setDores({ ...dores, prazo_meta_meses: Number(e.target.value) || undefined })} />
              </div>
            </div>

            {/* Prévia do leak */}
            {(() => {
              const leak = calcularRevenueLeak(dores);
              if (!leak) return (
                <p className="text-[11px] text-muted-foreground italic">
                  Preencha ticket médio, taxa de conversão e prospecções/dia para ver sua perda estimada.
                </p>
              );
              return (
                <div className="grid sm:grid-cols-3 gap-2 pt-2 border-t border-rose-500/20">
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">Perda mensal</div>
                    <div className="text-lg font-bold text-rose-600">R$ {Math.round(leak.perda_mensal).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">Por dia</div>
                    <div className="text-lg font-bold text-rose-500">R$ {Math.round(leak.perda_diaria).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">Em {leak.prazo_meses}m</div>
                    <div className="text-lg font-bold text-rose-700">R$ {Math.round(leak.perda_projetada).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* === Time comercial — custo, produção e ROI === */}
          <TimeComercialInputs dores={dores} setDores={setDores} />


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

          {/* Curva ABC integrada */}
          <CurvaABCEditor
            value={(dores.curva_abc as any) || []}
            onChange={(curva_abc) => setDores({ ...dores, curva_abc } as any)}
          />

          <div className="flex justify-between pt-2 gap-2">
            <Button variant="outline" onClick={() => setStep("dores")} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => setStep("intel")} className="gap-2">
              Próxima: Grow Sales Intelligence <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ STEP: GROW SALES INTELLIGENCE (Calculadora) ============
  if (step === "intel") {
    return (
      <Card className="border-2 animate-fade-in">
        <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Badge variant="outline" className="mb-1 text-xs">Etapa 2.5 · Calculadora Comercial</Badge>
              <CardTitle className="text-lg">Grow Sales Intelligence</CardTitle>
              <CardDescription className="text-xs">
                Simule cenários, compare KPIs e dimensione o time antes de avaliar as alavancas.
              </CardDescription>
            </div>
          </div>
          <Progress value={50} className="h-1.5 mt-3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <GrowSalesIntelligence />
          <div className="flex justify-between pt-2 gap-2">
            <Button variant="outline" onClick={() => setStep("swot")} className="gap-2">
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
              if (currentAlavanca === 0) setStep("intel");
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
                      onSuccess: async (saved) => {
                        toast.success("Diagnóstico salvo! Gerando roadmap...");
                        setStep("result");
                        try {
                          await genRoadmap.mutateAsync(saved as DiagnosticoResposta);
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
    genRoadmap={genRoadmap}
    roadmap={roadmap}
    updateRoadmap={updateRoadmap}
  />;
}

// ============================================================
// RESULTADO + GARGALOS + ROADMAP
// ============================================================
function ResultadoDiagnostico({
  onRefazer, genRoadmap, roadmap, updateRoadmap,
}: {
  onRefazer: () => void;
  genRoadmap: ReturnType<typeof useGerarRoadmapDiagnostico>;
  roadmap: any[] | undefined;
  updateRoadmap: ReturnType<typeof useUpdateRoadmapItem>;
}) {
  const isGenerating = genRoadmap.isPending;
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
      {/* RESUMO EXECUTIVO CONSULTIVO — risco, previsibilidade, dependência do dono, capacidade */}
      <ResumoExecutivoConsultivo result={result} alavancas={alavancas} />

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

      {/* === CUSTO DA INAÇÃO (Revenue Leak Engine) === */}
      <RevenueLeakCard result={result} />

      {/* === IMPACTO FINANCEIRO EXPANDIDO — risco, 4 escalas, custos invisíveis, cenários e CTA === */}
      <ImpactoFinanceiroExpandido result={result} />

      {/* === ANÁLISE DO TIME COMERCIAL — custo x produção x ROI === */}
      <TimeComercialResultCard result={result} />

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

      {/* PLANO IA — renderização rica seccionada */}
      {result.diagnostico_ia ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold">Plano de Ação — GROW Advisor IA</h3>
          </div>
          <PlanoIARenderer markdown={result.diagnostico_ia} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Plano de ação sendo gerado pela IA…
          </CardContent>
        </Card>
      )}

      {/* ROADMAP — prazo dinâmico definido pela empresa, agrupado por fase */}
      {(() => {
        const meses = result.prazo_meta_meses || 3;
        const totalSemanas = Math.max(4, Math.round(meses * 4));
        const fase1End = Math.ceil(totalSemanas / 3);
        const fase2End = Math.ceil((totalSemanas * 2) / 3);
        const FASES = [
          { key: "quick", label: "Quick Wins", desc: "Parar a hemorragia", icon: Flame, color: "from-rose-500 to-orange-500", border: "border-rose-500/30", from: 1, to: fase1End },
          { key: "estrut", label: "Estruturação", desc: "Processos e cadências", icon: Settings as any, color: "from-blue-500 to-cyan-500", border: "border-blue-500/30", from: fase1End + 1, to: fase2End },
          { key: "escala", label: "Escala", desc: "Otimização e previsibilidade", icon: TrendingUp, color: "from-emerald-500 to-teal-500", border: "border-emerald-500/30", from: fase2End + 1, to: totalSemanas },
        ];
        const concluidos = (roadmap || []).filter((r: any) => r.status === "done").length;
        const totalItens = roadmap?.length || 0;
        const pctRoad = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0;

        return (
          <Card className="border-2 border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Map className="h-5 w-5 text-primary" /> Roadmap Executivo — {meses} {meses === 1 ? "mês" : "meses"} ({totalSemanas} semanas)
                  </CardTitle>
                  <CardDescription>
                    Plano semanal alinhado ao prazo da sua meta, dividido em 3 fases.
                    {totalItens > 0 && <> · <span className="text-emerald-600 font-medium">{concluidos}/{totalItens} concluídos ({pctRoad}%)</span></>}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => genRoadmap.mutate(result)}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {totalItens ? "Regenerar" : "Gerar roadmap"}
                </Button>
              </div>
              {totalItens > 0 && <Progress value={pctRoad} className="h-1.5 mt-2" />}
            </CardHeader>
            <CardContent>
              {!totalItens ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {isGenerating ? (
                    <><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Gerando seu roadmap personalizado…</>
                  ) : (
                    <>Clique em <strong>Gerar roadmap</strong> para criar o plano de {totalSemanas} semanas baseado no seu diagnóstico.</>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {FASES.map((fase) => {
                    const itensFase = (roadmap || [])
                      .filter((r: any) => r.week >= fase.from && r.week <= fase.to)
                      .sort((a: any, b: any) => a.week - b.week);
                    if (!itensFase.length) return null;
                    const FaseIcon = fase.icon;
                    return (
                      <div key={fase.key} className={cn("rounded-lg border-2 overflow-hidden", fase.border)}>
                        <div className={cn("bg-gradient-to-r p-3 flex items-center justify-between text-white", fase.color)}>
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-white/20">
                              <FaseIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold">{fase.label}</div>
                              <div className="text-[11px] opacity-90">{fase.desc}</div>
                            </div>
                          </div>
                          <Badge className="bg-white/20 text-white border-0 text-[10px]">
                            Semanas {fase.from}–{fase.to} · {itensFase.length} ações
                          </Badge>
                        </div>
                        <div className="p-3 space-y-2 bg-card">
                          {itensFase.map((item: any) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border transition",
                                item.status === "done" && "bg-emerald-500/5 border-emerald-500/30",
                                item.status === "in_progress" && "bg-amber-500/5 border-amber-500/30",
                                item.status === "pending" && "hover:bg-muted/30"
                              )}
                            >
                              <button
                                onClick={() => {
                                  const next = item.status === "done" ? "pending"
                                    : item.status === "pending" ? "in_progress" : "done";
                                  updateRoadmap.mutate({ id: item.id, status: next });
                                }}
                                className="mt-0.5"
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
                                  <Badge variant="outline" className="text-[10px] font-mono">S{item.week}</Badge>
                                  <Badge variant="secondary" className="text-[10px] capitalize">{item.pillar}</Badge>
                                  <Badge className={cn(
                                    "text-[10px] border-0",
                                    item.priority === "high" && "bg-rose-500 text-white",
                                    item.priority === "medium" && "bg-amber-500 text-white",
                                    item.priority === "low" && "bg-emerald-500 text-white",
                                  )}>
                                    {item.priority === "high" ? "Alta" : item.priority === "medium" ? "Média" : "Baixa"}
                                  </Badge>
                                </div>
                                <div className={cn("text-sm font-semibold", item.status === "done" && "line-through text-muted-foreground")}>
                                  {item.title}
                                </div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</div>
                                )}
                                {item.expected_impact && (
                                  <div className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> {item.expected_impact}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onRefazer} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Refazer diagnóstico
        </Button>
        <Button
          onClick={() => gerarPDFDiagnostico(result, alavancas, gargalos || [])}
          className="gap-2"
        >
          <Download className="h-4 w-4" /> Baixar PDF do diagnóstico
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// 💰 REVENUE LEAK CARD — Custo da Inação
// ============================================================
const MODULOS_LINK: Record<string, { label: string; route: string }> = {
  prospeccao: { label: "Ir para Prospecção", route: "/prospeccao" },
  processos:  { label: "Ir para Processos Comerciais", route: "/processos" },
  gestao:     { label: "Ir para Analytics", route: "/analytics" },
  automacao:  { label: "Ir para IA & Automações", route: "/ia" },
  pessoas:    { label: "Ir para Gamificação", route: "/configuracoes/gamificacao" },
};

function RevenueLeakCard({ result }: { result: any }) {
  const navigate = useNavigate();
  const leakBase: RevenueLeak | null =
    (result?.revenue_leak as RevenueLeak) || calcularRevenueLeak(result || {});

  // Identifica gargalo principal (alavanca com menor score)
  const piorPilar = useMemo(() => {
    if (!result?.pontuacoes) return null;
    const entries = Object.entries(result.pontuacoes as Record<string, number>);
    if (!entries.length) return null;
    return entries.sort((a, b) => a[1] - b[1])[0];
  }, [result]);

  // ===== Defaults realistas (cresc. 2x-3x da realidade atual, NÃO 15x) =====
  const defaults = useMemo(() => {
    const ticket = Number(result?.ticket_medio) || 0;
    const conv = Number(result?.taxa_conversao) || 0;
    const dias = Number(result?.dias_uteis_mes) || 20;
    const atual = Number(result?.prospeccoes_dia_atual) || 0;
    // Meta ideal realista: limitada a 3x da realidade atual (ou o ideal informado, o menor entre eles)
    const idealInformado = Number(result?.prospeccoes_dia_ideal) || 0;
    const idealRealista = atual > 0
      ? Math.min(idealInformado || atual * 3, atual * 3)
      : idealInformado;
    return {
      ticket, conv, dias, atual,
      ideal: idealRealista || atual * 2 || 10,
      prazo: Number(result?.prazo_meta_meses) || 6,
    };
  }, [result]);

  const [ticket, setTicket] = useState(defaults.ticket);
  const [conv, setConv] = useState(defaults.conv);
  const [atualDia, setAtualDia] = useState(defaults.atual);
  const [idealDia, setIdealDia] = useState(defaults.ideal);
  const [prazo, setPrazo] = useState(defaults.prazo);
  const [showConfig, setShowConfig] = useState(false);
  const [extraVendas, setExtraVendas] = useState(10);

  useEffect(() => {
    setTicket(defaults.ticket);
    setConv(defaults.conv);
    setAtualDia(defaults.atual);
    setIdealDia(defaults.ideal);
    setPrazo(defaults.prazo);
  }, [defaults]);

  const fmt = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  const parseBR = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

  const leak = useMemo(() => {
    const c = conv / 100;
    if (!ticket || !c || (!atualDia && !idealDia)) return null;
    const leadsIdeaisMes = idealDia * defaults.dias;
    const leadsAtuaisMes = atualDia * defaults.dias;
    const clientesPotenciais = leadsIdeaisMes * c;
    const clientesAtuais = leadsAtuaisMes * c;
    const receita_potencial = clientesPotenciais * ticket;
    const receita_atual_estimada = clientesAtuais * ticket;
    const perda_mensal = Math.max(0, receita_potencial - receita_atual_estimada);
    const perda_diaria = perda_mensal / defaults.dias;
    const perda_projetada = perda_mensal * prazo;
    const capacidade_uso_pct = receita_potencial > 0
      ? Math.round((receita_atual_estimada / receita_potencial) * 100) : 0;
    return {
      receita_potencial, receita_atual_estimada, perda_mensal, perda_diaria,
      perda_projetada, capacidade_uso_pct, prazo_meses: prazo,
      leads_ideais_mes: leadsIdeaisMes, leads_atuais_mes: leadsAtuaisMes,
      clientes_potenciais: clientesPotenciais, clientes_atuais: clientesAtuais,
    } as RevenueLeak;
  }, [ticket, conv, atualDia, idealDia, prazo, defaults.dias]);

  const editado = ticket !== defaults.ticket || conv !== defaults.conv
    || atualDia !== defaults.atual || idealDia !== defaults.ideal || prazo !== defaults.prazo;

  if (!leak) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-2 opacity-50" />
          Para calcular o <strong>Custo da Inação</strong>, refaça o diagnóstico
          informando ticket médio, taxa de conversão e prospecções/dia.
        </CardContent>
      </Card>
    );
  }

  // Discurso adaptativo conforme pior pilar
  const piorKey = piorPilar?.[0] || "";
  const focoMensagem = (() => {
    const kpi = piorKey.includes("prospec")
      ? "volume de prospecção" : piorKey.includes("processo")
      ? "padronização de processos" : piorKey.includes("gest")
      ? "controle e gestão" : piorKey.includes("automa")
      ? "automação e IA" : piorKey.includes("pesso")
      ? "performance de pessoas" : "execução comercial";
    return `Seu principal gargalo é falta de ${kpi}. Hoje você opera com apenas ${leak.capacidade_uso_pct}% da sua capacidade comercial.`;
  })();

  // Mapeia pior pilar -> módulo da plataforma
  const moduloRecomendado = piorKey.includes("prospec") ? MODULOS_LINK.prospeccao
    : piorKey.includes("processo") ? MODULOS_LINK.processos
    : piorKey.includes("gest") ? MODULOS_LINK.gestao
    : piorKey.includes("automa") ? MODULOS_LINK.automacao
    : piorKey.includes("pesso") ? MODULOS_LINK.pessoas
    : MODULOS_LINK.prospeccao;

  return (
    <Card className="border-2 border-rose-500/40 overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-rose-500 text-white border-0">💸 Custo da Inação</Badge>
          <Badge variant="outline" className="text-[10px]">Revenue Leak Engine</Badge>
        </div>
        <CardTitle className="text-lg flex items-center gap-2">
          <Flame className="h-5 w-5 text-rose-500" />
          Quanto sua empresa deixa de faturar todos os dias
        </CardTitle>
        <CardDescription>
          Cálculo baseado em ticket médio, taxa de conversão e prospecção atual vs. ideal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ====== EDITOR DE PREMISSAS (simples) ====== */}
        <div className="rounded-lg border bg-muted/30">
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Settings className="h-4 w-4 text-primary" />
              Ajustar premissas em tempo real
              {editado && <Badge className="bg-amber-500 text-white border-0 text-[10px]">Editado</Badge>}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {showConfig ? "Recolher ▲" : "Personalize sem refazer o diagnóstico ▼"}
            </span>
          </button>
          {showConfig && (
            <div className="p-3 pt-0 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 border-t">
              <div className="space-y-1">
                <Label className="text-[11px]">Ticket médio</Label>
                <Input value={fmt(ticket)} onChange={(e) => setTicket(parseBR(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Taxa de conversão (%)</Label>
                <Input type="number" value={conv} onChange={(e) => setConv(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Prospecções/dia hoje</Label>
                <Input type="number" value={atualDia} onChange={(e) => setAtualDia(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Prospecções/dia meta</Label>
                <Input type="number" value={idealDia} onChange={(e) => setIdealDia(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Horizonte (meses)</Label>
                <div className="flex gap-1">
                  {[3, 6, 12].map((m) => (
                    <Button
                      key={m} size="sm" variant={prazo === m ? "default" : "outline"}
                      onClick={() => setPrazo(m)} className="flex-1 h-9 text-xs"
                    >{m}m</Button>
                  ))}
                </div>
              </div>
              <p className="sm:col-span-2 lg:col-span-5 text-[10px] text-muted-foreground">
                💡 Recomendamos meta realista: <b>2x a 3x a sua prospecção atual</b>. Metas muito agressivas geram cenários irreais.
              </p>
            </div>
          )}
        </div>

        {/* ====== CENÁRIO ATUAL vs CENÁRIO META (lado a lado, fórmula visível) ====== */}
        <div className="grid md:grid-cols-2 gap-3">
          {/* HOJE */}
          <div className="rounded-lg p-4 border-2 border-muted bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-[10px]">📊 SITUAÇÃO ATUAL</Badge>
              <span className="text-[10px] text-muted-foreground">Hoje</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Faturamento estimado / mês</div>
            <div className="text-3xl font-black">{fmt(leak.receita_atual_estimada)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {atualDia} prospecções/dia × {defaults.dias} dias × {conv}% conversão × {fmt(ticket)} ticket
            </div>
            <div className="text-xs mt-2">
              ≈ <b>{Math.round(leak.clientes_atuais)} clientes/mês</b> · {leak.leads_atuais_mes} leads/mês
            </div>
          </div>

          {/* META */}
          <div className="rounded-lg p-4 border-2 border-emerald-500/40 bg-emerald-500/5">
            <div className="flex items-center justify-between mb-2">
              <Badge className="bg-emerald-600 text-white border-0 text-[10px]">🎯 CENÁRIO META</Badge>
              <span className="text-[10px] text-muted-foreground">Atingível em {prazo}m</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Faturamento possível / mês</div>
            <div className="text-3xl font-black text-emerald-700">{fmt(leak.receita_potencial)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {idealDia} prospecções/dia × {defaults.dias} dias × {conv}% conversão × {fmt(ticket)} ticket
            </div>
            <div className="text-xs mt-2">
              ≈ <b>{Math.round(leak.clientes_potenciais)} clientes/mês</b> · {leak.leads_ideais_mes} leads/mês
            </div>
          </div>
        </div>

        {/* ====== SIMULADOR RÁPIDO: "E SE eu vendesse +X clientes?" ====== */}
        <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">🧮 SIMULADOR RÁPIDO</Badge>
            <span className="text-xs font-semibold">E se eu fizesse mais vendas no mesmo ticket?</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-[11px]">Vendas extras / mês</Label>
              <Input
                type="number"
                min={0}
                value={extraVendas}
                onChange={(e) => setExtraVendas(Math.max(0, Number(e.target.value) || 0))}
              />
              <div className="flex gap-1 pt-1">
                {[5, 10, 20, 50].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={extraVendas === n ? "default" : "outline"}
                    onClick={() => setExtraVendas(n)}
                    className="flex-1 h-7 text-[11px]"
                  >+{n}</Button>
                ))}
              </div>
            </div>
            <div className="rounded-lg p-3 border bg-background">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Receita extra / mês</div>
              <div className="text-2xl font-black text-emerald-600">{fmt(extraVendas * ticket)}</div>
              <div className="text-[10px] text-muted-foreground">
                {extraVendas} vendas × {fmt(ticket)} ticket
              </div>
            </div>
            <div className="rounded-lg p-3 border bg-background">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Novo faturamento / mês</div>
              <div className="text-2xl font-black text-foreground">
                {fmt(leak.receita_atual_estimada + extraVendas * ticket)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Em {prazo}m: <b className="text-emerald-600">{fmt((leak.receita_atual_estimada + extraVendas * ticket) * prazo)}</b>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            💡 Para conquistar <b>{extraVendas} clientes a mais</b> com sua conversão de <b>{conv}%</b>, você precisa de
            {" "}<b>≈ {Math.ceil(extraVendas / Math.max(0.01, conv / 100))} leads extras/mês</b>
            {" "}({Math.ceil(extraVendas / Math.max(0.01, conv / 100) / defaults.dias)} prospecções/dia a mais).
          </p>
        </div>

        {/* ====== HEMORRAGIA EM LINHAS DE TEMPO ====== */}
        <div className="rounded-lg border-2 border-rose-500/30 overflow-hidden">
          <div className="bg-rose-500/10 px-3 py-2 flex items-center justify-between">
            <div className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <Flame className="h-4 w-4" /> Quanto você está perdendo
            </div>
            <span className="text-[10px] text-rose-700 font-mono">
              = (R$ Meta − R$ Atual)
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-rose-500/20">
            {[
              { label: "POR DIA", v: leak.perda_diaria, sub: "dia útil" },
              { label: "POR SEMANA", v: leak.perda_diaria * 5, sub: "5 dias úteis" },
              { label: "POR MÊS", v: leak.perda_mensal, sub: `${defaults.dias} dias úteis` },
              { label: "POR TRIMESTRE", v: leak.perda_mensal * 3, sub: "3 meses" },
              { label: `EM ${prazo} MESES`, v: leak.perda_projetada, sub: "se nada mudar", big: true },
            ].map((it) => (
              <div key={it.label} className={`p-3 bg-background ${it.big ? "bg-rose-500/5" : ""}`}>
                <div className="text-[10px] uppercase font-bold text-rose-700">{it.label}</div>
                <div className={`font-black text-rose-700 ${it.big ? "text-2xl" : "text-lg"}`}>
                  {fmt(it.v)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{it.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Capacidade usada */}
        <div className="rounded-lg p-3 border bg-gradient-to-r from-amber-500/5 to-rose-500/5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold">Capacidade comercial usada</span>
            <span className="font-mono">{leak.capacidade_uso_pct}%</span>
          </div>
          <Progress value={leak.capacidade_uso_pct} className="h-2" />
          <div className="text-[11px] text-muted-foreground mt-2">
            Você usa <b>{leak.capacidade_uso_pct}%</b> do potencial — sobram <b>{100 - leak.capacidade_uso_pct}%</b> de receita inexplorada.
          </div>
        </div>

        {/* Frase de impacto + diagnóstico interpretativo */}
        <div className="rounded-lg p-4 bg-gradient-to-br from-rose-500/10 to-orange-500/5 border border-rose-500/30">
          <p className="text-sm font-semibold text-foreground">
            "Você não está faturando pouco — está deixando dinheiro na mesa todos os dias."
          </p>
          <p className="text-xs text-muted-foreground mt-2">{focoMensagem}</p>
        </div>

        {/* CTA — Ação direta no módulo certo */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between p-3 rounded-lg border-2 border-primary/40 bg-primary/5">
          <div className="text-sm">
            <div className="font-semibold flex items-center gap-1">
              <Zap className="h-4 w-4 text-primary" /> Ação imediata recomendada
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Resolva o gargalo principal direto no módulo correspondente.
            </div>
          </div>
          <Button onClick={() => navigate(moduloRecomendado.route)} className="gap-2">
            {moduloRecomendado.label} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 📄 GERADOR DE PDF DO DIAGNÓSTICO
// ============================================================
function gerarPDFDiagnostico(result: any, alavancas: any[], gargalos: any[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLine = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    lines.forEach((ln: string) => {
      ensureSpace(size + 4);
      doc.text(ln, margin, y);
      y += size + 4;
    });
  };

  const section = (title: string) => {
    y += 8;
    ensureSpace(28);
    doc.setFillColor(34, 197, 94);
    doc.rect(margin, y - 2, pageW - margin * 2, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin + 8, y + 13);
    y += 30;
  };

  const c = CLASSIFICACOES[result.nota as keyof typeof CLASSIFICACOES];

  // Cabeçalho
  doc.setFillColor(15, 41, 25);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Diagnóstico Comercial 360°", margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    margin,
    58
  );
  y = 100;

  // Score
  section("Resultado Geral");
  writeLine(`Nota: ${result.nota}  —  ${c?.titulo || ""}`, 14, true);
  writeLine(`Score: ${result.total_score}/${(alavancas.length || 0) * 10}  (${result.percentual}%)`, 11);
  if (c?.cenario) writeLine(`Cenário: ${c.cenario}`, 10);
  if (c?.recomendacao) writeLine(`Recomendação: ${c.recomendacao}`, 10);

  // Meta
  if (result.faturamento_atual || result.meta_faturamento) {
    section("Faturamento e Meta");
    if (result.faturamento_atual)
      writeLine(`Faturamento atual: R$ ${Number(result.faturamento_atual).toLocaleString("pt-BR")}`);
    if (result.meta_faturamento)
      writeLine(`Meta: R$ ${Number(result.meta_faturamento).toLocaleString("pt-BR")}`);
    if (result.faturamento_atual && result.meta_faturamento) {
      const gap = Number(result.meta_faturamento) - Number(result.faturamento_atual);
      writeLine(`GAP em ${result.prazo_meta_meses || 6} meses: R$ ${gap.toLocaleString("pt-BR")}`, 10, true);
    }
  }

  // Dores e desejos
  if (result.principal_dor || result.principal_desejo || result.o_que_travou) {
    section("Dores, Desejos e Bloqueios");
    if (result.principal_dor) writeLine(`Principal dor: ${result.principal_dor}`);
    if (result.principal_desejo) writeLine(`Principal desejo: ${result.principal_desejo}`);
    if (result.o_que_travou) writeLine(`O que travou: ${result.o_que_travou}`);
  }

  // SWOT
  if (result.swot_forcas || result.swot_fraquezas || result.swot_oportunidades || result.swot_ameacas) {
    section("Análise SWOT");
    if (result.swot_forcas) writeLine(`Forças: ${result.swot_forcas}`);
    if (result.swot_fraquezas) writeLine(`Fraquezas: ${result.swot_fraquezas}`);
    if (result.swot_oportunidades) writeLine(`Oportunidades: ${result.swot_oportunidades}`);
    if (result.swot_ameacas) writeLine(`Ameaças: ${result.swot_ameacas}`);
  }

  // Alavancas
  section("Pontuação por Alavanca");
  alavancas.forEach((a) => {
    const score = result.pontuacoes?.[a.id] || 0;
    writeLine(`• ${a.nome}: ${score}/10`, 10, score < 5);
  });

  // Gargalos
  if (gargalos.length > 0) {
    section("Gargalos Detectados");
    gargalos.forEach((g, i) => {
      const status = g.status === "corrigido" ? "✓ Corrigido" : "○ Pendente";
      writeLine(`${i + 1}. [${status}] ${g.titulo || g.descricao || ""}`, 10, true);
      if (g.descricao && g.titulo) writeLine(`   ${g.descricao}`, 9, false, [80, 80, 80]);
    });
  }

  // Rodapé com paginação
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 20, { align: "right" });
  }

  doc.save(`diagnostico-comercial-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
