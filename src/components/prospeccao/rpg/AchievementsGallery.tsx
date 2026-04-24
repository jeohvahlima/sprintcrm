import { Achievement, useAchievements } from "@/hooks/useAchievements";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}

const RARITY_STYLE: Record<string, string> = {
  common: "border-slate-400 text-slate-600 dark:text-slate-300",
  rare: "border-blue-400 text-blue-600 dark:text-blue-400",
  epic: "border-purple-400 text-purple-600 dark:text-purple-400",
  legendary: "border-amber-400 text-amber-600 dark:text-amber-400",
};

const RARITY_LABEL: Record<string, string> = {
  common: "Comum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
};

export function AchievementsGallery({ open, onOpenChange, userId }: Props) {
  const { data: items = [] } = useAchievements(userId);
  const unlocked = items.filter((i) => i.unlocked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            🏆 Conquistas — {unlocked}/{items.length}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
          {items.map((a: Achievement) => (
            <div
              key={a.code}
              className={`p-3 rounded-lg border-2 bg-card transition-all ${a.unlocked ? RARITY_STYLE[a.rarity] : "border-muted opacity-40 rpg-locked"}`}
            >
              <div className="text-3xl text-center mb-2">{a.icon}</div>
              <div className="text-center text-xs font-semibold">
                {a.name}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1">{a.description}</p>
              <div className="text-center mt-2">
                <span className={`text-[9px] font-medium uppercase tracking-wide ${RARITY_STYLE[a.rarity].split(" ").slice(1).join(" ")}`}>
                  {RARITY_LABEL[a.rarity] || a.rarity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
