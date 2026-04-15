import { useState, useRef, useCallback, useEffect } from 'react';
import { MessageCircle, X, ArrowLeft, Plus, Phone, Users, User, Send, Paperclip, Loader2, Mic, Image, FileText, StopCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useInternalChat, InternalConversation } from '@/hooks/useInternalChat';
import { useInternalMessages, InternalMessage } from '@/hooks/useInternalMessages';
import { NewConversationDialog } from './NewConversationDialog';
import { MessageItem } from './MessageItem';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export const FloatingChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<InternalConversation | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const {
    conversations,
    loading,
    getTotalUnread,
    markAsRead,
    getConversationDisplayName,
    currentUserId,
    createConversation,
    refresh,
  } = useInternalChat();

  const totalUnread = getTotalUnread();

  // Draggable
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const hasMoved = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = dragStartRef.current.x - e.clientX;
    const deltaY = dragStartRef.current.y - e.clientY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) hasMoved.current = true;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 60, dragStartRef.current.posX + deltaX)),
      y: Math.max(0, Math.min(window.innerHeight - 60, dragStartRef.current.posY + deltaY)),
    });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleClick = useCallback(() => {
    if (!hasMoved.current) setIsOpen(prev => !prev);
  }, []);

  const handleSelectConversation = (conv: InternalConversation) => {
    setSelectedConversation(conv);
    markAsRead(conv.id);
  };

  const handleBack = () => setSelectedConversation(null);

  const handleConversationCreated = async (conversationId: string) => {
    setShowNewDialog(false);
    const updated = await refresh();
    const newConvo = updated.find(c => c.id === conversationId);
    if (newConvo) {
      setSelectedConversation(newConvo);
      markAsRead(conversationId);
    }
  };

  const handleCallUser = () => {
    navigate('/chat-interno');
    setIsOpen(false);
    toast.info('Use o módulo Bate-papo Interno para chamadas de vídeo/voz');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM', { locale: ptBR });
  };

  return (
    <>
      {/* WhatsApp-style floating button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className={`fixed z-50 h-[56px] w-[56px] rounded-full flex items-center justify-center touch-none select-none ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
        style={{
          right: `${position.x}px`,
          bottom: `${position.y}px`,
          transition: isDragging ? 'none' : 'transform 0.2s',
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
        }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
        {totalUnread > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground">
            {totalUnread > 99 ? '99+' : totalUnread}
          </Badge>
        )}
      </button>

      {/* Popup */}
      {isOpen && (
        <div
          className="fixed z-[60] bg-background border rounded-xl shadow-2xl overflow-hidden flex flex-col"
          style={{
            right: `${position.x}px`,
            bottom: `${position.y + 64}px`,
            width: '416px',
            maxHeight: '576px',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
            <div className="flex items-center gap-2">
              {selectedConversation && (
                <button onClick={handleBack} className="p-1 rounded hover:bg-white/20 transition-colors">
                  <ArrowLeft className="h-4 w-4 text-white" />
                </button>
              )}
              <Users className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold text-white truncate max-w-[160px]">
                {selectedConversation ? getConversationDisplayName(selectedConversation) : 'Chat da Equipe'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {selectedConversation && (
                <button onClick={handleCallUser} className="p-1 rounded hover:bg-white/20 transition-colors" title="Ligar">
                  <Phone className="h-4 w-4 text-white" />
                </button>
              )}
              {!selectedConversation && (
                <button onClick={() => setShowNewDialog(true)} className="p-1 rounded hover:bg-white/20 transition-colors" title="Nova Conversa">
                  <Plus className="h-4 w-4 text-white" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-white/20 transition-colors">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          {selectedConversation ? (
            <ChatPopupWindow
              conversation={selectedConversation}
              currentUserId={currentUserId}
            />
          ) : (
            <ConversationPopupList
              conversations={conversations}
              loading={loading}
              currentUserId={currentUserId}
              onSelect={handleSelectConversation}
              getDisplayName={getConversationDisplayName}
              formatTime={formatTime}
            />
          )}
        </div>
      )}

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleConversationCreated}
        createConversation={createConversation}
      />
    </>
  );
};

// ─── Mini Conversation List ───
interface ConversationPopupListProps {
  conversations: InternalConversation[];
  loading: boolean;
  currentUserId: string | null;
  onSelect: (c: InternalConversation) => void;
  getDisplayName: (c: InternalConversation) => string;
  formatTime: (d: string) => string;
}

const ConversationPopupList = ({ conversations, loading, currentUserId, onSelect, getDisplayName, formatTime }: ConversationPopupListProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-xs">Nenhuma conversa</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" style={{ maxHeight: '496px' }}>
      <div className="divide-y">
        {conversations.map(conv => {
          const unread = conv.unread_count || 0;
          const displayName = getDisplayName(conv);
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {conv.is_group ? <Users className="h-4 w-4" /> : displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{conv.updated_at ? formatTime(conv.updated_at) : ''}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{typeof conv.last_message === 'string' ? conv.last_message : (conv.last_message as any)?.content || 'Nenhuma mensagem'}</p>
              </div>
              {unread > 0 && (
                <Badge className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground shrink-0">
                  {unread}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
};

// ─── Mini Chat Window ───
interface ChatPopupWindowProps {
  conversation: InternalConversation;
  currentUserId: string | null;
}

const ChatPopupWindow = ({ conversation, currentUserId }: ChatPopupWindowProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { messages, loading, sendMessage, uploadMedia } = useInternalMessages(conversation.id);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    const success = await sendMessage(message.trim());
    if (success) setMessage('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const url = await uploadMedia(file);
      if (url) {
        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        const type = isImage ? 'image' : isAudio ? 'audio' : 'file';
        await sendMessage(file.name, type, url, file.name);
      }
    } catch (err) {
      console.error('Upload error:', err);
    }
    setSending(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setSending(true);
        const url = await uploadMedia(file);
        if (url) await sendMessage('🎤 Áudio', 'audio', url, file.name);
        setSending(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const formatRecTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const renderMessageContent = (msg: InternalMessage) => {
    if (msg.message_type === 'image' && msg.media_url) {
      return <img src={msg.media_url} alt="img" className="rounded max-w-full max-h-[160px] cursor-pointer" onClick={() => window.open(msg.media_url!, '_blank')} />;
    }
    if (msg.message_type === 'audio' && msg.media_url) {
      return <audio controls src={msg.media_url} className="max-w-full h-8" />;
    }
    if (msg.message_type === 'file' && msg.media_url) {
      return (
        <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline text-xs">
          <FileText className="h-3 w-3" /> {msg.file_name || 'Arquivo'}
        </a>
      );
    }
    return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
  };

  return (
    <div className="flex flex-col flex-1" style={{ maxHeight: '536px' }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '440px', minHeight: '240px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">Envie a primeira mensagem!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-end gap-1.5 ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender_id !== currentUserId && (
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={msg.sender?.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                    {(msg.sender?.full_name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${
                  msg.sender_id === currentUserId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.sender_id !== currentUserId && (
                  <p className="text-[10px] font-semibold mb-0.5 opacity-80">{msg.sender?.full_name || 'Usuário'}</p>
                )}
                {renderMessageContent(msg)}
                <p className={`text-[9px] mt-0.5 ${msg.sender_id === currentUserId ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {format(new Date(msg.created_at), 'HH:mm')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t flex items-center gap-1.5">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 hover:bg-muted transition-colors"
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </button>

        {isRecording ? (
          <div className="flex-1 flex items-center gap-2 px-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 font-medium">{formatRecTime(recordingTime)}</span>
          </div>
        ) : (
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mensagem..."
            className="flex-1 text-xs bg-muted rounded-full px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {isRecording ? (
          <button
            onClick={stopRecording}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-red-500 transition-colors"
            title="Parar gravação"
          >
            <StopCircle className="h-4 w-4 text-white" />
          </button>
        ) : message.trim() ? (
          <button
            onClick={handleSend}
            disabled={sending}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
            style={{ background: '#25D366' }}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Send className="h-3.5 w-3.5 text-white" />}
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 hover:bg-muted transition-colors"
            title="Gravar áudio"
          >
            <Mic className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};
