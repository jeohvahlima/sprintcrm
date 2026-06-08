import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineDialog, InlineDialogContent, InlineDialogHeader, InlineDialogTitle } from '@/components/conversas/InlineDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Image, 
  Video, 
  FileText, 
  Music, 
  Plus, 
  Eye, 
  Download, 
  Trash2, 
  Filter,
  Calendar,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UploadAttachmentDialog } from './UploadAttachmentDialog';
import { AttachmentViewer } from './AttachmentViewer';
import { downloadFile } from '@/utils/downloadFile';

export interface LeadAttachment {
  id: string;
  lead_id: string;
  company_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  description: string | null;
  treatment_name: string | null;
  treatment_date: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface LeadAttachmentsProps {
  leadId: string;
  companyId: string;
  leadName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inline?: boolean;
}

const CATEGORIES = [
  { value: 'todos', label: 'Todos' },
  { value: 'antes', label: 'Antes' },
  { value: 'depois', label: 'Depois' },
  { value: 'durante', label: 'Durante' },
  { value: 'exame', label: 'Exame' },
  { value: 'laudo', label: 'Laudo' },
  { value: 'outros', label: 'Outros' }
];

export function LeadAttachments({ leadId, companyId, leadName, open, onOpenChange, inline = false }: LeadAttachmentsProps) {
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<LeadAttachment | null>(null);

  useEffect(() => {
    if (open && leadId) {
      fetchAttachments();
    }
  }, [open, leadId]);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lead_attachments')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      toast.error('Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (attachment: LeadAttachment) => {
    if (!confirm('Deseja realmente excluir este arquivo?')) return;

    try {
      // Extract file path from URL
      const urlParts = attachment.file_url.split('/lead-attachments/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('lead-attachments').remove([filePath]);
      }

      const { error } = await supabase
        .from('lead_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast.success('Arquivo excluído');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Erro ao excluir arquivo');
    }
  };

  const handleView = (attachment: LeadAttachment) => {
    setSelectedAttachment(attachment);
    setViewerOpen(true);
  };

  const handleDownload = (attachment: LeadAttachment) => {
    downloadFile(attachment.file_url, attachment.file_name);
  };

  const filteredAttachments = selectedCategory === 'todos'
    ? attachments
    : attachments.filter(a => a.category === selectedCategory);

  const groupedByTreatment = filteredAttachments.reduce((acc, att) => {
    const key = att.treatment_name || 'Sem tratamento';
    if (!acc[key]) acc[key] = [];
    acc[key].push(att);
    return acc;
  }, {} as Record<string, LeadAttachment[]>);

  const getFileIcon = (fileType: string, mimeType?: string | null) => {
    const type = fileType?.toLowerCase() || '';
    const mime = mimeType?.toLowerCase() || '';
    
    if (type === 'image' || mime.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (type === 'video' || mime.startsWith('video/')) return <Video className="h-5 w-5" />;
    if (type === 'audio' || mime.startsWith('audio/')) return <Music className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const getFileCategory = (attachment: LeadAttachment): 'image' | 'video' | 'audio' | 'document' => {
    const type = attachment.file_type?.toLowerCase() || '';
    const mime = attachment.mime_type?.toLowerCase() || '';
    
    if (type === 'image' || mime.startsWith('image/')) return 'image';
    if (type === 'video' || mime.startsWith('video/')) return 'video';
    if (type === 'audio' || mime.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'antes': return 'bg-orange-500/10 text-orange-500';
      case 'depois': return 'bg-green-500/10 text-green-500';
      case 'durante': return 'bg-blue-500/10 text-blue-500';
      case 'exame': return 'bg-purple-500/10 text-purple-500';
      case 'laudo': return 'bg-red-500/10 text-red-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const Wrapper: any = inline ? InlineDialog : Dialog;
  const WrapperContent: any = inline ? InlineDialogContent : DialogContent;
  const WrapperHeader: any = inline ? InlineDialogHeader : DialogHeader;
  const WrapperTitle: any = inline ? InlineDialogTitle : DialogTitle;

  return (
    <>
      <Wrapper open={open} onOpenChange={onOpenChange}>
        <WrapperContent className={inline ? "" : "max-w-4xl max-h-[90vh]"}>
          <WrapperHeader>
            <WrapperTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Banco de Dado do Contato - {leadName || 'Lead'}
            </WrapperTitle>
          </WrapperHeader>


          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                  <TabsList className="h-8">
                    {CATEGORIES.map(cat => (
                      <TabsTrigger key={cat.value} value={cat.value} className="text-xs px-2">
                        {cat.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Arquivo
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="h-[500px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredAttachments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-2 opacity-50" />
                  <p>Nenhum arquivo encontrado</p>
                  <Button variant="link" size="sm" onClick={() => setUploadDialogOpen(true)}>
                    Adicionar primeiro arquivo
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedByTreatment).map(([treatment, files]) => (
                    <div key={treatment}>
                      <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        {treatment}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {files.map(attachment => {
                          const category = getFileCategory(attachment);
                          return (
                          <Card key={attachment.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="relative aspect-square bg-muted cursor-pointer" onClick={() => handleView(attachment)}>
                              {category === 'image' ? (
                                <img
                                  src={attachment.file_url}
                                  alt={attachment.file_name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                  }}
                                />
                              ) : category === 'video' ? (
                                <video
                                  src={attachment.file_url}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getFileIcon(attachment.file_type, attachment.mime_type)}
                                </div>
                              )}
                              <div className="fallback-icon hidden w-full h-full flex items-center justify-center absolute inset-0">
                                {getFileIcon(attachment.file_type, attachment.mime_type)}
                              </div>
                              
                              {/* Category Badge */}
                              {attachment.category && (
                                <Badge 
                                  className={`absolute top-2 left-2 text-xs ${getCategoryColor(attachment.category)}`}
                                >
                                  {attachment.category.charAt(0).toUpperCase() + attachment.category.slice(1)}
                                </Badge>
                              )}

                              {/* Hover Actions */}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-8 w-8"
                                  onClick={() => handleView(attachment)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-8 w-8"
                                  onClick={() => handleDownload(attachment)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="h-8 w-8"
                                  onClick={() => handleDelete(attachment)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <CardContent className="p-2">
                              <p className="text-xs font-medium truncate">{attachment.file_name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                {attachment.treatment_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(attachment.treatment_date), 'dd/MM/yy', { locale: ptBR })}
                                  </span>
                                )}
                                {attachment.file_size && (
                                  <span>{formatFileSize(attachment.file_size)}</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
              <span>{attachments.length} arquivo(s) no total</span>
              <span>•</span>
              <span>{attachments.filter(a => a.category === 'antes').length} antes</span>
              <span>{attachments.filter(a => a.category === 'depois').length} depois</span>
            </div>
          </div>
        </WrapperContent>
      </Wrapper>

      <UploadAttachmentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        leadId={leadId}
        companyId={companyId}
        onUploadComplete={fetchAttachments}
        existingTreatments={[...new Set(attachments.map(a => a.treatment_name).filter(Boolean) as string[])]}
      />

      {selectedAttachment && (
        <AttachmentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          attachment={selectedAttachment}
          allAttachments={filteredAttachments}
          onNavigate={setSelectedAttachment}
        />
      )}
    </>
  );
}
