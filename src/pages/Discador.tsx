import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, History, BarChart3, PhoneCall } from 'lucide-react';
import { useCallCenter } from '@/hooks/useCallCenter';
import { CallModal } from '@/components/discador/CallModal';
import { PostCallNotesDialog } from '@/components/discador/PostCallNotesDialog';
import { CallHistory } from '@/components/discador/CallHistory';
import { SDRDashboard } from '@/components/discador/SDRDashboard';
import { SDRSpecializationPanel } from '@/components/discador/SDRSpecializationPanel';
import { StartCallFromLeadDialog } from '@/components/discador/StartCallFromLeadDialog';
import { supabase } from '@/integrations/supabase/client';
import { useFloatingButtonsVisibility } from '@/hooks/useFloatingButtonsVisibility';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
const Discador = () => {
  const [activeTab, setActiveTab] = useState('fazer-ligacao');
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const {
    callState,
    callHistory,
    isLoading,
    startCall,
    endCall,
    saveCallNotes,
    toggleMute,
    loadCallHistory,
    getSDRMetrics
  } = useCallCenter();
  const { dialerVisible, toggleDialer } = useFloatingButtonsVisibility();
  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  // Handle call state changes
  useEffect(() => {
    if (callState.status === 'finalizado' && callState.isActive) {
      setShowNotesDialog(true);
    }
  }, [callState.status, callState.isActive]);
  const handleStartCall = async (leadId: string, leadName: string, phoneNumber: string) => {
    const success = await startCall(leadId, leadName, phoneNumber);
    if (success) {
      setShowCallDialog(false);
    }
  };
  const handleEndCall = () => {
    endCall();
  };
  const handleSaveNotes = async (notes: string, result: string) => {
    // Update call result first
    if (callState.callRecordId) {
      await supabase.from('call_history').update({
        call_result: result
      }).eq('id', callState.callRecordId);
    }
    const success = await saveCallNotes(notes);
    if (success) {
      setShowNotesDialog(false);
      loadCallHistory();
    }
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
          </TabsList>

          {/* Tab: Fazer Ligação */}
          <TabsContent value="fazer-ligacao" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Quick Call Card */}
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setShowCallDialog(true)}>
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Phone className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle>Ligue para Seus Contatos </CardTitle>
                  <CardDescription>
                    Selecione um lead cadastrado para iniciar uma ligação
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button className="w-full" size="lg">
                    <Phone className="w-4 h-4 mr-2" />
                    Iniciar Ligação
                  </Button>
                </CardContent>
              </Card>

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
        </Tabs>
      </div>

      {/* Start Call Dialog */}
      <StartCallFromLeadDialog open={showCallDialog} onClose={() => setShowCallDialog(false)} onStartCall={handleStartCall} />

      {/* Active Call Modal */}
      {callState.isActive && callState.status !== 'finalizado' && <CallModal open={true} onClose={() => {}} leadName={callState.leadName} phoneNumber={callState.phoneNumber} status={callState.status} duration={callState.duration} isMuted={callState.isMuted} onEndCall={handleEndCall} onToggleMute={toggleMute} />}

      {/* Post-Call Notes Dialog */}
      <PostCallNotesDialog open={showNotesDialog} leadName={callState.leadName} phoneNumber={callState.phoneNumber} duration={callState.duration} onSave={handleSaveNotes} />
    </>;
};
export default Discador;