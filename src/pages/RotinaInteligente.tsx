import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RotineTask {
  id: string;
  title: string;
  time: string;
  done: boolean;
  category: "prospeccao" | "followup" | "reuniao" | "admin" | "meta";
  priority: "alta" | "media" | "baixa";
}

interface WeekDay {
  label: string;
  short: string;
  date: number;
  isToday: boolean;
  tasks: number;
  done: number;
}

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

const INITIAL_TASKS: RotineTask[] = [
  { id: "1",  title: "Ligar para 10 leads novos",           time: "08:00", done: true,  category: "prospeccao", priority: "alta"  },
  { id: "2",  title: "Revisar pipeline do Kanban",           time: "09:00", done: true,  category: "followup",   priority: "alta"  },
  { id: "3",  title: "Reunião de alinhamento com equipe",    time: "10:00", done: false, category: "reuniao",    priority: "alta"  },
  { id: "4",  title: "Enviar proposta para cliente ABC",     time: "11:00", done: false, category: "followup",   priority: "alta"  },
  { id: "5",  title: "Atualizar tarefas no sistema",         time: "13:00", done: false, category: "admin",      priority: "media" },
  { id: "6",  title: "Prospectar 5 empresas no LinkedIn",    time: "14:00", done: false, category: "prospeccao", priority: "media" },
  { id: "7",  title: "Follow-up com leads de ontem",         time: "15:00", done: false, category: "followup",   priority: "media" },
  { id: "8",  title: "Atualizar metas semanais",             time: "16:00", done: false, category: "meta",       priority: "baixa" },
  { id: "9",  title: "Relatório de atividades do dia",       time: "17:30", done: false, category: "admin",      priority: "baixa" },
];

const today = new Date();
const WEEK_DAYS: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay() + i);
  return {
    label:   ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][i],
    short:   ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][i],
    date:    d.getDate(),
    isToday: d.toDateString() === today.toDateString(),
    tasks:   [5, 9, 7, 6, 8, 4, 2][i],
    done:    [5, 2, 7, 3, 0, 0, 0][i],
  };
});

const MOTIVATIONAL = [
  "💪 Foco total! Você está no caminho certo.",
  "🔥 Cada ligação é uma oportunidade. Não pare!",
  "🚀 Consistência bate talento. Siga sua rotina.",
  "⚡ O vendedor que executa a rotina vence sempre.",
  "🎯 Metas grandes exigem dias bem planejados.",
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, gradient, icon }: {
  label: string; value: string | number; sub: string;
  gradient: string; icon: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} border border-white/10`}
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
      <div className="absolute -top-4 -right-4 text-6xl opacity-10 select-none">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">{label}</p>
      <p className="text-3xl font-black text-white leading-none">{value}</p>
      <p className="text-sm text-white/70 mt-1">{sub}</p>
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete }: {
  task: RotineTask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cat = CATEGORY_CONFIG[task.category];
  const pri = PRIORITY_CONFIG[task.priority];
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-200 cursor-pointer
        ${task.done
          ? "bg-slate-800/30 border-slate-700/30 opacity-60"
          : `${cat.bg} ${cat.border} border hover:brightness-110`
        }`}
      onClick={() => onToggle(task.id)}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
        ${task.done ? "bg-emerald-500 border-emerald-500" : `border-current ${cat.text}`}`}>
        {task.done && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-xs font-mono text-slate-400 w-12 flex-shrink-0">{task.time}</span>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cat.dot}`} />
      <span className={`flex-1 text-sm font-medium ${task.done ? "line-through text-slate-500" : "text-slate-100"}`}>
        {task.title}
      </span>
      <span className={`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.text} ${cat.border}`}>
        {cat.label}
      </span>
      <span className={`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pri.badge}`}>
        {pri.label}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-rose-400 text-xs p-1"
      >
        ✕
      </button>
    </div>
  );
}

function WeekBar({ days, selectedDay, onSelect }: {
  days: WeekDay[]; selectedDay: number; onSelect: (i: number) => void;
}) {
  return (
    <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1">
      {days.map((d, i) => {
        const pct = d.tasks > 0 ? (d.done / d.tasks) * 100 : 0;
        const isSelected = selectedDay === i;
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`relative flex flex-col items-center gap-1 px-2 sm:px-4 py-3 rounded-xl border transition-all flex-shrink-0
              ${d.isToday
                ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30"
                : isSelected
                  ? "bg-slate-700 border-slate-500 text-white"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">{d.short}</span>
            <span className={`text-lg font-black ${d.isToday ? "text-white" : "text-slate-200"}`}>{d.date}</span>
            <div className="w-8 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${d.isToday ? "bg-white" : "bg-indigo-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-current opacity-70">{d.done}/{d.tasks}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RotinaInteligente() {
  const [tasks, setTasks] = useState<RotineTask[]>(INITIAL_TASKS);
  const [filter, setFilter] = useState<string>("todas");
  const [selectedDay, setSelectedDay] = useState<number>(today.getDay());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", time: "09:00", category: "prospeccao" as RotineTask["category"], priority: "media" as RotineTask["priority"] });
  const [quote] = useState(() => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);

  const doneTasks  = tasks.filter(t => t.done);
  const totalTasks = tasks.length;
  const progress   = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  const filtered = filter === "todas"
    ? tasks
    : filter === "pendentes"
      ? tasks.filter(t => !t.done)
      : filter === "concluidas"
        ? tasks.filter(t => t.done)
        : tasks.filter(t => t.category === filter);

  const toggleTask = (id: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const deleteTask = (id: string) =>
    setTasks(prev => prev.filter(t => t.id !== id));

  const addTask = () => {
    if (!newTask.title.trim()) return;
    setTasks(prev => [...prev, {
      id: Date.now().toString(),
      ...newTask,
      done: false,
    }]);
    setNewTask({ title: "", time: "09:00", category: "prospeccao", priority: "media" });
    setShowAddForm(false);
  };

  const dateStr = today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Rotina <span className="text-indigo-400">Inteligente</span>
            </h1>
            <p className="text-sm text-slate-400 capitalize mt-0.5">{dateStr}</p>
          </div>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <span className="text-lg leading-none">+</span> Nova Atividade
          </button>
        </div>
        <div className="mt-3 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-2">
          {quote}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Progresso" value={`${progress}%`} sub={`${doneTasks.length} de ${totalTasks} tarefas`} gradient="bg-gradient-to-br from-indigo-600/80 to-indigo-900/80" icon="📊" />
        <StatCard label="Concluídas" value={doneTasks.length} sub="atividades hoje" gradient="bg-gradient-to-br from-emerald-600/80 to-emerald-900/80" icon="✅" />
        <StatCard label="Pendentes" value={totalTasks - doneTasks.length} sub="ainda a fazer" gradient="bg-gradient-to-br from-amber-600/80 to-amber-900/80" icon="⏳" />
        <StatCard label="Sequência" value="4 dias" sub="sem quebrar rotina" gradient="bg-gradient-to-br from-rose-600/80 to-rose-900/80" icon="🔥" />
      </div>

      {/* Progress Bar */}
      <div className="mb-6 bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-300">Progresso do Dia</span>
          <span className="text-sm font-black text-indigo-400">{progress}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: progress < 40
                ? "linear-gradient(90deg,#ef4444,#f97316)"
                : progress < 70
                  ? "linear-gradient(90deg,#f59e0b,#eab308)"
                  : "linear-gradient(90deg,#10b981,#06b6d4)"
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
          <span>Início</span><span>50%</span><span>Meta</span>
        </div>
      </div>

      {/* Week */}
      <div className="mb-6 bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3">Semana</h2>
        <WeekBar days={WEEK_DAYS} selectedDay={selectedDay} onSelect={setSelectedDay} />
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 bg-slate-800/60 rounded-2xl p-4 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
          <h3 className="text-sm font-bold text-indigo-300 mb-3 uppercase tracking-widest">+ Nova Atividade</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="col-span-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Título da atividade..."
              value={newTask.title}
              onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addTask()}
            />
            <input
              type="time"
              className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              value={newTask.time}
              onChange={e => setNewTask(p => ({ ...p, time: e.target.value }))}
            />
            <select
              className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              value={newTask.category}
              onChange={e => setNewTask(p => ({ ...p, category: e.target.value as RotineTask["category"] }))}
            >
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              value={newTask.priority}
              onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as RotineTask["priority"] }))}
            >
              <option value="alta">🔴 Alta Prioridade</option>
              <option value="media">🟡 Média Prioridade</option>
              <option value="baixa">⚪ Baixa Prioridade</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addTask} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-xl transition-all">Adicionar</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold py-2.5 rounded-xl transition-all">Cancelar</button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "todas",     label: "Todas",      count: tasks.length },
              { key: "pendentes", label: "Pendentes",  count: tasks.filter(t => !t.done).length },
              { key: "concluidas",label: "Concluídas", count: doneTasks.length },
              ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({
                key: k, label: v.label, count: tasks.filter(t => t.category === k).length
              }))
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${filter === f.key
                    ? "bg-indigo-600 border-indigo-400 text-white"
                    : "bg-slate-800 border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
              >
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? "bg-white/20" : "bg-slate-700"}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-sm font-medium">Nenhuma atividade aqui!</p>
            </div>
          ) : (
            filtered
              .sort((a, b) => a.time.localeCompare(b.time))
              .map(task => (
                <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
              ))
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {Object.entries(CATEGORY_CONFIG).map(([k, v]) => {
          const count = tasks.filter(t => t.category === k && t.done).length;
          const total = tasks.filter(t => t.category === k).length;
          return (
            <div key={k} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${v.bg} ${v.border} text-xs`}>
              <span className={`w-2 h-2 rounded-full ${v.dot}`} />
              <span className={`font-medium ${v.text}`}>{v.label}</span>
              <span className="text-slate-500">{count}/{total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
