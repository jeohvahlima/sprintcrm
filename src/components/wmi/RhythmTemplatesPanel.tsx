import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, Users, CalendarPlus } from "lucide-react";
import { useRhythmTemplates, RhythmTemplate } from "@/hooks/useEstruturacao";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const TIPO_COLOR: Record<string, string> = {
  D1: "from-rose-500 to-orange-400",
  S1: "from-blue-500 to-cyan-400",
  M1: "from-violet-500 to-fuchsia-400",
  T1: "from-amber-500 to-yellow-400",
};

export function RhythmTemplatesPanel() {
  const { data: templates = [], isLoading } = useRhythmTemplates();
  const [open, setOpen] = useState<RhythmTemplate | null>(null);

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Ritmos de Gestão GROW</CardTitle>
              <CardDescription>
                Cadência D1/S1/M1/T1 — Capítulo 10 do Playbook. Use as pautas como template.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading && <Skeleton className="h-40 w-full" />}

      <div className="grid md:grid-cols-2 gap-4">
        {templates.map((t) => {
          const color = TIPO_COLOR[t.tipo] || "from-primary to-primary/70";
          return (
            <Card key={t.id} className="overflow-hidden border-2 hover:border-primary/40 transition">
              <div className={`h-1.5 bg-gradient-to-r ${color}`} />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge className={`bg-gradient-to-r ${color} text-white border-0 font-mono`}>
                    {t.tipo}
                  </Badge>
                  <CardTitle className="text-base flex-1">{t.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t.duracao_min} min</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {t.periodicidade}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t.participantes_sugeridos}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(t)}>
                    Ver pauta
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => {
                    navigator.clipboard.writeText(t.pauta_md);
                    toast.success("Pauta copiada — cole na Agenda ao criar o evento");
                  }}>
                    <CalendarPlus className="h-4 w-4 mr-1" /> Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {open && <Badge className={`bg-gradient-to-r ${TIPO_COLOR[open.tipo]} text-white border-0`}>{open.tipo}</Badge>}
              {open?.label}
            </DialogTitle>
            <DialogDescription>
              {open?.duracao_min} min · {open?.periodicidade} · {open?.participantes_sugeridos}
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-lg p-4 font-sans">
            {open?.pauta_md}
          </pre>
          <Button onClick={() => {
            if (open) {
              navigator.clipboard.writeText(open.pauta_md);
              toast.success("Pauta copiada");
            }
          }}>
            Copiar pauta para área de transferência
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
