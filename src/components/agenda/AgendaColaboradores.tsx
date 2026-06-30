import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, User, Trash2, Clock, Copy, Link2, Check, Pencil, Search, Users, Building2, Settings, Calendar, Mail, Phone, KeyRound, Sun, Coffee, Sunset, Moon, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HorarioComercialConfig, criarHorarioPadrao } from "./HorarioComercialConfig";

interface Agenda {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  capacidade_simultanea: number;
  tempo_medio_servico: number;
  disponibilidade: any;
  responsavel_id?: string;
}

const DIAS = [
  { id: "domingo", label: "Dom" },
  { id: "segunda", label: "Seg" },
  { id: "terca", label: "Ter" },
  { id: "quarta", label: "Qua" },
  { id: "quinta", label: "Qui" },
  { id: "sexta", label: "Sex" },
  { id: "sabado", label: "Sáb" },
];

// Gradientes determinísticos por tipo + hash do nome para visual rico
const GRADIENTS_COLAB = [
  "linear-gradient(135deg,#16a34a,#15803d)",
  "linear-gradient(135deg,#0ea5e9,#0369a1)",
  "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  "linear-gradient(135deg,#ec4899,#be185d)",
  "linear-gradient(135deg,#f59e0b,#b45309)",
];
const GRADIENT_RECURSO = "linear-gradient(135deg,#2563eb,#1d4ed8)";
const GRADIENT_SALA = "linear-gradient(135deg,#d97706,#b45309)";

const hashStr = (s: string) => s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

const getGradient = (a: Agenda) => {
  if (a.tipo === "recurso") return GRADIENT_RECURSO;
  if (a.tipo === "sala") return GRADIENT_SALA;
  return GRADIENTS_COLAB[hashStr(a.nome) % GRADIENTS_COLAB.length];
};

const getInitials = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "?";

const tipoMeta: Record<string, { label: string; icon: string; cls: string }> = {
  colaborador: { label: "Colaborador", icon: "👤", cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  recurso:     { label: "Recurso",     icon: "⚙️", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  sala:        { label: "Sala",        icon: "🏢", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
};

type Filter = "todos" | "colaborador" | "recurso" | "sala";

export function AgendaColaboradores() {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [agendaEditando, setAgendaEditando] = useState<Agenda | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "colaborador",
    especialidade: "",
    capacidade_simultanea: 1,
    tempo_medio_servico: 30,
    horarioComercial: criarHorarioPadrao(),
    dias_funcionamento: ["segunda", "terca", "quarta", "quinta", "sexta"],
    email: "",
    senha: "",
    telefone: "",
    avatar_url: "",
    bio: "",
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [editFormData, setEditFormData] = useState({
    nome: "",
    tipo: "colaborador",
    status: "ativo",
    capacidade_simultanea: 1,
    tempo_medio_servico: 30,
    horarioComercial: criarHorarioPadrao(),
    dias_funcionamento: ["segunda", "terca", "quarta", "quinta", "sexta"],
  });

  useEffect(() => { carregarAgendas(); }, []);

  const carregarAgendas = async () => {
    try {
      const { data, error } = await supabase.from('agendas').select('*').order('nome');
      if (error) throw error;
      setAgendas(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar agendas");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setFormData({
    nome: "", tipo: "colaborador", especialidade: "",
    capacidade_simultanea: 1, tempo_medio_servico: 30,
    horarioComercial: criarHorarioPadrao(),
    dias_funcionamento: ["segunda", "terca", "quarta", "quinta", "sexta"],
    email: "", senha: "", telefone: "", avatar_url: "", bio: "",
  });

  const handleAvatarUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast.error("Imagem deve ter no máximo 4MB");
    try {
      setUploadingAvatar(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `profissionais/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('user-avatars').upload(path, file, {
        cacheControl: '3600', upsert: true, contentType: file.type || 'image/png',
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('user-avatars').getPublicUrl(path);
      setFormData(prev => ({ ...prev, avatar_url: pub.publicUrl }));
      toast.success("Foto carregada");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao enviar foto");
    } finally {
      setUploadingAvatar(false);
    }
  };


  const criarAgenda = async () => {
    if (!formData.nome?.trim()) return toast.error("Informe o nome");
    if (formData.tipo === "colaborador") {
      if (!formData.email || !formData.senha) return toast.error("Preencha e-mail e senha do profissional");
      if (formData.senha.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres");
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
      if (!userRole?.company_id) throw new Error("Empresa não encontrada");

      let profissionalId: string | null = null;

      if (formData.tipo === "colaborador" && formData.email && formData.senha) {
        const { data: pd, error: pe } = await supabase.functions.invoke('criar-profissional', {
          body: {
            nome: formData.nome,
            email: formData.email,
            senha: formData.senha,
            telefone: formData.telefone || undefined,
            especialidade: formData.especialidade || undefined,
            avatar_url: formData.avatar_url || undefined,
            bio: formData.bio || undefined,
            company_id: userRole.company_id
          }
        });
        if (pe) throw new Error("Erro ao criar profissional");
        if (!pd?.success) throw new Error(pd?.error || "Erro ao criar profissional");
        profissionalId = pd?.profissional?.id;
        if (pd?.already_exists) {
          toast.info("Profissional já cadastrado. Vinculando à agenda...");
          // atualiza avatar/bio do profissional existente
          if (profissionalId && (formData.avatar_url || formData.bio)) {
            await supabase.from('profissionais').update({
              avatar_url: formData.avatar_url || null,
              bio: formData.bio || null,
            }).eq('id', profissionalId);
          }
        }
      }


      const { error } = await supabase.from('agendas').insert([{
        nome: formData.nome,
        tipo: formData.tipo,
        status: 'ativo',
        capacidade_simultanea: formData.capacidade_simultanea,
        tempo_medio_servico: formData.tempo_medio_servico,
        disponibilidade: {
          dias_funcionamento: formData.dias_funcionamento,
          periodos: formData.horarioComercial,
        } as any,
        owner_id: user.id,
        company_id: userRole.company_id,
        responsavel_id: profissionalId,
      }]).select().single();

      if (error) throw error;

      toast.success("Agenda criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      carregarAgendas();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao criar agenda");
    }
  };

  const excluirAgenda = async (id: string) => {
    if (!confirm("Excluir esta agenda?")) return;
    try {
      const { error } = await supabase.from('agendas').delete().eq('id', id);
      if (error) throw error;
      toast.success("Agenda excluída");
      carregarAgendas();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir agenda");
    }
  };

  const abrirEdicao = (agenda: Agenda) => {
    setAgendaEditando(agenda);
    const disp = agenda.disponibilidade || {};
    setEditFormData({
      nome: agenda.nome,
      tipo: agenda.tipo,
      status: agenda.status,
      capacidade_simultanea: agenda.capacidade_simultanea || 1,
      tempo_medio_servico: agenda.tempo_medio_servico || 30,
      horarioComercial: disp.periodos || criarHorarioPadrao(),
      dias_funcionamento: disp.dias_funcionamento || ["segunda", "terca", "quarta", "quinta", "sexta"],
    });
    setEditDialogOpen(true);
  };

  const salvarEdicao = async () => {
    if (!agendaEditando) return;
    try {
      const { error } = await supabase.from('agendas').update({
        nome: editFormData.nome,
        tipo: editFormData.tipo,
        status: editFormData.status,
        capacidade_simultanea: editFormData.capacidade_simultanea,
        tempo_medio_servico: editFormData.tempo_medio_servico,
        disponibilidade: {
          dias_funcionamento: editFormData.dias_funcionamento,
          periodos: editFormData.horarioComercial,
        } as any,
        updated_at: new Date().toISOString(),
      }).eq('id', agendaEditando.id);
      if (error) throw error;
      toast.success("Agenda atualizada!");
      setEditDialogOpen(false);
      setAgendaEditando(null);
      carregarAgendas();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar agenda");
    }
  };

  const copiarLink = async (agendaId: string) => {
    const url = `${window.location.origin}/agenda/${agendaId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(agendaId);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const counts = useMemo(() => ({
    todos: agendas.length,
    colaborador: agendas.filter(a => a.tipo === "colaborador").length,
    recurso: agendas.filter(a => a.tipo === "recurso").length,
    sala: agendas.filter(a => a.tipo === "sala").length,
  }), [agendas]);

  const filtered = useMemo(() => {
    return agendas.filter(a => {
      if (filter !== "todos" && a.tipo !== filter) return false;
      if (search && !a.nome.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [agendas, filter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        Carregando agendas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-xl tracking-tight">Minhas Agendas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie especialistas, recursos e salas do seu time
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
          style={{
            background: "linear-gradient(135deg,#16a34a,#15803d)",
            boxShadow: "0 3px 14px rgba(22,163,74,.35)",
          }}
        >
          <span className="w-5 h-5 rounded-md bg-white/20 inline-flex items-center justify-center text-[13px]">＋</span>
          Nova Agenda
        </button>
      </div>

      {/* FILTROS */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: "todos" as Filter, label: "Todos", color: null },
          { id: "colaborador" as Filter, label: "Colaboradores", color: "#7c3aed" },
          { id: "recurso" as Filter, label: "Recursos", color: "#2563eb" },
          { id: "sala" as Filter, label: "Salas", color: "#d97706" },
        ]).map(f => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />}
              {f.label}
              <span className="text-[10px] bg-foreground/10 px-1.5 rounded-full">
                {counts[f.id]}
              </span>
            </button>
          );
        })}
        <div className="ml-auto relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar agenda..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 w-[220px]"
          />
        </div>
      </div>

      {/* GRID */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
        {filtered.map(agenda => {
          const meta = tipoMeta[agenda.tipo] || tipoMeta.colaborador;
          const ativo = agenda.status === "ativo";
          const disp = agenda.disponibilidade || {};
          const periodos = disp.periodos || {};
          const dias: string[] = disp.dias_funcionamento || [];
          const url = `${window.location.origin}/agenda/${agenda.id}`;
          return (
            <div
              key={agenda.id}
              className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              {/* HEAD */}
              <div className="p-4 pb-3 flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base relative shrink-0"
                  style={{ background: getGradient(agenda) }}
                >
                  {getInitials(agenda.nome)}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                      ativo ? "bg-green-500" : "bg-muted-foreground"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px] truncate">{agenda.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {agenda.tipo === "colaborador" ? "Profissional" : agenda.tipo === "sala" ? `Sala · ${agenda.capacidade_simultanea} pessoas` : "Recurso"}
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                      ativo
                        ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {ativo ? "✓ Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button
                    onClick={() => copiarLink(agenda.id)}
                    title="Copiar link"
                    className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-green-100 dark:hover:bg-green-500/10 hover:text-green-600 transition-colors"
                  >
                    {copiedId === agenda.id ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => abrirEdicao(agenda)}
                    title="Editar"
                    className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-blue-100 dark:hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => excluirAgenda(agenda.id)}
                    title="Excluir"
                    className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-red-100 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* BODY */}
              <div className="px-4 pb-4 flex-1 text-[12.5px]">
                <InfoRow icon={<Users className="h-3.5 w-3.5" />} label="Capacidade:" value={`${agenda.capacidade_simultanea} simultâneo${agenda.capacidade_simultanea > 1 ? "s" : ""}`} />
                <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Duração padrão:" value={`${agenda.tempo_medio_servico} min`} />
                {dias.length > 0 && (
                  <div className="flex items-start gap-2 py-1.5 border-b border-border/60 flex-wrap">
                    <Calendar className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">Dias:</span>
                    <div className="flex gap-1 flex-wrap">
                      {DIAS.map(d => {
                        const on = dias.includes(d.id);
                        return (
                          <span
                            key={d.id}
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              on
                                ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                                : "bg-muted text-muted-foreground/50"
                            }`}
                          >
                            {d.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {periodos.manha?.ativo && (
                  <InfoRow icon={<Sun className="h-3.5 w-3.5" />} label="Manhã:" value={`${periodos.manha.inicio} – ${periodos.manha.fim}`} />
                )}
                {periodos.intervalo_almoco?.ativo && (
                  <InfoRow icon={<Coffee className="h-3.5 w-3.5" />} label="Almoço:" value={`${periodos.intervalo_almoco.inicio} – ${periodos.intervalo_almoco.fim}`} muted />
                )}
                {periodos.tarde?.ativo && (
                  <InfoRow icon={<Sunset className="h-3.5 w-3.5" />} label="Tarde:" value={`${periodos.tarde.inicio} – ${periodos.tarde.fim}`} />
                )}
                {periodos.noite?.ativo && (
                  <InfoRow icon={<Moon className="h-3.5 w-3.5" />} label="Noite:" value={`${periodos.noite.inicio} – ${periodos.noite.fim}`} />
                )}

                {/* Link */}
                <div className="flex items-center gap-2 bg-muted rounded-md px-2.5 py-2 mt-3">
                  <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground flex-1 truncate">{url.replace(/^https?:\/\//, "")}</span>
                  <button
                    onClick={() => copiarLink(agenda.id)}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:opacity-70"
                  >
                    {copiedId === agenda.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* FOOT */}
              <div className="border-t border-border px-4 py-2.5 flex gap-2">
                <button
                  onClick={() => abrirEdicao(agenda)}
                  className="flex-1 py-1.5 rounded-md border border-border bg-card text-[11.5px] font-semibold text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => window.open(`/agenda/${agenda.id}`, "_blank")}
                  className="flex-1 py-1.5 rounded-md text-[11.5px] font-semibold text-white transition-colors"
                  style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
                >
                  📅 Ver agenda
                </button>
              </div>
            </div>
          );
        })}

        {/* EMPTY CARD */}
        <button
          onClick={() => setDialogOpen(true)}
          className="border-2 border-dashed border-border rounded-xl bg-card hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center p-10 text-center transition-all min-h-[260px]"
        >
          <div className="text-4xl opacity-40 mb-3">＋</div>
          <div className="font-semibold text-muted-foreground">Adicionar nova agenda</div>
          <div className="text-sm text-muted-foreground/70 mt-1">Colaborador, recurso ou sala</div>
        </button>
      </div>

      {/* MODAL CRIAR */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
          {/* HERO */}
          <div className="relative p-6 pb-7 overflow-hidden" style={{ background: "linear-gradient(135deg,#14532d,#166534 60%,#16a34a)" }}>
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/[0.06] pointer-events-none" />
            <div className="absolute -bottom-14 -left-5 w-36 h-36 rounded-full bg-white/[0.04] pointer-events-none" />

            <div className="flex items-center justify-between mb-4 relative">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-white/70">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 ring-2 ring-green-400/25" />
                Nova agenda · GROW OS
              </div>
              <button onClick={() => setDialogOpen(false)} className="w-8 h-8 rounded-md border border-white/20 bg-white/10 text-white/70 hover:text-white hover:bg-white/20 inline-flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="absolute top-5 right-16 w-14 h-14 rounded-xl bg-white/15 border-2 border-white/25 flex items-center justify-center text-white text-xl font-bold"
            >
              {formData.nome ? getInitials(formData.nome) : "?"}
            </div>

            <div className="text-white font-bold text-xl tracking-tight relative">Criar nova agenda</div>
            <div className="text-white/65 text-sm mt-1 relative">Configure o especialista, horários e credenciais de acesso</div>

            {/* tipo pills */}
            <div className="flex gap-1.5 mt-4 relative">
              {[
                { id: "colaborador", icon: "👤", label: "Colaborador" },
                { id: "recurso", icon: "⚙️", label: "Recurso" },
                { id: "sala", icon: "🏢", label: "Sala" },
              ].map(t => {
                const active = formData.tipo === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setFormData({ ...formData, tipo: t.id })}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12.5px] transition-all ${
                      active
                        ? "bg-white/20 border-white/50 text-white font-semibold"
                        : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BODY */}
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            <FormSection icon={<User className="h-4 w-4" />} title="Dados do especialista">
              <div className="space-y-3">
                {formData.tipo === "colaborador" && (
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg shrink-0 border-2 border-border"
                      style={{ background: formData.avatar_url ? undefined : "linear-gradient(135deg,#16a34a,#15803d)" }}
                    >
                      {formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        formData.nome ? getInitials(formData.nome) : "?"
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-input bg-card text-xs font-semibold cursor-pointer hover:bg-muted">
                        {uploadingAvatar ? "Enviando..." : "📷 Carregar foto"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingAvatar}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
                        />
                      </label>
                      {formData.avatar_url && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, avatar_url: "" })}
                          className="ml-2 text-[11px] text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">JPG ou PNG, até 4MB</div>
                    </div>
                  </div>
                )}
                <Field label="Nome completo" required>
                  <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Dr. João Silva" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Especialidade / Cargo">
                    <Input value={formData.especialidade} onChange={e => setFormData({ ...formData, especialidade: e.target.value })} placeholder="Ex: Consultor" />
                  </Field>
                  <Field label="Telefone / WhatsApp">
                    <Input value={formData.telefone} onChange={e => setFormData({ ...formData, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                  </Field>
                </div>
                {formData.tipo === "colaborador" && (
                  <Field label="Biografia" hint="Apresentação curta exibida no perfil do profissional">
                    <textarea
                      value={formData.bio}
                      onChange={e => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Ex: Cirurgião-dentista com 10 anos de experiência em estética..."
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                    />
                  </Field>
                )}
              </div>
            </FormSection>


            <FormSection icon={<Settings className="h-4 w-4" />} title="Configuração de atendimento">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Capacidade simultânea" hint="Quantos atendimentos ao mesmo tempo">
                  <NumberField value={formData.capacidade_simultanea} step={1} min={1} onChange={v => setFormData({ ...formData, capacidade_simultanea: v })} />
                </Field>
                <Field label="Duração padrão (min)" hint="Duração de cada atendimento">
                  <NumberField value={formData.tempo_medio_servico} step={5} min={5} onChange={v => setFormData({ ...formData, tempo_medio_servico: v })} />
                </Field>
              </div>
            </FormSection>

            {formData.tipo === "colaborador" && (
              <div className="rounded-xl p-4 border" style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", borderColor: "#86efac" }}>
                <div className="flex items-center gap-2 text-sm font-bold text-green-700 mb-3">
                  <KeyRound className="h-4 w-4" /> Credenciais de acesso ao app
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-700 text-white ml-auto">GROW OS App</span>
                </div>
                <div className="space-y-3">
                  <Field label="E-mail de login" required hint="O especialista usará este e-mail no app">
                    <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="profissional@email.com" />
                  </Field>
                  <Field label="Senha" required hint="Mínimo 6 caracteres — o profissional pode alterar depois">
                    <Input type="password" value={formData.senha} onChange={e => setFormData({ ...formData, senha: e.target.value })} placeholder="••••••" minLength={6} />
                  </Field>
                </div>
              </div>
            )}

            <FormSection icon={<Calendar className="h-4 w-4" />} title="Dias de atendimento">
              <div className="flex gap-1">
                {DIAS.map(d => {
                  const on = formData.dias_funcionamento.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        dias_funcionamento: on
                          ? formData.dias_funcionamento.filter(x => x !== d.id)
                          : [...formData.dias_funcionamento, d.id]
                      })}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        on
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-card border-border text-muted-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </FormSection>

            <FormSection icon={<Clock className="h-4 w-4" />} title="Períodos de atendimento">
              <HorarioComercialConfig
                horario={formData.horarioComercial}
                onChange={h => setFormData({ ...formData, horarioComercial: h })}
              />
            </FormSection>
          </div>

          {/* FOOT */}
          <div className="px-6 py-4 border-t border-border flex items-center gap-2.5">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <button
              onClick={criarAgenda}
              className="flex-1 py-2.5 rounded-md text-white font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 3px 14px rgba(22,163,74,.3)" }}
            >
              ✓ Criar agenda
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL EDIÇÃO */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
          <div className="relative p-6 pb-7 overflow-hidden" style={{ background: "linear-gradient(135deg,#14532d,#166534 60%,#16a34a)" }}>
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/[0.06] pointer-events-none" />
            <div className="flex items-center justify-between mb-3 relative">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-white/70">
                <Pencil className="h-3 w-3" /> Editando agenda
              </div>
              <button onClick={() => setEditDialogOpen(false)} className="w-8 h-8 rounded-md border border-white/20 bg-white/10 text-white/70 hover:text-white hover:bg-white/20 inline-flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-white font-bold text-xl tracking-tight relative">{agendaEditando?.nome}</div>
            <div className="text-white/65 text-sm mt-1 relative">Atualize horários, capacidade e status</div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" required>
                <Input value={editFormData.nome} onChange={e => setEditFormData({ ...editFormData, nome: e.target.value })} />
              </Field>
              <Field label="Status">
                <select
                  value={editFormData.status}
                  onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacidade simultânea">
                <NumberField value={editFormData.capacidade_simultanea} step={1} min={1} onChange={v => setEditFormData({ ...editFormData, capacidade_simultanea: v })} />
              </Field>
              <Field label="Duração padrão (min)">
                <NumberField value={editFormData.tempo_medio_servico} step={5} min={5} onChange={v => setEditFormData({ ...editFormData, tempo_medio_servico: v })} />
              </Field>
            </div>

            <FormSection icon={<Calendar className="h-4 w-4" />} title="Dias de atendimento">
              <div className="flex gap-1">
                {DIAS.map(d => {
                  const on = editFormData.dias_funcionamento.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setEditFormData({
                        ...editFormData,
                        dias_funcionamento: on
                          ? editFormData.dias_funcionamento.filter(x => x !== d.id)
                          : [...editFormData.dias_funcionamento, d.id]
                      })}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        on
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-card border-border text-muted-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </FormSection>

            <FormSection icon={<Clock className="h-4 w-4" />} title="Períodos de atendimento">
              <HorarioComercialConfig
                horario={editFormData.horarioComercial}
                onChange={h => setEditFormData({ ...editFormData, horarioComercial: h })}
              />
            </FormSection>
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center gap-2.5">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <button
              onClick={salvarEdicao}
              className="flex-1 py-2.5 rounded-md text-white font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 3px 14px rgba(22,163,74,.3)" }}
            >
              Salvar alterações
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───── Subcomponentes ───── */

function InfoRow({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-muted-foreground w-4 inline-flex justify-center">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ml-auto ${muted ? "text-muted-foreground/70" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11.5px] font-bold tracking-wider uppercase text-muted-foreground pb-2.5 border-b border-border mb-3.5">
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1.5">
        {label} {required && <span className="text-red-500 text-[11px]">*</span>}
      </div>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground/70 mt-1">{hint}</div>}
    </div>
  );
}

function NumberField({ value, onChange, step, min }: { value: number; onChange: (v: number) => void; step: number; min: number }) {
  return (
    <div className="flex items-center border border-input rounded-md overflow-hidden bg-background">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-9 h-9 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary text-lg"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || min)}
        min={min}
        step={step}
        className="flex-1 text-center font-semibold bg-transparent outline-none text-sm"
      />
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="w-9 h-9 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary text-lg"
      >
        ＋
      </button>
    </div>
  );
}
