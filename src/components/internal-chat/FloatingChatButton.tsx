import { useState, useRef, useCallback, useEffect } from 'react';
import { MessageCircle, X, ArrowLeft, Plus, Phone, Users, User, Send, Paperclip, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useInternalChat, InternalConversation } from '@/hooks/useInternalChat';
import { useInternalMessages } from '@/hooks/useInternalMessages';
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
            width: '320px',
            maxHeight: '480px',
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
    <ScrollArea className="flex-1" style={{ maxHeight: '380px' }}>
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, loading, sendMessage, editMessage, uploadMedia } = useInternalMessages(conversation.id);

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

  return (
    <div className="flex flex-col flex-1" style={{ maxHeight: '420px' }}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '340px', minHeight: '200px' }}>
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
              className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                  msg.sender_id === currentUserId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.sender_id !== currentUserId && (
                  <p className="text-[10px] font-semibold mb-0.5 opacity-80">{msg.sender?.full_name || 'Usuário'}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[9px] mt-0.5 ${msg.sender_id === currentUserId ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {format(new Date(msg.created_at), 'HH:mm')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t flex items-center gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem..."
          className="flex-1 text-xs bg-muted rounded-full px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
          style={{ background: '#25D366' }}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
          ) : (
            <Send className="h-3.5 w-3.5 text-white" />
          )}
        </button>
      </div>
    </div>
  );
};
