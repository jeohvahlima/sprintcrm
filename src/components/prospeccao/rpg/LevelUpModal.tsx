import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  newLevel: number;
}

// Componente mantido para compatibilidade — substituído por toast em Prospeccao.tsx.
// Não renderiza nada por padrão; pode ser reativado se necessário.
export function LevelUpModal({ open, onOpenChange, newLevel }: Props) {
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <div className="py-6">
          <div className="text-3xl font-bold text-primary mb-2">Nível {newLevel}</div>
          <div className="text-sm text-muted-foreground">Você subiu de nível!</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
