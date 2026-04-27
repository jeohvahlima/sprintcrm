import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, TrendingUp, Users, Library, Sparkles } from "lucide-react";
import { usePlaybookAdoptionStats } from "@/hooks/useProcessIntel";

const CATEGORY_LABELS: Record<string, string> = {
  cold_call: "Cold Call",
  objections: "Objeções",
  cadence: "Cadência",
  sdr: "SDR",
  closer: "Closer",
  discovery: "Discovery",
  fechamento: "Fechamento",
  custom: "Customizado",
};

const CATEGORY_COLORS: Record<string, string> = {
  cold_call: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  objections: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  cadence: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  sdr: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  custom: "bg-muted text-muted-foreground border-border",
};

export function PlaybookAdoptionDashboard() {
  const { data, isLoading } = usePlaybookAdoptionStats();

  if (isLoading) return <Skeleton className="h-64" />;

  const playbooks = data?.playbooks || [];
  const templates = (data as any)?.templates || [];
  const customPlaybooks = (data as any)?.customPlaybooks || [];
  const byPb = data?.byPlaybook || {};
  const totalUsers = new Set((data?.adoption || []).map((a: any) => a.user_id)).size;
  const totalApplies = (data?.adoption || []).reduce((s: number, a: any) => s + (a.applied_count || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Library} label="Templates oficiais" value={templates.length} accent="text-primary" />
        <StatCard icon={BookOpen} label="Customizados" value={customPlaybooks.length} />
        <StatCard icon={Users} label="Usuários alcançados" value={totalUsers} />
        <StatCard icon={TrendingUp} label="Aplicações totais" value={totalApplies} />
      </div>

      <Tabs defaultValue="all" className="space-y-3">
        <TabsList>
          <TabsTrigger value="all">Todos ({playbooks.length})</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1">
            <Sparkles className="h-3 w-3" /> Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="custom">Customizados ({customPlaybooks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PlaybookList items={playbooks} byPb={byPb} totalUsers={totalUsers} />
        </TabsContent>
        <TabsContent value="templates">
          <PlaybookList
            items={playbooks.filter((p: any) => p.source === "template")}
            byPb={byPb}
            totalUsers={totalUsers}
            emptyMsg="Nenhum template carregado."
          />
        </TabsContent>
        <TabsContent value="custom">
          <PlaybookList
            items={playbooks.filter((p: any) => p.source === "custom")}
            byPb={byPb}
            totalUsers={totalUsers}
            emptyMsg="Nenhum playbook customizado ainda. Crie no Workspace."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlaybookList({ items, byPb, totalUsers, emptyMsg }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Adoção por Playbook</CardTitle>
        <CardDescription>Quem viu e quem aplicou cada playbook.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {emptyMsg || "Nenhum playbook encontrado."}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((p: any) => {
              const stats = byPb[p.id] || { views: 0, applies: 0 };
              const adoptionRate = totalUsers > 0 ? Math.min(100, Math.round((stats.views / totalUsers) * 100)) : 0;
              const catLabel = CATEGORY_LABELS[p.category] || p.category;
              const catColor = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.custom;
              return (
                <div key={p.id} className="p-3 border rounded-lg space-y-2 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className="text-lg leading-none">{p.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${catColor}`}>
                            {catLabel}
                          </Badge>
                          {p.source === "template" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Template
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="secondary" className="text-xs">{stats.views} views</Badge>
                      <Badge variant="default" className="text-xs">{stats.applies} aplic.</Badge>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <Progress value={adoptionRate} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">{adoptionRate}% do time visualizou</p>
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

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-3 w-3 ${accent || ""}`} /> {label}
        </div>
        <p className={`text-2xl font-bold mt-1 ${accent || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
