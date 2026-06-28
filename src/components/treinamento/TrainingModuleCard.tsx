import { Progress } from "@/components/ui/progress";
import {
  Book,
  Users,
  MessageSquare,
  LayoutDashboard,
  Settings,
  Calendar,
  Bot,
  Video,
  PhoneCall,
  Target,
  DollarSign,
  GraduationCap,
  FileText,
  Zap,
  HelpCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { TrainingModule } from "@/hooks/useTraining";

const iconMap: Record<string, React.ElementType> = {
  book: Book,
  users: Users,
  "message-square": MessageSquare,
  "layout-dashboard": LayoutDashboard,
  settings: Settings,
  calendar: Calendar,
  bot: Bot,
  video: Video,
  "phone-call": PhoneCall,
  target: Target,
  "dollar-sign": DollarSign,
  "graduation-cap": GraduationCap,
  "file-text": FileText,
  zap: Zap,
  "help-circle": HelpCircle,
};

interface TrainingModuleCardProps {
  module: TrainingModule;
  onClick: () => void;
  variant?: "default" | "dark";
  accentColor?: string;
  accentSoft?: string;
}

export function TrainingModuleCard({
  module,
  onClick,
  variant = "default",
  accentColor = "#6c63ff",
  accentSoft = "rgba(108,99,255,.14)",
}: TrainingModuleCardProps) {
  const IconComponent = iconMap[module.icon] || Book;
  const progress = module.lessonsCount
    ? Math.round(((module.completedCount || 0) / module.lessonsCount) * 100)
    : 0;
  const completed = module.lessonsCount ? progress === 100 : false;

  if (variant === "dark") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group relative overflow-hidden rounded-xl border bg-[#131417] p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20 ${
          completed ? "border-[#22c97d]/30" : "border-white/10"
        }`}
      >
        <div
          className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition group-hover:opacity-100"
          style={{ background: completed ? "#22c97d" : accentColor }}
        />
        {completed && <div className="absolute inset-x-0 top-0 h-0.5 bg-[#22c97d]" />}

        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: completed ? "rgba(34,201,125,.14)" : accentSoft, color: completed ? "#22c97d" : accentColor }}
          >
            <IconComponent className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">{module.title}</h3>
              {module.scope === "company" && (
                <span className="ml-auto shrink-0 rounded-full border border-[#6c63ff]/25 bg-[#6c63ff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#8b84ff]">
                  Sua empresa
                </span>
              )}
            </div>
            {module.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#9a9ba5]">{module.description}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-xs text-[#5c5d68]">
          <span className="inline-flex items-center gap-1">
            <Book className="h-3.5 w-3.5" />
            {module.lessonsCount || 0} {(module.lessonsCount || 0) === 1 ? "aula" : "aulas"}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[.07]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: completed ? "#22c97d" : accentColor }}
          />
        </div>

        {completed ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#22c97d]/15 px-2.5 py-1 text-xs font-semibold text-[#22c97d]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Concluido
          </div>
        ) : module.lessonsCount === 0 ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/[.05] px-2.5 py-1 text-xs font-semibold text-[#5c5d68]">
            <Lock className="h-3.5 w-3.5" />
            Sem aulas
          </div>
        ) : null}
      </button>
    );
  }

  return (
    <div className="cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg" onClick={onClick}>
      <div className="p-6 pb-2">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary transition-colors">
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="line-clamp-1 text-lg font-semibold">{module.title}</h3>
              {module.scope === "company" && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Sua Empresa
                </span>
              )}
            </div>
            {module.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{module.description}</p>}
          </div>
        </div>
      </div>
      <div className="p-6 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {module.lessonsCount} {module.lessonsCount === 1 ? "aula" : "aulas"}
            </span>
            <span className="font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {module.completedCount !== undefined && module.completedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {module.completedCount} de {module.lessonsCount} concluidas
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
