import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Loader2, CheckCircle2, Eye, Pencil, Trash2 } from "lucide-react";
import { useICPProfiles, useSaveICPProfile } from "@/hooks/useProspectingIntelligence";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Permite colar o "Manual ICP" em texto livre e salvá-lo de forma persistente.
 * O texto fica em intelligence.manual_text e é renderizado com formatação
 * (títulos, listas, parágrafos, separadores).
 */
export function ICPManualText() {
  const { data: profiles, refetch } = useICPProfiles();
  const save = useSaveICPProfile();

  const manualProfiles = useMemo(
    () => (profiles || []).filter((p: any) => p?.intelligence?.manual_text),
    [profiles]
  );

  const [name, setName] = useState("Manual ICP — Grow Sales Intelligence");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (!editingId && manualProfiles[0] && !text) {
      const p: any = manualProfiles[0];
      setEditingId(p.id);
      setName(p.name || "Manual ICP");
      setText(p.intelligence?.manual_text || "");
      setMode("preview");
    }
  }, [manualProfiles, editingId, text]);

  const handleNew = () => {
    setEditingId(null);
    setName("Manual ICP — Grow Sales Intelligence");
    setText("");
    setMode("edit");
  };

  const handleLoad = (p: any) => {
    setEditingId(p.id);
    setName(p.name);
    setText(p.intelligence?.manual_text || "");
    setMode("preview");
  };

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error("Cole o conteúdo do ICP antes de salvar");
      return;
    }
    if (!name.trim()) {
      toast.error("Informe um nome para o ICP");
      return;
    }
    try {
      // Preserva intelligence existente se estiver editando
      const existing: any = manualProfiles.find((p: any) => p.id === editingId);
      const baseIntel = existing?.intelligence || {};
      await save.mutateAsync({
        id: editingId || undefined,
        name: name.trim(),
        is_default: existing?.is_default ?? false,
        criteria: existing?.criteria ?? [],
        hot_threshold: existing?.hot_threshold ?? 75,
        warm_threshold: existing?.warm_threshold ?? 50,
        source: "manual",
        intelligence: {
          ...baseIntel,
          manual_text: text,
          manual_updated_at: new Date().toISOString(),
        },
        generated_at: new Date().toISOString(),
      } as any);
      toast.success(editingId ? "ICP atualizado" : "ICP salvo com sucesso");
      const res = await refetch();
      if (!editingId) {
        const created: any = (res.data as any[] | undefined)?.find(
          (p: any) => p.name === name.trim() && p?.intelligence?.manual_text
        );
        if (created?.id) setEditingId(created.id);
      }
      setMode("preview");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este ICP salvo?")) return;
    try {
      const { error } = await supabase.from("icp_profiles" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("ICP excluído");
      if (editingId === id) {
        setEditingId(null);
        setText("");
      }
      refetch();
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" /> Manual ICP em Texto
            <Badge className="bg-primary/15 text-primary border-primary/30">Persistente</Badge>
          </CardTitle>
          <CardDescription>
            Cole aqui o seu documento de ICP (perfil ideal, dores, sintomas, posicionamento, scripts).
            O conteúdo é salvo no seu workspace e fica disponível para toda a equipe — com formatação
            automática em parágrafos, listas e títulos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do ICP (ex.: Manual ICP — Clínicas Premium)"
              className="flex-1 min-w-[260px]"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={mode === "edit" ? "default" : "outline"}
                onClick={() => setMode("edit")}
                className="gap-1"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                size="sm"
                variant={mode === "preview" ? "default" : "outline"}
                onClick={() => setMode("preview")}
                className="gap-1"
                disabled={!text.trim()}
              >
                <Eye className="h-3.5 w-3.5" /> Visualizar
              </Button>
            </div>
            <Button onClick={handleSave} disabled={save.isPending} className="gap-1">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Atualizar" : "Salvar ICP"}
            </Button>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={handleNew}>
                + Novo
              </Button>
            )}
          </div>

          {mode === "edit" ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Cole aqui o manual completo do ICP.\n\nDicas de formatação:\n• Linhas começando com "✅", "❌", "⚠️", "-" viram listas\n• Linhas em MAIÚSCULAS viram títulos\n• Linhas com "━━━" viram separadores\n• Linhas vazias separam parágrafos`}
              rows={18}
              className="font-mono text-xs leading-relaxed"
            />
          ) : (
            <div className="rounded-lg border bg-card p-4 md:p-6 max-h-[600px] overflow-auto">
              {text.trim() ? (
                <FormattedICP text={text} />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum conteúdo para visualizar.</p>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {editingId
              ? "Você está editando um ICP existente. Clique em Atualizar para salvar."
              : "Salvo no seu workspace (banco de dados). Toda a equipe consegue acessar."}
          </p>
        </CardContent>
      </Card>

      {manualProfiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">ICPs salvos ({manualProfiles.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {manualProfiles.map((p: any) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-2 p-2 rounded border ${
                  editingId === p.id ? "border-primary bg-primary/5" : "bg-background"
                }`}
              >
                <button onClick={() => handleLoad(p)} className="flex-1 text-left">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(p.intelligence?.manual_text || "").length} caracteres
                    {p.intelligence?.manual_updated_at &&
                      ` · atualizado em ${new Date(p.intelligence.manual_updated_at).toLocaleString("pt-BR")}`}
                  </p>
                </button>
                <Button variant="ghost" size="icon" onClick={() => handleLoad(p)} title="Abrir">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(p.id)}
                  title="Excluir"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Renderização leve do texto do ICP, transformando-o em uma versão diagramada
 * (títulos, listas, separadores, parágrafos), sem precisar de biblioteca de Markdown.
 */
function FormattedICP({ text }: { text: string }) {
  // Normaliza separadores tipo "━━━━" e linhas tracejadas
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  type Block =
    | { kind: "h1"; content: string }
    | { kind: "h2"; content: string }
    | { kind: "hr" }
    | { kind: "list"; items: string[] }
    | { kind: "p"; content: string }
    | { kind: "quote"; content: string };

  const blocks: Block[] = [];
  let listBuf: string[] = [];
  let paraBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length) {
      blocks.push({ kind: "list", items: listBuf });
      listBuf = [];
    }
  };
  const flushPara = () => {
    if (paraBuf.length) {
      const content = paraBuf.join(" ").trim();
      if (content) blocks.push({ kind: "p", content });
      paraBuf = [];
    }
  };

  const isSeparator = (l: string) => /^[\s━─\-=_*•·]{3,}$/.test(l.trim());
  const isBullet = (l: string) => /^\s*(✅|❌|⚠️|🔴|🟢|🟡|🔵|•|-|–|\d+\.)\s+/.test(l);
  const isH1 = (l: string) => {
    const t = l.trim();
    if (t.length < 3 || t.length > 80) return false;
    // Maiúsculas/símbolos predominantes e sem terminação de frase
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (!letters) return false;
    const upper = letters.replace(/[^A-ZÀ-Þ]/g, "");
    return upper.length / letters.length > 0.7 && !/[.?!:]$/.test(t);
  };
  const isH2 = (l: string) => /^\s*\d+\.\s+[A-ZÀ-Þ][^a-z]{2,}/.test(l) || /^[A-ZÀ-Þ][^a-z]{2,}:$/.test(l.trim());

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      flushList();
      flushPara();
      continue;
    }
    if (isSeparator(line)) {
      flushList();
      flushPara();
      blocks.push({ kind: "hr" });
      continue;
    }
    if (isBullet(line)) {
      flushPara();
      listBuf.push(line.replace(/^\s*(•|-|–)\s+/, ""));
      continue;
    }
    if (isH1(line)) {
      flushList();
      flushPara();
      blocks.push({ kind: "h1", content: line });
      continue;
    }
    if (isH2(line)) {
      flushList();
      flushPara();
      blocks.push({ kind: "h2", content: line.replace(/:$/, "") });
      continue;
    }
    if (line.startsWith('"') || line.startsWith("“")) {
      flushList();
      flushPara();
      blocks.push({ kind: "quote", content: line.replace(/^[“"]|[”"]$/g, "") });
      continue;
    }
    flushList();
    paraBuf.push(line);
  }
  flushList();
  flushPara();

  return (
    <article className="prose-icp space-y-3 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h1":
            return (
              <h3
                key={i}
                className="text-base font-bold tracking-wide text-primary uppercase mt-4 first:mt-0"
              >
                {b.content}
              </h3>
            );
          case "h2":
            return (
              <h4 key={i} className="text-sm font-semibold text-foreground mt-3">
                {b.content}
              </h4>
            );
          case "hr":
            return <div key={i} className="border-t border-dashed border-border my-3" />;
          case "list":
            return (
              <ul key={i} className="space-y-1 pl-1">
                {b.items.map((it, j) => {
                  const m = it.match(/^(✅|❌|⚠️|🔴|🟢|🟡|🔵)\s+(.*)$/);
                  const icon = m?.[1];
                  const txt = m ? m[2] : it;
                  return (
                    <li key={j} className="flex gap-2">
                      <span className="shrink-0 leading-relaxed">{icon || "•"}</span>
                      <span className="text-foreground/90">{txt}</span>
                    </li>
                  );
                })}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-4 border-primary/60 pl-3 italic text-foreground/90 bg-primary/5 py-2 rounded-r"
              >
                "{b.content}"
              </blockquote>
            );
          case "p":
          default:
            return (
              <p key={i} className="text-foreground/90">
                {b.content}
              </p>
            );
        }
      })}
    </article>
  );
}
