import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, TrendingUp, Users } from "lucide-react";
import { usePlaybookAdoptionStats } from "@/hooks/useProcessIntel";

export function PlaybookAdoptionDashboard() {
  const { data, isLoading } = usePlaybookAdoptionStats();

  if (isLoading) return <Skeleton className="h-64" />;

  const playbooks = data?.playbooks || [];
  const byPb = data?.byPlaybook || {};
  const totalUsers = new Set((data?.adoption || []).map((a: any) => a.user_id)).size;
  const totalApplies = (data?.adoption || []).reduce((s: number, a: any) => s + (a.applied_count || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={BookOpen} label="Playbooks ativos" value={playbooks.length} />
        <StatCard icon={Users} label="Usuários alcançados" value={totalUsers} />
        <StatCard icon={TrendingUp} label="Aplicações totais" value={totalApplies} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adoção por Playbook</CardTitle>
          <CardDescription>Quem viu e quem aplicou cada playbook.</CardDescription>
        </CardHeader>
        <CardContent>
          {playbooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum playbook cadastrado ainda. Crie playbooks no Workspace.
            </p>
          ) : (
            <div className="space-y-3">
              {playbooks.map((p: any) => {
                const stats = byPb[p.id] || { views: 0, applies: 0 };
                const adoptionRate = totalUsers > 0 ? Math.min(100, Math.round((stats.views / totalUsers) * 100)) : 0;
                return (
                  <div key={p.id} className="p-3 border rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{p.title || "Playbook"}</p>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-xs">{stats.views} views</Badge>
                        <Badge variant="default" className="text-xs">{stats.applies} aplic.</Badge>
                      </div>
                    </div>
                    <Progress value={adoptionRate} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">{adoptionRate}% do time visualizou</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
