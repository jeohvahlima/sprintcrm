import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, User } from 'lucide-react';
import { useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Lazy import to avoid circular dep
import { useWebphone } from './WebphoneProvider';

export const IncomingCallPopup: React.FC = () => {
  const wp = useWebphone();
  const [leadName, setLeadName] = useState<string | null>(null);

  const isIncoming = wp.callState === 'incoming';

  useEffect(() => {
    if (!isIncoming || !wp.remoteNumber) return;
    (async () => {
      try {
        const digits = wp.remoteNumber.replace(/\D/g, '').slice(-11);
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data: ur } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', u.user.id)
          .maybeSingle();
        if (!ur?.company_id) return;
        const { data } = await supabase
          .from('leads')
          .select('name')
          .eq('company_id', ur.company_id)
          .or(`telefone.ilike.%${digits}%,phone.ilike.%${digits}%`)
          .limit(1)
          .maybeSingle();
        if (data?.name) setLeadName(data.name);
      } catch {}
    })();
  }, [isIncoming, wp.remoteNumber]);

  if (!isIncoming) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center">Chamada recebida</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6 space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <User className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{leadName || wp.remoteName || 'Desconhecido'}</p>
            <p className="text-sm text-muted-foreground">{wp.remoteNumber}</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button size="lg" variant="destructive" onClick={() => wp.reject()}>
              <PhoneOff className="w-5 h-5 mr-2" />
              Recusar
            </Button>
            <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={() => wp.answer()}>
              <Phone className="w-5 h-5 mr-2" />
              Atender
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
