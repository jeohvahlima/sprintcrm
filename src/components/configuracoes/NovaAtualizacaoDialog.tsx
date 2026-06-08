import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Rocket, Wrench, Zap, Plus, X, Loader2, Send } from "lucide-react";
import { useSystemUpdates, SystemUpdateChange } from "@/hooks/useSystemUpdates";

interface NovaAtualizacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHANGE_TYPES = [
  { value: 'feature', label: 'Nova Funcionalidade', icon: Rocket, color: 'text-green-500' },
  { value: 'improvement', label: 'Melhoria', icon: Zap, color: 'text-blue-500' },
  { value: 'fix', label: 'Correção', icon: Wrench, color: 'text-orange-500' },
] as const;

const MODULES = [
  { value: '__all__', label: 'Todos os módulos (geral)' },
  { value: 'Conversas', label: 'Conversas / Bate-papo' },
  { value: 'Funil', label: 'Funil de Vendas' },
  { value: 'Leads', label: 'Leads' },
  { value: 'Agenda', label: 'Agenda' },
  { value: 'Tarefas', label: 'Tarefas' },
  { value: 'Automacoes', label: 'Automações / Fluxos' },
  { value: 'IA', label: 'Inteligência Artificial' },
  { value: 'Campanhas', label: 'Campanhas / Disparos' },
  { value: 'Financeiro', label: 'Financeiro' },
  { value: 'Relatorios', label: 'Relatórios' },
  { value: 'Configuracoes', label: 'Configurações' },
  { value: 'Treinamento', label: 'Treinamento' },
  { value: 'Reunioes', label: 'Reuniões' },
  { value: 'Discador', label: 'Discador / Call Center' },
] as const;

export function NovaAtualizacaoDialog({ open, onOpenChange }: NovaAtualizacaoDialogProps) {
  const { createUpdate } = useSystemUpdates();
  const [loading, setLoading] = useState(false);
  
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tipo, setTipo] = useState<'feature' | 'fix' | 'improvement'>('feature');
  const [module, setModule] = useState<string>('__all__');
  const [changes, setChanges] = useState<SystemUpdateChange[]>([]);
  const [newChangeText, setNewChangeText] = useState("");
  const [newChangeType, setNewChangeType] = useState<'feature' | 'improvement' | 'fix'>('feature');

  const resetForm = () => {
    setVersion("");
    setTitle("");
    setDescription("");
    setTipo('feature');
    setModule('__all__');
    setChanges([]);
    setNewChangeText("");
    setNewChangeType('feature');
  };

  const addChange = () => {
    if (!newChangeText.trim()) return;
    
    const iconMap = {
      feature: 'rocket',
      improvement: 'zap',
      fix: 'wrench',
    };

    setChanges(prev => [...prev, {
      type: newChangeType,
      icon: iconMap[newChangeType],
      text: newChangeText.trim(),
    }]);
    setNewChangeText("");
  };

  const removeChange = (index: number) => {
    setChanges(prev => prev.filter((_, i) => i !== index));
  };

  const getChangeIcon = (type: string) => {
    const found = CHANGE_TYPES.find(t => t.value === type);
    if (!found) return null;
    const Icon = found.icon;
    return <Icon className={`h-4 w-4 ${found.color}`} />;
  };

  const handleSubmit = async () => {
    if (!version.trim() || !title.trim()) {
      return;
    }

    setLoading(true);
    try {
      const success = await createUpdate({
        version: version.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        changes,
        tipo,
        module: module === '__all__' ? null : module,
      });

      if (success) {
        resetForm();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Publicar Nova Atualização
          </DialogTitle>
          <DialogDescription>
            Crie uma notificação de atualização para informar suas subcontas sobre novidades do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Versão e Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">Versão *</Label>
              <Input
                id="version"
                placeholder="Ex: 1.2.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo Principal</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className={`h-4 w-4 ${type.color}`} />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Módulo */}
          <div className="space-y-2">
            <Label htmlFor="module">Módulo específico *</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger id="module">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecione o módulo ao qual esta atualização se refere. Apenas as melhorias deste módulo serão divulgadas — os ajustes em outros módulos permanecem ocultos.
            </p>
          </div>


          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Novo módulo de relatórios"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Resumo das principais mudanças desta atualização..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Lista de Mudanças */}
          <div className="space-y-2">
            <Label>Lista de Mudanças</Label>
            <div className="flex gap-2">
              <Select value={newChangeType} onValueChange={(v: any) => setNewChangeType(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className={`h-4 w-4 ${type.color}`} />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Descreva a mudança..."
                value={newChangeText}
                onChange={(e) => setNewChangeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChange()}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addChange}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Lista de mudanças adicionadas */}
            {changes.length > 0 && (
              <div className="space-y-2 mt-3 p-3 bg-muted/50 rounded-lg">
                {changes.map((change, index) => (
                  <div key={index} className="flex items-center gap-2 bg-background rounded p-2">
                    {getChangeIcon(change.type)}
                    <span className="flex-1 text-sm">{change.text}</span>
                    <Badge variant="secondary" className="text-xs">
                      {CHANGE_TYPES.find(t => t.value === change.type)?.label}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeChange(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !version.trim() || !title.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Publicar Atualização
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
