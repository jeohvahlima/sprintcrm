import { RotinaInteligente as RotinaInteligenteComponent } from "@/components/prospeccao/RotinaInteligente";
import { CockpitDoDia } from "@/components/prospeccao/cockpit/CockpitDoDia";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles } from "lucide-react";

export default function RotinaInteligentePage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Rotina Inteligente
          </h1>
          <p className="text-sm text-muted-foreground">
            Execução diária guiada — missões, distribuição por canal e alertas em tempo real
          </p>
        </div>
        <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground gap-1">
          <Sparkles className="h-3 w-3" /> Execução
        </Badge>
      </div>

      <CockpitDoDia />
      <RotinaInteligenteComponent />
    </div>
  );
}
