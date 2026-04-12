import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
  Copy
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TemplatePreview } from "./TemplatePreview";

interface TemplatesManagerProps {
  companyId: string;
}

interface Template {
  id: string;
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  quality_score: string | null;
  synced_at: string | null;
  created_at: string;
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export function WhatsAppTemplatesManager({ companyId }: TemplatesManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [metaNotConfigured, setMetaNotConfigured] = useState(false);

  // Form state
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: 'UTILITY' as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION',
    language: 'pt_BR',
    headerType: 'none' as 'none' | 'text' | 'image' | 'video' | 'document',
    headerText: '',
    bodyText: '',
    footerText: '',
    buttons: [] as Array<{ type: string; text: string; url?: string; phone?: string }>
  });

  const loadTemplates = async (sync = false) => {
    try {
      if (sync) setSyncing(true);
      else setLoading(true);
      setMetaNotConfigured(false);

      const { data: result, error: fnError } = await supabase.functions.invoke('whatsapp-templates', {
        method: 'POST',
        body: { company_id: companyId, action: 'list', sync }
      });

      // Edge function retorna 400 com JSON — extrair mensagem de erro do body
      const errorMsg = result?.error || fnError?.message || '';
      if (fnError || (result && result.error)) {
        const msg = errorMsg || 'Erro ao carregar templates';
        if (msg.includes('não configurada') || msg.includes('not configured')) {
          setMetaNotConfigured(true);
          setTemplates([]);
          return;
        }
        if (msg.includes('Invalid OAuth') || msg.includes('access token') || msg.includes('Credenciais Meta')) {
          toast({
            variant: "destructive",
            title: "Token Meta inválido",
            description: "O Access Token da Meta API está inválido ou expirado. Vá em Configurações → Meta API e atualize o token com um token permanente (EAA...)."
          });
          setTemplates([]);
          return;
        }
        throw new Error(msg);
      }

      if (sync) {
        setTemplates(result.templates || []);
        toast({
          title: "Templates sincronizados",
          description: `${result.synced || 0} templates sincronizados com a Meta`
        });
        // Recarregar do banco local
        await loadTemplates(false);
      } else {
        setTemplates(result.templates || []);
      }
    } catch (error: any) {
      console.error('Erro ao carregar templates:', error);
      // Verificar se é erro de conexão
      if (error.message?.includes('não configurada') || error.message?.includes('not configured')) {
        setMetaNotConfigured(true);
        setTemplates([]);
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao carregar templates",
          description: error.message
        });
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadTemplates();
    }
  }, [companyId]);

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.bodyText) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Nome e corpo do template são obrigatórios"
      });
      return;
    }

    try {
      setCreating(true);

      // Montar componentes
      const components: TemplateComponent[] = [];

      // Header
      if (newTemplate.headerType !== 'none' && newTemplate.headerText) {
        components.push({
          type: 'HEADER',
          format: newTemplate.headerType.toUpperCase() as any,
          text: newTemplate.headerType === 'text' ? newTemplate.headerText : undefined,
          example: newTemplate.headerType === 'text' ? { header_text: [newTemplate.headerText] } : undefined
        });
      }

      // Body (obrigatório)
      const bodyVariables = newTemplate.bodyText.match(/\{\{(\d+)\}\}/g) || [];
      components.push({
        type: 'BODY',
        text: newTemplate.bodyText,
        example: bodyVariables.length > 0 ? { 
          body_text: [bodyVariables.map((_, i) => `Exemplo ${i + 1}`)]
        } : undefined
      });

      // Footer
      if (newTemplate.footerText) {
        components.push({
          type: 'FOOTER',
          text: newTemplate.footerText
        });
      }

      // Buttons
      if (newTemplate.buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: newTemplate.buttons.map(btn => ({
            type: btn.type as any,
            text: btn.text,
            url: btn.url,
            phone_number: btn.phone
          }))
        });
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('whatsapp-templates', {
        method: 'POST',
        body: {
          action: 'create',
          company_id: companyId,
          name: newTemplate.name,
          category: newTemplate.category,
          language: newTemplate.language,
          components
        }
      });

      if (fnError || result?.error) {
        throw new Error(result?.error || fnError?.message || 'Erro ao criar template');
      }

      toast({
        title: "Template criado!",
        description: "O template foi enviado para aprovação da Meta. Status: PENDING"
      });

      setCreateDialogOpen(false);
      resetForm();
      loadTemplates();

    } catch (error: any) {
      console.error('Erro ao criar template:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar template",
        description: error.message
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (!confirm(`Tem certeza que deseja deletar o template "${template.name}"?`)) return;

    try {
      setDeleting(template.id);

      const { data: result, error: fnError } = await supabase.functions.invoke('whatsapp-templates', {
        method: 'POST',
        body: {
          action: 'delete',
          company_id: companyId,
          template_name: template.name
        }
      });

      if (fnError || result?.error) {
        throw new Error(result?.error || fnError?.message || 'Erro ao deletar template');
      }

      toast({
        title: "Template deletado",
        description: `O template "${template.name}" foi removido`
      });

      loadTemplates();

    } catch (error: any) {
      console.error('Erro ao deletar template:', error);
      toast({
        variant: "destructive",
        title: "Erro ao deletar template",
        description: error.message
      });
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setNewTemplate({
      name: '',
      category: 'UTILITY',
      language: 'pt_BR',
      headerType: 'none',
      headerText: '',
      bodyText: '',
      footerText: '',
      buttons: []
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      APPROVED: 'default',
      PENDING: 'secondary',
      REJECTED: 'destructive',
      PAUSED: 'outline',
      DISABLED: 'outline'
    };
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      UTILITY: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      MARKETING: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      AUTHENTICATION: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[category] || 'bg-gray-100 text-gray-800'}`}>
        {category}
      </span>
    );
  };

  const addButton = () => {
    if (newTemplate.buttons.length >= 3) return;
    setNewTemplate(prev => ({
      ...prev,
      buttons: [...prev.buttons, { type: 'QUICK_REPLY', text: '' }]
    }));
  };

  const removeButton = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index)
    }));
  };

  const updateButton = (index: number, field: string, value: string) => {
    setNewTemplate(prev => ({
      ...prev,
      buttons: prev.buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mostrar mensagem quando Meta não está configurada
  if (metaNotConfigured) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="h-5 w-5" />
            Conexão Meta não Configurada
          </CardTitle>
          <CardDescription>
            Para gerenciar templates da API oficial do WhatsApp, você precisa configurar a conexão com a Meta API primeiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Para configurar:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Acesse a aba <strong>"Canais"</strong> nas configurações</li>
              <li>Encontre a seção <strong>"Meta API (WhatsApp Business)"</strong></li>
              <li>Configure o <strong>Phone Number ID</strong> e o <strong>Access Token</strong> da sua conta Meta Business</li>
              <li>Salve as configurações e volte aqui</li>
            </ol>
          </div>
          <Button variant="outline" onClick={() => loadTemplates()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Templates WhatsApp</h2>
          <p className="text-muted-foreground">
            Gerencie templates de mensagem da Meta API
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => loadTemplates(true)} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Template</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Nome e Categoria */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Template *</Label>
                    <Input
                      placeholder="meu_template"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e underscore</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select
                      value={newTemplate.category}
                      onValueChange={(v) => setNewTemplate(prev => ({ ...prev, category: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTILITY">Utility (R$ 0,035)</SelectItem>
                        <SelectItem value="MARKETING">Marketing (R$ 0,065)</SelectItem>
                        <SelectItem value="AUTHENTICATION">Authentication (R$ 0,045)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Idioma */}
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select
                    value={newTemplate.language}
                    onValueChange={(v) => setNewTemplate(prev => ({ ...prev, language: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Header */}
                <div className="space-y-2">
                  <Label>Cabeçalho (Header)</Label>
                  <Select
                    value={newTemplate.headerType}
                    onValueChange={(v) => setNewTemplate(prev => ({ ...prev, headerType: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                  {newTemplate.headerType === 'text' && (
                    <Input
                      placeholder="Texto do cabeçalho"
                      value={newTemplate.headerText}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, headerText: e.target.value }))}
                    />
                  )}
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <Label>Corpo da Mensagem *</Label>
                  <Textarea
                    placeholder="Olá {{1}}, sua consulta está agendada para {{2}}."
                    value={newTemplate.bodyText}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, bodyText: e.target.value }))}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis dinâmicas
                  </p>
                </div>

                {/* Footer */}
                <div className="space-y-2">
                  <Label>Rodapé (Footer)</Label>
                  <Input
                    placeholder="Texto do rodapé (opcional)"
                    value={newTemplate.footerText}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, footerText: e.target.value }))}
                  />
                </div>

                {/* Buttons */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Botões (máx. 3)</Label>
                    {newTemplate.buttons.length < 3 && (
                      <Button type="button" variant="outline" size="sm" onClick={addButton}>
                        <Plus className="h-4 w-4 mr-1" /> Adicionar Botão
                      </Button>
                    )}
                  </div>
                  {newTemplate.buttons.map((btn, index) => (
                    <div key={index} className="flex gap-2 items-start border rounded-lg p-3">
                      <Select
                        value={btn.type}
                        onValueChange={(v) => updateButton(index, 'type', v)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
                          <SelectItem value="URL">Link URL</SelectItem>
                          <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Texto do botão"
                        value={btn.text}
                        onChange={(e) => updateButton(index, 'text', e.target.value)}
                        className="flex-1"
                      />
                      {btn.type === 'URL' && (
                        <Input
                          placeholder="https://..."
                          value={btn.url || ''}
                          onChange={(e) => updateButton(index, 'url', e.target.value)}
                          className="flex-1"
                        />
                      )}
                      {btn.type === 'PHONE_NUMBER' && (
                        <Input
                          placeholder="+5511999999999"
                          value={btn.phone || ''}
                          onChange={(e) => updateButton(index, 'phone', e.target.value)}
                          className="flex-1"
                        />
                      )}
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeButton(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTemplate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Criar Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Sincronize com a Meta ou crie um novo template
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => loadTemplates(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  {getStatusIcon(template.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{template.name}</h3>
                      {getStatusBadge(template.status)}
                      {getCategoryBadge(template.category)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Idioma: {template.language} 
                      {template.quality_score && ` • Qualidade: ${template.quality_score}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setPreviewDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(template.name);
                      toast({ title: "Nome copiado!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteTemplate(template)}
                    disabled={deleting === template.id}
                  >
                    {deleting === template.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview do Template</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <TemplatePreview 
              components={selectedTemplate.components}
              name={selectedTemplate.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}