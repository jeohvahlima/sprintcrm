import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Eye, Save, Link2, Palette, FileText, MessageCircle, Globe, Star, HelpCircle, Zap, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaUploadField } from "./MediaUploadField";

interface Servico { nome: string; descricao?: string; imagem_url?: string; }
interface Pergunta { campo: string; label: string; tipo?: string; obrigatorio?: boolean; }
interface Depoimento { nome: string; texto: string; estrelas?: number; foto_url?: string; }
interface FaqItem { pergunta: string; resposta: string; }

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
  // Novos
  depoimentos?: Depoimento[];
  faq?: FaqItem[];
  urgencia_ativa?: boolean;
  urgencia_texto?: string;
  whatsapp_flutuante_ativo?: boolean;
  whatsapp_flutuante_mensagem?: string;
  sugestoes_chat?: string[];
  og_titulo?: string;
  og_descricao?: string;
  og_imagem_url?: string;
  // Tracking
  facebook_pixel_id?: string;
  google_analytics_id?: string;
  google_tag_manager_id?: string;
  google_ads_conversion_id?: string;
  google_ads_conversion_label?: string;
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
    depoimentos: [],
    faq: [],
    urgencia_ativa: false,
    urgencia_texto: '',
    whatsapp_flutuante_ativo: true,
    whatsapp_flutuante_mensagem: '',
    sugestoes_chat: ['Quero um orçamento', 'Quais são os serviços?', 'Horário de atendimento'],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');

  const normalizeSlug = (value: string) => value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');

  const publishedDomain = 'https://wazecrm.lovable.app';
  const slugValue = normalizeSlug(config.slug || companyName || companyId) || companyId;
  const captureUrl = `${publishedDomain}/captura/${slugValue}`;

  useEffect(() => { loadConfig(); }, [companyId]);

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
      .rpc('update_capture_page_config', { _company_id: companyId, _config: configToSave });

    if (error) toast.error(error.message || 'Erro ao salvar configuração');
    else { setConfig(configToSave); toast.success('Configuração salva com sucesso!'); }
    setSaving(false);
  };

  const addServico = () => setConfig(p => ({ ...p, servicos: [...(p.servicos || []), { nome: '', descricao: '' }] }));
  const removeServico = (idx: number) => setConfig(p => ({ ...p, servicos: p.servicos?.filter((_, i) => i !== idx) }));
  const updateServico = (idx: number, field: keyof Servico, value: string) =>
    setConfig(p => ({ ...p, servicos: p.servicos?.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));

  const addPergunta = () => setConfig(p => ({ ...p, perguntas: [...(p.perguntas || []), { campo: '', label: '', obrigatorio: false }] }));
  const removePergunta = (idx: number) => setConfig(p => ({ ...p, perguntas: p.perguntas?.filter((_, i) => i !== idx) }));
  const updatePergunta = (idx: number, field: keyof Pergunta, value: any) =>
    setConfig(p => ({ ...p, perguntas: p.perguntas?.map((q, i) => i === idx ? { ...q, [field]: value } : q) }));

  const addDepoimento = () => setConfig(p => ({ ...p, depoimentos: [...(p.depoimentos || []), { nome: '', texto: '', estrelas: 5 }] }));
  const removeDepoimento = (idx: number) => setConfig(p => ({ ...p, depoimentos: p.depoimentos?.filter((_, i) => i !== idx) }));
  const updateDepoimento = (idx: number, field: keyof Depoimento, value: any) =>
    setConfig(p => ({ ...p, depoimentos: p.depoimentos?.map((d, i) => i === idx ? { ...d, [field]: value } : d) }));

  const addFaq = () => setConfig(p => ({ ...p, faq: [...(p.faq || []), { pergunta: '', resposta: '' }] }));
  const removeFaq = (idx: number) => setConfig(p => ({ ...p, faq: p.faq?.filter((_, i) => i !== idx) }));
  const updateFaq = (idx: number, field: keyof FaqItem, value: string) =>
    setConfig(p => ({ ...p, faq: p.faq?.map((f, i) => i === idx ? { ...f, [field]: value } : f) }));

  const updateSugestao = (idx: number, value: string) =>
    setConfig(p => ({ ...p, sugestoes_chat: (p.sugestoes_chat || []).map((s, i) => i === idx ? value : s) }));
  const addSugestao = () => setConfig(p => ({ ...p, sugestoes_chat: [...(p.sugestoes_chat || []), ''] }));
  const removeSugestao = (idx: number) => setConfig(p => ({ ...p, sugestoes_chat: (p.sugestoes_chat || []).filter((_, i) => i !== idx) }));

  const copyLink = () => { navigator.clipboard.writeText(captureUrl); toast.success('Link copiado!'); };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
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
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="aparencia" className="gap-1"><Palette className="h-3.5 w-3.5" /> Aparência</TabsTrigger>
          <TabsTrigger value="servicos" className="gap-1"><FileText className="h-3.5 w-3.5" /> Serviços</TabsTrigger>
          <TabsTrigger value="formulario" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> IA</TabsTrigger>
          <TabsTrigger value="depoimentos" className="gap-1"><Star className="h-3.5 w-3.5" /> Depoimentos</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1"><HelpCircle className="h-3.5 w-3.5" /> FAQ</TabsTrigger>
          <TabsTrigger value="conversao" className="gap-1"><Zap className="h-3.5 w-3.5" /> Conversão</TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Tracking</TabsTrigger>
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
                  <p className="text-xs text-muted-foreground">URL: wazecrm.lovable.app/captura/<strong>{slugValue}</strong></p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Logo da Empresa</Label>
                  <MediaUploadField value={config.logo_url} onChange={v => setConfig(p => ({ ...p, logo_url: v }))} accept="image" folder="logos" placeholder="URL ou faça upload do logo" />
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

              <div className="border-t pt-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">SEO & Compartilhamento (Open Graph)</h4>
                  <p className="text-xs text-muted-foreground mb-3">Como sua página aparece quando compartilhada no WhatsApp, Facebook, etc.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título de Compartilhamento</Label>
                    <Input value={config.og_titulo || ''} onChange={e => setConfig(p => ({ ...p, og_titulo: e.target.value }))} placeholder="Usa o título da página se vazio" />
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem de Compartilhamento</Label>
                    <MediaUploadField value={config.og_imagem_url} onChange={v => setConfig(p => ({ ...p, og_imagem_url: v }))} accept="image" folder="og" placeholder="1200x630 recomendado" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição de Compartilhamento</Label>
                  <Textarea value={config.og_descricao || ''} onChange={e => setConfig(p => ({ ...p, og_descricao: e.target.value }))} placeholder="Usa a descrição da página se vazio" rows={2} />
                </div>
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
                    <div>
                      <Label className="text-xs text-muted-foreground">Imagem ou vídeo do serviço</Label>
                      <MediaUploadField value={s.imagem_url} onChange={v => updateServico(i, 'imagem_url', v)} accept="both" folder="servicos" placeholder="URL ou upload (imagem/vídeo)" />
                    </div>
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
              <CardDescription>Defina as perguntas que o agente IA fará sequencialmente. Ao completar todas, o lead será criado automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.perguntas?.map((p, i) => (
                <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                  <span className="bg-primary/10 text-primary font-bold w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-1">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <Input value={p.label} onChange={e => updatePergunta(i, 'label', e.target.value)} placeholder="Pergunta que o agente fará" />
                    <div className="flex gap-3 items-center">
                      <Input value={p.campo} onChange={e => updatePergunta(i, 'campo', e.target.value)} placeholder="Nome do campo" className="flex-1" />
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

              <div className="border-t pt-4 space-y-2">
                <Label>Sugestões rápidas no chat</Label>
                <p className="text-xs text-muted-foreground">Botões clicáveis exibidos no início da conversa</p>
                {(config.sugestoes_chat || []).map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={s} onChange={e => updateSugestao(i, e.target.value)} placeholder="Ex: Quero um orçamento" />
                    <Button variant="ghost" size="icon" onClick={() => removeSugestao(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addSugestao} className="gap-2"><Plus className="h-3 w-3" /> Adicionar sugestão</Button>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>Tag Automática para Leads</Label>
                <Input value={config.tag_automatica || ''} onChange={e => setConfig(p => ({ ...p, tag_automatica: e.target.value }))} placeholder="pagina-captura" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Depoimentos */}
        <TabsContent value="depoimentos" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Depoimentos de Clientes</CardTitle>
              <CardDescription>Aumente a credibilidade exibindo avaliações reais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(config.depoimentos || []).map((d, i) => (
                <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="grid md:grid-cols-2 gap-2">
                      <Input value={d.nome} onChange={e => updateDepoimento(i, 'nome', e.target.value)} placeholder="Nome do cliente" />
                      <Input type="number" min={1} max={5} value={d.estrelas || 5} onChange={e => updateDepoimento(i, 'estrelas', parseInt(e.target.value) || 5)} placeholder="Estrelas (1-5)" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Foto do cliente (opcional)</Label>
                      <MediaUploadField value={d.foto_url} onChange={v => updateDepoimento(i, 'foto_url', v)} accept="image" folder="depoimentos" placeholder="URL ou upload da foto" />
                    </div>
                    <Textarea value={d.texto} onChange={e => updateDepoimento(i, 'texto', e.target.value)} placeholder="Depoimento do cliente..." rows={2} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeDepoimento(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={addDepoimento} className="w-full gap-2"><Plus className="h-4 w-4" /> Adicionar Depoimento</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Perguntas Frequentes</CardTitle>
              <CardDescription>Esclareça dúvidas comuns e reduza fricção na decisão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(config.faq || []).map((f, i) => (
                <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input value={f.pergunta} onChange={e => updateFaq(i, 'pergunta', e.target.value)} placeholder="Pergunta" />
                    <Textarea value={f.resposta} onChange={e => updateFaq(i, 'resposta', e.target.value)} placeholder="Resposta" rows={2} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFaq(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={addFaq} className="w-full gap-2"><Plus className="h-4 w-4" /> Adicionar Pergunta Frequente</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversão */}
        <TabsContent value="conversao" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Botão Flutuante de WhatsApp</CardTitle>
              <CardDescription>Botão sempre visível no canto da tela</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={config.whatsapp_flutuante_ativo || false} onCheckedChange={v => setConfig(p => ({ ...p, whatsapp_flutuante_ativo: v }))} />
                <Label>Exibir botão flutuante de WhatsApp</Label>
              </div>
              <div className="space-y-2">
                <Label>Mensagem inicial ao clicar</Label>
                <Input value={config.whatsapp_flutuante_mensagem || ''} onChange={e => setConfig(p => ({ ...p, whatsapp_flutuante_mensagem: e.target.value }))} placeholder="Olá! Vim pelo site..." />
                <p className="text-xs text-muted-foreground">Usa o número configurado em "Contato → WhatsApp"</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Barra de Urgência</CardTitle>
              <CardDescription>Banner no topo da página com promoção ou aviso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={config.urgencia_ativa || false} onCheckedChange={v => setConfig(p => ({ ...p, urgencia_ativa: v }))} />
                <Label>Exibir barra de urgência</Label>
              </div>
              <div className="space-y-2">
                <Label>Texto da barra</Label>
                <Input value={config.urgencia_texto || ''} onChange={e => setConfig(p => ({ ...p, urgencia_texto: e.target.value }))} placeholder="Oferta especial — válida só hoje!" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>UTM Tracking</CardTitle>
              <CardDescription>A página captura automaticamente parâmetros UTM da URL e salva no lead</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use links como <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{captureUrl}?utm_source=instagram&utm_campaign=promo-junho</code> para rastrear a origem dos seus leads. Os parâmetros suportados: <strong>utm_source, utm_medium, utm_campaign, utm_content, utm_term</strong>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking */}
        <TabsContent value="tracking" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pixels e Analytics</CardTitle>
              <CardDescription>Configure pixels de rastreamento para medir conversões em campanhas pagas. Os eventos <strong>PageView</strong> (visita) e <strong>Lead</strong> (conversão) são disparados automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Facebook Pixel ID</Label>
                <Input
                  value={config.facebook_pixel_id || ''}
                  onChange={e => setConfig(p => ({ ...p, facebook_pixel_id: e.target.value.trim() }))}
                  placeholder="Ex: 1234567890123456"
                />
                <p className="text-xs text-muted-foreground">Encontre em Gerenciador de Eventos do Meta Business → Fontes de Dados.</p>
              </div>

              <div className="space-y-2">
                <Label>Google Analytics ID (GA4)</Label>
                <Input
                  value={config.google_analytics_id || ''}
                  onChange={e => setConfig(p => ({ ...p, google_analytics_id: e.target.value.trim() }))}
                  placeholder="Ex: G-XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">Disparará evento <code className="bg-muted px-1 rounded">generate_lead</code> em cada conversão.</p>
              </div>

              <div className="space-y-2">
                <Label>Google Tag Manager ID</Label>
                <Input
                  value={config.google_tag_manager_id || ''}
                  onChange={e => setConfig(p => ({ ...p, google_tag_manager_id: e.target.value.trim() }))}
                  placeholder="Ex: GTM-XXXXXXX"
                />
                <p className="text-xs text-muted-foreground">Eventos no dataLayer: <code className="bg-muted px-1 rounded">lead_captured</code>.</p>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold text-sm">Google Ads — Conversão</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Conversion ID</Label>
                    <Input
                      value={config.google_ads_conversion_id || ''}
                      onChange={e => setConfig(p => ({ ...p, google_ads_conversion_id: e.target.value.trim() }))}
                      placeholder="AW-123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conversion Label</Label>
                    <Input
                      value={config.google_ads_conversion_label || ''}
                      onChange={e => setConfig(p => ({ ...p, google_ads_conversion_label: e.target.value.trim() }))}
                      placeholder="abcDEFghi123"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Em Google Ads → Ferramentas → Conversões → copie o "Tag de evento" (AW-XXX e Label).</p>
              </div>

              <div className="border-t pt-4 bg-primary/5 -mx-6 -mb-6 px-6 pb-6 mt-4 rounded-b-lg">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Como medir conversões</h4>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                  <li>Use links com UTM nas campanhas: <code className="bg-muted px-1 rounded">?utm_source=facebook&utm_campaign=promo</code></li>
                  <li>O lead criado já vem com origem e UTMs salvos — visíveis em <strong>Relatórios → Campanhas</strong>.</li>
                  <li>Pixel do Facebook permite criar públicos semelhantes e otimizar anúncios pelo evento <strong>Lead</strong>.</li>
                  <li>Google Ads usa a conversão para otimizar lances automáticos.</li>
                </ul>
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

      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving} size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </Button>
      </div>
    </div>
  );
}
