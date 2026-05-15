import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Book, Users, MessageSquare, LayoutDashboard, Settings, 
  Calendar, Bot, Video, PhoneCall, Target, DollarSign,
  GraduationCap, FileText, Zap, HelpCircle
} from "lucide-react";
import { TrainingModule } from "@/hooks/useTraining";

const iconMap: Record<string, React.ElementType> = {
  book: Book,
  users: Users,
  'message-square': MessageSquare,
  'layout-dashboard': LayoutDashboard,
  settings: Settings,
  calendar: Calendar,
  bot: Bot,
  video: Video,
  'phone-call': PhoneCall,
  target: Target,
  'dollar-sign': DollarSign,
  'graduation-cap': GraduationCap,
  'file-text': FileText,
  zap: Zap,
  'help-circle': HelpCircle,
};

interface TrainingModuleCardProps {
  module: TrainingModule;
  onClick: () => void;
}

export function TrainingModuleCard({ module, onClick }: TrainingModuleCardProps) {
  const IconComponent = iconMap[module.icon] || Book;
  const progress = module.lessonsCount 
    ? Math.round((module.completedCount || 0) / module.lessonsCount * 100) 
    : 0;

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg line-clamp-1">{module.title}</CardTitle>
              {module.scope === 'company' && (
                <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Sua Empresa
                </span>
              )}
            </div>
            {module.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {module.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {module.lessonsCount} {module.lessonsCount === 1 ? 'aula' : 'aulas'}
            </span>
            <span className="font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {module.completedCount !== undefined && module.completedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {module.completedCount} de {module.lessonsCount} concluídas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
