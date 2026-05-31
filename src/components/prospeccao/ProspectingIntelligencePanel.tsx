import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Calculator, Target, Sparkles, DollarSign, Lock } from "lucide-react";
import { ICPDualBuilder } from "./ICPDualBuilder";
import { SalesMachineWizard } from "./SalesMachineWizard";
import { LeadScorePanel } from "./LeadScorePanel";
import { CommissionCalculator } from "@/components/processos/CommissionCalculator";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";

export function ProspectingIntelligencePanel() {
  const { isAdmin, userRoles } = usePermissions();
  const isManagerLike = isAdmin || userRoles.some((r) => r.role === "gestor");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground gap-1">
          <Sparkles className="h-3 w-3" /> Sales Intelligence
        </Badge>
        <span className="text-sm text-muted-foreground">Camada de inteligência embutida na Prospecção</span>
      </div>

      <Tabs defaultValue="icp" className="space-y-3">
        <TabsList className="grid grid-cols-3 w-full md:max-w-3xl">
          <TabsTrigger value="icp" className="gap-1"><Target className="h-3.5 w-3.5" /> ICP</TabsTrigger>
          <TabsTrigger value="machine" className="gap-1"><Calculator className="h-3.5 w-3.5" /> Máquina</TabsTrigger>
          <TabsTrigger value="ote" className="gap-1">
            <DollarSign className="h-3.5 w-3.5" /> OTE
            {!isManagerLike && <Lock className="h-3 w-3 ml-0.5" />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="icp"><ICPDualBuilder /></TabsContent>
        <TabsContent value="machine"><SalesMachineWizard /></TabsContent>
        <TabsContent value="ote">
          {isManagerLike ? (
            <CommissionCalculator />
          ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
                <h3 className="font-semibold">Acesso restrito</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  A configuração de OTE & Comissões está disponível apenas para administradores e gestores comerciais.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
