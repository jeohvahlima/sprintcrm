import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractYouTubeId, VideoType } from "@/hooks/useTraining";
import { Youtube, AlertCircle, CheckCircle2, Upload, Video, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { 
    title: string; 
    description?: string; 
    youtube_url?: string;
    video_url?: string;
    video_type?: VideoType;
    duration_minutes?: number;
  }) => Promise<void>;
  editingLesson?: { 
    id: string; 
    title: string; 
    description: string | null; 
    youtube_url: string | null;
    video_url?: string | null;
    video_type?: VideoType;
    duration_minutes: number | null;
  } | null;
}

export function CreateLessonDialog({ open, onOpenChange, onSubmit, editingLesson }: CreateLessonDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoType, setVideoType] = useState<VideoType>("youtube");
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const videoId = extractYouTubeId(youtubeUrl);
  const isValidYoutube = youtubeUrl.length > 0 && videoId !== null;
  const canSubmit = videoType === 'youtube' ? isValidYoutube : !!videoUrl;

  useEffect(() => {
    if (editingLesson) {
      setTitle(editingLesson.title);
      setDescription(editingLesson.description || "");
      setYoutubeUrl(editingLesson.youtube_url || "");
      setVideoUrl(editingLesson.video_url || "");
      setVideoType(editingLesson.video_type || (editingLesson.video_url ? 'upload' : 'youtube'));
      setDurationMinutes(editingLesson.duration_minutes || undefined);
    } else {
      setTitle("");
      setDescription("");
      setYoutubeUrl("");
      setVideoUrl("");
      setVideoType("youtube");
      setDurationMinutes(undefined);
    }
  }, [editingLesson, open]);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: cid } = await supabase.rpc('get_my_company_id');
      if (!cid) throw new Error('Empresa não identificada');
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${cid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('training-videos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'video/mp4',
      });
      if (error) throw error;
      // Use signed URL with long expiry (7 days) — refreshed on view
      const { data: signed, error: sErr } = await supabase.storage
        .from('training-videos')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
      if (sErr) throw sErr;
      setVideoUrl(signed.signedUrl);
      toast({ title: 'Upload concluído', description: 'Vídeo enviado com sucesso' });
    } catch (err: any) {
      console.error('upload error', err);
      toast({ variant: 'destructive', title: 'Erro no upload', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !canSubmit) return;
    setLoading(true);
    try {
      await onSubmit({ 
        title, 
        description: description || undefined, 
        youtube_url: videoType === 'youtube' ? youtubeUrl : undefined,
        video_url: videoType === 'upload' ? videoUrl : undefined,
        video_type: videoType,
        duration_minutes: durationMinutes
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            {editingLesson ? "Editar Aula" : "Adicionar Aula"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título da Aula *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Treinamento de objeções" required />
          </div>

          <Tabs value={videoType} onValueChange={(v) => setVideoType(v as VideoType)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-2" />Gravação (upload)</TabsTrigger>
              <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-2" />YouTube</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-3 pt-3">
              <Label>Arquivo de vídeo (MP4, WebM, MOV)</Label>
              <Input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              {uploading && (
                <div className="flex items-center text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando vídeo...
                </div>
              )}
              {videoUrl && !uploading && (
                <div className="rounded-lg overflow-hidden border">
                  <video src={videoUrl} controls className="w-full aspect-video bg-black" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="youtube" className="space-y-3 pt-3">
              <Label htmlFor="youtube_url">Link do YouTube</Label>
              <div className="relative">
                <Input
                  id="youtube_url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={youtubeUrl.length > 0 ? (isValidYoutube ? "border-green-500 pr-10" : "border-red-500 pr-10") : ""}
                />
                {youtubeUrl.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isValidYoutube ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  </div>
                )}
              </div>
              {isValidYoutube && (
                <div className="rounded-lg overflow-hidden border">
                  <iframe src={`https://www.youtube.com/embed/${videoId}`} title="Preview" className="w-full aspect-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="space-y-2">
            <Label htmlFor="duration">Duração (minutos)</Label>
            <Input id="duration" type="number" min="1" value={durationMinutes || ""} onChange={(e) => setDurationMinutes(e.target.value ? parseInt(e.target.value) : undefined)} placeholder="Ex: 15" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o conteúdo desta aula..." rows={3} />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || uploading || !title.trim() || !canSubmit}>
              {loading ? "Salvando..." : editingLesson ? "Salvar" : "Adicionar Aula"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
