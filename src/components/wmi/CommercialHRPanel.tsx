import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Calculator, Save, GraduationCap, Heart } from "lucide-react";
import { useCommercialHR, useSaveCommercialHR, CommercialHRConfig } from "@/hooks/useEstruturacao";
import { toast } from "sonner";

export function CommercialHRPanel() {
  const { data: saved } = useCommercialHR();
  const save = useSaveCommercialHR();
  const [cfg, setCfg] = useState<CommercialHRConfig>({ funil_selecao: {}, rampup: {}, remuneracao: {}, retencao: {} });

  useEffect(() => { if (saved) setCfg(saved); }, [saved]);

  const onSave = async () => {
    try { await save.mutateAsync(cfg); toast.success("RH Comercial salvo"); }
    catch (e: any) { toast.error(e?.message || "Erro"); }
  };

  // Calculadora de remuneração
  const fixo = Number(cfg.remuneracao?.fixo || 0);
  const variavelMeta = Number(cfg.remuneracao?.variavel_meta || 0);
  const total100 = fixo + variavelMeta;

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-500/10">
              <Users className="h-5 w-5 text-pink-500" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">RH Comercial</CardTitle>
              <CardDescription>Capítulo 11 do Playbook GROW: atração, formação, remuneração e retenção.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="selecao">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="selecao" className="gap-2"><GraduationCap className="h-4 w-4" /> Funil de Seleção</TabsTrigger>
          <TabsTrigger value="rampup" className="gap-2">⚡ Ramp-up 30/60/90</TabsTrigger>
          <TabsTrigger value="remuneracao" className="gap-2"><Calculator className="h-4 w-4" /> Remuneração</TabsTrigger>
          <TabsTrigger value="retencao" className="gap-2"><Heart className="h-4 w-4" /> Retenção</TabsTrigger>
        </TabsList>

        <TabsContent value="selecao" className="mt-4">
          <Card><CardContent className="p-5 space-y-3">
            <div>
              <Label>Etapas do funil de seleção</Label>
              <Textarea rows={3} placeholder="Ex: Triagem currículo → Teste de perfil → Entrevista RH → Role-play → Decisão"
                value={cfg.funil_selecao?.etapas || ""}
                onChange={(e) => setCfg({ ...cfg, funil_selecao: { ...cfg.funil_selecao, etapas: e.target.value } })} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Taxa de aprovação alvo</Label>
                <Input placeholder="Ex: 5% dos candidatos" value={cfg.funil_selecao?.taxa_aprovacao || ""}
                  onChange={(e) => setCfg({ ...cfg, funil_selecao: { ...cfg.funil_selecao, taxa_aprovacao: e.target.value } })} />
              </div>
              <div>
                <Label>Tempo médio do processo (dias)</Label>
                <Input type="number" value={cfg.funil_selecao?.tempo_medio_dias ?? 0}
                  onChange={(e) => setCfg({ ...cfg, funil_selecao: { ...cfg.funil_selecao, tempo_medio_dias: Number(e.target.value) } })} />
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rampup" className="mt-4">
          <Card><CardContent className="p-5 space-y-3">
            <div>
              <Label>30 dias — Aprendizado</Label>
              <Textarea rows={3} placeholder="O que o vendedor deve dominar em 30 dias" value={cfg.rampup?.plano_30 || ""}
                onChange={(e) => setCfg({ ...cfg, rampup: { ...cfg.rampup, plano_30: e.target.value } })} />
            </div>
            <div>
              <Label>60 dias — Execução assistida</Label>
              <Textarea rows={3} placeholder="Metas e atividades dos 60 dias" value={cfg.rampup?.plano_60 || ""}
                onChange={(e) => setCfg({ ...cfg, rampup: { ...cfg.rampup, plano_60: e.target.value } })} />
            </div>
            <div>
              <Label>90 dias — Performance plena</Label>
              <Textarea rows={3} placeholder="Quando deve atingir 100% da meta" value={cfg.rampup?.plano_90 || ""}
                onChange={(e) => setCfg({ ...cfg, rampup: { ...cfg.rampup, plano_90: e.target.value } })} />
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="remuneracao" className="mt-4">
          <Card><CardContent className="p-5 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Salário fixo (R$)</Label>
                <Input type="number" value={cfg.remuneracao?.fixo ?? 0}
                  onChange={(e) => setCfg({ ...cfg, remuneracao: { ...cfg.remuneracao, fixo: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Variável a 100% da meta (R$)</Label>
                <Input type="number" value={cfg.remuneracao?.variavel_meta ?? 0}
                  onChange={(e) => setCfg({ ...cfg, remuneracao: { ...cfg.remuneracao, variavel_meta: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Comissão (% sobre venda)</Label>
                <Input type="number" step="0.1" value={cfg.remuneracao?.comissao_percent ?? 0}
                  onChange={(e) => setCfg({ ...cfg, remuneracao: { ...cfg.remuneracao, comissao_percent: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Aceleradores</Label>
                <Input placeholder="Ex: 110% meta = +20%" value={cfg.remuneracao?.aceleradores || ""}
                  onChange={(e) => setCfg({ ...cfg, remuneracao: { ...cfg.remuneracao, aceleradores: e.target.value } })} />
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <strong>Total a 100% da meta:</strong> R$ {total100.toLocaleString("pt-BR")}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="retencao" className="mt-4">
          <Card><CardContent className="p-5 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Turnover mensal (%)</Label>
                <Input type="number" step="0.1" value={cfg.retencao?.turnover_mensal ?? 0}
                  onChange={(e) => setCfg({ ...cfg, retencao: { ...cfg.retencao, turnover_mensal: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>NPS interno (eNPS)</Label>
                <Input type="number" value={cfg.retencao?.nps_interno ?? 0}
                  onChange={(e) => setCfg({ ...cfg, retencao: { ...cfg.retencao, nps_interno: Number(e.target.value) } })} />
              </div>
            </div>
            <div>
              <Label>Plano de carreira</Label>
              <Textarea rows={3} placeholder="Trilha de evolução: SDR → SDR2 → Closer → Coordenador..."
                value={cfg.retencao?.plano_carreira || ""}
                onChange={(e) => setCfg({ ...cfg, retencao: { ...cfg.retencao, plano_carreira: e.target.value } })} />
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Button className="w-full" onClick={onSave} disabled={save.isPending}>
        <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Salvando..." : "Salvar RH Comercial"}
      </Button>
    </div>
  );
}
