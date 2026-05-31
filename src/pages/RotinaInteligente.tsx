import { useState, useEffect, useMemo } from "react";
import { Phone, Briefcase, MessageSquare, CalendarDays, Trophy, Users, Check, X, Brain, Pencil } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileKey = "sdr" | "vendedor_close" | "atendente" | "secretaria" | "gerente";

interface RotineTask {
  id: string;
  title: string;
  description?: string;
  time: string;
  done: boolean;
  category: "prospeccao" | "followup" | "reuniao" | "admin" | "meta";
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
const CATEGORY_CONFIG = {
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

function TaskItem({ task, onToggle, onDelete, onEdit }: {
  task: RotineTask; onToggle: (id: string) => void; onDelete: (id: string) => void; onEdit: (task: RotineTask) => void;
}) {
  const cat = CATEGORY_CONFIG[task.category];
  const pri = PRIORITY_CONFIG[task.priority];
  return (
    <div
      className={`group flex items-start gap-3 rounded-xl px-4 py-3 border transition-all duration-200
        ${task.done ? "bg-slate-800/30 border-slate-700/30 opacity-60" : `${cat.bg} ${cat.border} hover:brightness-110`}`}
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
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-400 p-1 mt-0.5"
        title="Editar"
      ><Pencil className="w-3.5 h-3.5" /></button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-rose-400 text-xs p-1 mt-0.5"
        title="Excluir"
      >✕</button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RotinaInteligente() {
  const { members, loading: loadingMembers } = useTeamMembers();

  const [tasksByProfile, setTasksByProfile] = useState<Record<ProfileKey, RotineTask[]>>(loadTasks);
  const [assignments, setAssignments] = useState<Record<string, ProfileKey>>(loadAssignments);
  const [selectedProfile, setSelectedProfile] = useState<ProfileKey>("sdr");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", time: "09:00", category: "prospeccao" as RotineTask["category"], priority: "media" as RotineTask["priority"] });

  // Persist
  useEffect(() => { localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasksByProfile)); }, [tasksByProfile]);
  useEffect(() => { localStorage.setItem(STORAGE_ASSIGN_KEY, JSON.stringify(assignments)); }, [assignments]);

  const tasks = tasksByProfile[selectedProfile] || [];
  const doneTasks = tasks.filter(t => t.done);
  const progress = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const usersInProfile = useMemo(
    () => members.filter(m => assignments[m.id] === selectedProfile),
    [members, assignments, selectedProfile]
  );

  const updateTasks = (mut: (prev: RotineTask[]) => RotineTask[]) =>
    setTasksByProfile(prev => ({ ...prev, [selectedProfile]: mut(prev[selectedProfile] || []) }));

  const toggleTask = (id: string) => updateTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id: string) => updateTasks(p => p.filter(t => t.id !== id));
  const addTask = () => {
    if (!newTask.title.trim()) return;
    updateTasks(p => [...p, { id: Date.now().toString(), ...newTask, done: false }]);
    setNewTask({ title: "", time: "09:00", category: "prospeccao", priority: "media" });
    setShowAddForm(false);
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

      {/* Progress */}
      <div className="mb-6 bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-300">Progresso de {current.label}</span>
          <span className="text-sm font-black text-emerald-400">{progress}% · {doneTasks.length}/{tasks.length}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg,#10b981,#06b6d4)" }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
        >
          <span className="text-lg leading-none">+</span> Nova Atividade em {current.label}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 bg-slate-800/60 rounded-2xl p-4 border border-emerald-500/30">
          <h3 className="text-sm font-bold text-emerald-300 mb-3 uppercase tracking-widest">+ Nova Atividade — {current.label}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="col-span-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              placeholder="Título da atividade..."
              value={newTask.title}
              onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addTask()}
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
              onChange={e => setNewTask(p => ({ ...p, category: e.target.value as RotineTask["category"] }))}
            >
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              value={newTask.priority}
              onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as RotineTask["priority"] }))}
            >
              <option value="alta">🔴 Alta Prioridade</option>
              <option value="media">🟡 Média Prioridade</option>
              <option value="baixa">⚪ Baixa Prioridade</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addTask} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-xl">Adicionar</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold py-2.5 rounded-xl">Cancelar</button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 flex flex-col gap-2">
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm font-medium">Nenhuma atividade definida para {current.label}.</p>
              <p className="text-xs text-slate-600 mt-1">Clique em "Nova Atividade" para começar.</p>
            </div>
          ) : (
            tasks.slice().sort((a, b) => a.time.localeCompare(b.time)).map(task => (
              <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
            ))
          )}
        </div>
      </div>

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
