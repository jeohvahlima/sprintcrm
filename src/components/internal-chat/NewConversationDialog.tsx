import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Loader2, Users, User } from 'lucide-react';
import { toast } from 'sonner';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
  createConversation: (
    participantIds: string[],
    isGroup: boolean,
    name?: string
  ) => Promise<string | null>;
}

export const NewConversationDialog = ({
  open,
  onOpenChange,
  onCreated,
  createConversation
}: NewConversationDialogProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const { getOtherMembers, loading: loadingMembers } = useTeamMembers();

  const otherMembers = getOtherMembers();

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }

    if (isGroup && !groupName.trim()) {
      toast.error('Digite um nome para o grupo');
      return;
    }

    setCreating(true);
    try {
      const conversationId = await createConversation(
        selectedUsers,
        isGroup,
        isGroup ? groupName.trim() : undefined
      );

      if (conversationId) {
        toast.success('Conversa criada!');
        onCreated(conversationId);
        resetForm();
      } else {
        toast.error('Erro ao criar conversa');
      }
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedUsers([]);
    setIsGroup(false);
    setGroupName('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md z-[70]">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="isGroup"
              checked={isGroup}
              onCheckedChange={(checked) => setIsGroup(checked === true)}
            />
            <Label htmlFor="isGroup" className="flex items-center gap-2 cursor-pointer">
              <Users className="h-4 w-4" />
              Criar grupo
            </Label>
          </div>

          {/* Group name input */}
          {isGroup && (
            <div className="space-y-2">
              <Label htmlFor="groupName">Nome do grupo</Label>
              <Input
                id="groupName"
                placeholder="Ex: Equipe de Vendas"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
          )}

          {/* User selection */}
          <div className="space-y-2">
            <Label>
              {isGroup ? 'Selecione os participantes' : 'Selecione um usuário'}
            </Label>
            
            {loadingMembers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : otherMembers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum outro usuário na empresa
              </p>
            ) : (
              <ScrollArea className="h-[240px] border rounded-lg">
                <div className="divide-y">
                  {otherMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => {
                        if (isGroup) {
                          handleToggleUser(member.id);
                        } else {
                          setSelectedUsers([member.id]);
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left ${
                        selectedUsers.includes(member.id) ? 'bg-accent' : ''
                      }`}
                    >
                      {isGroup && (
                        <Checkbox
                          checked={selectedUsers.includes(member.id)}
                          className="pointer-events-none"
                        />
                      )}
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>
                      {!isGroup && selectedUsers.includes(member.id) && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || selectedUsers.length === 0}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  {isGroup ? <Users className="h-4 w-4 mr-2" /> : <User className="h-4 w-4 mr-2" />}
                  {isGroup ? 'Criar Grupo' : 'Iniciar Conversa'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
