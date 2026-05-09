import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useFollowUpEsteira } from "@/hooks/useFollowUpEsteira";

export function AddToEsteiraDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<"manual" | "favorite" | "cold_lead">("manual");
  const [notes, setNotes] = useState("");
  const { addEntry } = useFollowUpEsteira();

  const handleSubmit = async () => {
    if (!name && !phone) return;
    await addEntry.mutateAsync({
      contact_name: name || null,
      contact_phone: phone || null,
      contact_email: email || null,
      source,
      notes: notes || null,
    });
    setName(""); setPhone(""); setEmail(""); setNotes(""); setSource("manual");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Adicionar à esteira
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar contato à esteira de follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do contato" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@..." />
            </div>
          </div>
          <div>
            <Label>Fonte</Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className="w-full mt-1 p-2 border rounded-md bg-background"
            >
              <option value="manual">Manual</option>
              <option value="favorite">Favoritado</option>
              <option value="cold_lead">Lead frio do CRM</option>
            </select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={addEntry.isPending || (!name && !phone)}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
