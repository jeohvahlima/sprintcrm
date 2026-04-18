import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Eye, Save, Link2, Palette, FileText, MessageCircle, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Servico {
  nome: string;
  descricao?: string;
  imagem_url?: string;
}

interface Pergunta {
  campo: string;
  label: string;
  tipo?: string;
  obrigatorio?: boolean;
}

interface CaptureConfig {
  titulo?: string;
  descricao?: string;
  cor_primaria?: string;
  cor_secundaria?: string;
  logo_url?: string;
  mensagem_boas_vindas?: string;
  servicos?: Servico[];
  perguntas?: Pergunta[];
  tag_automatica?: string;
  telefone_contato?: string;
  whatsapp?: string;
  email_contato?: string;
  endereco?: string;
  site?: string;
  ativo?: boolean;
  slug?: string;
}

const DEFAULT_PERGUNTAS: Pergunta[] = [
  { campo: 'nome', label: 'Qual seu nome completo?', tipo: 'text', obrigatorio: true },
  { campo: 'telefone', label: 'Qual seu telefone ou WhatsApp?', tipo: 'tel', obrigatorio: true },
  { campo: 'email', label: 'Qual seu e-mail?', tipo: 'email', obrigatorio: false },
  { campo: 'interesse', label: 'Em qual serviço você tem interesse?', tipo: 'text', obrigatorio: false },
];

export function CapturePageConfig({ companyId }: { companyId: string }) {
  const [config, setConfig] = useState<CaptureConfig>({
    titulo: '',
    descricao: '',
    cor_primaria: '#8B5CF6',
    cor_secundaria: '#6D28D9',
    logo_url: '',
    mensagem_boas_vindas: '',
    servicos: [],
    perguntas: [...DEFAULT_PERGUNTAS],
    tag_automatica: 'pagina-captura',
    telefone_contato: '',
    whatsapp: '',
    email_contato: '',
    endereco: '',
    site: '',
    ativo: true,
    slug: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');

  const normalizeSlug = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const publishedDomain = 'https://wazecrm.lovable.app';
  const slugValue = normalizeSlug(config.slug || companyName || companyId) || companyId;
  const captureUrl = `${publishedDomain}/captura/${slugValue}`;

  useEffect(() => {
    loadConfig();
  }, [companyId]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('companies')
      .select('capture_page_config, name')
      .eq('id', companyId)
      .single();

    if (data) {
      setCompanyName(data.name);
      const saved = (data as any).capture_page_config as CaptureConfig;
      if (saved) {
        setConfig(prev => ({ ...prev, ...saved }));
      } else {
        const defaultSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        setConfig(prev => ({ ...prev, titulo: `Bem-vindo à ${data.name}`, slug: defaultSlug }));
      }
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    const configToSave = {
      ...config,
      slug: slugValue,
      ativo: config.ativo ?? true,
      titulo: config.titulo?.trim() || `Bem-vindo à ${companyName}`,
    };

    const { error } = await (supabase as any)
      .rpc('update_capture_page_config', {
        _company_id: companyId,
        _config: configToSave,
      });

    if (error) {
      toast.error(error.message || 'Erro ao salvar configuração');
    } else {
      setConfig(configToSave);
      toast.success('Configuração salva com sucesso!');
    }
    setSaving(false);
  };

  const addServico = () => {
    setConfig(prev => ({
      ...prev,
      servicos: [...(prev.servicos || []), { nome: '', descricao: '' }],
    }));
  };

  const removeServico = (idx: number) => {
    setConfig(prev => ({
      ...prev,
      servicos: prev.servicos?.filter((_, i) => i !== idx),
    }));
  };

  const updateServico = (idx: number, field: keyof Servico, value: string) => {
    setConfig(prev => ({
      ...prev,
      servicos: prev.servicos?.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const addPergunta = () => {
    setConfig(prev => ({
      ...prev,
      perguntas: [...(prev.perguntas || []), { campo: '', label: '', obrigatorio: false }],
    }));
  };

  const removePergunta = (idx: number) => {
    setConfig(prev => ({
      ...prev,
      perguntas: prev.perguntas?.filter((_, i) => i !== idx),
    }));
  };

  const updatePergunta = (idx: number, field: keyof Pergunta, value: any) => {
    setConfig(prev => ({
      ...prev,
      perguntas: prev.perguntas?.map((p, i) => i === idx ? { ...p, [field]: value } : p),
    }));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(captureUrl);
    toast.success('Link copiado!');
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Link público */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Link da Página de Captura
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Compartilhe este link para captar leads</p>
            </div>
            <div className="flex items-center gap-2">
              <Input value={captureUrl} readOnly className="w-[350px] text-sm bg-background" />
              <Button variant="outline" size="icon" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => window.open(captureUrl, '_blank')}><Eye className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="aparencia" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="aparencia" className="gap-1"><Palette className="h-3.5 w-3.5" /> Aparência</TabsTrigger>
          <TabsTrigger value="servicos" className="gap-1"><FileText className="h-3.5 w-3.5" /> Serviços</TabsTrigger>
          <TabsTrigger value="formulario" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> Formulário IA</TabsTrigger>
          <TabsTrigger value="contato" className="gap-1"><Globe className="h-3.5 w-3.5" /> Contato</TabsTrigger>
        </TabsList>

        {/* Aparência */}
        <TabsContent value="aparencia" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>Personalize a aparência da página de captura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título da Página</Label>
                  <Input value={config.titulo || ''} onChange={e => setConfig(p => ({ ...p, titulo: e.target.value }))} placeholder="Bem-vindo à sua empresa" />
                </div>
                <div className="space-y-2">
                  <Label>Slug da URL</Label>
                  <Input value={config.slug || ''} onChange={e => setConfig(p => ({ ...p, slug: normalizeSlug(e.target.value) }))} placeholder="nome-da-empresa" />
                  <p className="text-xs text-muted-foreground">Define a URL: wazecrm.lovable.app/captura/<strong>{slugValue}</strong></p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL do Logo</Label>
                  <Input value={config.logo_url || ''} onChange={e => setConfig(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={config.descricao || ''} onChange={e => setConfig(p => ({ ...p, descricao: e.target.value }))} placeholder="Texto descritivo sobre sua empresa..." rows={3} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={config.cor_primaria || '#8B5CF6'} onChange={e => setConfig(p => ({ ...p, cor_primaria: e.target.value }))} className="h-10 w-14 rounded cursor-pointer" />
                    <Input value={config.cor_primaria || ''} onChange={e => setConfig(p => ({ ...p, cor_primaria: e.target.value }))} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Secundária</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={config.cor_secundaria || '#6D28D9'} onChange={e => setConfig(p => ({ ...p, cor_secundaria: e.target.value }))} className="h-10 w-14 rounded cursor-pointer" />
                    <Input value={config.cor_secundaria || ''} onChange={e => setConfig(p => ({ ...p, cor_secundaria: e.target.value }))} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensagem de Boas-vindas do Chat</Label>
                <Textarea value={config.mensagem_boas_vindas || ''} onChange={e => setConfig(p => ({ ...p, mensagem_boas_vindas: e.target.value }))} placeholder="Olá! 👋 Como posso te ajudar?" rows={2} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Serviços */}
        <TabsContent value="servicos" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Serviços / Portfólio</CardTitle>
              <CardDescription>Adicione os serviços ou produtos para exibir na página</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.servicos?.map((s, i) => (
                <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input value={s.nome} onChange={e => updateServico(i, 'nome', e.target.value)} placeholder="Nome do serviço" />
                    <Input value={s.descricao || ''} onChange={e => updateServico(i, 'descricao', e.target.value)} placeholder="Descrição breve" />
                    <Input value={s.imagem_url || ''} onChange={e => updateServico(i, 'imagem_url', e.target.value)} placeholder="URL da imagem (opcional)" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeServico(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={addServico} className="w-full gap-2"><Plus className="h-4 w-4" /> Adicionar Serviço</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formulário IA */}
        <TabsContent value="formulario" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Perguntas do Agente IA</CardTitle>
              <CardDescription>Defina as perguntas que o agente IA fará sequencialmente ao visitante. Ao completar todas, o lead será criado automaticamente no CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.perguntas?.map((p, i) => (
                <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                  <span className="bg-primary/10 text-primary font-bold w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-1">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <Input value={p.label} onChange={e => updatePergunta(i, 'label', e.target.value)} placeholder="Pergunta que o agente fará" />
                    <div className="flex gap-3 items-center">
                      <Input value={p.campo} onChange={e => updatePergunta(i, 'campo', e.target.value)} placeholder="Nome do campo (ex: nome, telefone)" className="flex-1" />
                      <div className="flex items-center gap-2">
                        <Switch checked={p.obrigatorio || false} onCheckedChange={v => updatePergunta(i, 'obrigatorio', v)} />
                        <span className="text-xs text-muted-foreground">Obrigatório</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removePergunta(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={addPergunta} className="w-full gap-2"><Plus className="h-4 w-4" /> Adicionar Pergunta</Button>

              <div className="space-y-2 pt-4 border-t">
                <Label>Tag Automática para Leads</Label>
                <Input value={config.tag_automatica || ''} onChange={e => setConfig(p => ({ ...p, tag_automatica: e.target.value }))} placeholder="pagina-captura" />
                <p className="text-xs text-muted-foreground">Esta tag será adicionada automaticamente a todos os leads captados pela página</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contato */}
        <TabsContent value="contato" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações de Contato</CardTitle>
              <CardDescription>Dados exibidos no footer da página</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={config.telefone_contato || ''} onChange={e => setConfig(p => ({ ...p, telefone_contato: e.target.value }))} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={config.whatsapp || ''} onChange={e => setConfig(p => ({ ...p, whatsapp: e.target.value }))} placeholder="5511999999999" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={config.email_contato || ''} onChange={e => setConfig(p => ({ ...p, email_contato: e.target.value }))} placeholder="contato@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Input value={config.site || ''} onChange={e => setConfig(p => ({ ...p, site: e.target.value }))} placeholder="https://www.empresa.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={config.endereco || ''} onChange={e => setConfig(p => ({ ...p, endereco: e.target.value }))} placeholder="Rua..., Cidade - UF" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving} size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </Button>
      </div>
    </div>
  );
}
