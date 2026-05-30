import { useMemo, useState } from "react";
import { Search, Plus, GripVertical, Pencil, Trash2, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PerfilId = "sdr" | "vendedor" | "atendente" | "secretaria" | "gerente";
type PeriodoId = "manha" | "tarde" | "noite";
type CategoriaId = "prospeccao" | "followup" | "reuniao" | "admin" | "meta" | "atendimento" | "treinamento";
type PrioridadeId = "alta" | "media" | "baixa";

interface Atividade {
  id: string;
  perfil: PerfilId;
  titulo: string;
  descricao: string;
  horario: string;
  periodo: PeriodoId;
  categoria: CategoriaId;
  prioridade: PrioridadeId;
  xp: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PERFIS: { id: PerfilId; nome: string; icon: string; color: string; bg: string }[] = [
  { id: "sdr",        nome: "SDR",        icon: "📞", color: "#6366f1", bg: "rgba(99,102,241,.12)" },
  { id: "vendedor",   nome: "Vendedor",   icon: "💼", color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  { id: "atendente",  nome: "Atendente",  icon: "💬", color: "#06b6d4", bg: "rgba(6,182,212,.12)" },
  { id: "secretaria", nome: "Secretária", icon: "📋", color: "#ec4899", bg: "rgba(236,72,153,.12)" },
  { id: "gerente",    nome: "Gerente",    icon: "🎯", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
];

const PERIODOS: { id: PeriodoId; nome: string; icon: string }[] = [
  { id: "manha", nome: "Manhã", icon: "🌅" },
  { id: "tarde", nome: "Tarde", icon: "☀️" },
  { id: "noite", nome: "Noite", icon: "🌙" },
];

const CATEGORIAS: Record<CategoriaId, { label: string; icon: string; color: string; badge: string }> = {
  prospeccao:   { label: "Prospecção",   icon: "📞", color: "#6366f1", badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  followup:     { label: "Follow-up",    icon: "🔄", color: "#f59e0b", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  reuniao:      { label: "Reunião",      icon: "🤝", color: "#10b981", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  admin:        { label: "Admin",        icon: "📋", color: "#8b5cf6", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  meta:         { label: "Meta",         icon: "🎯", color: "#ef4444", badge: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  atendimento:  { label: "Atendimento",  icon: "💬", color: "#06b6d4", badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  treinamento:  { label: "Treinamento",  icon: "📚", color: "#ec4899", badge: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
};

const PRIORIDADES: Record<PrioridadeId, { label: string; icon: string; badge: string }> = {
  alta:  { label: "Alta",  icon: "🔴", badge: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  media: { label: "Média", icon: "🟡", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  baixa: { label: "Baixa", icon: "🟢", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
};

// ─── Seed ─────────────────────────────────────────────────────────────────────
const SEED: Atividade[] = [
  { id: "1", perfil: "sdr", titulo: "Prospectar 20 leads no LinkedIn", descricao: "Buscar perfis ICP e enviar conexão", horario: "08:30", periodo: "manha", categoria: "prospeccao", prioridade: "alta", xp: 50 },
  { id: "2", perfil: "sdr", titulo: "Cold calls (10 ligações)", descricao: "Lista quente do dia anterior", horario: "10:00", periodo: "manha", categoria: "prospeccao", prioridade: "alta", xp: 80 },
  { id: "3", perfil: "sdr", titulo: "Follow-up com leads de ontem", descricao: "WhatsApp + e-mail", horario: "14:00", periodo: "tarde", categoria: "followup", prioridade: "media", xp: 40 },
  { id: "4", perfil: "sdr", titulo: "Atualizar CRM", descricao: "Registrar interações do dia", horario: "17:30", periodo: "tarde", categoria: "admin", prioridade: "baixa", xp: 20 },
  { id: "5", perfil: "vendedor", titulo: "Reunião com cliente ABC", descricao: "Apresentação de proposta", horario: "09:30", periodo: "manha", categoria: "reuniao", prioridade: "alta", xp: 100 },
  { id: "6", perfil: "vendedor", titulo: "Enviar propostas pendentes", descricao: "3 propostas em aberto", horario: "11:00", periodo: "manha", categoria: "followup", prioridade: "alta", xp: 60 },
  { id: "7", perfil: "vendedor", titulo: "Negociação cliente XYZ", descricao: "Ajustar condições comerciais", horario: "15:00", periodo: "tarde", categoria: "reuniao", prioridade: "alta", xp: 90 },
  { id: "8", perfil: "atendente", titulo: "Responder tickets abertos", descricao: "Inbox de suporte", horario: "08:00", periodo: "manha", categoria: "atendimento", prioridade: "alta", xp: 30 },
  { id: "9", perfil: "atendente", titulo: "Triagem de mensagens WhatsApp", descricao: "Encaminhar para vendedores", horario: "13:30", periodo: "tarde", categoria: "atendimento", prioridade: "media", xp: 25 },
  { id: "10", perfil: "secretaria", titulo: "Confirmar agendamentos do dia", descricao: "Ligar para todos os clientes", horario: "08:00", periodo: "manha", categoria: "admin", prioridade: "alta", xp: 30 },
  { id: "11", perfil: "secretaria", titulo: "Organizar agenda da semana", descricao: "Bloqueio de horários", horario: "16:00", periodo: "tarde", categoria: "admin", prioridade: "media", xp: 20 },
  { id: "12", perfil: "gerente", titulo: "Daily com a equipe", descricao: "15 min de alinhamento", horario: "09:00", periodo: "manha", categoria: "reuniao", prioridade: "alta", xp: 50 },
  { id: "13", perfil: "gerente", titulo: "Análise de metas semanais", descricao: "Comparar pipeline x meta", horario: "14:30", periodo: "tarde", categoria: "meta", prioridade: "alta", xp: 70 },
  { id: "14", perfil: "gerente", titulo: "1:1 com vendedores", descricao: "Feedback individual", horario: "19:00", periodo: "noite", categoria: "reuniao", prioridade: "media", xp: 60 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RotinaInteligente() {
  const [perfilAtivo, setPerfilAtivo] = useState<PerfilId>("sdr");
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoId | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [atividades, setAtividades] = useState<Atividade[]>(SEED);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Atividade, "id" | "perfil">>({
    titulo: "", descricao: "", horario: "08:00", periodo: "manha",
    categoria: "prospeccao", prioridade: "media", xp: 30,
  });

  const perfilCfg = PERFIS.find(p => p.id === perfilAtivo)!;

  const countsPorPerfil = useMemo(() => {
    const map: Record<PerfilId, number> = { sdr: 0, vendedor: 0, atendente: 0, secretaria: 0, gerente: 0 };
    atividades.forEach(a => { map[a.perfil]++; });
    return map;
  }, [atividades]);

  const filtradas = useMemo(() => {
    return atividades
      .filter(a => a.perfil === perfilAtivo)
      .filter(a => periodoFiltro === "todas" ? true : a.periodo === periodoFiltro)
      .filter(a => busca.trim() === "" ? true :
        a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        a.descricao.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => a.horario.localeCompare(b.horario));
  }, [atividades, perfilAtivo, periodoFiltro, busca]);

  const porPeriodo = useMemo(() => {
    const groups: Record<PeriodoId, Atividade[]> = { manha: [], tarde: [], noite: [] };
    filtradas.forEach(a => groups[a.periodo].push(a));
    return groups;
  }, [filtradas]);

  const totalXP = filtradas.reduce((s, a) => s + a.xp, 0);

  const resetForm = () => {
    setForm({ titulo: "", descricao: "", horario: "08:00", periodo: "manha", categoria: "prospeccao", prioridade: "media", xp: 30 });
    setEditId(null);
  };

  const openNew = () => { resetForm(); setModalOpen(true); };
  const openEdit = (a: Atividade) => {
    setEditId(a.id);
    setForm({ titulo: a.titulo, descricao: a.descricao, horario: a.horario, periodo: a.periodo, categoria: a.categoria, prioridade: a.prioridade, xp: a.xp });
    setModalOpen(true);
  };

  const salvar = () => {
    if (!form.titulo.trim()) return;
    if (editId) {
      setAtividades(prev => prev.map(a => a.id === editId ? { ...a, ...form } : a));
    } else {
      setAtividades(prev => [...prev, { ...form, id: crypto.randomUUID(), perfil: perfilAtivo }]);
    }
    setModalOpen(false);
    resetForm();
  };

  const remover = (id: string) => setAtividades(prev => prev.filter(a => a.id !== id));

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 p-7" style={{ fontFamily: "Sora, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-7 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            🧠 Rotina <span className="text-emerald-500">Inteligente</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Defina e gerencie a rotina de cada perfil da sua equipe</p>
        </div>
      </div>

      {/* Perfis */}
      <div className="mb-6">
        <div className="text-[.62rem] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Selecione o perfil</div>
        <div className="flex gap-2.5 flex-wrap">
          {PERFIS.map(p => {
            const active = p.id === perfilAtivo;
            return (
              <button
                key={p.id}
                onClick={() => setPerfilAtivo(p.id)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border-2 transition relative min-w-[140px] max-w-[200px] flex-1"
                style={{
                  borderColor: active ? p.color : "transparent",
                  background: active ? p.bg : "#161b22",
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: p.bg }}>
                  {p.icon}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-[.8rem] font-bold text-slate-100">{p.nome}</div>
                  <div className="text-[.62rem] text-slate-500 mt-0.5">{countsPorPerfil[p.id]} atividades</div>
                </div>
                {active && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full" style={{ background: p.color }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-2xl px-5 py-4 flex gap-6 items-center flex-wrap mb-6">
        <div className="flex flex-col gap-0.5">
          <div className="text-lg font-black tracking-tight" style={{ color: perfilCfg.color }}>{filtradas.length}</div>
          <div className="text-[.6rem] uppercase tracking-widest text-slate-600 font-semibold">Atividades</div>
        </div>
        <div className="w-px h-8 bg-[#1e293b] self-center" />
        <div className="flex flex-col gap-0.5">
          <div className="text-lg font-black tracking-tight text-amber-500">{totalXP} XP</div>
          <div className="text-[.6rem] uppercase tracking-widest text-slate-600 font-semibold">Total no perfil</div>
        </div>
        <div className="w-px h-8 bg-[#1e293b] self-center" />
        <div className="flex flex-col gap-0.5">
          <div className="text-lg font-black tracking-tight text-slate-100">{porPeriodo.manha.length} / {porPeriodo.tarde.length} / {porPeriodo.noite.length}</div>
          <div className="text-[.6rem] uppercase tracking-widest text-slate-600 font-semibold">Manhã / Tarde / Noite</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-[#161b22] border border-[#21262d] rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-slate-600" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar atividade..."
              className="bg-transparent border-none outline-none text-slate-100 text-xs w-36 placeholder:text-slate-600"
            />
          </div>
          {(["todas", ...PERIODOS.map(p => p.id)] as (PeriodoId | "todas")[]).map(p => {
            const isActive = periodoFiltro === p;
            const label = p === "todas" ? "Todas" : `${PERIODOS.find(x => x.id === p)!.icon} ${PERIODOS.find(x => x.id === p)!.nome}`;
            return (
              <button
                key={p}
                onClick={() => setPeriodoFiltro(p)}
                className={`px-3 py-1.5 rounded-lg text-[.7rem] font-medium border transition ${
                  isActive
                    ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                    : "border-[#21262d] text-slate-400 bg-[#161b22] hover:border-slate-700 hover:text-slate-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-[.78rem] font-bold shadow-lg shadow-emerald-500/30 transition"
        >
          <Plus className="w-4 h-4" />
          Nova Atividade
        </button>
      </div>

      {/* Períodos */}
      {PERIODOS.filter(p => periodoFiltro === "todas" || periodoFiltro === p.id).map(periodo => {
        const items = porPeriodo[periodo.id];
        const xpPeriodo = items.reduce((s, a) => s + a.xp, 0);
        return (
          <div key={periodo.id} className="mb-5">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-base">{periodo.icon}</span>
              <span className="text-[.72rem] font-extrabold uppercase tracking-widest text-slate-400">{periodo.nome}</span>
              <span className="text-[.6rem] font-bold px-2 py-0.5 rounded-full bg-[#1e293b] text-slate-500 border border-[#1e293b]">
                {items.length}
              </span>
              <div className="flex-1 h-px bg-[#1e293b]" />
              {xpPeriodo > 0 && (
                <span className="text-[.62rem] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  {xpPeriodo} XP
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-slate-700 bg-[#161b22]/40 rounded-xl border border-dashed border-[#21262d]">
                <p className="text-xs font-semibold text-slate-600">Nenhuma atividade neste período</p>
              </div>
            ) : (
              items.map(a => {
                const cat = CATEGORIAS[a.categoria];
                const pri = PRIORIDADES[a.prioridade];
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 bg-[#161b22] border border-[#21262d] rounded-2xl px-4 py-3 mb-2 transition hover:border-slate-700 hover:bg-[#1a2030] relative overflow-hidden"
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: cat.color }} />
                    <GripVertical className="w-4 h-4 text-slate-700 cursor-grab flex-shrink-0 hover:text-slate-500" />
                    <div className="text-[.68rem] font-mono text-slate-600 w-12 text-center bg-[#0d1117] rounded px-1.5 py-1 border border-[#1e293b] flex-shrink-0">
                      {a.horario}
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[.82rem] font-semibold text-slate-100 truncate">{a.titulo}</div>
                      {a.descricao && <div className="text-[.65rem] text-slate-500 mt-0.5 truncate">{a.descricao}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      <span className={`text-[.58rem] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${cat.badge}`}>
                        {cat.icon} {cat.label}
                      </span>
                      <span className={`text-[.58rem] font-bold px-2 py-0.5 rounded border ${pri.badge}`}>
                        {pri.icon} {pri.label}
                      </span>
                      <span className="text-[.58rem] font-bold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
                        +{a.xp} XP
                      </span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded text-slate-700 hover:bg-[#1e293b] hover:text-slate-300 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remover(a.id)} className="p-1.5 rounded text-slate-700 hover:bg-rose-500/10 hover:text-rose-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      {filtradas.length === 0 && (
        <div className="text-center py-14 text-slate-700">
          <div className="text-5xl mb-3 opacity-40">📭</div>
          <p className="text-sm font-semibold text-slate-600">Nenhuma atividade encontrada</p>
          <small className="text-xs text-slate-700">Adicione uma nova atividade para começar</small>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setModalOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#161b22] border border-[#21262d] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            style={{ animation: "modalIn .2s ease" }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#21262d]">
              <div className="text-[.95rem] font-extrabold tracking-tight">
                {editId ? "Editar Atividade" : "Nova Atividade"} — {perfilCfg.icon} {perfilCfg.nome}
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-600 hover:text-rose-400 transition p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3.5">
              <Field label="Título da atividade *">
                <input
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Prospectar 10 leads"
                  className="field-input"
                />
              </Field>
              <Field label="Descrição">
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Detalhes opcionais"
                  className="field-input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Horário">
                  <input
                    type="time"
                    value={form.horario}
                    onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
                    className="field-input"
                  />
                </Field>
                <Field label="Período">
                  <select
                    value={form.periodo}
                    onChange={e => setForm(f => ({ ...f, periodo: e.target.value as PeriodoId }))}
                    className="field-input"
                  >
                    {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.nome}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <select
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaId }))}
                    className="field-input"
                  >
                    {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </Field>
                <Field label="Prioridade">
                  <select
                    value={form.prioridade}
                    onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as PrioridadeId }))}
                    className="field-input"
                  >
                    {Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="XP da missão">
                <input
                  type="number"
                  min={0}
                  value={form.xp}
                  onChange={e => setForm(f => ({ ...f, xp: parseInt(e.target.value) || 0 }))}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-[#21262d] flex gap-2.5">
              <button onClick={() => setModalOpen(false)} className="bg-[#1e293b] hover:bg-slate-700 text-slate-400 px-5 py-2.5 rounded-xl text-[.82rem] font-semibold transition">
                Cancelar
              </button>
              <button onClick={salvar} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-[.82rem] font-bold transition">
                Salvar Atividade
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field-input{width:100%;background:#0d1117;border:1px solid #21262d;border-radius:.65rem;padding:.6rem .9rem;font-size:.82rem;color:#f1f5f9;outline:none;font-family:inherit;transition:border-color .15s}
        .field-input:focus{border-color:#22c55e}
        .field-input::placeholder{color:#334155}
        @keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[.65rem] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}
