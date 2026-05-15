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
const SECTION_START_RE = /(?:^|\n)\s*(?:\*{0,2}\s*)?(?:#{1,3}\s*)?(?=(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]|[\u2600-\u27BF])\ufe0f?\s*\d+\.\s+|\d+\.\s+(?:Custo|Diagnóstico|Top|Plano|Metas|Roadmap|Conexão|Análise|Frases)\b)/gu;
const HEAD_RE = /^(?:\*{0,2}\s*)?(?:#{1,3}\s*)?(?:(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]|[\u2600-\u27BF])\ufe0f?\s*\d+\.\s+.+|\d+\.\s+(?:Custo|Diagnóstico|Top|Plano|Metas|Roadmap|Conexão|Análise|Frases)\b.+?)(?:\s*\*{0,2})$/u;

function cleanHeadLine(line: string): string {
  return line.replace(/^\*{1,2}\s*/, "").replace(/\s*\*{1,2}$/, "").trim();
}

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
    const trimmed = cleanHeadLine(line.trim());
    if (HEAD_RE.test(trimmed)) {
      if (current) sections.push(toSection(current));
      current = { head: trimmed.replace(/^#{1,3}\s+/, ""), body: [] };
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
  const head = cleanHeadLine(c.head.replace(/^#+\s*/, "").trim());
  const emojiMatch = head.match(/^((?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]|[\u2600-\u27BF])\ufe0f?)/u);
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
    if (/^(Fase\s+\d+|Ação\s+\d+)\s*:/i.test(line)) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(`### ${line}`);
      out.push("");
      inList = false;
      continue;
    }
    if (/^Ação\s+Responsável\s+KPI\s+Módulo\s+GROW$/i.test(line)) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push("### Ações, responsáveis, KPIs e módulos");
      inList = false;
      continue;
    }
    if (/^Métrica\s+Hoje\s+/i.test(line)) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(`### ${line.replace(/\s{2,}/g, " · ")}`);
      inList = false;
      continue;
    }
    if (/^[#>\-\*\|]/.test(line) || /^\d+\.\s/.test(line)) {
      inList = false;
      out.push(/^(Fase|Ação|Meta|KPI|Módulo GROW|Métrica)\b/i.test(line) ? `### ${line}` : line);
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
    <li className="flex gap-2 text-sm leading-6 text-foreground/90">
        <CheckCircle2 className="h-4 w-4 text-primary mt-1 shrink-0" />
        <div className="min-w-0 [&>p]:m-0">{children}</div>
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
      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{prepareMarkdown(markdown)}</ReactMarkdown>
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
          <Card key={i} className={cn("overflow-hidden border-border shadow-sm", s.kind === "topic" && "border-l-4", cfg.tone)}>
            <CardHeader className={cn("bg-gradient-to-r pb-4", cfg.gradient)}>
              <CardTitle className="flex items-start gap-3 text-base leading-tight">
                <div className={cn("shrink-0 rounded-lg border bg-background/80 p-2", cfg.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant={s.kind === "intro" ? "secondary" : "outline"} className="h-5 text-[10px] font-mono">
                      {s.kind === "intro" ? "BASE" : `PASSO ${String(i).padStart(2, "0")}`}
                    </Badge>
                    <span>{s.title}</span>
                  </span>
                  {s.kind === "topic" && <span className="text-xs font-normal text-muted-foreground">Objetivo, correção, KPI e módulo GROW organizados para execução.</span>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 md:p-6">
              <article className="max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{s.body}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
