import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, User, Check, Loader2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profissional {
  id: string;
  nome: string;
  especialidade?: string | null;
  avatar_url?: string | null;
}

interface HorarioSlot {
  horario: string;
  disponivel: boolean;
  ocupado: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  companyName: string;
  primary: string;
  embedded?: boolean; // se true, não usa Dialog
}

const SUPABASE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-public-agenda`;

export function AgendamentoFlow({ slug, companyName, primary, onSuccess }: { slug: string; companyName: string; primary: string; onSuccess?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [profissional, setProfissional] = useState<Profissional | null>(null);
  const [data, setData] = useState<Date | undefined>();
  const [horarios, setHorarios] = useState<HorarioSlot[]>([]);
  const [horario, setHorario] = useState<string>('');
  const [loadingProf, setLoadingProf] = useState(false);
  const [loadingHor, setLoadingHor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', tipo_servico: '', observacoes: '' });

  useEffect(() => {
    setLoadingProf(true);
    fetch(`${SUPABASE_FN}?action=profissionais&company=${slug}`)
      .then(r => r.json())
      .then(d => setProfissionais(d.profissionais || []))
      .catch(() => {})
      .finally(() => setLoadingProf(false));
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    setLoadingHor(true);
    setHorario('');
    const params = new URLSearchParams({
      action: 'horarios',
      data: format(data, 'yyyy-MM-dd'),
      company: slug,
    });
    if (profissional?.id) params.set('profissional_id', profissional.id);
    fetch(`${SUPABASE_FN}?${params}`)
      .then(r => r.json())
      .then(d => setHorarios(d.horarios || []))
      .catch(() => setHorarios([]))
      .finally(() => setLoadingHor(false));
  }, [data, profissional, slug]);

  const handleSubmit = async () => {
    if (!form.nome || !form.telefone || !form.tipo_servico || !data || !horario) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${SUPABASE_FN}?action=agendar&company=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          data: format(data, 'yyyy-MM-dd'),
          horario,
          profissional_id: profissional?.id,
          origem: 'site',
        }),
      });
      const result = await r.json();
      if (!result.success) {
        toast.error(result.error || 'Erro ao agendar');
        return;
      }
      setDone(true);
      toast.success('Agendamento confirmado!');
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao agendar');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-12 px-4 space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: `${primary}20` }}>
          <Check className="w-10 h-10" style={{ color: primary }} />
        </div>
        <h3 className="text-2xl font-bold">Agendamento Confirmado!</h3>
        <p className="text-muted-foreground">
          {form.nome}, sua consulta foi agendada para<br />
          <strong>{data && format(data, "dd 'de' MMMM", { locale: ptBR })} às {horario}</strong>
          {profissional && <><br />com <strong>{profissional.nome}</strong></>}
        </p>
        <p className="text-sm text-muted-foreground">Você receberá uma confirmação no WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progresso */}
      <div className="flex items-center gap-2 text-xs">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={cn(
            "flex-1 h-1.5 rounded-full transition",
            s <= step ? "" : "bg-slate-200"
          )} style={s <= step ? { background: primary } : {}} />
        ))}
      </div>

      {/* STEP 1: Profissional */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Escolha o profissional</h3>
            <p className="text-sm text-muted-foreground">Quem você gostaria que te atendesse?</p>
          </div>
          {loadingProf ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : profissionais.length === 0 ? (
            <Card className="p-4 text-center text-sm text-muted-foreground">
              Sem escolha de profissional necessária. Continuar →
              <Button className="mt-3 w-full" onClick={() => setStep(2)} style={{ background: primary }}>Próximo</Button>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {profissionais.map(p => (
                  <Card
                    key={p.id}
                    onClick={() => { setProfissional(p); setStep(2); }}
                    className={cn(
                      "p-4 cursor-pointer hover:shadow-md transition flex items-center gap-3",
                      profissional?.id === p.id && "ring-2"
                    )}
                    style={profissional?.id === p.id ? { borderColor: primary } : {}}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.nome} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: primary }}>
                        {p.nome.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.nome}</div>
                      {p.especialidade && <div className="text-xs text-muted-foreground truncate">{p.especialidade}</div>}
                    </div>
                  </Card>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setProfissional(null); setStep(2); }}>
                Sem preferência →
              </Button>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Data */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h3 className="text-lg font-semibold">Escolha a data</h3>
              {profissional && <p className="text-xs text-muted-foreground">com {profissional.nome}</p>}
            </div>
          </div>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={data}
              onSelect={(d) => { setData(d); if (d) setStep(3); }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              locale={ptBR}
              className="rounded-md border p-3 pointer-events-auto"
            />
          </div>
        </div>
      )}

      {/* STEP 3: Horário */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h3 className="text-lg font-semibold">Escolha o horário</h3>
              <p className="text-xs text-muted-foreground">{data && format(data, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
            </div>
          </div>
          {loadingHor ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
              {horarios.map(h => (
                <button
                  key={h.horario}
                  onClick={() => { if (h.disponivel) { setHorario(h.horario); setStep(4); } }}
                  disabled={!h.disponivel}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium border transition",
                    h.disponivel ? "hover:bg-slate-50" : "opacity-40 cursor-not-allowed line-through bg-slate-100",
                    horario === h.horario && "text-white border-transparent"
                  )}
                  style={horario === h.horario ? { background: primary } : {}}
                >
                  {h.horario}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded border" /> Disponível</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-slate-100 border" /> Ocupado</span>
          </div>
        </div>
      )}

      {/* STEP 4: Dados */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setStep(3)}><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h3 className="text-lg font-semibold">Seus dados</h3>
              <p className="text-xs text-muted-foreground">Para finalizar o agendamento</p>
            </div>
          </div>

          {/* Resumo */}
          <Card className="p-3 bg-slate-50 space-y-1 text-sm">
            <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4" style={{ color: primary }} />{data && format(data, "dd/MM/yyyy", { locale: ptBR })} às {horario}</div>
            {profissional && <div className="flex items-center gap-2"><User className="w-4 h-4" style={{ color: primary }} />{profissional.nome}</div>}
          </Card>

          <div>
            <Label>Nome completo *</Label>
            <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Seu nome" />
          </div>
          <div>
            <Label>WhatsApp *</Label>
            <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
          </div>
          <div>
            <Label>Tipo de atendimento *</Label>
            <Input value={form.tipo_servico} onChange={e => setForm({ ...form, tipo_servico: e.target.value })} placeholder="Ex: Consulta, Avaliação, Reunião" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Alguma informação adicional?" rows={2} />
          </div>

          <Button className="w-full" disabled={submitting} onClick={handleSubmit} style={{ background: primary }}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirmando...</> : 'Confirmar Agendamento'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AgendamentoModal({ open, onClose, slug, companyName, primary }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" style={{ color: primary }} />
            Agendar com {companyName}
          </DialogTitle>
        </DialogHeader>
        <AgendamentoFlow slug={slug} companyName={companyName} primary={primary} onSuccess={() => setTimeout(onClose, 4000)} />
      </DialogContent>
    </Dialog>
  );
}
