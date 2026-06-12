import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, GraduationCap, Settings, Rocket, PhoneCall, Target, UserCog, Wrench } from "lucide-react";
import { useTraining, TrainingModule, TrainingLesson, TrainingTrack } from "@/hooks/useTraining";
import { TrainingModuleCard } from "@/components/treinamento/TrainingModuleCard";
import { TrainingVideoPlayer } from "@/components/treinamento/TrainingVideoPlayer";
import { TrainingLessonList } from "@/components/treinamento/TrainingLessonList";
import { TrainingAdminPanel } from "@/components/treinamento/TrainingAdminPanel";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type TrackDef = {
  value: TrainingTrack;
  label: string;
  short: string;
  description: string;
  icon: typeof Rocket;
};

const TRACKS: TrackDef[] = [
  { value: 'onboarding', label: 'Onboarding BPO', short: 'Onboarding', description: 'Boas-vindas, cultura GROW e fundamentos do operador BPO comercial.', icon: Rocket },
  { value: 'sdr', label: 'Trilha SDR', short: 'SDR', description: 'Prospecção ativa, qualificação, cold call, cadência e passagem de bastão.', icon: PhoneCall },
  { value: 'closer', label: 'Trilha Closer', short: 'Closer', description: 'Diagnóstico, demonstração, quebra de objeções e fechamento.', icon: Target },
  { value: 'gestao', label: 'Trilha Gestão', short: 'Gestão', description: 'Coaching, KPIs, forecast e gestão de operação BPO.', icon: UserCog },
  { value: 'plataforma', label: 'Plataforma (CRM)', short: 'Plataforma', description: 'Como operar o GROW OS — tutoriais de cada módulo do sistema.', icon: Wrench },
];

const ROLE_TRACKS: Record<string, TrainingTrack[]> = {
  super_admin: ['onboarding', 'sdr', 'closer', 'gestao', 'plataforma'],
  company_admin: ['onboarding', 'sdr', 'closer', 'gestao', 'plataforma'],
  gestor: ['onboarding', 'sdr', 'closer', 'gestao', 'plataforma'],
  vendedor: ['onboarding', 'sdr', 'closer', 'plataforma'],
  suporte: ['onboarding', 'plataforma'],
};

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
    markLessonAsCompleted
  } = useTraining();

  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<TrainingLesson | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [role, setRole] = useState<string>('vendedor');
  const [activeTab, setActiveTab] = useState<string>("training");
  const [activeTrack, setActiveTrack] = useState<TrainingTrack>('onboarding');

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data } = await supabase.rpc('get_my_role');
      const r = (data as string) || 'vendedor';
      setRole(r);
      setCanManage(['super_admin', 'company_admin', 'gestor'].includes(r));
      setIsSuperAdmin(r === 'super_admin');
    };
    checkAdminStatus();
  }, []);

  const allowedTracks = useMemo(() => {
    const list = ROLE_TRACKS[role] || ROLE_TRACKS.vendedor;
    return TRACKS.filter(t => list.includes(t.value));
  }, [role]);

  useEffect(() => {
    if (allowedTracks.length && !allowedTracks.find(t => t.value === activeTrack)) {
      setActiveTrack(allowedTracks[0].value);
    }
  }, [allowedTracks, activeTrack]);

  const handleModuleClick = (module: TrainingModule) => {
    setSelectedModule(module);
    if (module.lessons && module.lessons.length > 0) {
      setSelectedLesson(module.lessons[0]);
    } else {
      setSelectedLesson(null);
    }
  };

  const handleBackToModules = () => {
    setSelectedModule(null);
    setSelectedLesson(null);
  };

  const trackModulesMap = useMemo(() => {
    const map = new Map<TrainingTrack, TrainingModule[]>();
    for (const t of TRACKS) map.set(t.value, []);
    for (const m of modules) {
      const key = (m.track as TrainingTrack) || 'plataforma';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [modules]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const currentTrack = TRACKS.find(t => t.value === activeTrack) || TRACKS[0];
  const trackModules = trackModulesMap.get(activeTrack) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {selectedModule && (
            <Button variant="ghost" size="icon" onClick={handleBackToModules}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="p-2.5 rounded-xl bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {selectedModule ? selectedModule.title : "Capacitação Comercial — Estrutura BPO"}
            </h1>
            <p className="text-muted-foreground">
              {selectedModule 
                ? selectedModule.description || `${selectedModule.lessonsCount} aulas disponíveis`
                : "Trilhas profissionais por papel: Onboarding, SDR, Closer, Gestão e uso da plataforma."
              }
            </p>
          </div>
        </div>

        {canManage && !selectedModule && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="training">
                <GraduationCap className="h-4 w-4 mr-2" />
                Treinamentos
              </TabsTrigger>
              <TabsTrigger value="admin">
                <Settings className="h-4 w-4 mr-2" />
                Gerenciar
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Content */}
      {selectedModule ? (
        // Module Detail View
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TrainingVideoPlayer 
              videoId={selectedLesson?.youtube_video_id || null}
              videoUrl={selectedLesson?.video_url || null}
              videoType={selectedLesson?.video_type || 'youtube'}
              title={selectedLesson?.title}
            />
            
            {selectedLesson?.description && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sobre esta aula</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {selectedLesson.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aulas do Módulo</CardTitle>
              </CardHeader>
              <CardContent>
                <TrainingLessonList
                  lessons={selectedModule.lessons || []}
                  selectedLessonId={selectedLesson?.id}
                  onSelectLesson={setSelectedLesson}
                  onMarkComplete={markLessonAsCompleted}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : canManage && activeTab === "admin" ? (
        // Admin Panel
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
      ) : (
        // Tracks view
        <Tabs value={activeTrack} onValueChange={(v) => setActiveTrack(v as TrainingTrack)} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto justify-start">
            {allowedTracks.map((t) => {
              const Icon = t.icon;
              const count = trackModulesMap.get(t.value)?.length || 0;
              return (
                <TabsTrigger key={t.value} value={t.value} className="gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{t.short}</span>
                  <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 ml-1">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {allowedTracks.map((t) => (
            <TabsContent key={t.value} value={t.value} className="space-y-4 mt-4">
              <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                <CardContent className="py-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <t.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t.label}</h3>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </div>
                </CardContent>
              </Card>

              {(trackModulesMap.get(t.value) || []).length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <t.icon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum módulo nesta trilha ainda</h3>
                    <p className="text-muted-foreground">
                      {canManage
                        ? "Use o painel Gerenciar para criar módulos desta trilha."
                        : "Os treinamentos desta trilha serão publicados em breve."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(trackModulesMap.get(t.value) || []).map((module) => (
                    <TrainingModuleCard
                      key={module.id}
                      module={module}
                      onClick={() => handleModuleClick(module)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
