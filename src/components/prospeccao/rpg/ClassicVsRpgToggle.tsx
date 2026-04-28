import { Switch } from "@/components/ui/switch";
import { Trophy, BarChart3 } from "lucide-react";

interface Props {
  rpgMode: boolean;
  onChange: (v: boolean) => void;
}

export function ClassicVsRpgToggle({ rpgMode, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background/60">
      <BarChart3 className={`w-4 h-4 ${!rpgMode ? "text-primary" : "text-muted-foreground"}`} />
      <Switch checked={rpgMode} onCheckedChange={onChange} />
      <Trophy className={`w-4 h-4 ${rpgMode ? "text-amber-500" : "text-muted-foreground"}`} />
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden md:inline">
        {rpgMode ? "Modo Competitivo" : "Modo Clássico"}
      </span>
    </div>
  );
}
