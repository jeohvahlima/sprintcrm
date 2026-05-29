/**
 * PacienteProntuarioSection
 *
 * Seção clínica embutida no perfil do paciente (EditarLeadDialog).
 * Renderiza APENAS quando isClinica === true.
 *
 * Funcionalidades:
 * - NPS (0-10) + comentário + data de coleta
 * - Lista de procedimentos realizados (JSONB em leads.procedimentos)
 * - Observações clínicas (text em leads.observacoes_clinicas)
 *
 * Salva direto via supabase ao perder foco / clicar Salvar (autônomo).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Star, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Procedimento {
  id: string;
  nome: string;
  data: string; // ISO yyyy-mm-dd
  profissional?: string;
  observacoes?: string;
}

interface Props {
  leadId: string;
  isClinica: boolean;
}

export function PacienteProntuarioSection({ leadId, isClinica }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nps, setNps] = useState<number | null>(null);
  const [npsComment, setNpsComment] = useState("");
  const [npsAt, setNpsAt] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [novoProc, setNovoProc] = useState<Procedimento>({
    id: "",
    nome: "",
    data: new Date().toISOString().slice(0, 10),
    profissional: "",
    observacoes: "",
  });

  useEffect(() => {
    if (!isClinica) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("nps_score, nps_comment, nps_collected_at, procedimentos, observacoes_clinicas")
        .eq("id", leadId)
        .maybeSingle();
      if (data) {
        setNps((data as any).nps_score ?? null);
        setNpsComment((data as any).nps_comment ?? "");
        setNpsAt((data as any).nps_collected_at ?? null);
        setObservacoes((data as any).observacoes_clinicas ?? "");
        setProcedimentos(Array.isArray((data as any).procedimentos) ? (data as any).procedimentos : []);
      }
      setLoading(false);
    })();
  }, [leadId, isClinica]);

  if (!isClinica) return null;
  if (loading) return null;

  const salvar = async () => {
    setSaving(true);
    const payload: any = {
      nps_score: nps,
      nps_comment: npsComment || null,
      nps_collected_at: nps !== null ? (npsAt ?? new Date().toISOString()) : null,
      observacoes_clinicas: observacoes || null,
      procedimentos,
    };
    const { error } = await supabase.from("leads").update(payload).eq("id", leadId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar prontuário", { description: error.message });
    } else {
      toast.success("Prontuário atualizado");
      if (nps !== null) setNpsAt(new Date().toISOString());
    }
  };

  const adicionarProcedimento = () => {
    if (!novoProc.nome.trim()) return;
    setProcedimentos([
      ...procedimentos,
      { ...novoProc, id: crypto.randomUUID() },
    ]);
    setNovoProc({ id: "", nome: "", data: new Date().toISOString().slice(0, 10), profissional: "", observacoes: "" });
  };

  const removerProcedimento = (id: string) => {
    setProcedimentos(procedimentos.filter((p) => p.id !== id));
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          Prontuário do Paciente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* NPS */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-yellow-500" />
            NPS — Como foi a experiência? (0 a 10)
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => (
              <Button
                key={i}
                type="button"
                size="sm"
                variant={nps === i ? "default" : "outline"}
                className="h-8 w-9 p-0 text-xs"
                onClick={() => setNps(i)}
              >
                {i}
              </Button>
            ))}
            {nps !== null && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { setNps(null); setNpsComment(""); }}
              >
                Limpar
              </Button>
            )}
          </div>
          {nps !== null && (
            <>
              <Textarea
                placeholder="Comentário do paciente (opcional)"
                value={npsComment}
                onChange={(e) => setNpsComment(e.target.value)}
                rows={2}
              />
              {npsAt && (
                <p className="text-xs text-muted-foreground">
                  Coletado em {format(parseISO(npsAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </>
          )}
        </div>

        {/* Procedimentos */}
        <div className="space-y-2">
          <Label>Procedimentos realizados</Label>
          {procedimentos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum procedimento registrado</p>
          ) : (
            <div className="space-y-1.5">
              {procedimentos.map((p) => (
                <div key={p.id} className="flex items-start gap-2 rounded-md border p-2 bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(p.data), "dd/MM/yyyy", { locale: ptBR })}
                      {p.profissional ? ` • ${p.profissional}` : ""}
                    </p>
                    {p.observacoes && (
                      <p className="text-xs text-muted-foreground mt-1">{p.observacoes}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removerProcedimento(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border border-dashed p-2 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Procedimento"
                value={novoProc.nome}
                onChange={(e) => setNovoProc({ ...novoProc, nome: e.target.value })}
              />
              <Input
                type="date"
                value={novoProc.data}
                onChange={(e) => setNovoProc({ ...novoProc, data: e.target.value })}
              />
              <Input
                placeholder="Profissional"
                value={novoProc.profissional}
                onChange={(e) => setNovoProc({ ...novoProc, profissional: e.target.value })}
              />
            </div>
            <Textarea
              placeholder="Observações do procedimento (opcional)"
              rows={2}
              value={novoProc.observacoes}
              onChange={(e) => setNovoProc({ ...novoProc, observacoes: e.target.value })}
            />
            <Button type="button" size="sm" variant="outline" onClick={adicionarProcedimento} disabled={!novoProc.nome.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar procedimento
            </Button>
          </div>
        </div>

        {/* Observações clínicas */}
        <div className="space-y-2">
          <Label>Observações clínicas</Label>
          <Textarea
            placeholder="Anotações sobre o paciente, histórico, alergias, restrições..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={salvar} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? "Salvando..." : "Salvar prontuário"}
          </Button>
        </div>

        {nps !== null && (
          <Badge variant="outline" className={`${nps >= 9 ? "bg-green-500/10 text-green-600" : nps >= 7 ? "bg-yellow-500/10 text-yellow-600" : "bg-red-500/10 text-red-600"} border-current`}>
            NPS atual: {nps}/10 — {nps >= 9 ? "Promotor" : nps >= 7 ? "Neutro" : "Detrator"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
