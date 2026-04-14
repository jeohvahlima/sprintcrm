import { useState, memo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  CheckCheck, 
  Download, 
  Volume2, 
  FileText,
  ImageIcon,
  Video,
  Mic,
  Reply,
  User as UserIcon,
  MoreVertical,
  Smile,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  LayoutTemplate
} from "lucide-react";
import { MessageActions } from "./MessageActions";
import { PDFPreview } from "./PDFPreview";
import { PdfViewerDialog } from "./PdfViewerDialog";

import { toast } from "@/hooks/use-toast";
import { getMediaUrl, isPermanentUrl, MediaExpiredError } from "@/utils/mediaLoader";
import { TextWithLinks } from "./LinkPreview";

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document" | "template";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  status?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number; // Tamanho do arquivo em bytes
  transcricao?: string;
  transcriptionStatus?: "pending" | "processing" | "completed" | "error"; // MELHORIA: Status da transcrição
  reaction?: string;
  replyTo?: string;
  edited?: boolean;
  sentBy?: string; // Nome do responsável que enviou
  contactData?: {
    name: string;
    phone: string;
  };
}

type MediaAttachmentType = "image" | "audio" | "pdf" | "video" | "document";

function inferMediaAttachmentType(message: Message): MediaAttachmentType | null {
  if (message.type === "image" || message.type === "audio" || message.type === "pdf" || message.type === "video" || message.type === "document") {
    return message.type;
  }

  if (message.type !== "template") {
    return null;
  }

  const normalizedMimeType = message.mimeType?.toLowerCase() || "";
  const normalizedFileName = message.fileName?.toLowerCase() || "";
  const normalizedMediaUrl = message.mediaUrl?.split("?")[0].toLowerCase() || "";
  const hasExtension = (...extensions: string[]) =>
    extensions.some((extension) => normalizedFileName.endsWith(extension) || normalizedMediaUrl.endsWith(extension));

  if (!normalizedMimeType && !normalizedFileName && !normalizedMediaUrl) {
    return null;
  }

  if (normalizedMimeType.startsWith("video/") || hasExtension(".mp4", ".mov", ".webm", ".m4v")) {
    return "video";
  }

  if (normalizedMimeType.startsWith("image/") || hasExtension(".jpg", ".jpeg", ".png", ".gif", ".webp")) {
    return "image";
  }

  if (normalizedMimeType.startsWith("audio/") || hasExtension(".mp3", ".ogg", ".wav", ".m4a", ".aac", ".opus")) {
    return "audio";
  }

  if (normalizedMimeType.includes("pdf") || hasExtension(".pdf")) {
    return "pdf";
  }

  return "document";
}

// Helper para verificar se é PDF (tipo pdf ou document com extensão .pdf)
function isPdfMessage(message: Message): boolean {
  if (message.type === 'pdf') return true;
  if (message.type === 'document') {
    // Verificar extensão do arquivo ou mimetype
    if (message.fileName?.toLowerCase().endsWith('.pdf')) return true;
    if (message.mimeType?.includes('pdf')) return true;
    if (message.mediaUrl?.toLowerCase().includes('.pdf')) return true;
  }
  return false;
}

// Limite de tamanho para preview no CRM (10MB) - arquivos maiores mostram apenas botão de download
const MAX_PREVIEW_SIZE_MB = 10;
const MAX_PREVIEW_SIZE_BYTES = MAX_PREVIEW_SIZE_MB * 1024 * 1024;

interface MessageItemProps {
  message: Message;
  allMessages?: Message[];
  onDownload?: (url: string, fileName: string) => void;
  onTranscribe?: (messageId: string, audioUrl: string) => void;
  onImageClick?: (url: string, name: string) => void;
  onPdfClick?: (url: string, name: string) => void;
  isTranscribing?: boolean;
  transcriptionStatus?: "pending" | "processing" | "completed" | "error";
  onRetryTranscribe?: () => void;
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void | Promise<void>;
  onForward?: (messageId: string, content: string, messageType: string, mediaUrl?: string, fileName?: string) => void;
  onOpenContactConversation?: (name: string, phone: string) => void;
  hideFloatingActions?: boolean;
}

function MessageItemComponent({
  message,
  allMessages,
  onDownload,
  onTranscribe,
  onImageClick,
  onPdfClick,
  isTranscribing,
  transcriptionStatus,
  onRetryTranscribe,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onForward,
  onOpenContactConversation,
  hideFloatingActions = false,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  
  // Estado para PDF Viewer Dialog
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  

  const repliedMessage = message.replyTo && allMessages
    ? allMessages.find(m => m.id === message.replyTo)
    : null;
  const mediaMessageType = inferMediaAttachmentType(message);
  const isPdfAttachment = isPdfMessage(message) || mediaMessageType === "pdf";
  const normalizedStatus = (message.status || "").toLowerCase();
  const isFailedMessage = normalizedStatus === "falhou" || normalizedStatus === "failed";
  const isProcessingMessage = normalizedStatus === "processando" || normalizedStatus === "processing";

  // Estado para mídia expirada
  const [mediaExpired, setMediaExpired] = useState(false);

  // Carregar mídia quando componente montar
  useEffect(() => {
    // Reset estado de expiração ao mudar de mensagem
    setMediaExpired(false);
    
    // ⚡ CORREÇÃO DEFINITIVA: Priorizar URLs permanentes do Storage
    if (message.mediaUrl && mediaMessageType) {
      
      // ✅ PRIORIDADE 1: URLs permanentes do Supabase Storage (nunca expiram)
      if (isPermanentUrl(message.mediaUrl)) {
        console.log('✅ [MESSAGE-ITEM] URL permanente detectada:', {
          id: message.id,
          type: mediaMessageType,
          urlPreview: message.mediaUrl.substring(0, 80)
        });
        setMediaUrl(message.mediaUrl);
        setMediaLoading(false);
        return;
      }
      
      // ⚡ Blob URLs: usar diretamente para mensagens otimistas (temp-*), senão buscar permanente
      if (message.mediaUrl.startsWith('blob:')) {
        if (message.id.startsWith('temp-')) {
          // Mensagem otimista - usar blob URL diretamente (será substituída depois)
          setMediaUrl(message.mediaUrl);
          setMediaLoading(false);
          return;
        }
        console.log('⚠️ [MESSAGE-ITEM] Blob URL detectada (expira) - buscando URL permanente:', {
          id: message.id,
          type: mediaMessageType
        });
      }
      
      // Se não for URL permanente, tentar carregar via getMediaUrl (que retorna URL permanente quando possível)
      setMediaLoading(true);
      console.log('🔄 [MESSAGE-ITEM] Carregando mídia do banco:', {
        id: message.id,
        type: mediaMessageType,
        hasUrl: !!message.mediaUrl,
        urlPreview: message.mediaUrl.substring(0, 50)
      });
      
      getMediaUrl(message.id, mediaMessageType)
        .then((url) => {
          console.log('✅ [MESSAGE-ITEM] Mídia carregada do banco:', { 
            id: message.id, 
            type: mediaMessageType,
            isPermanent: isPermanentUrl(url),
            urlPreview: url?.substring(0, 100) || 'sem URL'
          });
          setMediaUrl(url);
          setMediaLoading(false);
        })
        .catch((error: any) => {
          console.error('❌ [MESSAGE-ITEM] Erro ao carregar mídia:', {
            id: message.id,
            type: mediaMessageType,
            error: error?.message || String(error),
            mediaUrlPreview: message.mediaUrl?.substring(0, 50)
          });
          
          // ⚡ Detectar mídia expirada (qualquer erro de mídia resulta em expirado para não quebrar UI)
          if (error?.message === 'MEDIA_EXPIRED' || error instanceof MediaExpiredError) {
            console.warn('⚠️ [MESSAGE-ITEM] Mídia expirada:', message.id);
            setMediaExpired(true);
            setMediaLoading(false);
            return;
          }
          
          // ⚡ FALLBACK: Para qualquer outro erro, marcar como expirado para não quebrar UI
          console.warn('⚠️ [MESSAGE-ITEM] Erro desconhecido, marcando como expirada:', message.id);
          setMediaExpired(true);
          setMediaLoading(false);
        });
    } else {
      // Sem mediaUrl - marcar como não carregando
      setMediaLoading(false);
      console.log('⚠️ [MESSAGE-ITEM] Mensagem sem mediaUrl:', {
        id: message.id,
        type: message.type,
        hasMediaUrl: !!message.mediaUrl
      });
    }

    // Cleanup blob URL quando desmontar (apenas se for blob)
    return () => {
      if (mediaUrl && mediaUrl.startsWith('blob:') && !isPermanentUrl(message.mediaUrl || '')) {
        // Só revogar se a URL original não era permanente
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [message.id, message.mediaUrl, mediaMessageType]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart === null) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - dragStart;
    
    // Aplicar transformação visual durante o arraste
    const element = e.currentTarget as HTMLElement;
    if ((message.sender === "contact" && diff > 0) || (message.sender === "user" && diff < 0)) {
      element.style.transform = `translateX(${diff * 0.3}px)`;
      element.style.transition = 'none';
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const element = e.currentTarget as HTMLElement;
    const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null;
    let diff = 0;
    if (dragStart !== null && endX !== null) {
      diff = endX - dragStart;
    }
    // Trigger reply if swipe passes threshold in the expected direction
    const threshold = 60;
    if ((message.sender === "contact" && diff > threshold) || (message.sender === "user" && diff < -threshold)) {
      onReply(message.id);
    }
    element.style.transform = '';
    element.style.transition = 'transform 0.2s ease';
    setDragStart(null);
  };

  return (
    <div
      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in group`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative">
        {/* Reply indicator */}
        {message.replyTo && repliedMessage && (
          <div className="text-xs mb-1 px-3 py-2 bg-muted/70 rounded-t-lg border-l-4 border-blue-500">
            <div className="flex items-center gap-1 mb-1">
              <Reply className="h-3 w-3 text-blue-600" />
              <span className="font-medium text-blue-600">
                {repliedMessage.sender === "user" ? "Você" : "Cliente"}
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-2">
              {repliedMessage.type === "text" 
                ? repliedMessage.content
                : `[${repliedMessage.type.toUpperCase()}]`}
            </p>
          </div>
        )}
        
        <div
          className={`max-w-[500px] min-w-[100px] w-fit rounded-lg px-3 py-2 shadow-sm relative group ${
            message.sender === "user"
              ? "bg-[#d9fdd3] dark:bg-primary/20 text-foreground"
              : "bg-white dark:bg-card text-foreground"
          }`}
        >
          {/* Nome do responsável que enviou (SEMPRE exibir para mensagens enviadas pela equipe) */}
          {message.sender === "user" && (
            <div className="flex items-center gap-1 mb-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                <UserIcon className="h-2.5 w-2.5 mr-0.5" />
                {message.sentBy || "WhatsApp"}
              </Badge>
            </div>
          )}
          
          {!hideFloatingActions && (
            <div className={`absolute -top-1 ${message.sender === "user" ? "-left-9" : "-right-9"} opacity-0 group-hover:opacity-100 transition-opacity`}>
              <MessageActions
                messageId={message.id}
                content={message.content}
                sender={message.sender}
                messageType={mediaMessageType || message.type}
                mediaUrl={mediaUrl || message.mediaUrl}
                fileName={message.fileName}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
                onForward={onForward}
              />
            </div>
          )}
          {/* Text Message com Link Preview */}
          {message.type === "text" && (
            <div className="max-w-full">
              <TextWithLinks text={message.content} />
              {message.edited && (
                <span className="text-[10px] text-muted-foreground italic"> (editado)</span>
              )}
            </div>
          )}
          
          {/* Template Message */}
          {message.type === "template" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary mb-1">
                <LayoutTemplate className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">Template WhatsApp</span>
              </div>
              {!mediaMessageType && (
                <div className="max-w-full">
                  {message.content && !/^\[Template:\s*.+\]$/.test(message.content.trim()) ? (
                    <TextWithLinks text={message.content} />
                  ) : (
                    <span className="text-muted-foreground italic">
                      {message.content?.match(/^\[Template:\s*(.+)\]$/)?.[1]
                        ? `Mensagem de template "${message.content.match(/^\[Template:\s*(.+)\]$/)?.[1]}" enviada`
                        : '[Mensagem de template enviada]'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Image Message */}
          {mediaMessageType === "image" && (
            <div className="space-y-2">
              {mediaExpired ? (
                <div className="flex flex-col items-center justify-center w-[300px] h-[150px] bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
                  <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
                  <span className="text-sm text-amber-700 dark:text-amber-300 font-medium text-center">Imagem expirada</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">Mídias do WhatsApp expiram após alguns dias</span>
                </div>
              ) : mediaLoading ? (
                <div className="flex flex-col items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg border-2 border-dashed border-border">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Carregando imagem...</span>
                  {message.fileName && (
                    <span className="text-xs text-muted-foreground mt-1 px-2 text-center">{message.fileName}</span>
                  )}
                </div>
              ) : (mediaUrl || message.mediaUrl) ? (
                <div className="space-y-1">
                  <img
                    src={mediaUrl || message.mediaUrl}
                    alt={message.fileName || "Imagem"}
                    className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity border border-border"
                    style={{ maxHeight: '400px', maxWidth: '300px' }}
                    onClick={() => onImageClick?.(mediaUrl || message.mediaUrl || '', message.fileName || `imagem-${message.id}`)}
                    onError={(e) => {
                      console.error('❌ [MESSAGE-ITEM] Erro ao carregar imagem:', message.id);
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="flex flex-col items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg border border-border p-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            <span class="text-sm text-muted-foreground font-medium">📷 Imagem</span>
                            ${message.fileName ? `<span class="text-xs text-muted-foreground mt-1 text-center">${message.fileName}</span>` : ''}
                          </div>
                        `;
                      }
                    }}
                  />
                  {message.fileName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3 w-3" />
                      <span className="truncate">{message.fileName}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg border border-border p-4">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground font-medium">📷 Imagem enviada</span>
                  {message.fileName && (
                    <span className="text-xs text-muted-foreground mt-1 text-center">{message.fileName}</span>
                  )}
                </div>
              )}
              {message.content && !message.content.includes('[Imagem]') && !message.content.includes('Imagem enviada') && (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          )}
          
          {/* Audio Message */}
          {mediaMessageType === "audio" && (
            <div className="space-y-2 min-w-[250px]">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <span className="text-sm font-medium">Mensagem de áudio</span>
              </div>
              {mediaExpired ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <div className="flex flex-col">
                    <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">Áudio expirado</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">Mídias do WhatsApp expiram após alguns dias</span>
                  </div>
                </div>
              ) : mediaLoading ? (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">Carregando áudio...</span>
                </div>
              ) : (mediaUrl || message.mediaUrl) ? (
                <audio 
                  controls 
                  className="w-full h-8" 
                  style={{ maxWidth: '300px' }}
                  onError={(e) => {
                    console.error('❌ [MESSAGE-ITEM] Erro ao carregar áudio:', {
                      messageId: message.id,
                      mediaUrl: mediaUrl || message.mediaUrl,
                      error: e
                    });
                  }}
                >
                  <source src={mediaUrl || message.mediaUrl} type="audio/ogg; codecs=opus" />
                  <source src={mediaUrl || message.mediaUrl} type="audio/mpeg" />
                  <source src={mediaUrl || message.mediaUrl} type="audio/wav" />
                  Seu navegador não suporta o elemento de áudio.
                </audio>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-destructive">Áudio indisponível</span>
                </div>
              )}
              
              {/* MELHORIA: Indicador visual de status de transcrição */}
              {transcriptionStatus === "processing" && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Transcrevendo...
                  </span>
                </div>
              )}
              
              {transcriptionStatus === "pending" && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
                  <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                    Aguardando processamento...
                  </span>
                </div>
              )}
              
              {transcriptionStatus === "error" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-xs text-red-700 dark:text-red-300 font-medium flex-1">
                      Erro ao transcrever áudio
                    </span>
                  </div>
                  {onRetryTranscribe && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onRetryTranscribe}
                      className="w-full"
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Reenviar Transcrição
                    </Button>
                  )}
                </div>
              )}
              
              {/* Botão para transcrever se ainda não tiver sido iniciado */}
              {!message.transcricao && 
               transcriptionStatus !== "processing" && 
               transcriptionStatus !== "pending" && 
               transcriptionStatus !== "completed" &&
               onTranscribe && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTranscribe(message.id, message.mediaUrl!)}
                  disabled={isTranscribing}
                  className="w-full"
                >
                  <Mic className="h-3 w-3 mr-2" />
                  {isTranscribing ? 'Transcrevendo...' : 'Transcrever Áudio'}
                </Button>
              )}
              
              {/* MELHORIA: Mostrar transcrição quando disponível de forma assíncrona */}
              {message.transcricao && transcriptionStatus === "completed" && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <strong className="text-green-700 dark:text-green-300">Transcrição:</strong>
                  </div>
                  <p className="mt-1">{message.transcricao}</p>
                </div>
              )}
              
              {/* Mostrar transcrição mesmo sem status (compatibilidade) */}
              {message.transcricao && transcriptionStatus !== "completed" && transcriptionStatus !== "error" && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs border border-border">
                  <strong>Transcrição:</strong>
                  <p className="mt-1">{message.transcricao}</p>
                </div>
              )}
            </div>
          )}
          
          {/* PDF Message - trata tanto tipo "pdf" quanto "document" com extensão .pdf */}
          {isPdfAttachment && (
            <div className="space-y-2 min-w-[250px]">
              {(() => {
                // Verificar se arquivo é muito grande para preview
                const isLargeFile = message.fileSize && message.fileSize > MAX_PREVIEW_SIZE_BYTES;
                const fileSizeMB = message.fileSize ? (message.fileSize / (1024 * 1024)).toFixed(1) : null;
                
                if (mediaExpired) {
                  return (
                    <div className="flex flex-col items-center justify-center p-6 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
                      <span className="text-sm text-amber-700 dark:text-amber-300 font-medium text-center">PDF expirado</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">Mídias do WhatsApp expiram após alguns dias</span>
                    </div>
                  );
                }
                
                if (isLargeFile) {
                  // Arquivo grande - mostrar mensagem e opção de download
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <FileText className="h-12 w-12 text-blue-600 mb-2" />
                        <span className="text-sm text-blue-700 dark:text-blue-300 font-medium text-center">
                          📄 Arquivo PDF Grande
                        </span>
                        {message.fileName && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 mt-1 text-center px-2 truncate max-w-full">
                            {message.fileName}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">PDF</Badge>
                          <Badge variant="outline" className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300">
                            {fileSizeMB} MB
                          </Badge>
                        </div>
                        <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900/50 rounded text-xs text-blue-800 dark:text-blue-200 text-center">
                          <AlertCircle className="h-3 w-3 inline-block mr-1" />
                          Arquivo muito grande para visualização no CRM.
                          <br />
                          Baixe o arquivo para visualizar no seu computador.
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onDownload?.(mediaUrl || message.mediaUrl || '', message.fileName || 'documento.pdf')}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar PDF ({fileSizeMB} MB)
                      </Button>
                    </div>
                  );
                }
                
                if (mediaLoading) {
                  return (
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg bg-muted/50">
                      <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">Carregando PDF...</span>
                      {message.fileName && (
                        <span className="text-xs text-muted-foreground mt-1 text-center px-2">{message.fileName}</span>
                      )}
                    </div>
                  );
                }
                
                if (mediaUrl || message.mediaUrl) {
                  return (
                    <div className="space-y-2">
                      {/* Preview thumbnail do PDF */}
                      <PDFPreview
                        url={mediaUrl || message.mediaUrl || ''}
                        fileName={message.fileName}
                        onClick={() => setPdfViewerOpen(true)}
                      />
                      
                      {/* Nome do arquivo com ícone e tamanho */}
                      {message.fileName && (
                        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs border border-border">
                          <FileText className="h-4 w-4 text-red-600" />
                          <span className="font-medium truncate flex-1">{message.fileName}</span>
                          {fileSizeMB && (
                            <Badge variant="outline" className="text-[9px]">{fileSizeMB} MB</Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">PDF</Badge>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPdfViewerOpen(true)}
                          className="flex-1"
                        >
                          <FileText className="h-3 w-3 mr-2" />
                          Abrir PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDownload?.(mediaUrl || message.mediaUrl || '', message.fileName || 'documento.pdf')}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* PDF Viewer Dialog */}
                      <PdfViewerDialog
                        open={pdfViewerOpen}
                        onOpenChange={setPdfViewerOpen}
                        url={message.mediaUrl || mediaUrl || ''}
                        fileName={message.fileName}
                      />
                    </div>
                  );
                }
                
                // Fallback - arquivo sem URL (ainda não carregou ou falhou)
                return (
                  <div className="flex flex-col items-center justify-center p-6 border border-border rounded-lg bg-muted/50">
                    <FileText className="h-12 w-12 text-red-600 mb-2" />
                    <span className="text-sm text-muted-foreground font-medium">📄 Documento PDF</span>
                    {message.fileName && (
                      <span className="text-xs text-muted-foreground mt-1 text-center px-2">{message.fileName}</span>
                    )}
                    {fileSizeMB && (
                      <Badge variant="outline" className="text-[9px] mt-1">{fileSizeMB} MB</Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] mt-2">PDF</Badge>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Document Message (Non-PDF: Excel, Word, etc.) */}
          {message.type === "document" && !isPdfMessage(message) && (
            <div className="space-y-2 min-w-[250px]">
              {(() => {
                const fileSizeMB = message.fileSize ? (message.fileSize / (1024 * 1024)).toFixed(1) : null;
                const extension = message.fileName?.split('.').pop()?.toLowerCase() || '';
                
                // Ícone e cor baseado no tipo de arquivo
                const getDocumentInfo = () => {
                  // Planilhas
                  if (['xlsx', 'xls', 'xlsm', 'xlsb', 'csv', 'ods'].includes(extension)) {
                    return { icon: '📊', label: 'Planilha', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/20', borderColor: 'border-green-200 dark:border-green-800' };
                  }
                  // Word
                  if (['doc', 'docx', 'odt', 'rtf'].includes(extension)) {
                    return { icon: '📝', label: 'Documento Word', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20', borderColor: 'border-blue-200 dark:border-blue-800' };
                  }
                  // PowerPoint
                  if (['ppt', 'pptx', 'odp'].includes(extension)) {
                    return { icon: '📽️', label: 'Apresentação', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/20', borderColor: 'border-orange-200 dark:border-orange-800' };
                  }
                  // Arquivos compactados
                  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
                    return { icon: '📦', label: 'Arquivo Compactado', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/20', borderColor: 'border-purple-200 dark:border-purple-800' };
                  }
                  // Texto
                  if (['txt', 'json', 'xml', 'md'].includes(extension)) {
                    return { icon: '📄', label: 'Arquivo de Texto', color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-950/20', borderColor: 'border-gray-200 dark:border-gray-700' };
                  }
                  // Padrão
                  return { icon: '📎', label: 'Documento', color: 'text-slate-600', bgColor: 'bg-slate-50 dark:bg-slate-950/20', borderColor: 'border-slate-200 dark:border-slate-700' };
                };

                const docInfo = getDocumentInfo();

                if (mediaExpired) {
                  return (
                    <div className={`flex flex-col items-center justify-center p-6 ${docInfo.bgColor} rounded-lg border ${docInfo.borderColor}`}>
                      <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
                      <span className="text-sm text-amber-700 dark:text-amber-300 font-medium text-center">Documento expirado</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">Mídias do WhatsApp expiram após alguns dias</span>
                    </div>
                  );
                }

                if (mediaLoading) {
                  return (
                    <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed ${docInfo.borderColor} rounded-lg ${docInfo.bgColor}`}>
                      <span className="text-3xl mb-2">{docInfo.icon}</span>
                      <Loader2 className={`h-5 w-5 animate-spin ${docInfo.color} mb-1`} />
                      <span className="text-xs text-muted-foreground">Carregando documento...</span>
                      {message.fileName && (
                        <span className="text-xs text-muted-foreground mt-1 px-2 text-center truncate max-w-full">{message.fileName}</span>
                      )}
                    </div>
                  );
                }

                // Verificar se é planilha (pode abrir no visualizador)
                const isSpreadsheet = ['xlsx', 'xls', 'xlsm', 'xlsb', 'csv', 'ods'].includes(extension);

                return (
                  <div className="space-y-2">
                    {/* Card do documento */}
                    <div className={`flex flex-col items-center justify-center p-4 ${docInfo.bgColor} rounded-lg border ${docInfo.borderColor}`}>
                      <span className="text-4xl mb-2">{docInfo.icon}</span>
                      <span className={`text-sm ${docInfo.color} font-medium text-center`}>
                        {docInfo.label}
                      </span>
                      {message.fileName && (
                        <span className="text-xs text-muted-foreground mt-1 text-center px-2 truncate max-w-full">
                          {message.fileName}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px] uppercase">{extension || 'DOC'}</Badge>
                        {fileSizeMB && (
                          <Badge variant="outline" className="text-[10px]">{fileSizeMB} MB</Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      {isSpreadsheet && (mediaUrl || message.mediaUrl) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const fileUrl = mediaUrl || message.mediaUrl || '';
                            // Usar Microsoft Office Online Viewer para visualizar planilhas Excel
                            const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
                            window.open(viewerUrl, '_blank');
                          }}
                          className="flex-1"
                        >
                          <FileText className="h-3 w-3 mr-2" />
                          Abrir Planilha
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDownload?.(mediaUrl || message.mediaUrl || '', message.fileName || `documento.${extension}`)}
                        className={isSpreadsheet && (mediaUrl || message.mediaUrl) ? "" : "w-full"}
                      >
                        <Download className="h-3 w-3 mr-2" />
                        Baixar
                      </Button>
                    </div>
                    
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Video Message */}
          {mediaMessageType === "video" && (
            <div className="space-y-2">
              {mediaExpired ? (
                <div className="flex flex-col items-center justify-center w-[300px] h-[150px] bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
                  <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
                  <span className="text-sm text-amber-700 dark:text-amber-300 font-medium text-center">Vídeo expirado</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">Mídias do WhatsApp expiram após alguns dias</span>
                </div>
              ) : mediaLoading ? (
                <div className="flex flex-col items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg border-2 border-dashed border-border">
                  <Video className="h-12 w-12 text-muted-foreground mb-2" />
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Carregando vídeo...</span>
                  {message.fileName && (
                    <span className="text-xs text-muted-foreground mt-1 px-2 text-center">{message.fileName}</span>
                  )}
                </div>
              ) : (mediaUrl || message.mediaUrl) ? (
                <div className="space-y-1">
                  <video
                    controls
                    className="rounded-lg max-w-full h-auto border border-border"
                    style={{ maxHeight: '400px', maxWidth: '300px' }}
                    onError={(e) => {
                      console.error('❌ [MESSAGE-ITEM] Erro ao carregar vídeo:', message.id);
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="flex flex-col items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg border border-border p-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                            <span class="text-sm text-muted-foreground font-medium">🎥 Vídeo</span>
                            ${message.fileName ? `<span class="text-xs text-muted-foreground mt-1 text-center">${message.fileName}</span>` : ''}
                          </div>
                        `;
                      }
                    }}
                  >
                    <source 
                      src={mediaUrl || message.mediaUrl} 
                      type={message.mimeType || 'video/mp4'} 
                    />
                    {/* Fallback para outros formatos */}
                    {message.mimeType && message.mimeType !== 'video/mp4' && (
                      <source src={mediaUrl || message.mediaUrl} type="video/mp4" />
                    )}
                    Seu navegador não suporta o elemento de vídeo.
                  </video>
                  {message.fileName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Video className="h-3 w-3" />
                      <span className="truncate">{message.fileName}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg border border-border p-4">
                  <Video className="h-12 w-12 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground font-medium">🎥 Vídeo enviado</span>
                  {message.fileName && (
                    <span className="text-xs text-muted-foreground mt-1 text-center">{message.fileName}</span>
                  )}
                </div>
              )}
              {message.content && !message.content.includes('[Vídeo]') && !message.content.includes('Vídeo enviado') && (
                <div className="max-w-full">
                  <TextWithLinks text={message.content} />
                </div>
              )}
            </div>
          )}

          {/* Contact Message */}
          {message.type === "contact" && message.contactData && (
            <div className="space-y-2 min-w-[200px]">
              <div 
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50"
                onClick={() => onOpenContactConversation?.(message.contactData!.name, message.contactData!.phone)}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{message.contactData.name}</p>
                  <p className="text-xs text-muted-foreground">{message.contactData.phone}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${message.contactData?.name}
TEL:${message.contactData?.phone}
END:VCARD`;
                  const blob = new Blob([vcard], { type: 'text/vcard' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${message.contactData?.name}.vcf`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full"
              >
                <Download className="h-3 w-3 mr-2" />
                Salvar Contato
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenContactConversation?.(message.contactData!.name, message.contactData!.phone)}
                className="w-full"
              >
                Conversar
              </Button>
            </div>
          )}

          {/* Timestamp and Status */}
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {message.timestamp.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}{" "}
              {message.timestamp.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {message.sender === "user" && (
              <div 
                className={`flex items-center gap-0.5 ${
                  message.read 
                    ? 'bg-[#53bdeb]/15 px-1.5 py-0.5 rounded-full' 
                    : ''
                }`} 
                title={
                  isFailedMessage
                    ? 'Falhou'
                    : isProcessingMessage
                      ? 'Processando'
                      : message.read
                        ? 'Visualizado'
                        : message.delivered
                          ? 'Entregue'
                          : 'Enviado'
                }
              >
                {isFailedMessage ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-[9px] text-destructive ml-0.5">Falhou</span>
                  </>
                ) : isProcessingMessage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground ml-0.5">Processando</span>
                  </>
                ) : message.read ? (
                  <>
                    <CheckCheck className="h-4 w-4 text-[#53bdeb] drop-shadow-sm" />
                    <span className="text-[10px] text-[#53bdeb] font-semibold ml-0.5">Visto</span>
                  </>
                ) : message.delivered ? (
                  <>
                    <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground ml-0.5">Entregue</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground ml-0.5">Enviado</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Reaction */}
          {message.reaction && (
            <Badge 
              className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full flex items-center justify-center p-0 border-2 border-background text-base shadow-md"
              variant="secondary"
            >
              {message.reaction}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// MELHORIA: Memoizar componente para otimização de performance (MICRO-PROMPT 4)
export const MessageItem = memo(MessageItemComponent);
