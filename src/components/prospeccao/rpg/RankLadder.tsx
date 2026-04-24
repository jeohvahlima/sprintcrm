import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const RANKS = [
  { name: "Bronze", min: 1, max: 9, className: "rpg-rank-bronze", desc: "Iniciado · Aprendendo a caçada" },
  { name: "Prata", min: 10, max: 24, className: "rpg-rank-silver", desc: "Operador · Domina o fluxo básico" },
  { name: "Ouro", min: 25, max: 49, className: "rpg-rank-gold", desc: "Hunter · Caça com precisão" },
  { name: "Platina", min: 50, max: 74, className: "rpg-rank-platinum", desc: "Veterano · Mestre da conversão" },
  { name: "Diamante", min: 75, max: 99, className: "rpg-rank-diamond", desc: "Lenda · Topo do servidor" },
  { name: "Mítico", min: 100, max: 999, className: "rpg-rank-mythic", desc: "Lobo Alfa · Ascensão final" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentLevel: number;
}

export function RankLadder({ open, onOpenChange, currentLevel }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rpg-card max-w-2xl">
        <DialogHeader>
          <DialogTitle className="rpg-text-mono rpg-neon-cyan uppercase tracking-widest">⚔️ Hierarquia de Ranks</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {RANKS.map((r) => {
            const active = currentLevel >= r.min && currentLevel <= r.max;
            return (
              <div
                key={r.name}
                className={`p-3 rounded border-2 flex items-center gap-4 ${r.className} ${active ? "rpg-pulse bg-background/60" : "bg-background/20 opacity-60"}`}
              >
                <div className={`w-12 h-12 rounded border-2 ${r.className} flex items-center justify-center rpg-text-mono text-lg font-bold`}>
                  {r.min}+
                </div>
                <div className="flex-1">
                  <div className={`rpg-text-mono uppercase tracking-wider font-bold ${r.className}`}>{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
                {active && <span className="rpg-text-mono text-xs rpg-neon-cyan">[ VOCÊ ESTÁ AQUI ]</span>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
