import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Rocket, Target, FileText, Users, Bot, BarChart3, Trophy,
  CheckCircle2, Circle, ArrowRight, Calendar, Sparkles, RotateCcw,
} from "lucide-react";

interface DayTask {
  key: string;
  label: string;
  route?: string;
  impact: string; // pillar impactado
}
interface OnboardingDay {
  day: number;
  title: string;
  goal: string;
  icon: any;
  color: string;
  pillar: string;
  estMin: number;
  tasks: DayTask[];
}

const PLAN: OnboardingDay[] = [
  {
    day: 1, title: "Fundamentos & ICP", goal: "Definir quem é seu cliente ideal e onde encontrá-lo.",
    icon: Target, color: "from-blue-500 to-cyan-400", pillar: "Prospecção", estMin: 60,
    tasks: [
      { key: "d1_icp", label: "Documentar ICP (segmento, porte, dor, decisor)", route: "/processos", impact: "Processos" },
      { key: "d1_canais", label: "Definir 2 canais primários de prospecção", route: "/prospeccao", impact: "Prospecção" },
      { key: "d1_meta", label: "Definir meta de leads/dia e taxa-alvo", route: "/configuracoes/comercial", impact: "Gestão" },
    ],
  },
  {
    day: 2, title: "Playbook & Scripts", goal: "Padronizar abordagem, qualificação e objeções.",
    icon: FileText, color: "from-purple-500 to-fuchsia-400", pillar: "Processos", estMin: 90,
    tasks: [
      { key: "d2_abordagem", label: "Criar script de abordagem (cold + WhatsApp)", route: "/ia", impact: "Processos" },
      { key: "d2_qualif", label: "Definir critérios de qualificação (BANT/SPIN)", route: "/processos", impact: "Processos" },
      { key: "d2_objecoes", label: "Mapear matriz das TOP 10 objeções", route: "/processos", impact: "Processos" },
    ],
  },
  {
    day: 3, title: "Funil & CRM Higiênico", goal: "Estruturar pipeline com etapas claras e critérios objetivos.",
    icon: BarChart3, color: "from-emerald-500 to-green-400", pillar: "Gestão", estMin: 60,
    tasks: [
      { key: "d3_funil", label: "Criar/revisar funil com 5-7 etapas", route: "/funil", impact: "Gestão" },
      { key: "d3_tags", label: "Cadastrar tags e fontes de origem", route: "/leads", impact: "Gestão" },
      { key: "d3_higiene", label: "Higienizar leads parados há +14 dias", route: "/leads", impact: "Gestão" },
    ],
  },
  {
    day: 4, title: "WhatsApp & Conversas", goal: "Ativar canal principal de relacionamento.",
    icon: Sparkles, color: "from-green-500 to-emerald-400", pillar: "Automação", estMin: 45,
    tasks: [
      { key: "d4_wpp", label: "Conectar WhatsApp (Meta ou Evolution)", route: "/conversas", impact: "Automação" },
      { key: "d4_mensagens", label: "Criar 5 mensagens rápidas / atalhos", route: "/conversas", impact: "Automação" },
      { key: "d4_assinatura", label: "Configurar assinatura e horário comercial", route: "/configuracoes", impact: "Automação" },
    ],
  },
  {
    day: 5, title: "IA & Automação", goal: "Ligar o copiloto comercial e cadências automáticas.",
    icon: Bot, color: "from-amber-500 to-orange-400", pillar: "Automação", estMin: 75,
    tasks: [
      { key: "d5_ia_setup", label: "Treinar IA com base de conhecimento", route: "/ia", impact: "Automação" },
      { key: "d5_cadencia", label: "Ativar cadência de follow-up (7 toques)", route: "/fluxos", impact: "Automação" },
      { key: "d5_lembretes", label: "Criar lembretes antecipados (D-1)", route: "/agenda", impact: "Automação" },
    ],
  },
  {
    day: 6, title: "Time & Performance", goal: "Engajar equipe e instalar ritmo de operação.",
    icon: Users, color: "from-pink-500 to-rose-400", pillar: "Pessoas", estMin: 60,
    tasks: [
      { key: "d6_convidar", label: "Convidar vendedores e SDRs", route: "/configuracoes", impact: "Pessoas" },
      { key: "d6_metas", label: "Definir metas individuais por vendedor", route: "/configuracoes/comercial", impact: "Pessoas" },
      { key: "d6_gamif", label: "Ativar gamificação e leaderboard", route: "/configuracoes/gamificacao", impact: "Pessoas" },
    ],
  },
  {
    day: 7, title: "Diagnóstico & Plano IA", goal: "Medir o GMI, gerar plano executivo e instalar ritmos.",
    icon: Trophy, color: "from-yellow-500 to-amber-400", pillar: "GROW Score", estMin: 45,
    tasks: [
      { key: "d7_diag", label: "Rodar Diagnóstico 360° e gerar plano IA", route: "/maturidade", impact: "GROW" },
      { key: "d7_ritmo", label: "Agendar Daily (D1) e Weekly (S1) com o time", route: "/agenda", impact: "Pessoas" },
      { key: "d7_grow", label: "Conferir GMI Score e selo GROW", route: "/maturidade", impact: "GROW" },
    ],
  },
];

const TOTAL_TASKS = PLAN.reduce((acc, d) => acc + d.tasks.length, 0);

function useOnboarding() {
  return useQuery({
    queryKey: ["grow_onboarding"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("grow_onboarding_progress" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

function useStartOrUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { completed_tasks?: string[]; current_day?: number; reset?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: company_id } = await supabase.rpc("get_my_company_id");
      if (!company_id) throw new Error("Empresa não encontrada");

      if (payload.reset) {
        const { error } = await supabase
          .from("grow_onboarding_progress" as any)
          .upsert({
            user_id: user.id, company_id,
            completed_tasks: [], current_day: 1, started_at: new Date().toISOString(),
            completed_at: null,
          } as any, { onConflict: "company_id,user_id" });
        if (error) throw error;
        return;
      }

      const done = payload.completed_tasks || [];
      const completed_at = done.length >= TOTAL_TASKS ? new Date().toISOString() : null;

      const { error } = await supabase
        .from("grow_onboarding_progress" as any)
        .upsert({
          user_id: user.id, company_id,
          completed_tasks: done,
          current_day: payload.current_day ?? 1,
          completed_at,
        } as any, { onConflict: "company_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grow_onboarding"] }),
  });
}

export function Onboarding7Days() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading } = useOnboarding();
  const mutate = useStartOrUpdate();

  const completed: string[] = useMemo(() => (data?.completed_tasks as string[]) || [], [data]);
  const [openDay, setOpenDay] = useState<number>(data?.current_day || 1);

  useEffect(() => {
    if (data?.current_day) setOpenDay(data.current_day);
  }, [data?.current_day]);

  const pct = Math.round((completed.length / TOTAL_TASKS) * 100);
  const daysDone = PLAN.filter(d => d.tasks.every(t => completed.includes(t.key))).length;

  const toggle = (key: string) => {
    const next = completed.includes(key) ? completed.filter(k => k !== key) : [...completed, key];
    mutate.mutate({ completed_tasks: next, current_day: openDay });
  };

  const advanceDay = (day: number) => {
    setOpenDay(day);
    mutate.mutate({ completed_tasks: completed, current_day: day });
  };

  const reset = () => {
    if (!confirm("Reiniciar o onboarding? Seu progresso será zerado.")) return;
    mutate.mutate({ reset: true });
    toast({ title: "Onboarding reiniciado" });
  };

  if (isLoading) return <div className="h-64 animate-pulse bg-muted/30 rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Card className="overflow-hidden border-2">
        <div className="h-2 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
                  <Rocket className="h-3 w-3 mr-1" /> Onboarding GROW
                </Badge>
                <Badge variant="outline">7 dias · {TOTAL_TASKS} tarefas</Badge>
              </div>
              <h2 className="text-2xl font-bold">Eleve seu GMI Score em 7 dias</h2>
              <p className="text-muted-foreground mt-1 max-w-2xl">
                Trilha guiada e prescritiva: cada dia ativa um pilar do GROW OS. Ao final, seu pipeline está estruturado e o copiloto comercial pronto para escalar.
              </p>
            </div>
            <div className="md:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-bold">{pct}%</span>
              </div>
              <Progress value={pct} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{daysDone}/7 dias concluídos</span>
                <span>{completed.length}/{TOTAL_TASKS} tarefas</span>
              </div>
              {data && (
                <Button size="sm" variant="ghost" className="w-full mt-1" onClick={reset}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Reiniciar trilha
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TIMELINE STEPPER */}
      <div className="grid grid-cols-7 gap-1.5">
        {PLAN.map((d) => {
          const tasksDone = d.tasks.filter(t => completed.includes(t.key)).length;
          const dayPct = (tasksDone / d.tasks.length) * 100;
          const isOpen = openDay === d.day;
          const isDone = tasksDone === d.tasks.length;
          const Icon = d.icon;
          return (
            <button
              key={d.day}
              onClick={() => advanceDay(d.day)}
              className={`relative rounded-lg border-2 p-2 transition text-left ${
                isOpen ? "border-primary shadow-md" : isDone ? "border-emerald-500/50" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-muted-foreground">D{d.day}</span>
                {isDone ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div className={`p-1.5 rounded bg-gradient-to-br ${d.color} text-white inline-flex mb-1`}>
                <Icon className="h-3 w-3" />
              </div>
              <div className="text-[11px] font-medium line-clamp-2 leading-tight">{d.title}</div>
              <Progress value={dayPct} className="h-1 mt-1.5" />
            </button>
          );
        })}
      </div>

      {/* DAY DETAIL */}
      {PLAN.filter(d => d.day === openDay).map((d) => {
        const Icon = d.icon;
        const tasksDone = d.tasks.filter(t => completed.includes(t.key)).length;
        return (
          <Card key={d.day} className="overflow-hidden border-2">
            <div className={`h-1.5 bg-gradient-to-r ${d.color}`} />
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${d.color} text-white`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">Dia {d.day} de 7</Badge>
                    <Badge variant="secondary" className="text-xs">{d.pillar}</Badge>
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" /> ~{d.estMin} min
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{d.title}</CardTitle>
                  <CardDescription className="mt-1">{d.goal}</CardDescription>
                </div>
                <Badge className={`bg-gradient-to-r ${d.color} text-white border-0`}>
                  {tasksDone}/{d.tasks.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.tasks.map((t) => {
                const done = completed.includes(t.key);
                return (
                  <div
                    key={t.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                      done ? "bg-emerald-500/5 border-emerald-500/30" : "hover:border-primary/40"
                    }`}
                  >
                    <Checkbox checked={done} onCheckedChange={() => toggle(t.key)} className="h-5 w-5" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                        {t.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Impacta: {t.impact}</div>
                    </div>
                    {t.route && (
                      <Button size="sm" variant="ghost" onClick={() => navigate(t.route!)}>
                        Abrir <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                );
              })}

              <div className="flex justify-between pt-3 border-t mt-3">
                <Button variant="outline" size="sm" disabled={d.day === 1} onClick={() => advanceDay(d.day - 1)}>
                  ← Dia anterior
                </Button>
                <Button size="sm" disabled={d.day === 7} onClick={() => advanceDay(d.day + 1)} className="gap-1">
                  Próximo dia <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {pct === 100 && (
        <Card className="border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
          <CardContent className="p-6 text-center space-y-2">
            <Trophy className="h-10 w-10 text-amber-500 mx-auto" />
            <h3 className="text-xl font-bold">Parabéns! Trilha GROW concluída 🚀</h3>
            <p className="text-sm text-muted-foreground">
              Seu pipeline está ativo e os 5 pilares estruturados. Rode o Diagnóstico 360° para conferir a evolução do seu GMI Score.
            </p>
            <Button onClick={() => navigate("/maturidade")} className="mt-2">
              Ver GMI atualizado <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
