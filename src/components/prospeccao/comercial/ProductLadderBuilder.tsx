import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers, ArrowDown, Crown } from "lucide-react";
import { useProductLadder, useUpsertLadder, useDeleteLadder, ProductLadderItem, LadderTier } from "@/hooks/useEstrategiaComercial";
import { toast } from "sonner";

const TIERS: { key: LadderTier; label: string; emoji: string; color: string; desc: string }[] = [
  { key: "front", label: "Front End", emoji: "🎯", color: "from-blue-500 to-cyan-400", desc: "Oferta de entrada — atrai e qualifica. Ticket baixo, alto volume." },
  { key: "back", label: "Back End", emoji: "💼", color: "from-emerald-500 to-green-400", desc: "Oferta principal — gera o grosso da receita. Ticket médio." },
  { key: "high_end", label: "High End", emoji: "👑", color: "from-amber-500 to-yellow-400", desc: "Oferta premium — ticket alto, base já aquecida." },
];

export function ProductLadderBuilder() {
  const { data: items = [], isLoading } = useProductLadder();
  const upsert = useUpsertLadder();
  const del = useDeleteLadder();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProductLadderItem> | null>(null);

  const startNew = (tier: LadderTier) => {
    setEditing({ tier, nome: "", ticket: 0, ciclo_dias: 0, ativo: true });
    setOpen(true);
  };
  const startEdit = (item: ProductLadderItem) => {
    setEditing(item);
    setOpen(true);
  };

  const save = async () => {
    if (!editing?.nome || !editing.tier) return toast.error("Preencha o nome e o tier");
    try {
      await upsert.mutateAsync(editing as any);
      toast.success("Produto salvo");
      setOpen(false);
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Esteira de Produtos</CardTitle>
              <CardDescription>
                Estruture sua oferta em 3 níveis (Front / Back / High End) — base da metodologia GROW Sales Intelligence.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">Estruturação Comercial</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Visual de funil descendente */}
      <div className="grid md:grid-cols-3 gap-4">
        {TIERS.map((t, idx) => {
          const tierItems = items.filter((i) => i.tier === t.key);
          return (
            <div key={t.key} className="relative">
              {idx < TIERS.length - 1 && (
                <ArrowDown className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 z-10" />
              )}
              <Card className="overflow-hidden h-full">
                <div className={`h-2 bg-gradient-to-r ${t.color}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{t.emoji}</span>
                      <CardTitle className="text-base">{t.label}</CardTitle>
                    </div>
                    <Badge variant="secondary">{tierItems.length}</Badge>
                  </div>
                  <CardDescription className="text-xs">{t.desc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tierItems.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      Nenhum produto cadastrado neste nível
                    </p>
                  )}
                  {tierItems.map((it) => (
                    <div key={it.id} className="border rounded-lg p-3 space-y-1 hover:border-primary/40 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm flex-1">{it.nome}</div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(it)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={async () => {
                              if (confirm(`Excluir "${it.nome}"?`)) {
                                await del.mutateAsync(it.id);
                                toast.success("Removido");
                              }
                            }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <Badge variant="outline" className="font-mono">
                          R$ {Number(it.ticket || 0).toLocaleString("pt-BR")}
                        </Badge>
                        {!!it.ciclo_dias && (
                          <Badge variant="outline">{it.ciclo_dias}d</Badge>
                        )}
                        {it.canal_aquisicao && (
                          <Badge variant="outline">{it.canal_aquisicao}</Badge>
                        )}
                      </div>
                      {it.objetivo && (
                        <p className="text-[11px] text-muted-foreground">{it.objetivo}</p>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => startNew(t.key)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Matriz comparativa */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" /> Matriz da Esteira
            </CardTitle>
            <CardDescription>Visão consolidada para análise e ajuste estratégico.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Tier</th>
                    <th className="text-left py-2 px-2">Produto</th>
                    <th className="text-right py-2 px-2">Ticket</th>
                    <th className="text-right py-2 px-2">Ciclo</th>
                    <th className="text-left py-2 px-2">Canal</th>
                    <th className="text-left py-2 px-2">Função no funil</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const t = TIERS.find((x) => x.key === it.tier)!;
                    return (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="py-2 px-2"><Badge className={`bg-gradient-to-r ${t.color} text-white border-0`}>{t.emoji} {t.label}</Badge></td>
                        <td className="py-2 px-2 font-medium">{it.nome}</td>
                        <td className="py-2 px-2 text-right font-mono">R$ {Number(it.ticket || 0).toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-2 text-right">{it.ciclo_dias || "-"}d</td>
                        <td className="py-2 px-2">{it.canal_aquisicao || "-"}</td>
                        <td className="py-2 px-2 text-muted-foreground">{it.funcao_funil || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Tier</Label>
                <div className="flex gap-2 mt-1">
                  {TIERS.map((t) => (
                    <Button
                      key={t.key}
                      type="button"
                      variant={editing.tier === t.key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditing({ ...editing, tier: t.key })}
                    >
                      {t.emoji} {t.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Nome do produto</Label>
                <Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ticket (R$)</Label>
                  <Input type="number" value={editing.ticket ?? 0}
                    onChange={(e) => setEditing({ ...editing, ticket: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Ciclo (dias)</Label>
                  <Input type="number" value={editing.ciclo_dias ?? 0}
                    onChange={(e) => setEditing({ ...editing, ciclo_dias: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Canal de aquisição</Label>
                <Input placeholder="Ex: Tráfego pago, Indicação, Orgânico..." value={editing.canal_aquisicao || ""}
                  onChange={(e) => setEditing({ ...editing, canal_aquisicao: e.target.value })} />
              </div>
              <div>
                <Label>Função no funil</Label>
                <Input placeholder="Ex: Atrair / Converter / Escalar" value={editing.funcao_funil || ""}
                  onChange={(e) => setEditing({ ...editing, funcao_funil: e.target.value })} />
              </div>
              <div>
                <Label>Objetivo / observações</Label>
                <Textarea rows={2} value={editing.objetivo || ""}
                  onChange={(e) => setEditing({ ...editing, objetivo: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
    </div>
  );
}
