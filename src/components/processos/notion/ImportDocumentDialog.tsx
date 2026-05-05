import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Link2, ClipboardPaste, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Worker para pdfjs
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ImportDocumentDialogProps {
  companyId: string | null;
  onCreated: (pageId: string) => void;
  trigger?: React.ReactNode;
}

type ParsedBlock = { block_type: string; content: any };

function textToBlocks(text: string, fallbackTitle: string): { title: string; blocks: ParsedBlock[] } {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd());
  // remove leading blank lines
  while (lines.length && !lines[0].trim()) lines.shift();
  const title = (lines.shift() || fallbackTitle).trim().slice(0, 200) || fallbackTitle;

  const blocks: ParsedBlock[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (!buffer.length) return;
    const joined = buffer.join(" ").trim();
    if (joined) blocks.push({ block_type: "paragraph", content: { text: joined } });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); continue; }

    // Headings: markdown # ## ### or ALL CAPS short lines
    const mdH = line.match(/^(#{1,3})\s+(.*)$/);
    if (mdH) {
      flushParagraph();
      const lvl = mdH[1].length;
      blocks.push({ block_type: lvl === 1 ? "heading1" : lvl === 2 ? "heading2" : "heading3", content: { text: mdH[2] } });
      continue;
    }
    if (/^\d+\.\s+/.test(line) && line.length < 120) {
      flushParagraph();
      blocks.push({ block_type: "heading2", content: { text: line.replace(/^\d+\.\s+/, "") } });
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      blocks.push({ block_type: "bullet_list", content: { text: line.replace(/^[-*•]\s+/, "") } });
      continue;
    }
    if (/^\[[ xX]\]\s+/.test(line)) {
      flushParagraph();
      const checked = /^\[[xX]\]/.test(line);
      blocks.push({ block_type: "checklist", content: { text: line.replace(/^\[[ xX]\]\s+/, ""), checked } });
      continue;
    }
    // Heuristic: short uppercase line = heading2
    if (line.length < 80 && line === line.toUpperCase() && /[A-ZÀ-Ú]/.test(line) && !/[.!?]$/.test(line)) {
      flushParagraph();
      blocks.push({ block_type: "heading2", content: { text: line } });
      continue;
    }
    buffer.push(line);
  }
  flushParagraph();

  if (!blocks.length) blocks.push({ block_type: "paragraph", content: { text: text.slice(0, 2000) } });
  return { title, blocks };
}

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    for (const item of content.items as any[]) {
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) out += "\n";
      out += item.str + " ";
      lastY = y;
    }
    out += "\n\n";
  }
  return out;
}

async function extractDocxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

async function fetchGoogleDocText(url: string): Promise<string> {
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new Error("Link inválido. Use a URL do Google Docs.");
  const docId = m[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(exportUrl);
  if (!res.ok) throw new Error("Não foi possível ler o documento. Verifique se ele está como 'Qualquer pessoa com o link pode ver'.");
  return await res.text();
}

export function ImportDocumentDialog({ companyId, onCreated, trigger }: ImportDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("file");
  const [file, setFile] = useState<File | null>(null);
  const [gdocUrl, setGdocUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");

  const reset = () => {
    setFile(null); setGdocUrl(""); setPasted(""); setPastedTitle("");
  };

  const createPage = async (title: string, blocks: ParsedBlock[]) => {
    if (!companyId) throw new Error("Empresa não identificada");
    const { data: user } = await supabase.auth.getUser();
    const { data: page, error } = await supabase
      .from("process_pages")
      .insert({
        company_id: companyId,
        title,
        icon: "📄",
        page_type: "page",
        created_by: user.user?.id,
      })
      .select()
      .single();
    if (error) throw error;

    const blocksToInsert = blocks.map((b, i) => ({
      page_id: page.id,
      block_type: b.block_type,
      content: b.content,
      position: i,
    }));
    const { error: bErr } = await supabase.from("process_blocks").insert(blocksToInsert);
    if (bErr) throw bErr;
    return page.id as string;
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      let text = "";
      let fallback = "Documento importado";

      if (tab === "file") {
        if (!file) { toast.error("Selecione um arquivo"); return; }
        fallback = file.name.replace(/\.(pdf|docx?|txt|md)$/i, "");
        const ext = file.name.toLowerCase().split(".").pop();
        if (ext === "pdf") text = await extractPdfText(file);
        else if (ext === "docx") text = await extractDocxText(file);
        else if (ext === "txt" || ext === "md") text = await file.text();
        else { toast.error("Formato não suportado. Use PDF, DOCX, TXT ou MD."); return; }
      } else if (tab === "gdoc") {
        if (!gdocUrl.trim()) { toast.error("Cole o link do Google Docs"); return; }
        text = await fetchGoogleDocText(gdocUrl.trim());
        fallback = "Documento do Google Docs";
      } else {
        if (!pasted.trim()) { toast.error("Cole o texto"); return; }
        text = pasted;
        fallback = pastedTitle.trim() || "Página importada";
      }

      if (!text.trim()) { toast.error("Não foi possível extrair conteúdo"); return; }

      const { title, blocks } = textToBlocks(text, fallback);
      const finalTitle = tab === "paste" && pastedTitle.trim() ? pastedTitle.trim() : title;
      const pageId = await createPage(finalTitle, blocks);
      toast.success(`Página criada com ${blocks.length} blocos`);
      setOpen(false);
      reset();
      onCreated(pageId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao importar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar documento
          </DialogTitle>
          <DialogDescription>
            Crie uma página a partir de um PDF, Word, Google Docs ou texto colado.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="file" className="gap-2"><FileText className="h-4 w-4" />Arquivo</TabsTrigger>
            <TabsTrigger value="gdoc" className="gap-2"><Link2 className="h-4 w-4" />Google Docs</TabsTrigger>
            <TabsTrigger value="paste" className="gap-2"><ClipboardPaste className="h-4 w-4" />Colar texto</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-3 pt-4">
            <Label>Selecione um arquivo (PDF, DOCX, TXT, MD)</Label>
            <Input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && <p className="text-xs text-muted-foreground">📎 {file.name} — {(file.size / 1024).toFixed(0)} KB</p>}
          </TabsContent>

          <TabsContent value="gdoc" className="space-y-3 pt-4">
            <Label>Link público do Google Docs</Label>
            <Input
              placeholder="https://docs.google.com/document/d/..."
              value={gdocUrl}
              onChange={(e) => setGdocUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ O documento precisa estar com acesso "Qualquer pessoa com o link pode visualizar".
            </p>
          </TabsContent>

          <TabsContent value="paste" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} placeholder="Título da página" />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea
                rows={10}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Cole aqui o texto. Use # / ## para títulos, - para listas, [ ] para checklist."
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</> : "Criar página"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
