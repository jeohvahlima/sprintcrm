import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Tag, X, Plus, Paperclip, FileText, MapPin, Shield, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTagsManager } from "@/hooks/useTagsManager";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LeadAttachments } from "@/components/leads/LeadAttachments";
import { PacienteProntuarioSection } from "@/components/leads/PacienteProntuarioSection";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";

interface EditarLeadDialogProps {
  lead: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
    cpf?: string;
    value?: number;
    company?: string;
    company_id?: string;
    source?: string;
    notes?: string;
    tags?: string[];
    funil_id?: string;
    etapa_id?: string;
    data_nascimento?: string;
    // Endereço
    endereco_cep?: string;
    endereco_logradouro?: string;
    endereco_numero?: string;
    endereco_complemento?: string;
    endereco_bairro?: string;
    endereco_cidade?: string;
    endereco_estado?: string;
    // Gov.br
    govbr_login?: string;
    govbr_senha?: string;
  };
  onLeadUpdated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
}

export function EditarLeadDialog({ 
  lead, 
  onLeadUpdated,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  triggerButton
}: EditarLeadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = onOpenChangeProp || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [funis, setFunis] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [etapasFiltradas, setEtapasFiltradas] = useState<any[]>([]);
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const { allTags: tagsExistentes } = useTagsManager();
  const [formData, setFormData] = useState({
    nome: lead.nome || "",
    telefone: lead.telefone || "",
    email: lead.email || "",
    cpf: lead.cpf || "",
    valor: lead.value?.toString() || "",
    company: lead.company || "",
    source: lead.source || "",
    notes: lead.notes || "",
    funil_id: lead.funil_id || "",
    etapa_id: lead.etapa_id || "",
    responsavel_id: (lead as any).responsavel_id || "",
    tags: lead.tags || [],
    data_nascimento: lead.data_nascimento || "",
    // Endereço
    endereco_cep: lead.endereco_cep || "",
    endereco_logradouro: lead.endereco_logradouro || "",
    endereco_numero: lead.endereco_numero || "",
    endereco_complemento: lead.endereco_complemento || "",
    endereco_bairro: lead.endereco_bairro || "",
    endereco_cidade: lead.endereco_cidade || "",
    endereco_estado: lead.endereco_estado || "",
    // Gov.br
    govbr_login: lead.govbr_login || "",
    govbr_senha: lead.govbr_senha || ""
  });
  const [newTag, setNewTag] = useState("");
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachmentsCount, setAttachmentsCount] = useState(0);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Estado para controlar se deve resetar o formulário
  const [lastLeadId, setLastLeadId] = useState<string | null>(null);

  // Reset form data ONLY when:
  // 1. Dialog opens (open changes to true)
  // 2. Lead ID changes (different lead selected)
  // NOT when other lead properties change while dialog is open
  useEffect(() => {
    const shouldResetForm = !open || lead.id !== lastLeadId;
    
    if (shouldResetForm) {
      setFormData({
        nome: lead.nome || "",
        telefone: lead.telefone || "",
        email: lead.email || "",
        cpf: lead.cpf || "",
        valor: lead.value?.toString() || "",
        company: lead.company || "",
        source: lead.source || "",
        notes: lead.notes || "",
        funil_id: lead.funil_id || "",
        etapa_id: lead.etapa_id || "",
        responsavel_id: (lead as any).responsavel_id || "",
        tags: lead.tags || [],
        data_nascimento: lead.data_nascimento || "",
        endereco_cep: lead.endereco_cep || "",
        endereco_logradouro: lead.endereco_logradouro || "",
        endereco_numero: lead.endereco_numero || "",
        endereco_complemento: lead.endereco_complemento || "",
        endereco_bairro: lead.endereco_bairro || "",
        endereco_cidade: lead.endereco_cidade || "",
        endereco_estado: lead.endereco_estado || "",
        govbr_login: lead.govbr_login || "",
        govbr_senha: lead.govbr_senha || ""
      });
      setLastLeadId(lead.id);
    }
  }, [lead.id, open]);

  useEffect(() => {
    if (open) {
      carregarDados();
      fetchAttachmentsCount();
    }
  }, [open]);

  const fetchAttachmentsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('lead_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id);
      
      if (!error && count !== null) {
        setAttachmentsCount(count);
      }
    } catch (error) {
      console.error('Error fetching attachments count:', error);
    }
  };

  useEffect(() => {
    if (formData.funil_id) {
      const filtered = etapas.filter(e => e.funil_id === formData.funil_id);
      setEtapasFiltradas(filtered);
      if (filtered.length > 0 && !formData.etapa_id) {
        setFormData(prev => ({ ...prev, etapa_id: filtered[0].id }));
      }
    }
  }, [formData.funil_id, etapas]);

  const carregarDados = async () => {
    try {
      setInitialLoading(true);
      
      // Buscar company_id do lead ou do usuário atual
      let companyIdForData = lead.company_id;
      if (!companyIdForData) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: role } = await supabase
            .from('user_roles')
            .select('company_id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          companyIdForData = role?.company_id;
        }
      }

      if (!companyIdForData) {
        console.error('❌ [EditarLeadDialog] company_id não encontrado');
        toast.error("Empresa não encontrada");
        return;
      }

      console.log('📊 [EditarLeadDialog] Carregando funis para company_id:', companyIdForData);

      // Carregar funis e etapas FILTRADOS pelo company_id
      const { data: funisData, error: funisError } = await supabase
        .from("funis")
        .select("*")
        .eq("company_id", companyIdForData)
        .order("criado_em");
        
      const { data: etapasData, error: etapasError } = await supabase
        .from("etapas")
        .select("*")
        .eq("company_id", companyIdForData)
        .order("posicao");

      // Buscar usuários da empresa (responsáveis)
      let responsaveisList: any[] = [];
      if (companyIdForData) {
        const { data: responsaveisData } = await supabase
          .from("user_roles")
          .select("user_id, profiles(id, full_name, email)")
          .eq("company_id", companyIdForData);
        responsaveisList = responsaveisData?.map(r => ({
          id: r.user_id,
          name: (r.profiles as any)?.full_name || (r.profiles as any)?.email || "Sem nome"
        })) || [];
      }

      if (funisError) throw funisError;
      if (etapasError) throw etapasError;

      console.log('📊 [EditarLeadDialog] Funis carregados:', funisData?.length || 0);
      console.log('📍 [EditarLeadDialog] Etapas carregadas:', etapasData?.length || 0);

      setFunis(funisData || []);
      setEtapas(etapasData || []);
      setUserCompanyId(companyIdForData || null);
      setResponsaveis(responsaveisList);
    } catch (error) {
      console.error("Erro ao carregar dados do funil:", error);
      toast.error("Erro ao carregar dados do funil");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error("Digite o nome do lead");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("❌ Usuário não autenticado. Faça login e tente novamente.");
        setLoading(false);
        return;
      }

      // Formatar telefone
      let telefoneFormatado = formData.telefone;
      if (telefoneFormatado) {
        telefoneFormatado = telefoneFormatado.replace(/\D/g, "");
        if (!telefoneFormatado.startsWith("55")) {
          telefoneFormatado = "55" + telefoneFormatado;
        }
      }

      // 🔒 CRÍTICO: Preservar company_id para manter isolamento multi-tenant
      let companyId = lead.company_id;
      if (!companyId) {
        // Obter company_id do usuário atual se o lead não tiver
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        companyId = userRole?.company_id;
      }

      const { error } = await supabase
        .from("leads")
        .update({
          name: formData.nome,
          telefone: telefoneFormatado || null,
          phone: telefoneFormatado || null,
          email: formData.email || null,
          cpf: formData.cpf || null,
          value: formData.valor ? parseFloat(formData.valor) : 0,
          company: formData.company || null,
          company_id: companyId,
          source: formData.source || null,
          notes: formData.notes || null,
          etapa_id: formData.etapa_id || null,
          funil_id: formData.funil_id || null,
          responsavel_id: formData.responsavel_id || null,
          tags: formData.tags && formData.tags.length > 0 ? formData.tags : null,
          data_nascimento: formData.data_nascimento || null,
          endereco_cep: formData.endereco_cep || null,
          endereco_logradouro: formData.endereco_logradouro || null,
          endereco_numero: formData.endereco_numero || null,
          endereco_complemento: formData.endereco_complemento || null,
          endereco_bairro: formData.endereco_bairro || null,
          endereco_cidade: formData.endereco_cidade || null,
          endereco_estado: formData.endereco_estado || null,
          govbr_login: formData.govbr_login || null,
          govbr_senha: formData.govbr_senha || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", lead.id);

      if (error) {
        console.error("Erro ao atualizar lead:", error);
        throw error;
      }

      toast.success("✅ Lead atualizado com sucesso!");
      setOpen(false);
      onLeadUpdated();
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      toast.error("Erro ao atualizar lead. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton && (
        <DialogTrigger asChild>
          {triggerButton}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="funil">Funil (opcional)</Label>
            <Select 
              value={formData.funil_id} 
              onValueChange={(value) => setFormData({ ...formData, funil_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funil" />
              </SelectTrigger>
              <SelectContent>
                {funis.map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    {funil.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="etapa">Etapa (opcional)</Label>
            <Select 
              value={formData.etapa_id} 
              onValueChange={(value) => setFormData({ ...formData, etapa_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapasFiltradas.map((etapa) => (
                  <SelectItem key={etapa.id} value={etapa.id}>
                    {etapa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="responsavel">Responsável</Label>
            <Select 
              value={formData.responsavel_id} 
              onValueChange={(value) => setFormData({ ...formData, responsavel_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum responsável selecionado" />
              </SelectTrigger>
              <SelectContent>
                {responsaveis.map((resp) => (
                  <SelectItem key={resp.id} value={resp.id}>
                    {resp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome do lead"
              required
            />
          </div>

          <div>
            <Label htmlFor="telefone">Telefone / WhatsApp</Label>
            <Input
              id="telefone"
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <Label htmlFor="data_nascimento">Data de Nascimento</Label>
            <Input
              id="data_nascimento"
              type="date"
              value={formData.data_nascimento}
              onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="source">Origem</Label>
            <Input
              id="source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="Ex: WhatsApp, Instagram, Indicação"
            />
          </div>

          {/* Seção de Endereço */}
          <div className="bg-muted/30 border border-border/50 rounded-lg p-3 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="CEP" value={formData.endereco_cep} onChange={(e) => setFormData({ ...formData, endereco_cep: e.target.value })} className="h-8 text-sm" />
              <Input placeholder="UF" value={formData.endereco_estado} onChange={(e) => setFormData({ ...formData, endereco_estado: e.target.value })} maxLength={2} className="h-8 text-sm" />
            </div>
            <Input placeholder="Logradouro" value={formData.endereco_logradouro} onChange={(e) => setFormData({ ...formData, endereco_logradouro: e.target.value })} className="h-8 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Número" value={formData.endereco_numero} onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })} className="h-8 text-sm" />
              <Input placeholder="Complemento" value={formData.endereco_complemento} onChange={(e) => setFormData({ ...formData, endereco_complemento: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Bairro" value={formData.endereco_bairro} onChange={(e) => setFormData({ ...formData, endereco_bairro: e.target.value })} className="h-8 text-sm" />
              <Input placeholder="Cidade" value={formData.endereco_cidade} onChange={(e) => setFormData({ ...formData, endereco_cidade: e.target.value })} className="h-8 text-sm" />
            </div>
          </div>

          {/* Seção Gov.br */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Acesso Gov.br
            </h3>
            <Input placeholder="Login (CPF ou Email)" value={formData.govbr_login} onChange={(e) => setFormData({ ...formData, govbr_login: e.target.value })} className="h-8 text-sm" />
            <Input placeholder="Senha de acesso" value={formData.govbr_senha} onChange={(e) => setFormData({ ...formData, govbr_senha: e.target.value })} className="h-8 text-sm font-mono" />
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Informações adicionais sobre o lead"
            />
          </div>

          <div>
            <Label>Tags</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="flex-1 justify-start">
                      <Tag className="h-4 w-4 mr-2" />
                      {tagsExistentes.length > 0 ? "Selecionar tag existente" : "Sem tags existentes"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar tag..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                        <CommandGroup>
                          {tagsExistentes.map((tag) => (
                            <CommandItem
                              key={tag}
                              value={tag}
                              onSelect={() => {
                                if (!formData.tags.includes(tag)) {
                                  setFormData({ ...formData, tags: [...formData.tags, tag] });
                                }
                                setTagsPopoverOpen(false);
                              }}
                            >
                              <Tag className="h-4 w-4 mr-2" />
                              {tag}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const tagTrimmed = newTag.trim();
                      if (tagTrimmed && !formData.tags.includes(tagTrimmed)) {
                        setFormData({ ...formData, tags: [...formData.tags, tagTrimmed] });
                        setNewTag("");
                      }
                    }
                  }}
                  placeholder="Nova tag (Enter para adicionar)"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={() => {
                    const tagTrimmed = newTag.trim();
                    if (tagTrimmed && !formData.tags.includes(tagTrimmed)) {
                      setFormData({ ...formData, tags: [...formData.tags, tagTrimmed] });
                      setNewTag("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[60px] p-2 border rounded-md bg-muted/20">
                {formData.tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma tag adicionada</p>
                ) : (
                  formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      <Tag className="h-3 w-3" />
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => {
                          setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Ficha Técnica / Arquivos */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Ficha Técnica</span>
                {attachmentsCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {attachmentsCount} arquivo{attachmentsCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAttachmentsOpen(true)}
              >
                <FileText className="h-4 w-4 mr-1" />
                {attachmentsCount > 0 ? 'Ver Arquivos' : 'Adicionar Arquivos'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fotos de antes/depois, exames, laudos e documentos
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
          </form>
        )}
      </DialogContent>

      {/* Lead Attachments Modal */}
      {userCompanyId && (
        <LeadAttachments
          open={attachmentsOpen}
          onOpenChange={setAttachmentsOpen}
          leadId={lead.id}
          companyId={userCompanyId}
          leadName={lead.nome}
        />
      )}
    </Dialog>
  );
}