import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageCircle, FileText, Plus, History, PhoneCall, PhoneOff, Voicemail, X,
  RotateCcw, CalendarClock, Check, Flame, Trophy, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConversaPopup } from "@/components/leads/ConversaPopup";
import { ScriptViewerDialog } from "@/components/prospeccao/ScriptViewerDialog";

type Outcome = "pendente" | "prospectado" | "sem_resposta" | "oportunidade" | "agendamento" | "follow_up" | "ganho" | "descartado";
type AttemptType =
  | "primeiro_contato" | "nao_atendeu" | "caixa_postal" | "ocupado"
  | "numero_invalido" | "follow_up" | "whatsapp_enviado" | "retornar_depois";
type Attempt = { at: string; type: AttemptType; note?: string; user_id?: string | null; user_name?: string | null };

const ATTEMPT_META: Record<AttemptType, { label: string; icon: any; className: string }> = {
  primeiro_contato: { label: "Primeiro contato", icon: PhoneCall, className: "text-cyan-600" },
  nao_atendeu: { label: "Não atendeu", icon: PhoneOff, className: "text-amber-600" },
  caixa_postal: { label: "Caixa postal", icon: Voicemail, className: "text-amber-700" },
  ocupado: { label: "Ocupado", icon: PhoneOff, className: "text-orange-600" },
  numero_invalido: { label: "Número inválido", icon: X, className: "text-rose-600" },
  follow_up: { label: "Follow-up", icon: RotateCcw, className: "text-indigo-600" },
  whatsapp_enviado: { label: "WhatsApp enviado", icon: MessageCircle, className: "text-emerald-600" },
  retornar_depois: { label: "Retornar depois", icon: CalendarClock, className: "text-purple-600" },
};

const OUTCOME_META: Record<Outcome, { label: string; className: string; icon?: any }> = {
  pendente: { label: "Pendente", className: "text-muted-foreground" },
  prospectado: { label: "Prospectado", className: "text-emerald-600", icon: Check },
  sem_resposta: { label: "Sem resposta", className: "text-slate-500", icon: X },
  oportunidade: { label: "Oportunidade", className: "text-amber-600", icon: Flame },
  agendamento: { label: "Agendamento", className: "text-purple-600", icon: CalendarClock },
  follow_up: { label: "Follow-up", className: "text-cyan-600", icon: PhoneCall },
  ganho: { label: "Ganho", className: "text-emerald-700", icon: Trophy },
  descartado: { label: "Descartado", className: "text-rose-600", icon: X },
};
const OUTCOME_ORDER: Outcome[] = ["pendente", "prospectado", "sem_resposta", "oportunidade", "agendamento", "follow_up", "ganho", "descartado"];

interface Props {
  lead: { id: string; name?: string | null; phone?: string | null; telefone?: string | null };
  // Estado pré-carregado pelo painel pai (evita 1 query + 1 canal realtime por linha)
  externalState?: {
    outcome?: Outcome | string | null;
    attempts?: Attempt[] | null;
  };
  externalCompanyId?: string | null;
  externalUser?: { id: string; name: string } | null;
}

export function ColdCallActions({ lead, externalState, externalCompanyId, externalUser }: Props) {
  const phone = lead.phone || lead.telefone || "";
  const rowKey = `lead:${lead.id}`;
  const [companyId, setCompanyId] = useState<string | null>(externalCompanyId || null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(externalUser || null);
  const [attempts, setAttempts] = useState<Attempt[]>(Array.isArray(externalState?.attempts) ? externalState!.attempts! : []);
  const [outcome, setOutcomeState] = useState<Outcome>(((externalState?.outcome as Outcome) || "pendente"));
  const [loaded, setLoaded] = useState(!!externalState);

  const [conversaOpen, setConversaOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);

  // Sincroniza com props externas (pai é fonte da verdade quando fornecido)
  useEffect(() => {
    if (externalCompanyId) setCompanyId(externalCompanyId);
  }, [externalCompanyId]);
  useEffect(() => {
    if (externalUser) setCurrentUser(externalUser);
  }, [externalUser?.id]);
  useEffect(() => {
    if (!externalState) return;
    setAttempts(Array.isArray(externalState.attempts) ? externalState.attempts! : []);
    setOutcomeState(((externalState.outcome as Outcome) || "pendente"));
    setLoaded(true);
  }, [externalState?.outcome, JSON.stringify(externalState?.attempts || [])]);

  useEffect(() => {
    if (externalCompanyId && externalUser) return; // já temos do pai
    (async () => {
      if (!externalCompanyId) {
        const { data: cid } = await supabase.rpc("get_my_company_id");
        if (cid) setCompanyId(cid as string);
      }
      if (!externalUser) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          setCurrentUser({
            id: user.id,
            name: (prof as any)?.full_name || user.email?.split("@")[0] || "Usuário",
          });
        }
      }
    })();
  }, [externalCompanyId, externalUser]);

  // Fallback: busca individual só quando o pai NÃO entrega estado externo
  useEffect(() => {
    if (externalState) return;
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("pre_sdr_analyses" as any)
        .select("attempts, attempts_count, outcome")
        .eq("company_id", companyId)
        .eq("row_key", rowKey)
        .maybeSingle();
      if (data) {
        setAttempts(Array.isArray((data as any).attempts) ? (data as any).attempts : []);
        setOutcomeState(((data as any).outcome as Outcome) || "pendente");
      }
      setLoaded(true);
    })();
  }, [companyId, rowKey, externalState]);

  // Realtime individual só quando NÃO há estado externo (pai já assina o canal global)
  useEffect(() => {
    if (externalState !== undefined) return;
    if (!companyId) return;
    const ch = supabase
      .channel(`coldcall_lead:${lead.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pre_sdr_analyses", filter: `company_id=eq.${companyId}` },
        (payload) => {
          const n: any = payload.new;
          if (!n || n.row_key !== rowKey) return;
          setAttempts(Array.isArray(n.attempts) ? n.attempts : []);
          setOutcomeState((n.outcome as Outcome) || "pendente");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, lead.id, rowKey, externalState]);


  async function ensureRow() {
    if (!companyId) return false;
    await supabase.from("pre_sdr_analyses" as any).upsert({
      company_id: companyId,
      row_key: rowKey,
      empresa_nome: lead.name || null,
      telefone: phone || null,
      raw_row: { lead_id: lead.id, name: lead.name, telefone: phone },
      lead_id: lead.id,
      status: "done",
    } as any, { onConflict: "company_id,row_key" });
    return true;
  }

  async function addAttempt(type: AttemptType) {
    if (!companyId) return;
    const ok = await ensureRow();
    if (!ok) return;
    const at = new Date().toISOString();
    const next: Attempt = { at, type, user_id: currentUser?.id || null, user_name: currentUser?.name || null };
    const newAttempts = [...attempts, next];
    setAttempts(newAttempts);
    const { error } = await supabase
      .from("pre_sdr_analyses" as any)
      .update({ attempts: newAttempts, attempts_count: newAttempts.length, last_attempt_at: at } as any)
      .eq("company_id", companyId)
      .eq("row_key", rowKey);
    if (error) toast.error("Não foi possível registrar", { description: error.message });
    else toast.success(`Tentativa registrada: ${ATTEMPT_META[type].label}`, { description: `Total: ${newAttempts.length}` });
  }

  async function changeOutcome(o: Outcome) {
    if (!companyId) return;
    await ensureRow();
    setOutcomeState(o);
    const { error } = await supabase
      .from("pre_sdr_analyses" as any)
      .update({ outcome: o, outcome_at: new Date().toISOString() } as any)
      .eq("company_id", companyId)
      .eq("row_key", rowKey);
    if (error) toast.error("Erro ao salvar status", { description: error.message });
  }

  async function removeLast() {
    if (!companyId || !attempts.length) return;
    const newAttempts = attempts.slice(0, -1);
    const last_at = newAttempts.length ? newAttempts[newAttempts.length - 1].at : null;
    setAttempts(newAttempts);
    await supabase
      .from("pre_sdr_analyses" as any)
      .update({ attempts: newAttempts, attempts_count: newAttempts.length, last_attempt_at: last_at } as any)
      .eq("company_id", companyId)
      .eq("row_key", rowKey);
  }

  const count = attempts.length;
  const last = attempts[attempts.length - 1];
  const lastMeta = last ? ATTEMPT_META[last.type] : null;
  const oMeta = OUTCOME_META[outcome];
  const nextNumber = count + 1;

  return (
    <>
      <div className="flex items-center gap-1 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" title="Registrar abordagem">
              <Plus className="h-3 w-3" />
              <span className="text-[11px]">{count === 0 ? "Registrar" : `Tentativa ${nextNumber}`}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 max-h-[70vh] overflow-y-auto">
            <DropdownMenuLabel>{count === 0 ? "Primeira abordagem" : `Tentativa #${nextNumber}`}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(ATTEMPT_META) as AttemptType[]).map((t) => {
              const m = ATTEMPT_META[t];
              const Icon = m.icon;
              return (
                <DropdownMenuItem key={t} onClick={() => addAttempt(t)} className={`gap-2 ${m.className}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Resultado</DropdownMenuLabel>
            {OUTCOME_ORDER.map((o) => {
              const om = OUTCOME_META[o];
              const OIcon = om.icon;
              const active = outcome === o;
              return (
                <DropdownMenuItem key={o} onClick={() => changeOutcome(o)} className={`gap-2 ${om.className} ${active ? "bg-muted font-semibold" : ""}`}>
                  {OIcon ? <OIcon className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                  <span>{om.label}</span>
                  {active && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              );
            })}
            {count > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={removeLast} className="gap-2 text-rose-600">
                  <X className="h-3.5 w-3.5" /> Desfazer última
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {loaded && outcome !== "pendente" && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] ${oMeta.className}`} title="Resultado">
            {oMeta.label}
          </span>
        )}

        {count > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] ${lastMeta?.className || "text-muted-foreground"} hover:bg-muted`}
                title="Histórico"
              >
                <History className="h-3 w-3" />
                <strong>{count}</strong>
                {last?.user_name && (
                  <span className="hidden lg:inline text-[10px] opacity-80">· {last.user_name.split(" ")[0]}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <p className="text-[11px] uppercase font-medium text-muted-foreground px-1 pb-1">Histórico ({count})</p>
              <ol className="space-y-1 max-h-60 overflow-y-auto">
                {attempts.slice().reverse().map((a, i) => {
                  const m = ATTEMPT_META[a.type];
                  const Icon = m?.icon || PhoneCall;
                  const num = count - i;
                  return (
                    <li key={i} className="flex items-start gap-2 text-xs px-1 py-1 rounded hover:bg-muted">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 ${m?.className || ""}`} />
                      <div className="flex-1">
                        <div className={`font-medium ${m?.className || ""}`}>#{num} · {m?.label || a.type}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(a.at).toLocaleString("pt-BR")}
                          {a.user_name && <span className="ml-1">· por <strong>{a.user_name}</strong></span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </PopoverContent>
          </Popover>
        )}

        <Button
          size="sm" variant="ghost"
          className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
          disabled={!phone}
          onClick={() => setConversaOpen(true)}
          title={phone ? "Abrir conversa" : "Sem telefone"}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="ml-1 hidden md:inline">Conversa</span>
        </Button>

        <Button
          size="sm" variant="ghost"
          className="h-7 px-2 text-indigo-600 hover:bg-indigo-50"
          onClick={() => setScriptOpen(true)}
          title="Abrir scripts do Workspace"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="ml-1 hidden md:inline">Script</span>
        </Button>
      </div>

      <ConversaPopup
        open={conversaOpen}
        onOpenChange={setConversaOpen}
        leadId={lead.id}
        leadName={lead.name || "Lead"}
        leadPhone={phone}
      />
      <ScriptViewerDialog
        open={scriptOpen}
        onOpenChange={setScriptOpen}
        contactName={lead.name || undefined}
      />
    </>
  );
}
