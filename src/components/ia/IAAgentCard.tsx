import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Settings, Activity, Zap, MessageSquare, Send, Loader2, CheckCircle, AlertCircle, User, Bot, Trash2, Clock, UserX, RefreshCw, Calendar, Pause, Play, Tag, GitBranch, History, X, Plus, Ban, BookOpen, GraduationCap, Building2, Package, HelpCircle, FileText, Lightbulb, Brain, Upload, File, Image, FileAudio, FileVideo, Eye, FileType } from "lucide-react";
import { toast } from "sonner";
import { useAIAgents } from "@/hooks/useAIAgents";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

// Interface para Arquivos de Conhecimento
interface ArquivoConhecimento {
  id: string;
  nome: string;
  tipo: 'texto' | 'pdf' | 'imagem' | 'audio' | 'video';
  tamanho: number;
  url: string;
  conteudoExtraido?: string;
  status: 'processando' | 'pronto' | 'erro';
  dataUpload: Date;
}

// Interfaces para Base de Conhecimento
interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco?: string;
}

interface FAQ {
  id: string;
  pergunta: string;
  resposta: string;
}

interface Treinamento {
  id: string;
  perguntaExemplo: string;
  respostaIdeal: string;
  categoria: string;
}

// Interface para Casos Antes e Depois
interface CasoAntesDepois {
  id: string;
  titulo: string;
  categoria: string;
  legenda: string;
  imagemAntes?: string;
  imagemDepois?: string;
  videoAntes?: string;
  videoDepois?: string;
  dataCadastro: Date;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: string;
  actionParams?: string;
  timestamp: Date;
}

interface IAAgentCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  active: boolean;
  onToggle: (id: string, active: boolean) => void;
  stats?: {
    conversationsHandled: number;
    avgResponseTime: string;
    successRate: string;
  };
}

export function IAAgentCard({ 
  id, 
  name, 
  description, 
  icon: Icon, 
  color, 
  active,
  onToggle,
  stats 
}: IAAgentCardProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [promptEditing, setPromptEditing] = useState(false);
  const [autoResponse, setAutoResponse] = useState(true);
  const [transferOnUnknown, setTransferOnUnknown] = useState(true);
  const [maxResponses, setMaxResponses] = useState(10);
  const [testMessage, setTestMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [testing, setTesting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Novos estados para configurações avançadas
  const [responseDelay, setResponseDelay] = useState(2); // segundos
  const [pauseOnHumanResponse, setPauseOnHumanResponse] = useState(true);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpTime, setFollowUpTime] = useState(30); // minutos
  const [followUpTimeUnit, setFollowUpTimeUnit] = useState<'minutes' | 'hours'>('minutes');
  const [followUpMessage, setFollowUpMessage] = useState("Olá! Vi que você não respondeu. Posso te ajudar com algo?");
  const [maxFollowUps, setMaxFollowUps] = useState(2);
  const [useLeadPhoneAuto, setUseLeadPhoneAuto] = useState(true); // Para agendamento
  
  // Estados para bloqueio por tags
  const [blockByTags, setBlockByTags] = useState(false);
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [newBlockedTag, setNewBlockedTag] = useState("");
  const [availableCompanyTags, setAvailableCompanyTags] = useState<string[]>([]);
  
  // Estados para leitura de histórico
  const [readConversationHistory, setReadConversationHistory] = useState(true);
  const [historyMessagesCount, setHistoryMessagesCount] = useState(10);
  
  // Estados para bloqueio por funil/etapa
  const [blockByFunnel, setBlockByFunnel] = useState(false);
  const [blockedFunnels, setBlockedFunnels] = useState<string[]>([]);
  const [blockedStages, setBlockedStages] = useState<string[]>([]);
  const [availableFunnels, setAvailableFunnels] = useState<{id: string, nome: string}[]>([]);
  const [availableStages, setAvailableStages] = useState<{id: string, nome: string, funil_id: string}[]>([]);
  const [selectedFunnelToBlock, setSelectedFunnelToBlock] = useState("");
  const [selectedStageToBlock, setSelectedStageToBlock] = useState("");
  
  // Estados para agendas de profissionais (IA de Agendamento)
  const [availableAgendas, setAvailableAgendas] = useState<{id: string, nome: string, tipo: string, profissional_nome?: string}[]>([]);
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  
  // Estados para Base de Conhecimento
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaDescricao, setEmpresaDescricao] = useState("");
  const [empresaSegmento, setEmpresaSegmento] = useState("");
  const [empresaHorario, setEmpresaHorario] = useState("");
  const [empresaEndereco, setEmpresaEndereco] = useState("");
  const [empresaContato, setEmpresaContato] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [novoProduto, setNovoProduto] = useState<Partial<Produto>>({ nome: '', descricao: '', preco: '' });
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [novaFaq, setNovaFaq] = useState<Partial<FAQ>>({ pergunta: '', resposta: '' });
  const [informacoesExtras, setInformacoesExtras] = useState("");
  
  // Estados para Treinamentos
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [novoTreinamento, setNovoTreinamento] = useState<Partial<Treinamento>>({ 
    perguntaExemplo: '', 
    respostaIdeal: '', 
    categoria: 'geral' 
  });
  const [categoriaTreinamento, setCategoriaTreinamento] = useState('geral');
  
  // Estados para Arquivos de Conhecimento
  const [arquivos, setArquivos] = useState<ArquivoConhecimento[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para Casos Antes e Depois (exclusivo para IA de Atendimento)
  const [casosAntesDepois, setCasosAntesDepois] = useState<CasoAntesDepois[]>([]);
  const [novoCaso, setNovoCaso] = useState<Partial<CasoAntesDepois>>({
    titulo: '',
    categoria: 'geral',
    legenda: ''
  });
  const [uploadingCaso, setUploadingCaso] = useState(false);
  const antesInputRef = useRef<HTMLInputElement>(null);
  const depoisInputRef = useRef<HTMLInputElement>(null);
  const [tempAntes, setTempAntes] = useState<{ url: string; tipo: 'imagem' | 'video' } | null>(null);
  const [tempDepois, setTempDepois] = useState<{ url: string; tipo: 'imagem' | 'video' } | null>(null);
  
  // Estados para arquivos de teste na aba "Testar"
  interface TestFile {
    id: string;
    type: 'image' | 'pdf' | 'audio' | 'video';
    base64: string;
    name: string;
    mimeType: string;
    previewUrl?: string;
  }
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const testImageInputRef = useRef<HTMLInputElement>(null);
  const testPdfInputRef = useRef<HTMLInputElement>(null);
  const testAudioInputRef = useRef<HTMLInputElement>(null);
  const testVideoInputRef = useRef<HTMLInputElement>(null);
  
  const { updateAgentConfig, testAgent, loading } = useAIAgents();
  
  // Carregar configurações salvas e funis/etapas disponíveis
  useEffect(() => {
    const loadAllConfig = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
          
        if (!userRole?.company_id) return;
        
        // Carregar configurações salvas da IA
        const { data: iaConfig } = await supabase
          .from('ia_configurations')
          .select('custom_prompts')
          .eq('company_id', userRole.company_id)
          .maybeSingle();
        
        if (iaConfig?.custom_prompts) {
          const prompts = iaConfig.custom_prompts as any;
          const agentData = prompts[id];
          if (agentData) {
            if (agentData.custom_prompt) setCustomPrompt(agentData.custom_prompt);
            if (agentData.auto_response !== undefined) setAutoResponse(agentData.auto_response);
            if (agentData.transfer_on_unknown !== undefined) setTransferOnUnknown(agentData.transfer_on_unknown);
            if (agentData.max_responses_per_conversation) setMaxResponses(agentData.max_responses_per_conversation);
            if (agentData.response_delay !== undefined) setResponseDelay(agentData.response_delay);
            if (agentData.pause_on_human_response !== undefined) setPauseOnHumanResponse(agentData.pause_on_human_response);
            if (agentData.follow_up_enabled !== undefined) setFollowUpEnabled(agentData.follow_up_enabled);
            if (agentData.follow_up_time) setFollowUpTime(agentData.follow_up_time);
            if (agentData.follow_up_time_unit) setFollowUpTimeUnit(agentData.follow_up_time_unit);
            if (agentData.follow_up_message) setFollowUpMessage(agentData.follow_up_message);
            if (agentData.max_follow_ups) setMaxFollowUps(agentData.max_follow_ups);
            if (agentData.use_lead_phone_auto !== undefined) setUseLeadPhoneAuto(agentData.use_lead_phone_auto);
            if (agentData.block_by_tags !== undefined) setBlockByTags(agentData.block_by_tags);
            if (agentData.blocked_tags) setBlockedTags(agentData.blocked_tags);
            if (agentData.read_conversation_history !== undefined) setReadConversationHistory(agentData.read_conversation_history);
            if (agentData.history_messages_count) setHistoryMessagesCount(agentData.history_messages_count);
            if (agentData.block_by_funnel !== undefined) setBlockByFunnel(agentData.block_by_funnel);
            if (agentData.blocked_funnels) setBlockedFunnels(agentData.blocked_funnels);
            if (agentData.blocked_stages) setBlockedStages(agentData.blocked_stages);
            // Base de Conhecimento
            const kb = agentData.knowledge_base;
            if (kb) {
              if (kb.empresa) {
                setEmpresaNome(kb.empresa.nome || '');
                setEmpresaDescricao(kb.empresa.descricao || '');
                setEmpresaSegmento(kb.empresa.segmento || '');
                setEmpresaHorario(kb.empresa.horario || '');
                setEmpresaEndereco(kb.empresa.endereco || '');
                setEmpresaContato(kb.empresa.contato || '');
              }
              if (kb.produtos) setProdutos(kb.produtos);
              if (kb.faqs) setFaqs(kb.faqs);
              if (kb.informacoes_extras) setInformacoesExtras(kb.informacoes_extras);
              if (kb.arquivos) setArquivos(kb.arquivos.map((a: any) => ({ ...a, status: 'pronto', tamanho: 0, dataUpload: new Date() })));
              if (kb.casos_antes_depois) setCasosAntesDepois(kb.casos_antes_depois.map((c: any) => ({ ...c, dataCadastro: new Date() })));
              if (kb.agendas_selecionadas) setSelectedAgendas(kb.agendas_selecionadas);
            }
            // Treinamentos
            if (agentData.training_data) setTreinamentos(agentData.training_data);
          }
        }
        
        // Carregar funis
        const { data: funis } = await supabase
          .from('funis')
          .select('id, nome')
          .eq('company_id', userRole.company_id);
          
        if (funis) setAvailableFunnels(funis);
        
        // Carregar etapas
        const { data: etapas } = await supabase
          .from('etapas')
          .select('id, nome, funil_id');
          
        if (etapas) setAvailableStages(etapas);

        // Carregar tags da empresa
        const { data: companyTags } = await supabase
          .from('company_tags')
          .select('tag_name')
          .eq('company_id', userRole.company_id);
        
        if (companyTags) setAvailableCompanyTags(companyTags.map(t => t.tag_name));
        
        // Carregar agendas de profissionais (para IA de Agendamento)
        const { data: agendas } = await supabase
          .from('agendas')
          .select(`
            id, 
            nome, 
            tipo,
            profissionais:responsavel_id (nome)
          `)
          .eq('company_id', userRole.company_id)
          .eq('status', 'ativo');
          
        if (agendas) {
          setAvailableAgendas(agendas.map(a => ({
            id: a.id,
            nome: a.nome,
            tipo: a.tipo,
            profissional_nome: (a.profissionais as any)?.nome
          })));
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      }
    };
    
    if (configOpen) {
      loadAllConfig();
    }
  }, [configOpen, id]);

  // Auto-scroll para o fim do chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleToggle = () => {
    const newState = !active;
    onToggle(id, newState);
  };

  const handleSaveConfig = async () => {
    const success = await updateAgentConfig(id, {
      custom_prompt: customPrompt || undefined,
      auto_response: autoResponse,
      transfer_on_unknown: transferOnUnknown,
      max_responses_per_conversation: maxResponses,
      response_delay: responseDelay,
      pause_on_human_response: pauseOnHumanResponse,
      follow_up_enabled: followUpEnabled,
      follow_up_time: followUpTime,
      follow_up_time_unit: followUpTimeUnit,
      follow_up_message: followUpMessage,
      max_follow_ups: maxFollowUps,
      use_lead_phone_auto: useLeadPhoneAuto,
      // Novas configurações de bloqueio
      block_by_tags: blockByTags,
      blocked_tags: blockedTags,
      read_conversation_history: readConversationHistory,
      history_messages_count: historyMessagesCount,
      block_by_funnel: blockByFunnel,
      blocked_funnels: blockedFunnels,
      blocked_stages: blockedStages,
      // Base de Conhecimento
      knowledge_base: {
        empresa: {
          nome: empresaNome,
          descricao: empresaDescricao,
          segmento: empresaSegmento,
          horario: empresaHorario,
          endereco: empresaEndereco,
          contato: empresaContato
        },
        produtos: produtos,
        faqs: faqs,
        informacoes_extras: informacoesExtras,
        arquivos: arquivos.map(a => ({
          id: a.id,
          nome: a.nome,
          tipo: a.tipo,
          url: a.url,
          conteudoExtraido: a.conteudoExtraido
        })),
        // Casos Antes e Depois (para IA de Atendimento e Agendamento)
        casos_antes_depois: casosAntesDepois.map(c => ({
          id: c.id,
          titulo: c.titulo,
          categoria: c.categoria,
          legenda: c.legenda,
          imagemAntes: c.imagemAntes,
          imagemDepois: c.imagemDepois,
          videoAntes: c.videoAntes,
          videoDepois: c.videoDepois
        })),
        // Agendas selecionadas para consulta (IA de Agendamento)
        agendas_selecionadas: selectedAgendas
      },
      // Treinamentos
      training_data: treinamentos
    });
    
    if (success) {
    setConfigOpen(false);
    }
  };
  
  // Funções para gerenciar tags bloqueadas
  const handleAddBlockedTag = () => {
    if (newBlockedTag.trim() && !blockedTags.includes(newBlockedTag.trim())) {
      setBlockedTags([...blockedTags, newBlockedTag.trim()]);
      setNewBlockedTag("");
    }
  };
  
  const handleRemoveBlockedTag = (tag: string) => {
    setBlockedTags(blockedTags.filter(t => t !== tag));
  };
  
  // Funções para gerenciar funis bloqueados
  const handleAddBlockedFunnel = () => {
    if (selectedFunnelToBlock && !blockedFunnels.includes(selectedFunnelToBlock)) {
      setBlockedFunnels([...blockedFunnels, selectedFunnelToBlock]);
      setSelectedFunnelToBlock("");
    }
  };
  
  const handleRemoveBlockedFunnel = (funnelId: string) => {
    setBlockedFunnels(blockedFunnels.filter(f => f !== funnelId));
  };
  
  // Funções para gerenciar etapas bloqueadas
  const handleAddBlockedStage = () => {
    if (selectedStageToBlock && !blockedStages.includes(selectedStageToBlock)) {
      setBlockedStages([...blockedStages, selectedStageToBlock]);
      setSelectedStageToBlock("");
    }
  };
  
  const handleRemoveBlockedStage = (stageId: string) => {
    setBlockedStages(blockedStages.filter(s => s !== stageId));
  };
  
  // Helper para obter nome do funil/etapa
  const getFunnelName = (id: string) => availableFunnels.find(f => f.id === id)?.nome || id;
  const getStageName = (id: string) => availableStages.find(s => s.id === id)?.nome || id;
  
  // Funções para gerenciar Produtos
  const handleAddProduto = () => {
    if (novoProduto.nome?.trim()) {
      setProdutos([...produtos, {
        id: `prod-${Date.now()}`,
        nome: novoProduto.nome.trim(),
        descricao: novoProduto.descricao?.trim() || '',
        preco: novoProduto.preco?.trim() || ''
      }]);
      setNovoProduto({ nome: '', descricao: '', preco: '' });
    }
  };
  
  const handleRemoveProduto = (id: string) => {
    setProdutos(produtos.filter(p => p.id !== id));
  };
  
  // Funções para gerenciar FAQs
  const handleAddFaq = () => {
    if (novaFaq.pergunta?.trim() && novaFaq.resposta?.trim()) {
      setFaqs([...faqs, {
        id: `faq-${Date.now()}`,
        pergunta: novaFaq.pergunta.trim(),
        resposta: novaFaq.resposta.trim()
      }]);
      setNovaFaq({ pergunta: '', resposta: '' });
    }
  };
  
  const handleRemoveFaq = (id: string) => {
    setFaqs(faqs.filter(f => f.id !== id));
  };
  
  // Funções para gerenciar Treinamentos
  const handleAddTreinamento = () => {
    if (novoTreinamento.perguntaExemplo?.trim() && novoTreinamento.respostaIdeal?.trim()) {
      setTreinamentos([...treinamentos, {
        id: `train-${Date.now()}`,
        perguntaExemplo: novoTreinamento.perguntaExemplo.trim(),
        respostaIdeal: novoTreinamento.respostaIdeal.trim(),
        categoria: novoTreinamento.categoria || 'geral'
      }]);
      setNovoTreinamento({ perguntaExemplo: '', respostaIdeal: '', categoria: 'geral' });
    }
  };
  
  const handleRemoveTreinamento = (id: string) => {
    setTreinamentos(treinamentos.filter(t => t.id !== id));
  };
  
  // Funções para gerenciar Arquivos de Conhecimento
  const getFileType = (file: File): ArquivoConhecimento['tipo'] => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;
    
    if (mimeType.startsWith('image/')) return 'imagem';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
    return 'texto';
  };
  
  const getFileIcon = (tipo: ArquivoConhecimento['tipo']) => {
    switch (tipo) {
      case 'imagem': return <Image className="h-5 w-5 text-green-500" />;
      case 'audio': return <FileAudio className="h-5 w-5 text-purple-500" />;
      case 'video': return <FileVideo className="h-5 w-5 text-red-500" />;
      case 'pdf': return <FileType className="h-5 w-5 text-orange-500" />;
      default: return <FileText className="h-5 w-5 text-blue-500" />;
    }
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingFile(true);
    setUploadProgress(0);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validar tamanho (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`Arquivo ${file.name} excede o limite de 50MB`);
        continue;
      }
      
      // Validar tipo
      const allowedTypes = [
        'text/plain', 'text/csv', 'text/markdown',
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3',
        'video/mp4', 'video/webm', 'video/ogg'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo de arquivo não suportado: ${file.type}`);
        continue;
      }
      
      try {
        // Simular progresso do upload
        setUploadProgress(((i + 1) / files.length) * 50);
        
        // Upload para o Supabase Storage
        const fileName = `${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ia-knowledge')
          .upload(`${id}/${fileName}`, file);
        
        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          // Fallback: usar URL local temporário
          const localUrl = URL.createObjectURL(file);
          
          const novoArquivo: ArquivoConhecimento = {
            id: `file-${Date.now()}-${i}`,
            nome: file.name,
            tipo: getFileType(file),
            tamanho: file.size,
            url: localUrl,
            status: 'pronto',
            dataUpload: new Date()
          };
          
          setArquivos(prev => [...prev, novoArquivo]);
          toast.success(`Arquivo ${file.name} adicionado!`);
        } else {
          // Obter URL pública
          const { data: urlData } = supabase.storage
            .from('ia-knowledge')
            .getPublicUrl(`${id}/${fileName}`);
          
          const novoArquivo: ArquivoConhecimento = {
            id: `file-${Date.now()}-${i}`,
            nome: file.name,
            tipo: getFileType(file),
            tamanho: file.size,
            url: urlData.publicUrl,
            status: 'processando',
            dataUpload: new Date()
          };
          
          setArquivos(prev => [...prev, novoArquivo]);
          
          // Simular processamento (extração de texto)
          setTimeout(() => {
            setArquivos(prev => prev.map(a => 
              a.id === novoArquivo.id 
                ? { ...a, status: 'pronto' as const, conteudoExtraido: `Conteúdo extraído de ${file.name}` }
                : a
            ));
          }, 2000);
          
          toast.success(`Arquivo ${file.name} enviado para processamento!`);
        }
        
        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast.error(`Erro ao processar ${file.name}`);
      }
    }
    
    setUploadingFile(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleRemoveArquivo = (id: string) => {
    setArquivos(arquivos.filter(a => a.id !== id));
    toast.success('Arquivo removido');
  };
  
  // Funções para gerenciar Casos Antes e Depois
  const handleUploadAntesDepois = async (
    event: React.ChangeEvent<HTMLInputElement>, 
    tipo: 'antes' | 'depois'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validar tipo (imagem ou vídeo)
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Apenas imagens ou vídeos são permitidos');
      return;
    }
    
    // Criar URL local para preview
    const localUrl = URL.createObjectURL(file);
    
    if (tipo === 'antes') {
      setTempAntes({ url: localUrl, tipo: isImage ? 'imagem' : 'video' });
    } else {
      setTempDepois({ url: localUrl, tipo: isImage ? 'imagem' : 'video' });
    }
    
    toast.success(`Arquivo ${tipo} carregado!`);
  };
  
  const handleAddCasoAntesDepois = async () => {
    if (!novoCaso.titulo?.trim()) {
      toast.error('Informe o título do tratamento');
      return;
    }
    
    if (!tempAntes && !tempDepois) {
      toast.error('Adicione pelo menos uma imagem/vídeo (antes ou depois)');
      return;
    }
    
    setUploadingCaso(true);
    
    try {
      const novoId = `caso-${Date.now()}`;
      
      const caso: CasoAntesDepois = {
        id: novoId,
        titulo: novoCaso.titulo.trim(),
        categoria: novoCaso.categoria || 'geral',
        legenda: novoCaso.legenda?.trim() || '',
        imagemAntes: tempAntes?.tipo === 'imagem' ? tempAntes.url : undefined,
        videoAntes: tempAntes?.tipo === 'video' ? tempAntes.url : undefined,
        imagemDepois: tempDepois?.tipo === 'imagem' ? tempDepois.url : undefined,
        videoDepois: tempDepois?.tipo === 'video' ? tempDepois.url : undefined,
        dataCadastro: new Date()
      };
      
      setCasosAntesDepois(prev => [...prev, caso]);
      
      // Limpar formulário
      setNovoCaso({ titulo: '', categoria: 'geral', legenda: '' });
      setTempAntes(null);
      setTempDepois(null);
      if (antesInputRef.current) antesInputRef.current.value = '';
      if (depoisInputRef.current) depoisInputRef.current.value = '';
      
      toast.success('Caso antes/depois adicionado!');
    } catch (error) {
      console.error('Erro ao adicionar caso:', error);
      toast.error('Erro ao adicionar caso');
    } finally {
      setUploadingCaso(false);
    }
  };
  
  const handleRemoveCasoAntesDepois = (id: string) => {
    setCasosAntesDepois(casosAntesDepois.filter(c => c.id !== id));
    toast.success('Caso removido');
  };

  // Funções para gerenciar arquivos de teste
  const fileToBase64Test = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Retornar apenas a parte base64, sem o prefixo data:...
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleTestFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf' | 'audio' | 'video') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamanho (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 20MB.');
      return;
    }

    try {
      const base64 = await fileToBase64Test(file);
      const newFile: TestFile = {
        id: `test-file-${Date.now()}`,
        type,
        base64,
        name: file.name,
        mimeType: file.type,
        previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined
      };
      
      setTestFiles(prev => [...prev, newFile]);
      toast.success(`${file.name} anexado!`);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo');
    }

    // Limpar input
    event.target.value = '';
  };

  const removeTestFile = (fileId: string) => {
    const file = testFiles.find(f => f.id === fileId);
    if (file?.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
    setTestFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearTestFiles = () => {
    testFiles.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setTestFiles([]);
  };

  const handleTestAgent = async () => {
    if (!testMessage.trim() && testFiles.length === 0) {
      toast.error("Digite uma mensagem ou anexe um arquivo para testar");
      return;
    }
    
    // Montar conteúdo da mensagem do usuário
    let userContent = testMessage;
    if (testFiles.length > 0) {
      const fileDescriptions = testFiles.map(f => `[${f.type.toUpperCase()}: ${f.name}]`).join(' ');
      userContent = userContent ? `${userContent}\n${fileDescriptions}` : fileDescriptions;
    }
    
    // Adicionar mensagem do usuário ao chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);
    setTestMessage("");
    setTesting(true);
    
    try {
      // Preparar arquivos para envio
      const filesToSend = testFiles.map(f => ({
        type: f.type,
        base64: f.base64,
        name: f.name,
        mimeType: f.mimeType
      }));
      
      const result = await testAgent(id, testMessage, filesToSend.length > 0 ? filesToSend : undefined);
      
      // Limpar arquivos após envio
      clearTestFiles();
      
      // Adicionar resposta da IA ao chat
      if (result) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response || 'Sem resposta',
          action: result.action,
          actionParams: result.actionParams,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Erro no teste:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '❌ Erro ao processar mensagem. Tente novamente.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setTesting(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    clearTestFiles();
  };

  return (
    <Card className="group relative overflow-hidden border-0 shadow-card hover:shadow-lg transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl ${color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {active && <Badge className="bg-success animate-pulse">Ativa</Badge>}
            <Switch checked={active} onCheckedChange={handleToggle} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {stats && active && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.conversationsHandled}</div>
              <div className="text-xs text-muted-foreground">Conversas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{stats.avgResponseTime}</div>
              <div className="text-xs text-muted-foreground">Resp. Média</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{stats.successRate}</div>
              <div className="text-xs text-muted-foreground">Taxa Sucesso</div>
            </div>
          </div>
        )}

        {active && (
          <div className="flex gap-2">
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    Configurações - {name}
                  </DialogTitle>
                </DialogHeader>
                
                <Tabs defaultValue="comportamento" className="w-full">
                  <TabsList className="grid w-full grid-cols-7 text-xs">
                    <TabsTrigger value="comportamento" className="text-xs px-2">Comportamento</TabsTrigger>
                    <TabsTrigger value="restricoes" className="text-xs px-2">Restrições</TabsTrigger>
                    <TabsTrigger value="conhecimento" className="text-xs px-2">
                      <BookOpen className="h-3 w-3 mr-1" />
                      Conhecimento
                    </TabsTrigger>
                    <TabsTrigger value="treinamento" className="text-xs px-2">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      Treinamento
                    </TabsTrigger>
                    <TabsTrigger value="followup" className="text-xs px-2">Follow-up</TabsTrigger>
                    <TabsTrigger value="prompt" className="text-xs px-2">Prompt</TabsTrigger>
                    <TabsTrigger value="teste" className="text-xs px-2">Testar</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="comportamento" className="space-y-4 mt-4">
                    <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                        {/* Resposta Automática */}
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Play className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <Label className="text-base">Resposta Automática</Label>
                              <p className="text-sm text-muted-foreground">
                                A IA responde automaticamente sem aprovação humana
                              </p>
                            </div>
                          </div>
                          <Switch 
                            checked={autoResponse} 
                            onCheckedChange={setAutoResponse}
                          />
                        </div>
                        
                        {/* Tempo de Resposta */}
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Clock className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                              <Label className="text-base">Tempo de Resposta</Label>
                              <p className="text-sm text-muted-foreground">
                                Delay antes da IA enviar a resposta (simula digitação)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-13">
                            <Input
                              type="number"
                              value={responseDelay}
                              onChange={(e) => setResponseDelay(parseInt(e.target.value) || 2)}
                              min={0}
                              max={30}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">segundos</span>
                          </div>
                        </div>
                        
                        {/* Pausar quando humano responder */}
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                              <Pause className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <Label className="text-base">Pausar quando humano responder</Label>
                              <p className="text-sm text-muted-foreground">
                                A IA pausa automaticamente quando atendente envia mensagem
                              </p>
                            </div>
                          </div>
                          <Switch 
                            checked={pauseOnHumanResponse} 
                            onCheckedChange={setPauseOnHumanResponse}
                          />
                        </div>
                        
                        {/* Transferir quando não souber */}
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                              <UserX className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                              <Label className="text-base">Transferir quando não souber</Label>
                              <p className="text-sm text-muted-foreground">
                                Transfere para humano quando não conseguir responder
                              </p>
                            </div>
                          </div>
                          <Switch 
                            checked={transferOnUnknown} 
                            onCheckedChange={setTransferOnUnknown}
                          />
                        </div>
                        
                        {/* Máximo de respostas */}
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                              <MessageSquare className="h-5 w-5 text-gray-500" />
                            </div>
                            <div>
                              <Label className="text-base">Máximo de respostas por conversa</Label>
                              <p className="text-sm text-muted-foreground">
                                Após esse número, transfere automaticamente para humano
                              </p>
                            </div>
                          </div>
                          <Input
                            type="number"
                            value={maxResponses}
                            onChange={(e) => setMaxResponses(parseInt(e.target.value) || 10)}
                            min={1}
                            max={50}
                            className="w-24"
                          />
                        </div>

                        {/* Config específica para Agendamento */}
                        {id === 'agendamento' && (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                  <Calendar className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                  <Label className="text-base">Usar telefone do lead automaticamente</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Ao agendar, usa o telefone da conversa sem perguntar
                                  </p>
                                </div>
                              </div>
                              <Switch 
                                checked={useLeadPhoneAuto} 
                                onCheckedChange={setUseLeadPhoneAuto}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  {/* Aba Restrições - Bloqueio por Tags, Histórico e Funil */}
                  <TabsContent value="restricoes" className="space-y-4 mt-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {/* Leitura de Histórico */}
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <History className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <Label className="text-base">Ler Histórico da Conversa</Label>
                                <p className="text-sm text-muted-foreground">
                                  IA lê mensagens anteriores para não repetir perguntas
                                </p>
                              </div>
                            </div>
                            <Switch 
                              checked={readConversationHistory} 
                              onCheckedChange={setReadConversationHistory}
                            />
                          </div>
                          
                          {readConversationHistory && (
                            <div className="ml-13 pt-3 border-t">
                              <Label className="text-sm">Quantidade de mensagens para ler</Label>
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  type="number"
                                  value={historyMessagesCount}
                                  onChange={(e) => setHistoryMessagesCount(parseInt(e.target.value) || 10)}
                                  min={5}
                                  max={50}
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">mensagens</span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <Separator />
                        
                        {/* Bloqueio por Tags */}
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <Tag className="h-5 w-5 text-red-500" />
                              </div>
                              <div>
                                <Label className="text-base">Bloquear por Tags</Label>
                                <p className="text-sm text-muted-foreground">
                                  IA NÃO responde leads com essas tags
                                </p>
                              </div>
                            </div>
                            <Switch 
                              checked={blockByTags} 
                              onCheckedChange={setBlockByTags}
                            />
                          </div>
                          
                          {blockByTags && (
                            <div className="space-y-3 pt-3 border-t">
                              {/* Tags disponíveis para selecionar */}
                              {availableCompanyTags.length > 0 ? (
                                <div className="space-y-2">
                                  <Label className="text-sm">Clique nas tags para bloquear:</Label>
                                  <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30 max-h-36 overflow-y-auto">
                                    {availableCompanyTags.filter(t => !blockedTags.includes(t)).map(tag => (
                                      <Badge 
                                        key={tag} 
                                        variant="outline" 
                                        className="cursor-pointer select-none hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                        onClick={() => {
                                          if (!blockedTags.includes(tag)) {
                                            setBlockedTags([...blockedTags, tag]);
                                          }
                                        }}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    {availableCompanyTags.filter(t => !blockedTags.includes(t)).length === 0 && (
                                      <p className="text-xs text-muted-foreground">Todas as tags já foram adicionadas</p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">Nenhuma tag cadastrada na empresa</p>
                              )}

                              {/* Adicionar tag manual também */}
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Ou digite uma tag manualmente..."
                                  value={newBlockedTag}
                                  onChange={(e) => setNewBlockedTag(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddBlockedTag()}
                                  className="flex-1"
                                />
                                <Button size="sm" onClick={handleAddBlockedTag}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              {blockedTags.length > 0 ? (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Tags bloqueadas:</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {blockedTags.map(tag => (
                                      <Badge key={tag} variant="destructive" className="flex items-center gap-1">
                                        <Ban className="h-3 w-3" />
                                        {tag}
                                        <button onClick={() => handleRemoveBlockedTag(tag)} className="ml-1 hover:text-white/80">
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Nenhuma tag bloqueada. Selecione tags acima.
                                </p>
                              )}
                              
                              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-xs text-red-700 dark:text-red-300">
                                ⚠️ Leads com essas tags não receberão respostas da IA
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <Separator />
                        
                        {/* Bloqueio por Funil/Etapa */}
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <GitBranch className="h-5 w-5 text-purple-500" />
                              </div>
                              <div>
                                <Label className="text-base">Bloquear por Funil/Etapa</Label>
                                <p className="text-sm text-muted-foreground">
                                  IA NÃO responde leads em funis ou etapas específicas
                                </p>
                              </div>
                            </div>
                            <Switch 
                              checked={blockByFunnel} 
                              onCheckedChange={setBlockByFunnel}
                            />
                          </div>
                          
                          {blockByFunnel && (
                            <div className="space-y-4 pt-3 border-t">
                              {/* Bloqueio por Funil */}
                  <div className="space-y-2">
                                <Label className="text-sm font-medium">Funis bloqueados:</Label>
                                <div className="flex gap-2">
                                  <Select value={selectedFunnelToBlock} onValueChange={setSelectedFunnelToBlock}>
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Selecione um funil..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableFunnels.map(funnel => (
                                        <SelectItem key={funnel.id} value={funnel.id}>
                                          {funnel.nome}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" onClick={handleAddBlockedFunnel}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                {blockedFunnels.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {blockedFunnels.map(funnelId => (
                                      <Badge key={funnelId} variant="secondary" className="flex items-center gap-1">
                                        <GitBranch className="h-3 w-3" />
                                        {getFunnelName(funnelId)}
                                        <button onClick={() => handleRemoveBlockedFunnel(funnelId)} className="ml-1 hover:text-foreground/80">
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Bloqueio por Etapa */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Etapas bloqueadas:</Label>
                                <div className="flex gap-2">
                                  <Select value={selectedStageToBlock} onValueChange={setSelectedStageToBlock}>
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Selecione uma etapa..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableStages.map(stage => (
                                        <SelectItem key={stage.id} value={stage.id}>
                                          {stage.nome} ({getFunnelName(stage.funil_id)})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" onClick={handleAddBlockedStage}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                {blockedStages.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {blockedStages.map(stageId => (
                                      <Badge key={stageId} variant="outline" className="flex items-center gap-1">
                                        {getStageName(stageId)}
                                        <button onClick={() => handleRemoveBlockedStage(stageId)} className="ml-1 hover:text-foreground/80">
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                                ⚠️ Leads nesses funis/etapas não receberão respostas da IA
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  {/* Aba Base de Conhecimento */}
                  <TabsContent value="conhecimento" className="space-y-4 mt-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {/* Informações da Empresa */}
                        <div className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                              <Label className="text-base">Informações da Empresa</Label>
                              <p className="text-sm text-muted-foreground">
                                Dados básicos que a IA usará para responder
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-sm">Nome da Empresa</Label>
                              <Input
                                placeholder="Ex: Clínica São Lucas"
                                value={empresaNome}
                                onChange={(e) => setEmpresaNome(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Segmento</Label>
                              <Input
                                placeholder="Ex: Clínica Odontológica"
                                value={empresaSegmento}
                                onChange={(e) => setEmpresaSegmento(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm">Descrição da Empresa</Label>
                    <Textarea
                              placeholder="Descreva sua empresa, o que fazem, diferenciais..."
                              value={empresaDescricao}
                              onChange={(e) => setEmpresaDescricao(e.target.value)}
                              rows={3}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-sm">Horário de Funcionamento</Label>
                              <Input
                                placeholder="Ex: Seg-Sex 8h-18h"
                                value={empresaHorario}
                                onChange={(e) => setEmpresaHorario(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Contato</Label>
                              <Input
                                placeholder="Ex: (11) 99999-9999"
                                value={empresaContato}
                                onChange={(e) => setEmpresaContato(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm">Endereço</Label>
                            <Input
                              placeholder="Ex: Rua das Flores, 123 - Centro"
                              value={empresaEndereco}
                              onChange={(e) => setEmpresaEndereco(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <Separator />
                        
                        {/* Produtos/Serviços */}
                        <div className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                              <Package className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                              <Label className="text-base">Produtos/Serviços</Label>
                              <p className="text-sm text-muted-foreground">
                                Lista de produtos ou serviços que a IA pode informar
                              </p>
                            </div>
                  </div>

                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="Nome do produto/serviço"
                              value={novoProduto.nome || ''}
                              onChange={(e) => setNovoProduto({...novoProduto, nome: e.target.value})}
                            />
                            <Input
                              placeholder="Descrição breve"
                              value={novoProduto.descricao || ''}
                              onChange={(e) => setNovoProduto({...novoProduto, descricao: e.target.value})}
                            />
                            <div className="flex gap-2">
                              <Input
                                placeholder="Preço (opcional)"
                                value={novoProduto.preco || ''}
                                onChange={(e) => setNovoProduto({...novoProduto, preco: e.target.value})}
                              />
                              <Button size="sm" onClick={handleAddProduto}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {produtos.length > 0 ? (
                  <div className="space-y-2">
                              {produtos.map(produto => (
                                <div key={produto.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                  <div>
                                    <p className="font-medium text-sm">{produto.nome}</p>
                                    <p className="text-xs text-muted-foreground">{produto.descricao}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {produto.preco && (
                                      <Badge variant="secondary">{produto.preco}</Badge>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveProduto(produto.id)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Nenhum produto/serviço cadastrado
                            </p>
                          )}
                        </div>
                        
                        <Separator />
                        
                        {/* FAQs */}
                        <div className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <HelpCircle className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                              <Label className="text-base">Perguntas Frequentes (FAQ)</Label>
                              <p className="text-sm text-muted-foreground">
                                Perguntas e respostas comuns
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Input
                              placeholder="Pergunta frequente..."
                              value={novaFaq.pergunta || ''}
                              onChange={(e) => setNovaFaq({...novaFaq, pergunta: e.target.value})}
                            />
                            <div className="flex gap-2">
                              <Textarea
                                placeholder="Resposta..."
                                value={novaFaq.resposta || ''}
                                onChange={(e) => setNovaFaq({...novaFaq, resposta: e.target.value})}
                                rows={2}
                                className="flex-1"
                              />
                              <Button size="sm" onClick={handleAddFaq} className="self-end">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {faqs.length > 0 ? (
                            <div className="space-y-2">
                              {faqs.map(faq => (
                                <div key={faq.id} className="p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-medium text-sm flex items-center gap-1">
                                        <HelpCircle className="h-3 w-3" />
                                        {faq.pergunta}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1 pl-4">{faq.resposta}</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveFaq(faq.id)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Nenhuma FAQ cadastrada
                            </p>
                          )}
                        </div>
                        
                        <Separator />
                        
                        {/* Informações Extras */}
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                              <Label className="text-base">Informações Extras</Label>
                              <p className="text-sm text-muted-foreground">
                                Outras informações importantes para a IA
                              </p>
                            </div>
                          </div>
                          
                          <Textarea
                            placeholder="Ex: Aceitamos cartões de crédito e débito. Estacionamento gratuito. Temos wifi..."
                            value={informacoesExtras}
                            onChange={(e) => setInformacoesExtras(e.target.value)}
                            rows={4}
                          />
                        </div>
                        
                        <Separator />
                        
                        {/* Upload de Arquivos */}
                        <div className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center">
                              <Upload className="h-5 w-5 text-cyan-500" />
                            </div>
                            <div>
                              <Label className="text-base">Arquivos de Conhecimento</Label>
                              <p className="text-sm text-muted-foreground">
                                Envie arquivos para a IA aprender (PDF, TXT, Imagens, Áudio, Vídeo)
                              </p>
                            </div>
                          </div>
                          
                          {/* Área de Upload */}
                          <div 
                            className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              accept=".txt,.csv,.md,.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.mp4,.webm"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm font-medium">Clique para enviar arquivos</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              ou arraste e solte aqui
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 mt-3">
                              <Badge variant="outline" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                TXT/CSV
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <File className="h-3 w-3 mr-1" />
                                PDF
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Image className="h-3 w-3 mr-1" />
                                Imagens
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <FileAudio className="h-3 w-3 mr-1" />
                                Áudio
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <FileVideo className="h-3 w-3 mr-1" />
                                Vídeo
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Progresso de Upload */}
                          {uploadingFile && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span>Enviando arquivos...</span>
                                <span>{Math.round(uploadProgress)}%</span>
                              </div>
                              <Progress value={uploadProgress} className="h-2" />
                            </div>
                          )}
                          
                          {/* Lista de Arquivos */}
                          {arquivos.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Arquivos enviados</Label>
                                <Badge variant="secondary">{arquivos.length} arquivo(s)</Badge>
                              </div>
                              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {arquivos.map(arquivo => (
                                  <div 
                                    key={arquivo.id} 
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                                        {getFileIcon(arquivo.tipo)}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm truncate max-w-[200px]">{arquivo.nome}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <span>{formatFileSize(arquivo.tamanho)}</span>
                                          <span>•</span>
                                          <Badge 
                                            variant={arquivo.status === 'pronto' ? 'default' : arquivo.status === 'erro' ? 'destructive' : 'secondary'}
                                            className="text-[10px] px-1.5 py-0"
                                          >
                                            {arquivo.status === 'pronto' ? '✓ Pronto' : arquivo.status === 'erro' ? '✗ Erro' : '⏳ Processando'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {arquivo.url && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => window.open(arquivo.url, '_blank')}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => handleRemoveArquivo(arquivo.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          
                          {/* Info sobre processamento */}
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                <p className="font-medium mb-1">Como funciona:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                  <li><strong>PDF/Texto:</strong> O conteúdo é extraído e usado pela IA</li>
                                  <li><strong>Imagens:</strong> A IA descreve e analisa o conteúdo visual</li>
                                  <li><strong>Áudio:</strong> Transcrição automática do áudio</li>
                                  <li><strong>Vídeo:</strong> Análise de frames e transcrição do áudio</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Seletor de Agendas - Apenas para IA de Agendamento */}
                        {id === 'agendamento' && (
                          <>
                            <Separator />
                            
                            <div className="p-4 border rounded-lg space-y-4 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                  <Calendar className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <Label className="text-base">📅 Agendas para Consulta de Horários</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Selecione quais agendas a IA deve consultar para verificar disponibilidade
                                  </p>
                                </div>
                              </div>
                              
                              {/* Seletor de Agendas */}
                              <div className="space-y-3">
                                {availableAgendas.length > 0 ? (
                                  <div className="space-y-2">
                                    {availableAgendas.map(agenda => (
                                      <div 
                                        key={agenda.id}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                          selectedAgendas.includes(agenda.id)
                                            ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                                            : 'border-border hover:border-green-300 hover:bg-green-50/50'
                                        }`}
                                        onClick={() => {
                                          if (selectedAgendas.includes(agenda.id)) {
                                            setSelectedAgendas(selectedAgendas.filter(a => a !== agenda.id));
                                          } else {
                                            setSelectedAgendas([...selectedAgendas, agenda.id]);
                                          }
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                              selectedAgendas.includes(agenda.id) 
                                                ? 'bg-green-500 text-white' 
                                                : 'bg-muted'
                                            }`}>
                                              {selectedAgendas.includes(agenda.id) ? (
                                                <CheckCircle className="h-4 w-4" />
                                              ) : (
                                                <Calendar className="h-4 w-4" />
                                              )}
                                            </div>
                                            <div>
                                              <p className="font-medium text-sm">{agenda.nome}</p>
                                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline" className="text-[10px]">
                                                  {agenda.tipo === 'colaborador' ? 'Profissional' : 'Agenda Geral'}
                                                </Badge>
                                                {agenda.profissional_nome && (
                                                  <span>• {agenda.profissional_nome}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-6 text-center border-2 border-dashed rounded-lg">
                                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                                    <p className="text-sm font-medium">Nenhuma agenda encontrada</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Crie agendas no menu "Agenda" para a IA poder consultar horários
                                    </p>
                                  </div>
                                )}
                                
                                {selectedAgendas.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                      {selectedAgendas.length} agenda(s) selecionada(s)
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              
                              {/* Info */}
                              <div className="p-3 bg-green-100 dark:bg-green-950/30 rounded-lg">
                                <div className="flex items-start gap-2">
                                  <Lightbulb className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div className="text-xs text-green-700 dark:text-green-300">
                                    <p className="font-medium mb-1">Como funciona:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>A IA consulta apenas as agendas selecionadas</li>
                                      <li>Verifica automaticamente horários disponíveis</li>
                                      <li>Permite agendar em qualquer agenda marcada</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {/* Seção Antes e Depois - Para IA de Atendimento e Agendamento */}
                        {(id === 'atendimento' || id === 'agendamento') && (
                          <>
                            <Separator />
                            
                            <div className="p-4 border rounded-lg space-y-4 bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                                  <Image className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <Label className="text-base">📸 Casos Antes e Depois</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Cadastre resultados de tratamentos para a IA mostrar aos leads
                                  </p>
                                </div>
                              </div>
                              
                              {/* Formulário para novo caso */}
                              <div className="space-y-4 p-4 bg-white dark:bg-gray-900 rounded-lg border">
                    <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label className="text-sm">Título do Tratamento *</Label>
                                    <Input
                                      placeholder="Ex: Clareamento Dental"
                                      value={novoCaso.titulo || ''}
                                      onChange={(e) => setNovoCaso({...novoCaso, titulo: e.target.value})}
                                    />
                      </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm">Categoria</Label>
                                    <Select 
                                      value={novoCaso.categoria} 
                                      onValueChange={(v) => setNovoCaso({...novoCaso, categoria: v})}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="geral">Geral</SelectItem>
                                        <SelectItem value="estetica">Estética</SelectItem>
                                        <SelectItem value="odontologia">Odontologia</SelectItem>
                                        <SelectItem value="dermatologia">Dermatologia</SelectItem>
                                        <SelectItem value="cirurgia">Cirurgia</SelectItem>
                                        <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                                        <SelectItem value="nutricao">Nutrição</SelectItem>
                                        <SelectItem value="outro">Outro</SelectItem>
                                      </SelectContent>
                                    </Select>
                      </div>
                    </div>
                                
                                <div className="space-y-2">
                                  <Label className="text-sm">Legenda / Descrição do Tratamento</Label>
                                  <Textarea
                                    placeholder="Descreva o tratamento realizado, tempo de recuperação, benefícios..."
                                    value={novoCaso.legenda || ''}
                                    onChange={(e) => setNovoCaso({...novoCaso, legenda: e.target.value})}
                                    rows={2}
                                  />
                  </div>

                                {/* Upload Antes e Depois */}
                                <div className="grid grid-cols-2 gap-4">
                                  {/* ANTES */}
                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-red-600">📷 ANTES</Label>
                                    <div 
                                      className="border-2 border-dashed border-red-200 rounded-lg p-4 text-center hover:border-red-400 hover:bg-red-50/50 transition-colors cursor-pointer min-h-[120px] flex flex-col items-center justify-center"
                                      onClick={() => antesInputRef.current?.click()}
                                    >
                                      <input
                                        ref={antesInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        onChange={(e) => handleUploadAntesDepois(e, 'antes')}
                                        className="hidden"
                                      />
                                      {tempAntes ? (
                                        <div className="relative w-full">
                                          {tempAntes.tipo === 'imagem' ? (
                                            <img 
                                              src={tempAntes.url} 
                                              alt="Antes" 
                                              className="w-full h-20 object-cover rounded"
                                            />
                                          ) : (
                                            <video 
                                              src={tempAntes.url} 
                                              className="w-full h-20 object-cover rounded"
                                            />
                                          )}
                                          <Badge className="absolute top-1 right-1 text-[10px]">
                                            {tempAntes.tipo === 'imagem' ? '🖼️' : '🎬'}
                                          </Badge>
                                        </div>
                                      ) : (
                                        <>
                                          <Upload className="h-8 w-8 text-red-300 mb-2" />
                                          <p className="text-xs text-muted-foreground">Clique para enviar</p>
                                          <p className="text-[10px] text-muted-foreground">Imagem ou Vídeo</p>
                                        </>
                                      )}
                    </div>
                  </div>

                                  {/* DEPOIS */}
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-green-600">📷 DEPOIS</Label>
                                    <div 
                                      className="border-2 border-dashed border-green-200 rounded-lg p-4 text-center hover:border-green-400 hover:bg-green-50/50 transition-colors cursor-pointer min-h-[120px] flex flex-col items-center justify-center"
                                      onClick={() => depoisInputRef.current?.click()}
                                    >
                                      <input
                                        ref={depoisInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        onChange={(e) => handleUploadAntesDepois(e, 'depois')}
                                        className="hidden"
                                      />
                                      {tempDepois ? (
                                        <div className="relative w-full">
                                          {tempDepois.tipo === 'imagem' ? (
                                            <img 
                                              src={tempDepois.url} 
                                              alt="Depois" 
                                              className="w-full h-20 object-cover rounded"
                                            />
                                          ) : (
                                            <video 
                                              src={tempDepois.url} 
                                              className="w-full h-20 object-cover rounded"
                                            />
                                          )}
                                          <Badge className="absolute top-1 right-1 text-[10px]">
                                            {tempDepois.tipo === 'imagem' ? '🖼️' : '🎬'}
                                          </Badge>
                                        </div>
                                      ) : (
                                        <>
                                          <Upload className="h-8 w-8 text-green-300 mb-2" />
                                          <p className="text-xs text-muted-foreground">Clique para enviar</p>
                                          <p className="text-[10px] text-muted-foreground">Imagem ou Vídeo</p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <Button 
                                  onClick={handleAddCasoAntesDepois} 
                                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                                  disabled={uploadingCaso}
                                >
                                  {uploadingCaso ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                  )}
                                  Adicionar Caso Antes/Depois
                                </Button>
                              </div>
                              
                              {/* Lista de casos cadastrados */}
                              {casosAntesDepois.length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">Casos Cadastrados</Label>
                                    <Badge variant="secondary">{casosAntesDepois.length} caso(s)</Badge>
                                  </div>
                                  
                                  <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                                    {casosAntesDepois.map(caso => (
                                      <div 
                                        key={caso.id} 
                                        className="p-3 bg-white dark:bg-gray-900 rounded-lg border flex gap-3"
                                      >
                                        {/* Preview das imagens */}
                                        <div className="flex gap-1 flex-shrink-0">
                                          <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded border-2 border-red-200 flex items-center justify-center overflow-hidden">
                                            {caso.imagemAntes ? (
                                              <img src={caso.imagemAntes} alt="Antes" className="w-full h-full object-cover" />
                                            ) : caso.videoAntes ? (
                                              <FileVideo className="h-6 w-6 text-red-400" />
                                            ) : (
                                              <span className="text-[10px] text-red-400">Antes</span>
                                            )}
                                          </div>
                                          <div className="w-16 h-16 bg-green-50 dark:bg-green-950/30 rounded border-2 border-green-200 flex items-center justify-center overflow-hidden">
                                            {caso.imagemDepois ? (
                                              <img src={caso.imagemDepois} alt="Depois" className="w-full h-full object-cover" />
                                            ) : caso.videoDepois ? (
                                              <FileVideo className="h-6 w-6 text-green-400" />
                                            ) : (
                                              <span className="text-[10px] text-green-400">Depois</span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Info do caso */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <p className="font-medium text-sm truncate">{caso.titulo}</p>
                                              <Badge variant="outline" className="text-[10px] mt-1">{caso.categoria}</Badge>
                                            </div>
                                            <Button 
                                              variant="ghost" 
                                              size="sm"
                                              onClick={() => handleRemoveCasoAntesDepois(caso.id)}
                                            >
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </div>
                                          {caso.legenda && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{caso.legenda}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Info */}
                              <div className="p-3 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-950/30 dark:to-purple-950/30 rounded-lg">
                                <div className="flex items-start gap-2">
                                  <Lightbulb className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                  <div className="text-xs text-purple-700 dark:text-purple-300">
                                    <p className="font-medium mb-1">Como a IA usa esses casos:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>Quando o lead pedir referências ou exemplos</li>
                                      <li>Quando perguntar sobre resultados do tratamento</li>
                                      <li>A IA envia a imagem/vídeo com a legenda informativa</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  {/* Aba Treinamento */}
                  <TabsContent value="treinamento" className="space-y-4 mt-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {/* Introdução */}
                        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <Brain className="h-6 w-6 text-indigo-500" />
                            <h3 className="font-semibold">Treinamento da IA</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Ensine a IA como responder situações específicas. Quanto mais exemplos, mais inteligente ela fica!
                          </p>
                        </div>
                        
                        {/* Adicionar Treinamento */}
                        <div className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                              <Lightbulb className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div>
                              <Label className="text-base">Novo Treinamento</Label>
                              <p className="text-sm text-muted-foreground">
                                Adicione um exemplo de pergunta e resposta ideal
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <Select 
                              value={novoTreinamento.categoria} 
                              onValueChange={(v) => setNovoTreinamento({...novoTreinamento, categoria: v})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Categoria do treinamento" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="geral">Geral</SelectItem>
                                <SelectItem value="atendimento">Atendimento</SelectItem>
                                <SelectItem value="vendas">Vendas</SelectItem>
                                <SelectItem value="agendamento">Agendamento</SelectItem>
                                <SelectItem value="suporte">Suporte</SelectItem>
                                <SelectItem value="objecoes">Objeções</SelectItem>
                                <SelectItem value="fechamento">Fechamento</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="space-y-2">
                              <Label className="text-sm">Quando o cliente perguntar:</Label>
                              <Textarea
                                placeholder="Ex: Vocês trabalham aos sábados?"
                                value={novoTreinamento.perguntaExemplo || ''}
                                onChange={(e) => setNovoTreinamento({...novoTreinamento, perguntaExemplo: e.target.value})}
                                rows={2}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-sm">A IA deve responder:</Label>
                              <Textarea
                                placeholder="Ex: Sim! Funcionamos aos sábados das 8h às 12h. Gostaria de agendar um horário?"
                                value={novoTreinamento.respostaIdeal || ''}
                                onChange={(e) => setNovoTreinamento({...novoTreinamento, respostaIdeal: e.target.value})}
                                rows={3}
                              />
                            </div>
                            
                            <Button onClick={handleAddTreinamento} className="w-full">
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Treinamento
                            </Button>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        {/* Lista de Treinamentos */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-base">Treinamentos Cadastrados</Label>
                            <Badge variant="secondary">{treinamentos.length} exemplos</Badge>
                          </div>
                          
                          {treinamentos.length > 0 ? (
                            <div className="space-y-3">
                              {treinamentos.map(t => (
                                <div key={t.id} className="p-4 border rounded-lg space-y-2">
                                  <div className="flex items-start justify-between">
                                    <Badge variant="outline" className="text-xs">{t.categoria}</Badge>
                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveTreinamento(t.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Cliente pergunta:</p>
                                      <p className="text-sm">{t.perguntaExemplo}</p>
                                    </div>
                                    <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                                      <p className="text-xs text-green-600 dark:text-green-400 mb-1">IA responde:</p>
                                      <p className="text-sm">{t.respostaIdeal}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">Nenhum treinamento cadastrado</p>
                              <p className="text-xs mt-1">Adicione exemplos para a IA aprender</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Dicas */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                            <div className="text-xs text-amber-700 dark:text-amber-300">
                              <p className="font-medium mb-1">Dicas para bons treinamentos:</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li>Use exemplos reais de conversas com clientes</li>
                                <li>Inclua variações de como a mesma pergunta pode ser feita</li>
                                <li>Treine respostas para objeções comuns</li>
                                <li>Quanto mais exemplos, mais precisa a IA fica</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  {/* Nova aba Follow-up */}
                  <TabsContent value="followup" className="space-y-4 mt-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {/* Ativar Follow-up */}
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                              <RefreshCw className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                              <Label className="text-base">Follow-up Automático</Label>
                              <p className="text-sm text-muted-foreground">
                                Enviar mensagem quando lead não responder
                              </p>
                            </div>
                          </div>
                          <Switch 
                            checked={followUpEnabled} 
                            onCheckedChange={setFollowUpEnabled}
                          />
                        </div>
                        
                        {followUpEnabled && (
                          <>
                            {/* Tempo de espera */}
                            <div className="p-4 border rounded-lg space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                  <Clock className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                  <Label className="text-base">Tempo de espera</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Aguardar antes de enviar o follow-up
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={followUpTime}
                                  onChange={(e) => setFollowUpTime(parseInt(e.target.value) || 30)}
                                  min={1}
                                  max={1440}
                                  className="w-24"
                                />
                                <Select value={followUpTimeUnit} onValueChange={(v: 'minutes' | 'hours') => setFollowUpTimeUnit(v)}>
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="minutes">Minutos</SelectItem>
                                    <SelectItem value="hours">Horas</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            {/* Máximo de follow-ups */}
                            <div className="p-4 border rounded-lg space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                                  <MessageSquare className="h-5 w-5 text-gray-500" />
                                </div>
                                <div>
                                  <Label className="text-base">Máximo de follow-ups</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Quantas vezes a IA pode enviar follow-up
                                  </p>
                                </div>
                              </div>
                              <Input
                                type="number"
                                value={maxFollowUps}
                                onChange={(e) => setMaxFollowUps(parseInt(e.target.value) || 2)}
                                min={1}
                                max={10}
                                className="w-24"
                              />
                            </div>
                            
                            {/* Mensagem de follow-up */}
                            <div className="p-4 border rounded-lg space-y-3">
                              <Label className="text-base">Mensagem de Follow-up</Label>
                              <p className="text-sm text-muted-foreground">
                                Mensagem que a IA enviará quando o lead não responder
                              </p>
                              <Textarea
                                placeholder="Olá! Vi que você não respondeu. Posso te ajudar com algo?"
                                value={followUpMessage}
                                onChange={(e) => setFollowUpMessage(e.target.value)}
                                rows={4}
                                className="resize-none"
                              />
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-2">Variáveis disponíveis:</p>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="secondary" className="text-xs">{'{lead.name}'}</Badge>
                                  <Badge variant="secondary" className="text-xs">{'{company.name}'}</Badge>
                                  <Badge variant="secondary" className="text-xs">{'{last_message}'}</Badge>
                                </div>
                              </div>
                            </div>
                            
                            {/* Preview */}
                            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-sm text-green-700 dark:text-green-300">Preview do Follow-up</span>
                              </div>
                              <p className="text-sm text-green-800 dark:text-green-200">
                                Se o lead não responder em <strong>{followUpTime} {followUpTimeUnit === 'minutes' ? 'minutos' : 'horas'}</strong>, 
                                a IA enviará até <strong>{maxFollowUps}</strong> mensagem(ns) de follow-up.
                              </p>
                            </div>
                          </>
                        )}
                        
                        {!followUpEnabled && (
                          <div className="p-8 text-center text-muted-foreground">
                            <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Ative o follow-up automático para configurar</p>
                            <p className="text-xs mt-1">A IA enviará mensagens quando o lead não responder</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="prompt" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Prompt Personalizado</Label>
                      <p className="text-sm text-muted-foreground">
                        Adicione instruções específicas para personalizar o comportamento da IA.
                        Deixe em branco para usar o prompt padrão.
                      </p>
                      <Textarea
                        placeholder={`Exemplo: 
- Sempre mencione que oferecemos 30% de desconto para novos clientes
- Foque em destacar os benefícios do nosso serviço
- Se o cliente perguntar sobre preço, sugira uma consulta gratuita`}
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold mb-2">Variáveis disponíveis:</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li><code className="bg-muted px-1 rounded">{'{lead.name}'}</code> - Nome do lead</li>
                        <li><code className="bg-muted px-1 rounded">{'{lead.phone}'}</code> - Telefone do lead</li>
                        <li><code className="bg-muted px-1 rounded">{'{lead.email}'}</code> - Email do lead</li>
                        <li><code className="bg-muted px-1 rounded">{'{lead.company}'}</code> - Empresa do lead</li>
                        <li><code className="bg-muted px-1 rounded">{'{company.name}'}</code> - Nome da sua empresa</li>
                      </ul>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="teste" className="space-y-4 mt-4">
                    <div className="flex flex-col h-[500px]">
                      {/* Header do Chat */}
                      <div className="flex items-center justify-between pb-3 border-b">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center`}>
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{name}</p>
                            <p className="text-xs text-muted-foreground">Modo de teste</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleClearChat}
                          disabled={chatMessages.length === 0}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Limpar
                        </Button>
                      </div>
                      
                      {/* Área de Mensagens */}
                      <ScrollArea className="flex-1 py-4">
                        <div className="space-y-4 px-1">
                          {chatMessages.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">Inicie uma conversa com a IA</p>
                              <p className="text-xs mt-1">Digite uma mensagem abaixo para testar</p>
                            </div>
                          ) : (
                            chatMessages.map((msg) => (
                              <div 
                                key={msg.id} 
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    msg.role === 'user' 
                                      ? 'bg-primary' 
                                      : color
                                  }`}>
                                    {msg.role === 'user' 
                                      ? <User className="h-4 w-4 text-white" />
                                      : <Bot className="h-4 w-4 text-white" />
                                    }
                                  </div>
                                  <div className={`rounded-2xl px-4 py-2 ${
                                    msg.role === 'user'
                                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                      : 'bg-muted rounded-tl-sm'
                                  }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    {msg.action && (
                                      <div className="mt-2 pt-2 border-t border-current/10">
                                        <Badge variant="outline" className="text-xs">
                                          {msg.action}
                                          {msg.actionParams && `: ${msg.actionParams}`}
                                        </Badge>
                                      </div>
                                    )}
                                    <p className="text-[10px] opacity-60 mt-1">
                                      {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                          
                          {testing && (
                            <div className="flex justify-start">
                              <div className="flex gap-2">
                                <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center`}>
                                  <Bot className="h-4 w-4 text-white" />
                                </div>
                                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                                  <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div ref={chatEndRef} />
                        </div>
                      </ScrollArea>
                      
                      {/* Preview dos arquivos anexados */}
                      {testFiles.length > 0 && (
                        <div className="py-2 px-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">Arquivos anexados:</p>
                          <div className="flex flex-wrap gap-2">
                            {testFiles.map(file => (
                              <div key={file.id} className="flex items-center gap-2 bg-background rounded-lg px-2 py-1 border">
                                {file.type === 'image' && file.previewUrl && (
                                  <img src={file.previewUrl} alt={file.name} className="h-8 w-8 object-cover rounded" />
                                )}
                                {file.type === 'pdf' && <FileType className="h-4 w-4 text-orange-500" />}
                                {file.type === 'audio' && <FileAudio className="h-4 w-4 text-purple-500" />}
                                {file.type === 'video' && <FileVideo className="h-4 w-4 text-red-500" />}
                                <span className="text-xs truncate max-w-[100px]">{file.name}</span>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeTestFile(file.id)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Aviso */}
                      <div className="py-2 px-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg flex items-center gap-2 text-xs">
                        <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0" />
                        <span className="text-amber-700 dark:text-amber-300">
                          Modo de teste: As ações são simuladas e não afetam dados reais
                        </span>
                      </div>
                      
                      {/* Hidden file inputs */}
                      <input 
                        ref={testImageInputRef}
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleTestFileSelect(e, 'image')}
                      />
                      <input 
                        ref={testPdfInputRef}
                        type="file" 
                        accept=".pdf,application/pdf" 
                        className="hidden" 
                        onChange={(e) => handleTestFileSelect(e, 'pdf')}
                      />
                      <input 
                        ref={testAudioInputRef}
                        type="file" 
                        accept="audio/*" 
                        className="hidden" 
                        onChange={(e) => handleTestFileSelect(e, 'audio')}
                      />
                      <input 
                        ref={testVideoInputRef}
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={(e) => handleTestFileSelect(e, 'video')}
                      />
                      
                      {/* Botões de anexo */}
                      <div className="flex items-center gap-1 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => testImageInputRef.current?.click()}
                          disabled={testing}
                          className="h-8 px-2"
                          title="Anexar imagem"
                        >
                          <Image className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => testPdfInputRef.current?.click()}
                          disabled={testing}
                          className="h-8 px-2"
                          title="Anexar PDF"
                        >
                          <FileType className="h-4 w-4 text-orange-600" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => testAudioInputRef.current?.click()}
                          disabled={testing}
                          className="h-8 px-2"
                          title="Anexar áudio"
                        >
                          <FileAudio className="h-4 w-4 text-purple-600" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => testVideoInputRef.current?.click()}
                          disabled={testing}
                          className="h-8 px-2"
                          title="Anexar vídeo"
                        >
                          <FileVideo className="h-4 w-4 text-red-600" />
                        </Button>
                        <span className="text-xs text-muted-foreground ml-2">
                          Anexar arquivo para testar
                        </span>
                      </div>
                      
                      {/* Input de Mensagem */}
                      <div className="flex gap-2 pt-2 border-t mt-2">
                        <Input
                          placeholder="Digite sua mensagem..."
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTestAgent()}
                          disabled={testing}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleTestAgent} 
                          disabled={testing || (!testMessage.trim() && testFiles.length === 0)}
                        >
                          {testing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setConfigOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveConfig} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar Configurações
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Logs
            </Button>
          </div>
        )}

        {!active && (
          <div className="text-center p-4 text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ative para começar a usar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
