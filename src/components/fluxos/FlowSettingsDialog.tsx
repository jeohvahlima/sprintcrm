import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Filter, Gauge, Shield, X, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FlowSettings {
  schedule?: {
    enabled: boolean;
    days: string[];
    startTime: string;
    endTime: string;
    outOfHoursMessage?: string;
  };
  filters?: {
    tags?: string[];
    funnels?: string[];
    stages?: string[];
    excludeTags?: string[];
  };
  limits?: {
    maxExecutionsPerDay?: number;
    maxExecutionsPerLead?: number;
    cooldownMinutes?: number;
  };
  notifications?: {
    onError: boolean;
    onComplete: boolean;
    notifyEmail?: string;
  };
}

interface FlowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: FlowSettings;
  onSave: (settings: FlowSettings) => void;
}

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Seg' },
  { id: 'tuesday', label: 'Ter' },
  { id: 'wednesday', label: 'Qua' },
  { id: 'thursday', label: 'Qui' },
  { id: 'friday', label: 'Sex' },
  { id: 'saturday', label: 'Sáb' },
  { id: 'sunday', label: 'Dom' },
];

export function FlowSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: FlowSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<FlowSettings>(settings);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableFunnels, setAvailableFunnels] = useState<{ id: string; nome: string }[]>([]);
  const [availableStages, setAvailableStages] = useState<{ id: string; nome: string; funil_id: string }[]>([]);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      loadTagsAndFunnels();
    }
  }, [open]);

  const loadTagsAndFunnels = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userRole } = await supabase
      .from('user_roles' as any)
      .select('company_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const companyId = (userRole as any)?.company_id;
    if (!companyId) return;

    const [tagsRes, funisRes, etapasRes] = await Promise.all([
      supabase.from('company_tags').select('tag_name').eq('company_id', companyId),
      supabase.from('funis').select('id, nome').eq('company_id', companyId).order('nome'),
      supabase.from('etapas').select('id, nome, funil_id').eq('company_id', companyId).order('posicao'),
    ]);

    if (tagsRes.data) setAvailableTags(tagsRes.data.map(t => t.tag_name));
    if (funisRes.data) setAvailableFunnels(funisRes.data);
    if (etapasRes.data) setAvailableStages(etapasRes.data);
  };

  const updateSchedule = (key: string, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      schedule: {
        enabled: prev.schedule?.enabled || false,
        days: prev.schedule?.days || [],
        startTime: prev.schedule?.startTime || '09:00',
        endTime: prev.schedule?.endTime || '18:00',
        [key]: value,
      },
    }));
  };

  const toggleDay = (dayId: string) => {
    const currentDays = localSettings.schedule?.days || [];
    const newDays = currentDays.includes(dayId)
      ? currentDays.filter((d) => d !== dayId)
      : [...currentDays, dayId];
    updateSchedule('days', newDays);
  };

  const updateLimits = (key: string, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      limits: { ...prev.limits, [key]: value },
    }));
  };

  const toggleFilterItem = (filterKey: 'tags' | 'excludeTags' | 'funnels' | 'stages', item: string) => {
    setLocalSettings((prev) => {
      const current = prev.filters?.[filterKey] || [];
      const newValues = current.includes(item)
        ? current.filter((v) => v !== item)
        : [...current, item];
      return { ...prev, filters: { ...prev.filters, [filterKey]: newValues } };
    });
  };

  const updateNotifications = (key: string, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      notifications: {
        onError: prev.notifications?.onError || false,
        onComplete: prev.notifications?.onComplete || false,
        ...prev.notifications,
        [key]: value,
      },
    }));
  };

  const selectedTags = localSettings.filters?.tags || [];
  const selectedExcludeTags = localSettings.filters?.excludeTags || [];
  const selectedFunnels = localSettings.filters?.funnels || [];
  const selectedStages = localSettings.filters?.stages || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Regras de Ativação do Fluxo
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="schedule" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="schedule" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Horários
            </TabsTrigger>
            <TabsTrigger value="filters" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Filtros
            </TabsTrigger>
            <TabsTrigger value="limits" className="flex items-center gap-1">
              <Gauge className="h-4 w-4" />
              Limites
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Alertas
            </TabsTrigger>
          </TabsList>

          {/* SCHEDULE TAB */}
          <TabsContent value="schedule" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Horário de Funcionamento</CardTitle>
                    <CardDescription>Defina quando o fluxo pode ser executado</CardDescription>
                  </div>
                  <Switch
                    checked={localSettings.schedule?.enabled || false}
                    onCheckedChange={(v) => updateSchedule('enabled', v)}
                  />
                </div>
              </CardHeader>
              {localSettings.schedule?.enabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dias da Semana</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.id}
                          type="button"
                          size="sm"
                          variant={localSettings.schedule?.days?.includes(day.id) ? 'default' : 'outline'}
                          onClick={() => toggleDay(day.id)}
                          className="w-12"
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora de Início</Label>
                      <Input
                        type="time"
                        value={localSettings.schedule?.startTime || '09:00'}
                        onChange={(e) => updateSchedule('startTime', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora de Término</Label>
                      <Input
                        type="time"
                        value={localSettings.schedule?.endTime || '18:00'}
                        onChange={(e) => updateSchedule('endTime', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem fora do horário</Label>
                    <Input
                      placeholder="Olá! Nosso horário de atendimento é de segunda a sexta, das 09h às 18h."
                      value={localSettings.schedule?.outOfHoursMessage || ''}
                      onChange={(e) => updateSchedule('outOfHoursMessage', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      📩 Esta mensagem será enviada automaticamente fora do horário
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* FILTERS TAB */}
          <TabsContent value="filters" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filtros de Execução</CardTitle>
                <CardDescription>Defina quais leads/conversas podem acionar este fluxo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tags para incluir */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Apenas leads com estas tags</Label>
                  <p className="text-xs text-muted-foreground">A URA só responderá leads que possuem essas tags</p>
                  {availableTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30 max-h-32 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                          className="cursor-pointer select-none transition-colors"
                          onClick={() => toggleFilterItem('tags', tag)}
                        >
                          {tag}
                          {selectedTags.includes(tag) && <X className="ml-1 h-3 w-3" />}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhuma tag cadastrada</p>
                  )}
                  {selectedTags.length > 0 && (
                    <p className="text-xs text-primary">✅ {selectedTags.length} tag(s) selecionada(s)</p>
                  )}
                </div>

                {/* Tags para excluir */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Excluir leads com estas tags</Label>
                  <p className="text-xs text-muted-foreground">A URA NÃO responderá leads que possuem essas tags</p>
                  {availableTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30 max-h-32 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedExcludeTags.includes(tag) ? 'destructive' : 'outline'}
                          className="cursor-pointer select-none transition-colors"
                          onClick={() => toggleFilterItem('excludeTags', tag)}
                        >
                          {tag}
                          {selectedExcludeTags.includes(tag) && <X className="ml-1 h-3 w-3" />}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhuma tag cadastrada</p>
                  )}
                  {selectedExcludeTags.length > 0 && (
                    <p className="text-xs text-destructive">🚫 {selectedExcludeTags.length} tag(s) excluída(s)</p>
                  )}
                </div>

                {/* Funis */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Apenas leads nestes funis</Label>
                  <p className="text-xs text-muted-foreground">A URA só ativará para leads que estão nesses funis</p>
                  {availableFunnels.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30 max-h-32 overflow-y-auto">
                      {availableFunnels.map((funil) => (
                        <Badge
                          key={funil.id}
                          variant={selectedFunnels.includes(funil.id) ? 'default' : 'outline'}
                          className="cursor-pointer select-none transition-colors"
                          onClick={() => toggleFilterItem('funnels', funil.id)}
                        >
                          {funil.nome}
                          {selectedFunnels.includes(funil.id) && <X className="ml-1 h-3 w-3" />}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhum funil cadastrado</p>
                  )}
                  {selectedFunnels.length > 0 && (
                    <p className="text-xs text-primary">✅ {selectedFunnels.length} funil(is) selecionado(s)</p>
                  )}
                </div>

                {/* Etapas */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Apenas leads nestas etapas</Label>
                  <p className="text-xs text-muted-foreground">Filtre por etapas específicas dos funis</p>
                  {availableStages.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30 max-h-40 overflow-y-auto">
                      {availableStages.map((etapa) => {
                        const funil = availableFunnels.find(f => f.id === etapa.funil_id);
                        return (
                          <Badge
                            key={etapa.id}
                            variant={selectedStages.includes(etapa.id) ? 'default' : 'outline'}
                            className="cursor-pointer select-none transition-colors"
                            onClick={() => toggleFilterItem('stages', etapa.id)}
                          >
                            {funil ? `${funil.nome} → ` : ''}{etapa.nome}
                            {selectedStages.includes(etapa.id) && <X className="ml-1 h-3 w-3" />}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhuma etapa cadastrada</p>
                  )}
                  {selectedStages.length > 0 && (
                    <p className="text-xs text-primary">✅ {selectedStages.length} etapa(s) selecionada(s)</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LIMITS TAB */}
          <TabsContent value="limits" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Limites de Execução</CardTitle>
                <CardDescription>Evite execuções excessivas e spam</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Máximo de execuções por dia</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={localSettings.limits?.maxExecutionsPerDay || ''}
                    onChange={(e) => updateLimits('maxExecutionsPerDay', parseInt(e.target.value) || undefined)}
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio para ilimitado</p>
                </div>
                <div className="space-y-2">
                  <Label>Máximo de execuções por lead</Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={localSettings.limits?.maxExecutionsPerLead || ''}
                    onChange={(e) => updateLimits('maxExecutionsPerLead', parseInt(e.target.value) || undefined)}
                  />
                  <p className="text-xs text-muted-foreground">Quantas vezes este fluxo pode rodar para o mesmo lead</p>
                </div>
                <div className="space-y-2">
                  <Label>Intervalo mínimo entre execuções (minutos)</Label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={localSettings.limits?.cooldownMinutes || ''}
                    onChange={(e) => updateLimits('cooldownMinutes', parseInt(e.target.value) || undefined)}
                  />
                  <p className="text-xs text-muted-foreground">Tempo mínimo antes de executar novamente para o mesmo lead</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICATIONS TAB */}
          <TabsContent value="notifications" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notificações</CardTitle>
                <CardDescription>Receba alertas sobre a execução do fluxo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificar em caso de erro</Label>
                    <p className="text-xs text-muted-foreground">Receba um alerta quando o fluxo falhar</p>
                  </div>
                  <Switch
                    checked={localSettings.notifications?.onError || false}
                    onCheckedChange={(v) => updateNotifications('onError', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificar ao completar</Label>
                    <p className="text-xs text-muted-foreground">Receba um resumo diário das execuções</p>
                  </div>
                  <Switch
                    checked={localSettings.notifications?.onComplete || false}
                    onCheckedChange={(v) => updateNotifications('onComplete', v)}
                  />
                </div>
                {(localSettings.notifications?.onError || localSettings.notifications?.onComplete) && (
                  <div className="space-y-2">
                    <Label>Email para notificações</Label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={localSettings.notifications?.notifyEmail || ''}
                      onChange={(e) => updateNotifications('notifyEmail', e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(localSettings)}>
            Salvar Regras
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
