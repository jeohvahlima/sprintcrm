import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, GraduationCap, Settings } from "lucide-react";
import { useTraining, TrainingModule, TrainingLesson } from "@/hooks/useTraining";
import { TrainingModuleCard } from "@/components/treinamento/TrainingModuleCard";
import { TrainingVideoPlayer } from "@/components/treinamento/TrainingVideoPlayer";
import { TrainingLessonList } from "@/components/treinamento/TrainingLessonList";
import { TrainingAdminPanel } from "@/components/treinamento/TrainingAdminPanel";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [activeTab, setActiveTab] = useState<string>("training");

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data } = await supabase.rpc('get_my_role');
      // super_admin, company_admin e gestor podem gerenciar treinamentos da própria empresa
      setCanManage(['super_admin', 'company_admin', 'gestor'].includes(data as string));
    };
    checkAdminStatus();
  }, []);

  const handleModuleClick = (module: TrainingModule) => {
    setSelectedModule(module);
    // Auto-select first lesson if available
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              {selectedModule ? selectedModule.title : "Central de Treinamento"}
            </h1>
            <p className="text-muted-foreground">
              {selectedModule 
                ? selectedModule.description || `${selectedModule.lessonsCount} aulas disponíveis`
                : "Aprenda a usar todas as funcionalidades do sistema"
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
          onCreateModule={createModule}
          onUpdateModule={updateModule}
          onDeleteModule={deleteModule}
          onCreateLesson={createLesson}
          onUpdateLesson={updateLesson}
          onDeleteLesson={deleteLesson}
        />
      ) : (
        // Modules Grid
        <>
          {modules.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum treinamento disponível</h3>
                <p className="text-muted-foreground">
                  Os treinamentos ainda não foram configurados pela administração.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {modules.map((module) => (
                <TrainingModuleCard
                  key={module.id}
                  module={module}
                  onClick={() => handleModuleClick(module)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
