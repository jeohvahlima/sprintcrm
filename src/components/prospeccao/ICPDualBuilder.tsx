import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ICPBuilder } from "./ICPBuilder";
import { ICPIntelligenceBuilder } from "./ICPIntelligenceBuilder";
import { ICPManualText } from "./ICPManualText";
import { Settings2, Sparkles, FileText } from "lucide-react";

export function ICPDualBuilder() {
  const [tab, setTab] = useState<"manual" | "ai" | "text">("text");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-3">
      <TabsList className="grid grid-cols-3 w-full md:max-w-xl">
        <TabsTrigger value="text" className="gap-1"><FileText className="h-3.5 w-3.5" /> Manual ICP (texto)</TabsTrigger>
        <TabsTrigger value="ai" className="gap-1"><Sparkles className="h-3.5 w-3.5" /> IA Builder</TabsTrigger>
        <TabsTrigger value="manual" className="gap-1"><Settings2 className="h-3.5 w-3.5" /> Critérios</TabsTrigger>
      </TabsList>
      <TabsContent value="text">
        <ICPManualText />
      </TabsContent>
      <TabsContent value="ai">
        <ICPIntelligenceBuilder onApplied={() => setTab("manual")} />
      </TabsContent>
      <TabsContent value="manual">
        <ICPBuilder />
      </TabsContent>
    </Tabs>
  );
}
