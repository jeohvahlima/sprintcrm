import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  GraduationCap, Calendar, Video, Users, Plus, ExternalLink, Clock, MessageSquare, Heart, Sparkles, Pin,
  Target, BookOpen, BarChart3, Calculator, ListChecks, FileText, Loader2, ArrowRight, CheckCircle2, Trophy, Award, Layers, Zap
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useWMIScore } from "@/hooks/useWMI";

export default function Mentoria() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">Waze Advisory</Badge>
            <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-xs">Premium</Badge>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            Mentoria & Advisory
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Operating System de Advisory: diagnóstico, trilhas, sessões 1:1, playbooks, coaching e máquina de vendas.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="diagnostico" className="gap-2"><Target className="h-4 w-4" /> Diagnóstico</TabsTrigger>
          <TabsTrigger value="trilhas" className="gap-2"><Layers className="h-4 w-4" /> Trilhas</TabsTrigger>
          <TabsTrigger value="sessoes" className="gap-2"><Calendar className="h-4 w-4" /> Sessões</TabsTrigger>
          <TabsTrigger value="biblioteca" className="gap-2"><BookOpen className="h-4 w-4" /> Playbooks</TabsTrigger>
          <TabsTrigger value="coaching" className="gap-2"><Trophy className="h-4 w-4" /> Coaching</TabsTrigger>
          <TabsTrigger value="maquina" className="gap-2"><Calculator className="h-4 w-4" /> Máquina de Vendas</TabsTrigger>
          <TabsTrigger value="comunidade" className="gap-2"><Users className="h-4 w-4" /> Comunidade</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="diagnostico"><DiagnosticoTab /></TabsContent>
        <TabsContent value="trilhas"><TrilhasTab /></TabsContent>
        <TabsContent value="sessoes"><SessionsTab /></TabsContent>
        <TabsContent value="biblioteca"><PlaybooksTab /></TabsContent>
        <TabsContent value="coaching"><CoachingTab /></TabsContent>
        <TabsContent value="maquina"><MaquinaVendasTab /></TabsContent>
        <TabsContent value="comunidade"><CommunityTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== DASHBOARD ==============
function DashboardTab() {
  const navigate = useNavigate();
  const { data: score } = useWMIScore();
  const { data: sessions } = useQuery({
    queryKey: ["mentorship_sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("mentorship_sessions" as any).select("*").order("scheduled_at", { ascending: false }).limit(5);
      return data as any[] || [];
    },
  });
  const { data: actions } = useQuery({
    queryKey: ["advisory_actions_open"],
    queryFn: async () => {
      const { data } = await supabase.from("advisory_action_plans" as any).select("*").neq("status", "done").limit(10);
      return data as any[] || [];
    },
  });
  const { data: progress } = useQuery({
    queryKey: ["advisory_progress_summary"],
    queryFn: async () => {
      const { data } = await supabase.from("advisory_track_progress" as any).select("status");
      const arr = (data as any[]) || [];
      return { done: arr.filter(p => p.status === "done").length, total: arr.length };
    },
  });

  const upcoming = (sessions || []).filter((s: any) => s.status === "scheduled" && new Date(s.scheduled_at) > new Date());

  return (
    <div className="space-y-6 mt-4">
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label="Score WMI" value={score?.total_score || 0} suffix="/100" icon={Trophy} color="from-amber-500 to-yellow-400" />
        <StatCard label="Sessões agendadas" value={upcoming.length} icon={Calendar} color="from-blue-500 to-cyan-400" />
        <StatCard label="Ações abertas" value={(actions || []).length} icon={ListChecks} color="from-purple-500 to-fuchsia-400" />
        <StatCard label="Módulos concluídos" value={progress?.done || 0} icon={Award} color="from-emerald-500 to-green-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Próximos passos sugeridos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <NextStep label="Preencher diagnóstico estratégico" route="diagnostico" />
            <NextStep label="Iniciar trilha Fundação Comercial" route="trilhas" />
            <NextStep label="Agendar próxima sessão de mentoria" route="sessoes" />
            <NextStep label="Calcular máquina de vendas para sua meta" route="maquina" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Próximas sessões
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma sessão agendada</p>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 3).map((s: any) => (
                  <div key={s.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{s.topic}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(s.scheduled_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix, icon: Icon, color }: any) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${color}`} />
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}<span className="text-sm text-muted-foreground">{suffix}</span></div>
          </div>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${color} text-white`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NextStep({ label, route }: { label: string; route: string }) {
  return (
    <button onClick={() => {
      const trigger = document.querySelector(`[role="tab"][value="${route}"]`) as HTMLElement;
      trigger?.click();
    }} className="w-full flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
      <span className="flex items-center gap-2"><Circle /> {label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
function Circle() { return <span className="h-1.5 w-1.5 rounded-full bg-primary" />; }

// ============== DIAGNÓSTICO ==============
function DiagnosticoTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    meta_faturamento: 0, ticket_medio: 0, tamanho_time: 0,
    estagio_comercial: "estruturando", segmento: "", prazo_meses: 6, obs: "",
    principais_gargalos: [] as string[], ferramentas_atuais: [] as string[],
  });
  const [generating, setGenerating] = useState(false);

  const { data: diag, isLoading } = useQuery({
    queryKey: ["advisory_diag"],
    queryFn: async () => {
      const { data } = await supabase.from("advisory_diagnostics" as any).select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setForm((f: any) => ({ ...f, ...(data as any), principais_gargalos: (data as any).principais_gargalos || [], ferramentas_atuais: (data as any).ferramentas_atuais || [] }));
      }
      return data;
    },
  });

  async function generate() {
    setGenerating(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: { user } } = await supabase.auth.getUser();

      const { data: ai, error: iErr } = await supabase.functions.invoke("advisor-ai", {
        body: { mode: "strategic_plan", diagnostic: form },
      });
      if (iErr) throw iErr;
      if (ai?.error) throw new Error(ai.error);

      const payload = { ...form, company_id: companyId, filled_by: user?.id, ai_strategic_plan: ai.content };

      if ((diag as any)?.id) {
        const { error } = await supabase.from("advisory_diagnostics" as any).update(payload).eq("id", (diag as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("advisory_diagnostics" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Plano estratégico gerado");
      qc.invalidateQueries({ queryKey: ["advisory_diag"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) return <Skeleton className="h-96 mt-4" />;

  const gargalos = ["Falta de processo", "Time pequeno", "Baixa conversão", "Sem prospecção ativa", "CRM mal usado", "Falta KPI", "Sem playbook"];
  const ferramentas = ["WhatsApp", "Planilha", "Pipedrive", "RD Station", "HubSpot", "Outro CRM"];

  return (
    <div className="grid lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Diagnóstico estratégico</CardTitle>
          <CardDescription>Responda para o Advisor IA gerar seu plano de crescimento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Meta de faturamento mensal (R$)</Label>
              <Input type="number" value={form.meta_faturamento} onChange={(e) => setForm({ ...form, meta_faturamento: +e.target.value })} /></div>
            <div><Label>Ticket médio (R$)</Label>
              <Input type="number" value={form.ticket_medio} onChange={(e) => setForm({ ...form, ticket_medio: +e.target.value })} /></div>
            <div><Label>Tamanho do time comercial</Label>
              <Input type="number" value={form.tamanho_time} onChange={(e) => setForm({ ...form, tamanho_time: +e.target.value })} /></div>
            <div><Label>Prazo (meses)</Label>
              <Input type="number" value={form.prazo_meses} onChange={(e) => setForm({ ...form, prazo_meses: +e.target.value })} /></div>
            <div><Label>Segmento</Label>
              <Input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} placeholder="Ex: SaaS B2B" /></div>
            <div><Label>Estágio comercial</Label>
              <select className="w-full h-10 border rounded-md px-2 bg-background" value={form.estagio_comercial} onChange={(e) => setForm({ ...form, estagio_comercial: e.target.value })}>
                <option value="inicial">Inicial</option><option value="estruturando">Estruturando</option><option value="previsivel">Previsível</option><option value="escalavel">Escalável</option>
              </select></div>
          </div>
          <div>
            <Label>Principais gargalos</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {gargalos.map((g) => {
                const on = form.principais_gargalos.includes(g);
                return <Badge key={g} variant={on ? "default" : "outline"} className="cursor-pointer"
                  onClick={() => setForm({ ...form, principais_gargalos: on
                    ? form.principais_gargalos.filter((x: string) => x !== g)
                    : [...form.principais_gargalos, g] })}>{g}</Badge>;
              })}
            </div>
          </div>
          <div>
            <Label>Ferramentas atuais</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ferramentas.map((g) => {
                const on = form.ferramentas_atuais.includes(g);
                return <Badge key={g} variant={on ? "default" : "outline"} className="cursor-pointer"
                  onClick={() => setForm({ ...form, ferramentas_atuais: on
                    ? form.ferramentas_atuais.filter((x: string) => x !== g)
                    : [...form.ferramentas_atuais, g] })}>{g}</Badge>;
              })}
            </div>
          </div>
          <div><Label>Observações</Label>
            <Textarea value={form.obs || ""} onChange={(e) => setForm({ ...form, obs: e.target.value })} rows={3} /></div>
          <Button onClick={generate} disabled={generating} className="w-full gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar plano estratégico com IA
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Plano estratégico</CardTitle>
          <CardDescription>Plano gerado pelo Advisor IA</CardDescription>
        </CardHeader>
        <CardContent>
          {(diag as any)?.ai_strategic_plan ? (
            <ScrollArea className="h-[500px] pr-3">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{(diag as any).ai_strategic_plan}</ReactMarkdown>
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Preencha o diagnóstico ao lado e gere seu plano.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============== TRILHAS ==============
function TrilhasTab() {
  const qc = useQueryClient();
  const [openTrack, setOpenTrack] = useState<any>(null);

  const { data: tracks } = useQuery({
    queryKey: ["advisory_tracks"],
    queryFn: async () => {
      const { data } = await supabase.from("advisory_tracks" as any).select("*").order("order_position");
      return data as any[] || [];
    },
  });
  const { data: progress } = useQuery({
    queryKey: ["advisory_progress"],
    queryFn: async () => {
      const { data } = await supabase.from("advisory_track_progress" as any).select("module_id, status");
      return data as any[] || [];
    },
  });

  const doneSet = new Set((progress || []).filter((p: any) => p.status === "done").map((p: any) => p.module_id));

  return (
    <div className="space-y-4 mt-4">
      <div className="grid md:grid-cols-2 gap-4">
        {(tracks || []).map((t: any) => (
          <Card key={t.id} className="overflow-hidden hover:shadow-lg cursor-pointer transition" onClick={() => setOpenTrack(t)}>
            <div className={`h-1.5 bg-gradient-to-r from-${t.color}-500 to-${t.color}-300`} />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{t.cover_emoji}</div>
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant="outline" className="text-xs mt-1 capitalize">{t.level}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t.description}</p>
              <Button variant="ghost" size="sm" className="w-full justify-between mt-3">
                Ver módulos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openTrack} onOpenChange={(o) => !o && setOpenTrack(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {openTrack && <TrackModulesDialog track={openTrack} doneSet={doneSet} onChange={() => qc.invalidateQueries({ queryKey: ["advisory_progress"] })} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrackModulesDialog({ track, doneSet, onChange }: any) {
  const { data: modules } = useQuery({
    queryKey: ["advisory_modules", track.id],
    queryFn: async () => {
      const { data } = await supabase.from("advisory_track_modules" as any).select("*").eq("track_id", track.id).order("order_position");
      return data as any[] || [];
    },
  });

  async function toggleDone(moduleId: string, currentlyDone: boolean) {
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const { data: { user } } = await supabase.auth.getUser();
    if (currentlyDone) {
      await supabase.from("advisory_track_progress" as any).delete().eq("module_id", moduleId).eq("user_id", user?.id);
    } else {
      await supabase.from("advisory_track_progress" as any).insert({
        user_id: user?.id, company_id: companyId, module_id: moduleId, status: "done", completed_at: new Date().toISOString(),
      });
    }
    onChange();
  }

  const total = (modules || []).length;
  const done = (modules || []).filter((m: any) => doneSet.has(m.id)).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="text-2xl">{track.cover_emoji}</span> {track.name}
        </DialogTitle>
        <DialogDescription>{track.description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Progress value={total ? (done / total) * 100 : 0} className="h-2 flex-1" />
          <span className="text-xs font-mono">{done}/{total}</span>
        </div>
        {!total ? (
          <p className="text-sm text-muted-foreground text-center py-6">Esta trilha ainda não tem módulos. Em breve.</p>
        ) : (
          (modules || []).map((m: any) => {
            const isDone = doneSet.has(m.id);
            return (
              <div key={m.id} className="border rounded-lg p-3 flex gap-3">
                <button onClick={() => toggleDone(m.id, isDone)} className="mt-0.5">
                  {isDone ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle2 />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>{m.title}</h4>
                    <Badge variant="outline" className="text-xs capitalize">{m.content_type}</Badge>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                  {m.video_url && (
                    <Button size="sm" variant="outline" className="mt-2 gap-1.5 h-7 text-xs" onClick={() => window.open(m.video_url, "_blank")}>
                      <Video className="h-3 w-3" /> Assistir
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
function Circle2() { return <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 inline-block" />; }

// ============== SESSÕES ==============
function SessionsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ topic: "", description: "", scheduled_at: "", duration_minutes: 60 });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["mentorship_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mentorship_sessions" as any).select("*").order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("mentorship_sessions" as any).insert({
        company_id: companyId, scheduled_by: user?.id, topic: form.topic, description: form.description,
        scheduled_at: form.scheduled_at, duration_minutes: form.duration_minutes,
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

  const upcoming = (sessions || []).filter((s: any) => s.status === "scheduled" && new Date(s.scheduled_at) > new Date());
  const past = (sessions || []).filter((s: any) => s.status !== "scheduled" || new Date(s.scheduled_at) <= new Date());

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{upcoming.length} agendada(s) · {past.length} realizadas</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Agendar Sessão</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova sessão de mentoria</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tema</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Ex: Estruturar funil B2B" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data e hora</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
                <div><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: +e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.topic || !form.scheduled_at || createMutation.isPending}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-40" /> : (
        <>
          <section>
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Próximas</h2>
            {upcoming.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Nenhuma sessão agendada</CardContent></Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">{upcoming.map((s: any) => <SessionCard key={s.id} session={s} />)}</div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="font-semibold mb-3 text-muted-foreground">Histórico</h2>
              <div className="grid md:grid-cols-2 gap-3">{past.map((s: any) => <SessionCard key={s.id} session={s} historic />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SessionCard({ session, historic = false }: any) {
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
            {format(new Date(session.scheduled_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
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
          <div className="text-xs bg-muted/50 rounded p-2 mt-2"><strong>Anotações:</strong> {session.post_session_notes}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ============== PLAYBOOKS / BIBLIOTECA ==============
function PlaybooksTab() {
  const [cat, setCat] = useState("all");
  const { data: pbs, isLoading } = useQuery({
    queryKey: ["advisory_playbooks"],
    queryFn: async () => {
      const { data } = await supabase.from("advisory_playbooks" as any).select("*").order("created_at", { ascending: false });
      return data as any[] || [];
    },
  });
  const cats = [
    { value: "all", label: "Todos" },
    { value: "cold_call", label: "Cold Call" },
    { value: "sdr", label: "SDR" },
    { value: "closer", label: "Closer" },
    { value: "objections", label: "Objeções" },
    { value: "cadence", label: "Cadências" },
    { value: "process", label: "Processo" },
    { value: "script", label: "Scripts" },
  ];
  const filtered = cat === "all" ? (pbs || []) : (pbs || []).filter((p: any) => p.category === cat);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2">
        {cats.map(c => (
          <Badge key={c.value} variant={cat === c.value ? "default" : "outline"} className="cursor-pointer" onClick={() => setCat(c.value)}>{c.label}</Badge>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => (
            <Dialog key={p.id}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:shadow-lg transition">
                  <CardHeader className="pb-3">
                    <Badge variant="outline" className="w-fit text-xs capitalize">{p.category.replace("_", " ")}</Badge>
                    <CardTitle className="text-base mt-2">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-3">{p.description}</p>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{p.title}</DialogTitle></DialogHeader>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{p.content_md}</ReactMarkdown>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== COACHING ==============
function CoachingTab() {
  const { data: companyId } = useQuery({
    queryKey: ["my_company_id"],
    queryFn: async () => (await supabase.rpc("get_my_company_id")).data,
  });
  const { data: team } = useQuery({
    queryKey: ["team_perf_monthly", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_team_performance" as any, { p_company_id: companyId, p_period: "monthly" });
      return data as any[] || [];
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Performance individual (mês atual)</CardTitle>
          <CardDescription>Score por SDR e Closer</CardDescription>
        </CardHeader>
        <CardContent>
          {!team?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de performance ainda</p>
          ) : (
            <div className="space-y-2">
              {team.map((m: any) => {
                const score = Math.min(100, Math.round((m.conversion_rate || 0) + (m.sales_closed || 0) * 5));
                return (
                  <div key={m.user_id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm">{m.user_name}</div>
                        <Badge variant="outline" className="text-xs mt-1 capitalize">{m.commercial_role}</Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Score</div>
                        <div className="text-2xl font-bold">{score}</div>
                      </div>
                    </div>
                    <Progress value={score} className="h-1.5 mt-2" />
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div><div className="text-muted-foreground">Leads</div><div className="font-medium">{m.leads_prospected}</div></div>
                      <div><div className="text-muted-foreground">Reuniões</div><div className="font-medium">{m.meetings_scheduled}</div></div>
                      <div><div className="text-muted-foreground">Vendas</div><div className="font-medium">{m.sales_closed}</div></div>
                      <div><div className="text-muted-foreground">Conv%</div><div className="font-medium">{m.conversion_rate}%</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============== MÁQUINA DE VENDAS ==============
function MaquinaVendasTab() {
  const [form, setForm] = useState({
    meta_faturamento: 100000, ticket_medio: 5000, taxa_conversao: 20,
    taxa_show: 60, reunioes_por_sdr_mes: 40, vendas_por_closer_mes: 8,
  });

  // engenharia reversa
  const vendas_necessarias = Math.ceil(form.meta_faturamento / form.ticket_medio);
  const reunioes_efetivas_necessarias = Math.ceil(vendas_necessarias / (form.taxa_conversao / 100));
  const reunioes_agendadas_necessarias = Math.ceil(reunioes_efetivas_necessarias / (form.taxa_show / 100));
  const sdrs_necessarios = Math.ceil(reunioes_agendadas_necessarias / form.reunioes_por_sdr_mes);
  const closers_necessarios = Math.ceil(vendas_necessarias / form.vendas_por_closer_mes);
  const leads_necessarios = Math.ceil(reunioes_agendadas_necessarias / 0.15);

  return (
    <div className="grid lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Engenharia Reversa de Receita</CardTitle>
          <CardDescription>Defina sua meta — calcule a operação necessária</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Meta de faturamento mensal (R$)</Label>
            <Input type="number" value={form.meta_faturamento} onChange={(e) => setForm({ ...form, meta_faturamento: +e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Ticket médio (R$)</Label><Input type="number" value={form.ticket_medio} onChange={(e) => setForm({ ...form, ticket_medio: +e.target.value })} /></div>
            <div><Label>Taxa conversão (%)</Label><Input type="number" value={form.taxa_conversao} onChange={(e) => setForm({ ...form, taxa_conversao: +e.target.value })} /></div>
            <div><Label>Taxa show (%)</Label><Input type="number" value={form.taxa_show} onChange={(e) => setForm({ ...form, taxa_show: +e.target.value })} /></div>
            <div><Label>Reuniões/SDR/mês</Label><Input type="number" value={form.reunioes_por_sdr_mes} onChange={(e) => setForm({ ...form, reunioes_por_sdr_mes: +e.target.value })} /></div>
            <div><Label>Vendas/Closer/mês</Label><Input type="number" value={form.vendas_por_closer_mes} onChange={(e) => setForm({ ...form, vendas_por_closer_mes: +e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Sua máquina precisa de:</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ResultRow icon="💰" label="Vendas/mês" value={vendas_necessarias} />
          <ResultRow icon="🤝" label="Reuniões realizadas" value={reunioes_efetivas_necessarias} />
          <ResultRow icon="📅" label="Reuniões agendadas" value={reunioes_agendadas_necessarias} />
          <ResultRow icon="📋" label="Leads gerados" value={leads_necessarios} />
          <div className="border-t pt-3 mt-3 space-y-3">
            <ResultRow icon="📞" label="SDRs necessários" value={sdrs_necessarios} highlight />
            <ResultRow icon="🎯" label="Closers necessários" value={closers_necessarios} highlight />
          </div>
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
            💡 Cálculo: meta R$ {form.meta_faturamento.toLocaleString("pt-BR")} / ticket R$ {form.ticket_medio.toLocaleString("pt-BR")} = {vendas_necessarias} vendas → trabalhando para trás na taxa de conversão e show.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultRow({ icon, label, value, highlight = false }: any) {
  return (
    <div className={`flex items-center justify-between p-2 rounded ${highlight ? "bg-primary/10 font-bold" : ""}`}>
      <span className="text-sm flex items-center gap-2"><span className="text-lg">{icon}</span> {label}</span>
      <span className={`font-mono ${highlight ? "text-primary text-xl" : "text-lg"}`}>{value}</span>
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
      const { data } = await supabase.from("mentorship_community_posts" as any).select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
      return data as any[] || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id!).maybeSingle();
      const { error } = await supabase.from("mentorship_community_posts" as any).insert({
        author_id: user?.id, author_company_id: companyId, author_name: profile?.full_name || "Mentorado",
        title: form.title, content: form.content, post_type: form.post_type,
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

  const TYPE_LABEL: Record<string, { label: string; color: string }> = {
    discussion: { label: "💬 Discussão", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    question: { label: "❓ Pergunta", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
    win: { label: "🏆 Conquista", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    tip: { label: "💡 Dica", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Compartilhe wins, dúvidas e dicas com outros mentorados Waze.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Publicar</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova publicação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tipo</Label>
                <select className="w-full border rounded-md p-2 bg-background" value={form.post_type} onChange={(e) => setForm({ ...form, post_type: e.target.value })}>
                  <option value="discussion">💬 Discussão</option><option value="question">❓ Pergunta</option><option value="win">🏆 Conquista</option><option value="tip">💡 Dica</option>
                </select></div>
              <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Conteúdo</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.content || createMutation.isPending}>Publicar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-40" /> : !posts?.length ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground"><Users className="h-12 w-12 mx-auto opacity-30 mb-3" />Seja o primeiro a publicar!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p: any) => {
            const meta = TYPE_LABEL[p.post_type] || TYPE_LABEL.discussion;
            return (
              <Card key={p.id} className={p.pinned ? "border-primary/40" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                    <Badge className={meta.color} variant="outline">{meta.label}</Badge>
                    <span className="text-xs text-muted-foreground">por {p.author_name} · {format(new Date(p.created_at), "dd MMM", { locale: ptBR })}</span>
                  </div>
                  <CardTitle className="text-base mt-1">{p.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{p.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {p.likes_count}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {p.comments_count}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
