import { useEffect, useState } from "react";
import { Users, User, AlertTriangle, Globe, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type ViewMode = "meus" | "equipe" | "todos" | "sem-responsavel";

interface CompanyMember {
  id: string;
  full_name: string | null;
  email: string | null;
  count: number;
}

interface FunilFiltrosResponsaveisProps {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  responsavelFiltro: string;
  onResponsavelChange: (id: string) => void;
  isGestor: boolean;
  companyId: string | null;
  counts: Record<ViewMode, number>;
  responsavelCounts: Record<string, number>;
}

export function FunilFiltrosResponsaveis({
  viewMode,
  onViewModeChange,
  responsavelFiltro,
  onResponsavelChange,
  isGestor,
  companyId,
  counts,
  responsavelCounts,
}: FunilFiltrosResponsaveisProps) {
  const [members, setMembers] = useState<CompanyMember[]>([]);

  useEffect(() => {
    if (!isGestor || !companyId) return;
    let mounted = true;
    (async () => {
      try {
        // membros da empresa via user_roles -> profiles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("company_id", companyId);
        const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id).filter(Boolean)));
        if (ids.length === 0) {
          if (mounted) setMembers([]);
          return;
        }
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        if (!mounted) return;
        setMembers(
          (profiles || []).map((p: any) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            count: responsavelCounts[p.id] || 0,
          }))
        );
      } catch (e) {
        console.error("Erro ao carregar membros:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isGestor, companyId, responsavelCounts]);

  const selectedMember = members.find((m) => m.id === responsavelFiltro);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button
        size="sm"
        variant={viewMode === "meus" ? "default" : "outline"}
        onClick={() => onViewModeChange("meus")}
        className="gap-1.5"
      >
        <User className="h-3.5 w-3.5" />
        Meus Leads
        <span className="ml-1 text-xs opacity-75">({counts.meus})</span>
      </Button>

      {isGestor && (
        <>
          <Button
            size="sm"
            variant={viewMode === "equipe" ? "default" : "outline"}
            onClick={() => onViewModeChange("equipe")}
            className="gap-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            Equipe
            <span className="ml-1 text-xs opacity-75">({counts.equipe})</span>
          </Button>

          <Button
            size="sm"
            variant={viewMode === "todos" ? "default" : "outline"}
            onClick={() => onViewModeChange("todos")}
            className="gap-1.5"
          >
            <Globe className="h-3.5 w-3.5" />
            Todos
            <span className="ml-1 text-xs opacity-75">({counts.todos})</span>
          </Button>

          <Button
            size="sm"
            variant={viewMode === "sem-responsavel" ? "default" : "outline"}
            onClick={() => onViewModeChange("sem-responsavel")}
            className={cn(
              "gap-1.5",
              viewMode !== "sem-responsavel" &&
                counts["sem-responsavel"] > 0 &&
                "border-orange-500/40 text-orange-600 dark:text-orange-400"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Sem Responsável
            <span className="ml-1 text-xs opacity-75">({counts["sem-responsavel"]})</span>
          </Button>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[160px] truncate">
                    {responsavelFiltro === "all"
                      ? "Todos os responsáveis"
                      : selectedMember?.full_name || selectedMember?.email || "Responsável"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Filtrar por responsável</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onResponsavelChange("all")}>
                  {responsavelFiltro === "all" && <Check className="h-3.5 w-3.5 mr-2" />}
                  <span className={responsavelFiltro === "all" ? "" : "ml-5"}>
                    Todos os responsáveis
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members
                  .sort((a, b) => (b.count || 0) - (a.count || 0))
                  .map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => onResponsavelChange(m.id)}>
                      {responsavelFiltro === m.id && <Check className="h-3.5 w-3.5 mr-2" />}
                      <span className={cn("flex-1 truncate", responsavelFiltro === m.id ? "" : "ml-5")}>
                        {m.full_name || m.email || "Sem nome"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">({m.count})</span>
                    </DropdownMenuItem>
                  ))}
                {members.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    Nenhum membro encontrado
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </div>
  );
}
