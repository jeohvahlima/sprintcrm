import { Achievement, useAchievements } from "@/hooks/useAchievements";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}

const RARITY_STYLE: Record<string, string> = {
  common: "border-slate-500 text-slate-300",
  rare: "border-cyan-400 text-cyan-300 rpg-glow-cyan",
  epic: "border-fuchsia-400 text-fuchsia-300 rpg-glow-magenta",
  legendary: "border-amber-400 text-amber-300 rpg-glow-gold",
};

export function AchievementsGallery({ open, onOpenChange, userId }: Props) {
  const { data: items = [] } = useAchievements(userId);
  const unlocked = items.filter((i) => i.unlocked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rpg-card max-w-3xl">
        <DialogHeader>
          <DialogTitle className="rpg-text-mono rpg-neon-cyan uppercase tracking-widest">
            🏆 Conquistas · {unlocked}/{items.length}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
          {items.map((a: Achievement) => (
            <div
              key={a.code}
              className={`p-3 rounded border-2 bg-background/40 transition-all ${a.unlocked ? RARITY_STYLE[a.rarity] : "border-muted opacity-40 rpg-locked"}`}
            >
              <div className="text-3xl text-center mb-2">{a.icon}</div>
              <div className="text-center rpg-text-mono text-xs font-bold uppercase tracking-wider">
                {a.name}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1">{a.description}</p>
              <div className="text-center mt-2">
                <span className={`rpg-text-mono text-[9px] uppercase tracking-wider ${RARITY_STYLE[a.rarity].split(" ")[1] || ""}`}>
                  {a.rarity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
