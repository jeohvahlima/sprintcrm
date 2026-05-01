import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Clock, Plus, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Deadline {
  id: string;
  legal_process_id: string | null;
  tipo: string;
  descricao: string;
  data_inicial: string;
  prazo_dias: number;
  contagem: "uteis" | "corridos";
  prazo_dobrado: boolean;
  data_limite: string | null;
  status: string;
  observacoes: string | null;
  process?: { numero_processo: string | null } | null;
}

const TIPOS_PRAZO = [
  { value: "contestacao", label: "Contestação", dias: 15, contagem: "uteis" },
  { value: "replica", label: "Réplica", dias: 15, contagem: "uteis" },
  { value: "recurso_apelacao", label: "Apelação", dias: 15, contagem: "uteis" },
  { value: "agravo", label: "Agravo de Instrumento", dias: 15, contagem: "uteis" },
  { value: "embargos", label: "Embargos de Declaração", dias: 5, contagem: "uteis" },
  { value: "manifestacao", label: "Manifestação", dias: 5, contagem: "uteis" },
  { value: "alegacoes_finais", label: "Alegações Finais", dias: 15, contagem: "uteis" },
  { value: "tributaria", label: "Defesa Tributária", dias: 30, contagem: "corridos" },
  { value: "trabalhista", label: "Defesa Trabalhista", dias: 5, contagem: "uteis" },
  { value: "outro", label: "Outro", dias: 15, contagem: "uteis" },
];

function getUrgencia(dataLimite: string | null, status: string): {
  label: string;
  color: string;
  Icon: any;
  dias: number;
} {
  if (status === "cumprido") return { label: "Cumprido", color: "bg-green-500/10 text-green-700 border-green-500/30", Icon: CheckCircle2, dias: 0 };
  if (status === "perdido") return { label: "Perdido", color: "bg-red-500/10 text-red-700 border-red-500/30", Icon: AlertTriangle, dias: 0 };
  if (status === "cancelado") return { label: "Cancelado", color: "bg-gray-500/10 text-gray-700 border-gray-500/30", Icon: AlertCircle, dias: 0 };
  if (!dataLimite) return { label: "Pendente", color: "bg-muted text-muted-foreground", Icon: Clock, dias: 0 };
  const dias = differenceInCalendarDays(new Date(dataLimite), new Date());
  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)}d`, color: "bg-red-500/10 text-red-700 border-red-500/30", Icon: AlertTriangle, dias };
  if (dias === 0) return { label: "Vence hoje", color: "bg-red-500/10 text-red-700 border-red-500/30", Icon: AlertCircle, dias };
  if (dias <= 3) return { label: `${dias}d restantes`, color: "bg-red-500/10 text-red-700 border-red-500/30", Icon: AlertCircle, dias };
  if (dias <= 7) return { label: `${dias}d restantes`, color: "bg-amber-500/10 text-amber-700 border-amber-500/30", Icon: Clock, dias };
  return { label: `${dias}d restantes`, color: "bg-green-500/10 text-green-700 border-green-500/30", Icon: Clock, dias };
}

export default function GestaoPrazos({ companyId }: { companyId: string | null }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "urgentes" | "cumpridos" | "vencidos">("pendentes");

  // form
  const [processos, setProcessos] = useState<{ id: string; numero_processo: string | null }[]>([]);
  const [processId, setProcessId] = useState<string>("none");
  const [tipo, setTipo] = useState("contestacao");
  const [descricao, setDescricao] = useState("");
  const [dataInicial, setDataInicial] = useState(new Date().toISOString().slice(0, 10));
  const [prazoDias, setPrazoDias] = useState(15);
  const [contagem, setContagem] = useState<"uteis" | "corridos">("uteis");
  const [dobrado, setDobrado] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("legal_deadlines")
      .select("*, process:legal_process_id(numero_processo)")
      .eq("company_id", companyId)
      .order("data_limite", { ascending: true });
    setDeadlines((data as any) || []);
    setLoading(false);
  }, [companyId]);

  const loadProcessos = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("legal_processes")
      .select("id, numero_processo")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    setProcessos(data || []);
  }, [companyId]);

  useEffect(() => {
    load();
    loadProcessos();
  }, [load, loadProcessos]);

  // Atualizar tipo padrão
  const onTipoChange = (v: string) => {
    setTipo(v);
    const cfg = TIPOS_PRAZO.find((t) => t.value === v);
    if (cfg) {
      setPrazoDias(cfg.dias);
      setContagem(cfg.contagem as any);
    }
  };

  const adicionar = async () => {
    if (!companyId) return;
    if (!descricao.trim()) {
      toast.error("Descreva o prazo");
      return;
    }
    const { error } = await supabase.from("legal_deadlines").insert({
      company_id: companyId,
      legal_process_id: processId === "none" ? null : processId,
      tipo,
      descricao,
      data_inicial: dataInicial,
      prazo_dias: prazoDias,
      contagem,
      prazo_dobrado: dobrado,
    });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Prazo cadastrado");
    setOpen(false);
    setDescricao("");
    load();
  };

  const marcarCumprido = async (id: string) => {
    const { error } = await supabase
      .from("legal_deadlines")
      .update({ status: "cumprido", cumprido_em: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Prazo marcado como cumprido");
      load();
    }
  };

  const filtered = deadlines.filter((d) => {
    if (filtro === "todos") return true;
    if (filtro === "cumpridos") return d.status === "cumprido";
    if (filtro === "vencidos") {
      if (d.status !== "pendente" || !d.data_limite) return false;
      return differenceInCalendarDays(new Date(d.data_limite), new Date()) < 0;
    }
    if (filtro === "urgentes") {
      if (d.status !== "pendente" || !d.data_limite) return false;
      const dias = differenceInCalendarDays(new Date(d.data_limite), new Date());
      return dias <= 7 && dias >= 0;
    }
    return d.status === "pendente";
  });

  const stats = {
    pendentes: deadlines.filter((d) => d.status === "pendente").length,
    urgentes: deadlines.filter((d) => {
      if (d.status !== "pendente" || !d.data_limite) return false;
      const dias = differenceInCalendarDays(new Date(d.data_limite), new Date());
      return dias <= 7 && dias >= 0;
    }).length,
    vencidos: deadlines.filter((d) => {
      if (d.status !== "pendente" || !d.data_limite) return false;
      return differenceInCalendarDays(new Date(d.data_limite), new Date()) < 0;
    }).length,
    cumpridos: deadlines.filter((d) => d.status === "cumprido").length,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Gestão de Prazos Processuais
          </CardTitle>
          <CardDescription>Cálculo automático em dias úteis (CPC), com feriados forenses</CardDescription>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo prazo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar prazo</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Processo (opcional)</Label>
                <Select value={processId} onValueChange={setProcessId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem processo vinculado —</SelectItem>
                    {processos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero_processo || `Processo ${p.id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={onTipoChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_PRAZO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} ({t.dias}d {t.contagem})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data inicial (intimação)</Label>
                <Input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
              </div>
              <div>
                <Label>Prazo (dias)</Label>
                <Input type="number" value={prazoDias} onChange={(e) => setPrazoDias(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Contagem</Label>
                <Select value={contagem} onValueChange={(v: any) => setContagem(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uteis">Dias úteis (CPC art. 219)</SelectItem>
                    <SelectItem value="corridos">Dias corridos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center gap-2 rounded-lg border p-2">
                <Switch checked={dobrado} onCheckedChange={setDobrado} />
                <Label className="text-sm">Prazo em dobro (Fazenda Pública, MP, Defensoria — CPC art. 183)</Label>
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Ex: Contestar ação ordinária do autor João" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={adicionar}>Cadastrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Pendentes" value={stats.pendentes} color="text-blue-600" />
          <StatCard label="Urgentes (≤7d)" value={stats.urgentes} color="text-amber-600" />
          <StatCard label="Vencidos" value={stats.vencidos} color="text-red-600" />
          <StatCard label="Cumpridos" value={stats.cumpridos} color="text-green-600" />
        </div>

        <Tabs value={filtro} onValueChange={(v: any) => setFiltro(v)}>
          <TabsList>
            <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
            <TabsTrigger value="urgentes">Urgentes</TabsTrigger>
            <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
            <TabsTrigger value="cumpridos">Cumpridos</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-6">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhum prazo nesta categoria</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const u = getUrgencia(d.data_limite, d.status);
              const tipoLabel = TIPOS_PRAZO.find((t) => t.value === d.tipo)?.label || d.tipo;
              return (
                <div key={d.id} className="rounded-lg border bg-card p-3 flex items-start gap-3">
                  <u.Icon className="h-5 w-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline">{tipoLabel}</Badge>
                      <Badge variant="outline" className={u.color}>{u.label}</Badge>
                      {d.prazo_dobrado && <Badge variant="outline" className="text-[9px]">Em dobro</Badge>}
                      {d.process?.numero_processo && (
                        <span className="text-xs text-muted-foreground font-mono">{d.process.numero_processo}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{d.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Início: {format(new Date(d.data_inicial), "dd/MM/yyyy")} •
                      {" "}{d.prazo_dias} dias {d.contagem} •
                      {d.data_limite && ` Limite: ${format(new Date(d.data_limite), "dd/MM/yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  {d.status === "pendente" && (
                    <Button size="sm" variant="outline" onClick={() => marcarCumprido(d.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Cumprir
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
