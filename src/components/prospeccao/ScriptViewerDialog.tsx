import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Search, ArrowLeft, ExternalLink, ToggleRight } from "lucide-react";

interface PageRow {
  id: string;
  title: string;
  icon: string | null;
  updated_at: string;
}
interface Block {
  id: string;
  block_type: string;
  content: any;
  position: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactName?: string;
}

export function ScriptViewerDialog({ open, onOpenChange, contactName }: Props) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setBlocks([]);
      return;
    }
    (async () => {
      setLoadingList(true);
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) { setLoadingList(false); return; }
      const { data } = await supabase
        .from("process_pages")
        .select("id, title, icon, updated_at")
        .eq("company_id", companyId as string)
        .order("updated_at", { ascending: false })
        .limit(200);
      setPages((data as PageRow[]) || []);
      setLoadingList(false);
    })();
  }, [open]);

  async function openPage(p: PageRow) {
    setSelectedId(p.id);
    setSelectedTitle(p.title);
    setLoadingBlocks(true);
    const { data } = await supabase
      .from("process_blocks")
      .select("id, block_type, content, position")
      .eq("page_id", p.id)
      .order("position", { ascending: true });
    setBlocks((data as Block[]) || []);
    setLoadingBlocks(false);
  }

  const filtered = pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {selectedId ? selectedTitle : "Scripts do Workspace"}
          </DialogTitle>
          <DialogDescription>
            {selectedId
              ? (contactName ? `Consulta rápida para ${contactName}` : "Consulta rápida")
              : "Selecione um script criado em Processos Comerciais para usar durante a ligação."}
          </DialogDescription>
        </DialogHeader>

        {!selectedId ? (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar script..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
              {loadingList ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhuma página encontrada. Crie scripts em Processos Comerciais → Workspace.
                </p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openPage(p)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left transition"
                    >
                      <span className="text-xl">{p.icon || "📄"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Atualizado {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setBlocks([]); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <a
                href={`/processos/page/${selectedId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Abrir em nova aba <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
              {loadingBlocks ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando script...
                </div>
              ) : blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-10">Sem conteúdo nesta página.</p>
              ) : (
                <article className="space-y-3 pb-4">
                  {blocks.map((b) => <BlockView key={b.id} block={b} />)}
                </article>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BlockView({ block }: { block: Block }) {
  const text = block.content?.text || "";
  switch (block.block_type) {
    case "heading1": return <h1 className="text-2xl font-bold mt-4 mb-1">{text}</h1>;
    case "heading2": return <h2 className="text-xl font-semibold mt-3 mb-1">{text}</h2>;
    case "heading3": return <h3 className="text-lg font-medium mt-2 mb-1">{text}</h3>;
    case "bullet_list":
    case "numbered_list":
      return (
        <div className="flex items-start gap-2 leading-relaxed text-sm">
          <span className="mt-0.5">•</span>
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      );
    case "checklist":
      return (
        <div className="flex items-start gap-2 leading-relaxed text-sm">
          <input type="checkbox" checked={!!block.content?.checked} readOnly className="mt-1 h-4 w-4" />
          <span className={block.content?.checked ? "line-through text-muted-foreground whitespace-pre-wrap" : "whitespace-pre-wrap"}>
            {text}
          </span>
        </div>
      );
    case "quote":
      return <div className="border-l-4 border-primary/50 pl-3 italic text-sm whitespace-pre-wrap">{text}</div>;
    case "code":
      return <pre className="bg-muted rounded-md p-2 font-mono text-xs whitespace-pre-wrap">{text}</pre>;
    case "callout":
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 flex items-start gap-2 text-sm">
          <span>💡</span>
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      );
    case "divider": return <hr className="border-border my-3" />;
    case "toggle":
      return (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-2 font-medium text-sm">
            <ToggleRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
            {text}
          </summary>
        </details>
      );
    case "image":
      return block.content?.url ? <img src={block.content.url} alt={block.content?.fileName || "Imagem"} className="rounded-md border max-w-full h-auto" /> : null;
    case "file":
      return block.content?.url ? (
        <a href={block.content.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs hover:bg-muted">
          <FileText className="h-3.5 w-3.5" /> {block.content?.fileName || "Arquivo"}
        </a>
      ) : null;
    case "link":
      return block.content?.url ? (
        <a href={block.content.url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline break-all">
          {block.content?.title || block.content.url}
        </a>
      ) : null;
    default:
      return text ? <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p> : null;
  }
}
