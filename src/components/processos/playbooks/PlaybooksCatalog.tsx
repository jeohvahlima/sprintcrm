import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Eye,
  Copy,
  Trash2,
  Sparkles,
  Search,
  Loader2,
  Crown,
  Library,
} from "lucide-react";
import {
  usePlaybooks,
  useDuplicatePlaybook,
  useDeletePlaybook,
  CommercialPlaybook,
} from "@/hooks/useCommercialPlaybooks";
import { PlaybookViewer } from "./PlaybookViewer";
import { usePermissions } from "@/hooks/usePermissions";

const CATEGORIES = [
  { value: "all", label: "Todas categorias" },
  { value: "pre_vendas", label: "Pré-Vendas (Cold Call, SDR, Cadências)" },
  { value: "vendas", label: "Vendas (Closer, Objeções, Fechamento)" },
  { value: "estrategia", label: "Estratégia (Playbook, RACI, Metas)" },
  { value: "avancado", label: "Avançado (Social Selling, DISC, Inteligência)" },
];

const SEGMENTS = [
  { value: "all", label: "Todos segmentos" },
  { value: "saude", label: "🏥 Saúde / Clínicas" },
  { value: "advocacia", label: "⚖️ Advocacia / Jurídico" },
  { value: "geral", label: "🌐 Geral (B2B)" },
];

const CATEGORY_BADGE: Record<string, string> = {
  pre_vendas: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  vendas: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  estrategia: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  avancado: "bg-pink-500/10 text-pink-700 border-pink-500/30",
};

const CATEGORY_LABEL: Record<string, string> = {
  pre_vendas: "Pré-Vendas",
  vendas: "Vendas",
  estrategia: "Estratégia",
  avancado: "Avançado",
};

export function PlaybooksCatalog() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState<"all" | "official" | "mine">("all");
  const [viewer, setViewer] = useState<CommercialPlaybook | null>(null);

  const { data: playbooks = [], isLoading } = usePlaybooks();
  const duplicate = useDuplicatePlaybook();
  const remove = useDeletePlaybook();
  const { isSuperAdmin } = usePermissions();

  const filtered = useMemo(() => {
    return playbooks.filter((p) => {
      if (segment !== "all" && p.segment !== segment) return false;
      if (category !== "all" && p.category !== category) return false;
      if (tab === "official" && !p.is_global) return false;
      if (tab === "mine" && p.is_global) return false;
      if (search) {
        const t = `${p.title} ${p.description ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase();
        if (!t.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [playbooks, segment, category, tab, search]);

  const handleDuplicate = async (p: CommercialPlaybook) => {
    await duplicate.mutateAsync(p);
    setViewer(null);
  };

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden relative">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
        <CardHeader className="relative">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-white">
              <Library className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Biblioteca de Playbooks Comerciais
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
                  <Sparkles className="h-3 w-3 mr-1" /> Modelos prontos
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Scripts, roteiros, frameworks e playbooks por segmento e categoria.
                Visualize, exporte em PDF ou duplique para personalizar para a sua empresa.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, tag ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="md:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEGMENTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="official">
            <Crown className="h-3.5 w-3.5 mr-1" /> Oficiais
          </TabsTrigger>
          <TabsTrigger value="mine">Meus / da empresa</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="font-semibold">Nenhum playbook encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste os filtros ou busque por outro termo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="hover:shadow-lg hover:border-primary/40 transition-all flex flex-col overflow-hidden group"
            >
              <div
                className="h-28 relative flex items-end p-4"
                style={{
                  background: `linear-gradient(135deg, ${p.accent_color || "#22C55E"}, ${
                    p.accent_color ? p.accent_color + "AA" : "#16A34A"
                  })`,
                }}
              >
                <div className="absolute top-3 right-3 flex gap-1">
                  {p.is_global ? (
                    <Badge className="bg-white/25 text-white backdrop-blur border-white/40">
                      <Crown className="h-3 w-3 mr-1" /> Oficial
                    </Badge>
                  ) : (
                    <Badge className="bg-white/25 text-white backdrop-blur border-white/40">
                      Cópia editável
                    </Badge>
                  )}
                </div>
                <div className="text-5xl drop-shadow-lg">{p.cover_emoji || "📘"}</div>
              </div>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="outline" className={`text-[10px] ${CATEGORY_BADGE[p.category]}`}>
                    {CATEGORY_LABEL[p.category] || p.category}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {p.segment}
                  </Badge>
                  {p.estimated_time && (
                    <Badge variant="outline" className="text-[10px]">
                      ⏱ {p.estimated_time}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base leading-snug">{p.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{p.description}</p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="default" className="flex-1" onClick={() => setViewer(p)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Abrir
                  </Button>
                  {p.is_global ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDuplicate(p)}
                      disabled={duplicate.isPending}
                      title="Duplicar para sua empresa"
                    >
                      {duplicate.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Excluir "${p.title}"?`)) remove.mutate(p.id);
                      }}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlaybookViewer
        playbook={viewer}
        open={!!viewer}
        onClose={() => setViewer(null)}
        onDuplicate={handleDuplicate}
        canDuplicate={true}
      />

      {isSuperAdmin && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="py-4 text-xs text-muted-foreground flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            Você é super admin — playbooks marcados como "Oficial" são visíveis para todas as
            subcontas. Para criar novos modelos oficiais, contate o time de produto (criação via
            backend).
          </CardContent>
        </Card>
      )}
    </div>
  );
}
