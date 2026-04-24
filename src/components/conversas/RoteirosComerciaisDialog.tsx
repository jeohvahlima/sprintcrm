import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Workflow, Play, Edit, FileText } from "lucide-react";
import {
  useCommercialScripts,
  useCreateScript,
  useDeleteScript,
  useStartScriptExecution,
} from "@/hooks/useCommercialScripts";
import { ScriptBuilderDialog } from "./ScriptBuilderDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationContext?: {
    conversation_id?: string;
    lead_id?: string;
    telefone_formatado: string;
  };
}

export function RoteirosComerciaisDialog({ open, onOpenChange, conversationContext }: Props) {
  const { data: scripts, isLoading } = useCommercialScripts();
  const createScript = useCreateScript();
  const deleteScript = useDeleteScript();
  const startExecution = useStartScriptExecution();

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const script = await createScript.mutateAsync({ name: newName, description: newDesc });
    setNewName("");
    setNewDesc("");
    setShowNew(false);
    setEditingId(script.id);
  };

  const handleStart = (scriptId: string) => {
    if (!conversationContext?.telefone_formatado) return;
    startExecution.mutate({ script_id: scriptId, ...conversationContext });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" /> Roteiros Comerciais
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Crie sequências de mensagens com gatilhos, condições e ações automáticas
            </p>
          </DialogHeader>

          <div className="space-y-3">
            {!showNew ? (
              <Button onClick={() => setShowNew(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Novo Roteiro
              </Button>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex: Prospecção LinkedIn"
                    />
                  </div>
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                      placeholder="Breve descrição do objetivo do roteiro"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={!newName.trim() || createScript.isPending}>
                      Criar e Editar
                    </Button>
                    <Button variant="ghost" onClick={() => setShowNew(false)}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            ) : !scripts || scripts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum roteiro criado ainda.</p>
                <p className="text-xs">Crie seu primeiro roteiro comercial acima.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scripts.map((s) => (
                  <Card key={s.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base flex items-center gap-2">
                            {s.name}
                            <Badge variant={s.active ? "default" : "secondary"} className="text-xs">
                              {s.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </CardTitle>
                          {s.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 flex gap-2">
                      {conversationContext?.telefone_formatado && (
                        <Button
                          size="sm"
                          onClick={() => handleStart(s.id)}
                          disabled={startExecution.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" /> Disparar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setEditingId(s.id)}>
                        <Edit className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir roteiro "${s.name}"?`)) deleteScript.mutate(s.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {editingId && (
        <ScriptBuilderDialog
          scriptId={editingId}
          open={!!editingId}
          onOpenChange={(v) => !v && setEditingId(null)}
        />
      )}
    </>
  );
}
