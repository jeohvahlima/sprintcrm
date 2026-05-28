import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, History, BarChart3, PhoneCall } from 'lucide-react';
import { useCallCenter } from '@/hooks/useCallCenter';
import { CallHistory } from '@/components/discador/CallHistory';
import { SDRDashboard } from '@/components/discador/SDRDashboard';
import { SDRSpecializationPanel } from '@/components/discador/SDRSpecializationPanel';
import { StartCallFromLeadDialog } from '@/components/discador/StartCallFromLeadDialog';
import { NvoipAccountPanel } from '@/components/discador/NvoipAccountPanel';
import { NvoipNumbersPanel } from '@/components/discador/NvoipNumbersPanel';
import { Hash } from 'lucide-react';
import { KeyRound } from 'lucide-react';
import { useFloatingButtonsVisibility } from '@/hooks/useFloatingButtonsVisibility';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useWebphone } from '@/components/discador/WebphoneProvider';
import { WebphoneDialer } from '@/components/discador/WebphoneDialer';
import { toast } from 'sonner';
const Discador = () => {
  const [activeTab, setActiveTab] = useState('fazer-ligacao');
  const [showCallDialog, setShowCallDialog] = useState(false);
  const {
    callHistory,
    isLoading,
    loadCallHistory,
    getSDRMetrics
  } = useCallCenter();
  const webphone = useWebphone();
  const { dialerVisible, toggleDialer } = useFloatingButtonsVisibility();
  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  const handleStartCall = async (_leadId: string, leadName: string, phoneNumber: string) => {
    if (webphone.mode !== 'webphone' || !webphone.configured) {
      await webphone.reload();
    }
    if (webphone.mode !== 'webphone' || !webphone.configured) {
      toast.error('Configure a Conta Telefônica no modo Webphone NVOIP para ligar direto pelo CRM.');
      return;
    }
    if (webphone.regStatus !== 'registered') {
      toast.error('Aguarde o Webphone SIP conectar antes de ligar.');
      return;
    }
    webphone.call(phoneNumber, leadName);
    setShowCallDialog(false);
  };
  return <>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">​<PhoneCall className="w-8 h-8 text-primary" />
              Call Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Central de ligações Faça e Receba na  Waze Platform  
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="dialer-float" checked={dialerVisible} onCheckedChange={toggleDialer} />
            <Label htmlFor="dialer-float" className="text-sm cursor-pointer">Webphone flutuante</Label>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="fazer-ligacao" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Fazer Ligação
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="painel-sdr" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Painel SDR
            </TabsTrigger>
            <TabsTrigger value="especializacao" className="flex items-center gap-2">
              ✨ Especialização SDR
            </TabsTrigger>
            <TabsTrigger value="meus-numeros" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Meus Números
            </TabsTrigger>
            <TabsTrigger value="conta-nvoip" className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Conta Telefônica
            </TabsTrigger>
          </TabsList>

          {/* Tab: Fazer Ligação */}
          <TabsContent value="fazer-ligacao" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <WebphoneDialer onOpenContacts={() => setShowCallDialog(true)} />

              {/* Stats Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo de Hoje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ligações realizadas</span>
                    <span className="font-bold text-lg">
                      {callHistory.filter(c => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return new Date(c.call_start) >= today;
                    }).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Atendidas</span>
                    <span className="font-bold text-lg text-green-500">
                      {callHistory.filter(c => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return new Date(c.call_start) >= today && c.call_result === 'atendida';
                    }).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pendentes de anotação</span>
                    <span className="font-bold text-lg text-yellow-500">
                      {callHistory.filter(c => c.notes_required && !c.notes).length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg">Como funciona</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Clique em "Ligar para Lead" para selecionar um contato</p>
                  <p>2. A ligação será iniciada via nossa central telefônica</p>
                  <p>3. Após encerrar, preencha o resumo obrigatório</p>
                  <p>4. Acompanhe suas métricas no Painel SDR</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico">
            <CallHistory calls={callHistory} isLoading={isLoading} onRefresh={loadCallHistory} onCallLead={handleStartCall} />
          </TabsContent>

          {/* Tab: Painel SDR */}
          <TabsContent value="painel-sdr">
            <SDRDashboard getMetrics={getSDRMetrics} />
          </TabsContent>

          <TabsContent value="especializacao">
            <SDRSpecializationPanel />
          </TabsContent>

          <TabsContent value="meus-numeros">
            <NvoipNumbersPanel />
          </TabsContent>

          <TabsContent value="conta-nvoip">
            <NvoipAccountPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Start Call Dialog */}
      <StartCallFromLeadDialog open={showCallDialog} onClose={() => setShowCallDialog(false)} onStartCall={handleStartCall} />

    </>;
};
export default Discador;