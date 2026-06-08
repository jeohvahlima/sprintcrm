import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Rocket, 
  Wrench, 
  Zap, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  PartyPopper
} from "lucide-react";
import { useSystemUpdates, SystemUpdate } from "@/hooks/useSystemUpdates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const getTypeIcon = (type: string, size: 'sm' | 'lg' = 'sm') => {
  const sizeClass = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';
  switch (type) {
    case 'feature':
      return <Rocket className={`${sizeClass} text-green-500`} />;
    case 'improvement':
      return <Zap className={`${sizeClass} text-blue-500`} />;
    case 'fix':
      return <Wrench className={`${sizeClass} text-orange-500`} />;
    default:
      return <Sparkles className={`${sizeClass} text-primary`} />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'feature':
      return 'Nova Funcionalidade';
    case 'improvement':
      return 'Melhoria';
    case 'fix':
      return 'Correção';
    default:
      return 'Atualização';
  }
};

const getTypeBgColor = (type: string) => {
  switch (type) {
    case 'feature':
      return 'bg-green-500/10 border-green-500/30';
    case 'improvement':
      return 'bg-blue-500/10 border-blue-500/30';
    case 'fix':
      return 'bg-orange-500/10 border-orange-500/30';
    default:
      return 'bg-primary/10 border-primary/30';
  }
};

interface SystemUpdatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SystemUpdatesModal({ open, onOpenChange }: SystemUpdatesModalProps) {
  const { unreadUpdates, markAsRead, markAllAsRead } = useSystemUpdates();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open]);

  if (unreadUpdates.length === 0) {
    return null;
  }

  const currentUpdate = unreadUpdates[currentIndex];
  const hasMultiple = unreadUpdates.length > 1;
  const isLast = currentIndex === unreadUpdates.length - 1;

  const handleNext = () => {
    if (currentUpdate) {
      markAsRead(currentUpdate.id);
    }
    if (isLast) {
      onOpenChange(false);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleMarkAllAndClose = async () => {
    await markAllAsRead();
    onOpenChange(false);
  };

  if (!currentUpdate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${getTypeBgColor(currentUpdate.tipo)}`}>
              {getTypeIcon(currentUpdate.tipo, 'lg')}
            </div>
            <div>
              <Badge variant="outline" className="font-mono text-xs mb-1">
                v{currentUpdate.version}
              </Badge>
              <DialogTitle className="text-xl">
                {currentUpdate.title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{getTypeLabel(currentUpdate.tipo)}</Badge>
            {currentUpdate.module && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                📦 {currentUpdate.module}
              </Badge>
            )}
            <span className="text-xs">
              {format(new Date(currentUpdate.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[45vh] pr-4">
          <div className="space-y-4">
            {/* Descrição */}
            {currentUpdate.description && (
              <p className="text-muted-foreground">
                {currentUpdate.description}
              </p>
            )}

            {/* Lista de mudanças */}
            {currentUpdate.changes && currentUpdate.changes.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  O que mudou
                </h4>
                <div className="space-y-2">
                  {currentUpdate.changes.map((change: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-3 p-3 rounded-lg border ${getTypeBgColor(change.type)}`}
                    >
                      {getTypeIcon(change.type)}
                      <div className="flex-1">
                        <span className="text-sm">{change.text}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {getTypeLabel(change.type)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          {hasMultiple && (
            <div className="flex items-center gap-2 mr-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} de {unreadUpdates.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={isLast}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            {hasMultiple && (
              <Button variant="outline" onClick={handleMarkAllAndClose}>
                Marcar todas como lidas
              </Button>
            )}
            <Button onClick={handleNext}>
              {isLast ? (
                <>
                  <PartyPopper className="mr-2 h-4 w-4" />
                  Entendi!
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Próxima
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
