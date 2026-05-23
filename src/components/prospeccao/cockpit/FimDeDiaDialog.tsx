import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useEndOfDayReview } from "@/hooks/useDailyCockpit";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FimDeDiaDialog({ open, onOpenChange }: Props) {
  const { review, submit } = useEndOfDayReview();
  const [focusScore, setFocusScore] = useState(3);
  const [objections, setObjections] = useState(0);
  const [meetings, setMeetings] = useState(0);
  const [difficulty, setDifficulty] = useState("");
  const [wins, setWins] = useState("");

  useEffect(() => {
    if (review) {
      setFocusScore(review.focus_score || 3);
      setObjections(review.objections_count || 0);
      setMeetings(review.meetings_count || 0);
      setDifficulty(review.biggest_difficulty || "");
      setWins(review.wins || "");
    }
  }, [review, open]);

  const handleSubmit = async () => {
    await submit.mutateAsync({
      focus_score: focusScore,
      objections_count: objections,
      meetings_count: meetings,
      biggest_difficulty: difficulty,
      wins,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Como foi seu dia?</DialogTitle>
          <DialogDescription>
            Um check rápido. Suas respostas ajudam a melhorar seu plano amanhã.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Foco hoje
            </Label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFocusScore(n)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "h-7 w-7",
                      n <= focusScore
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Objeções enfrentadas</Label>
              <Input
                type="number"
                min={0}
                value={objections}
                onChange={(e) => setObjections(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Reuniões marcadas</Label>
              <Input
                type="number"
                min={0}
                value={meetings}
                onChange={(e) => setMeetings(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Maior dificuldade</Label>
            <Textarea
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              placeholder="Onde você travou hoje?"
              rows={2}
            />
          </div>

          <div>
            <Label className="text-xs">Conquistas do dia</Label>
            <Textarea
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              placeholder="O que deu certo?"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            Salvar review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
