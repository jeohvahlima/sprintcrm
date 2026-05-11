import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Layers, Megaphone, Target, FileText } from "lucide-react";
import { ProductLadderBuilder } from "./ProductLadderBuilder";
import { MarketingFunnelTracks } from "./MarketingFunnelTracks";
import { ICPWizard } from "./ICPWizard";
import { ICPManualText } from "../ICPManualText";

export function EstrategiaComercialPanel() {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">Estratégia Comercial</h2>
                <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-0 text-xs">GROW Sales Intelligence</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Estruture a base da sua máquina de vendas: <strong>Esteira de Produtos</strong>, <strong>ICP</strong> e <strong>Trilhas de Funis de Marketing</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="esteira">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="esteira" className="gap-2"><Layers className="h-4 w-4" /> Esteira de Produtos</TabsTrigger>
          <TabsTrigger value="icp" className="gap-2"><Target className="h-4 w-4" /> ICP Estruturado</TabsTrigger>
          <TabsTrigger value="trilhas" className="gap-2"><Megaphone className="h-4 w-4" /> Trilhas de Funis</TabsTrigger>
        </TabsList>
        <TabsContent value="esteira" className="mt-4">
          <ProductLadderBuilder />
        </TabsContent>
        <TabsContent value="icp" className="mt-4 space-y-4">
          <Tabs defaultValue="manual-text">
            <TabsList>
              <TabsTrigger value="manual-text" className="gap-1"><FileText className="h-3.5 w-3.5" /> Manual ICP (texto)</TabsTrigger>
              <TabsTrigger value="wizard" className="gap-1"><Target className="h-3.5 w-3.5" /> Wizard 3 etapas</TabsTrigger>
            </TabsList>
            <TabsContent value="manual-text" className="mt-4">
              <ICPManualText />
            </TabsContent>
            <TabsContent value="wizard" className="mt-4">
              <ICPWizard />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="trilhas" className="mt-4">
          <MarketingFunnelTracks />
        </TabsContent>
      </Tabs>
    </div>
  );
}
