import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  newLevel: number;
}

export function LevelUpModal({ open, onOpenChange, newLevel }: Props) {
  useEffect(() => {
    if (!open) return;
    const fire = () => {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#00f0ff", "#ff2bd6", "#7a3cff", "#ffd700"],
      });
    };
    fire();
    const t = setTimeout(fire, 400);
    const t2 = setTimeout(() => onOpenChange(false), 4500);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rpg-card max-w-md text-center border-2 border-cyan-400 rpg-glow-cyan">
        <div className="py-8">
          <div className="rpg-text-mono text-xs rpg-neon-magenta uppercase tracking-[0.5em] mb-2 animate-pulse">
            ▲ ASCENSÃO ▲
          </div>
          <div className="text-7xl font-black rpg-rank-mythic rpg-text-mono mb-2">
            LV {newLevel}
          </div>
          <div className="rpg-text-mono uppercase tracking-widest rpg-neon-cyan">
            LEVEL UP!
          </div>
          <p className="text-sm text-muted-foreground mt-4">Você ascendeu de patamar, operador.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
