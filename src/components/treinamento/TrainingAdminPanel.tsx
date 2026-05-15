import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, 
  Book, GripVertical, Youtube, Globe, Building2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TrainingModule, TrainingLesson, TrainingScope, VideoType } from "@/hooks/useTraining";
import { CreateModuleDialog } from "./CreateModuleDialog";
import { CreateLessonDialog } from "./CreateLessonDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface TrainingAdminPanelProps {
  modules: TrainingModule[];
  canCreateGlobal?: boolean;
  onCreateModule: (data: { title: string; description?: string; icon?: string; scope?: TrainingScope }) => Promise<void>;
  onUpdateModule: (id: string, data: { title?: string; description?: string; icon?: string }) => Promise<void>;
  onDeleteModule: (id: string) => Promise<void>;
  onCreateLesson: (moduleId: string, data: { title: string; description?: string; youtube_url?: string; video_url?: string; video_type?: VideoType; duration_minutes?: number }) => Promise<void>;
  onUpdateLesson: (id: string, data: { title?: string; description?: string; youtube_url?: string; duration_minutes?: number }) => Promise<void>;
  onDeleteLesson: (id: string) => Promise<void>;
}

export function TrainingAdminPanel({
  modules,
  canCreateGlobal = false,
  onCreateModule,
  onUpdateModule,
  onDeleteModule,
  onCreateLesson,
  onUpdateLesson,
  onDeleteLesson
}: TrainingAdminPanelProps) {
  const [createModuleOpen, setCreateModuleOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [createLessonModuleId, setCreateLessonModuleId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ moduleId: string; lesson: TrainingLesson } | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleEditModule = (module: TrainingModule) => {
    setEditingModule(module);
    setCreateModuleOpen(true);
  };

  const handleModuleSubmit = async (data: { title: string; description?: string; icon?: string }) => {
    if (editingModule) {
      await onUpdateModule(editingModule.id, data);
      setEditingModule(null);
    } else {
      await onCreateModule(data);
    }
  };

  const handleLessonSubmit = async (data: { title: string; description?: string; youtube_url?: string; video_url?: string; video_type?: VideoType; duration_minutes?: number }) => {
    if (editingLesson) {
      await onUpdateLesson(editingLesson.lesson.id, data);
      setEditingLesson(null);
    } else if (createLessonModuleId) {
      await onCreateLesson(createLessonModuleId, data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Gerenciar Treinamentos</h2>
        <Button onClick={() => { setEditingModule(null); setCreateModuleOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Módulo
        </Button>
      </div>

      {modules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Book className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum módulo de treinamento criado ainda.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setCreateModuleOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro módulo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <Card key={module.id}>
              <Collapsible
                open={expandedModules.has(module.id)}
                onOpenChange={() => toggleModule(module.id)}
              >
                <CardHeader className="py-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                      {expandedModules.has(module.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <CardTitle className="text-base flex-1">
                        {module.title}
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({module.lessons?.length || 0} aulas)
                        </span>
                      </CardTitle>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditModule(module)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteModuleId(module.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-2 pl-6 border-l-2 border-muted ml-4">
                      {module.lessons?.map((lesson, index) => (
                        <div 
                          key={lesson.id}
                          className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                          <Youtube className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <span className="text-sm flex-1 truncate">
                            <span className="text-muted-foreground">Aula {index + 1}:</span>{" "}
                            {lesson.title}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingLesson({ moduleId: module.id, lesson })}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteLessonId(lesson.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground hover:text-foreground"
                        onClick={() => setCreateLessonModuleId(module.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Aula
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Module Dialog */}
      <CreateModuleDialog
        open={createModuleOpen}
        onOpenChange={(open) => {
          setCreateModuleOpen(open);
          if (!open) setEditingModule(null);
        }}
        onSubmit={handleModuleSubmit}
        editingModule={editingModule}
      />

      {/* Create Lesson Dialog */}
      <CreateLessonDialog
        open={createLessonModuleId !== null}
        onOpenChange={(open) => {
          if (!open) setCreateLessonModuleId(null);
        }}
        onSubmit={handleLessonSubmit}
      />

      {/* Edit Lesson Dialog */}
      <CreateLessonDialog
        open={editingLesson !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLesson(null);
        }}
        onSubmit={handleLessonSubmit}
        editingLesson={editingLesson?.lesson}
      />

      {/* Delete Module Confirmation */}
      <AlertDialog open={deleteModuleId !== null} onOpenChange={(open) => !open && setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Módulo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este módulo? Todas as aulas serão excluídas também.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteModuleId) {
                  onDeleteModule(deleteModuleId);
                  setDeleteModuleId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Lesson Confirmation */}
      <AlertDialog open={deleteLessonId !== null} onOpenChange={(open) => !open && setDeleteLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Aula</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteLessonId) {
                  onDeleteLesson(deleteLessonId);
                  setDeleteLessonId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
