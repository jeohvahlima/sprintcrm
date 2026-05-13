import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Lock, ToggleRight } from "lucide-react";

interface ProcessPage {
  id: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
  properties: any;
}

interface Block {
  id: string;
  block_type: string;
  content: any;
  position: number;
}

export default function ProcessPagePublic() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<ProcessPage | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = page?.title ? `${page.title} • Workspace` : "Página compartilhada";
  }, [page]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: pageData, error: pageErr } = await supabase
        .from("process_pages")
        .select("id, title, icon, cover_url, properties")
        .eq("id", id)
        .maybeSingle();

      if (pageErr || !pageData) {
        setError("Página não encontrada ou não está publicada.");
        setLoading(false);
        return;
      }

      const status = (pageData.properties as any)?.status;
      if (status !== "published") {
        setError("Esta página ainda não foi publicada. Peça ao autor para publicá-la para visualizar o conteúdo.");
        setLoading(false);
        return;
      }

      const { data: blockData } = await supabase
        .from("process_blocks")
        .select("id, block_type, content, position")
        .eq("page_id", id)
        .order("position", { ascending: true });

      setPage(pageData as ProcessPage);
      setBlocks((blockData as Block[]) || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando página...</div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-xl border border-border bg-card">
          <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Página indisponível</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link to="/" className="inline-block text-sm text-primary hover:underline">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {page.cover_url && (
        <div
          className="w-full h-48 md:h-64 bg-center bg-cover"
          style={{ backgroundImage: `url(${page.cover_url})` }}
        />
      )}

      <div className="max-w-3xl mx-auto px-5 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{page.icon || "📄"}</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight">{page.title}</h1>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Página compartilhada do Workspace
          </div>
        </header>

        <article className="space-y-3">
          {blocks.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Esta página ainda não tem conteúdo.</p>
          )}
          {blocks.map((b) => (
            <BlockView key={b.id} block={b} />
          ))}
        </article>

        <footer className="mt-16 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Compartilhado via Workspace
          </p>
        </footer>
      </div>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  const text = block.content?.text || "";

  switch (block.block_type) {
    case "heading1":
      return <h1 className="text-3xl font-bold mt-6 mb-2">{text}</h1>;
    case "heading2":
      return <h2 className="text-2xl font-semibold mt-5 mb-2">{text}</h2>;
    case "heading3":
      return <h3 className="text-xl font-medium mt-4 mb-2">{text}</h3>;
    case "bullet_list":
      return (
        <div className="flex items-start gap-2 leading-relaxed">
          <span className="mt-1">•</span>
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      );
    case "numbered_list":
      return (
        <div className="flex items-start gap-2 leading-relaxed">
          <span className="mt-1 text-muted-foreground">•</span>
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      );
    case "checklist":
      return (
        <div className="flex items-start gap-2 leading-relaxed">
          <input
            type="checkbox"
            checked={!!block.content?.checked}
            readOnly
            className="mt-1.5 h-4 w-4 rounded border-muted-foreground/50"
          />
          <span className={block.content?.checked ? "line-through text-muted-foreground whitespace-pre-wrap" : "whitespace-pre-wrap"}>
            {text}
          </span>
        </div>
      );
    case "quote":
      return <div className="border-l-4 border-primary/50 pl-4 italic whitespace-pre-wrap">{text}</div>;
    case "code":
      return <pre className="bg-muted rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">{text}</pre>;
    case "callout":
      return (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
          <span>💡</span>
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      );
    case "divider":
      return <hr className="border-border my-4" />;
    case "toggle":
      return (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-2 font-medium">
            <ToggleRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
            {text}
          </summary>
        </details>
      );
    case "image":
      return block.content?.url ? (
        <img
          src={block.content.url}
          alt={block.content?.fileName || "Imagem"}
          className="rounded-lg border max-w-full h-auto"
        />
      ) : null;
    case "file":
      return block.content?.url ? (
        <a
          href={block.content.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 text-sm"
        >
          <FileText className="h-4 w-4" />
          {block.content?.fileName || "Arquivo"}
        </a>
      ) : null;
    case "link":
      return block.content?.url ? (
        <a
          href={block.content.url}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline break-all"
        >
          {block.content?.title || block.content.url}
        </a>
      ) : null;
    case "embed": {
      const url = block.content?.url || "";
      const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
      if (isYoutube) {
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
        if (videoId) {
          return (
            <div className="relative aspect-video rounded-lg overflow-hidden border">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
              />
            </div>
          );
        }
      }
      return (
        <div className="p-4 rounded-lg border bg-muted/50 text-sm text-muted-foreground break-all">
          {url}
        </div>
      );
    }
    default:
      return text ? <p className="whitespace-pre-wrap leading-relaxed">{text}</p> : null;
  }
}
