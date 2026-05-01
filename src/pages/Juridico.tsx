import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Scale } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import JuridicoAnalytics from "@/components/analytics/JuridicoAnalytics";
import CalculadoraProcessos from "@/components/juridico/CalculadoraProcessos";
import GestaoPrazos from "@/components/juridico/GestaoPrazos";

export default function Juridico() {
  const { isJuridico, isMasterAccount, loading } = useCompanySegmento();
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc("get_my_company_id");
        if (data) setUserCompanyId(data as string);
      } finally {
        setLoadingCompany(false);
      }
    })();
  }, []);

  if (loading || loadingCompany) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isJuridico && !isMasterAccount) {
    return <Navigate to="/analytics" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Scale className="h-8 w-8 text-primary" />
            </div>
            Jurídico
          </h1>
          <p className="text-muted-foreground mt-1">
            Painel completo para escritórios de advocacia: processos, prazos, audiências, honorários e análises
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="prazos">Prazos</TabsTrigger>
          <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <JuridicoAnalytics userCompanyId={userCompanyId} />
        </TabsContent>

        <TabsContent value="prazos">
          <GestaoPrazos companyId={userCompanyId} />
        </TabsContent>

        <TabsContent value="calculadora">
          <CalculadoraProcessos companyId={userCompanyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
