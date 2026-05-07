import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Send, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AudioRecorderProps {
  onSendAudio: (audioBlob: Blob) => Promise<void>;
  onTranscribed?: (text: string) => void;
}

export function AudioRecorder({ onSendAudio, onTranscribed }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>('audio/webm');

  const getPreferredAudioMimeType = () => {
    const candidates = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = getPreferredAudioMimeType();
      const mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingMimeTypeRef.current = preferredMimeType || mediaRecorder.mimeType || 'audio/webm';
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const rawMime = recordingMimeTypeRef.current || mediaRecorder.mimeType || 'audio/webm';
        // ⚡ Preservar MIME real reportado pelo MediaRecorder (sem mascarar container)
        const normalizedMime = rawMime.split(';')[0].trim() || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: normalizedMime });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast.success("Gravação iniciada");
    } catch (error) {
      console.error("Erro ao acessar microfone:", error);
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const sendAudio = async () => {
    // Proteção contra múltiplos envios
    if (!audioBlob || isSending) {
      console.log('🎤 [AudioRecorder] Envio bloqueado - isSending:', isSending, 'hasBlob:', !!audioBlob);
      return;
    }
    
    console.log('🎤 [AudioRecorder] Iniciando envio de áudio...');
    setIsSending(true);
    
    // Guardar referência do blob para limpar após envio
    const blobToSend = audioBlob;
    
    // Limpar estado IMEDIATAMENTE para evitar interface congelada
    setAudioBlob(null);
    setRecordingTime(0);
    chunksRef.current = [];
    
    try {
      await onSendAudio(blobToSend);
      console.log('✅ [AudioRecorder] Áudio enviado com sucesso');
    } catch (error) {
      console.error("❌ [AudioRecorder] Erro ao enviar áudio:", error);
      toast.error("Erro ao enviar áudio. Tente novamente.");
    } finally {
      setIsSending(false);
      console.log('🎤 [AudioRecorder] Estado resetado');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
        <audio controls className="flex-1 h-8">
          <source src={URL.createObjectURL(audioBlob)} type={audioBlob.type || 'audio/webm'} />
        </audio>
        <Button size="icon" variant="ghost" onClick={cancelRecording} disabled={isSending}>
          <X className="h-4 w-4" />
        </Button>
        <Button size="icon" onClick={sendAudio} disabled={isSending} className="bg-[#25D366] hover:bg-[#128C7E]">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 bg-red-500/10 p-2 rounded-lg animate-pulse">
        <Mic className="h-5 w-5 text-red-500" />
        <span className="text-sm font-medium text-red-500">{formatTime(recordingTime)}</span>
        <div className="flex-1" />
        <Button size="icon" variant="destructive" onClick={stopRecording}>
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={startRecording}
      className="hover:bg-primary/10"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
