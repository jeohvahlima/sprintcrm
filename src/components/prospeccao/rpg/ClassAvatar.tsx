import { Briefcase, Target, Sprout, Headphones } from "lucide-react";

export type PlayerClass = "hunter" | "closer" | "farmer" | "ranger";

const CLASS_META: Record<PlayerClass, { icon: any; label: string; cls: string }> = {
  hunter: { icon: Headphones, label: "SDR", cls: "rpg-class-hunter" },
  closer: { icon: Target, label: "Closer", cls: "rpg-class-closer" },
  farmer: { icon: Sprout, label: "Farmer", cls: "rpg-class-farmer" },
  ranger: { icon: Briefcase, label: "Account", cls: "rpg-class-ranger" },
};

interface Props {
  name: string;
  playerClass?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  level?: number;
  online?: boolean;
}

const SIZE: Record<NonNullable<Props["size"]>, { box: string; icon: number; text: string; lvl: string }> = {
  xs: { box: "w-7 h-7", icon: 12, text: "text-[9px]", lvl: "text-[8px] -bottom-1.5" },
  sm: { box: "w-9 h-9", icon: 14, text: "text-[10px]", lvl: "text-[9px] -bottom-2" },
  md: { box: "w-12 h-12", icon: 18, text: "text-xs", lvl: "text-[10px] -bottom-2" },
  lg: { box: "w-16 h-16", icon: 24, text: "text-sm", lvl: "text-xs -bottom-2.5" },
  xl: { box: "w-24 h-24", icon: 36, text: "text-base", lvl: "text-sm -bottom-3" },
};

export function ClassAvatar({ name, playerClass, size = "md", level, online }: Props) {
  const cls = (playerClass as PlayerClass) || "hunter";
  const meta = CLASS_META[cls] || CLASS_META.hunter;
  const s = SIZE[size];
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative inline-block">
      <div className={`rpg-avatar-frame ${meta.cls} ${s.box} ${online ? "online" : ""} flex items-center justify-center overflow-hidden`}>
        <span className={`relative font-semibold ${s.text} text-foreground`}>{initials}</span>
      </div>
      {typeof level === "number" && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 ${s.lvl} px-1.5 py-0.5 font-medium rounded border bg-background text-muted-foreground border-border`}
        >
          Nv {level}
        </div>
      )}
    </div>
  );
}

export const PLAYER_CLASS_META = CLASS_META;
