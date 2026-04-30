import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, Eye, FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Ebook {
  id: string;
  title: string;
  description: string;
  category: string;
  segment: string;
  fileUrl: string;
  pages?: number;
  badge?: string;
}

const EBOOKS: Ebook[] = [
  {
    id: "scripts-odonto-001",
    title: "10 Scripts Comerciais para Clínicas Odontológicas",
    description:
      "Modelos prontos de scripts e roteiros comerciais para gestão de clínicas odontológicas — abordagem, qualificação, objeções e fechamento.",
    category: "Scripts",
    segment: "Odontologia",
    fileUrl: "/ebooks/10-scripts-comerciais-odontologicas.pdf",
    badge: "Kit Vendas em Escala",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Scripts: "bg-primary/10 text-primary border-primary/20",
  Playbook: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Framework: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Template: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export function EbooksComerciais() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  const openPreview = (ebook: Ebook) => {
    setPreviewUrl(ebook.fileUrl);
    setPreviewTitle(ebook.title);
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Ebooks & Kits Comerciais
          </CardTitle>
          <CardDescription>
            Modelos prontos de scripts, roteiros e playbooks comerciais editáveis para usar
            como base nas suas operações. Edite, personalize e adote no seu time.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EBOOKS.map((ebook) => {
          const catColor = CATEGORY_COLORS[ebook.category] || CATEGORY_COLORS.Template;
          return (
            <Card key={ebook.id} className="hover:border-primary/40 transition-colors flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant="outline" className={`text-[10px] ${catColor}`}>
                      {ebook.category}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {ebook.segment}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{ebook.title}</CardTitle>
                {ebook.badge && (
                  <Badge variant="outline" className="text-[10px] w-fit border-primary/30 text-primary bg-primary/5">
                    <Sparkles className="h-2.5 w-2.5 mr-1" /> {ebook.badge}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-xs text-muted-foreground flex-1">{ebook.description}</p>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openPreview(ebook)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
                  </Button>
                  <Button size="sm" variant="default" asChild>
                    <a href={ebook.fileUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Empty/coming soon placeholder */}
        <Card className="border-dashed flex items-center justify-center min-h-[200px]">
          <CardContent className="text-center pt-6">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Mais ebooks em breve</p>
            <p className="text-xs text-muted-foreground mt-1">
              Templates comerciais, frameworks e playbooks por segmento
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="flex-1 w-full rounded-md border"
              title={previewTitle}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
