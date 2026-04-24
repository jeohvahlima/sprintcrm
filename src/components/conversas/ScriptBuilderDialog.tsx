import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MessageSquare,
  Clock,
  GitBranch,
  Tag as TagIcon,
  Trash2,
  Plus,
  Save,
  Workflow,
  PauseCircle,
  Hand,
  Flag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  useScriptDetail,
  useSaveNode,
  useSaveEdge,
  useDeleteNode,
  useUpdateScript,
  ScriptNodeType,
  ScriptNode,
} from "@/hooks/useCommercialScripts";
import { toast } from "sonner";

interface Props {
  scriptId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const NODE_TYPES: { type: ScriptNodeType; label: string; icon: any; color: string }[] = [
  { type: "message", label: "Enviar Mensagem", icon: MessageSquare, color: "bg-blue-500" },
  { type: "delay", label: "Aguardar Tempo", icon: Clock, color: "bg-amber-500" },
  { type: "wait_reply", label: "Aguardar Resposta", icon: PauseCircle, color: "bg-purple-500" },
  { type: "condition", label: "Condição (Sim/Não)", icon: GitBranch, color: "bg-pink-500" },
  { type: "action_tag", label: "Adicionar Tag", icon: TagIcon, color: "bg-emerald-500" },
  { type: "action_funnel", label: "Mover no Funil", icon: Workflow, color: "bg-cyan-500" },
  { type: "action_task", label: "Criar Tarefa", icon: Hand, color: "bg-indigo-500" },
  { type: "end", label: "Encerrar Roteiro", icon: Flag, color: "bg-red-500" },
];

export function ScriptBuilderDialog({ scriptId, open, onOpenChange }: Props) {
  const { data, isLoading, refetch } = useScriptDetail(scriptId);
  const saveNode = useSaveNode();
  const saveEdge = useSaveEdge();
  const deleteNode = useDeleteNode();
  const updateScript = useUpdateScript();

  const [editingNode, setEditingNode] = useState<ScriptNode | null>(null);
  const [showAddType, setShowAddType] = useState<{ afterNodeId: string | null; handle?: string } | null>(null);

  const script = data?.script;
  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  // monta sequência linear seguindo edges (a partir do start_node_id)
  const orderedFlow = useMemo(() => {
    if (!script) return [];
    const result: { node: ScriptNode; depth: number; branch?: string }[] = [];
    const visited = new Set<string>();

    const walk = (nodeId: string | null, depth: number, branch?: string) => {
      if (!nodeId || visited.has(nodeId)) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      visited.add(nodeId);
      result.push({ node, depth, branch });

      // Para condições, mostra os 2 ramos
      if (node.node_type === "condition") {
        const yesEdge = edges.find((e) => e.source_node_id === nodeId && e.source_handle === "yes");
        const noEdge = edges.find((e) => e.source_node_id === nodeId && e.source_handle === "no");
        if (yesEdge) walk(yesEdge.target_node_id, depth + 1, "✅ Sim");
        if (noEdge) walk(noEdge.target_node_id, depth + 1, "❌ Não");
      } else {
        const next = edges.find((e) => e.source_node_id === nodeId && (!e.source_handle || e.source_handle === ""));
        if (next) walk(next.target_node_id, depth, branch);
      }
    };

    walk(script.start_node_id, 0);
    // Adiciona órfãos (sem conexão)
    nodes.forEach((n) => {
      if (!visited.has(n.id)) result.push({ node: n, depth: 0, branch: "(desconectado)" });
    });
    return result;
  }, [script, nodes, edges]);

  const handleAddNode = async (type: ScriptNodeType, afterNodeId: string | null, handle?: string) => {
    const defaultConfig: any = {
      message: { content: "", message_type: "text" },
      delay: { seconds: 30 },
      wait_reply: { timeout_minutes: 60 },
      condition: { keywords: ["sim"], match_mode: "any" },
      action_tag: { tag: "", action: "add" },
      action_funnel: { etapa_id: "" },
      action_task: { title: "", due_in_hours: 24 },
      end: {},
    }[type];

    const newNodeId = await saveNode.mutateAsync({
      script_id: scriptId,
      node_type: type,
      config: defaultConfig,
    });

    if (!afterNodeId) {
      // Define como start_node se for o primeiro
      if (!script?.start_node_id) {
        await updateScript.mutateAsync({ id: scriptId, start_node_id: newNodeId as string });
      }
    } else {
      await saveEdge.mutateAsync({
        script_id: scriptId,
        source_node_id: afterNodeId,
        target_node_id: newNodeId as string,
        source_handle: handle || "",
      });
    }
    setShowAddType(null);
    refetch();
    // Abre editor logo
    setTimeout(() => {
      const fresh = nodes.find((n) => n.id === newNodeId);
      if (fresh) setEditingNode(fresh);
    }, 300);
  };

  const handleSaveNodeConfig = async (config: any) => {
    if (!editingNode) return;
    await saveNode.mutateAsync({
      id: editingNode.id,
      script_id: scriptId,
      node_type: editingNode.node_type,
      config,
      position_x: editingNode.position_x,
      position_y: editingNode.position_y,
    });
    setEditingNode(null);
    toast.success("Passo salvo");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              Builder: {script?.name}
            </span>
            {script && (
              <div className="flex items-center gap-2 text-sm font-normal">
                <Switch
                  checked={script.active}
                  onCheckedChange={(v) => updateScript.mutate({ id: scriptId, active: v })}
                />
                <span>{script.active ? "Ativo" : "Inativo"}</span>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-center py-10 text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {orderedFlow.length === 0 && !showAddType && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Workflow className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Roteiro vazio. Adicione o primeiro passo abaixo.</p>
              </div>
            )}

            {orderedFlow.map(({ node, depth, branch }, idx) => {
              const meta = NODE_TYPES.find((t) => t.type === node.node_type)!;
              const Icon = meta.icon;
              return (
                <div key={node.id} style={{ marginLeft: depth * 24 }}>
                  {branch && (
                    <Badge variant="outline" className="mb-1 ml-2 text-xs">
                      {branch}
                    </Badge>
                  )}
                  <Card className="border-l-4" style={{ borderLeftColor: `hsl(var(--primary))` }}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`${meta.color} text-white p-2 rounded-md`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Passo {idx + 1} · {meta.label}</div>
                        <div className="text-sm truncate">
                          {summarizeNode(node)}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNode(node)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Excluir este passo?")) {
                            deleteNode.mutate({ id: node.id, script_id: scriptId });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>

                  {node.node_type === "condition" ? (
                    <div className="ml-6 mt-2 flex gap-2">
                      {!edges.some((e) => e.source_node_id === node.id && e.source_handle === "yes") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddType({ afterNodeId: node.id, handle: "yes" })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Ramo SIM
                        </Button>
                      )}
                      {!edges.some((e) => e.source_node_id === node.id && e.source_handle === "no") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddType({ afterNodeId: node.id, handle: "no" })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Ramo NÃO
                        </Button>
                      )}
                    </div>
                  ) : node.node_type !== "end" && !edges.some((e) => e.source_node_id === node.id) ? (
                    <div className="ml-6 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddType({ afterNodeId: node.id })}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Próximo passo
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {orderedFlow.length === 0 && (
              <Button
                className="w-full"
                onClick={() => setShowAddType({ afterNodeId: null })}
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar primeiro passo
              </Button>
            )}
          </div>
        )}

        {/* Picker de tipo */}
        {showAddType && (
          <Dialog open onOpenChange={() => setShowAddType(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Escolha o tipo de passo</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2">
                {NODE_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Button
                      key={t.type}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-2"
                      onClick={() => handleAddNode(t.type, showAddType.afterNodeId, showAddType.handle)}
                    >
                      <div className={`${t.color} text-white p-2 rounded-md`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs">{t.label}</span>
                    </Button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Editor de nó */}
        {editingNode && (
          <NodeEditorDialog
            node={editingNode}
            onClose={() => setEditingNode(null)}
            onSave={handleSaveNodeConfig}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function summarizeNode(node: ScriptNode): string {
  const c = node.config || {};
  switch (node.node_type) {
    case "message":
      return c.content?.slice(0, 60) || `[${c.message_type || "texto"}]`;
    case "delay":
      return `Aguardar ${c.seconds || 30}s`;
    case "wait_reply":
      return `Aguardar resposta (timeout: ${c.timeout_minutes || 60}min)`;
    case "condition":
      return `Se mensagem contém: ${(c.keywords || []).join(", ")}`;
    case "action_tag":
      return `${c.action === "remove" ? "Remover" : "Adicionar"} tag: ${c.tag || "(vazio)"}`;
    case "action_funnel":
      return `Mover para etapa: ${c.etapa_id || "(escolher)"}`;
    case "action_task":
      return `Criar tarefa: ${c.title || "(sem título)"}`;
    case "end":
      return "Fim do roteiro";
    default:
      return "";
  }
}

function NodeEditorDialog({
  node,
  onClose,
  onSave,
}: {
  node: ScriptNode;
  onClose: () => void;
  onSave: (config: any) => void;
}) {
  const [config, setConfig] = useState<any>(node.config || {});
  const set = (k: string, v: any) => setConfig((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar passo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {node.node_type === "message" && (
            <>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={config.message_type || "text"}
                  onValueChange={(v) => set("message_type", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem (URL)</SelectItem>
                    <SelectItem value="video">Vídeo (URL)</SelectItem>
                    <SelectItem value="audio">Áudio (URL)</SelectItem>
                    <SelectItem value="document">PDF (URL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conteúdo {config.message_type !== "text" && "/ URL da mídia"}</Label>
                <Textarea
                  value={config.content || ""}
                  onChange={(e) => set("content", e.target.value)}
                  rows={4}
                  placeholder={
                    config.message_type === "text"
                      ? "Olá {{nome}}, tudo bem?"
                      : "https://..."
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis: {"{{nome}}"} {"{{telefone}}"}
                </p>
              </div>
              {config.message_type !== "text" && (
                <div>
                  <Label>Legenda (opcional)</Label>
                  <Input value={config.caption || ""} onChange={(e) => set("caption", e.target.value)} />
                </div>
              )}
            </>
          )}

          {node.node_type === "delay" && (
            <div>
              <Label>Aguardar (segundos)</Label>
              <Input
                type="number"
                value={config.seconds || 30}
                onChange={(e) => set("seconds", parseInt(e.target.value) || 30)}
              />
            </div>
          )}

          {node.node_type === "wait_reply" && (
            <div>
              <Label>Timeout (minutos sem resposta)</Label>
              <Input
                type="number"
                value={config.timeout_minutes || 60}
                onChange={(e) => set("timeout_minutes", parseInt(e.target.value) || 60)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se o cliente não responder nesse tempo, o roteiro segue para o próximo passo (ou encerra).
              </p>
            </div>
          )}

          {node.node_type === "condition" && (
            <>
              <div>
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={(config.keywords || []).join(", ")}
                  onChange={(e) =>
                    set(
                      "keywords",
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder="sim, claro, quero, ok"
                />
              </div>
              <div>
                <Label>Modo</Label>
                <Select
                  value={config.match_mode || "any"}
                  onValueChange={(v) => set("match_mode", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer palavra</SelectItem>
                    <SelectItem value="all">Todas as palavras</SelectItem>
                    <SelectItem value="exact">Exato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Avalia a última resposta do cliente. Crie ramos SIM (match) e NÃO (sem match) no fluxo.
              </p>
            </>
          )}

          {node.node_type === "action_tag" && (
            <>
              <div>
                <Label>Tag</Label>
                <Input value={config.tag || ""} onChange={(e) => set("tag", e.target.value)} placeholder="Ex: Quente" />
              </div>
              <div>
                <Label>Ação</Label>
                <Select value={config.action || "add"} onValueChange={(v) => set("action", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Adicionar</SelectItem>
                    <SelectItem value="remove">Remover</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {node.node_type === "action_funnel" && (
            <div>
              <Label>ID da etapa do funil</Label>
              <Input
                value={config.etapa_id || ""}
                onChange={(e) => set("etapa_id", e.target.value)}
                placeholder="UUID da etapa"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Você encontra o ID na página do funil. Em breve teremos seletor visual.
              </p>
            </div>
          )}

          {node.node_type === "action_task" && (
            <>
              <div>
                <Label>Título da tarefa</Label>
                <Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div>
                <Label>Vencimento (horas a partir de agora)</Label>
                <Input
                  type="number"
                  value={config.due_in_hours || 24}
                  onChange={(e) => set("due_in_hours", parseInt(e.target.value) || 24)}
                />
              </div>
            </>
          )}

          {node.node_type === "end" && (
            <p className="text-sm text-muted-foreground">Este passo encerra a execução do roteiro.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(config)}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
