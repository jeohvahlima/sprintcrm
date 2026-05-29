import { RotinaInteligente as RotinaInteligenteComponent } from "@/components/prospeccao/RotinaInteligente";
import { RotinaClinica } from "@/components/prospeccao/RotinaClinica";
import { CockpitDoDia } from "@/components/prospeccao/cockpit/CockpitDoDia";
import { PainelRotinaDia } from "@/components/prospeccao/PainelRotinaDia";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Stethoscope } from "lucide-react";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";

export default function RotinaInteligentePage() {
  const { isClinica } = useCompanySegmento();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {isClinica ? <Stethoscope className="h-6 w-6 text-primary" /> : <Brain className="h-6 w-6 text-primary" />}
            Rotina Inteligente {isClinica && "— Clínica"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isClinica
              ? "Confirmações, resgates de no-show, reativações e novos pacientes do dia"
              : "Execução diária guiada — missões, distribuição por canal e alertas em tempo real"}
          </p>
        </div>
        <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground gap-1">
          <Sparkles className="h-3 w-3" /> Execução
        </Badge>
      </div>

      <PainelRotinaDia />
      <CockpitDoDia />
      {isClinica ? <RotinaClinica /> : <RotinaInteligenteComponent />}
    </div>
  );
}
