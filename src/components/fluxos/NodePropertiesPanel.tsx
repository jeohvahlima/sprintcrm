import { Node } from 'reactflow';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings2, Upload, Trash2, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface NodePropertiesPanelProps {
  selectedNode: Node | null;
  onUpdate: (node: Node) => void;
}

export function NodePropertiesPanel({ selectedNode, onUpdate }: NodePropertiesPanelProps) {
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchTags = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles' as any)
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const companyId = (userRole as any)?.company_id;
      if (!companyId) return;

      const { data: leads } = await supabase
        .from('leads')
        .select('tags')
        .eq('company_id', companyId)
        .not('tags', 'is', null);

      if (leads) {
        const allTags = new Set<string>();
        leads.forEach((lead: any) => {
          if (Array.isArray(lead.tags)) {
            lead.tags.forEach((t: string) => allTags.add(t));
          }
        });
        setAvailableTags(Array.from(allTags).sort());
      }
    };
    fetchTags();
  }, []);

  if (!selectedNode) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Propriedades
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Settings2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Selecione um componente no canvas para configurá-lo
            </p>
          </div>
        </div>
      </div>
    );
  }

  const updateNodeData = (key: string, value: any) => {
    const updatedNode = {
      ...selectedNode,
      data: { ...selectedNode.data, [key]: value },
    };
    onUpdate(updatedNode);
  };

  const stopPropagation = (e: React.KeyboardEvent | React.FocusEvent) => {
    e.stopPropagation();
  };

  const inputProps = {
    onFocus: stopPropagation,
    onKeyDown: stopPropagation,
    onKeyUp: stopPropagation,
    onKeyPress: stopPropagation,
  };


  const renderProperties = () => {
    switch (selectedNode.type) {
      case 'trigger':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Gatilho</Label>
              <Select 
                value={selectedNode.data.triggerType} 
                onValueChange={(v) => updateNodeData('triggerType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="nova_mensagem">📩 Nova mensagem recebida</SelectItem>
                  <SelectItem value="novo_lead">👤 Novo lead criado</SelectItem>
                  <SelectItem value="lead_movido">📊 Lead movido no funil</SelectItem>
                  <SelectItem value="horario">⏰ Em horário específico</SelectItem>
                  <SelectItem value="webhook">🔗 Webhook recebido</SelectItem>
                  <SelectItem value="tag_added">🏷️ Tag adicionada</SelectItem>
                  <SelectItem value="compromisso">📅 Compromisso criado</SelectItem>
                  <SelectItem value="palavra_chave">#️⃣ Palavra-chave recebida</SelectItem>
                  <SelectItem value="comentario_instagram">📸 Comentário no Instagram</SelectItem>
                  <SelectItem value="novo_seguidor_instagram">➕ Novo seguidor (interagiu)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Canais onde o gatilho é válido */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Canais</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'whatsapp', label: '💬 WhatsApp' },
                  { id: 'instagram_direct', label: '📸 Instagram Direct' },
                  { id: 'instagram_comment', label: '💭 Comentário Instagram' },
                ].map((c) => {
                  const canais: string[] = selectedNode.data.canais || ['whatsapp'];
                  const active = canais.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? canais.filter((x) => x !== c.id)
                          : [...canais, c.id];
                        updateNodeData('canais', next.length ? next : ['whatsapp']);
                      }}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        active
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">Selecione em quais canais este gatilho deve ser ativado.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Nova mensagem WhatsApp"
                {...inputProps}
              />
            </div>
            {selectedNode.data.triggerType === 'horario' && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Horário (HH:MM)</Label>
                <Input
                  type="time"
                  value={selectedNode.data.scheduleTime || ''}
                  onChange={(e) => updateNodeData('scheduleTime', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  {...inputProps}
                />
              </div>
            )}
            {selectedNode.data.triggerType === 'tag_added' && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Tag Específica</Label>
                <Input
                  value={selectedNode.data.tagName || ''}
                  onChange={(e) => updateNodeData('tagName', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Nome da tag"
                  {...inputProps}
                />
              </div>
            )}
            {selectedNode.data.triggerType === 'palavra_chave' && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Palavra-Chave</Label>
                <Input
                  value={selectedNode.data.keyword || ''}
                  onChange={(e) => updateNodeData('keyword', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Ex: teste, oi, menu"
                  {...inputProps}
                />
                <p className="text-xs text-slate-500">O fluxo será ativado quando a mensagem contiver esta palavra</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Descrição</Label>
              <Textarea
                value={selectedNode.data.description || ''}
                onChange={(e) => updateNodeData('description', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Descreva quando este gatilho será acionado..."
                rows={3}
                {...inputProps}
              />
            </div>
          </>
        );

      case 'action':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Ação</Label>
              <Select 
                value={selectedNode.data.actionType} 
                onValueChange={(v) => updateNodeData('actionType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="enviar_mensagem">💬 Enviar mensagem</SelectItem>
                  <SelectItem value="whatsapp">📱 Enviar WhatsApp</SelectItem>
                  <SelectItem value="instagram">📸 Enviar Instagram</SelectItem>
                  <SelectItem value="email">📧 Enviar Email</SelectItem>
                  <SelectItem value="criar_lead">👤 Criar lead</SelectItem>
                  <SelectItem value="criar_tarefa">📋 Criar tarefa</SelectItem>
                  <SelectItem value="mover_funil">📊 Mover no funil</SelectItem>
                  <SelectItem value="adicionar_tag">🏷️ Adicionar tag</SelectItem>
                  <SelectItem value="atribuir_responsavel">👥 Atribuir responsável</SelectItem>
                  <SelectItem value="agendar_compromisso">📅 Agendar compromisso</SelectItem>
                  <SelectItem value="notificar_usuario">🔔 Notificar usuário</SelectItem>
                  <SelectItem value="adicionar_nota">📝 Adicionar nota</SelectItem>
                  <SelectItem value="webhook">🌐 Chamar Webhook</SelectItem>
                  <SelectItem value="api">🔌 API Externa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Enviar mensagem de boas-vindas"
                {...inputProps}
              />
            </div>
            {['enviar_mensagem', 'whatsapp', 'instagram'].includes(selectedNode.data.actionType) && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Mensagem</Label>
                <Textarea
                  value={selectedNode.data.message || ''}
                  onChange={(e) => updateNodeData('message', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                  placeholder="Use {nome} para personalizar..."
                  rows={4}
                  {...inputProps}
                />
                <p className="text-[10px] text-slate-500">
                  Variáveis: {'{nome}'}, {'{telefone}'}, {'{email}'}, {'{empresa}'}
                </p>
              </div>
            )}
            {selectedNode.data.actionType === 'adicionar_tag' && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Nome da Tag</Label>
                <Input
                  value={selectedNode.data.tagName || ''}
                  onChange={(e) => updateNodeData('tagName', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Ex: cliente-vip"
                  {...inputProps}
                />
              </div>
            )}
            {selectedNode.data.actionType === 'webhook' && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">URL do Webhook</Label>
                  <Input
                    value={selectedNode.data.webhookUrl || ''}
                    onChange={(e) => updateNodeData('webhookUrl', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="https://..."
                    {...inputProps}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">Método HTTP</Label>
                  <Select 
                    value={selectedNode.data.httpMethod || 'POST'} 
                    onValueChange={(v) => updateNodeData('httpMethod', v)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </>
        );

      case 'condition':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Condição</Label>
              <Select 
                value={selectedNode.data.conditionType} 
                onValueChange={(v) => updateNodeData('conditionType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="tag">🏷️ Verificar tag</SelectItem>
                  <SelectItem value="etapa">📊 Verificar etapa</SelectItem>
                  <SelectItem value="horario">⏰ Verificar horário</SelectItem>
                  <SelectItem value="palavra_chave">🔤 Palavra-chave</SelectItem>
                  <SelectItem value="filtro">🔍 Filtro avançado</SelectItem>
                  <SelectItem value="dia_semana">📅 Dia da semana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Cliente tem tag VIP?"
                {...inputProps}
              />
            </div>
            {selectedNode.data.conditionType === 'tag' ? (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Tag a Verificar</Label>
                <Select
                  value={selectedNode.data.checkValue || ''}
                  onValueChange={(v) => updateNodeData('checkValue', v)}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Selecione uma tag" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        🏷️ {tag}
                      </SelectItem>
                    ))}
                    {availableTags.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500">Nenhuma tag encontrada</div>
                    )}
                  </SelectContent>
                </Select>
                {selectedNode.data.checkValue && (
                  <Badge variant="secondary" className="bg-violet-500/20 text-violet-300 border-violet-500/30 gap-1">
                    🏷️ {selectedNode.data.checkValue}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => updateNodeData('checkValue', '')} />
                  </Badge>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Valor a Verificar</Label>
                <Input
                  value={selectedNode.data.checkValue || ''}
                  onChange={(e) => updateNodeData('checkValue', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Ex: VIP, orçamento, 09:00-18:00"
                  {...inputProps}
                />
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              Se o lead tiver a tag → Saída verde (SIM) = fluxo para / Saída vermelha (NÃO) = fluxo continua
            </p>
          </>
        );

      case 'ia':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: IA Atendimento Inicial"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Prompt Personalizado</Label>
              <Textarea
                value={selectedNode.data.prompt || ''}
                onChange={(e) => updateNodeData('prompt', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Você é um assistente que..."
                rows={5}
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Modo de Operação</Label>
              <Select 
                value={selectedNode.data.mode || 'auto'} 
                onValueChange={(v) => updateNodeData('mode', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="auto">🤖 Resposta Automática</SelectItem>
                  <SelectItem value="assisted">👤 Resposta Assistida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="text-slate-300 text-xs font-medium">Aprendizado Ativo</Label>
              <Switch
                checked={selectedNode.data.learning || false}
                onCheckedChange={(v) => updateNodeData('learning', v)}
              />
            </div>
          </>
        );

      case 'aiagent':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Agente de IA</Label>
              <Select 
                value={selectedNode.data.agentType} 
                onValueChange={(v) => updateNodeData('agentType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="atendimento">🎧 IA Atendimento</SelectItem>
                  <SelectItem value="agendamento">📅 IA Agendamento</SelectItem>
                  <SelectItem value="vendas">💰 IA Vendas</SelectItem>
                  <SelectItem value="suporte">🧠 IA Suporte</SelectItem>
                  <SelectItem value="qualificacao">✨ IA Qualificação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Chamar IA de Atendimento"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Contexto Adicional</Label>
              <Textarea
                value={selectedNode.data.prompt || ''}
                onChange={(e) => updateNodeData('prompt', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Contexto extra para a IA..."
                rows={3}
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Modo</Label>
              <Select 
                value={selectedNode.data.mode || 'auto'} 
                onValueChange={(v) => updateNodeData('mode', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="auto">🤖 Automático</SelectItem>
                  <SelectItem value="assisted">👤 Assistido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="text-slate-300 text-xs font-medium">Aprendizado</Label>
              <Switch
                checked={selectedNode.data.learning || false}
                onCheckedChange={(v) => updateNodeData('learning', v)}
              />
            </div>
          </>
        );

      case 'media':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Mídia</Label>
              <Select 
                value={selectedNode.data.mediaType} 
                onValueChange={(v) => updateNodeData('mediaType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="imagem">🖼️ Imagem</SelectItem>
                  <SelectItem value="video">🎬 Vídeo</SelectItem>
                  <SelectItem value="audio">🎵 Áudio</SelectItem>
                  <SelectItem value="documento">📄 Documento</SelectItem>
                  <SelectItem value="arquivo">📎 Arquivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Enviar catálogo"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">URL da Mídia</Label>
              <Input
                value={selectedNode.data.mediaUrl || ''}
                onChange={(e) => updateNodeData('mediaUrl', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="https://..."
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Nome do Arquivo</Label>
              <Input
                value={selectedNode.data.fileName || ''}
                onChange={(e) => updateNodeData('fileName', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="catalogo.pdf"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Legenda</Label>
              <Textarea
                value={selectedNode.data.caption || ''}
                onChange={(e) => updateNodeData('caption', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Texto que acompanha a mídia..."
                rows={2}
                {...inputProps}
              />
            </div>
          </>
        );

      case 'delay':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Aguardar 5 minutos"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Delay</Label>
              <Select 
                value={selectedNode.data.delayType || 'tempo'} 
                onValueChange={(v) => updateNodeData('delayType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="tempo">⏱️ Aguardar tempo</SelectItem>
                  <SelectItem value="evento">📅 Aguardar evento</SelectItem>
                  <SelectItem value="loop">🔄 Loop/Repetir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedNode.data.delayType === 'tempo' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">Valor</Label>
                  <Input
                    type="number"
                    value={selectedNode.data.delayValue || ''}
                    onChange={(e) => updateNodeData('delayValue', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="5"
                    min="1"
                    {...inputProps}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">Unidade</Label>
                  <Select 
                    value={selectedNode.data.delayUnit || 'minutos'} 
                    onValueChange={(v) => updateNodeData('delayUnit', v)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="segundos">Segundos</SelectItem>
                      <SelectItem value="minutos">Minutos</SelectItem>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="dias">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {selectedNode.data.delayType === 'loop' && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Repetições</Label>
                <Input
                  type="number"
                  value={selectedNode.data.loopCount || ''}
                  onChange={(e) => updateNodeData('loopCount', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="3"
                  min="1"
                  max="10"
                  {...inputProps}
                />
              </div>
            )}
          </>
        );

      case 'interactive_menu':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título do Menu</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Menu Principal"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Mensagem de Boas-Vindas</Label>
              <Textarea
                value={selectedNode.data.welcomeMessage || ''}
                onChange={(e) => updateNodeData('welcomeMessage', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Olá! Como posso ajudar? Escolha uma opção:"
                rows={3}
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Botões (máx. 3 para botões, 10 para lista)</Label>
              {(selectedNode.data.buttons || []).map((btn: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={btn.label || ''}
                    onChange={(e) => {
                      const buttons = [...(selectedNode.data.buttons || [])];
                      buttons[i] = { ...buttons[i], label: e.target.value };
                      updateNodeData('buttons', buttons);
                    }}
                    className="bg-slate-800 border-slate-700 text-white text-xs"
                    placeholder={`Botão ${i + 1}`}
                    {...inputProps}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 px-2"
                    onClick={() => {
                      const buttons = [...(selectedNode.data.buttons || [])];
                      buttons.splice(i, 1);
                      updateNodeData('buttons', buttons);
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {(selectedNode.data.buttons || []).length < 10 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-slate-700 text-slate-300"
                  onClick={() => {
                    const buttons = [...(selectedNode.data.buttons || []), { label: '', id: crypto.randomUUID() }];
                    updateNodeData('buttons', buttons);
                  }}
                >
                  + Adicionar Botão
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Menu</Label>
              <Select 
                value={selectedNode.data.menuStyle || 'buttons'} 
                onValueChange={(v) => updateNodeData('menuStyle', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="buttons">🔘 Botões (máx 3)</SelectItem>
                  <SelectItem value="list">📋 Lista (máx 10)</SelectItem>
                  <SelectItem value="text">📝 Texto numerado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="text-slate-300 text-xs font-medium">IA entende texto livre</Label>
              <Switch
                checked={selectedNode.data.aiUnderstandsFreeText !== false}
                onCheckedChange={(v) => updateNodeData('aiUnderstandsFreeText', v)}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Se ativado, a IA entende texto livre e áudio além dos botões
            </p>
          </>
        );

      case 'route_department':
        return <RouteDepartmentProperties selectedNode={selectedNode} updateNodeData={updateNodeData} inputProps={inputProps} />;

      default:
        return null;
    }
  };

  const getTypeLabel = () => {
    switch (selectedNode.type) {
      case 'trigger': return 'Gatilho';
      case 'action': return 'Ação';
      case 'condition': return 'Condição';
      case 'ia': return 'IA Personalizada';
      case 'aiagent': return 'Agente IA';
      case 'delay': return 'Controle';
      case 'media': return 'Mídia';
      case 'interactive_menu': return 'Menu Interativo';
      case 'route_department': return 'Roteamento';
      default: return 'Componente';
    }
  };

  const getTypeColor = () => {
    switch (selectedNode.type) {
      case 'trigger': return 'bg-emerald-500';
      case 'action': return 'bg-amber-500';
      case 'condition': return 'bg-violet-500';
      case 'ia': return 'bg-blue-500';
      case 'aiagent': return 'bg-cyan-500';
      case 'delay': return 'bg-slate-500';
      case 'media': return 'bg-pink-500';
      case 'interactive_menu': return 'bg-teal-500';
      case 'route_department': return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getTypeColor()}`} />
          <h3 className="font-bold text-white text-sm">{getTypeLabel()}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1">ID: {selectedNode.id.slice(0, 8)}...</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {renderProperties()}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-slate-700">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full border-red-900/50 text-red-400 hover:text-red-300 hover:bg-red-950/30"
          onClick={() => {
            // This would need to be handled by parent
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remover Componente
        </Button>
      </div>
    </div>
  );
}

// Sub-component for route_department with real user dropdown
function RouteDepartmentProperties({ selectedNode, updateNodeData, inputProps }: { selectedNode: Node; updateNodeData: (key: string, value: any) => void; inputProps: any }) {
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: role } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
        if (!role?.company_id) return;

        const { data: companyUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('company_id', role.company_id);

        if (!companyUsers) return;

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', companyUsers.map(u => u.user_id));

        setUsers((profiles || []).map(p => ({ id: p.id, name: p.full_name || p.email || 'Sem nome', email: p.email || '' })));
      } catch (e) {
        console.error('Erro ao carregar usuários:', e);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const departments = ['Vendas', 'Suporte', 'Financeiro', 'Comercial', 'Técnico', 'Administrativo', 'SAC'];
  const routeMode = selectedNode.data.routeMode || 'department';

  return (
    <>
      <div className="space-y-2">
        <Label className="text-slate-300 text-xs font-medium">Título</Label>
        <Input
          value={selectedNode.data.label || ''}
          onChange={(e) => updateNodeData('label', e.target.value)}
          className="bg-slate-800 border-slate-700 text-white"
          placeholder="Ex: Direcionar para Financeiro"
          {...inputProps}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300 text-xs font-medium">Direcionar para</Label>
        <Select
          value={routeMode}
          onValueChange={(v) => {
            updateNodeData('routeMode', v);
            if (v === 'user') updateNodeData('department', '');
            if (v === 'department') updateNodeData('assignedUserId', '');
          }}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 z-50">
            <SelectItem value="department">🏢 Departamento</SelectItem>
            <SelectItem value="user">👤 Usuário/Atendente</SelectItem>
            <SelectItem value="both">🏢👤 Departamento + Usuário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(routeMode === 'department' || routeMode === 'both') && (
        <div className="space-y-2">
          <Label className="text-slate-300 text-xs font-medium">Departamento</Label>
          <Select
            value={selectedNode.data.department || ''}
            onValueChange={(v) => updateNodeData('department', v)}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Selecione o departamento" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 z-50">
              {departments.map(dep => (
                <SelectItem key={dep} value={dep}>{dep}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(routeMode === 'user' || routeMode === 'both') && (
        <div className="space-y-2">
          <Label className="text-slate-300 text-xs font-medium">
            {routeMode === 'user' ? 'Atendente/Usuário' : 'Responsável'}
          </Label>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <p className="text-xs text-amber-400">Nenhum usuário encontrado na empresa</p>
          ) : (
            <Select
              value={selectedNode.data.assignedUserId || ''}
              onValueChange={(v) => {
                updateNodeData('assignedUserId', v);
                const selectedUser = users.find(u => u.id === v);
                if (selectedUser) updateNodeData('assignedUserName', selectedUser.name);
              }}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Selecione o atendente" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 z-50">
                <SelectItem value="auto">🔄 Automático (fila)</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    👤 {u.name} {u.email ? `(${u.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-slate-300 text-xs font-medium">Mensagem ao Transferir</Label>
        <Textarea
          value={selectedNode.data.transferMessage || ''}
          onChange={(e) => updateNodeData('transferMessage', e.target.value)}
          className="bg-slate-800 border-slate-700 text-white resize-none"
          placeholder="Estou transferindo você para o setor..."
          rows={2}
          {...inputProps}
        />
      </div>
      <div className="flex items-center justify-between py-2">
        <Label className="text-slate-300 text-xs font-medium">Notificar Responsável</Label>
        <Switch
          checked={selectedNode.data.notifyAssigned !== false}
          onCheckedChange={(v) => updateNodeData('notifyAssigned', v)}
        />
      </div>
    </>
  );
}
