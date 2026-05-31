import React from "react";
import { ChannelProspectPanel } from "@/components/prospeccao/channels/ChannelProspectPanel";

const Discador = () => {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Cold Call</h1>
        <p className="text-sm text-muted-foreground">
          Painel de prospecção por chamada — mesmo conteúdo da aba Cold Call em Máquina de Vendas.
        </p>
      </div>
      <ChannelProspectPanel channel="coldcall" />
    </div>
  );
};

export default Discador;
