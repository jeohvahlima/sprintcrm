import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useSDRSpecializations, useSetSDRNivel, SDR_NIVEIS, SDRNivel } from "@/hooks/useEstruturacao";
import { toast } from "sonner";

export function SDRSpecializationPanel() {
  const { members, loading } = useTeamMembers();
  const { data: specs = [] } = useSDRSpecializations();
  const setNivel = useSetSDRNivel();

  const sdrs = members.filter((m) => m.role === "vendedor" || m.role === "gestor");

  const getNivel = (uid: string) => specs.find((s) => s.user_id === uid)?.nivel as SDRNivel | undefined;

  const setLevel = async (uid: string, nivel: SDRNivel) => {
    try {
      await setNivel.mutateAsync({ user_id: uid, nivel });
      toast.success("Nível atualizado");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Especialização SDR — Estrutura GROW</CardTitle>
              <CardDescription>Classifique seus SDRs nos 4 níveis da metodologia.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {SDR_NIVEIS.map((n) => {
          const count = specs.filter((s) => s.nivel === n.key).length;
          return (
            <Card key={n.key} className="overflow-hidden">
              <div className={`h-1.5 bg-gradient-to-r ${n.color}`} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{n.label}</div>
                  <Badge variant="secondary" className="font-mono">{count}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{n.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Time Comercial</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
          {!loading && sdrs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum vendedor ativo.</p>}
          {sdrs.map((m) => {
            const cur = getNivel(m.id);
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.avatar_url || undefined} />
                  <AvatarFallback>{m.full_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {SDR_NIVEIS.map((n) => (
                    <Button key={n.key} size="sm" variant={cur === n.key ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setLevel(m.id, n.key)}>
                      {n.key.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
