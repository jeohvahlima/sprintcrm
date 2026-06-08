import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Send, MessageSquare, Info, User, DollarSign, Tag, 
  TrendingUp, Zap, Clock, MoreVertical, Edit, Trash2, Save,
  Bot, Bell, Calendar, CheckCircle, ArrowRightLeft, FileText, Paperclip
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadMediaToStorage } from "@/utils/uploadMediaToStorage";
import { toast } from "sonner";
import { safeFormatPhoneNumber } from "@/utils/phoneFormatter";
import { AudioRecorder } from "@/components/conversas/AudioRecorder";
import { MediaUpload } from "@/components/conversas/MediaUpload";
import { MessageItem } from "@/components/conversas/MessageItem";
import { EditarInformacoesLeadDialog } from "@/components/conversas/EditarInformacoesLeadDialog";
import { ResponsaveisManager } from "@/components/conversas/ResponsaveisManager";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogTrigger as UIDialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditarLeadDialog } from "@/components/funil/EditarLeadDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTagsManager } from "@/hooks/useTagsManager";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { LeadAttachments } from "@/components/leads/LeadAttachments";
import { SaveToMedicalRecordDialog } from "@/components/leads/SaveToMedicalRecordDialog";

interface ConversaPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone?: string;
}

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  status?: string;
  origem?: string;
  sentBy?: string; // Nome do usuário que enviou a mensagem
}

export function ConversaPopup({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
}: ConversaPopupProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [leadVinculado, setLeadVinculado] = useState<any>(null);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [tarefaOpen, setTarefaOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [scheduledContent, setScheduledContent] = useState("");
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [scheduledList, setScheduledList] = useState<any[]>([]);
  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [valorVendaOpen, setValorVendaOpen] = useState(false);
  const [valorVendaInput, setValorVendaInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  // ⚡ CORREÇÃO: Mensagens rápidas agora carregadas do banco de dados
  const [quickMessages, setQuickMessages] = useState<Array<{ id: string; title: string; content: string; category: string }>>([]);
  const [quickCategories, setQuickCategories] = useState<Array<{ id: string; name: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // ✅ NOVO: Estado para Tags e Funis
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  const [funis, setFunis] = useState<Array<{ id: string; nome: string; etapas: Array<{ id: string; nome: string }> }>>([]);
  const [loadingFunis, setLoadingFunis] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string>(""); // Nome do usuário logado
  
  // ✅ NOVO: Estados para Prontuário/Anexos
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [saveToRecordOpen, setSaveToRecordOpen] = useState(false);
  const [saveToRecordData, setSaveToRecordData] = useState<{
    mediaUrl: string;
    fileName: string;
    messageType: string;
  } | null>(null);
  const [attachmentsCount, setAttachmentsCount] = useState(0);
  
  // ✅ NOVO: Hook de tags sincronizado com gerenciador
  const { allTags: tagsExistentes, refreshTags, addTagToLead, removeTagFromLead } = useTagsManager();

  // Cache simples de avatar por sessão do componente
  const avatarCacheRef = useRef<Map<string, string>>(new Map());
  const inflightAvatarRef = useRef<Map<string, Promise<string | undefined>>>(new Map());

  // Global events para sincronizar com Leads/Conversas
  const { emitGlobalEvent } = useGlobalSync({ showNotifications: false });

  // Função para obter company_id
  const getCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    
    return userRole?.company_id || null;
  };

  // Função para enviar WhatsApp
  const enviarWhatsApp = async (body: any) => {
    const companyId = await getCompanyId();
    return await supabase.functions.invoke("enviar-whatsapp", {
      body: { company_id: companyId, ...body },
    });
  };

  // Disparar processamento de mensagens agendadas (best-effort)
  const processarMensagensAgendadas = async () => {
    try {
      await supabase.functions.invoke('processar-mensagens-agendadas', {
        body: {},
      });
    } catch (err) {
      // não bloquear UX por falha nesse disparo
      console.warn('Falha ao disparar processamento de agendadas (ignorado):', err);
    }
  };

  // Normaliza número para padrão BR com DDI 55 e somente dígitos
  const normalizePhoneBR = (raw?: string): string | null => {
    if (!raw) return null;
    let n = String(raw).replace(/\D/g, "");
    if (n.startsWith("55")) return n;
    // Se vier local (10/11 dígitos), prefixar 55
    if (n.length === 10 || n.length === 11) return "55" + n;
    // Se vier com 12/13 mas sem 55 (raro), ainda prefixar 55 como fallback
    if (n.length >= 8 && n.length <= 13) return n.startsWith("55") ? n : "55" + n;
    // Último recurso: prefixar 55
    return "55" + n;
  };

  const getAvatarWithCache = async (number: string, companyId: string | null, nameForPlaceholder: string): Promise<string | undefined> => {
    if (!number) return undefined;
    if (/@g\.us$/.test(String(number))) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForPlaceholder || 'Grupo')}&background=10b981&color=fff`;
    }
    const normalized = normalizePhoneBR(number)!;
    const key = `${companyId || 'no-company'}:${normalized}`;
    const cached = avatarCacheRef.current.get(key);
    if (cached) return cached;
    const inflight = inflightAvatarRef.current.get(key);
    if (inflight) return await inflight;

    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-profile-picture', {
          body: { number: normalized, company_id: companyId }
        });
        const url = (!error && data?.profilePictureUrl)
          ? data.profilePictureUrl
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForPlaceholder || normalized)}&background=10b981&color=fff`;
        avatarCacheRef.current.set(key, url);
        inflightAvatarRef.current.delete(key);
        return url;
      } catch {
        const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForPlaceholder || normalized)}&background=10b981&color=fff`;
        avatarCacheRef.current.set(key, url);
        inflightAvatarRef.current.delete(key);
        return url;
      }
    })();
    inflightAvatarRef.current.set(key, promise);
    return await promise;
  };

  // Carregar mensagens agendadas
  const carregarMensagensAgendadas = async () => {
    if (!leadPhone) return;
    const numero = String(leadPhone || "").replace(/\D/g, "");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!userRole?.company_id) return;
      const { data } = await supabase
        .from('scheduled_whatsapp_messages')
        .select('*')
        .eq('company_id', userRole.company_id)
        .eq('phone_number', numero)
        .order('scheduled_datetime');
      setScheduledList(data || []);
    } catch (err) {
      console.error('Erro ao carregar mensagens agendadas:', err);
    }
  };

  // Carregar dados do lead
  const carregarLead = async () => {
    if (!leadId) return;
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar lead:", error);
        return;
      }

      if (data) {
        setLeadVinculado(data);
      }
    } catch (error) {
      console.error("Erro ao carregar lead:", error);
    }
  };

  // Carregar histórico de mensagens
  const carregarMensagens = async () => {
    if (!leadPhone) return;

    setLoading(true);
    try {
      // Normalizar número de telefone
      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;
      const companyId = await getCompanyId();

      // Compatibilidade: considerar possíveis formatos de armazenamento do número
      const jidSNet = `${telefoneNormalizado}@s.whatsapp.net`;
      const jidCUs = `${telefoneNormalizado}@c.us`;

      const { data, error } = await supabase
        .from("conversas")
        .select("*")
        .eq("company_id", companyId)
        .or([
          `telefone_formatado.eq.${telefoneNormalizado}`,
          `numero.eq.${telefoneNormalizado}`,
          `numero.eq.${jidSNet}`,
          `numero.eq.${jidCUs}`
        ].join(","))
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao carregar mensagens:", error);
        return;
      }

      // Transformar mensagens do banco para o formato do componente
      const formattedMessages: Message[] = (data || []).map((msg: any) => {
        const rawType = String(msg.tipo_mensagem || 'text').toLowerCase();
        const fileName = msg.arquivo_nome as string | undefined;
        // ✅ CORREÇÃO: Buscar URL da mídia de todos os campos possíveis
        const mediaUrl = (msg.media_url || msg.midia_url || msg.arquivo_url) as string | undefined;

        // Normalizar tipo para os valores aceitos pelo componente
        let type: Message["type"] = 'text';
        if (rawType === 'texto' || rawType === 'text') type = 'text';
        else if (rawType === 'image' || rawType === 'imagem') type = 'image';
        else if (rawType === 'audio' || rawType === 'áudio') type = 'audio';
        else if (rawType === 'video' || rawType === 'vídeo') type = 'video';
        else if (rawType === 'pdf') type = 'pdf';
        else if (rawType === 'document' || rawType === 'documento') {
          // Se documento for PDF, tratar como 'pdf'; senão, como 'document' genérico
          if ((fileName || '').toLowerCase().endsWith('.pdf') || (mediaUrl || '').startsWith('data:application/pdf')) {
            type = 'pdf';
          } else {
            type = 'document';
          }
        }

        // Determinar mimeType a partir da URL base64 ou extensão
        let mimeType: string | undefined = undefined;
        if (mediaUrl && mediaUrl.startsWith('data:')) {
          const m = mediaUrl.match(/^data:([^;]+);base64,/);
          if (m) mimeType = m[1];
        }
        if (!mimeType && fileName) {
          const fn = fileName.toLowerCase();
          if (fn.endsWith('.pdf')) mimeType = 'application/pdf';
          else if (fn.endsWith('.png')) mimeType = 'image/png';
          else if (fn.endsWith('.jpg') || fn.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (fn.endsWith('.gif')) mimeType = 'image/gif';
          else if (fn.endsWith('.webp')) mimeType = 'image/webp';
          else if (fn.endsWith('.mp4')) mimeType = 'video/mp4';
          else if (fn.endsWith('.mov')) mimeType = 'video/quicktime';
          else if (fn.endsWith('.avi')) mimeType = 'video/x-msvideo';
          else if (fn.endsWith('.ogg')) mimeType = 'audio/ogg';
          else if (fn.endsWith('.mp3')) mimeType = 'audio/mpeg';
          else if (fn.endsWith('.wav')) mimeType = 'audio/wav';
        }

        // Determinar quem enviou de forma robusta (compatível com variações)
        const statusStr = typeof msg.status === 'string' ? msg.status.toLowerCase() : '';
        const fromMeFlag = msg.fromme === true || msg.fromMe === true;
        const sender: Message["sender"] = fromMeFlag
          ? "user"
          : (statusStr === "recebida" || statusStr === "received" ? "contact" : "contact");

        // Determinar status de entrega/leitura sem assumir entrega só porque saiu do CRM
        const isDeliveredStatus = ["entregue", "delivered", "lida", "read"].includes(statusStr);
        const isReadStatus = ["lida", "read"].includes(statusStr);
        const delivered = msg.delivered === true || isDeliveredStatus;
        const read = msg.read === true || isReadStatus;

        return {
          id: msg.id || Date.now().toString() + Math.random(),
          content: msg.mensagem || "",
          type,
          sender,
          timestamp: new Date(msg.created_at || new Date()),
          delivered,
          read,
          mediaUrl,
          fileName,
          mimeType,
          status: msg.status,
          origem: msg.origem,
          sentBy: msg.sent_by || (sender === "user" ? "Equipe" : undefined), // ✅ Nome do remetente
        } as Message;
      });

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    } finally {
      setLoading(false);
    }
  };

  // Ações rápidas do lead no cabeçalho
  const salvarLeadRapido = async () => {
    try {
      if (leadVinculado) return;
      const companyId = await getCompanyId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!companyId || !user) {
        toast.error('Não foi possível identificar a empresa ou usuário');
        return;
      }
      const telefoneNormalizado = normalizePhoneBR(leadPhone || "");
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          name: leadName,
          telefone: telefoneNormalizado,
          phone: telefoneNormalizado,
          company_id: companyId,
          owner_id: user.id,
          status: 'novo',
          stage: 'prospeccao'
        }])
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setLeadVinculado(data);
      toast.success('Lead salvo no CRM');
    } catch (err) {
      console.error('Erro ao salvar lead:', err);
      toast.error('Erro ao salvar lead');
    }
  };

  const excluirLead = async () => {
    try {
      if (!leadVinculado?.id) return;
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadVinculado.id);
      if (error) throw error;
      setLeadVinculado(null);
      toast.success('Lead excluído');
    } catch (err) {
      console.error('Erro ao excluir lead:', err);
      toast.error('Erro ao excluir lead');
    }
  };

  // ✅ NOVO: Salvar valor da venda rapidamente
  const handleSalvarValorVenda = async () => {
    if (!leadVinculado?.id) {
      toast.error('Salve o lead no CRM primeiro');
      return;
    }
    
    const valorNumerico = valorVendaInput ? parseFloat(valorVendaInput.replace(/[^\d.,]/g, '').replace(',', '.')) : 0;
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({ value: valorNumerico })
        .eq('id', leadVinculado.id);
      
      if (error) throw error;
      
      setLeadVinculado({ ...leadVinculado, value: valorNumerico });
      setValorVendaOpen(false);
      toast.success('Valor atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar valor:', err);
      toast.error('Erro ao salvar valor');
    }
  };

  // ✅ NOVO: Carregar nome do usuário atual
  const carregarUsuarioAtual = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profile?.full_name) {
        setCurrentUserName(profile.full_name);
      }
    } catch (err) {
      console.error('Erro ao carregar usuário:', err);
    }
  };

  // ✅ NOVO: Carregar funis disponíveis
  const carregarFunis = async () => {
    setLoadingFunis(true);
    try {
      const companyId = await getCompanyId();
      if (!companyId) {
        console.log('⚠️ [ConversaPopup] company_id não encontrado para carregar funis');
        return;
      }
      
      console.log('📊 [ConversaPopup] Carregando funis para company_id:', companyId);
      
      // Carregar funis
      const { data: funisData, error: funisError } = await supabase
        .from('funis')
        .select('id, nome')
        .eq('company_id', companyId)
        .order('criado_em');
      
      if (funisError) {
        console.error('❌ [ConversaPopup] Erro ao carregar funis:', funisError);
        return;
      }
      
      // Carregar etapas separadamente
      const { data: etapasData, error: etapasError } = await supabase
        .from('etapas')
        .select('id, nome, funil_id, posicao')
        .eq('company_id', companyId)
        .order('posicao');
      
      if (etapasError) {
        console.error('❌ [ConversaPopup] Erro ao carregar etapas:', etapasError);
      }
      
      console.log('📊 [ConversaPopup] Funis carregados:', funisData?.length || 0);
      console.log('📍 [ConversaPopup] Etapas carregadas:', etapasData?.length || 0);
      
      if (funisData) {
        setFunis(funisData.map((f: any) => ({
          id: f.id,
          nome: f.nome,
          etapas: (etapasData || [])
            .filter((e: any) => e.funil_id === f.id)
            .sort((a: any, b: any) => (a.posicao || 0) - (b.posicao || 0))
        })));
      }
    } catch (err) {
      console.error('❌ [ConversaPopup] Erro ao carregar funis:', err);
    } finally {
      setLoadingFunis(false);
    }
  };

  // ✅ NOVO: Adicionar tag ao lead
  const handleAddTag = async (tag: string) => {
    if (!leadVinculado?.id) {
      toast.error('Salve o lead antes de adicionar tags');
      return;
    }
    try {
      await addTagToLead(leadVinculado.id, tag);
      // Atualizar estado local
      setLeadVinculado((prev: any) => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }));
      setTagsPopoverOpen(false);
      toast.success('Tag adicionada');
    } catch (err) {
      console.error('Erro ao adicionar tag:', err);
      toast.error('Erro ao adicionar tag');
    }
  };

  // ✅ NOVO: Remover tag do lead
  const handleRemoveTag = async (tag: string) => {
    if (!leadVinculado?.id) return;
    try {
      await removeTagFromLead(leadVinculado.id, tag);
      // Atualizar estado local
      setLeadVinculado((prev: any) => ({
        ...prev,
        tags: (prev.tags || []).filter((t: string) => t !== tag)
      }));
      toast.success('Tag removida');
    } catch (err) {
      console.error('Erro ao remover tag:', err);
      toast.error('Erro ao remover tag');
    }
  };

  // ✅ CORRIGIDO: Mover lead para funil/etapa - buscar company_id de forma robusta
  const handleMoverParaFunil = async (funilId: string, etapaId: string) => {
    if (!leadVinculado?.id) {
      toast.error('Salve o lead antes de mover para um funil');
      return;
    }
    
    // Validar que temos funilId e etapaId válidos
    if (!funilId || !etapaId) {
      console.error('[handleMoverParaFunil] funilId ou etapaId inválidos:', { funilId, etapaId });
      toast.error('Selecione um funil válido');
      return;
    }
    
    try {
      // Buscar company_id de forma robusta - do lead ou da sessão
      let companyIdToUse = leadVinculado.company_id;
      if (!companyIdToUse) {
        companyIdToUse = await getCompanyId();
      }
      
      if (!companyIdToUse) {
        toast.error('Não foi possível identificar a empresa');
        return;
      }
      
      console.log('[handleMoverParaFunil] Atualizando lead:', { 
        leadId: leadVinculado.id, 
        funilId, 
        etapaId, 
        companyId: companyIdToUse 
      });
      
      const { error } = await supabase
        .from('leads')
        .update({ 
          funil_id: funilId, 
          etapa_id: etapaId,
          company_id: companyIdToUse // Garantir company_id sempre presente
        })
        .eq('id', leadVinculado.id);
      
      if (error) {
        console.error('[handleMoverParaFunil] Erro do Supabase:', error);
        throw error;
      }
      
      // Atualizar estado local com company_id garantido
      setLeadVinculado((prev: any) => ({
        ...prev,
        funil_id: funilId,
        etapa_id: etapaId,
        company_id: companyIdToUse
      }));
      
      console.log('[handleMoverParaFunil] ✅ Lead movido com sucesso para funil:', funilId);
      toast.success('Lead adicionado ao funil com sucesso!');
    } catch (err) {
      console.error('[handleMoverParaFunil] Erro ao mover lead:', err);
      toast.error('Erro ao adicionar lead ao funil');
    }
  };

  // ✅ NOVO: Carregar contagem de anexos
  const carregarAttachmentsCount = async () => {
    if (!leadId) return;
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;
      
      const { count, error } = await supabase
        .from("lead_attachments")
        .select("*", { count: "exact", head: true })
        .eq("lead_id", leadId)
        .eq("company_id", companyId);
      
      if (!error && count !== null) {
        setAttachmentsCount(count);
      }
    } catch (error) {
      console.error("Erro ao carregar contagem de anexos:", error);
    }
  };

  // ✅ NOVO: Salvar mídia no prontuário
  const handleSaveToMedicalRecord = (mediaUrl: string, fileName: string, messageType: string) => {
    if (!leadVinculado?.id) {
      toast.error("Salve o lead primeiro para adicionar arquivos ao prontuário");
      return;
    }
    setSaveToRecordData({ mediaUrl, fileName, messageType });
    setSaveToRecordOpen(true);
  };

  // Carregar mensagens quando o popup abrir
  useEffect(() => {
    if (open && leadPhone) {
      carregarMensagens();
      carregarMensagensAgendadas();
      carregarLead();
      carregarFunis(); // ✅ Carregar funis disponíveis
      carregarUsuarioAtual(); // ✅ Carregar nome do usuário
      carregarAttachmentsCount(); // ✅ Carregar contagem de anexos
      refreshTags(); // ✅ Atualizar tags do gerenciador
      // Buscar foto de perfil via Edge Function (com cache)
      (async () => {
        try {
          const numero = normalizePhoneBR(leadPhone || "");
          const companyId = await getCompanyId();
          if (!numero) return;
          const url = await getAvatarWithCache(numero, companyId, leadName);
          setAvatarUrl(url || undefined);
        } catch {
          setAvatarUrl(undefined);
        }
      })();
    } else {
      setMessages([]);
      setMessageInput("");
      setLeadVinculado(null);
      setAvatarUrl(undefined);
      setAttachmentsCount(0);
    }
  }, [open, leadPhone, leadId, refreshTags]);

  // Scroll para o final quando novas mensagens chegarem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ NOVO: Realtime - Receber mensagens em tempo real
  useEffect(() => {
    if (!open || !leadPhone) return;

    const telefoneNormalizado = normalizePhoneBR(leadPhone);
    if (!telefoneNormalizado) return;

    console.log('🔴 [REALTIME] Iniciando escuta para:', telefoneNormalizado);

    // Criar canal de realtime para a conversa
    const channel = supabase
      .channel(`conversa-popup-${telefoneNormalizado}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversas',
        },
        async (payload: any) => {
          const newMsg = payload.new;
          
          // Verificar se a mensagem é para este número
          const msgNumero = String(newMsg.numero || newMsg.telefone_formatado || '').replace(/\D/g, '').replace('@s.whatsapp.net', '').replace('@c.us', '');
          const leadNumero = String(telefoneNormalizado).replace(/\D/g, '');
          
          if (!msgNumero.includes(leadNumero) && !leadNumero.includes(msgNumero)) {
            return; // Mensagem não é desta conversa
          }

          console.log('📩 [REALTIME] Nova mensagem recebida:', newMsg.id);

          // Formatar a nova mensagem
          const rawType = String(newMsg.tipo_mensagem || 'text').toLowerCase();
          let type: Message["type"] = 'text';
          if (rawType === 'texto' || rawType === 'text') type = 'text';
          else if (rawType === 'image' || rawType === 'imagem') type = 'image';
          else if (rawType === 'audio' || rawType === 'áudio') type = 'audio';
          else if (rawType === 'video' || rawType === 'vídeo') type = 'video';
          else if (rawType === 'pdf') type = 'pdf';
          else if (rawType === 'document' || rawType === 'documento') type = 'document';

          const fromMeFlag = newMsg.fromme === true || newMsg.fromMe === true;
          const sender: Message["sender"] = fromMeFlag ? "user" : "contact";
          const mediaUrl = (newMsg.media_url || newMsg.midia_url || newMsg.arquivo_url) as string | undefined;

          const formattedMessage: Message = {
            id: newMsg.id || Date.now().toString(),
            content: newMsg.mensagem || "",
            type,
            sender,
            timestamp: new Date(newMsg.created_at || new Date()),
            delivered: true,
            read: false,
            mediaUrl,
            fileName: newMsg.arquivo_nome,
            status: newMsg.status,
            origem: newMsg.origem,
            sentBy: newMsg.sent_by || (sender === "user" ? "Equipe" : undefined),
          };

          // Adicionar mensagem se não existir
          setMessages((prev) => {
            const exists = prev.some(m => m.id === formattedMessage.id);
            if (exists) return prev;
            return [...prev, formattedMessage];
          });
        }
      )
      .subscribe((status) => {
        console.log('🔴 [REALTIME] Status do canal:', status);
      });

    // Cleanup ao fechar ou desmontar
    return () => {
      console.log('🔴 [REALTIME] Fechando canal');
      supabase.removeChannel(channel);
    };
  }, [open, leadPhone]);

  // Carregar Mensagens Rápidas quando o modal abrir
  // ⚡ CORREÇÃO: Carregar do banco de dados ao invés de localStorage
  const loadQuickDataFromDatabase = async () => {
    try {
      const { data: companyData } = await supabase.rpc('get_my_company_id');
      if (!companyData) return;

      // Carregar categorias
      const { data: categoriesData } = await supabase
        .from('quick_message_categories')
        .select('*')
        .eq('company_id', companyData)
        .order('created_at', { ascending: true });

      if (categoriesData) {
        const formattedCategories = categoriesData.map(cat => ({
          id: cat.id,
          name: cat.name,
        }));
        setQuickCategories(formattedCategories);
      }

      // Carregar mensagens
      const { data: messagesData } = await supabase
        .from('quick_messages')
        .select('*')
        .eq('company_id', companyData)
        .order('created_at', { ascending: false });

      if (messagesData) {
        const formattedMessages = messagesData.map(msg => ({
          id: msg.id,
          title: msg.title,
          content: msg.content,
          category: msg.category_id || '',
        }));
        setQuickMessages(formattedMessages);
      }

      console.log('✅ [QUICK-MESSAGES] Carregadas do banco:', {
        categorias: categoriesData?.length || 0,
        mensagens: messagesData?.length || 0
      });
    } catch (error) {
      console.error('❌ Erro ao carregar quick messages:', error);
      setQuickMessages([]);
      setQuickCategories([]);
    }
  };

  useEffect(() => {
    if (quickOpen) loadQuickDataFromDatabase();
  }, [quickOpen]);

  // ⚡ CORREÇÃO: Carregar do banco ao montar e quando abrir o popup
  useEffect(() => {
    if (open) {
      loadQuickDataFromDatabase();
    }
  }, [open]);
  // Enviar mensagem
  const handleSendMessage = async (content?: string, type: Message["type"] = "text") => {
    const messageContent = content || messageInput.trim();
    if (!messageContent || !leadPhone || sending) return;

    setSending(true);

    try {
      // Normalizar número de telefone
      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;
      
      // Preparar mensagem para resposta
      const mensagemParaEnviar = replyingTo && messages.find(m => m.id === replyingTo)
        ? {
            mensagem: messageContent,
            quoted: {
              key: { id: replyingTo },
              message: {
                conversation: messages.find(m => m.id === replyingTo)?.content || ''
              }
            }
          }
        : { mensagem: messageContent };

      // Enviar via WhatsApp
      const { data: whatsappData, error: whatsappError } = await enviarWhatsApp({
        numero: telefoneNormalizado,
        ...mensagemParaEnviar,
        quotedMessageId: replyingTo || undefined,
        tipo_mensagem: type,
      });

      if (whatsappError) {
        console.error("Erro ao enviar para WhatsApp:", whatsappError);
        toast.error("Erro ao enviar mensagem para WhatsApp");
        setSending(false);
        return;
      }

      console.log("✅ Mensagem enviada para WhatsApp com sucesso");

      // Buscar company_id do usuário
      const companyId = await getCompanyId();

      // Salvar no banco de dados
      const { error: dbError } = await supabase.from("conversas").insert([
        {
          numero: telefoneNormalizado,
          telefone_formatado: telefoneNormalizado,
          mensagem: messageContent,
          origem: "WhatsApp",
          status: "Enviada",
          tipo_mensagem: type,
          nome_contato: leadName,
          company_id: companyId,
          fromme: true, // ✅ CORREÇÃO: Definir fromme como true para mensagens enviadas
          sent_by: currentUserName || "Equipe", // ✅ CORREÇÃO: Nome do usuário que enviou
          replied_to_message: replyingTo ? messages.find(m => m.id === replyingTo)?.content || null : null,
        },
      ]);

      if (dbError) {
        console.error("❌ Erro ao salvar mensagem no banco:", dbError);
        toast.error("Erro ao salvar mensagem no histórico");
      } else {
        console.log("✅ Mensagem salva no Supabase");
        toast.success("Mensagem enviada com sucesso!");
      }

      // Tentar processar mensagens agendadas pendentes
      processarMensagensAgendadas();

      // Adicionar mensagem à lista local
      const newMessage: Message = {
        id: Date.now().toString(),
        content: messageContent,
        type,
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        read: false,
        sentBy: currentUserName || "Equipe", // ✅ Nome do usuário que enviou
      };

      setMessages((prev) => [...prev, newMessage]);
      setMessageInput("");
      setReplyingTo(null);

      // Emitir evento global para sincronizar conversas
      emitGlobalEvent({ type: 'conversation-updated', source: 'conversa-popup', data: { numero: telefoneNormalizado, content: messageContent, messageType: type } });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao processar envio");
    } finally {
      setSending(false);
    }
  };

  // Enviar mídia
  const handleSendMedia = async (file: File, caption: string, type: string) => {
    if (!leadPhone || sending) return;

    // Áudio anexado deve usar o mesmo pipeline robusto do gravador
    if (type === 'audio') {
      await handleSendAudio(file);
      return;
    }

    setSending(true);
    try {
      // Converter arquivo para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
      });

      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;

      const { error: whatsappError } = await enviarWhatsApp({
        numero: telefoneNormalizado,
        mensagem: caption || `Arquivo ${type}`,
        tipo_mensagem: type,
        mediaBase64: base64,
        fileName: file.name,
        mimeType: file.type,
        caption: caption || '',
      });

      if (whatsappError) {
        throw whatsappError;
      }

      const companyId = await getCompanyId();
      
      // ⚡ CORREÇÃO: Upload para Storage em vez de salvar Base64 no banco
      let storageUrl: string | null = null;
      try {
        if (companyId) {
          storageUrl = await uploadMediaToStorage(file, companyId, { fileName: file.name });
        }
      } catch (uploadErr) {
        console.warn('⚠️ [CONVERSA-POPUP] Falha no upload para Storage, continuando sem URL:', uploadErr);
      }

      const { data: inserted, error: dbError } = await supabase.from("conversas").insert({
        numero: telefoneNormalizado,
        telefone_formatado: telefoneNormalizado,
        mensagem: caption || `Arquivo ${type}`,
        origem: "WhatsApp",
        status: "Enviada",
        tipo_mensagem: type,
        nome_contato: leadName,
        arquivo_nome: file.name,
        midia_url: storageUrl, // ⚡ URL do Storage (não Base64)
        company_id: companyId,
        fromme: true,
        sent_by: currentUserName || "Equipe",
      }).select('id').single();

      // ⚡ Log detalhado para debugging
      console.log('📊 [CONVERSA-POPUP] Tentativa de salvar mídia no banco:', {
        telefoneNormalizado,
        type,
        fileName: file.name,
        hasStorageUrl: !!storageUrl,
        companyId,
        leadName
      });

      if (dbError) {
        console.error("❌ [CONVERSA-POPUP] Erro detalhado ao salvar mensagem:", {
          error: dbError,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          code: dbError.code
        });
        toast.error("Erro ao salvar mensagem no histórico");
        // Não bloquear o envio mesmo com erro no banco
        console.warn("⚠️ Mídia enviada mas com problema ao salvar no banco");
      } else {
        console.log('✅ [CONVERSA-POPUP] Mensagem salva no banco:', inserted);
      }

      const newMessage: Message = {
        id: (inserted?.id || Date.now()).toString(),
        content: caption || `Arquivo ${type}`,
        type: type as Message["type"],
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        mediaUrl: storageUrl || URL.createObjectURL(file), // ⚡ Usar URL do Storage ou blob local
        sentBy: currentUserName || "Equipe", // ✅ Nome do usuário
        fileName: file.name,
        mimeType: file.type,
      };

      setMessages((prev) => [...prev, newMessage]);
      toast.success("Mídia enviada com sucesso!");

      emitGlobalEvent({ type: 'conversation-updated', source: 'conversa-popup', data: { numero: telefoneNormalizado, content: caption || `Arquivo ${type}`, messageType: type } });

      // Disparar processamento de mensagens agendadas
      processarMensagensAgendadas();
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      toast.error("Erro ao enviar mídia");
    } finally {
      setSending(false);
    }
  };

  // Enviar áudio
  const handleSendAudio = async (audioBlob: Blob) => {
    if (!leadPhone || sending) return;

    setSending(true);
    try {
      // ⚡ NORMALIZAÇÃO ROBUSTA: evita MIME mascarado (ex.: OGG com payload WebM)
      const rawMime = (audioBlob.type || 'audio/webm').split(';')[0].trim().toLowerCase();
      const { normalizeAudioForMeta } = await import('@/utils/audioConverter');
      const finalAudioBlob = await normalizeAudioForMeta(audioBlob);

      const audioMimeType = (finalAudioBlob.type || 'audio/mpeg').split(';')[0].trim().toLowerCase();
      console.log('✅ [ConversaPopup] Blob normalizado para envio:', {
        rawMime,
        finalMime: audioMimeType,
        originalSize: audioBlob.size,
        finalSize: finalAudioBlob.size,
      });
      const audioExtension = audioMimeType.includes('ogg') ? 'ogg' :
        audioMimeType.includes('mp4') ? 'm4a' :
        audioMimeType.includes('mpeg') ? 'mp3' : 'ogg';

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Erro ao ler áudio'));
        reader.readAsDataURL(finalAudioBlob);
      });

      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;

      const { data: whatsappData, error: whatsappError } = await enviarWhatsApp({
        numero: telefoneNormalizado,
        mensagem: 'Áudio enviado',
        tipo_mensagem: 'audio',
        mediaBase64: base64,
        fileName: `audio.${audioExtension}`,
        mimeType: finalAudioBlob.type || audioMimeType,
        caption: '',
      });

      if (whatsappError) {
        throw whatsappError;
      }

      const whatsappMessageId =
        whatsappData?.message_id ||
        whatsappData?.data?.messages?.[0]?.id ||
        whatsappData?.data?.key?.id ||
        null;

      if (!whatsappMessageId) {
        throw new Error('Envio sem confirmação do provedor (message_id ausente).');
      }

      const companyId = await getCompanyId();

      // ⚡ Upload áudio para Storage
      let audioStorageUrl: string | null = null;
      try {
        if (companyId) {
          audioStorageUrl = await uploadMediaToStorage(finalAudioBlob, companyId, {
            fileName: `audio.${audioExtension}`,
            contentType: finalAudioBlob.type || audioMimeType,
          });
        }
      } catch (uploadErr) {
        console.warn('⚠️ Falha no upload de áudio para Storage:', uploadErr);
      }

      // Buscar dados do usuário para assinatura
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from("conversas").insert([
        {
          numero: telefoneNormalizado,
          telefone_formatado: telefoneNormalizado,
          mensagem: 'Áudio enviado',
          origem: "WhatsApp",
          status: "Enviada",
          tipo_mensagem: 'audio',
          nome_contato: leadName,
          midia_url: audioStorageUrl, // ⚡ URL do Storage (não Base64)
          company_id: companyId,
          owner_id: user?.id,
          sent_by: currentUserName || "Equipe",
          whatsapp_message_id: whatsappMessageId,
          fromme: true,
          delivered: false,
        },
      ]);

      const newMessage: Message = {
        id: Date.now().toString(),
        content: "Áudio enviado",
        type: "audio",
        sender: "user",
        timestamp: new Date(),
        delivered: false,
        mediaUrl: URL.createObjectURL(finalAudioBlob),
        sentBy: currentUserName || "Equipe", // ✅ Assinatura na mensagem local
      };

      setMessages((prev) => [...prev, newMessage]);
      toast.success("Áudio enviado com sucesso!");

      emitGlobalEvent({ type: 'conversation-updated', source: 'conversa-popup', data: { numero: telefoneNormalizado, content: 'Áudio enviado', messageType: 'audio' } });
    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar áudio';
      toast.error(errorMessage || 'Erro ao enviar áudio');
    } finally {
      setSending(false);
    }
  };

  // Agendar mensagem
  const scheduleMessage = async () => {
    if (!leadPhone || !scheduledContent.trim() || !scheduledDatetime) {
      toast.error('Preencha a mensagem e a data/hora');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Usuário não autenticado');
        return;
      }
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!userRole?.company_id) {
        toast.error('Empresa não encontrada');
        return;
      }
    const numero = normalizePhoneBR(leadPhone || "")!;
      const { error } = await supabase
        .from('scheduled_whatsapp_messages')
        .insert([{
          company_id: userRole.company_id,
          owner_id: session.user.id,
          conversation_id: numero,
          phone_number: numero,
          contact_name: leadName,
          message_content: scheduledContent,
          scheduled_datetime: new Date(scheduledDatetime).toISOString(),
          status: 'pending',
        }]);
      if (error) throw error;
      toast.success('Mensagem agendada com sucesso!');
      setScheduledContent("");
      setScheduledDatetime("");
      carregarMensagensAgendadas();
      // Opcional: disparar processamento (caso esteja atrasada e possa ser enviada já)
      processarMensagensAgendadas();
    } catch (err) {
      console.error('Erro ao agendar:', err);
      toast.error('Erro ao agendar mensagem');
    }
  };

  // Enviar ao pressionar Enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formattedPhone = leadPhone ? safeFormatPhoneNumber(leadPhone) || "N/A" : "N/A";

  useEffect(() => {
    document.body.classList.toggle("lead-conversa-popup-open", open);
    return () => document.body.classList.remove("lead-conversa-popup-open");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 !z-[200]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={avatarUrl || leadVinculado?.avatar_url} />
                <AvatarFallback>
                  {(leadName && leadName.length > 0) ? leadName.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-lg">{leadName}</span>
                <span className="text-sm text-muted-foreground font-normal">
                  {formattedPhone}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Menu de ações do lead */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => {
                      if (!leadVinculado) {
                        toast.error('Salve o lead antes de editar');
                        return;
                      }
                      setEditLeadOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar lead
                  </DropdownMenuItem>
                  {!leadVinculado && (
                    <DropdownMenuItem onClick={salvarLeadRapido}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar lead no CRM
                    </DropdownMenuItem>
                  )}
                  {leadVinculado && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setAttachmentsOpen(true)}>
                        <Paperclip className="h-4 w-4 mr-2" />
                        Prontuário / Anexos
                        {attachmentsCount > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {attachmentsCount}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={excluirLead}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir lead
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                className={showInfoPanel ? "bg-primary/10 text-primary" : ""}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0" style={{ height: 'calc(90vh - 80px)', overflow: 'hidden' }}>
          {/* Messages Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 p-6 bg-[#e5ddd5]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
              <div className="space-y-2 min-h-[200px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4 mx-auto"></div>
                      <p className="text-muted-foreground">Carregando mensagens...</p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhuma mensagem ainda. Inicie uma conversa!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageItem
                      key={msg.id}
                      message={msg as any}
                      allMessages={messages as any}
                      onReply={(id) => setReplyingTo(id)}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onReact={() => {}}
                      hideFloatingActions
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="bg-background border-t border-border p-4 flex-shrink-0">
              {replyingTo && (
                <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Send className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 rotate-180" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                          Respondendo mensagem
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {messages.find(m => m.id === replyingTo)?.content || ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReplyingTo(null)}
                      className="flex-shrink-0 h-7 w-7 p-0"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MediaUpload onFileSelected={handleSendMedia as any} />
            {/* Mensagens Rápidas - Botão igual ao menu Conversas */}
            <Button variant="outline" size="sm" onClick={() => setQuickOpen(true)} className="gap-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              Rápidas
            </Button>
            {/* Agendar Mensagem */}
            <Button variant="outline" size="sm" onClick={() => setScheduledOpen(true)}>
              <Clock className="h-4 w-4 mr-1" /> Agendar
            </Button>
            {/* Reunião e Tarefa */}
            <Button variant="outline" size="sm" onClick={() => setAgendaOpen(true)}>
              📅 Reunião
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTarefaOpen(true)}>
              ✅ Tarefa
            </Button>
                <Input
                  placeholder="Escreva sua mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={sending || !leadPhone}
                  className="flex-1"
                />
                <AudioRecorder onSendAudio={handleSendAudio} />
                <Button
                  onClick={() => handleSendMessage()}
                  size="icon"
                  className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                  disabled={!messageInput.trim() || sending || !leadPhone}
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              {!leadPhone && (
                <p className="text-xs text-muted-foreground mt-2">
                  Este lead não possui telefone cadastrado.
                </p>
              )}
            </div>
          </div>

          {showInfoPanel && (
            <div 
              className="w-[340px] bg-background border-l border-border flex-shrink-0 relative"
              style={{ height: 'calc(90vh - 80px)' }}
            >
              <div
                className="absolute inset-0 overflow-y-auto"
                style={{ 
                  overflowY: 'scroll',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
              <div className="p-6 space-y-6" style={{ paddingBottom: '250px' }}>
                  {/* Contact Info */}
                  <div className="text-center">
                    <Avatar className="w-20 h-20 mx-auto mb-3">
                      <AvatarImage src={leadVinculado?.avatar_url} />
                      <AvatarFallback>
                        <User className="h-10 w-10 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-foreground font-medium text-lg">{leadName}</h3>
                    <p className="text-muted-foreground text-sm">WhatsApp</p>
                  </div>

                  {/* Informações do Lead */}
                  <div>
                    <h4 className="text-foreground font-medium mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Informações do Lead
                    </h4>
                    
                    {leadVinculado ? (
                      <Badge variant="outline" className="w-full justify-center gap-2 py-2 bg-green-500/10 text-green-600 border-green-500/20 mb-3">
                        <span className="text-xs font-medium">Lead vinculado no CRM</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="w-full justify-center gap-2 py-2 bg-amber-500/10 text-amber-600 border-amber-500/20 mb-3">
                        <span className="text-xs font-medium">Lead não cadastrado</span>
                      </Badge>
                    )}
                    
                    <EditarInformacoesLeadDialog
                      leadId={leadId}
                      telefone={leadPhone || ""}
                      nomeContato={leadName}
                      onLeadUpdated={() => {
                        carregarLead();
                        carregarMensagens();
                      }}
                    />
                    
                    {/* ✅ NOVO: Botão rápido para adicionar valor da venda */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mb-2 gap-2"
                      onClick={() => {
                        setValorVendaInput(leadVinculado?.value?.toString() || "");
                        setValorVendaOpen(true);
                      }}
                      disabled={!leadVinculado}
                    >
                      <DollarSign className="h-3 w-3 text-green-600" />
                      {leadVinculado?.value ? `Valor: R$ ${Number(leadVinculado.value).toLocaleString("pt-BR")}` : "Adicionar Valor da Venda"}
                    </Button>
                    
                    {leadVinculado && (
                      <>
                        {leadVinculado.company && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <strong>Empresa:</strong> {leadVinculado.company}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Responsáveis */}
                  <ResponsaveisManager
                    leadId={leadId}
                    responsaveisAtuais={leadVinculado?.responsavel_id ? [leadVinculado.responsavel_id] : []}
                    onResponsaveisUpdated={() => {
                      carregarLead();
                    }}
                  />

                  {/* Tags */}
                  <div>
                    <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Tags
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {leadVinculado?.tags?.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="flex items-center gap-1 pr-1">
                          {tag}
                          <button 
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-destructive rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {(!leadVinculado?.tags || leadVinculado.tags.length === 0) && (
                        <span className="text-xs text-muted-foreground">Nenhuma tag adicionada</span>
                      )}
                    </div>
                    <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full gap-2">
                          <Plus className="h-3 w-3" />
                          Adicionar Tag
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0 z-[9999]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar tag..." />
                          <CommandList>
                            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                            <CommandGroup>
                              {tagsExistentes
                                .filter(tag => !(leadVinculado?.tags || []).includes(tag))
                                .map((tag) => (
                                  <CommandItem
                                    key={tag}
                                    value={tag}
                                    onSelect={() => handleAddTag(tag)}
                                  >
                                    <Tag className="h-3 w-3 mr-2" />
                                    {tag}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Funil de Vendas */}
                  <div>
                    <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Funil de Vendas
                    </h4>
                    {leadVinculado?.funil_id ? (
                      <div className="space-y-2">
                        <Badge variant="outline" className="w-full justify-center py-2 bg-green-500/10 text-green-600 border-green-500/20">
                          {funis.find(f => f.id === leadVinculado.funil_id)?.nome || 'No funil'}
                          {leadVinculado.etapa_id && (
                            <span className="ml-1">
                              → {funis.find(f => f.id === leadVinculado.funil_id)?.etapas.find(e => e.id === leadVinculado.etapa_id)?.nome || ''}
                            </span>
                          )}
                        </Badge>
                        <Select 
                          value={leadVinculado.etapa_id || ''} 
                          onValueChange={(etapaId) => handleMoverParaFunil(leadVinculado.funil_id, etapaId)}
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue placeholder="Mover para etapa..." />
                          </SelectTrigger>
                          <SelectContent className="z-[9999]">
                            {funis.find(f => f.id === leadVinculado.funil_id)?.etapas.map((etapa) => (
                              <SelectItem key={etapa.id} value={etapa.id}>
                                {etapa.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Não está em nenhum funil
                        </p>
                        {leadVinculado ? (
                          funis.filter(f => f.etapas && f.etapas.length > 0).length > 0 ? (
                            <Select onValueChange={(value) => {
                              const [funilId, etapaId] = value.split('|');
                              if (!etapaId) {
                                toast.error('Este funil não possui etapas configuradas');
                                return;
                              }
                              handleMoverParaFunil(funilId, etapaId);
                            }}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Adicionar ao Funil" />
                              </SelectTrigger>
                              <SelectContent className="z-[9999]">
                                {funis.filter(f => f.etapas && f.etapas.length > 0).map((funil) => (
                                  <SelectItem 
                                    key={funil.id} 
                                    value={`${funil.id}|${funil.etapas[0]?.id}`}
                                  >
                                    {funil.nome} ({funil.etapas.length} etapas)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {loadingFunis ? "Carregando funis..." : "Nenhum funil com etapas disponível"}
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-amber-600">
                            Salve o lead para adicionar a um funil
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ações Rápidas */}
                  <div>
                    <h4 className="text-foreground font-medium mb-3">Ações Rápidas</h4>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => toast.info("Funcionalidade de IA em desenvolvimento")}
                      >
                        <Bot className="h-4 w-4 text-purple-500" />
                        Ativar IA
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => setQuickOpen(true)}
                      >
                        <Zap className="h-4 w-4 text-yellow-500" />
                        Mensagens Rápidas
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => setScheduledOpen(true)}
                      >
                        <Clock className="h-4 w-4 text-blue-500" />
                        Agendar Mensagem
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => toast.info("Funcionalidade de lembretes em desenvolvimento")}
                      >
                        <Bell className="h-4 w-4 text-orange-500" />
                        Gerenciar Lembretes
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => setAgendaOpen(true)}
                      >
                        <Calendar className="h-4 w-4 text-green-500" />
                        Compromissos
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => setTarefaOpen(true)}
                      >
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        Tarefas
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => setAttachmentsOpen(true)}
                      >
                        <Paperclip className="h-4 w-4 text-indigo-500" />
                        Banco de Dado do Contato
                        {attachmentsCount > 0 && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {attachmentsCount}
                          </Badge>
                        )}
                      </Button>
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      {/* Dialog: Mensagens Rápidas - CÓPIA EXATA do menu Conversas */}
      <UIDialog open={quickOpen} onOpenChange={setQuickOpen}>
        <UIDialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 !z-[350]">
          <UIDialogHeader className="flex-shrink-0 p-6 pb-2">
            <UIDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Respostas Rápidas
            </UIDialogTitle>
            <p className="text-sm text-muted-foreground">Mensagens por Categoria:</p>
          </UIDialogHeader>
          
          {/* Container com scroll */}
          <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ maxHeight: 'calc(85vh - 100px)' }}>
            <div className="space-y-2">
              {quickCategories.length === 0 && quickMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhuma mensagem rápida cadastrada</p>
                  <p className="text-xs mt-1">Crie mensagens rápidas no menu Conversas</p>
                </div>
              ) : (
                <>
                  <Accordion type="single" collapsible className="w-full">
                    {quickCategories.map((category) => {
                      const categoryMessages = quickMessages.filter((msg) => msg.category === category.id);
                      return (
                        <AccordionItem key={category.id} value={category.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">{category.name}</span>
                              <Badge variant="secondary">{categoryMessages.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {categoryMessages.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2 px-4">
                                Nenhuma mensagem nesta categoria
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                {categoryMessages.map((qm) => (
                                  <div
                                    key={qm.id}
                                    className="flex items-start justify-between p-3 bg-background rounded border hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => { handleSendMessage(qm.content); setQuickOpen(false); }}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{qm.title}</p>
                                      <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
                                        {qm.content}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      className="ml-2 flex-shrink-0"
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        handleSendMessage(qm.content); 
                                        setQuickOpen(false); 
                                      }}
                                    >
                                      Enviar
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>

                  {/* Mensagens sem categoria */}
                  {(() => {
                    const knownCatIds = new Set(quickCategories.map(c => c.id));
                    const uncategorized = quickMessages.filter(m => !knownCatIds.has(m.category));
                    if (uncategorized.length === 0) return null;
                    return (
                      <Accordion type="single" collapsible className="w-full mt-2">
                        <AccordionItem value="uncategorized">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">Outras</span>
                              <Badge variant="secondary">{uncategorized.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                              {uncategorized.map((qm) => (
                                <div
                                  key={qm.id}
                                  className="flex items-start justify-between p-3 bg-background rounded border hover:bg-muted/50 cursor-pointer transition-colors"
                                  onClick={() => { handleSendMessage(qm.content); setQuickOpen(false); }}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{qm.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
                                      {qm.content}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="ml-2 flex-shrink-0"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      handleSendMessage(qm.content); 
                                      setQuickOpen(false); 
                                    }}
                                  >
                                    Enviar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Dialog: Agendar Mensagem */}
      <UIDialog open={scheduledOpen} onOpenChange={(o) => { setScheduledOpen(o); if (o) carregarMensagensAgendadas(); }}>
        <UIDialogContent className="max-w-lg !z-[350]">
          <UIDialogHeader>
            <UIDialogTitle>Agendar Mensagem</UIDialogTitle>
          </UIDialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Mensagem</Label>
              <Input value={scheduledContent} onChange={(e) => setScheduledContent(e.target.value)} placeholder="Digite a mensagem..." />
            </div>
            <div>
              <Label>Data/Hora</Label>
              <Input type="datetime-local" value={scheduledDatetime} onChange={(e) => setScheduledDatetime(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={scheduleMessage} disabled={!scheduledContent.trim() || !scheduledDatetime}>Agendar</Button>
            </div>
            <div className="pt-2">
              <h4 className="text-sm font-medium mb-2">Agendadas</h4>
              <div className="space-y-2 max-h-48 overflow-auto">
                {scheduledList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem agendada</p>
                ) : scheduledList.map((m) => (
                  <div key={m.id} className="p-2 rounded border flex items-center justify-between">
                    <div className="text-sm pr-2 truncate">{m.message_content}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.scheduled_datetime).toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Dialog: Valor da Venda Rápido */}
      <UIDialog open={valorVendaOpen} onOpenChange={setValorVendaOpen}>
        <UIDialogContent className="max-w-sm !z-[350]">
          <UIDialogHeader>
            <UIDialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Valor da Venda / Negociação
            </UIDialogTitle>
          </UIDialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="valorVenda">Valor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                <Input
                  id="valorVenda"
                  type="text"
                  inputMode="numeric"
                  placeholder="1.500,00"
                  value={valorVendaInput}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.,]/g, '');
                    setValorVendaInput(value);
                  }}
                  className="text-lg font-medium pl-10"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Digite o valor estimado ou fechado da negociação
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setValorVendaOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSalvarValorVenda}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Valor
              </Button>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Dialog: Editar Lead (controle pelo menu do cabeçalho) */}
      {leadVinculado && (
        <EditarLeadDialog
          lead={{
            id: leadVinculado.id,
            nome: leadVinculado.name || leadName,
            telefone: leadVinculado.telefone || leadPhone || '',
            email: leadVinculado.email || '',
            cpf: leadVinculado.cpf || '',
            value: leadVinculado.value || 0,
            company: leadVinculado.company || '',
            source: leadVinculado.source || '',
            notes: leadVinculado.notes || '',
            tags: leadVinculado.tags || [],
            funil_id: leadVinculado.funil_id || undefined,
            etapa_id: leadVinculado.etapa_id || undefined,
            company_id: leadVinculado.company_id || undefined,
            ...(leadVinculado.responsavel_id ? { responsavel_id: leadVinculado.responsavel_id } : {}),
          }}
          open={editLeadOpen}
          onOpenChange={(o) => setEditLeadOpen(o)}
          onLeadUpdated={() => {
            carregarLead();
            toast.success('Lead atualizado');
          }}
        />
      )}

      {/* Modais: Reunião e Tarefa */}
      <AgendaModal
        open={agendaOpen}
        onOpenChange={(o) => setAgendaOpen(o)}
        lead={{ id: leadId, nome: leadName, telefone: leadPhone }}
        onAgendamentoCriado={() => {
          toast.success('Reunião agendada');
          emitGlobalEvent({ type: 'meeting-scheduled', source: 'conversa-popup', data: { lead_id: leadId } });
        }}
      />
      <TarefaModal
        open={tarefaOpen}
        onOpenChange={(o) => setTarefaOpen(o)}
        lead={{ id: leadId, nome: leadName }}
        onTarefaCriada={() => {
          toast.success('Tarefa criada');
          emitGlobalEvent({ type: 'task-created', source: 'conversa-popup', data: { lead_id: leadId } });
        }}
      />

      {/* Modal de Prontuário/Anexos */}
      {leadVinculado && (
        <LeadAttachments
          open={attachmentsOpen}
          onOpenChange={(o) => {
            setAttachmentsOpen(o);
            if (!o) carregarAttachmentsCount();
          }}
          leadId={leadVinculado.id}
          companyId={leadVinculado.company_id}
          leadName={leadName}
        />
      )}

      {/* Dialog para salvar mídia no prontuário */}
      {saveToRecordOpen && saveToRecordData && leadVinculado && (
        <SaveToMedicalRecordDialog
          open={saveToRecordOpen}
          onOpenChange={(o) => {
            setSaveToRecordOpen(o);
            if (!o) {
              setSaveToRecordData(null);
              carregarAttachmentsCount();
            }
          }}
          mediaUrl={saveToRecordData.mediaUrl}
          fileName={saveToRecordData.fileName}
          messageType={saveToRecordData.messageType}
          leadId={leadVinculado.id}
          companyId={leadVinculado.company_id}
          leadName={leadName}
        />
      )}
      </DialogContent>
    </Dialog>
  );
}