import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Brain, AlertTriangle, Heart, XCircle, Users, Target, TrendingUp, CheckCircle2, Loader2, Wand2, ShoppingCart, Radio, ListChecks, Package } from "lucide-react";
import { useGenerateICPIntelligence, useSaveICPProfile, type ICPIntelligence } from "@/hooks/useProspectingIntelligence";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sample = ["Clínicas médicas de pequeno e médio porte", "Escritórios de advocacia tributária", "SaaS B2B early-stage", "Imobiliárias de alto padrão"];

interface Props {
  onApplied?: () => void;
}

export function ICPIntelligenceBuilder({ onApplied }: Props) {
  const [niche, setNiche] = useState("");
  const [data, setData] = useState<{ niche: string; intelligence: ICPIntelligence } | null>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const generate = useGenerateICPIntelligence();
  const save = useSaveICPProfile();
  const { segmento, companyId } = useCompanySegmento();

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("produtos_servicos" as any)
        .select("nome, preco, descricao")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .limit(15);
      setProdutos((data as any[]) || []);
    })();
  }, [companyId]);

  // Carrega ICP IA salvo (último gerado) para não perder ao atualizar página
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data: rows } = await supabase
        .from("icp_profiles" as any)
        .select("niche, intelligence, source, is_default, generated_at, created_at")
        .eq("company_id", companyId)
        .eq("source", "ai")
        .order("is_default", { ascending: false })
        .order("generated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (rows as any[])?.[0];
      if (row?.intelligence && row?.niche) {
        setData({ niche: row.niche, intelligence: row.intelligence });
        setNiche(row.niche);
      }
    })();
  }, [companyId]);

  const handleGenerate = async () => {
    if (!niche.trim()) { toast.error("Informe um nicho/segmento"); return; }
    try {
      const result = await generate.mutateAsync({ niche: niche.trim(), segmento: segmento || undefined, produtos });
      setData(result);
      // Salva automaticamente o ICP gerado (sem aplicar ao Lead Score) para persistir entre reloads
      try {
        await save.mutateAsync({
          name: `ICP IA — ${result.niche}`,
          is_default: false,
          criteria: result.intelligence?.lead_score_criteria || [],
          hot_threshold: 75,
          warm_threshold: 50,
          source: "ai",
          niche: result.niche,
          intelligence: result.intelligence,
          fit_score: result.intelligence?.scoring?.fit_score,
          generated_at: new Date().toISOString(),
        } as any);
      } catch (err) {
        console.error("Falha ao salvar ICP gerado", err);
      }
      toast.success("ICP Inteligente gerado e salvo");
    } catch (e: any) {
      toast.error("Falha ao gerar ICP", { description: e.message });
    }
  };

  const handleApply = async () => {
    if (!data) return;
    const intel = data.intelligence;
    const criteria = intel.lead_score_criteria || [];
    const sumW = criteria.reduce((s, c) => s + (c.weight || 0), 0);
    // Normaliza pesos para 100
    const normalized = sumW > 0 ? criteria.map(c => ({ ...c, weight: Math.round((c.weight / sumW) * 100) })) : criteria;
    try {
      await save.mutateAsync({
        name: `ICP IA — ${data.niche}`,
        is_default: true,
        criteria: normalized,
        hot_threshold: 75,
        warm_threshold: 50,
        source: "ai",
        niche: data.niche,
        intelligence: intel,
        fit_score: intel.scoring?.fit_score,
        generated_at: new Date().toISOString(),
      } as any);
      toast.success("ICP aplicado ao Lead Score");
      onApplied?.();
    } catch (e: any) {
      toast.error("Erro ao aplicar", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" /> ICP Intelligence Builder
            <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">IA</Badge>
          </CardTitle>
          <CardDescription>
            Informe o nicho e a IA gera perfil ideal, dores, desejos, objeções, decisores, score e estratégia — tudo aplicável ao Lead Score com 1 clique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex.: Clínicas médicas de pequeno e médio porte"
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              className="flex-1"
            />
            <Button onClick={handleGenerate} disabled={generate.isPending} className="gap-1">
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {data ? "Regerar ICP" : "Gerar ICP Inteligente"}
            </Button>
            {data && (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!confirm("Limpar o ICP atual e definir um novo manualmente?")) return;
                  try {
                    if (companyId) {
                      await supabase
                        .from("icp_profiles" as any)
                        .delete()
                        .eq("company_id", companyId)
                        .eq("source", "ai");
                    }
                  } catch (e) { console.error(e); }
                  setData(null);
                  setNiche("");
                  toast.success("ICP limpo. Defina o novo nicho e gere novamente.");
                }}
                className="gap-1"
              >
                <XCircle className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-muted-foreground">Sugestões:</span>
            {sample.map((s) => (
              <button key={s} onClick={() => setNiche(s)}
                className="text-[11px] px-2 py-0.5 rounded-full border bg-background hover:bg-muted transition-colors">
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground pt-1 border-t">
            <span>Contexto enviado à IA:</span>
            {segmento && <Badge variant="outline" className="text-[10px]">Segmento: {segmento}</Badge>}
            <Badge variant="outline" className="text-[10px]">{produtos.length} produto(s)/serviço(s)</Badge>
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-4">
          {/* Cabeçalho com Score */}
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Nicho analisado</p>
                <p className="text-sm font-semibold">{data.niche}</p>
              </div>
              <Metric label="Fit Score" value={`${data.intelligence.scoring?.fit_score ?? "-"}/100`} accent="text-emerald-600" />
              <Metric label="Potencial" value={data.intelligence.scoring?.potencial_fechamento || "-"} accent="text-primary" />
              <Metric label="CAC" value={data.intelligence.scoring?.cac_estimado || "-"} />
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Block icon={Target} title="1. Perfil ideal do ICP" tone="primary">
              <Kv k="Segmento" v={data.intelligence.profile?.segmento} />
              <Kv k="Subnichos" v={(data.intelligence.profile?.subnichos || []).join(", ")} />
              <Kv k="Faturamento/mês" v={data.intelligence.profile?.faturamento_mensal} />
              <Kv k="Funcionários" v={data.intelligence.profile?.funcionarios} />
              <Kv k="Estrutura comercial" v={data.intelligence.profile?.estrutura_comercial} />
              <Kv k="Ticket médio" v={data.intelligence.profile?.ticket_medio_estimado} />
              <Kv k="LTV" v={data.intelligence.profile?.ltv_estimado} />
              <Kv k="Maturidade" v={data.intelligence.profile?.maturidade_comercial} />
            </Block>

            <Block icon={AlertTriangle} title="2. Mapa de dores" tone="rose">
              <Group title="Explícitas" items={data.intelligence.pains?.explicitas} />
              <Group title="Latentes" items={data.intelligence.pains?.latentes} />
              <Group title="Gargalos" items={data.intelligence.pains?.gargalos} />
            </Block>

            <Block icon={Heart} title="3. Desejos e objetivos" tone="emerald">
              <ul className="text-xs space-y-1 list-disc list-inside">
                {(data.intelligence.desires || []).map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </Block>

            <Block icon={XCircle} title="4. Crenças e tentativas frustradas" tone="amber">
              <Group title="Já tentaram" items={data.intelligence.beliefs?.tentativas_frustradas} />
              <Group title="Objeções" items={data.intelligence.beliefs?.objecoes} />
              <Group title="Por que falhou" items={data.intelligence.beliefs?.motivos_falha} />
            </Block>

            <Block icon={Users} title="5. Mapa de decisão" tone="primary">
              <Group title="Decisores" items={data.intelligence.decision_map?.decisores} />
              <Group title="Abordagens" items={data.intelligence.decision_map?.abordagens} />
              <Group title="Melhores horários" items={data.intelligence.decision_map?.melhores_horarios} />
              <Group title="Objeções comuns" items={data.intelligence.decision_map?.objecoes_comuns} />
              <Group title="Canais recomendados" items={data.intelligence.decision_map?.canais_recomendados} />
            </Block>

            <Block icon={TrendingUp} title="6. Estratégia de prospecção" tone="emerald">
              <Kv k="Cadência" v={data.intelligence.prospecting_strategy?.cadencia} />
              <Kv k="Canais" v={(data.intelligence.prospecting_strategy?.canais || []).join(", ")} />
              <div>
                <p className="text-[11px] uppercase font-medium text-muted-foreground mt-1">Script inicial</p>
                <p className="text-xs whitespace-pre-line p-2 rounded bg-muted/50 mt-1 border">
                  {data.intelligence.prospecting_strategy?.script_inicial}
                </p>
              </div>
              <Group title="Sequência SDR" items={data.intelligence.prospecting_strategy?.sequencia_sdr} />
            </Block>
          </div>

          {data.intelligence.buying_behavior && (
            <Block icon={ShoppingCart} title="7. Comportamento de compra" tone="primary">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Group title="Gatilhos de compra" items={data.intelligence.buying_behavior.gatilhos_compra} />
                  <Group title="Sinais de intenção" items={data.intelligence.buying_behavior.sinais_de_intencao} />
                  <Group title="Jornada de decisão" items={data.intelligence.buying_behavior.jornada_decisao} />
                </div>
                <div className="space-y-2">
                  <Kv k="Padrão de consumo" v={data.intelligence.buying_behavior.padrao_consumo} />
                  <Kv k="Ciclo médio" v={data.intelligence.buying_behavior.ciclo_medio_dias} />
                  <Kv k="Momento ideal de abordagem" v={data.intelligence.buying_behavior.momento_ideal_abordagem} />
                </div>
              </div>
            </Block>
          )}

          {data.intelligence.channel_strategy && (
            <Block icon={Radio} title="8. Estratégia por canal de abordagem" tone="emerald">
              <div className="grid md:grid-cols-2 gap-2">
                {(["cold_call","whatsapp","linkedin","email","social_selling"] as const).map((ch) => {
                  const c = (data.intelligence.channel_strategy as any)?.[ch];
                  if (!c) return null;
                  const labels: Record<string,string> = { cold_call: "Cold Call", whatsapp: "WhatsApp", linkedin: "LinkedIn", email: "E-mail", social_selling: "Social Selling" };
                  const tone = c.eficacia === "alta" ? "text-emerald-600" : c.eficacia === "média" ? "text-amber-600" : "text-muted-foreground";
                  return (
                    <div key={ch} className="border rounded p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">{labels[ch]}</p>
                        <Badge variant="outline" className={`text-[10px] ${tone}`}>Eficácia: {c.eficacia}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground"><strong>Quando:</strong> {c.quando_usar}</p>
                      <p className="text-[11px] p-1.5 rounded bg-muted/50 border whitespace-pre-line"><strong>Abertura:</strong> {c.abertura}</p>
                    </div>
                  );
                })}
              </div>
              {data.intelligence.channel_strategy.ordem_recomendada?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] uppercase font-medium text-muted-foreground">Ordem recomendada na cadência</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.intelligence.channel_strategy.ordem_recomendada.map((c: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{i + 1}. {c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Block>
          )}

          {data.intelligence.action_plan && (
            <Block icon={ListChecks} title="9. Plano de ação prático" tone="amber">
              <div className="grid md:grid-cols-2 gap-3">
                <Group title="Primeiros 30 dias" items={data.intelligence.action_plan.primeiros_30_dias} />
                <Group title="Metas semanais" items={data.intelligence.action_plan.metas_semanais} />
                <Group title="KPIs de acompanhamento" items={data.intelligence.action_plan.kpis_acompanhamento} />
                <Group title="Riscos e mitigação" items={data.intelligence.action_plan.riscos_e_mitigacao} />
              </div>
            </Block>
          )}

          {data.intelligence.product_fit && (
            <Block icon={Package} title="10. Casamento com seus produtos/serviços" tone="primary">
              <Kv k="Oferta principal" v={data.intelligence.product_fit.oferta_principal} />
              <Kv k="Ângulo de pitch" v={data.intelligence.product_fit.angulo_pitch} />
              <Kv k="Prova social ideal" v={data.intelligence.product_fit.prova_social_ideal} />
              <Kv k="Upsell natural" v={data.intelligence.product_fit.upsell_natural} />
              <Kv k="Why now" v={data.intelligence.product_fit.why_now} />
            </Block>
          )}

          {/* Aplicar */}
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Aplicar este ICP ao Lead Score</p>
                  <p className="text-xs text-muted-foreground">
                    Substitui critérios e pesos atuais pelos sugeridos pela IA ({data.intelligence.lead_score_criteria?.length || 0} critérios).
                  </p>
                </div>
              </div>
              <Button onClick={handleApply} disabled={save.isPending} className="gap-1">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aplicar ao Lead Score
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${accent || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Block({ icon: Icon, title, tone, children }: any) {
  const tones: Record<string, string> = {
    primary: "border-primary/30",
    rose: "border-rose-500/30",
    emerald: "border-emerald-500/30",
    amber: "border-amber-500/30",
  };
  return (
    <Card className={tones[tone] || ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">{children}</CardContent>
    </Card>
  );
}

function Kv({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3 border-b border-dashed py-1 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

function Group({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[11px] uppercase font-medium text-muted-foreground">{title}</p>
      <ul className="list-disc list-inside space-y-0.5">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
