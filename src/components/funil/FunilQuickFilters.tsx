import { Search, Flame, Hourglass, Coins, LayoutGrid, List, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickFilter = "todos" | "quentes" | "atrasados" | "altovalor" | "ganhos" | "perdidos";
export type DisplayMode = "kanban" | "lista";

interface Funil {
  id: string;
  nome: string;
}

interface Props {
  funis: Funil[];
  selectedFunil: string;
  onSelectFunil: (id: string) => void;

  search: string;
  onSearchChange: (v: string) => void;

  quickFilter: QuickFilter;
  onQuickFilterChange: (f: QuickFilter) => void;

  counts: { ganhos: number; perdidos: number };

  displayMode: DisplayMode;
  onDisplayModeChange: (m: DisplayMode) => void;

  onScrollLeft?: () => void;
  onScrollRight?: () => void;
  showScrollControls?: boolean;
}

interface PillDef {
  id: QuickFilter;
  label: string;
  icon?: any;
  iconColor?: string;
  activeBg?: string;
  badge?: number;
  badgeDotColor?: string;
}

export function FunilQuickFilters({
  funis,
  selectedFunil,
  onSelectFunil,
  search,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  counts,
  displayMode,
  onDisplayModeChange,
  onScrollLeft,
  onScrollRight,
  showScrollControls,
}: Props) {
  const pills: PillDef[] = [
    { id: "todos", label: "Todos" },
    { id: "quentes", label: "Quentes", icon: Flame, iconColor: "text-orange-500" },
    { id: "atrasados", label: "Atrasados", icon: Hourglass, iconColor: "text-amber-500" },
    { id: "altovalor", label: "Alto valor", icon: Coins, iconColor: "text-emerald-600", activeBg: "bg-emerald-500 text-white border-emerald-500" },
    { id: "ganhos", label: "Ganhos este mês", badge: counts.ganhos, badgeDotColor: "bg-emerald-500" },
    { id: "perdidos", label: "Perdidos", badge: counts.perdidos, badgeDotColor: "bg-rose-500" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-2 rounded-2xl bg-card border border-border shadow-sm">
      {/* FUNIL selector */}
      <div className="flex items-center gap-2 pr-2 border-r border-border">
        <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground pl-1">FUNIL</span>
        <div className="relative">
          <BarChart3 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-600 pointer-events-none" />
          <select
            value={selectedFunil}
            onChange={(e) => onSelectFunil(e.target.value)}
            className="pl-8 pr-7 h-9 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted/50 transition cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {funis.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar lead, empresa..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 h-9 text-xs rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {pills.map((p) => {
          const active = quickFilter === p.id;
          const Icon = p.icon;
          const baseActive = p.activeBg || "bg-foreground text-background border-foreground";
          return (
            <button
              key={p.id}
              onClick={() => onQuickFilterChange(p.id)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition",
                active
                  ? baseActive
                  : "bg-background text-foreground border-border hover:bg-muted"
              )}
            >
              {p.badgeDotColor !== undefined && (
                <span className={cn("inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white", p.badgeDotColor)}>
                  {p.badge}
                </span>
              )}
              {Icon && <Icon className={cn("h-3.5 w-3.5", !active && p.iconColor)} />}
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Display mode */}
      <div className="ml-auto inline-flex rounded-full border border-border bg-background overflow-hidden">
        <button
          onClick={() => onDisplayModeChange("kanban")}
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold transition",
            displayMode === "kanban" ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Kanban
        </button>
        <button
          onClick={() => onDisplayModeChange("lista")}
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold border-l border-border transition",
            displayMode === "lista" ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <List className="h-3.5 w-3.5" />
          Lista
        </button>
      </div>

      {/* Scroll arrows */}
      {showScrollControls && (
        <div className="inline-flex gap-1">
          <button
            onClick={onScrollLeft}
            className="h-8 w-8 grid place-items-center rounded-full border border-border bg-background hover:bg-muted transition"
            title="Rolar para esquerda"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onScrollRight}
            className="h-8 w-8 grid place-items-center rounded-full border border-border bg-background hover:bg-muted transition"
            title="Rolar para direita"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
