import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Send, 
  Users, 
  MessageSquare, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Search,
  X,
  Image,
  Video,
  FileText,
  Upload,
  Clock,
  Pause,
  LayoutTemplate,
  StopCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadMediaToStorage } from "@/utils/uploadMediaToStorage";
import { robustFormatPhoneNumber } from "@/utils/phoneFormatter";
import { TemplateSelector, Template } from "./TemplateSelector";
import { buildTemplateComponents as buildTemplateComponentsHelper, buildTemplateTextContent as buildTemplateTextContentHelper } from "@/utils/templateHelpers";

interface Lead {
  id: string;
  name: string;
  telefone: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  tags: string[] | null;
  segmentacao: string | null;
  last_disparo_at: string | null;
  last_disparo_campaign: string | null;
  disparo_count: number | null;
}

export function DisparoEmMassa() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedSegmentacao, setSelectedSegmentacao] = useState<string>("all");
  const [disparoFilter, setDisparoFilter] = useState<string>("all"); // all | never | older_30 | older_7
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSegmentacoes, setAvailableSegmentacoes] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ sent: number; total: number; errors: number; paused?: boolean } | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  // Configurações de mídia e timing
  const [messageType, setMessageType] = useState<"text" | "image" | "video" | "template">("text");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [delayBetweenMessages, setDelayBetweenMessages] = useState<number>(7); // segundos
  const [pauseAfterMessages, setPauseAfterMessages] = useState<number>(15); // quantidade
  const [pauseDuration, setPauseDuration] = useState<number>(120); // segundos (2 minutos)
  const [campanhaNome, setCampanhaNome] = useState<string>("");
  const [markAsProspect, setMarkAsProspect] = useState<boolean>(true);
  
  // Estados para templates
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templateMediaUrl, setTemplateMediaUrl] = useState<string>("");

  // Carregar company_id e leads
  useEffect(() => {
    loadCompanyIdAndLeads();
  }, []);

  // Filtrar leads quando filtros mudarem
  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, selectedStatus, selectedTag, selectedSegmentacao, disparoFilter]);

  // Check for active campaigns on mount
  useEffect(() => {
    if (!companyId) return;
    const checkActive = async () => {
      const { data } = await supabase
        .from('disparo_campaigns')
        .select('id, status, sent_count, total_leads, error_count, is_paused')
        .eq('company_id', companyId)
        .in('status', ['sending', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const c = data[0];
        setActiveCampaignId(c.id);
        setSending(true);
        setProgress({ sent: c.sent_count, total: c.total_leads, errors: c.error_count, paused: c.is_paused });
      }
    };
    checkActive();
  }, [companyId]);

  // Realtime subscription for campaign progress
  useEffect(() => {
    if (!activeCampaignId) return;
    const channel = supabase
      .channel(`campaign-${activeCampaignId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'disparo_campaigns',
        filter: `id=eq.${activeCampaignId}`,
      }, (payload: any) => {
        const row = payload.new;
        if (row.status === 'completed' || row.status === 'cancelled') {
          setSending(false);
          setProgress(null);
          setActiveCampaignId(null);
          if (row.status === 'completed') {
            if (row.error_count === 0) {
              toast.success(`${row.sent_count} mensagens enviadas com sucesso!`);
            } else {
              toast.warning(`${row.sent_count} enviadas, ${row.error_count} com erro`);
            }
          } else {
            toast.info('Campanha cancelada');
          }
          setSelectedLeads(new Set());
          setMessage("");
          setMediaFile(null);
          setMediaPreview(null);
          setMessageType("text");
          setCampanhaNome("");
        } else {
          setProgress({ sent: row.sent_count, total: row.total_leads, errors: row.error_count, paused: row.is_paused });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCampaignId]);

  const loadCompanyIdAndLeads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        toast.error("Sua conta não está vinculada a uma empresa");
        return;
      }

      setCompanyId(userRole.company_id);
      await loadLeads(userRole.company_id);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    }
  };

  const loadLeads = async (companyId: string) => {
    setLoading(true);
    try {
      let allLeads: any[] = [];
      let hasMore = true;
      let page = 0;
      const PAGE_SIZE = 1000;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: batch, error } = await supabase
          .from("leads")
          .select("id, name, telefone, phone, email, status, tags, segmentacao, last_disparo_at, last_disparo_campaign, disparo_count")
          .eq("company_id", companyId)
          .or("telefone.not.is.null,phone.not.is.null")
          .range(from, to);

        if (error) throw error;

        if (batch && batch.length > 0) {
          allLeads = [...allLeads, ...batch];
          hasMore = batch.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      const leadsWithPhone = allLeads.filter(
        (lead) => lead.telefone || lead.phone
      ) as Lead[];

      setLeads(leadsWithPhone);

      // Extrair tags e segmentações únicas
      const tagsSet = new Set<string>();
      const segmentacoesSet = new Set<string>();

      leadsWithPhone.forEach((lead) => {
        if (lead.tags && Array.isArray(lead.tags)) {
          lead.tags.forEach((tag) => tagsSet.add(tag));
        }
        if (lead.segmentacao) {
          segmentacoesSet.add(lead.segmentacao);
        }
      });

      setAvailableTags(Array.from(tagsSet).sort());
      setAvailableSegmentacoes(Array.from(segmentacoesSet).sort());
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // Filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.telefone?.includes(term) ||
          lead.phone?.includes(term)
      );
    }

    // Filtro de status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((lead) => lead.status === selectedStatus);
    }

    // Filtro de tag
    if (selectedTag !== "all") {
      filtered = filtered.filter(
        (lead) => lead.tags && lead.tags.includes(selectedTag)
      );
    }

    // Filtro de segmentação
    if (selectedSegmentacao !== "all") {
      filtered = filtered.filter(
        (lead) => lead.segmentacao === selectedSegmentacao
      );
    }

    // Filtro por histórico de disparo
    if (disparoFilter !== "all") {
      const now = Date.now();
      filtered = filtered.filter((lead) => {
        const last = lead.last_disparo_at ? new Date(lead.last_disparo_at).getTime() : null;
        if (disparoFilter === "never") return !last;
        if (disparoFilter === "received") return !!last;
        if (disparoFilter === "older_7") return !last || (now - last) > 7 * 86400000;
        if (disparoFilter === "older_30") return !last || (now - last) > 30 * 86400000;
        return true;
      });
    }

    setFilteredLeads(filtered);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const getSelectedLeadsData = () => {
    // Use 'leads' (full list) instead of 'filteredLeads' to avoid stale closure issues
    return leads.filter((lead) => selectedLeads.has(lead.id));
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const fileType = file.type;
    if (fileType.startsWith("image/")) {
      setMessageType("image");
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (fileType.startsWith("video/")) {
      setMessageType("video");
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("Tipo de arquivo não suportado. Use imagem ou vídeo.");
      return;
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMessageType("text");
  };

  const convertFileToBase64 = (file: File): Promise<{ base64: string; mimeType: string; fileName: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        // Remover o prefixo "data:image/...;base64," ou "data:video/...;base64,"
        const base64 = base64String.split(',')[1] || base64String;
        resolve({
          base64,
          mimeType: file.type,
          fileName: file.name
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Wrapper functions using shared helpers
  const buildTemplateComponents = (template: Template, lead: Lead): any[] => {
    return buildTemplateComponentsHelper(template, lead, templateVariables, templateMediaUrl);
  };

  const buildTemplateTextContent = (template: Template, lead: Lead): string => {
    return buildTemplateTextContentHelper(template, lead, templateVariables);
  };

  const handleDisparo = async () => {
    // Validações
    if (!campanhaNome.trim()) {
      toast.error("Digite um nome para a campanha");
      return;
    }

    if (messageType === "text" && !message.trim()) {
      toast.error("Digite uma mensagem para enviar");
      return;
    }

    if (messageType === "template" && !selectedTemplate) {
      toast.error("Selecione um template para enviar");
      return;
    }

    if ((messageType === "image" || messageType === "video") && !mediaFile) {
      toast.error("Selecione um arquivo de mídia");
      return;
    }

    // Validar URL de mídia para templates com header de vídeo/imagem
    if (messageType === "template" && selectedTemplate) {
      const headerComponent = selectedTemplate.components?.find((c: any) => c.type === "HEADER");
      if (headerComponent?.format && headerComponent.format !== "TEXT") {
        const hasHandle = headerComponent.example?.header_handle?.[0];
        if (!hasHandle && !templateMediaUrl) {
          toast.error(`Este template requer uma URL de ${headerComponent.format === "VIDEO" ? "vídeo" : headerComponent.format === "IMAGE" ? "imagem" : "documento"} no cabeçalho`);
          return;
        }
      }
    }

    const leadsToSend = getSelectedLeadsData();
    if (leadsToSend.length === 0) {
      toast.error("Selecione pelo menos um lead");
      return;
    }

    if (!companyId) {
      toast.error("Company ID não encontrado");
      return;
    }

    setSending(true);
    setProgress({ sent: 0, total: leadsToSend.length, errors: 0, paused: false });

    const campaignId = `campanha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Upload media if needed
    let mediaStorageUrl: string | null = null;
    if (mediaFile) {
      try {
        mediaStorageUrl = await uploadMediaToStorage(mediaFile, companyId);
      } catch (error) {
        toast.error("Erro ao processar arquivo de mídia");
        setSending(false);
        setProgress(null);
        return;
      }
    }

    // Build template components if needed
    let templateComps = null;
    if (messageType === "template" && selectedTemplate) {
      // Use first lead as reference for component structure
      templateComps = buildTemplateComponents(selectedTemplate, leadsToSend[0]);
    }

    // Create campaign record in database
    const { error: insertError } = await supabase.from('disparo_campaigns').insert({
      id: campaignId,
      company_id: companyId,
      campaign_name: campanhaNome.trim(),
      status: 'pending',
      total_leads: leadsToSend.length,
      message_type: messageType,
      message_content: message || null,
      template_name: selectedTemplate?.name || null,
      template_language: selectedTemplate?.language || null,
      template_components: templateComps,
      template_media_url: templateMediaUrl || null,
      media_storage_url: mediaStorageUrl,
      delay_between_messages: delayBetweenMessages,
      pause_after_messages: pauseAfterMessages,
      pause_duration: pauseDuration,
      leads_data: leadsToSend.map(l => ({
        id: l.id,
        name: l.name,
        telefone: l.telefone,
        phone: l.phone,
        email: l.email,
      })),
    });

    if (insertError) {
      console.error('Erro ao criar campanha:', insertError);
      toast.error("Erro ao iniciar campanha");
      setSending(false);
      setProgress(null);
      return;
    }

    setActiveCampaignId(campaignId);

    // Marcar leads como "para prospectar" se a opção estiver ativa
    if (markAsProspect && leadsToSend.length > 0) {
      try {
        const ids = leadsToSend.map((l) => l.id);
        await supabase
          .from('leads')
          .update({
            to_prospect: true,
            prospecting_priority: 1,
          } as any)
          .in('id', ids);
      } catch (err) {
        console.warn('Falha ao marcar leads para prospecção:', err);
      }
    }

    // Fire and forget - edge function processes in background
    supabase.functions.invoke('disparo-em-massa', {
      body: { campaign_id: campaignId },
    }).then(({ error }) => {
      if (error) {
        console.error('Erro ao chamar disparo-em-massa:', error);
        toast.error("Erro ao processar disparo. Verifique o progresso.");
      }
    });

    toast.success("Disparo iniciado! Você pode sair desta página — o envio continuará no servidor.");
  };

  const handleCancelCampaign = async () => {
    if (!activeCampaignId) return;
    try {
      const { error } = await supabase
        .from('disparo_campaigns')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', activeCampaignId);
      if (error) throw error;
      toast.success('Disparo cancelado com sucesso!');
      setSending(false);
      setActiveCampaignId(null);
    } catch (err: any) {
      console.error('Erro ao cancelar campanha:', err);
      toast.error('Erro ao cancelar campanha');
    }
  };

  const selectedCount = selectedLeads.size;
  const totalFiltered = filteredLeads.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Disparo em Massa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Label className="font-semibold">Filtros de Seleção</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Busca */}
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, email, telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="em_contato">Em Contato</SelectItem>
                    <SelectItem value="qualificado">Qualificado</SelectItem>
                    <SelectItem value="negociacao">Negociação</SelectItem>
                    <SelectItem value="ganho">Ganho</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tag</Label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Segmentação */}
              <div className="space-y-2">
                <Label>Segmentação</Label>
                <Select
                  value={selectedSegmentacao}
                  onValueChange={setSelectedSegmentacao}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableSegmentacoes.map((seg) => (
                      <SelectItem key={seg} value={seg}>
                        {seg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Histórico de Disparo */}
              <div className="space-y-2">
                <Label>Histórico de disparo</Label>
                <Select value={disparoFilter} onValueChange={setDisparoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="never">Nunca recebeu disparo</SelectItem>
                    <SelectItem value="received">Já recebeu disparo</SelectItem>
                    <SelectItem value="older_7">Sem disparo há +7 dias</SelectItem>
                    <SelectItem value="older_30">Sem disparo há +30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {totalFiltered} lead{totalFiltered !== 1 ? "s" : ""} encontrado
                    {totalFiltered !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">
                    {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={totalFiltered === 0}
              >
                {selectedLeads.size === totalFiltered ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>
          </div>

          {/* Lista de Leads */}
          <div className="space-y-2">
            <Label className="font-semibold">Selecionar Leads</Label>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Carregando leads...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum lead encontrado com os filtros selecionados
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{lead.name || "Sem nome"}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {lead.telefone || lead.phone || "Sem telefone"}
                        </div>
                        {lead.last_disparo_at ? (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                            Último disparo: {new Date(lead.last_disparo_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            {lead.last_disparo_campaign ? ` · ${lead.last_disparo_campaign}` : ""}
                            {lead.disparo_count && lead.disparo_count > 1 ? ` (${lead.disparo_count}x)` : ""}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground/70 mt-0.5">Nunca recebeu disparo</div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {lead.tags && lead.tags.length > 0 && (
                          <div className="flex gap-1">
                            {lead.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {lead.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nome da Campanha */}
          <div className="space-y-2">
            <Label className="font-semibold">Nome da Campanha *</Label>
            <Input
              placeholder="Ex: Promoção Black Friday 2024"
              value={campanhaNome}
              onChange={(e) => setCampanhaNome(e.target.value)}
              disabled={sending}
              required
            />
            <p className="text-xs text-muted-foreground">
              Dê um nome descritivo para identificar esta campanha nos relatórios
            </p>
            <div className="flex items-start gap-2 pt-2 p-3 rounded-md border border-border bg-muted/30">
              <Checkbox
                id="mark-prospect"
                checked={markAsProspect}
                onCheckedChange={(c) => setMarkAsProspect(!!c)}
                disabled={sending}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="mark-prospect" className="font-medium cursor-pointer text-sm">
                  🎯 Marcar leads selecionados para prospecção
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adiciona automaticamente todos os leads desta campanha à fila de prospecção (canal WhatsApp) — eles aparecerão no módulo Prospecção.
                </p>
              </div>
            </div>
          </div>

          {/* Configurações de Timing */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Configurações de Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Delay entre mensagens (segundos)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={delayBetweenMessages}
                    onChange={(e) => setDelayBetweenMessages(Number(e.target.value) || 7)}
                    disabled={sending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recomendado: 5-10 segundos
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Pausar após (mensagens)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={pauseAfterMessages}
                    onChange={(e) => setPauseAfterMessages(Number(e.target.value) || 0)}
                    disabled={sending}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = sem pausa automática
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Duração da pausa (segundos)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="600"
                    value={pauseDuration}
                    onChange={(e) => setPauseDuration(Number(e.target.value) || 120)}
                    disabled={sending || pauseAfterMessages === 0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: 120 = 2 minutos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editor de Mensagem */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Mensagem da Campanha
              </Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={messageType === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("text");
                    setMediaFile(null);
                    setMediaPreview(null);
                    setSelectedTemplate(null);
                  }}
                  disabled={sending}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Texto
                </Button>
                <Button
                  type="button"
                  variant={messageType === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("image");
                    setSelectedTemplate(null);
                    if (!mediaFile) {
                      document.getElementById("media-upload")?.click();
                    }
                  }}
                  disabled={sending}
                >
                  <Image className="h-4 w-4 mr-1" />
                  Imagem
                </Button>
                <Button
                  type="button"
                  variant={messageType === "video" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("video");
                    setSelectedTemplate(null);
                    if (!mediaFile) {
                      document.getElementById("media-upload")?.click();
                    }
                  }}
                  disabled={sending}
                >
                  <Video className="h-4 w-4 mr-1" />
                  Vídeo
                </Button>
                <Button
                  type="button"
                  variant={messageType === "template" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("template");
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                  disabled={sending}
                  className="border-primary/50"
                >
                  <LayoutTemplate className="h-4 w-4 mr-1" />
                  Template
                  <Badge variant="secondary" className="ml-1 text-xs">Meta</Badge>
                </Button>
              </div>
            </div>

            {/* Seletor de Template */}
            {messageType === "template" && companyId && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4">
                  <TemplateSelector
                    companyId={companyId}
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={(template) => {
                      setSelectedTemplate(template);
                      // Limpar URL de mídia quando trocar template
                      setTemplateMediaUrl("");
                    }}
                    templateVariables={templateVariables}
                    onVariablesChange={setTemplateVariables}
                    mediaUrl={templateMediaUrl}
                    onMediaUrlChange={setTemplateMediaUrl}
                    disabled={sending}
                  />
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Templates Meta API:</strong> Mensagens com templates são enviadas via API oficial do WhatsApp 
                      e funcionam mesmo para contatos fora da janela de 24 horas.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Upload de Mídia */}
            {(messageType === "image" || messageType === "video") && (
              <div className="space-y-2">
                <Label>Arquivo de {messageType === "image" ? "Imagem" : "Vídeo"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="media-upload"
                    type="file"
                    accept={messageType === "image" ? "image/*" : "video/*"}
                    onChange={handleMediaChange}
                    className="hidden"
                    disabled={sending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("media-upload")?.click()}
                    disabled={sending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {mediaFile ? "Trocar Arquivo" : "Selecionar Arquivo"}
                  </Button>
                  {mediaFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeMedia}
                      disabled={sending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {mediaPreview && (
                  <div className="mt-2">
                    {messageType === "image" ? (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="max-w-full max-h-64 rounded-lg border"
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        controls
                        className="max-w-full max-h-64 rounded-lg border"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Editor de Texto - Ocultar quando usando template */}
            {messageType !== "template" && (
              <>
                <Textarea
                  placeholder={
                    messageType === "text"
                      ? "Digite a mensagem que será enviada para todos os leads selecionados..."
                      : messageType === "image"
                      ? "Digite a legenda da imagem (opcional)..."
                      : "Digite a legenda do vídeo (opcional)..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="resize-none"
                  disabled={sending}
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{message.length} caracteres</span>
                  <span>
                    {selectedCount > 0
                      ? `${selectedCount} destinatário${selectedCount !== 1 ? "s" : ""}`
                      : "Selecione leads para enviar"}
                  </span>
                </div>
              </>
            )}

            {/* Info para template */}
            {messageType === "template" && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {selectedTemplate 
                    ? `Template selecionado: ${selectedTemplate.name}` 
                    : "Nenhum template selecionado"}
                </span>
                <span>
                  {selectedCount > 0
                    ? `${selectedCount} destinatário${selectedCount !== 1 ? "s" : ""}`
                    : "Selecione leads para enviar"}
                </span>
              </div>
            )}
          </div>

          {/* Preview */}
          {((message || mediaFile || selectedTemplate) && selectedCount > 0) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Preview:</strong> {messageType === "template" ? "Este template" : messageType === "text" ? "Esta mensagem" : messageType === "image" ? "Esta imagem" : "Este vídeo"} será enviado para{" "}
                <strong>{selectedCount}</strong> lead{selectedCount !== 1 ? "s" : ""}.
                {messageType === "text" && message && (
                  <div className="mt-2 p-3 bg-muted rounded border-l-2 border-primary">
                    {message}
                  </div>
                )}
                {messageType === "template" && selectedTemplate && (
                  <div className="mt-2 p-3 bg-muted rounded border-l-2 border-primary">
                    <div className="flex items-center gap-2 mb-1">
                      <LayoutTemplate className="h-4 w-4" />
                      <strong>{selectedTemplate.name}</strong>
                      <Badge variant="outline" className="text-xs">{selectedTemplate.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Idioma: {selectedTemplate.language} | Variáveis serão substituídas com dados de cada lead
                    </p>
                  </div>
                )}
                {(messageType === "image" || messageType === "video") && mediaPreview && (
                  <div className="mt-2">
                    {messageType === "image" ? (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="max-w-full max-h-48 rounded-lg border"
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        controls
                        className="max-w-full max-h-48 rounded-lg border"
                      />
                    )}
                    {message && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        {message}
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Progresso */}
          {progress && (
            <Alert>
              {progress.paused ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <AlertDescription>
                <strong>
                  {progress.paused ? "Pausa automática..." : "Enviando mensagens..."}
                </strong>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>
                      {progress.sent} de {progress.total}
                    </span>
                    <span>
                      {progress.errors > 0 && (
                        <span className="text-destructive">
                          {progress.errors} erro{progress.errors !== 1 ? "s" : ""}
                        </span>
                      )}
                      {progress.paused && (
                        <span className="text-yellow-600 ml-2">
                          Pausado por {pauseDuration}s
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        progress.paused ? "bg-yellow-500" : "bg-primary"
                      }`}
                      style={{
                        width: `${(progress.sent / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelCampaign}
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Cancelar Disparo
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Botão de Envio */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedLeads(new Set());
                setMessage("");
                setMediaFile(null);
                setMediaPreview(null);
                setMessageType("text");
                setCampanhaNome("");
                setSearchTerm("");
                setSelectedStatus("all");
                setSelectedTag("all");
                setSelectedSegmentacao("all");
                setSelectedTemplate(null);
                setTemplateVariables({});
              }}
              disabled={sending}
            >
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button
              onClick={handleDisparo}
              disabled={
                sending ||
                !campanhaNome.trim() ||
                (messageType === "text" && !message.trim()) ||
                (messageType === "template" && !selectedTemplate) ||
                ((messageType === "image" || messageType === "video") && !mediaFile) ||
                selectedCount === 0 ||
                !companyId
              }
              className="min-w-[150px]"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para {selectedCount > 0 ? selectedCount : ""} Lead
                  {selectedCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
