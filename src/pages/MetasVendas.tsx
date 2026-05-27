import { ProspectingIntelligencePanel } from "@/components/prospeccao/ProspectingIntelligencePanel";
import { GoalProgressHUD } from "@/components/prospeccao/comercial/GoalProgressHUD";
import { TopoFoco } from "@/components/prospeccao/foco/TopoFoco";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MetasVendas() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Metas & Vendas
          </h1>
          <p className="text-sm text-muted-foreground">
            Estratégia: meta, ticket, conversão e projeção automática da operação comercial
          </p>
        </div>
        <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground gap-1">
          <Sparkles className="h-3 w-3" /> Estratégia
        </Badge>
      </div>

      <TopoFoco onRecuperar={() => navigate("/rotina")} />
      <GoalProgressHUD period="daily" />
      <ProspectingIntelligencePanel />
    </div>
  );
}
