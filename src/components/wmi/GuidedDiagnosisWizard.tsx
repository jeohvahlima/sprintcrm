import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Megaphone, Instagram,
  ShieldAlert, TrendingDown, Sparkles, Lock,
} from "lucide-react";
import { GuidedPilar, useGuidedDiagnosis, useSaveGuidedPilar } from "@/hooks/useGuidedDiagnosis";

/* ============================================================
   QUESTION DEFINITIONS
   ============================================================ */
type Question =
  | { id: string; type: "scale"; q: string; help?: string; weight?: number }
  | { id: string; type: "yesno"; q: string; help?: string; weight?: number; positive?: boolean }
  | { id: string; type: "choice"; q: string; help?: string; options: { v: string; label: string; pts: number }[] }
  | { id: string; type: "multi"; q: string; help?: string; options: { v: string; label: string }[]; minDistinct?: number }
  | { id: string; type: "money"; q: string; help?: string; max?: number };

interface PilarDef {
  key: GuidedPilar;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  intro: string;
  questions: Question[];
  /** computeScore receives raw responses, returns 0-20 */
  computeScore: (r: Record<string, any>) => number;
  insight: (r: Record<string, any>, score: number) => string;
}

const PILARES: PilarDef[] = [
  /* ---------- AQUISIÇÃO ---------- */
  {
    key: "aquisicao",
    title: "Aquisição & Marketing",
    subtitle: "De onde vêm seus pacientes e quanto custa cada um",
    icon: Megaphone,
    color: "from-blue-500 to-cyan-400",
    intro:
      "Vamos mapear seus canais de aquisição, investimento em tráfego e descobrir se há dependência perigosa de um único canal.",
    questions: [
      {
        id: "canais",
        type: "multi",
        q: "Quais canais hoje trazem pacientes/clientes para sua clínica?",
        help: "Marque todos que aplicam.",
        options: [
          { v: "instagram", label: "Instagram orgânico" },
          { v: "google", label: "Google (busca/Maps)" },
          { v: "indicacao", label: "Indicação boca a boca" },
          { v: "ads_meta", label: "Tráfego pago (Meta/Instagram)" },
          { v: "ads_google", label: "Google Ads" },
          { v: "convenio", label: "Convênios" },
          { v: "site", label: "Site / SEO orgânico" },
          { v: "parcerias", label: "Parcerias" },
        ],
      },
      {
        id: "investe_ads",
        type: "yesno",
        q: "A clínica investe em tráfego pago atualmente?",
        positive: true,
      },
      {
        id: "investimento_mensal",
        type: "money",
        q: "Quanto investe por mês em mídia paga?",
        help: "Some Meta Ads + Google Ads + outros. Pule se não investe.",
        max: 50000,
      },
      {
        id: "sabe_cpl",
        type: "yesno",
        q: "Você sabe seu CPL (custo por lead) e CAC (custo por paciente)?",
        positive: true,
      },
      {
        id: "campanha_que_converte",
        type: "yesno",
        q: "Sabe identificar qual campanha mais converte em paciente?",
        positive: true,
      },
      {
        id: "ja_pausou_ads",
        type: "choice",
        q: "Já interrompeu campanhas por falta de resultado?",
        options: [
          { v: "nunca", label: "Nunca", pts: 2 },
          { v: "sim_traf", label: "Sim — o problema era o tráfego", pts: 3 },
          { v: "sim_op",   label: "Sim — descobri que o problema era atendimento/operação", pts: 4 },
          { v: "nao_sei",  label: "Não sei dizer", pts: 0 },
        ],
      },
      {
        id: "integra_marketing",
        type: "scale",
        q: "Marketing e atendimento (secretária/comercial) trabalham integrados?",
        help: "0 = totalmente desconectados, 5 = funil único e rastreado.",
      },
    ],
    computeScore: (r) => {
      let s = 0;
      const canais: string[] = r.canais || [];
      // diversidade de canais (até 6 pts)
      s += Math.min(6, canais.length * 1.2);
      // dependência de canal único = penalidade
      if (canais.length === 1) s = Math.max(0, s - 2);
      if (r.investe_ads === true) s += 2;
      if (r.sabe_cpl === true) s += 3;
      if (r.campanha_que_converte === true) s += 3;
      const pausa = (PILARES[0].questions.find(q => q.id === "ja_pausou_ads") as any)
        ?.options?.find((o: any) => o.v === r.ja_pausou_ads)?.pts ?? 0;
      s += pausa;
      s += Math.min(2, ((r.integra_marketing ?? 0) / 5) * 2);
      return Math.round(Math.max(0, Math.min(20, s)));
    },
    insight: (r, score) => {
      const canais: string[] = r.canais || [];
      if (canais.length === 1)
        return `Dependência crítica de "${canais[0]}". Se esse canal cai, sua clínica para de receber pacientes.`;
      if (r.sabe_cpl === false && r.investe_ads === true)
        return "Você investe em mídia mas não sabe o custo por paciente — está pilotando no escuro.";
      if (score >= 14) return "Aquisição madura, com diversificação de canais e métricas claras.";
      return "Aquisição ainda imatura. Próximo passo: mensurar CPL e diversificar canais.";
    },
  },

  /* ---------- SOCIAL SELLING ---------- */
  {
    key: "social",
    title: "Social Selling — Instagram",
    subtitle: "Sua presença comercial nas redes converte ou só gera atenção?",
    icon: Instagram,
    color: "from-pink-500 to-fuchsia-400",
    intro:
      "Para clínicas, Instagram é o cartão de visita. Vamos avaliar se ele está convertendo seguidor em paciente.",
    questions: [
      { id: "tempo_resposta", type: "scale", q: "Quão rápido vocês respondem mensagens no Instagram?", help: "0 = horas/dias, 5 = imediato/instantâneo." },
      { id: "usa_cta", type: "yesno", q: "Os posts e stories têm CTA claro (chamar no WhatsApp, agendar)?", positive: true },
      { id: "prova_social", type: "yesno", q: "Vocês usam prova social (depoimentos, antes/depois)?", positive: true },
      { id: "stories_diarios", type: "yesno", q: "Postam stories diariamente?", positive: true },
      { id: "autoridade", type: "scale", q: "O conteúdo passa autoridade técnica do(s) profissional(is)?", help: "0 = só estética/aleatório, 5 = autoridade clara." },
      { id: "ponte_whatsapp", type: "yesno", q: "Existe processo claro de Instagram → WhatsApp → agendamento?", positive: true },
      {
        id: "instagram_resultado",
        type: "choice",
        q: "Quanto do faturamento atual vem do Instagram?",
        options: [
          { v: "nenhum", label: "Quase nada / não rastreio", pts: 0 },
          { v: "ate_20", label: "Até 20%", pts: 1 },
          { v: "20_50",  label: "20-50%", pts: 3 },
          { v: "mais_50",label: "Mais de 50%", pts: 4 },
        ],
      },
    ],
    computeScore: (r) => {
      let s = 0;
      s += Math.min(4, ((r.tempo_resposta ?? 0) / 5) * 4);
      if (r.usa_cta) s += 3;
      if (r.prova_social) s += 3;
      if (r.stories_diarios) s += 2;
      s += Math.min(3, ((r.autoridade ?? 0) / 5) * 3);
      if (r.ponte_whatsapp) s += 3;
      const ir = (PILARES[1].questions.find(q => q.id === "instagram_resultado") as any)
        ?.options?.find((o: any) => o.v === r.instagram_resultado)?.pts ?? 0;
      s += ir;
      return Math.round(Math.max(0, Math.min(20, s)));
    },
    insight: (r, score) => {
      if (r.tempo_resposta != null && r.tempo_resposta < 3)
        return "Demora na resposta no Instagram = lead perdido. Maior gargalo é operacional, não conteúdo.";
      if (r.ponte_whatsapp === false)
        return "Falta uma ponte clara Instagram → WhatsApp. Conteúdo gera atenção, mas não vira paciente.";
      if (score >= 14) return "Instagram comercial maduro: gera atenção e converte.";
      return "Instagram gera audiência mas a conversão ainda escapa pela operação.";
    },
  },

  /* ---------- DEPENDÊNCIA OPERACIONAL ---------- */
  {
    key: "dependencia",
    title: "Dependência Operacional",
    subtitle: "Sua operação roda sem você (e sem a secretária-chave)?",
    icon: ShieldAlert,
    color: "from-amber-500 to-orange-400",
    intro:
      "Aqui medimos o risco operacional: o quanto a clínica depende de pessoas-chave para continuar faturando.",
    questions: [
      { id: "sem_secretaria", type: "yesno", q: "Se a secretária principal sair hoje, a operação continua sem cair?", positive: true },
      { id: "atendimento_documentado", type: "yesno", q: "O atendimento está documentado (script, fluxo, FAQ)?", positive: true },
      { id: "tem_script", type: "yesno", q: "Existe script para WhatsApp/agendamento/objeções?", positive: true },
      { id: "tem_processo", type: "yesno", q: "Existe processo escrito para o paciente (do primeiro contato ao retorno)?", positive: true },
      { id: "dono_acompanha", type: "scale", q: "O dono(a) acompanha indicadores semanalmente?", help: "0 = nunca olha números, 5 = revisão semanal estruturada." },
      { id: "rotina_comercial", type: "yesno", q: "Existe rotina comercial (reunião semanal, metas, follow-up)?", positive: true },
      {
        id: "pessoa_chave",
        type: "choice",
        q: "Quanto da operação depende de UMA pessoa específica?",
        options: [
          { v: "100", label: "100% — sem ela trava tudo", pts: 0 },
          { v: "70",  label: "Cerca de 70%", pts: 1 },
          { v: "50",  label: "Metade", pts: 2 },
          { v: "30",  label: "Pouco — equipe distribuída", pts: 4 },
        ],
      },
    ],
    computeScore: (r) => {
      let s = 0;
      if (r.sem_secretaria) s += 3;
      if (r.atendimento_documentado) s += 3;
      if (r.tem_script) s += 2;
      if (r.tem_processo) s += 3;
      s += Math.min(3, ((r.dono_acompanha ?? 0) / 5) * 3);
      if (r.rotina_comercial) s += 2;
      const pc = (PILARES[2].questions.find(q => q.id === "pessoa_chave") as any)
        ?.options?.find((o: any) => o.v === r.pessoa_chave)?.pts ?? 0;
      s += pc;
      return Math.round(Math.max(0, Math.min(20, s)));
    },
    insight: (r, score) => {
      if (r.pessoa_chave === "100")
        return "Risco crítico: sua operação tem um único ponto de falha. Documentar processos é prioridade #1.";
      if (r.dono_acompanha != null && r.dono_acompanha < 2)
        return "Dono fora dos números = decisões no escuro. Crie um ritual semanal de indicadores.";
      if (score >= 14) return "Operação madura, processos documentados e baixa dependência de pessoas-chave.";
      return "Há dependência operacional relevante. Documentação e ritual de gestão são os próximos passos.";
    },
  },

  /* ---------- CRESCIMENTO TRAVADO ---------- */
  {
    key: "crescimento",
    title: "Crescimento Travado",
    subtitle: "Por que a clínica não está crescendo no ritmo que poderia?",
    icon: TrendingDown,
    color: "from-rose-500 to-red-400",
    intro:
      "Identificar o teto e onde está travando: marketing, operação, atendimento ou gestão.",
    questions: [
      {
        id: "estado_atual",
        type: "choice",
        q: "Como descreveria o faturamento dos últimos 6 meses?",
        options: [
          { v: "crescendo", label: "Crescendo de forma consistente", pts: 5 },
          { v: "estavel",   label: "Estável / no mesmo patamar", pts: 2 },
          { v: "oscilando", label: "Oscilando bastante (sobe/desce)", pts: 1 },
          { v: "caindo",    label: "Caindo", pts: 0 },
        ],
      },
      {
        id: "ja_travou",
        type: "yesno",
        q: "Você já sente que bateu um teto e não consegue passar?",
        positive: false,
      },
      {
        id: "principal_gargalo",
        type: "choice",
        q: "Onde você sente que está o maior gargalo hoje?",
        options: [
          { v: "marketing", label: "Marketing — não chegam leads suficientes", pts: 2 },
          { v: "atendimento", label: "Atendimento — leads chegam mas não fecham", pts: 2 },
          { v: "operacao",   label: "Operação — não dá conta do volume atual", pts: 2 },
          { v: "gestao",     label: "Gestão — falta visão dos números e decisões", pts: 1 },
          { v: "nao_sei",    label: "Não sei identificar", pts: 0 },
        ],
      },
      {
        id: "tem_visao_funil",
        type: "yesno",
        q: "Você consegue ver, em números, o funil completo (lead → consulta → procedimento → retorno)?",
        positive: true,
      },
      {
        id: "previsibilidade",
        type: "scale",
        q: "Quão previsível é seu faturamento mensal?",
        help: "0 = nunca sei o quanto vou faturar, 5 = sei com precisão.",
      },
      {
        id: "recompra_acompanhada",
        type: "yesno",
        q: "Você acompanha quantos pacientes voltam (retorno/recompra)?",
        positive: true,
      },
    ],
    computeScore: (r) => {
      let s = 0;
      const estado = (PILARES[3].questions.find(q => q.id === "estado_atual") as any)
        ?.options?.find((o: any) => o.v === r.estado_atual)?.pts ?? 0;
      s += estado;
      if (r.ja_travou === false) s += 3;
      const gar = (PILARES[3].questions.find(q => q.id === "principal_gargalo") as any)
        ?.options?.find((o: any) => o.v === r.principal_gargalo)?.pts ?? 0;
      s += gar;
      if (r.tem_visao_funil) s += 4;
      s += Math.min(4, ((r.previsibilidade ?? 0) / 5) * 4);
      if (r.recompra_acompanhada) s += 2;
      return Math.round(Math.max(0, Math.min(20, s)));
    },
    insight: (r, score) => {
      if (r.principal_gargalo === "atendimento")
        return "Gargalo de atendimento — o problema NÃO é tráfego. É converter quem já chega.";
      if (r.principal_gargalo === "marketing" && r.tem_visao_funil === false)
        return "Você acha que falta lead, mas não vê o funil. Pode estar perdendo no atendimento sem saber.";
      if (r.tem_visao_funil === false)
        return "Sem funil mensurado, decisões viram achismo. Esse é o primeiro destravador.";
      if (score >= 14) return "Operação previsível, com clareza de funil e gargalos identificados.";
      return "Há um teto a quebrar. O destravador é visibilidade de funil + ataque ao gargalo certo.";
    },
  },
];

/* ============================================================
   COMPONENT — UNIFIED SINGLE-FLOW DIAGNOSIS
   ============================================================ */
type FlatItem = { pilarIdx: number; qIdx: number; pilar: PilarDef; q: Question };

const FLAT: FlatItem[] = PILARES.flatMap((p, pilarIdx) =>
  p.questions.map((q, qIdx) => ({ pilarIdx, qIdx, pilar: p, q }))
);

export function GuidedDiagnosisWizard() {
  const { data: existing, isLoading } = useGuidedDiagnosis();
  const save = useSaveGuidedPilar();
  const [answersByPilar, setAnswersByPilar] = useState<Record<string, Record<string, any>>>({});
  const [step, setStep] = useState(0);
  const [savedPilares, setSavedPilares] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  // Hidrata respostas já salvas
  useMemo(() => {
    if (!existing) return;
    const seed: Record<string, Record<string, any>> = {};
    const savedFlags: Record<string, boolean> = {};
    PILARES.forEach((p) => {
      const prev = (existing as any)?.[p.key];
      if (prev?.responses) seed[p.key] = prev.responses;
      if (prev?.completed_at) savedFlags[p.key] = true;
    });
    setAnswersByPilar((cur) => (Object.keys(cur).length ? cur : seed));
    setSavedPilares((cur) => (Object.keys(cur).length ? cur : savedFlags));
  }, [existing]);

  const current = FLAT[step];
  const def = current?.pilar;
  const currentQ = current?.q;
  const Icon = def?.icon;
  const totalQuestions = FLAT.length;
  const progress = ((step + 1) / totalQuestions) * 100;

  const currentAnswers = (def && answersByPilar[def.key]) || {};
  const liveScore = useMemo(() => (def ? def.computeScore(currentAnswers) : 0), [def, currentAnswers]);
  const answered =
    currentQ &&
    currentAnswers[currentQ.id] !== undefined &&
    currentAnswers[currentQ.id] !== null &&
    (currentQ.type !== "multi" ||
      (Array.isArray(currentAnswers[currentQ.id]) && currentAnswers[currentQ.id].length > 0));

  function setAnswer(value: any) {
    if (!def || !currentQ) return;
    setAnswersByPilar((prev) => ({
      ...prev,
      [def.key]: { ...(prev[def.key] || {}), [currentQ.id]: value },
    }));
  }

  async function persistPilar(pilar: PilarDef) {
    const responses = answersByPilar[pilar.key] || {};
    const score = pilar.computeScore(responses);
    try {
      await save.mutateAsync({ pilar: pilar.key, responses, score });
      setSavedPilares((s) => ({ ...s, [pilar.key]: true }));
    } catch (e: any) {
      toast.error(e.message || `Erro ao salvar ${pilar.title}`);
      throw e;
    }
  }

  async function next() {
    if (!current) return;
    const isLastOfPilar = current.qIdx === current.pilar.questions.length - 1;
    const isLastOverall = step === FLAT.length - 1;

    if (isLastOfPilar) {
      try {
        await persistPilar(current.pilar);
        toast.success(`${current.pilar.title} salvo (${current.pilar.computeScore(currentAnswers)}/20)`);
      } catch {
        return;
      }
    }

    if (isLastOverall) {
      setDone(true);
      return;
    }
    setStep(step + 1);
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function jumpToPilar(pilarIdx: number) {
    const idx = FLAT.findIndex((f) => f.pilarIdx === pilarIdx);
    if (idx >= 0) {
      setDone(false);
      setStep(idx);
    }
  }

  /* ---------------- DONE VIEW ---------------- */
  if (done) {
    const totals = PILARES.map((p) => ({
      pilar: p,
      score: p.computeScore(answersByPilar[p.key] || {}),
      saved: !!savedPilares[p.key],
    }));
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Card className="border-2 border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-6 flex items-start gap-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Diagnóstico GROW Revenue Intelligence concluído</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Os 4 pilares já estão refletidos no seu GMI Score na aba <strong>Maturidade & Evolução</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-3">
          {totals.map(({ pilar, score, saved }) => {
            const I = pilar.icon;
            return (
              <Card key={pilar.key} className="overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${pilar.color}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${pilar.color} text-white`}>
                      <I className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm flex-1">{pilar.title}</CardTitle>
                    <Badge variant="secondary" className="font-mono text-xs">{score}/20</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-xs text-muted-foreground">{pilar.insight(answersByPilar[pilar.key] || {}, score)}</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => jumpToPilar(PILARES.indexOf(pilar))}>
                    Revisar respostas <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                  {!saved && <p className="text-[10px] text-amber-600">Não persistido — revise e conclua novamente.</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------- WIZARD VIEW (single unified flow) ---------------- */
  if (!def || !currentQ) return null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header global de progresso (4 pilares) */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">GROW Revenue Intelligence — Diagnóstico unificado</div>
              <p className="text-xs text-muted-foreground">
                Pergunta {step + 1} de {totalQuestions} — todos os 4 pilares em um único fluxo.
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">{Math.round(progress)}%</Badge>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="grid grid-cols-4 gap-1 mt-2">
            {PILARES.map((p, i) => {
              const isCurrent = i === current.pilarIdx;
              const isPast = i < current.pilarIdx || savedPilares[p.key];
              return (
                <button
                  key={p.key}
                  onClick={() => jumpToPilar(i)}
                  className={`text-[10px] py-1 px-2 rounded text-left truncate transition border ${
                    isCurrent ? "border-primary bg-primary/10 font-medium" :
                    isPast ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" :
                    "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {isPast && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />}
                  {p.title.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Card da pergunta atual */}
      <Card className="overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${def.color}`} />
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${def.color} text-white`}>
              {Icon && <Icon className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{def.title}</CardTitle>
              <CardDescription>
                Bloco {current.pilarIdx + 1}/4 · Pergunta {current.qIdx + 1} de {def.questions.length}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">Score parcial: {liveScore}/20</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {current.qIdx === 0 && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 border-l-2 border-primary/40">
              {def.intro}
            </p>
          )}

          <div>
            <Label className="text-base font-medium leading-relaxed">{currentQ.q}</Label>
            {currentQ.help && (
              <p className="text-xs text-muted-foreground mt-1">{currentQ.help}</p>
            )}
          </div>

          {/* SCALE */}
          {currentQ.type === "scale" && (
            <div className="space-y-3">
              <Slider
                value={[currentAnswers[currentQ.id] ?? 0]}
                onValueChange={(v) => setAnswer(v[0])}
                min={0}
                max={5}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={currentAnswers[currentQ.id] === n ? "font-bold text-primary" : ""}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* YES/NO */}
          {currentQ.type === "yesno" && (
            <RadioGroup
              value={currentAnswers[currentQ.id] === true ? "yes" : currentAnswers[currentQ.id] === false ? "no" : ""}
              onValueChange={(v) => setAnswer(v === "yes")}
              className="grid grid-cols-2 gap-3"
            >
              {[{ v: "yes", l: "Sim" }, { v: "no", l: "Não" }].map((o) => (
                <Label
                  key={o.v}
                  htmlFor={`${currentQ.id}_${o.v}`}
                  className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:border-primary"
                >
                  <RadioGroupItem value={o.v} id={`${currentQ.id}_${o.v}`} />
                  <span>{o.l}</span>
                </Label>
              ))}
            </RadioGroup>
          )}

          {/* CHOICE */}
          {currentQ.type === "choice" && (
            <RadioGroup
              value={currentAnswers[currentQ.id] ?? ""}
              onValueChange={(v) => setAnswer(v)}
              className="space-y-2"
            >
              {currentQ.options.map((o) => (
                <Label
                  key={o.v}
                  htmlFor={`${currentQ.id}_${o.v}`}
                  className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:border-primary"
                >
                  <RadioGroupItem value={o.v} id={`${currentQ.id}_${o.v}`} />
                  <span>{o.label}</span>
                </Label>
              ))}
            </RadioGroup>
          )}

          {/* MULTI */}
          {currentQ.type === "multi" && (
            <div className="grid sm:grid-cols-2 gap-2">
              {currentQ.options.map((o) => {
                const arr: string[] = currentAnswers[currentQ.id] || [];
                const checked = arr.includes(o.v);
                return (
                  <Label
                    key={o.v}
                    className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:border-primary"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const nextArr = c ? [...arr, o.v] : arr.filter((x) => x !== o.v);
                        setAnswer(nextArr);
                      }}
                    />
                    <span className="text-sm">{o.label}</span>
                  </Label>
                );
              })}
            </div>
          )}

          {/* MONEY */}
          {currentQ.type === "money" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">R$</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={currentQ.max ?? 100000}
                  value={currentAnswers[currentQ.id] ?? ""}
                  onChange={(e) => setAnswer(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setAnswer(0)}
              >
                Não invisto / pular
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={prev} disabled={step === 0}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Anterior
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={next}>
                Pular
              </Button>
              <Button size="sm" onClick={next} disabled={!answered && currentQ.type !== "money"}>
                {step === FLAT.length - 1 ? (
                  <>Concluir diagnóstico <CheckCircle2 className="h-3.5 w-3.5 ml-1" /></>
                ) : (
                  <>Próximo <ArrowRight className="h-3.5 w-3.5 ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {liveScore > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground">{def.insight(currentAnswers, liveScore)}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Lock className="h-3 w-3" /> carregando respostas anteriores…
        </div>
      )}
    </div>
  );
}

