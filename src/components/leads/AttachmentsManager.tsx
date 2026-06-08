import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Paperclip, Search, FileText, Image, Video, File, Users, Eye, Download, Trash2, Calendar, Tag, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadAttachments } from "./LeadAttachments";
import { AttachmentViewer } from "./AttachmentViewer";
import { LeadAttachment } from "./LeadAttachments";

interface LeadWithAttachments {
  id: string;
  name: string;
  phone?: string;
  attachmentsCount: number;
}

interface AttachmentWithLead extends LeadAttachment {
  leadName: string;
  leadPhone?: string;
}

interface AttachmentsManagerProps {
  onLeadSelected?: (leadId: string | null) => void;
}

export function AttachmentsManager({ onLeadSelected }: AttachmentsManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [leadsWithAttachments, setLeadsWithAttachments] = useState<LeadWithAttachments[]>([]);
  const [allAttachments, setAllAttachments] = useState<AttachmentWithLead[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadName, setSelectedLeadName] = useState<string>("");
  const [leadAttachmentsOpen, setLeadAttachmentsOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<LeadAttachment | null>(null);
  const [viewMode, setViewMode] = useState<"leads" | "all">("leads");

  const categories = [
  { id: "antes", label: "Antes", color: "bg-blue-500" },
  { id: "depois", label: "Depois", color: "bg-green-500" },
  { id: "durante", label: "Durante", color: "bg-yellow-500" },
  { id: "exame", label: "Exame", color: "bg-purple-500" },
  { id: "laudo", label: "Laudo", color: "bg-red-500" },
  { id: "outros", label: "Outros", color: "bg-gray-500" }];


  useEffect(() => {
    if (open) {
      loadUserCompany();
    }
  }, [open]);

  useEffect(() => {
    if (userCompanyId) {
      loadData();
    }
  }, [userCompanyId, viewMode]);

  const loadUserCompany = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase.
      from("user_roles").
      select("company_id").
      eq("user_id", user.id).
      maybeSingle();

      if (userRole?.company_id) {
        setUserCompanyId(userRole.company_id);
      }
    } catch (error) {
      console.error("Erro ao carregar empresa:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewMode === "leads") {
        await loadLeadsWithAttachments();
      } else {
        await loadAllAttachments();
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar banco de dados");
    } finally {
      setLoading(false);
    }
  };

  const loadLeadsWithAttachments = async () => {
    // Buscar leads com contagem de anexos
    const { data: attachments, error } = await supabase.
    from("lead_attachments").
    select("lead_id, leads!inner(id, name, phone, telefone)").
    eq("company_id", userCompanyId);

    if (error) throw error;

    // Agrupar por lead
    const leadsMap = new Map<string, LeadWithAttachments>();

    attachments?.forEach((att: any) => {
      const lead = att.leads;
      if (lead && !leadsMap.has(lead.id)) {
        leadsMap.set(lead.id, {
          id: lead.id,
          name: lead.name,
          phone: lead.phone || lead.telefone,
          attachmentsCount: 0
        });
      }
      if (lead) {
        const existing = leadsMap.get(lead.id)!;
        existing.attachmentsCount++;
      }
    });

    const leadsArray = Array.from(leadsMap.values()).
    sort((a, b) => b.attachmentsCount - a.attachmentsCount);

    setLeadsWithAttachments(leadsArray);
  };

  const loadAllAttachments = async () => {
    let query = supabase.
    from("lead_attachments").
    select("*, leads!inner(id, name, phone, telefone)").
    eq("company_id", userCompanyId).
    order("created_at", { ascending: false });

    if (selectedCategory) {
      query = query.eq("category", selectedCategory);
    }

    const { data, error } = await query;

    if (error) throw error;

    const attachmentsWithLead: AttachmentWithLead[] = (data || []).map((att: any) => ({
      ...att,
      leadName: att.leads?.name || "Lead desconhecido",
      leadPhone: att.leads?.phone || att.leads?.telefone
    }));

    setAllAttachments(attachmentsWithLead);
  };

  const getFileIcon = (fileType: string, mimeType?: string | null) => {
    const type = fileType?.toLowerCase() || '';
    const mime = mimeType?.toLowerCase() || '';

    if (type === 'image' || mime.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (type === 'video' || mime.startsWith("video/")) return <Video className="h-4 w-4" />;
    if (type === 'audio' || mime.startsWith("audio/")) return <Music className="h-4 w-4" />;
    if (type === 'pdf' || mime === "application/pdf") return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const getCategoryColor = (category: string) => {
    return categories.find((c) => c.id === category)?.color || "bg-gray-500";
  };

  const getCategoryLabel = (category: string) => {
    return categories.find((c) => c.id === category)?.label || category;
  };

  const handleOpenLeadAttachments = (lead: LeadWithAttachments) => {
    setSelectedLeadId(lead.id);
    setSelectedLeadName(lead.name);
    setLeadAttachmentsOpen(true);
  };

  const handleViewAttachment = (attachment: AttachmentWithLead) => {
    setSelectedAttachment(attachment);
    setViewerOpen(true);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase.
      from("lead_attachments").
      delete().
      eq("id", attachmentId);

      if (error) throw error;

      toast.success("Arquivo excluído");
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir arquivo");
    }
  };

  const filteredLeads = leadsWithAttachments.filter((lead) =>
  lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  lead.phone && lead.phone.includes(searchTerm)
  );

  const filteredAttachments = allAttachments.filter((att) =>
  att.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  att.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  att.treatment_name && att.treatment_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAttachments = leadsWithAttachments.reduce((sum, lead) => sum + lead.attachmentsCount, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="md:size-default gap-2">
            <Paperclip className="h-4 w-4" />
            <span className="hidden md:inline">Ficha Técnica</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Gerenciador de Banco de Dado do Contato
              <Badge variant="secondary" className="ml-2">
                {totalAttachments} arquivo(s)
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Filtros e busca */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === "leads" ? "default" : "outline"}
                onClick={() => setViewMode("leads")}>
                
                <Users className="h-4 w-4 mr-2" />
                Por Lead
              </Button>
              <Button
                size="sm"
                variant={viewMode === "all" ? "default" : "outline"}
                onClick={() => setViewMode("all")}>
                
                <FileText className="h-4 w-4 mr-2" />
                Todos os Arquivos
              </Button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={viewMode === "leads" ? "Buscar lead..." : "Buscar arquivo..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10" />
                
              </div>
            </div>

            {viewMode === "all" &&
            <div className="flex flex-wrap gap-2">
                <Button
                size="sm"
                variant={!selectedCategory ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(null);
                  loadAllAttachments();
                }}>
                
                  Todas
                </Button>
                {categories.map((cat) =>
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(cat.id);
                }}>
                
                    <span className={`w-2 h-2 rounded-full ${cat.color} mr-2`} />
                    {cat.label}
                  </Button>
              )}
              </div>
            }
          </div>

          <Separator />

          {/* Conteúdo */}
          <ScrollArea className="flex-1 min-h-0">
            {loading ?
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div> :
            viewMode === "leads" ?
            <div className="space-y-2 p-1">
                {filteredLeads.length === 0 ?
              <div className="text-center py-12 text-muted-foreground">
                    <Paperclip className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum lead com prontuário encontrado</p>
                  </div> :

              filteredLeads.map((lead) =>
              <Card
                key={lead.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleOpenLeadAttachments(lead)}>
                
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{lead.name}</p>
                            {lead.phone &&
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                      }
                          </div>
                        </div>
                        <Badge variant="secondary" className="gap-1">
                          <Paperclip className="h-3 w-3" />
                          {lead.attachmentsCount}
                        </Badge>
                      </CardContent>
                    </Card>
              )
              }
              </div> :

            <div className="space-y-2 p-1">
                {filteredAttachments.length === 0 ?
              <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum arquivo encontrado</p>
                  </div> :

              filteredAttachments.map((att) =>
              <Card key={att.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            {getFileIcon(att.file_type, att.mime_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{att.file_name}</p>
                              <Badge className={`${getCategoryColor(att.category || "outros")} text-white text-xs`}>
                                {getCategoryLabel(att.category || "outros")}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">{att.leadName}</span>
                              {att.treatment_name && ` • ${att.treatment_name}`}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(att.created_at || new Date()), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleViewAttachment(att)}>
                        
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAttachment(att.id)}>
                        
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
              )
              }
              </div>
            }
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal de Prontuário do Lead */}
      {selectedLeadId && userCompanyId &&
      <LeadAttachments
        open={leadAttachmentsOpen}
        onOpenChange={(o) => {
          setLeadAttachmentsOpen(o);
          if (!o) {
            setSelectedLeadId(null);
            loadData();
          }
        }}
        leadId={selectedLeadId}
        companyId={userCompanyId}
        leadName={selectedLeadName} />

      }

      {/* Visualizador de Arquivo */}
      {selectedAttachment &&
      <AttachmentViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        attachment={selectedAttachment}
        allAttachments={allAttachments}
        onNavigate={(att) => setSelectedAttachment(att)} />

      }
    </>);

}