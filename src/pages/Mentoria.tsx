import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { GraduationCap, Calendar, Video, Users, Plus, ExternalLink, Clock, MessageSquare, Heart, Sparkles, Pin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Mentoria() {
  const [tab, setTab] = useState("sessoes");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          Mentoria Comercial
        </h1>
        <p className="text-muted-foreground mt-1">
          Sessões 1:1 com especialistas, biblioteca de gravações e comunidade de mentorados Waze.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sessoes" className="gap-2"><Calendar className="h-4 w-4" /> Sessões</TabsTrigger>
          <TabsTrigger value="gravacoes" className="gap-2"><Video className="h-4 w-4" /> Gravações</TabsTrigger>
          <TabsTrigger value="comunidade" className="gap-2"><Users className="h-4 w-4" /> Comunidade</TabsTrigger>
        </TabsList>

        <TabsContent value="sessoes"><SessionsTab /></TabsContent>
        <TabsContent value="gravacoes"><RecordingsTab /></TabsContent>
        <TabsContent value="comunidade"><CommunityTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== SESSÕES ==============
function SessionsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ topic: "", description: "", scheduled_at: "", duration_minutes: 60 });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["mentorship_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_sessions" as any)
        .select("*")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("mentorship_sessions" as any).insert({
        company_id: companyId,
        scheduled_by: user?.id,
        topic: form.topic,
        description: form.description,
        scheduled_at: form.scheduled_at,
        duration_minutes: form.duration_minutes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sessão agendada");
      setOpen(false);
      setForm({ topic: "", description: "", scheduled_at: "", duration_minutes: 60 });
      qc.invalidateQueries({ queryKey: ["mentorship_sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upcoming = (sessions || []).filter((s) => s.status === "scheduled" && new Date(s.scheduled_at) > new Date());
  const past = (sessions || []).filter((s) => s.status !== "scheduled" || new Date(s.scheduled_at) <= new Date());

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {upcoming.length} sessão(ões) agendada(s) · {past.length} realizadas
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Agendar Mentoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar nova sessão</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tema</Label>
                <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Ex: Estruturar funil de vendas B2B" />
              </div>
              <div>
                <Label>Descrição / o que quer discutir</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data e hora</Label>
                  <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.topic || !form.scheduled_at || createMutation.isPending}>
                Agendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-40" /> : (
        <>
          <section>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Próximas
            </h2>
            {upcoming.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
                Nenhuma sessão agendada. Clique em "Agendar Mentoria" acima.
              </CardContent></Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {upcoming.map((s) => <SessionCard key={s.id} session={s} />)}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="font-semibold mb-3 text-muted-foreground">Histórico</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {past.map((s) => <SessionCard key={s.id} session={s} historic />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SessionCard({ session, historic = false }: { session: any; historic?: boolean }) {
  return (
    <Card className={historic ? "opacity-75" : "border-primary/30"}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{session.topic}</CardTitle>
          <Badge variant={session.status === "completed" ? "secondary" : "default"}>
            {session.status === "scheduled" ? "Agendada" : session.status === "completed" ? "Concluída" : session.status}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
            {format(new Date(session.scheduled_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          <span>· {session.duration_minutes}min</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {session.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{session.description}</p>}
        {session.meeting_url && !historic && (
          <Button size="sm" variant="outline" className="gap-2 w-full" onClick={() => window.open(session.meeting_url, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5" /> Entrar na reunião
          </Button>
        )}
        {session.post_session_notes && historic && (
          <div className="text-xs bg-muted/50 rounded p-2 mt-2">
            <strong>Anotações:</strong> {session.post_session_notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============== GRAVAÇÕES ==============
function RecordingsTab() {
  const { data: recordings, isLoading } = useQuery({
    queryKey: ["mentorship_recordings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_recordings" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) return <Skeleton className="h-40 mt-4" />;

  if (!recordings?.length) {
    return (
      <Card className="mt-4">
        <CardContent className="p-10 text-center">
          <Video className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhuma gravação disponível ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Suas sessões realizadas aparecerão aqui automaticamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {recordings.map((r) => (
        <Card key={r.id} className="overflow-hidden hover:shadow-lg transition-all">
          <div className="aspect-video bg-muted relative">
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <Video className="h-12 w-12 text-primary/40" />
              </div>
            )}
            {r.duration_seconds && (
              <Badge className="absolute bottom-2 right-2">
                {Math.floor(r.duration_seconds / 60)}min
              </Badge>
            )}
          </div>
          <CardContent className="p-4">
            <h3 className="font-semibold line-clamp-2">{r.title}</h3>
            {r.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.description}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {r.tags?.slice(0, 3).map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
            </div>
            <Button size="sm" className="w-full mt-3 gap-2" onClick={() => window.open(r.video_url, "_blank")}>
              <Video className="h-3.5 w-3.5" /> Assistir
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============== COMUNIDADE ==============
function CommunityTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", post_type: "discussion" });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["community_posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_community_posts" as any)
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id).maybeSingle();
      const { error } = await supabase.from("mentorship_community_posts" as any).insert({
        author_id: user?.id,
        author_company_id: companyId,
        author_name: profile?.full_name || "Mentorado",
        title: form.title,
        content: form.content,
        post_type: form.post_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publicação criada");
      setOpen(false);
      setForm({ title: "", content: "", post_type: "discussion" });
      qc.invalidateQueries({ queryKey: ["community_posts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Compartilhe wins, dúvidas e dicas com outros mentorados Waze.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova publicação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Publicar na comunidade</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <select className="w-full border rounded-md p-2 bg-background"
                  value={form.post_type}
                  onChange={(e) => setForm({ ...form, post_type: e.target.value })}>
                  <option value="discussion">💬 Discussão</option>
                  <option value="question">❓ Pergunta</option>
                  <option value="win">🏆 Conquista</option>
                  <option value="tip">💡 Dica</option>
                </select>
              </div>
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.content || createMutation.isPending}>
                Publicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-40" /> : !posts?.length ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto opacity-30 mb-3" />
          Seja o primeiro a publicar!
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => <CommunityPost key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  discussion: { label: "💬 Discussão", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  question: { label: "❓ Pergunta", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  win: { label: "🏆 Conquista", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  tip: { label: "💡 Dica", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
};

function CommunityPost({ post }: { post: any }) {
  const meta = TYPE_LABEL[post.post_type] || TYPE_LABEL.discussion;
  return (
    <Card className={post.pinned ? "border-primary/40" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {post.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
              <Badge className={meta.color} variant="outline">{meta.label}</Badge>
              <span className="text-xs text-muted-foreground">
                por {post.author_name} · {format(new Date(post.created_at), "dd MMM", { locale: ptBR })}
              </span>
            </div>
            <CardTitle className="text-base mt-1">{post.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{post.content}</p>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {post.likes_count}</span>
          <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {post.comments_count}</span>
        </div>
      </CardContent>
    </Card>
  );
}
