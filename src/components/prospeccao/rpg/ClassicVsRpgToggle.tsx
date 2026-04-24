import { Switch } from "@/components/ui/switch";
import { Gamepad2, BarChart3 } from "lucide-react";

interface Props {
  rpgMode: boolean;
  onChange: (v: boolean) => void;
}

export function ClassicVsRpgToggle({ rpgMode, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background/60">
      <BarChart3 className={`w-4 h-4 ${!rpgMode ? "rpg-neon-cyan" : "text-muted-foreground"}`} />
      <Switch checked={rpgMode} onCheckedChange={onChange} />
      <Gamepad2 className={`w-4 h-4 ${rpgMode ? "rpg-neon-magenta" : "text-muted-foreground"}`} />
      <span className="rpg-text-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden md:inline">
        {rpgMode ? "MODO RPG" : "CLÁSSICO"}
      </span>
    </div>
  );
}
