import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Zap, Clock, MessageSquare, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Etapa {
  id: string;
  nome: string;
  cor: string;
  posicao: number;
  funil_id: string;
}

interface FollowConfig {
  id?: string;
  etapa_id: string;
  funil_id: string;
  company_id?: string;
  ativo: boolean;
  tempo_valor: number;
  tempo_unidade: "minutos" | "horas" | "dias";
  canal: "whatsapp" | "tarefa" | "notificacao" | "nenhum";
  mensagem_custom: string | null;
  criar_tarefa: boolean;
  tarefa_titulo: string | null;
  notificar_responsavel: boolean;
  avancar_proxima_etapa: boolean;
}

interface Props {
  funilId: string;
  etapas: Etapa[];
}

const defaultCfg = (etapaId: string, funilId: string, tempoValor = 1): FollowConfig => ({
  etapa_id: etapaId,
  funil_id: funilId,
  ativo: true,
  tempo_valor: tempoValor,
  tempo_unidade: "dias",
  canal: "whatsapp",
  mensagem_custom: "Oi {{primeiro_nome}}, passando para retomar nossa conversa. Faz sentido avançarmos essa semana?",
  criar_tarefa: false,
  tarefa_titulo: null,
  notificar_responsavel: false,
  avancar_proxima_etapa: false,
});

export function FollowInteligentePanel({ funilId, etapas }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeEtapa, setActiveEtapa] = useState<string>("");
  const [configs, setConfigs] = useState<Record<string, FollowConfig>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("follow_etapa_config" as any)
        .select("*")
        .eq("funil_id", funilId);
      const map: Record<string, FollowConfig> = {};
      (data as any[] | null)?.forEach((c) => { map[c.etapa_id] = c; });
      setConfigs(map);
      if (etapas.length > 0) setActiveEtapa(etapas[0].id);
      setLoading(false);
    })();
  }, [open, funilId, etapas]);

  const getCfg = (etapaId: string): FollowConfig => {
    return configs[etapaId] ?? defaultCfg(etapaId, funilId);
  };

  const updateCfg = (etapaId: string, patch: Partial<FollowConfig>) => {
    setConfigs((prev) => ({ ...prev, [etapaId]: { ...getCfg(etapaId), ...patch } }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: companyId } = await supabase.rpc("get_my_company_id" as any);
      if (!companyId) throw new Error("Empresa não encontrada");

      const rows = Object.values(configs).map((c) => ({
        ...c,
        company_id: companyId,
      }));

      for (const row of rows) {
        const { error } = await supabase
          .from("follow_etapa_config" as any)
          .upsert(row, { onConflict: "etapa_id" });
        if (error) throw error;
      }
      toast.success("Configurações salvas. Follow Inteligente ativo.");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const testEngine = async () => {
    toast.info("Disparando motor de follow-up...");
    const { data, error } = await supabase.functions.invoke("follow-inteligente-engine", { body: {} });
    if (error) toast.error("Erro: " + error.message);
    else toast.success(`Motor executado: ${data?.disparos ?? 0} disparos, ${data?.leads_checked ?? 0} leads avaliados`);
  };

  const cfg = activeEtapa ? getCfg(activeEtapa) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          <Sparkles className="h-4 w-4" />
          Follow Inteligente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Follow Inteligente — Motor de Recuperação de Leads
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Carregando configurações...</div>
        ) : etapas.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">Nenhuma etapa neste funil.</div>
        ) : (
          <>
            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              Configure por etapa: se o lead ficar X tempo sem interação, o sistema dispara automaticamente
              uma mensagem, tarefa ou notificação. Quando o lead responder, o timer reseta sozinho.
            </div>

            <Tabs value={activeEtapa} onValueChange={setActiveEtapa} className="w-full">
              <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1">
                {etapas.map((e) => {
                  const has = !!configs[e.id]?.id;
                  return (
                    <TabsTrigger key={e.id} value={e.id} className="gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.cor }} />
                      {e.nome}
                      {has && <CheckCircle2 className="h-3 w-3 text-primary" />}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {etapas.map((e) => {
                const c = getCfg(e.id);
                return (
                  <TabsContent key={e.id} value={e.id} className="space-y-4 pt-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-semibold">Ativar nesta etapa</div>
                        <div className="text-xs text-muted-foreground">Quando desligado, leads desta etapa não recebem follow automático.</div>
                      </div>
                      <Switch checked={c.ativo} onCheckedChange={(v) => updateCfg(e.id, { ativo: v })} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Disparar após</Label>
                        <Input
                          type="number"
                          min={1}
                          value={c.tempo_valor}
                          onChange={(ev) => updateCfg(e.id, { tempo_valor: Math.max(1, parseInt(ev.target.value) || 1) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Unidade</Label>
                        <Select value={c.tempo_unidade} onValueChange={(v: any) => updateCfg(e.id, { tempo_unidade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutos">minutos</SelectItem>
                            <SelectItem value="horas">horas</SelectItem>
                            <SelectItem value="dias">dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Canal principal</Label>
                      <Select value={c.canal} onValueChange={(v: any) => updateCfg(e.id, { canal: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp (enviar mensagem)</SelectItem>
                          <SelectItem value="tarefa">Tarefa (criar para responsável)</SelectItem>
                          <SelectItem value="notificacao">Notificação interna</SelectItem>
                          <SelectItem value="nenhum">Nenhum (apenas marcar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {c.canal === "whatsapp" && (
                      <div className="space-y-1">
                        <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Mensagem</Label>
                        <Textarea
                          rows={4}
                          value={c.mensagem_custom ?? ""}
                          onChange={(ev) => updateCfg(e.id, { mensagem_custom: ev.target.value })}
                          placeholder="Use {{primeiro_nome}}, {{nome}}, {{empresa}}, {{servico}}"
                        />
                        <p className="text-xs text-muted-foreground">
                          Variáveis disponíveis: <code>{"{{primeiro_nome}}"}</code>, <code>{"{{nome}}"}</code>, <code>{"{{empresa}}"}</code>, <code>{"{{servico}}"}</code>
                        </p>
                      </div>
                    )}

                    {(c.canal === "tarefa" || c.criar_tarefa) && (
                      <div className="space-y-1">
                        <Label>Título da tarefa</Label>
                        <Input
                          value={c.tarefa_titulo ?? ""}
                          onChange={(ev) => updateCfg(e.id, { tarefa_titulo: ev.target.value })}
                          placeholder="Ligar para o lead"
                        />
                      </div>
                    )}

                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`tarefa-${e.id}`}>Também criar tarefa</Label>
                        <Switch
                          id={`tarefa-${e.id}`}
                          checked={c.criar_tarefa}
                          onCheckedChange={(v) => updateCfg(e.id, { criar_tarefa: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`notif-${e.id}`}>Notificar responsável</Label>
                        <Switch
                          id={`notif-${e.id}`}
                          checked={c.notificar_responsavel}
                          onCheckedChange={(v) => updateCfg(e.id, { notificar_responsavel: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`avancar-${e.id}`}>Avançar para próxima etapa após disparo</Label>
                        <Switch
                          id={`avancar-${e.id}`}
                          checked={c.avancar_proxima_etapa}
                          onCheckedChange={(v) => updateCfg(e.id, { avancar_proxima_etapa: v })}
                        />
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={testEngine} disabled={saving}>
            Testar motor agora
          </Button>
          <Button onClick={saveAll} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
