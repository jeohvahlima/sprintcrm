import { useState, useEffect, useMemo } from "react";
import { Phone, Briefcase, MessageSquare, CalendarDays, Trophy, Users, Check, X, Brain, Pencil, Target, CheckCircle2, Clock, AlertTriangle, Percent } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import MyGoalsPanel from "@/components/rotina/MyGoalsPanel";
import { useMyGoals } from "@/hooks/useMyGoals";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileKey = "sdr" | "vendedor_close" | "atendente" | "secretaria" | "gerente";

interface RotineTask {
  id: string;
  title: string;
  description?: string;
  time: string;
  done: boolean;
  category: string;
  priority: "alta" | "media" | "baixa";
}

interface ProfileDef {
  key: ProfileKey;
  label: string;
  Icon: any;
  color: string; // tailwind text color
  ring: string;  // tailwind ring color
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
const PROFILES: ProfileDef[] = [
  { key: "sdr",            label: "SDR",            Icon: Phone,         color: "text-rose-400",    ring: "ring-rose-500/60"    },
  { key: "vendedor_close", label: "Vendedor Close", Icon: Briefcase,     color: "text-amber-400",   ring: "ring-amber-500/60"   },
  { key: "atendente",      label: "Atendente",      Icon: MessageSquare, color: "text-orange-400",  ring: "ring-orange-500/60"  },
  { key: "secretaria",     label: "Secretária",     Icon: CalendarDays,  color: "text-indigo-400",  ring: "ring-indigo-500/60"  },
  { key: "gerente",        label: "Gerente",        Icon: Trophy,        color: "text-yellow-400",  ring: "ring-yellow-500/60"  },
];

// ─── Templates por perfil ────────────────────────────────────────────────────
const DEFAULT_TEMPLATES: Record<ProfileKey, RotineTask[]> = {
  sdr: [
    { id: "s1", title: "Ligar para 10 leads novos",          time: "08:00", done: false, category: "prospeccao", priority: "alta"  },
    { id: "s2", title: "Prospectar 20 contatos no LinkedIn", time: "09:30", done: false, category: "prospeccao", priority: "alta"  },
    { id: "s3", title: "Qualificar leads do dia anterior",   time: "11:00", done: false, category: "followup",   priority: "alta"  },
    { id: "s4", title: "Follow-up de cadência D+3",          time: "13:30", done: false, category: "followup",   priority: "media" },
    { id: "s5", title: "Agendar reuniões para o Closer",     time: "14:30", done: false, category: "reuniao",    priority: "alta"  },
    { id: "s6", title: "Atualizar pipeline no CRM",           time: "16:00", done: false, category: "admin",      priority: "media" },
    { id: "s7", title: "Bater meta diária de discagens",      time: "17:00", done: false, category: "meta",       priority: "alta"  },
    { id: "s8", title: "Relatório de atividades do dia",      time: "17:45", done: false, category: "admin",      priority: "baixa" },
  ],
  vendedor_close: [
    { id: "v1", title: "Revisar reuniões agendadas do dia",   time: "08:30", done: false, category: "admin",     priority: "alta"  },
    { id: "v2", title: "Reunião de descoberta com prospect",  time: "10:00", done: false, category: "reuniao",   priority: "alta"  },
    { id: "v3", title: "Enviar proposta personalizada",       time: "11:30", done: false, category: "followup",  priority: "alta"  },
    { id: "v4", title: "Follow-up de propostas em aberto",    time: "14:00", done: false, category: "followup",  priority: "alta"  },
    { id: "v5", title: "Call de negociação/fechamento",       time: "15:30", done: false, category: "reuniao",   priority: "alta"  },
    { id: "v6", title: "Atualizar status no funil",            time: "17:00", done: false, category: "admin",     priority: "media" },
  ],
  atendente: [
    { id: "a1", title: "Triagem da fila de WhatsApp",         time: "08:00", done: false, category: "followup", priority: "alta"  },
    { id: "a2", title: "Responder mensagens pendentes",       time: "09:30", done: false, category: "followup", priority: "alta"  },
    { id: "a3", title: "Transferir leads qualificados",       time: "11:00", done: false, category: "followup", priority: "media" },
    { id: "a4", title: "Atendimentos da tarde",                time: "14:00", done: false, category: "followup", priority: "alta"  },
    { id: "a5", title: "Fechar protocolos abertos",            time: "16:30", done: false, category: "admin",    priority: "media" },
    { id: "a6", title: "Resumo do dia para o gestor",          time: "17:30", done: false, category: "admin",    priority: "baixa" },
  ],
  secretaria: [
    { id: "se1", title: "Confirmar compromissos do dia",      time: "08:00", done: false, category: "admin",   priority: "alta"  },
    { id: "se2", title: "Agendar retornos solicitados",        time: "09:30", done: false, category: "reuniao", priority: "alta"  },
    { id: "se3", title: "Ligar para lembrar pacientes/clientes", time: "11:00", done: false, category: "followup", priority: "media" },
    { id: "se4", title: "Organizar agenda da semana",          time: "14:00", done: false, category: "admin",   priority: "media" },
    { id: "se5", title: "Enviar lembretes automáticos",         time: "16:00", done: false, category: "followup", priority: "baixa" },
    { id: "se6", title: "Relatório de agendamentos",           time: "17:30", done: false, category: "admin",   priority: "baixa" },
  ],
  gerente: [
    { id: "g1", title: "Revisar KPIs do time",                 time: "08:30", done: false, category: "meta",   priority: "alta"  },
    { id: "g2", title: "Daily com o time comercial",            time: "09:00", done: false, category: "reuniao", priority: "alta"  },
    { id: "g3", title: "1:1 com vendedor",                      time: "11:00", done: false, category: "reuniao", priority: "media" },
    { id: "g4", title: "Acompanhar pipeline & forecast",       time: "14:00", done: false, category: "meta",   priority: "alta"  },
    { id: "g5", title: "Validar propostas acima do ticket médio", time: "15:30", done: false, category: "followup", priority: "media" },
    { id: "g6", title: "Relatório executivo da operação",      time: "17:30", done: false, category: "admin",  priority: "baixa" },
  ],
};

// ─── Constants ────────────────────────────────────────────────────────────────
type CategoryConfig = {
  label: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
};

const CATEGORY_STYLE_PRESETS: Omit<CategoryConfig, "label">[] = [
  { color: "#6366f1", bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/30", dot: "bg-indigo-400" },
  { color: "#f59e0b", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-400" },
  { color: "#10b981", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  { color: "#8b5cf6", bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30", dot: "bg-violet-400" },
  { color: "#ef4444", bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30", dot: "bg-rose-400" },
  { color: "#06b6d4", bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30", dot: "bg-cyan-400" },
  { color: "#22c55e", bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30", dot: "bg-green-400" },
  { color: "#f97316", bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
];

const DEFAULT_CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  prospeccao: { label: "Prospecção", color: "#6366f1", bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/30", dot: "bg-indigo-400" },
  followup:   { label: "Follow-up",  color: "#f59e0b", bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/30",  dot: "bg-amber-400"  },
  reuniao:    { label: "Reunião",    color: "#10b981", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  admin:      { label: "Admin",      color: "#8b5cf6", bg: "bg-violet-500/15",  text: "text-violet-400",  border: "border-violet-500/30",  dot: "bg-violet-400"  },
  meta:       { label: "Meta",       color: "#ef4444", bg: "bg-rose-500/15",    text: "text-rose-400",    border: "border-rose-500/30",    dot: "bg-rose-400"    },
};

const PRIORITY_CONFIG = {
  alta:  { label: "Alta",  badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  media: { label: "Média", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  baixa: { label: "Baixa", badge: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
};

// ─── Storage helpers (frontend persistence) ──────────────────────────────────
const STORAGE_TASKS_KEY = "rotina-inteligente:tasks-v2";
const STORAGE_ASSIGN_KEY = "rotina-inteligente:user-profile-map-v1";
const STORAGE_CATEGORIES_KEY = "rotina-inteligente:categories-v1";

function loadTasks(): Record<ProfileKey, RotineTask[]> {
  try {
    const raw = localStorage.getItem(STORAGE_TASKS_KEY);
    if (!raw) return structuredClone(DEFAULT_TEMPLATES);
    const parsed = JSON.parse(raw);
    // merge defaults for any missing profile
    return { ...structuredClone(DEFAULT_TEMPLATES), ...parsed };
  } catch {
    return structuredClone(DEFAULT_TEMPLATES);
  }
}

function loadAssignments(): Record<string, ProfileKey> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_ASSIGN_KEY) || "{}");
  } catch { return {}; }
}
function loadCategories(): Record<string, CategoryConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_CATEGORIES_KEY);
    if (!raw) return DEFAULT_CATEGORY_CONFIG;
    return { ...DEFAULT_CATEGORY_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CATEGORY_CONFIG;
  }
}

function makeCategoryKey(label: string, existing: Record<string, CategoryConfig>) {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "categoria";
  let key = base;
  let n = 2;
  while (existing[key]) {
    key = `${base}_${n}`;
    n += 1;
  }
  return key;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProfileCard({ profile, count, active, onClick }: {
  profile: ProfileDef; count: number; active: boolean; onClick: () => void;
}) {
  const Icon = profile.Icon;
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border bg-slate-900/60 hover:bg-slate-800/80 transition-all min-w-[180px] text-left
        ${active ? `ring-2 ${profile.ring} border-transparent` : "border-slate-700/60"}`}
    >
      <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${profile.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate">{profile.label}</div>
        <div className="text-[11px] text-slate-400">{count} atividade{count === 1 ? "" : "s"}</div>
      </div>
    </button>
  );
}

function TaskItem({ task, categories, onToggle, onDelete, onEdit }: {
  task: RotineTask; categories: Record<string, CategoryConfig>; onToggle: (id: string) => void; onDelete: (id: string) => void; onEdit: (task: RotineTask) => void;
}) {
  const cat = categories[task.category] || DEFAULT_CATEGORY_CONFIG.prospeccao;
  const pri = PRIORITY_CONFIG[task.priority];
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const isOverdue = !task.done && task.time < nowHHMM;
  return (
    <div
      className={`group flex items-start gap-3 rounded-xl px-4 py-3 border transition-all duration-200
        ${task.done ? "bg-slate-800/30 border-slate-700/30 opacity-60" : isOverdue ? "bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/30" : `${cat.bg} ${cat.border} hover:brightness-110`}`}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
          ${task.done ? "bg-emerald-500 border-emerald-500" : `border-current ${cat.text}`}`}
      >
        {task.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>
      <span className="text-xs font-mono text-slate-400 w-12 flex-shrink-0 mt-1">{task.time}</span>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${cat.dot}`} />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onToggle(task.id)}>
        <div className={`text-sm font-medium ${task.done ? "line-through text-slate-500" : "text-slate-100"}`}>{task.title}</div>
        {task.description && (
          <div className={`text-xs mt-1 whitespace-pre-wrap ${task.done ? "text-slate-600" : "text-slate-400"}`}>{task.description}</div>
        )}
      </div>
      <span className={`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.text} ${cat.border} mt-1`}>{cat.label}</span>
      <span className={`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pri.badge} mt-1`}>{pri.label}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
        className="text-slate-400 hover:text-emerald-400 p-1.5 mt-0.5 rounded-lg hover:bg-slate-700/50 transition-all"
        title="Editar atividade"
      ><Pencil className="w-3.5 h-3.5" /></button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        className="text-slate-500 hover:text-rose-400 p-1.5 mt-0.5 rounded-lg hover:bg-slate-700/50 transition-all"
        title="Excluir atividade"
      ><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RotinaInteligente() {
  const { members, loading: loadingMembers } = useTeamMembers();

  const [tasksByProfile, setTasksByProfile] = useState<Record<ProfileKey, RotineTask[]>>(loadTasks);
  const [assignments, setAssignments] = useState<Record<string, ProfileKey>>(loadAssignments);
  const [categories, setCategories] = useState<Record<string, CategoryConfig>>(loadCategories);
  const [selectedProfile, setSelectedProfile] = useState<ProfileKey>("sdr");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: "", description: "", time: "09:00", category: "prospeccao", priority: "media" as RotineTask["priority"] });
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendentes" | "atrasadas" | "concluidas">("todas");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [viewMode, setViewMode] = useState<"diaria" | "semanal" | "mensal">("diaria");
  const [refDate, setRefDate] = useState<Date>(new Date());

  // Persist
  useEffect(() => { localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasksByProfile)); }, [tasksByProfile]);
  useEffect(() => { localStorage.setItem(STORAGE_ASSIGN_KEY, JSON.stringify(assignments)); }, [assignments]);
  useEffect(() => { localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories)); }, [categories]);

  const tasks = tasksByProfile[selectedProfile] || [];
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const doneTasks = tasks.filter(t => t.done);
  const overdueTasks = tasks.filter(t => !t.done && t.time < nowHHMM);
  const pendingTasks = tasks.filter(t => !t.done && t.time >= nowHHMM);
  const progress = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const { goals: myGoals, getStatus: getGoalStatus } = useMyGoals();
  const goalCounts = useMemo(() => {
    const count = (period: "daily" | "weekly" | "monthly") => {
      const list = myGoals.filter(g => g.period === period);
      const done = list.filter(g => getGoalStatus(g.period, g.metric, g.target_value).status === "concluida").length;
      return { total: list.length, done };
    };
    return { daily: count("daily"), weekly: count("weekly"), monthly: count("monthly") };
  }, [myGoals, getGoalStatus]);

  const usersInProfile = useMemo(
    () => members.filter(m => assignments[m.id] === selectedProfile),
    [members, assignments, selectedProfile]
  );

  const updateTasks = (mut: (prev: RotineTask[]) => RotineTask[]) =>
    setTasksByProfile(prev => ({ ...prev, [selectedProfile]: mut(prev[selectedProfile] || []) }));

  const toggleTask = (id: string) => updateTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id: string) => updateTasks(p => p.filter(t => t.id !== id));

  const resetForm = () => {
    setNewTask({ title: "", description: "", time: "09:00", category: Object.keys(categories)[0] || "prospeccao", priority: "media" });
    setEditingId(null);
    setShowAddForm(false);
  };

  const saveTask = () => {
    if (!newTask.title.trim()) return;
    const safeTask = { ...newTask, category: categories[newTask.category] ? newTask.category : Object.keys(categories)[0] || "prospeccao" };
    if (editingId) {
      updateTasks(p => p.map(t => t.id === editingId ? { ...t, ...safeTask } : t));
    } else {
      updateTasks(p => [...p, { id: Date.now().toString(), ...safeTask, done: false }]);
    }
    resetForm();
  };

  const startEdit = (task: RotineTask) => {
    setEditingId(task.id);
    setNewTask({
      title: task.title,
      description: task.description || "",
      time: task.time,
      category: categories[task.category] ? task.category : Object.keys(categories)[0] || "prospeccao",
      priority: task.priority,
    });
    setShowAddForm(true);
  };


  const saveCategory = () => {
    const label = newCategoryLabel.trim();
    if (!label) return;
    if (editingCategoryKey) {
      setCategories(prev => ({ ...prev, [editingCategoryKey]: { ...prev[editingCategoryKey], label } }));
      setEditingCategoryKey(null);
    } else {
      setCategories(prev => {
        const key = makeCategoryKey(label, prev);
        const preset = CATEGORY_STYLE_PRESETS[Object.keys(prev).length % CATEGORY_STYLE_PRESETS.length];
        return { ...prev, [key]: { label, ...preset } };
      });
    }
    setNewCategoryLabel("");
  };

  const startEditCategory = (key: string) => {
    setEditingCategoryKey(key);
    setNewCategoryLabel(categories[key]?.label || "");
  };

  const deleteCategory = (key: string) => {
    const entries = Object.keys(categories);
    if (entries.length <= 1) return;
    const fallback = entries.find(k => k !== key) || "prospeccao";
    setCategories(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTasksByProfile(prev => {
      const next = { ...prev };
      PROFILES.forEach(profile => {
        next[profile.key] = (next[profile.key] || []).map(task => task.category === key ? { ...task, category: fallback } : task);
      });
      return next;
    });
    if (newTask.category === key) setNewTask(p => ({ ...p, category: fallback }));
    if (categoryFilter === key) setCategoryFilter("todas");
    if (editingCategoryKey === key) {
      setEditingCategoryKey(null);
      setNewCategoryLabel("");
    }
  };
  const assignUser = (userId: string, profile: ProfileKey | "") => {
    setAssignments(prev => {
      const next = { ...prev };
      if (!profile) delete next[userId]; else next[userId] = profile;
      return next;
    });
  };

  const dateStr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const current = PROFILES.find(p => p.key === selectedProfile)!;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Rotina <span className="text-emerald-400">Inteligente</span>
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Defina e gerencie a rotina de cada perfil da sua equipe</p>
            <p className="text-xs text-slate-500 capitalize mt-0.5">{dateStr}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAssignDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Users className="w-4 h-4" /> Atribuir Usuários ({Object.keys(assignments).length})
        </button>
      </div>

      {/* Dashboard Summary */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: "Metas do Dia",      value: `${goalCounts.daily.done}/${goalCounts.daily.total}`,     Icon: Target,         color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
          { label: "Metas da Semana",   value: `${goalCounts.weekly.done}/${goalCounts.weekly.total}`,   Icon: Target,         color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/30" },
          { label: "Metas do Mês",      value: `${goalCounts.monthly.done}/${goalCounts.monthly.total}`, Icon: Target,         color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30" },
          { label: "Concluídas",        value: String(doneTasks.length),                                  Icon: CheckCircle2,   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
          { label: "Pendentes",         value: String(pendingTasks.length),                               Icon: Clock,          color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
          { label: "Atrasadas",         value: String(overdueTasks.length),                               Icon: AlertTriangle,  color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30" },
          { label: "Taxa Cumprimento",  value: `${progress}%`,                                            Icon: Percent,        color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
        ].map((c) => {
          const I = c.Icon;
          return (
            <div key={c.label} className={`rounded-2xl border ${c.border} ${c.bg} p-3 flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-xl bg-slate-900/60 flex items-center justify-center ${c.color} flex-shrink-0`}>
                <I className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold truncate">{c.label}</div>
                <div className="text-lg font-black text-white truncate">{c.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* My Goals */}
      <MyGoalsPanel />

      {/* Profile Selector */}
      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Selecione o perfil</div>
        <div className="flex flex-wrap gap-2">
          {PROFILES.map(p => (
            <ProfileCard
              key={p.key}
              profile={p}
              count={tasksByProfile[p.key]?.length || 0}
              active={selectedProfile === p.key}
              onClick={() => setSelectedProfile(p.key)}
            />
          ))}
        </div>
      </div>

      {/* Active profile info + users */}
      <div className="mb-6 bg-slate-900/40 border border-slate-700/50 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <current.Icon className={`w-5 h-5 ${current.color}`} />
            <div>
              <div className="text-sm font-bold text-white">Rotina de {current.label}</div>
              <div className="text-xs text-slate-400">
                {usersInProfile.length === 0
                  ? "Nenhum usuário atribuído a este perfil ainda."
                  : `${usersInProfile.length} usuário${usersInProfile.length === 1 ? "" : "s"} usam esta rotina`}
              </div>
            </div>
          </div>
          <div className="flex -space-x-2">
            {usersInProfile.slice(0, 8).map(u => (
              <div
                key={u.id}
                title={u.full_name || u.email}
                className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-white overflow-hidden"
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (u.full_name || u.email || "?").charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {usersInProfile.length > 8 && (
              <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-300">
                +{usersInProfile.length - 8}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress summary */}
      <div className="mb-4 bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className="text-sm font-semibold text-slate-300">Progresso de {current.label}</span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-bold">✓ {doneTasks.length} concluídas</span>
            <span className="text-amber-400 font-bold">⏱ {pendingTasks.length} pendentes</span>
            <span className="text-rose-400 font-bold">⚠ {overdueTasks.length} atrasadas</span>
            <span className="text-sm font-black text-cyan-300">{progress}%</span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg,#10b981,#06b6d4)" }}
          />
        </div>
      </div>

      {/* View Mode Selector */}
      {(() => {
        const VIEWS = [
          { key: "diaria",  label: "Diária",  emoji: "📅" },
          { key: "semanal", label: "Semanal", emoji: "🗓️" },
          { key: "mensal",  label: "Mensal",  emoji: "📆" },
        ] as const;
        return (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2 p-1 bg-slate-900/60 border border-slate-700/60 rounded-xl">
              {VIEWS.map(v => {
                const active = viewMode === v.key;
                return (
                  <button
                    key={v.key}
                    onClick={() => setViewMode(v.key)}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{v.emoji}</span> Visão {v.label}
                  </button>
                );
              })}
            </div>
            {viewMode !== "diaria" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRefDate(d => {
                    const n = new Date(d);
                    if (viewMode === "semanal") n.setDate(n.getDate() - 7); else n.setMonth(n.getMonth() - 1);
                    return n;
                  })}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
                >‹ Anterior</button>
                <span className="text-xs font-bold text-slate-300 capitalize px-2">
                  {viewMode === "semanal"
                    ? (() => {
                        const start = new Date(refDate); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
                        const end = new Date(start); end.setDate(end.getDate() + 6);
                        return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
                      })()
                    : refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setRefDate(d => {
                    const n = new Date(d);
                    if (viewMode === "semanal") n.setDate(n.getDate() + 7); else n.setMonth(n.getMonth() + 1);
                    return n;
                  })}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
                >Próximo ›</button>
                <button
                  onClick={() => setRefDate(new Date())}
                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold"
                >Hoje</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Diária view */}
      {viewMode === "diaria" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {([
                { key: "todas",       label: "Todas",       count: tasks.length,         cls: "bg-slate-700 text-white" },
                { key: "pendentes",   label: "Pendentes",   count: pendingTasks.length,  cls: "bg-amber-500 text-white" },
                { key: "atrasadas",   label: "Atrasadas",   count: overdueTasks.length,  cls: "bg-rose-500 text-white" },
                { key: "concluidas",  label: "Concluídas",  count: doneTasks.length,     cls: "bg-emerald-500 text-white" },
              ] as const).map(f => {
                const active = statusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
                      active ? `${f.cls} border-transparent shadow-lg` : "bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    {f.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/25" : "bg-slate-700"}`}>{f.count}</span>
                  </button>
                );
              })}
              <select
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
              >
                <option value="todas">Todas categorias</option>
                {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <button
              onClick={() => { if (showAddForm) { resetForm(); } else { setEditingId(null); setShowAddForm(true); } }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              <span className="text-lg leading-none">+</span> Nova Atividade em {current.label}
            </button>
          </div>

          {showAddForm && (
            <div className="mb-6 bg-slate-800/60 rounded-2xl p-4 border border-emerald-500/30">
              <h3 className="text-sm font-bold text-emerald-300 mb-3 uppercase tracking-widest">
                {editingId ? "✎ Editar Atividade" : "+ Nova Atividade"} — {current.label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="col-span-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  placeholder="Título da atividade..."
                  value={newTask.title}
                  onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && saveTask()}
                />
                <textarea
                  className="col-span-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none min-h-[80px]"
                  placeholder="Descrição da atividade (opcional)... ex.: objetivo, instruções, links, checklist"
                  value={newTask.description}
                  onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
                <input
                  type="time"
                  className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  value={newTask.time}
                  onChange={e => setNewTask(p => ({ ...p, time: e.target.value }))}
                />
                <select
                  className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  value={newTask.category}
                  onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                >
                  {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <div className="col-span-full rounded-xl border border-slate-700/70 bg-slate-900/50 p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      placeholder="Nome da categoria..."
                      value={newCategoryLabel}
                      onChange={e => setNewCategoryLabel(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveCategory()}
                    />
                    <button
                      type="button"
                      onClick={saveCategory}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold"
                    >{editingCategoryKey ? "Salvar categoria" : "+ Criar categoria"}</button>
                    {editingCategoryKey && (
                      <button
                        type="button"
                        onClick={() => { setEditingCategoryKey(null); setNewCategoryLabel(""); }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold"
                      >Cancelar</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(categories).map(([key, cat]) => (
                      <span key={key} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cat.bg} ${cat.text} ${cat.border}`}>
                        <span className={`h-2 w-2 rounded-full ${cat.dot}`} />
                        {cat.label}
                        <button type="button" onClick={() => startEditCategory(key)} className="ml-1 text-slate-300 hover:text-white" title="Editar categoria">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => deleteCategory(key)} className="text-slate-300 hover:text-rose-300" title="Excluir categoria">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>                <select
                  className="col-span-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  value={newTask.priority}
                  onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as RotineTask["priority"] }))}
                >
                  <option value="alta">🔴 Alta Prioridade</option>
                  <option value="media">🟡 Média Prioridade</option>
                  <option value="baixa">⚪ Baixa Prioridade</option>
                </select>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={saveTask} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-xl">
                  {editingId ? "Salvar Alterações" : "Adicionar"}
                </button>
                {editingId && (
                  <button
                    onClick={() => { deleteTask(editingId); resetForm(); }}
                    className="px-4 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-sm font-bold py-2.5 rounded-xl border border-rose-500/40"
                  >Excluir</button>
                )}
                <button onClick={resetForm} className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold py-2.5 rounded-xl">Cancelar</button>
              </div>
            </div>
          )}

          {(() => {
            const byCategory = (t: RotineTask) => categoryFilter === "todas" || t.category === categoryFilter;
            const cols = [
              { key: "atrasadas",  title: "Atrasadas",  emoji: "⚠",  ring: "border-rose-500/40 from-rose-950/40",     badge: "bg-rose-500/20 text-rose-300",       list: overdueTasks.filter(byCategory) },
              { key: "pendentes",  title: "Pendentes",  emoji: "⏱",  ring: "border-amber-500/40 from-amber-950/40",   badge: "bg-amber-500/20 text-amber-300",     list: pendingTasks.filter(byCategory) },
              { key: "concluidas", title: "Concluídas", emoji: "✓",  ring: "border-emerald-500/40 from-emerald-950/40", badge: "bg-emerald-500/20 text-emerald-300", list: doneTasks.filter(byCategory) },
            ];
            const visibleCols = statusFilter === "todas" ? cols : cols.filter(c => c.key === statusFilter);
            const hasAny = visibleCols.some(c => c.list.length > 0);
            if (!hasAny) {
              return (
                <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 text-center py-12 text-slate-500">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-sm font-medium">Nenhuma atividade nesta visualização.</p>
                  <p className="text-xs text-slate-600 mt-1">Ajuste o filtro ou clique em "Nova Atividade".</p>
                </div>
              );
            }
            return (
              <div className={`grid gap-4 ${visibleCols.length === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"}`}>
                {visibleCols.map(col => (
                  <div key={col.key} className={`bg-gradient-to-b ${col.ring} to-slate-900/40 rounded-2xl border overflow-hidden flex flex-col`}>
                    <div className="px-4 py-3 flex items-center justify-between border-b border-slate-700/40">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{col.emoji}</span>
                        <span className="text-sm font-bold text-white">{col.title}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{col.list.length}</span>
                    </div>
                    <div className="p-3 flex flex-col gap-2 min-h-[120px]">
                      {col.list.length === 0 ? (
                        <div className="text-center text-xs text-slate-600 py-6">Nenhuma atividade</div>
                      ) : (
                        col.list.slice().sort((a, b) => a.time.localeCompare(b.time)).map(task => (
                          <TaskItem key={task.id} task={task} categories={categories} onToggle={toggleTask} onDelete={deleteTask} onEdit={startEdit} />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* Semanal view */}
      {viewMode === "semanal" && (() => {
        const start = new Date(refDate); start.setHours(0,0,0,0);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
        const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
        const today = new Date(); today.setHours(0,0,0,0);
        const WD = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
        const sortedTasks = tasks.slice().sort((a,b) => a.time.localeCompare(b.time));
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            {days.map((d, idx) => {
              const isToday = d.getTime() === today.getTime();
              const isPast = d.getTime() < today.getTime();
              const isWeekend = idx >= 5;
              return (
                <div key={idx} className={`rounded-2xl border overflow-hidden flex flex-col ${
                  isToday ? "border-emerald-500/60 bg-emerald-950/30 ring-2 ring-emerald-500/30" :
                  isWeekend ? "border-slate-800 bg-slate-900/30" : "border-slate-700/50 bg-slate-900/40"
                }`}>
                  <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between">
                    <div>
                      <div className={`text-[10px] uppercase font-bold tracking-wider ${isToday ? "text-emerald-300" : "text-slate-400"}`}>{WD[idx]}</div>
                      <div className="text-sm font-black text-white">{d.getDate().toString().padStart(2,"0")}/{(d.getMonth()+1).toString().padStart(2,"0")}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isToday ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                      {tasks.length}
                    </span>
                  </div>
                  <div className="p-2 flex flex-col gap-1 max-h-[420px] overflow-y-auto">
                    {sortedTasks.length === 0 ? (
                      <div className="text-center text-[11px] text-slate-600 py-6">Sem rotina</div>
                    ) : sortedTasks.map(t => {
                      const cat = categories[t.category] || DEFAULT_CATEGORY_CONFIG.prospeccao;
                      const showDone = isToday && t.done;
                      return (
                        <div key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] ${
                          showDone ? "bg-emerald-500/10 border-emerald-500/30 opacity-60" : `${cat.bg} ${cat.border}`
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cat.dot} flex-shrink-0`} />
                          <span className="font-mono text-slate-400 w-9 flex-shrink-0">{t.time}</span>
                          <span className={`flex-1 truncate ${showDone ? "line-through text-slate-500" : "text-slate-100"}`}>{t.title}</span>
                        </div>
                      );
                    })}
                  </div>
                  {isPast && !isToday && (
                    <div className="px-3 py-1.5 bg-slate-900/60 text-[10px] text-slate-500 text-center border-t border-slate-800">Arquivado</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Mensal view */}
      {viewMode === "mensal" && (() => {
        const year = refDate.getFullYear();
        const month = refDate.getMonth();
        const first = new Date(year, month, 1);
        const startOffset = (first.getDay() + 6) % 7; // Monday = 0
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (Date | null)[] = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
        while (cells.length % 7 !== 0) cells.push(null);
        const today = new Date(); today.setHours(0,0,0,0);
        const WD = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
        const totalPerDay = tasks.length;
        const monthTotal = totalPerDay * daysInMonth;
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300">Atividades / Dia</div>
                <div className="text-2xl font-black text-white">{totalPerDay}</div>
              </div>
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                <div className="text-[10px] uppercase tracking-wider font-bold text-sky-300">Dias no Mês</div>
                <div className="text-2xl font-black text-white">{daysInMonth}</div>
              </div>
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
                <div className="text-[10px] uppercase tracking-wider font-bold text-violet-300">Volume Mensal</div>
                <div className="text-2xl font-black text-white">{monthTotal}</div>
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-700/50 bg-slate-900/60">
                {WD.map(w => (
                  <div key={w} className="text-[10px] uppercase tracking-wider font-bold text-slate-400 text-center py-2">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((d, i) => {
                  if (!d) return <div key={i} className="border-b border-r border-slate-800/60 min-h-[88px] bg-slate-950/40" />;
                  const isToday = d.getTime() === today.getTime();
                  const dow = (d.getDay() + 6) % 7;
                  const isWeekend = dow >= 5;
                  return (
                    <div key={i} className={`border-b border-r border-slate-800/60 min-h-[88px] p-2 flex flex-col gap-1 ${
                      isToday ? "bg-emerald-950/40 ring-1 ring-emerald-500/40 ring-inset" : isWeekend ? "bg-slate-900/20" : "bg-slate-900/40"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isToday ? "text-emerald-300" : "text-slate-300"}`}>{d.getDate()}</span>
                        {totalPerDay > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{totalPerDay}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {tasks.slice(0, 8).map(t => (
                          <span key={t.id} title={`${t.time} ${t.title}`} className={`w-1.5 h-1.5 rounded-full ${(categories[t.category] || DEFAULT_CATEGORY_CONFIG.prospeccao).dot}`} />
                        ))}
                        {tasks.length > 8 && <span className="text-[9px] text-slate-500">+{tasks.length - 8}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-500">Legenda:</span>
              {Object.entries(categories).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}




      {/* Assign Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAssignDialog(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5" /> Atribuir Função a cada Usuário</h3>
                <p className="text-xs text-slate-400 mt-1">Defina qual rotina cada pessoa do time deve seguir.</p>
              </div>
              <button onClick={() => setShowAssignDialog(false)} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {loadingMembers && <p className="text-sm text-slate-400 text-center py-8">Carregando equipe...</p>}
              {!loadingMembers && members.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum usuário encontrado na empresa.</p>
              )}
              {members.map(m => {
                const assigned = assignments[m.id];
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 border border-slate-700/60 rounded-xl bg-slate-800/40">
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0">
                      {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.full_name || m.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{m.full_name || "Sem nome"}</div>
                      <div className="text-xs text-slate-400 truncate">{m.email}</div>
                    </div>
                    <select
                      value={assigned || ""}
                      onChange={(e) => assignUser(m.id, e.target.value as ProfileKey | "")}
                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 min-w-[160px]"
                    >
                      <option value="">— Sem rotina —</option>
                      {PROFILES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end">
              <button onClick={() => setShowAssignDialog(false)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl">Concluído</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


