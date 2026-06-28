import { CheckCircle2, Circle, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrainingLesson } from "@/hooks/useTraining";
import { cn } from "@/lib/utils";

interface TrainingLessonListProps {
  lessons: TrainingLesson[];
  selectedLessonId?: string;
  onSelectLesson: (lesson: TrainingLesson) => void;
  onMarkComplete?: (lessonId: string) => void;
  variant?: "default" | "dark";
}

export function TrainingLessonList({
  lessons,
  selectedLessonId,
  onSelectLesson,
  onMarkComplete,
  variant = "default",
}: TrainingLessonListProps) {
  if (lessons.length === 0) {
    return (
      <div className={cn("py-8 text-center", variant === "dark" ? "text-[#5c5d68]" : "text-muted-foreground")}>
        <p>Nenhuma aula disponivel neste modulo</p>
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <ScrollArea className="h-[470px] pr-3">
        <div className="space-y-2">
          {lessons.map((lesson, index) => {
            const active = selectedLessonId === lesson.id;
            return (
              <button
                type="button"
                key={lesson.id}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-white/[.04]",
                  active ? "border-[#6c63ff]/50 bg-[#6c63ff]/10" : "border-white/10 bg-white/[.02]"
                )}
                onClick={() => onSelectLesson(lesson)}
              >
                <span className="mt-0.5 shrink-0">
                  {lesson.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-[#22c97d]" />
                  ) : active ? (
                    <Play className="h-5 w-5 text-[#8b84ff]" />
                  ) : (
                    <Circle className="h-5 w-5 text-[#5c5d68]" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-xs text-[#5c5d68]">
                    Aula {index + 1}
                    {lesson.duration_minutes && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lesson.duration_minutes} min
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-sm font-medium text-white">{lesson.title}</span>
                  {lesson.description && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[#9a9ba5]">{lesson.description}</span>}
                </span>

                {!lesson.completed && onMarkComplete && active && (
                  <span
                    className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs font-semibold text-[#d7d7dc]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkComplete(lesson.id);
                    }}
                  >
                    Concluir
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-2">
        {lessons.map((lesson, index) => (
          <div
            key={lesson.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all hover:bg-accent/50",
              selectedLessonId === lesson.id && "border-primary bg-accent"
            )}
            onClick={() => onSelectLesson(lesson)}
          >
            <div className="mt-0.5 flex-shrink-0">
              {lesson.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : selectedLessonId === lesson.id ? (
                <Play className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Aula {index + 1}</span>
                {lesson.duration_minutes && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {lesson.duration_minutes} min
                  </span>
                )}
              </div>
              <h4 className="line-clamp-1 text-sm font-medium">{lesson.title}</h4>
              {lesson.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{lesson.description}</p>}
            </div>

            {!lesson.completed && onMarkComplete && selectedLessonId === lesson.id && (
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkComplete(lesson.id);
                }}
              >
                Concluir
              </Button>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
