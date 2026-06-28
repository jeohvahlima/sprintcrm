import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Layers3,
  PhoneCall,
  Rocket,
  Settings,
  Target,
  Trophy,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { useTraining, TrainingModule, TrainingLesson, TrainingTrack } from "@/hooks/useTraining";
import { TrainingModuleCard } from "@/components/treinamento/TrainingModuleCard";
import { TrainingVideoPlayer } from "@/components/treinamento/TrainingVideoPlayer";
import { TrainingLessonList } from "@/components/treinamento/TrainingLessonList";
import { TrainingAdminPanel } from "@/components/treinamento/TrainingAdminPanel";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type TrackDef = {
  value: TrainingTrack;
  label: string;
  short: string;
  description: string;
  icon: typeof Rocket;
  accent: string;
  soft: string;
};

const TRACKS: TrackDef[] = [
  {
    value: "onboarding",
    label: "Onboarding BPO",
    short: "Onboarding",
    description: "Boas-vindas, cultura GROW e fundamentos do operador BPO comercial.",
    icon: Rocket,
    accent: "#7c73ff",
    soft: "rgba(124,115,255,.14)",
  },
  {
    value: "sdr",
    label: "Trilha SDR",
    short: "SDR",
    description: "Prospeccao ativa, qualificacao, cold call, cadencia e passagem de bastao.",
    icon: PhoneCall,
    accent: "#38bdf8",
    soft: "rgba(56,189,248,.13)",
  },
  {
    value: "closer",
    label: "Trilha Closer",
    short: "Closer",
    description: "Diagnostico, demonstracao, quebra de objecoes e fechamento.",
    icon: Target,
    accent: "#22c97d",
    soft: "rgba(34,201,125,.14)",
  },
  {
    value: "gestao",
    label: "Trilha Gestao",
    short: "Gestao",
    description: "Coaching, KPIs, forecast e gestao de operacao BPO.",
    icon: UserCog,
    accent: "#f5a623",
    soft: "rgba(245,166,35,.14)",
  },
  {
    value: "plataforma",
    label: "Plataforma CRM",
    short: "Plataforma",
    description: "Como operar o GROW OS: tutoriais dos principais modulos do sistema.",
    icon: Wrench,
    accent: "#a78bfa",
    soft: "rgba(167,139,250,.14)",
  },
];

const ROLE_TRACKS: Record<string, TrainingTrack[]> = {
  super_admin: ["onboarding", "sdr", "closer", "gestao", "plataforma"],
  company_admin: ["onboarding", "sdr", "closer", "gestao", "plataforma"],
  gestor: ["onboarding", "sdr", "closer", "gestao", "plataforma"],
  vendedor: ["onboarding", "sdr", "closer", "plataforma"],
  suporte: ["onboarding", "plataforma"],
};

const roleLabel: Record<string, string> = {
  super_admin: "Admin",
  company_admin: "Gestor",
  gestor: "Gestor",
  vendedor: "Comercial",
  suporte: "Suporte",
};

function percent(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}


export default function Treinamento() {
  const {
    modules,
    loading,
    createModule,
    updateModule,
    deleteModule,
    createLesson,
    updateLesson,
    deleteLesson,
    markLessonAsCompleted,
  } = useTraining();

  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<TrainingLesson | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [role, setRole] = useState<string>("vendedor");
  const [activeTab, setActiveTab] = useState<string>("training");
  const [activeTrack, setActiveTrack] = useState<TrainingTrack>("onboarding");

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data } = await supabase.rpc("get_my_role");
      const r = (data as string) || "vendedor";
      setRole(r);
      setCanManage(["super_admin", "company_admin", "gestor"].includes(r));
      setIsSuperAdmin(r === "super_admin");
    };
    checkAdminStatus();
  }, []);

  const allowedTracks = useMemo(() => {
    const list = ROLE_TRACKS[role] || ROLE_TRACKS.vendedor;
    return TRACKS.filter((t) => list.includes(t.value));
  }, [role]);

  useEffect(() => {
    if (allowedTracks.length && !allowedTracks.find((t) => t.value === activeTrack)) {
      setActiveTrack(allowedTracks[0].value);
    }
  }, [allowedTracks, activeTrack]);

  const trackModulesMap = useMemo(() => {
    const map = new Map<TrainingTrack, TrainingModule[]>();
    for (const t of TRACKS) map.set(t.value, []);
    for (const m of modules) {
      const key = (m.track as TrainingTrack) || "plataforma";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [modules]);

  const stats = useMemo(() => {
    const totalLessons = modules.reduce((acc, module) => acc + (module.lessonsCount || 0), 0);
    const completedLessons = modules.reduce((acc, module) => acc + (module.completedCount || 0), 0);
    const startedTracks = allowedTracks.filter((track) => {
      const items = trackModulesMap.get(track.value) || [];
      return items.some((module) => (module.completedCount || 0) > 0);
    }).length;
    const completedTracks = allowedTracks.filter((track) => {
      const items = trackModulesMap.get(track.value) || [];
      const total = items.reduce((acc, module) => acc + (module.lessonsCount || 0), 0);
      const done = items.reduce((acc, module) => acc + (module.completedCount || 0), 0);
      return total > 0 && done === total;
    }).length;

    return {
      totalLessons,
      completedLessons,
      overallProgress: percent(completedLessons, totalLessons),
      startedTracks,
      completedTracks,
    };
  }, [allowedTracks, modules, trackModulesMap]);

  const currentTrack = TRACKS.find((t) => t.value === activeTrack) || TRACKS[0];
  const trackModules = trackModulesMap.get(activeTrack) || [];
  const trackTotalLessons = trackModules.reduce((acc, module) => acc + (module.lessonsCount || 0), 0);
  const trackCompletedLessons = trackModules.reduce((acc, module) => acc + (module.completedCount || 0), 0);
  const trackProgress = percent(trackCompletedLessons, trackTotalLessons);
  const onboardingModules = trackModulesMap.get("onboarding") || [];
  const onboardingTotal = onboardingModules.reduce((acc, module) => acc + (module.lessonsCount || 0), 0);
  const onboardingDone = onboardingModules.reduce((acc, module) => acc + (module.completedCount || 0), 0);
  const hasMandatoryPending = onboardingTotal > 0 && onboardingDone < onboardingTotal;

  const handleModuleClick = (module: TrainingModule) => {
    setSelectedModule(module);
    setSelectedLesson(module.lessons?.[0] || null);
  };

  const handleBackToModules = () => {
    setSelectedModule(null);
    setSelectedLesson(null);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0c0d0f] p-6 text-white">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-white/10" />
          ))}
        </div>
        <Skeleton className="mt-6 h-16 rounded-xl bg-white/10" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedModule) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0c0d0f] p-4 text-[#f0f0f2] md:p-6">
        <button
          onClick={handleBackToModules}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#9a9ba5] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos modulos
        </button>

        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#131417]">
            <TrainingVideoPlayer
              videoId={selectedLesson?.youtube_video_id || null}
              videoUrl={selectedLesson?.video_url || null}
              videoType={selectedLesson?.video_type || "youtube"}
              title={selectedLesson?.title}
            />
            <div className="border-t border-white/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c5d68]">
                    {selectedModule.title}
                  </p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
                    {selectedLesson?.title || selectedModule.title}
                  </h1>
                </div>
                {selectedLesson?.duration_minutes && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs text-[#9a9ba5]">
                    <Clock3 className="h-3.5 w-3.5" />
                    {selectedLesson.duration_minutes} min
                  </span>
                )}
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9a9ba5]">
                {selectedLesson?.description || selectedModule.description || "Selecione uma aula na lista para continuar seu treinamento."}
              </p>
              {selectedLesson && !selectedLesson.completed && (
                <Button
                  className="mt-4 bg-[#6c63ff] text-white hover:bg-[#7c73ff]"
                  onClick={() => markLessonAsCompleted(selectedLesson.id)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Marcar como concluida
                </Button>
              )}
            </div>
          </section>

          <aside className="rounded-xl border border-white/10 bg-[#131417]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold text-white">Aulas do modulo</div>
              <div className="mt-1 text-xs text-[#5c5d68]">
                {selectedModule.completedCount || 0} de {selectedModule.lessonsCount || 0} concluidas
              </div>
            </div>
            <div className="p-4">
              <TrainingLessonList
                lessons={selectedModule.lessons || []}
                selectedLessonId={selectedLesson?.id}
                onSelectLesson={setSelectedLesson}
                onMarkComplete={markLessonAsCompleted}
                variant="dark"
              />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0c0d0f] text-[#f0f0f2]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#131417]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6c63ff]/20 text-[#8b84ff]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Capacitacao Comercial</h1>
              <p className="text-sm text-[#5c5d68]">Trilhas profissionais por papel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="border border-white/10 bg-white/[.04]">
                  <TabsTrigger value="training" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Treinamentos
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    <Settings className="mr-2 h-4 w-4" />
                    Gerenciar
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Button
              variant="outline"
              className="hidden border-white/10 bg-white/[.04] text-[#d7d7dc] hover:bg-white/10 hover:text-white sm:inline-flex"
              onClick={() => toast.success("Notificacoes de treinamento ativadas")}
            >
              <Bell className="mr-2 h-4 w-4" />
              Notificacoes
            </Button>
            <Button className="bg-[#6c63ff] text-white hover:bg-[#7c73ff]">
              <Trophy className="mr-2 h-4 w-4" />
              Meu certificado
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8">
        {canManage && activeTab === "admin" ? (
          <div className="rounded-xl border border-white/10 bg-white p-4 text-foreground">
            <TrainingAdminPanel
              modules={modules}
              canCreateGlobal={isSuperAdmin}
              onCreateModule={createModule}
              onUpdateModule={updateModule}
              onDeleteModule={deleteModule}
              onCreateLesson={createLesson}
              onUpdateLesson={updateLesson}
              onDeleteLesson={deleteLesson}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-[1500px] space-y-6">
            {hasMandatoryPending && (
              <section className="flex flex-wrap items-center gap-4 rounded-xl border border-[#f5a623]/30 bg-[#f5a623]/10 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5a623]/15 text-[#f5a623]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="flex-1 text-sm text-[#d7d7dc]">
                  <strong className="text-[#f5a623]">Treinamento obrigatorio pendente:</strong> conclua a trilha de Onboarding BPO para manter o time alinhado ao processo comercial.
                </p>
                <Button
                  className="bg-[#f5a623] text-black hover:bg-[#ffb84a]"
                  onClick={() => setActiveTrack("onboarding")}
                >
                  Ver trilha
                </Button>
              </section>
            )}

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Progresso geral"
                value={`${stats.overallProgress}%`}
                sub={`${stats.startedTracks} de ${allowedTracks.length} trilhas iniciadas`}
                color="#7c73ff"
                progress={stats.overallProgress}
                icon={<BarChart3 className="h-4 w-4" />}
              />
              <MetricCard
                label="Aulas concluidas"
                value={String(stats.completedLessons)}
                sub={`de ${stats.totalLessons} disponiveis`}
                color="#22c97d"
                progress={percent(stats.completedLessons, stats.totalLessons)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <MetricCard
                label="Modulos ativos"
                value={String(modules.length)}
                sub="conteudos publicados"
                color="#f5a623"
                progress={modules.length ? 100 : 0}
                icon={<Layers3 className="h-4 w-4" />}
              />
              <MetricCard
                label="Certificados"
                value={String(stats.completedTracks)}
                sub="trilhas 100% concluidas"
                color="#38bdf8"
                progress={percent(stats.completedTracks, allowedTracks.length)}
                icon={<Award className="h-4 w-4" />}
              />
            </section>

            <section className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#131417] p-1.5">
              {allowedTracks.map((track) => {
                const Icon = track.icon;
                const count = trackModulesMap.get(track.value)?.length || 0;
                const active = activeTrack === track.value;
                return (
                  <button
                    key={track.value}
                    onClick={() => setActiveTrack(track.value)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      active ? "bg-[#1a1c21] text-white shadow-[0_0_0_1px_rgba(255,255,255,.13)]" : "text-[#9a9ba5] hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" style={{ color: active ? track.accent : undefined }} />
                    {track.short}
                    <span className="rounded-full bg-white/[.07] px-2 py-0.5 text-[11px] text-[#9a9ba5]">{count}</span>
                  </button>
                );
              })}
            </section>

            <section className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-[#131417] p-5">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: currentTrack.soft, color: currentTrack.accent }}
              >
                <currentTrack.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-white">{currentTrack.label}</h2>
                <p className="mt-1 text-sm text-[#9a9ba5]">{currentTrack.description}</p>
              </div>
              <div className="min-w-[170px] text-left md:text-right">
                <div className="text-xs text-[#5c5d68]">Progresso da trilha</div>
                <div className="mt-1 text-2xl font-semibold" style={{ color: currentTrack.accent }}>
                  {trackProgress}%
                </div>
              </div>
            </section>

            {trackModules.length === 0 ? (
              <section className="rounded-xl border border-white/10 bg-[#131417] px-6 py-16 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-[#5c5d68]" />
                <h3 className="mt-4 text-lg font-semibold text-white">Nenhum modulo nesta trilha ainda</h3>
                <p className="mt-2 text-sm text-[#9a9ba5]">
                  {canManage ? "Use o painel Gerenciar para publicar conteudos desta trilha." : "Os treinamentos desta trilha serao publicados em breve."}
                </p>
              </section>
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {trackModules.map((module) => (
                  <TrainingModuleCard
                    key={module.id}
                    module={module}
                    onClick={() => handleModuleClick(module)}
                    variant="dark"
                    accentColor={currentTrack.accent}
                    accentSoft={currentTrack.soft}
                  />
                ))}
              </section>
            )}

            {canManage && (
              <section className="rounded-xl border border-white/10 bg-[#131417]">
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                  <Users className="h-5 w-5 text-[#f5a623]" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Painel do gestor</h3>
                    <p className="text-xs text-[#5c5d68]">Resumo rapido para acompanhar a operacao de treinamento.</p>
                  </div>
                </div>
                <div className="grid gap-3 p-5 md:grid-cols-3">
                  <ManagerTile label="Perfil atual" value={roleLabel[role] || role} />
                  <ManagerTile label="Trilhas liberadas" value={String(allowedTracks.length)} />
                  <ManagerTile label="Conteudos da empresa" value={String(modules.filter((m) => m.scope === "company").length)} />
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color,
  progress,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  progress: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#131417] p-4 transition hover:border-white/20">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#5c5d68]">{label}</div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[.04]" style={{ color }}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-2 text-xs text-[#5c5d68]">{sub}</div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.07]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%`, background: color }} />
      </div>
    </div>
  );
}

function ManagerTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] p-4">
      <div className="text-xs text-[#5c5d68]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
