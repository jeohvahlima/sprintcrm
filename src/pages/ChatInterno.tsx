import { useState, useEffect, useRef, useCallback } from 'react';
import { useInternalChat, InternalConversation } from '@/hooks/useInternalChat';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { useInternalChatNotifications } from '@/hooks/useInternalChatNotifications';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useMeetings } from '@/hooks/useMeetings';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Send, Paperclip, Image as ImageIcon, File as FileIcon, Share2, Users, MoreVertical, ArrowLeft, Video, Mic, Square, Loader2, X, Settings, Phone, VideoIcon, Clock, Link2, MessagesSquare } from 'lucide-react';
import { useFloatingButtonsVisibility } from '@/hooks/useFloatingButtonsVisibility';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { NewConversationDialog } from '@/components/internal-chat/NewConversationDialog';
import { ShareItemDialog } from '@/components/internal-chat/ShareItemDialog';
import { EditGroupDialog } from '@/components/internal-chat/EditGroupDialog';
import { MessageItem } from '@/components/internal-chat/MessageItem';
import { VideoCallModalV2 } from '@/components/meetings/VideoCallModalV2';
import { StartCallDialog } from '@/components/meetings/StartCallDialog';
import { CreatePublicMeetingDialog } from '@/components/meetings/CreatePublicMeetingDialog';
import { GroupCallModal } from '@/components/meetings/GroupCallModal';
import { MeetingHistory } from '@/components/meetings/MeetingHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
export default function ChatInterno() {
  const { chatVisible, toggleChat } = useFloatingButtonsVisibility();
  const [selectedConversation, setSelectedConversation] = useState<InternalConversation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [activeTab, setActiveTab] = useState('conversas');
  const [showStartCallDialog, setShowStartCallDialog] = useState(false);
  const [showCreatePublicMeeting, setShowCreatePublicMeeting] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState<{ meetingId: string } | null>(null);

  // Call states
  const [activeCall, setActiveCall] = useState<{
    meetingId: string;
    remoteUserId: string;
    remoteUserName: string;
    callType: 'audio' | 'video';
    isCaller: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const {
    conversations,
    loading: conversationsLoading,
    currentUserId,
    createConversation,
    markAsRead,
    updateGroupName,
    addParticipants,
    removeParticipant,
    refresh,
    setActiveConversationId
  } = useInternalChat();
  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    uploadMedia
  } = useInternalMessages(selectedConversation?.id || null);
  const {
    members
  } = useTeamMembers();

  // Hook para atualizar notificações globais
  const { markConversationAsRead } = useInternalChatNotifications();

  // Note: Incoming calls are handled globally by GlobalCallListenerV2 in MainLayout
  const {
    meetings,
    loading: meetingsLoading,
    createMeeting,
    endMeeting,
    addNotes,
    deleteMeeting
  } = useMeetings();

  // Get the other participant for 1:1 calls
  const getCallTarget = useCallback(() => {
    if (!selectedConversation || selectedConversation.is_group) return null;
    const otherParticipant = selectedConversation.participants?.find(p => p.user_id !== currentUserId);
    return otherParticipant ? {
      userId: otherParticipant.user_id,
      userName: otherParticipant.profile?.full_name || otherParticipant.profile?.email || 'Usuário'
    } : null;
  }, [selectedConversation, currentUserId]);

  // Start a call
  const handleStartCall = async (callType: 'audio' | 'video') => {
    const target = getCallTarget();
    if (!target) {
      toast.error('Não é possível iniciar chamada em grupos');
      return;
    }
    const meeting = await createMeeting(callType, target.userId, target.userName);
    if (meeting) {
      setActiveCall({
        meetingId: meeting.id,
        remoteUserId: target.userId,
        remoteUserName: target.userName,
        callType,
        isCaller: true
      });
      toast.info(`Chamando ${target.userName}...`);
    }
  };

  // Start call from dialog (any team member)
  const handleStartCallFromDialog = async (userId: string, userName: string, callType: 'audio' | 'video') => {
    const meeting = await createMeeting(callType, userId, userName);
    if (meeting) {
      setActiveCall({
        meetingId: meeting.id,
        remoteUserId: userId,
        remoteUserName: userName,
        callType,
        isCaller: true
      });
      setShowStartCallDialog(false);
      toast.info(`Chamando ${userName}...`);
    }
  };

  // Note: handleAcceptCall removed - incoming calls handled by GlobalCallListenerV2

  // Handle call ended
  const handleCallEnded = () => {
    if (activeCall) {
      endMeeting(activeCall.meetingId);
    }
    setActiveCall(null);
  };
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);
  // Atualizar conversa ativa e marcar como lido quando seleciona uma conversa
  useEffect(() => {
    if (selectedConversation) {
      setActiveConversationId(selectedConversation.id);
      markAsRead(selectedConversation.id);
      // Atualizar notificações globais na sidebar
      markConversationAsRead();
    } else {
      setActiveConversationId(null);
    }
  }, [selectedConversation, markAsRead, setActiveConversationId, markConversationAsRead]);

  // Marcar como lido automaticamente quando novas mensagens chegam na conversa ativa
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      markAsRead(selectedConversation.id);
      // Atualizar notificações globais na sidebar
      markConversationAsRead();
    }
  }, [selectedConversation, messages.length, markAsRead, markConversationAsRead]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [messageText]);
  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true;
    const name = conv.name || conv.participants?.map(p => p.profile?.full_name).join(', ') || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });
  const handleSendMessage = async () => {
    if (!messageText.trim() && !selectedFile || !selectedConversation) return;
    try {
      if (selectedFile) {
        await handleSendFile(selectedFile);
        setSelectedFile(null);
      }
      if (messageText.trim()) {
        await sendMessage(messageText.trim());
        setMessageText('');
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };
  const handleSendFile = async (file: File) => {
    setUploadingMedia(true);
    try {
      const url = await uploadMedia(file);
      if (!url) {
        toast.error('Erro ao fazer upload do arquivo');
        return;
      }
      let messageType = 'document';
      if (file.type.startsWith('image/')) messageType = 'image';else if (file.type.startsWith('video/')) messageType = 'video';else if (file.type.startsWith('audio/')) messageType = 'audio';else if (file.type === 'application/pdf') messageType = 'pdf';
      await sendMessage('', messageType, url, file.name);
    } finally {
      setUploadingMedia(false);
    }
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle paste for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setSelectedFile(file);
          toast.info('Imagem colada! Clique em enviar.');
        }
        return;
      }
    }
  }, []);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo: 50MB');
        return;
      }
      setSelectedFile(file);
    }
    e.target.value = '';
  };

  // Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm'
        });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
          type: 'audio/webm'
        });
        stream.getTracks().forEach(track => track.stop());
        if (audioFile.size > 0) {
          setSelectedFile(audioFile);
          toast.info('Áudio gravado! Clique em enviar.');
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      toast.info('Gravando áudio...');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Erro ao acessar o microfone');
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const getFileIcon = () => {
    if (!selectedFile) return <FileIcon className="h-4 w-4" />;
    if (selectedFile.type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (selectedFile.type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (selectedFile.type.startsWith('audio/')) return <Mic className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };
  const handleConversationSelect = (conv: InternalConversation) => {
    setSelectedConversation(conv);
    setShowMobileList(false);
  };
  const handleConversationCreated = async (conversationId: string) => {
    const updatedConversations = await refresh();
    const newConv = updatedConversations?.find(c => c.id === conversationId);
    if (newConv) {
      setSelectedConversation(newConv);
      setShowMobileList(false);
    }
    setNewConversationOpen(false);
  };
  const getConversationName = (conv: InternalConversation) => {
    if (conv.name) return conv.name;
    const otherParticipants = conv.participants?.filter(p => p.user_id !== currentUserId);
    if (!otherParticipants || otherParticipants.length === 0) return 'Conversa';
    const names = otherParticipants.map(p => p.profile?.full_name || p.profile?.email || '').filter(n => n);
    return names.length > 0 ? names.join(', ') : 'Conversa';
  };
  const getConversationAvatar = (conv: InternalConversation) => {
    if (conv.is_group) return null;
    const otherParticipant = conv.participants?.find(p => p.user_id !== currentUserId);
    return otherParticipant?.profile?.avatar_url;
  };
  const getInitials = (name: string) => {
    if (!name || name === 'Conversa') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  return <><div className="h-[calc(100vh-7rem)] flex bg-background rounded-xl border border-border" style={{ overflow: 'hidden' }}>
      {/* Painel Esquerdo */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-card ${!showMobileList && 'hidden md:flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">Bate-papo Interno</h2>
            <div className="flex gap-1">
              <div className="flex items-center gap-1 mr-1">
                <Switch id="chat-float" checked={chatVisible} onCheckedChange={toggleChat} className="scale-75" />
                <Label htmlFor="chat-float" className="text-[10px] text-muted-foreground cursor-pointer">Popup</Label>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShowStartCallDialog(true)} title="Nova Chamada">
                <Phone className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setShowCreatePublicMeeting(true)} title="Sala Pública">
                <Link2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setNewConversationOpen(true)} title="Nova Conversa">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="conversas" className="text-xs gap-1">
                <MessagesSquare className="h-3.5 w-3.5" />
                Chats
              </TabsTrigger>
              <TabsTrigger value="chamadas" className="text-xs gap-1">
                <Video className="h-3.5 w-3.5" />
                Chamadas
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs gap-1">
                <Clock className="h-3.5 w-3.5" />
                Histórico
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Conteúdo baseado na tab ativa */}
        {activeTab === 'conversas' && (
          <>
            <div className="px-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar conversas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {conversationsLoading ? <div className="p-4 text-center text-muted-foreground">Carregando...</div> : filteredConversations.length === 0 ? <div className="p-4 text-center text-muted-foreground">
                  {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
                </div> : <div className="divide-y divide-border">
                  {filteredConversations.map(conv => {
                const isSelected = selectedConversation?.id === conv.id;
                return <div key={conv.id} className={`w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors ${isSelected ? 'bg-accent' : ''}`}>
                        <button onClick={() => handleConversationSelect(conv)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage src={getConversationAvatar(conv) || undefined} />
                            <AvatarFallback className={conv.is_group ? 'bg-primary/20' : 'bg-muted'}>
                              {conv.is_group ? <Users className="h-5 w-5 text-primary" /> : getInitials(getConversationName(conv))}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground truncate">
                                {getConversationName(conv)}
                              </span>
                              {conv.last_message && <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {format(new Date(conv.last_message.created_at), 'HH:mm', {
                            locale: ptBR
                          })}
                                </span>}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-sm text-muted-foreground truncate">
                                {conv.last_message?.content || 'Sem mensagens'}
                              </p>
                              {conv.unread_count > 0 && <Badge variant="destructive" className="ml-2 flex-shrink-0">
                                  {conv.unread_count}
                                </Badge>}
                            </div>
                          </div>
                        </button>
                        
                        {/* Menu de três pontos */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border shadow-lg z-50">
                            {conv.is_group && <>
                                <DropdownMenuItem onClick={() => {
                          setSelectedConversation(conv);
                          setEditGroupOpen(true);
                        }}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Editar grupo
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>}
                            <DropdownMenuItem onClick={() => {
                        setSelectedConversation(conv);
                        setShareDialogOpen(true);
                      }}>
                              <Share2 className="h-4 w-4 mr-2" />
                              Compartilhar item
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>;
              })}
                </div>}
            </ScrollArea>
          </>
        )}

        {activeTab === 'chamadas' && (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {/* Quick call cards */}
              <div
                onClick={() => setShowStartCallDialog(true)}
                className="flex items-center gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
              >
                <div className="p-2 rounded-full bg-primary/20">
                  <VideoIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Chamada de Vídeo</h3>
                  <p className="text-xs text-muted-foreground">Inicie uma videochamada</p>
                </div>
              </div>

              <div
                onClick={() => setShowStartCallDialog(true)}
                className="flex items-center gap-3 p-4 rounded-lg border border-green-500/20 bg-green-500/5 cursor-pointer hover:bg-green-500/10 transition-colors"
              >
                <div className="p-2 rounded-full bg-green-500/20">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Chamada de Áudio</h3>
                  <p className="text-xs text-muted-foreground">Inicie uma ligação de áudio</p>
                </div>
              </div>

              <div
                onClick={() => setShowCreatePublicMeeting(true)}
                className="flex items-center gap-3 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 transition-colors"
              >
                <div className="p-2 rounded-full bg-blue-500/20">
                  <Link2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Sala Pública</h3>
                  <p className="text-xs text-muted-foreground">Crie link para participantes externos</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {activeTab === 'historico' && (
          <ScrollArea className="flex-1">
            <div className="p-2">
              <MeetingHistory
                meetings={meetings}
                loading={meetingsLoading}
                onAddNotes={addNotes}
                onDelete={deleteMeeting}
              />
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Área de Chat */}
      <div 
        className={`flex flex-col ${showMobileList && 'hidden md:flex'}`}
        style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}
      >
        {selectedConversation ? <>
            {/* Header do Chat - Layout fixo com CSS inline para garantir visibilidade */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center',
                padding: '8px',
                gap: '6px',
                minHeight: '48px',
                borderBottom: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                width: '100%',
                boxSizing: 'border-box',
                overflow: 'visible'
              }}
            >
              {/* Botão voltar - mobile only */}
              <button 
                onClick={() => setShowMobileList(true)}
                className="md:hidden"
                style={{ 
                  width: '28px', 
                  height: '28px', 
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              
              {/* Avatar */}
              <div style={{ flexShrink: 0, width: '32px', height: '32px' }}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getConversationAvatar(selectedConversation) || undefined} />
                  <AvatarFallback className={selectedConversation.is_group ? 'bg-primary/20' : 'bg-muted'}>
                    {selectedConversation.is_group ? <Users className="h-4 w-4 text-primary" /> : getInitials(getConversationName(selectedConversation))}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              {/* Nome - expande mas com overflow hidden */}
              <div style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}>
                <div 
                  className="font-semibold text-foreground text-sm"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {getConversationName(selectedConversation)}
                </div>
                {selectedConversation.is_group && selectedConversation.participants && (
                  <div 
                    className="text-xs text-muted-foreground"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {selectedConversation.participants.length} participantes
                  </div>
                )}
              </div>

              {/* Container de botões - NUNCA encolhe */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '2px',
                  flexShrink: 0,
                  marginLeft: 'auto'
                }}
              >
                {/* Botões de chamada - apenas para 1:1 */}
                {!selectedConversation.is_group && (
                  <>
                    <button 
                      onClick={() => handleStartCall('audio')} 
                      className="text-muted-foreground hover:text-primary"
                      style={{ 
                        width: '28px', 
                        height: '28px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleStartCall('video')} 
                      className="text-muted-foreground hover:text-primary"
                      style={{ 
                        width: '28px', 
                        height: '28px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      <VideoIcon className="h-4 w-4" />
                    </button>
                  </>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      style={{ 
                        width: '28px', 
                        height: '28px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selectedConversation.is_group && <>
                        <DropdownMenuItem onClick={() => setEditGroupOpen(true)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Editar grupo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>}
                    <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Compartilhar item do CRM
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4 bg-muted/30">
              {messagesLoading ? <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div> : messages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Envie a primeira mensagem!</p>
                </div> : <div className="space-y-4">
                  {messages.map(message => <MessageItem key={message.id} message={message} isOwn={message.sender_id === currentUserId} />)}
                  <div ref={messagesEndRef} />
                </div>}
            </ScrollArea>

            {/* Selected file preview */}
            {selectedFile && <div className="px-4 py-2 border-t border-border bg-accent/30">
                <div className="flex items-center gap-2">
                  {getFileIcon()}
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>}

            {/* Recording indicator */}
            {isRecording && <div className="px-4 py-2 border-t border-border bg-destructive/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                  <span className="text-sm text-destructive font-medium">
                    Gravando... {formatRecordingTime(recordingTime)}
                  </span>
                </div>
              </div>}

            {/* Input de Mensagem */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-end gap-2">
                {/* Hidden file inputs */}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                <input type="file" ref={videoInputRef} onChange={handleFileSelect} className="hidden" accept="video/*" />
                <input type="file" ref={audioInputRef} onChange={handleFileSelect} className="hidden" accept="audio/*" />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0" disabled={uploadingMedia || isRecording}>
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px] bg-popover border shadow-lg z-50">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Imagem
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => {
                  if (videoInputRef.current) {
                    videoInputRef.current.click();
                  }
                }}>
                      <Video className="h-4 w-4 mr-2" />
                      Vídeo
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => {
                  if (audioInputRef.current) {
                    audioInputRef.current.click();
                  }
                }}>
                      <Mic className="h-4 w-4 mr-2" />
                      Áudio
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx';
                    fileInputRef.current.click();
                  }
                }}>
                      <FileIcon className="h-4 w-4 mr-2" />
                      Documento
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => setShareDialogOpen(true)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Item do CRM
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Record audio button */}
                <Button variant={isRecording ? "destructive" : "ghost"} size="icon" className="shrink-0" onClick={isRecording ? stopRecording : startRecording} disabled={uploadingMedia}>
                  {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                <Textarea ref={textareaRef} placeholder="Digite sua mensagem... (Ctrl+V para colar imagem)" value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={handleKeyPress} onPaste={handlePaste} className="min-h-[40px] max-h-[200px] resize-none flex-1" rows={1} disabled={isRecording} />
                
                <Button onClick={handleSendMessage} disabled={!messageText.trim() && !selectedFile || uploadingMedia || isRecording} size="icon" className="shrink-0">
                  {uploadingMedia ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </> : <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <Users className="h-16 w-16 mb-4 opacity-30" />
            <h3 className="text-xl font-medium mb-2">Chat Interno da Equipe</h3>
            <p className="text-sm mb-6">Selecione uma conversa ou inicie uma nova</p>
            <Button onClick={() => setNewConversationOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conversa
            </Button>
          </div>}
      </div>

      {/* Dialogs */}
      <NewConversationDialog open={newConversationOpen} onOpenChange={setNewConversationOpen} createConversation={createConversation} onCreated={handleConversationCreated} />

      <ShareItemDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} onShare={async (itemType, itemId, itemTitle) => {
      if (selectedConversation) {
        await sendMessage(`📌 ${itemTitle}`, 'shared_item', undefined, undefined, itemType, itemId);
        setShareDialogOpen(false);
      }
    }} />

      {selectedConversation && selectedConversation.is_group && <EditGroupDialog open={editGroupOpen} onOpenChange={setEditGroupOpen} conversation={selectedConversation} currentUserId={currentUserId} onUpdateName={updateGroupName} onAddParticipants={addParticipants} onRemoveParticipant={removeParticipant} onRefresh={async () => {
      const updatedConvs = await refresh();
      const updated = updatedConvs?.find(c => c.id === selectedConversation.id);
      if (updated) {
        setSelectedConversation(updated);
      }
    }} />}

      <StartCallDialog
        open={showStartCallDialog}
        onClose={() => setShowStartCallDialog(false)}
        onStartCall={handleStartCallFromDialog}
      />

      <CreatePublicMeetingDialog
        open={showCreatePublicMeeting}
        onClose={() => setShowCreatePublicMeeting(false)}
        onMeetingCreated={(id) => console.log('Meeting created:', id)}
        onJoinMeeting={(id) => {
          setShowCreatePublicMeeting(false);
          setActiveGroupCall({ meetingId: id });
        }}
      />

      {activeGroupCall && currentUserId && (
        <GroupCallModal
          open={true}
          onClose={() => {
            setActiveGroupCall(null);
            // Refresh meeting history
            if (typeof endMeeting === 'function') {
              // just refresh
            }
          }}
          meetingId={activeGroupCall.meetingId}
          hostUserId={currentUserId}
          hostUserName={members.find(m => m.id === currentUserId)?.full_name || 'Anfitrião'}
        />
      )}

      {activeCall && currentUserId && <VideoCallModalV2 open={true} onClose={() => setActiveCall(null)} meetingId={activeCall.meetingId} localUserId={currentUserId} remoteUserId={activeCall.remoteUserId} remoteUserName={activeCall.remoteUserName} callType={activeCall.callType} isCaller={activeCall.isCaller} onCallEnded={handleCallEnded} />}
    </div></>;
}