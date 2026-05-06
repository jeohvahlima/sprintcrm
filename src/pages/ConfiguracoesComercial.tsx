import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Users, Target, Award, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useSalesTeams, useUpdateCommercialRole } from "@/hooks/useSalesTeams";
import { useCompanyGoals } from "@/hooks/useCommercialGoals";
import { useTeamPerformance } from "@/hooks/useTeamPerformance";


const METRICS = [
  { value: "leads_prospected", label: "Leads prospectados" },
  { value: "calls", label: "Ligações realizadas" },
  { value: "responses", label: "Respostas recebidas" },
  { value: "opportunities", label: "Oportunidades" },
  { value: "meetings_scheduled", label: "Reuniões agendadas" },
  { value: "sales_closed", label: "Vendas fechadas" },
  { value: "gross_value", label: "Receita bruta (R$)" },
];

const ROLES = [
  { value: "sdr", label: "SDR — Pré-vendas" },
  { value: "closer", label: "Closer — Fecha vendas" },
  { value: "hybrid", label: "Híbrido — SDR + Closer" },
  { value: "manager", label: "Gestor Comercial" },
];

export default function ConfiguracoesComercial() {
  const teams = useSalesTeams();
  const goals = useCompanyGoals();
  const { data: members = [] } = useTeamPerformance("monthly");
  const updateRole = useUpdateCommercialRole();

  const [teamForm, setTeamForm] = useState({ name: "", description: "", color: "#7a3cff" });
  const [goalForm, setGoalForm] = useState({
    scope: "role" as "user" | "team" | "role" | "company",
    role_target: "sdr",
    user_id: "",
    team_id: "",
    period: "daily",
    metric: "leads_prospected",
    target_value: 50,
  });

  const handleCreateTeam = async () => {
    if (!teamForm.name) return toast.error("Informe o nome do time");
    await teams.create.mutateAsync(teamForm);
    setTeamForm({ name: "", description: "", color: "#7a3cff" });
    toast.success("Time criado");
  };

  const handleCreateGoal = async () => {
    const payload: any = { ...goalForm };
    if (payload.scope !== "user") payload.user_id = null;
    if (payload.scope !== "team") payload.team_id = null;
    if (payload.scope !== "role") payload.role_target = null;
    await goals.create.mutateAsync(payload);
    toast.success("Meta criada");
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" /> Configuração Comercial
        </h1>
        <p className="text-sm text-muted-foreground">
          Estruture seu time de vendas: defina papéis (SDR/Closer), times e metas diárias.
        </p>
      </div>

      <Tabs defaultValue="papeis">
        <TabsList>
          <TabsTrigger value="papeis"><Users className="h-4 w-4 mr-1" /> Papéis</TabsTrigger>
          <TabsTrigger value="times"><Award className="h-4 w-4 mr-1" /> Times</TabsTrigger>
          <TabsTrigger value="metas"><Target className="h-4 w-4 mr-1" /> Metas</TabsTrigger>
        </TabsList>

        {/* PAPÉIS */}
        <TabsContent value="papeis" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Atribuir papel comercial</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atendente</TableHead>
                    <TableHead>Papel atual</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Comissão p/ venda (R$)</TableHead>
                    <TableHead className="w-[180px]">Definir papel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum atendente encontrado.
                    </TableCell></TableRow>
                  )}
                  {members.map((m: any) => (
                    <RoleRow
                      key={m.user_id}
                      member={m}
                      teams={teams.list.data || []}
                      onUpdate={(payload) => updateRole.mutateAsync({ user_id: m.user_id, ...payload })}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIMES */}
        <TabsContent value="times" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Criar novo time</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={teamForm.name} onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Squad Hunter" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input value={teamForm.description} onChange={(e) => setTeamForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input type="color" value={teamForm.color} onChange={(e) => setTeamForm((f) => ({ ...f, color: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleCreateTeam}><Plus className="h-4 w-4 mr-1" /> Criar time</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Times cadastrados</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(teams.list.data || []).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                      <div>
                        <div className="font-medium">{t.name}</div>
                        {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => teams.remove.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(teams.list.data || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum time criado ainda.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* METAS */}
        <TabsContent value="metas" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Definir nova meta</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Aplicar para</Label>
                  <Select value={goalForm.scope} onValueChange={(v: any) => setGoalForm((f) => ({ ...f, scope: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="role">Por papel (SDR / Closer)</SelectItem>
                      <SelectItem value="team">Time específico</SelectItem>
                      <SelectItem value="user">Atendente individual</SelectItem>
                      <SelectItem value="company">Empresa toda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {goalForm.scope === "role" && (
                  <div>
                    <Label>Papel</Label>
                    <Select value={goalForm.role_target} onValueChange={(v) => setGoalForm((f) => ({ ...f, role_target: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {goalForm.scope === "team" && (
                  <div>
                    <Label>Time</Label>
                    <Select value={goalForm.team_id} onValueChange={(v) => setGoalForm((f) => ({ ...f, team_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(teams.list.data || []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {goalForm.scope === "user" && (
                  <div>
                    <Label>Atendente</Label>
                    <Select value={goalForm.user_id} onValueChange={(v) => setGoalForm((f) => ({ ...f, user_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.user_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Período</Label>
                  <Select value={goalForm.period} onValueChange={(v) => setGoalForm((f) => ({ ...f, period: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>KPI</Label>
                  <Select value={goalForm.metric} onValueChange={(v) => setGoalForm((f) => ({ ...f, metric: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Meta (valor alvo)</Label>
                  <Input type="number" min="0" value={goalForm.target_value}
                    onChange={(e) => setGoalForm((f) => ({ ...f, target_value: Number(e.target.value) }))} />
                </div>
              </div>
              <Button onClick={handleCreateGoal}><Plus className="h-4 w-4 mr-1" /> Criar meta</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Metas ativas</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>KPI</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(goals.list.data || []).map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Badge variant="outline">{g.scope}</Badge>
                        {g.role_target && <span className="ml-2 text-xs">({g.role_target})</span>}
                      </TableCell>
                      <TableCell>{g.period}</TableCell>
                      <TableCell>{METRICS.find((m) => m.value === g.metric)?.label || g.metric}</TableCell>
                      <TableCell className="font-semibold">
                        {g.metric === "gross_value" ? `R$ ${Number(g.target_value).toLocaleString("pt-BR")}` : g.target_value}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => goals.remove.mutate(g.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(goals.list.data || []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Nenhuma meta criada. Defina ao menos uma meta diária por papel para ativar o HUD do SDR.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RoleRow({ member, teams, onUpdate }: any) {
  const [role, setRole] = useState(member.commercial_role || "sdr");
  const [teamId, setTeamId] = useState(member.team_id || "");
  const [commission, setCommission] = useState("0");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate({ commercial_role: role, team_id: teamId || null, commission_per_sale: Number(commission) });
      toast.success("Atualizado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{member.user_name}</TableCell>
      <TableCell><Badge variant="outline">{member.commercial_role || "—"}</Badge></TableCell>
      <TableCell className="text-xs text-muted-foreground">{member.team_name || "—"}</TableCell>
      <TableCell>
        <Input className="w-24 h-8" type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={teamId || "none"} onValueChange={(v) => setTeamId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Time" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem time</SelectItem>
              {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={save} disabled={saving}>OK</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
