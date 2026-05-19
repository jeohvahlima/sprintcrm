import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { robustFormatPhoneNumber } from "@/utils/phoneFormatter";

interface NovaConversaDialogProps {
  onNovaConversa: (nome: string, numero: string) => void;
}

export function NovaConversaDialog({ onNovaConversa }: NovaConversaDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [numeroSemCodigo, setNumeroSemCodigo] = useState("");

  const handleSalvar = () => {
    if (!nome.trim()) {
      toast.error("Digite o nome do contato");
      return;
    }

    const numeroOriginal = numeroSemCodigo.trim();
    const digitos = numeroOriginal.replace(/\D/g, '');

    if (digitos.length < 8 || digitos.length > 15) {
      toast.error("Digite um número válido com DDI. Ex: +351 926 699 471 ou 87991426333");
      return;
    }

    const { formatted, isValid } = robustFormatPhoneNumber(numeroOriginal);
    
    if (!isValid || !formatted) {
      toast.error("Número de telefone inválido. Para outro país, informe o DDI com +. Ex: +351 926 699 471");
      return;
    }
    
    console.log('📱 [NovaConversa] Número formatado:', {
      input: numeroSemCodigo,
      digitos,
      formatado: formatted
    });
    
    onNovaConversa(nome, formatted);
    
    // Limpar e fechar
    setNome("");
    setNumeroSemCodigo("");
    setOpen(false);
  };

  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value
      .replace(/[^\d+\s().-]/g, '')
      .replace(/(?!^)\+/g, '');

    if (valor.replace(/\D/g, '').length <= 15) setNumeroSemCodigo(valor);
  };

  const formatarNumeroDisplay = (num: string) => {
    const valor = num.trim();

    if (valor.startsWith('+') || valor.replace(/\D/g, '').length > 11) {
      return num;
    }

    // Remove tudo que não é número
    const numeros = num.replace(/\D/g, '');
    
    // Formata conforme o tamanho
    if (numeros.length <= 2) {
      return numeros; // DDD
    } else if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`; // (DDD) XXXXX
    } else if (numeros.length <= 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`; // (DDD) XXXXX-XXXX
    }
    return num;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Nova conversa">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Novo Contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Contato</Label>
            <Input
              id="nome"
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numero">Número do WhatsApp</Label>
            <Input
              id="numero"
              placeholder="+351 926 699 471 ou 87991426333"
              value={formatarNumeroDisplay(numeroSemCodigo)}
              onChange={handleNumeroChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
            />
            <p className="text-xs text-muted-foreground">
              Para números internacionais, digite o DDI com +. Ex: +351 926 699 471
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar}>
            Salvar Contato
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
