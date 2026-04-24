import { useEffect, useState } from "react";
import { useGamificationConfig } from "@/hooks/useGamificationConfig";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Trash2, Plus } from "lucide-react";

export default function ConfiguracoesGamificacao() {
  const { companyId } = usePlayerProfile();
  const { data: cfg, update } = useGamificationConfig(companyId);
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  useEffect(() => { if (cfg) setForm(cfg); }, [cfg]);

  const { data: quests = [] } = useQuery({
    queryKey: ["company-quests-admin", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("prospecting_quests")
        .select("*")
        .eq("company_id", companyId!)
        .order("type");
      return data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["quest-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prospecting_quests")
        .select("*")
        .eq("is_template", true)
        .order("type");
      return data || [];
    },
  });

  const { data: shop = [] } = useQuery({
    queryKey: ["shop-admin", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("prospecting_rewards_shop")
        .select("*")
        .eq("company_id", companyId!)
        .order("cost_coins");
      return data || [];
    },
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-redemptions", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("prospecting_reward_redemptions")
        .select("*, reward:prospecting_rewards_shop(name)")
        .eq("company_id", companyId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const cloneTemplate = async (t: any) => {
    if (!companyId) return;
    const { error } = await supabase.from("prospecting_quests").insert({
      company_id: companyId,
      name: t.name, description: t.description, type: t.type,
      goal_metric: t.goal_metric, goal_value: t.goal_value,
      xp_reward: t.xp_reward, coin_reward: t.coin_reward,
      icon: t.icon, active: true, is_template: false,
    });
    if (error) return toast.error(error.message);
    toast.success("Missão adicionada à empresa");
    qc.invalidateQueries({ queryKey: ["company-quests-admin"] });
  };

  const deleteQuest = async (id: string) => {
    if (!confirm("Remover esta missão?")) return;
    await supabase.from("prospecting_quests").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["company-quests-admin"] });
  };

  const toggleQuest = async (id: string, active: boolean) => {
    await supabase.from("prospecting_quests").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["company-quests-admin"] });
  };

  const addReward = async () => {
    const name = prompt("Nome da recompensa:");
    if (!name) return;
    const cost = Number(prompt("Custo em moedas:") || "0");
    if (!cost) return;
    await supabase.from("prospecting_rewards_shop").insert({
      company_id: companyId!, name, cost_coins: cost, requires_approval: true, active: true,
    });
    toast.success("Recompensa criada");
    qc.invalidateQueries({ queryKey: ["shop-admin"] });
  };

  const handleRedemption = async (id: string, status: "approved" | "rejected") => {
    await supabase.from("prospecting_reward_redemptions").update({ status, approved_by: (await supabase.auth.getUser()).data.user?.id }).eq("id", id);
    toast.success(status === "approved" ? "Aprovado" : "Rejeitado");
    qc.invalidateQueries({ queryKey: ["pending-redemptions"] });
  };

  if (!form) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Gamepad2 className="w-7 h-7 rpg-neon-cyan" />
        <div>
          <h1 className="text-2xl font-bold">Gamificação · Sales Quest</h1>
          <p className="text-sm text-muted-foreground">Configure XP, missões e loja de recompensas do módulo Prospecção</p>
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral & XP</TabsTrigger>
          <TabsTrigger value="missoes">Missões</TabsTrigger>
          <TabsTrigger value="loja">Loja de Prêmios</TabsTrigger>
          <TabsTrigger value="resgates">Resgates ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Ativar gamificação na empresa</Label>
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativar loja de recompensas reais</Label>
                <Switch checked={form.shop_enabled} onCheckedChange={(v) => setForm({ ...form, shop_enabled: v })} />
              </div>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Pesos de XP por evento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["xp_per_response", "XP por Resposta"],
                ["xp_per_opportunity", "XP por Oportunidade"],
                ["xp_per_meeting", "XP por Reunião agendada"],
                ["xp_per_sale", "XP por Venda fechada"],
                ["xp_per_value_unit", "XP por R$ vendido (multiplicador)"],
                ["coins_per_sale", "Moedas por Venda"],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number" step="0.01"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => update.mutate(form)} disabled={update.isPending}>
              Salvar configuração
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="missoes" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>Missões da empresa ({quests.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {quests.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma missão customizada. Use os templates abaixo, ou as missões padrão já estão ativas.</p>}
              {quests.map((q: any) => (
                <div key={q.id} className="flex items-center gap-3 p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{q.name} <span className="text-xs text-muted-foreground">[{q.type}]</span></div>
                    <div className="text-xs text-muted-foreground">Meta: {q.goal_value} {q.goal_metric} · +{q.xp_reward} XP · +{q.coin_reward} 💎</div>
                  </div>
                  <Switch checked={q.active} onCheckedChange={(v) => toggleQuest(q.id, v)} />
                  <Button size="icon" variant="ghost" onClick={() => deleteQuest(q.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Templates disponíveis ({templates.length})</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {templates.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 p-3 border rounded">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground">[{t.type}] +{t.xp_reward} XP</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => cloneTemplate(t)}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loja" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recompensas da loja</CardTitle>
              <Button size="sm" onClick={addReward}><Plus className="w-4 h-4 mr-1" />Nova</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!form.shop_enabled && <p className="text-sm text-amber-500">⚠️ A loja está desativada. Ative em "Geral" para que os vendedores vejam.</p>}
              {shop.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma recompensa criada.</p> :
                shop.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 border rounded">
                    <div className="flex-1">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.cost_coins} moedas · {r.active ? "ativa" : "inativa"}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("prospecting_rewards_shop").delete().eq("id", r.id); qc.invalidateQueries({ queryKey: ["shop-admin"] }); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resgates" className="mt-4">
          <Card><CardHeader><CardTitle>Resgates pendentes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum resgate pendente.</p> :
                pending.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 border rounded">
                    <div className="flex-1">
                      <div className="font-medium">{p.reward?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.cost_paid} moedas · {new Date(p.created_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <Button size="sm" onClick={() => handleRedemption(p.id, "approved")}>Aprovar</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRedemption(p.id, "rejected")}>Rejeitar</Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
