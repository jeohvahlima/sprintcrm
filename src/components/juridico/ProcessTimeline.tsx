import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Gavel, Mail, AlertCircle, CheckCircle2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessEvent {
  id: string;
  process_id: string;
  tipo_evento: string;
  descricao: string | null;
  data_evento: string;
  created_at: string;
}

const TIPOS_EVENTO = [
  { value: "peticao", label: "Petição", icon: FileText },
  { value: "despacho", label: "Despacho", icon: Gavel },
  { value: "decisao", label: "Decisão / Sentença", icon: Gavel },
  { value: "audiencia", label: "Audiência realizada", icon: CheckCircle2 },
  { value: "intimacao", label: "Intimação", icon: Mail },
  { value: "juntada", label: "Juntada de documento", icon: FileText },
  { value: "publicacao", label: "Publicação", icon: AlertCircle },
  { value: "outro", label: "Outro", icon: History },
];

const TIPO_COLORS: Record<string, string> = {
  peticao: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  despacho: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  decisao: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  audiencia: "bg-green-500/10 text-green-700 border-green-500/30",
  intimacao: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  juntada: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  publicacao: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  outro: "bg-gray-500/10 text-gray-700 border-gray-500/30",
};

export default function ProcessTimeline({
  processId,
  companyId,
}: {
  processId: string;
  companyId: string;
}) {
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("peticao");
  const [descricao, setDescricao] = useState("");
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("legal_process_events")
      .select("*")
      .eq("process_id", processId)
      .order("data_evento", { ascending: false });
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (processId) load();
  }, [processId]);

  const adicionar = async () => {
    if (!descricao.trim()) {
      toast.error("Descreva o andamento");
      return;
    }
    const { error } = await supabase.from("legal_process_events").insert({
      process_id: processId,
      company_id: companyId,
      tipo_evento: tipo,
      descricao,
      data_evento: dataEvento,
    });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Andamento registrado");
    setOpen(false);
    setDescricao("");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Linha do Tempo do Processo
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" /> Andamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar andamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_EVENTO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Petição de contestação protocolada com 15 dias de prazo cumpridos..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={adicionar}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum andamento registrado. Comece registrando os marcos do processo.
          </p>
        ) : (
          <div className="space-y-3 relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
            {events.map((ev) => {
              const tipoCfg = TIPOS_EVENTO.find((t) => t.value === ev.tipo_evento);
              const Icon = tipoCfg?.icon || History;
              return (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-[18px] top-1 h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                    <Icon className="h-2 w-2 text-primary" />
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] ${TIPO_COLORS[ev.tipo_evento] || ""}`}>
                        {tipoCfg?.label || ev.tipo_evento}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(ev.data_evento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    {ev.descricao && (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ev.descricao}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
