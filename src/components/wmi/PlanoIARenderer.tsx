import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Flame, Target, AlertTriangle, Settings, BarChart3, Zap, Link2, Sparkles,
  TrendingUp, FileText, Rocket, Map, ListChecks, Package, CheckCircle2,
} from "lucide-react";

interface Section {
  title: string;
  emoji: string;
  body: string;
  kind: "intro" | "topic";
}

const ICONS: Record<string, { icon: any; gradient: string; tone: string }> = {
  "💸": { icon: Flame, gradient: "from-destructive/15 to-destructive/5", tone: "text-destructive border-destructive/30" },
  "🎯": { icon: Target, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "🚨": { icon: AlertTriangle, gradient: "from-warning/20 to-warning/5", tone: "text-warning border-warning/40" },
  "⚙️": { icon: Settings, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "⚙": { icon: Settings, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "📊": { icon: BarChart3, gradient: "from-secondary/10 to-secondary/5", tone: "text-secondary border-secondary/25" },
  "⚡": { icon: Zap, gradient: "from-warning/20 to-warning/5", tone: "text-warning border-warning/40" },
  "🔗": { icon: Link2, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "🔥": { icon: Sparkles, gradient: "from-destructive/15 to-destructive/5", tone: "text-destructive border-destructive/30" },
  "📈": { icon: TrendingUp, gradient: "from-success/15 to-success/5", tone: "text-success border-success/30" },
  "🚀": { icon: Rocket, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "🗺️": { icon: Map, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "📋": { icon: ListChecks, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "📦": { icon: Package, gradient: "from-warning/20 to-warning/5", tone: "text-warning border-warning/40" },
  "📌": { icon: FileText, gradient: "from-muted to-muted/50", tone: "text-muted-foreground border-border" },
};

// Regex que detecta um cabeçalho de seção:
// 1) "## Título"
// 2) "💸 1. Título"  (emoji + número + ponto)
// 3) "1. Título"     (apenas número + ponto, em linha curta)
const SECTION_START_RE = /(?:^|\n)\s*(?:#{1,3}\s*)?(?=(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]|[\u2600-\u27BF])\ufe0f?\s*\d+\.\s+|\d+\.\s+(?:Custo|Diagnóstico|Top|Plano|Metas|Roadmap|Conexão|Análise|Frases)\b)/gu;
const HEAD_RE = /^(?:#{1,3}\s*)?(?:(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]|[\u2600-\u27BF])\ufe0f?\s*)?\d+\.\s+.+$/u;

function prepareMarkdown(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(SECTION_START_RE, (match) => `${match.startsWith("\n") ? "\n\n" : ""}${match.trimStart()}`);
}

function parseSections(md: string): Section[] {
  if (!md) return [];
  const lines = prepareMarkdown(md).split("\n");
  const sections: Section[] = [];
  let current: { head: string; body: string[] } | null = null;
  let preamble: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (HEAD_RE.test(trimmed)) {
      if (current) sections.push(toSection(current));
      current = { head: trimmed.replace(/^##\s+/, ""), body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(toSection(current));

  // Se temos preâmbulo relevante, vira a primeira seção "Resumo"
  const preambleText = preamble.join("\n").trim();
  if (preambleText && sections.length) {
    sections.unshift({ title: "Resumo executivo", emoji: "📌", body: normalizeIntro(preambleText), kind: "intro" });
  }

  return sections;
}

function toSection(c: { head: string; body: string[] }): Section {
  const head = c.head.replace(/^#+\s*/, "").trim();
  const emojiMatch = head.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u);
  const emoji = emojiMatch ? emojiMatch[0] : "📌";
  const title = head.replace(/^#{1,3}\s*/, "").replace(emoji, "").replace(/^[\s\.\-:]*/, "").trim();
  return { title, emoji, body: normalizeBody(c.body.join("\n")), kind: "topic" };
}

function normalizeIntro(body: string): string {
  return body
    .replace(/^PLANO COMERCIAL EXECUTIVO\s*$/gim, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

// Garante que cada linha "Label: valor" vire um bullet/parágrafo próprio (legibilidade).
function normalizeBody(body: string): string {
  const raw = body.trim();
  if (!raw) return "";
  const lines = raw.split("\n").map((l) => l.trim());
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (!line) {
      inList = false;
      out.push("");
      continue;
    }
    if (/^[#>\-\*\|]/.test(line) || /^\d+\.\s/.test(line)) {
      inList = false;
      out.push(line);
      continue;
    }
    const kv = line.match(/^\*{0,2}([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^:*\n]{1,60})\*{0,2}\s*:\s*(.+)$/);
    if (kv) {
      if (!inList) {
        if (out.length && out[out.length - 1] !== "") out.push("");
        inList = true;
      }
      out.push(`- **${kv[1].trim()}:** ${kv[2].trim()}`);
      continue;
    }
    inList = false;
    if (out.length && out[out.length - 1] !== "") out.push("");
    out.push(line);
  }
  return out.join("\n").trim();
}

const markdownComponents = {
  h1: ({ children }: any) => <h4 className="text-base font-bold text-foreground mt-3 mb-2 border-b border-border pb-2">{children}</h4>,
  h2: ({ children }: any) => <h4 className="text-base font-bold text-foreground mt-3 mb-2 border-b border-border pb-2">{children}</h4>,
  h3: ({ children }: any) => <h5 className="text-sm font-semibold text-foreground mt-4 mb-2 bg-muted/70 border border-border rounded-md px-3 py-2">{children}</h5>,
  p: ({ children }: any) => <p className="text-sm leading-7 text-foreground/90 mb-3 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-bold text-foreground">{children}</strong>,
  ul: ({ children }: any) => <ul className="space-y-2 my-3">{children}</ul>,
  ol: ({ children }: any) => <ol className="space-y-2 my-3 list-decimal pl-5">{children}</ol>,
  li: ({ children }: any) => (
    <li className="text-sm leading-6 text-foreground/90 pl-0 marker:text-primary">
      <span className="inline-flex align-top gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary mt-1 shrink-0" />
        <span>{children}</span>
      </span>
    </li>
  ),
  table: ({ children }: any) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-secondary text-secondary-foreground">{children}</thead>,
  th: ({ children }: any) => <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-secondary-foreground/20 last:border-r-0">{children}</th>,
  td: ({ children }: any) => <td className="px-4 py-3 align-top border-t border-r border-border last:border-r-0 text-foreground/90">{children}</td>,
  blockquote: ({ children }: any) => <blockquote className="my-3 rounded-md border-l-4 border-primary bg-muted/60 px-4 py-3 text-sm">{children}</blockquote>,
  code: ({ children }: any) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">{children}</code>,
};

export function PlanoIARenderer({ markdown }: { markdown: string }) {
  const sections = useMemo(() => parseSections(markdown), [markdown]);

  // Se não detectou seções (markdown sem ##), renderiza inteiro
  if (!sections.length) {
    return (
      <Card>
        <CardContent className="p-6 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((s, i) => {
        const cfg = ICONS[s.emoji] || { icon: FileText, gradient: "from-muted to-muted/50", tone: "text-muted-foreground border-border" };
        const Icon = cfg.icon;
        return (
          <Card key={i} className={cn("border-l-4 overflow-hidden", cfg.tone)}>
            <CardHeader className={cn("bg-gradient-to-r pb-3", cfg.gradient)}>
              <CardTitle className="text-base flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-background/60 backdrop-blur", cfg.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </Badge>
                  {s.title}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <article className="prose prose-sm dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-2
                prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-wider prose-h3:text-muted-foreground
                prose-p:my-2 prose-p:leading-relaxed
                prose-strong:text-foreground prose-strong:font-semibold
                prose-ul:my-2 prose-li:my-1
                prose-table:my-3 prose-table:text-xs prose-table:border prose-table:rounded-lg prose-table:overflow-hidden
                prose-th:bg-muted/60 prose-th:p-2 prose-th:text-left prose-th:font-semibold prose-th:border-b
                prose-td:p-2 prose-td:border-b prose-td:border-border/40
                prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none
                prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:not-italic">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
