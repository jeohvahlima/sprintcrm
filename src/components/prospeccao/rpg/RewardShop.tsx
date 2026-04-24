import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Gem, Gift } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string | null;
  userCoins: number;
}

export function RewardShop({ companyId, userCoins }: Props) {
  const qc = useQueryClient();
  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ["reward-shop", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospecting_rewards_shop")
        .select("*")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("cost_coins");
      if (error) throw error;
      return data || [];
    },
  });

  const redeem = async (id: string) => {
    const { error } = await supabase.rpc("redeem_shop_reward", { p_reward_id: id });
    if (error) return toast.error(error.message);
    toast.success("Resgate solicitado! Aguarde a aprovação do gestor.");
    qc.invalidateQueries({ queryKey: ["reward-shop"] });
    qc.invalidateQueries({ queryKey: ["player-profile"] });
  };

  return (
    <div className="rpg-card-magenta rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-4 h-4 rpg-neon-magenta" />
        <h3 className="rpg-text-mono text-sm uppercase tracking-wider rpg-neon-magenta">Loja de Recompensas</h3>
      </div>
      {isLoading ? (
        <div className="h-20 bg-muted/30 rounded animate-pulse" />
      ) : rewards.length === 0 ? (
        <p className="text-xs text-muted-foreground rpg-text-mono">Nenhuma recompensa cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rewards.map((r: any) => {
            const canBuy = userCoins >= r.cost_coins && (r.stock === null || r.stock > 0);
            return (
              <div key={r.id} className="p-3 rounded border border-fuchsia-500/30 bg-background/40">
                <div className="font-semibold text-sm">{r.name}</div>
                {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="rpg-text-mono text-xs flex items-center gap-1 rpg-neon-magenta">
                    <Gem className="w-3 h-3" /> {r.cost_coins}
                  </span>
                  <Button size="sm" disabled={!canBuy} onClick={() => redeem(r.id)} className="h-7 text-xs">
                    Resgatar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
