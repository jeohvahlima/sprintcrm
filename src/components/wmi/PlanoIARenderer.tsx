import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Flame, Target, AlertTriangle, Settings, BarChart3, Zap, Link2, Sparkles,
  TrendingUp, FileText, Rocket, Map, ListChecks, Package,
} from "lucide-react";

interface Section {
  title: string;
  emoji: string;
  body: string;
}

const ICONS: Record<string, { icon: any; gradient: string; tone: string }> = {
  "💸": { icon: Flame, gradient: "from-rose-500/15 to-rose-500/5", tone: "text-rose-500 border-rose-500/30" },
  "🎯": { icon: Target, gradient: "from-primary/15 to-primary/5", tone: "text-primary border-primary/30" },
  "🚨": { icon: AlertTriangle, gradient: "from-orange-500/15 to-orange-500/5", tone: "text-orange-500 border-orange-500/30" },
  "⚙️": { icon: Settings, gradient: "from-blue-500/15 to-blue-500/5", tone: "text-blue-500 border-blue-500/30" },
  "⚙": { icon: Settings, gradient: "from-blue-500/15 to-blue-500/5", tone: "text-blue-500 border-blue-500/30" },
  "📊": { icon: BarChart3, gradient: "from-violet-500/15 to-violet-500/5", tone: "text-violet-500 border-violet-500/30" },
  "⚡": { icon: Zap, gradient: "from-amber-500/15 to-amber-500/5", tone: "text-amber-500 border-amber-500/30" },
  "🔗": { icon: Link2, gradient: "from-cyan-500/15 to-cyan-500/5", tone: "text-cyan-500 border-cyan-500/30" },
  "🔥": { icon: Sparkles, gradient: "from-fuchsia-500/15 to-fuchsia-500/5", tone: "text-fuchsia-500 border-fuchsia-500/30" },
  "📈": { icon: TrendingUp, gradient: "from-emerald-500/15 to-emerald-500/5", tone: "text-emerald-500 border-emerald-500/30" },
  "🚀": { icon: Rocket, gradient: "from-indigo-500/15 to-indigo-500/5", tone: "text-indigo-500 border-indigo-500/30" },
  "🗺️": { icon: Map, gradient: "from-teal-500/15 to-teal-500/5", tone: "text-teal-500 border-teal-500/30" },
  "📋": { icon: ListChecks, gradient: "from-sky-500/15 to-sky-500/5", tone: "text-sky-500 border-sky-500/30" },
  "📦": { icon: Package, gradient: "from-amber-600/15 to-amber-600/5", tone: "text-amber-600 border-amber-600/30" },
  "📌": { icon: FileText, gradient: "from-muted to-muted/50", tone: "text-muted-foreground border-border" },
};

// Regex que detecta um cabeçalho de seção:
// 1) "## Título"
// 2) "💸 1. Título"  (emoji + número + ponto)
// 3) "1. Título"     (apenas número + ponto, em linha curta)
const HEAD_RE = /^(?:##\s+.+|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})\s*\d+\.\s+.+|\d+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]{3,80})$/u;

function parseSections(md: string): Section[] {
  if (!md) return [];
  const lines = md.split("\n");
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
    sections.unshift({ title: "Resumo", emoji: "📌", body: preambleText });
  }

  return sections;
}

function toSection(c: { head: string; body: string[] }): Section {
  const head = c.head.replace(/^#+\s*/, "").trim();
  const emojiMatch = head.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u);
  const emoji = emojiMatch ? emojiMatch[0] : "📌";
  const title = head.replace(emoji, "").replace(/^[\s\.\-:]*/, "").trim();
  return { title, emoji, body: normalizeBody(c.body.join("\n")) };
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
