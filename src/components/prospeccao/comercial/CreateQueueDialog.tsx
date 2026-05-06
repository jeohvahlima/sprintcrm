import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateQueue } from "@/hooks/useProspectingQueue";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  userId: string;
}

export function CreateQueueDialog({ open, onOpenChange, companyId, userId }: Props) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("coldcall");
  const [description, setDescription] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const create = useCreateQueue();

  useEffect(() => {
    if (!open || !companyId) return;
    (async () => {
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("company_id", companyId);
      const ids = Array.from(new Set(((roles as any[]) || []).map((r: any) => r.user_id)));
      if (ids.length === 0) { setUsers([]); return; }
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      setUsers(((profs as any[]) || []).map((p: any) => ({ id: p.id, name: p.full_name || p.email })));
    })();
  }, [open, companyId]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({
      company_id: companyId,
      created_by: userId,
      name: name.trim(),
      channel,
      description: description || undefined,
      assigned_user_ids: selectedUsers,
    });
    setName(""); setDescription(""); setSelectedUsers([]);
    onOpenChange(false);
  };

  const toggleUser = (id: string) => {
    setSelectedUsers((cur) => cur.includes(id) ? cur.filter((u) => u !== id) : [...cur, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova fila de prospecção</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cold Call SP - Janeiro" />
          </div>
          <div>
            <Label>Canal</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="coldcall">Cold Call</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>SDRs atribuídos (rodízio automático)</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
              {users.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
              ) : users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedUsers.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>Criar fila</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
