import { Heart } from "lucide-react";
import { CommercialHRPanel } from "@/components/wmi/CommercialHRPanel";

export default function RHComercial() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <Heart className="h-5 w-5" />
          <span className="text-sm font-semibold">BPO Comercial</span>
        </div>
        <h1 className="text-3xl font-bold mt-2">RH Comercial</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Atração, formação, remuneração e retenção do time comercial.
        </p>
      </div>

      <CommercialHRPanel />
    </div>
  );
}
