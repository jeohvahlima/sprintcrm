import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Wifi, WifiOff, Loader2, User } from 'lucide-react';
import { useWebphone } from './WebphoneProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const statusBadge = (status: string) => {
  switch (status) {
    case 'registered':
      return <Badge className="bg-green-600"><Wifi className="w-3 h-3 mr-1" />Conectado</Badge>;
    case 'connecting':
      return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Conectando</Badge>;
    case 'error':
      return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Erro</Badge>;
    case 'unregistered':
      return <Badge variant="outline"><WifiOff className="w-3 h-3 mr-1" />Desconectado</Badge>;
    default:
      return <Badge variant="outline">Aguardando</Badge>;
  }
};

const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
};

export const WebphoneDialer: React.FC<{ onOpenContacts?: () => void }> = ({ onOpenContacts }) => {
  const wp = useWebphone();
  const [number, setNumber] = useState('');

  const inCall = ['outgoing', 'ringing', 'active', 'failed'].includes(wp.callState);

  const handleCall = async () => {
    if (!wp.isWebphoneReady()) {
      toast.error('Aguarde o SIP conectar antes de discar.');
      return;
    }
    const digits = number.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Digite um número válido com DDD.');
      return;
    }
    try {
      await wp.call(number);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível iniciar a chamada');
    }
  };

  const dialpad = ['1','2','3','4','5','6','7','8','9','*','0','#'];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                Webphone NVOIP — Ligação Direta
              </CardTitle>
              <CardDescription>
                Áudio direto no navegador via SIP/WSS. Sem MicroSIP, sem callback.
              </CardDescription>
            </div>
            {statusBadge(wp.regStatus)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {wp.regStatus === 'error' && wp.regError && (
            <div className="text-sm text-destructive">SIP erro: {wp.regError}</div>
          )}

          <Input
            placeholder="Digite o número (DDD + número)"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="text-lg text-center tracking-wider"
            disabled={inCall}
          />

          <div className="grid grid-cols-3 gap-2">
            {dialpad.map((d) => (
              <Button
                key={d}
                variant="outline"
                className="h-12 text-lg font-semibold"
                onClick={() => setNumber((n) => n + d)}
                disabled={inCall}
              >
                {d}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setNumber('')} disabled={inCall} className="flex-1">
              Limpar
            </Button>
            {onOpenContacts && (
              <Button variant="outline" onClick={onOpenContacts} disabled={inCall} className="flex-1">
                <User className="w-4 h-4 mr-2" /> Contatos
              </Button>
            )}
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleCall}
              disabled={inCall || !wp.isWebphoneReady()}
            >
              <Phone className="w-4 h-4 mr-2" /> Ligar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* In-call modal */}
      <Dialog open={inCall} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center">Ligação em andamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-5">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{wp.remoteName || wp.remoteNumber}</p>
              <p className="text-sm text-muted-foreground">{wp.remoteNumber}</p>
              <p className={`mt-2 text-sm font-medium ${
                wp.callState === 'active' ? 'text-green-500' :
                wp.callState === 'ringing' ? 'text-blue-500' : 'text-yellow-500'
              }`}>
                {wp.callState === 'outgoing' && 'Chamando...'}
                {wp.callState === 'ringing' && 'Tocando...'}
                {wp.callState === 'active' && `Conectado · ${fmtDuration(wp.duration)}`}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                variant={wp.muted ? 'default' : 'outline'}
                onClick={() => wp.toggleMute()}
                disabled={wp.callState !== 'active'}
              >
                {wp.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              <Button size="lg" variant="destructive" onClick={() => wp.hangup()}>
                <PhoneOff className="w-5 h-5 mr-2" /> Encerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
