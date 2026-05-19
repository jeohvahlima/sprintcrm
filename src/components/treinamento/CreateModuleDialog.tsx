import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Book, Users, MessageSquare, LayoutDashboard, Settings, 
  Calendar, Bot, Video, PhoneCall, Target, DollarSign,
  GraduationCap, FileText, Zap, HelpCircle
} from "lucide-react";

const iconOptions = [
  { value: 'book', label: 'Livro', icon: Book },
  { value: 'users', label: 'Usuários', icon: Users },
  { value: 'message-square', label: 'Mensagem', icon: MessageSquare },
  { value: 'layout-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'settings', label: 'Configurações', icon: Settings },
  { value: 'calendar', label: 'Calendário', icon: Calendar },
  { value: 'bot', label: 'Automação', icon: Bot },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'phone-call', label: 'Telefone', icon: PhoneCall },
  { value: 'target', label: 'Alvo', icon: Target },
  { value: 'dollar-sign', label: 'Financeiro', icon: DollarSign },
  { value: 'graduation-cap', label: 'Educação', icon: GraduationCap },
  { value: 'file-text', label: 'Documento', icon: FileText },
  { value: 'zap', label: 'Rápido', icon: Zap },
  { value: 'help-circle', label: 'Ajuda', icon: HelpCircle },
];

const moduleAccessOptions = [
  { key: 'leads', label: 'Leads' },
  { key: 'funil-vendas', label: 'Funil de Vendas' },
  { key: 'conversas', label: 'Conversas' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'tarefas', label: 'Tarefas' },
  { key: 'chat-equipe', label: 'Bate-papo Interno' },
  { key: 'reunioes', label: 'Reuniões' },
  { key: 'discador', label: 'Call Center' },
  { key: 'processos', label: 'Processos Comerciais' },
  { key: 'automacao', label: 'Fluxos e Automação' },
  { key: 'configuracoes', label: 'Configurações' },
];

interface CreateModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCreateGlobal?: boolean;
  onSubmit: (data: { title: string; description?: string; icon?: string; related_modules?: string[]; scope?: 'global' | 'company' }) => Promise<void>;
  editingModule?: { id: string; title: string; description: string | null; icon: string; related_modules?: string[]; scope?: 'global' | 'company' } | null;
}

export function CreateModuleDialog({ 
  open, 
  onOpenChange, 
  onSubmit,
  editingModule,
  canCreateGlobal = false,
}: CreateModuleDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("book");
  const [scope, setScope] = useState<'global' | 'company'>('company');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingModule) {
        setTitle(editingModule.title);
        setDescription(editingModule.description || "");
        setIcon(editingModule.icon);
        setScope(editingModule.scope || 'company');
        setSelectedModules(editingModule.related_modules || []);
      } else {
        setTitle("");
        setDescription("");
        setIcon("book");
        setScope(canCreateGlobal ? 'global' : 'company');
        setSelectedModules([]);
      }
    }
  }, [open, editingModule, canCreateGlobal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setLoading(true);
    try {
      await onSubmit({ title, description, icon, related_modules: selectedModules, scope });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules(prev => 
      prev.includes(moduleKey) 
        ? prev.filter(m => m !== moduleKey)
        : [...prev, moduleKey]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingModule ? "Editar Módulo" : "Novo Módulo de Treinamento"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título do Módulo *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Gestão de Leads"
              required
            />
          </div>

          {canCreateGlobal && (
            <div className="space-y-2">
              <Label>Visibilidade do treinamento</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as 'global' | 'company')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Global — todas as empresas (Grow Sales Inteligência)</SelectItem>
                  <SelectItem value="company">🏢 Apenas esta empresa (treinamento do time)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {scope === 'global'
                  ? 'Visível para todas as subcontas. Use para conteúdo institucional GROW OS.'
                  : 'Visível apenas para o time desta empresa. Use para gravações personalizadas da estruturação comercial.'}
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o conteúdo deste módulo..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="icon">Ícone</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um ícone" />
              </SelectTrigger>
              <SelectContent>
                {iconOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Módulos do Sistema Relacionados</Label>
            <p className="text-xs text-muted-foreground">
              Selecione quais módulos do sistema este treinamento aborda (visível para subcontas)
            </p>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
              {moduleAccessOptions.map((module) => (
                <div key={module.key} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`module-${module.key}`}
                    checked={selectedModules.includes(module.key)}
                    onCheckedChange={() => toggleModule(module.key)}
                  />
                  <label 
                    htmlFor={`module-${module.key}`}
                    className="text-sm cursor-pointer select-none"
                  >
                    {module.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? "Salvando..." : editingModule ? "Salvar" : "Criar Módulo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
