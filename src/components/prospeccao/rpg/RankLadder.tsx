import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const RANKS = [
  { name: "Trainee Comercial", min: 1, max: 9, className: "rpg-rank-bronze", desc: "Em treinamento e aprendendo o processo de vendas" },
  { name: "Vendedor Júnior", min: 10, max: 24, className: "rpg-rank-silver", desc: "Domina o fluxo de prospecção e atinge metas básicas" },
  { name: "Vendedor Pleno", min: 25, max: 49, className: "rpg-rank-gold", desc: "Bate meta com consistência e gera previsibilidade" },
  { name: "Vendedor Sênior", min: 50, max: 74, className: "rpg-rank-platinum", desc: "Especialista em fechamento e negociação" },
  { name: "Account Executive", min: 75, max: 99, className: "rpg-rank-diamond", desc: "Referência da equipe e mentor de novos vendedores" },
  { name: "Top Performer", min: 100, max: 999, className: "rpg-rank-mythic", desc: "Vendedor de elite — performance acima da média do mercado" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentLevel: number;
}

export function RankLadder({ open, onOpenChange, currentLevel }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Plano de Carreira Comercial</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {RANKS.map((r) => {
            const active = currentLevel >= r.min && currentLevel <= r.max;
            return (
              <div
                key={r.name}
                className={`p-3 rounded-lg border-2 flex items-center gap-4 ${r.className} ${active ? "bg-primary/5" : "bg-background/20 opacity-70"}`}
              >
                <div className={`w-12 h-12 rounded-md border-2 ${r.className} flex items-center justify-center text-sm font-bold`}>
                  Nv {r.min}+
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${r.className}`}>{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
                {active && <span className="text-xs text-primary font-medium">Sua posição atual</span>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
