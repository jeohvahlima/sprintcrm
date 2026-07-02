import { useState, useRef, useCallback } from 'react';
import { Phone, PhoneCall, PhoneOff, X, Mic, MicOff, Clock, User, Delete } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCallCenter } from '@/hooks/useCallCenter';
import { useWebphone } from '@/components/discador/WebphoneProvider';
import { toast } from 'sonner';

const dialPadKeys = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

type Tab = 'teclado' | 'recentes';

export const FloatingDialerButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('teclado');
  const [phoneNumber, setPhoneNumber] = useState('');
  const webphone = useWebphone();

  // Draggable state
  const [position, setPosition] = useState({ x: 24, y: 162 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const hasMoved = useRef(false);

  const {
    callHistory,
    loadCallHistory,
  } = useCallCenter();

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = dragStartRef.current.x - e.clientX;
    const deltaY = dragStartRef.current.y - e.clientY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) hasMoved.current = true;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 60, dragStartRef.current.posX + deltaX)),
      y: Math.max(0, Math.min(window.innerHeight - 60, dragStartRef.current.posY - deltaY)),
    });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleClick = useCallback(() => {
    if (!hasMoved.current) {
      setIsOpen(prev => !prev);
      loadCallHistory();
    }
  }, [loadCallHistory]);

  const handleDigitPress = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  const handleDelete = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Digite um número');
      return;
    }
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      toast.error('Número inválido');
      return;
    }
    if (!webphone.isWebphoneReady()) {
      await webphone.reload(webphone.regStatus === 'error');
      const ready = await webphone.waitUntilRegistered();
      if (!ready) {
        toast.error('Configure a Conta Telefônica no modo Webphone NVOIP e aguarde o status Conectado.');
        return;
      }
    }
    try {
      await webphone.call(cleanNumber, 'Ligação Manual');
      setPhoneNumber('');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível iniciar a chamada');
    }
  };

  const isCallActive = ['outgoing', 'ringing', 'active'].includes(webphone.callState) || webphone.callState === 'failed';

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const recentCalls = callHistory.slice(0, 20);

  return (
    <>
      {/* Floating Button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className={`fixed z-50 h-[56px] w-[56px] rounded-full flex items-center justify-center touch-none select-none ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
        style={{
          right: `${position.x}px`,
          top: `${position.y}px`,
          transition: isDragging ? 'none' : 'transform 0.2s',
          background: isCallActive
            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            : 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
          boxShadow: isCallActive
            ? '0 4px 14px rgba(34, 197, 94, 0.4)'
            : '0 4px 14px rgba(59, 130, 246, 0.4)',
        }}
      >
        {isCallActive ? (
          <PhoneCall className="h-6 w-6 text-white animate-pulse" />
        ) : (
          <Phone className="h-6 w-6 text-white" />
        )}
        {isCallActive && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px] bg-green-500 text-white border-0">
            {formatDuration(webphone.duration)}
          </Badge>
        )}
      </button>

      {/* Webphone Popup */}
      {isOpen && (
        <div
          className="fixed z-[60] bg-background border rounded-xl shadow-2xl overflow-hidden"
          style={{
            right: `${position.x}px`,
            top: `${position.y + 64}px`,
            width: '280px',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-semibold">Webphone</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Active Call Banner */}
          {isCallActive && (
            <div className="px-3 py-2 bg-green-500/10 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-green-500 animate-pulse" />
                <div>
                  <p className="text-xs font-medium">{webphone.remoteName || webphone.remoteNumber || 'Chamada'}</p>
                  <p className="text-xs text-muted-foreground">{formatDuration(webphone.duration)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant={webphone.muted ? 'destructive' : 'outline'}
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={webphone.toggleMute}
                  disabled={webphone.callState !== 'active'}
                >
                  {webphone.muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={webphone.hangup}
                >
                  <PhoneOff className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Phone number display */}
          <div className="px-3 pt-3 pb-1">
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Digite o número..."
              className="text-center text-lg font-mono h-10 border-dashed"
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b mx-3">
            <button
              onClick={() => setActiveTab('teclado')}
              className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === 'teclado' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Teclado
            </button>
            <button
              onClick={() => setActiveTab('recentes')}
              className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === 'recentes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Recentes
            </button>
          </div>

          {/* Content */}
          {activeTab === 'teclado' ? (
            <div className="p-3">
              {/* Dial pad */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {dialPadKeys.map(({ digit, letters }) => (
                  <button
                    key={digit}
                    onClick={() => handleDigitPress(digit)}
                    className="flex flex-col items-center justify-center h-12 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
                  >
                    <span className="text-lg font-semibold leading-none">{digit}</span>
                    {letters && <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{letters}</span>}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={handleDelete}
                  disabled={!phoneNumber}
                >
                  <Delete className="h-5 w-5" />
                </Button>
                <Button
                  className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600 text-white"
                  size="icon"
                  onClick={handleCall}
                  disabled={isCallActive}
                >
                  <Phone className="h-5 w-5" />
                </Button>
                <div className="w-10" /> {/* Spacer */}
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[280px]">
              <div className="divide-y">
                {recentCalls.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-xs">Nenhuma ligação recente</p>
                  </div>
                ) : (
                  recentCalls.map(call => (
                    <button
                      key={call.id}
                      onClick={() => {
                        setPhoneNumber(call.phone_number);
                        setActiveTab('teclado');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{call.lead_name || call.phone_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(call.call_start).toLocaleDateString('pt-BR')} · {call.duration_seconds ? formatDuration(call.duration_seconds) : '--:--'}
                        </p>
                      </div>
                      <Phone className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

    </>
  );
};
