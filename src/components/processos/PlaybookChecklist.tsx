import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Circle, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { usePlaybookChecklist, useSavePlaybookItem, PLAYBOOK_ITEMS } from "@/hooks/useEstruturacao";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_CYCLE = ["nao_iniciado", "em_construcao", "documentado"] as const;
const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
  nao_iniciado: { label: "Não iniciado", icon: Circle, color: "text-muted-foreground" },
  em_construcao: { label: "Em construção", icon: Loader2, color: "text-amber-500" },
  documentado: { label: "Documentado", icon: CheckCircle2, color: "text-emerald-500" },
};

export function PlaybookChecklist() {
  const { data: items = [] } = usePlaybookChecklist();
  const save = useSavePlaybookItem();
  const [linkEdit, setLinkEdit] = useState<Record<string, string>>({});

  const getItem = (key: string) => items.find((i) => i.item_key === key);

  const cycle = async (key: string, label: string, ordem: number) => {
    const cur = getItem(key);
    const status = (cur?.status as any) || "nao_iniciado";
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
    try {
      await save.mutateAsync({ item_key: key, item_label: label, status: next, ordem, link_documento: cur?.link_documento });
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  const saveLink = async (key: string, label: string, ordem: number) => {
    const cur = getItem(key);
    const link = linkEdit[key];
    try {
      await save.mutateAsync({ item_key: key, item_label: label, status: cur?.status || "em_construcao", ordem, link_documento: link });
      toast.success("Link salvo");
      setLinkEdit((p) => ({ ...p, [key]: "" }));
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  const ok = items.filter((i) => i.status === "documentado").length;
  const pct = Math.round((ok / PLAYBOOK_ITEMS.length) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/10">
            <BookOpen className="h-5 w-5 text-violet-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Playbook Comercial Documentado</CardTitle>
            <CardDescription>Capítulos do playbook GROW Sales Intelligence.</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono">{ok}/{PLAYBOOK_ITEMS.length}</Badge>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {PLAYBOOK_ITEMS.map((it) => {
          const cur = getItem(it.key);
          const status = (cur?.status as any) || "nao_iniciado";
          const meta = STATUS_META[status];
          const SIcon = meta.icon;
          return (
            <div key={it.key} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => cycle(it.key, it.label, it.ordem)} className="flex items-center gap-2 flex-1 text-left">
                  <SIcon className={`h-4 w-4 ${meta.color} ${status === "em_construcao" ? "animate-spin" : ""}`} />
                  <span className="text-sm font-medium">{it.label}</span>
                </button>
                {cur?.link_documento && (
                  <a href={cur.link_documento} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="ghost" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Link do documento (opcional)"
                  className="h-8 text-xs"
                  value={linkEdit[it.key] ?? cur?.link_documento ?? ""}
                  onChange={(e) => setLinkEdit((p) => ({ ...p, [it.key]: e.target.value }))}
                />
                <Button size="sm" variant="secondary" onClick={() => saveLink(it.key, it.label, it.ordem)}>Salvar link</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
