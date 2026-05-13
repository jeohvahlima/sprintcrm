import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Plus,
  GripVertical,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Image,
  Minus,
  AlertCircle,
  ToggleRight,
  Trash2,
  Link as LinkIcon,
  File,
  Video,
  Upload,
  Maximize2,
  Minimize2,
  LayoutGrid,
  FileText,
  Workflow,
  GitBranch,
  FilePlus,
  CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileAttachment, AttachmentDisplay, LinkDisplay } from "./FileAttachment";
import { InlineKanban } from "./InlineKanban";
import { InlinePlaybook } from "./InlinePlaybook";
import { InlineCadence } from "./InlineCadence";
import { InlineStage } from "./InlineStage";
import { InlineAgenda } from "./InlineAgenda";

interface Block {
  id: string;
  block_type: string;
  content: any;
  position: number;
}

interface BlockEditorProps {
  pageId: string;
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  companyId?: string | null;
}

const BLOCK_TYPES = [
  { type: 'paragraph', icon: Type, label: 'Texto', shortcut: '', category: 'Básico' },
  { type: 'heading1', icon: Heading1, label: 'Título 1', shortcut: '#', category: 'Básico' },
  { type: 'heading2', icon: Heading2, label: 'Título 2', shortcut: '##', category: 'Básico' },
  { type: 'heading3', icon: Heading3, label: 'Título 3', shortcut: '###', category: 'Básico' },
  { type: 'bullet_list', icon: List, label: 'Lista com marcadores', shortcut: '-', category: 'Listas' },
  { type: 'numbered_list', icon: ListOrdered, label: 'Lista numerada', shortcut: '1.', category: 'Listas' },
  { type: 'checklist', icon: CheckSquare, label: 'Lista de tarefas', shortcut: '[]', category: 'Listas' },
  { type: 'kanban', icon: LayoutGrid, label: 'Quadro Kanban', shortcut: '', category: 'Listas' },
  { type: 'playbook', icon: FileText, label: 'Playbook', shortcut: '', category: 'Processos' },
  { type: 'cadence', icon: Workflow, label: 'Cadência', shortcut: '', category: 'Processos' },
  { type: 'stage', icon: GitBranch, label: 'Etapa', shortcut: '', category: 'Processos' },
  { type: 'agenda', icon: CalendarDays, label: 'Agenda', shortcut: '', category: 'Processos' },
  { type: 'quote', icon: Quote, label: 'Citação', shortcut: '>', category: 'Formatação' },
  { type: 'code', icon: Code, label: 'Código', shortcut: '```', category: 'Formatação' },
  { type: 'callout', icon: AlertCircle, label: 'Destaque', shortcut: '!', category: 'Formatação' },
  { type: 'divider', icon: Minus, label: 'Divisor', shortcut: '---', category: 'Formatação' },
  { type: 'toggle', icon: ToggleRight, label: 'Toggle', shortcut: '>', category: 'Formatação' },
  { type: 'image', icon: Image, label: 'Imagem', shortcut: '', category: 'Mídia' },
  { type: 'file', icon: File, label: 'Arquivo', shortcut: '', category: 'Mídia' },
  { type: 'link', icon: LinkIcon, label: 'Link', shortcut: '', category: 'Mídia' },
  { type: 'embed', icon: Video, label: 'Embed (YouTube, etc)', shortcut: '', category: 'Mídia' },
];

// Sub-component that maintains local state for fluid typing
function EditableBlockTextarea({
  block,
  commonClassName,
  placeholder,
  onUpdateBlock,
  onKeyDown,
  onFocus,
  blockRefs,
  autoResize,
  extraClassName,
  wrapper,
}: {
  block: Block;
  commonClassName: string;
  placeholder: string;
  onUpdateBlock: (blockId: string, content: Block['content']) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  blockRefs: React.MutableRefObject<Map<string, HTMLTextAreaElement>>;
  autoResize: (el: HTMLTextAreaElement | null) => void;
  extraClassName?: string;
  wrapper?: (textarea: React.ReactNode) => React.ReactNode;
}) {
  const [localText, setLocalText] = useState(block.content.text || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockIdRef = useRef(block.id);

  // Sync local text when block.id changes (different block) but NOT on every re-render
  useEffect(() => {
    if (blockIdRef.current !== block.id) {
      blockIdRef.current = block.id;
      setLocalText(block.content.text || '');
    }
  }, [block.id, block.content.text]);

  // Also sync if text changed externally (e.g. shortcut cleared text) and user is not actively typing
  useEffect(() => {
    const externalText = block.content.text || '';
    if (externalText !== localText && !debounceRef.current) {
      setLocalText(externalText);
    }
  }, [block.content.text]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setLocalText(newText);
    autoResize(e.target);

    // Debounce the save to DB
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onUpdateBlock(block.id, { ...block.content, text: newText });
    }, 500);
  };

  const textareaEl = (
    <textarea
      ref={(el: HTMLTextAreaElement) => {
        if (el) {
          blockRefs.current.set(block.id, el);
          autoResize(el);
        }
      }}
      value={localText}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className={cn(commonClassName, extraClassName)}
      placeholder={placeholder}
      style={{ minHeight: '24px', overflow: 'hidden' }}
    />
  );

  return wrapper ? <>{wrapper(textareaEl)}</> : textareaEl;
}

export function BlockEditor({ pageId, blocks, onBlocksChange, companyId }: BlockEditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<Block | null>(null);
  const blockRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const createBlock = async (type: string, position: number, content?: any) => {
    try {
      const { data, error } = await supabase
        .from('process_blocks')
        .insert({
          page_id: pageId,
          block_type: type,
          content: content || { text: '' },
          position,
        })
        .select()
        .single();

      if (error) throw error;

      const newBlocks = [...blocks];
      newBlocks.splice(position, 0, data);
      newBlocks.forEach((block, idx) => {
        block.position = idx;
      });
      onBlocksChange(newBlocks);
      
      setTimeout(() => {
        const ref = blockRefs.current.get(data.id);
        if (ref) ref.focus();
      }, 50);

      return data;
    } catch (error) {
      console.error('Error creating block:', error);
      toast.error('Erro ao criar bloco');
    }
  };

  const updateBlock = async (blockId: string, content: Block['content']) => {
    try {
      await supabase
        .from('process_blocks')
        .update({ content })
        .eq('id', blockId);

      const updatedBlocks = blocks.map(b => 
        b.id === blockId ? { ...b, content } : b
      );
      onBlocksChange(updatedBlocks);
    } catch (error) {
      console.error('Error updating block:', error);
    }
  };

  const deleteBlock = async (blockId: string) => {
    try {
      await supabase
        .from('process_blocks')
        .delete()
        .eq('id', blockId);

      const newBlocks = blocks.filter(b => b.id !== blockId);
      onBlocksChange(newBlocks);
    } catch (error) {
      toast.error('Erro ao excluir bloco');
    }
  };

  const changeBlockType = async (blockId: string, newType: string) => {
    try {
      await supabase
        .from('process_blocks')
        .update({ block_type: newType })
        .eq('id', blockId);

      const updatedBlocks = blocks.map(b => 
        b.id === blockId ? { ...b, block_type: newType } : b
      );
      onBlocksChange(updatedBlocks);
      setShowBlockMenu(null);
    } catch (error) {
      toast.error('Erro ao alterar tipo do bloco');
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent, block: Block, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await createBlock('paragraph', index + 1);
    }
    
    if (e.key === 'Backspace' && block.content.text === '' && blocks.length > 1) {
      e.preventDefault();
      await deleteBlock(block.id);
      if (index > 0) {
        const prevBlock = blocks[index - 1];
        const ref = blockRefs.current.get(prevBlock.id);
        if (ref) ref.focus();
      }
    }

    if (e.key === ' ') {
      const text = block.content.text || '';
      const shortcuts: Record<string, string> = {
        '#': 'heading1',
        '##': 'heading2',
        '###': 'heading3',
        '-': 'bullet_list',
        '*': 'bullet_list',
        '1.': 'numbered_list',
        '[]': 'checklist',
        '>': 'quote',
        '---': 'divider',
        '!': 'callout',
      };

      for (const [shortcut, type] of Object.entries(shortcuts)) {
        if (text === shortcut) {
          e.preventDefault();
          await updateBlock(block.id, { text: '' });
          await changeBlockType(block.id, type);
          return;
        }
      }
    }

    if (e.key === 'ArrowUp' && index > 0) {
      const ref = blockRefs.current.get(blocks[index - 1].id);
      if (ref) {
        e.preventDefault();
        ref.focus();
      }
    }
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      const ref = blockRefs.current.get(blocks[index + 1].id);
      if (ref) {
        e.preventDefault();
        ref.focus();
      }
    }
  };

  const handleFileUploaded = async (url: string, fileName: string, fileType: string, index: number) => {
    const blockType = fileType.startsWith('image/') ? 'image' : 'file';
    await createBlock(blockType, index + 1, { url, fileName, fileType });
    setShowAddMenu(false);
  };

  const handleLinkAdded = async (url: string, title: string, index: number) => {
    await createBlock('link', index + 1, { url, title });
    setShowAddMenu(false);
  };

  // Auto-resize textarea
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  const renderBlockContent = (block: Block, index: number) => {
    const baseClassName = cn(
      "w-full resize-none border-0 bg-transparent focus:ring-0 focus-visible:ring-0 p-0",
      "placeholder:text-muted-foreground/50"
    );

    const editableProps = {
      block,
      commonClassName: baseClassName,
      onUpdateBlock: updateBlock,
      onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => handleKeyDown(e, block, index),
      onFocus: () => setFocusedBlockId(block.id),
      blockRefs,
      autoResize,
    };

    switch (block.block_type) {
      case 'heading1':
        return <EditableBlockTextarea {...editableProps} extraClassName="text-3xl font-bold" placeholder="Título 1" />;
      case 'heading2':
        return <EditableBlockTextarea {...editableProps} extraClassName="text-2xl font-semibold" placeholder="Título 2" />;
      case 'heading3':
        return <EditableBlockTextarea {...editableProps} extraClassName="text-xl font-medium" placeholder="Título 3" />;
      case 'bullet_list':
        return (
          <EditableBlockTextarea
            {...editableProps}
            placeholder="Item da lista"
            wrapper={(textarea) => (
              <div className="flex items-start gap-2">
                <span className="mt-1">•</span>
                {textarea}
              </div>
            )}
          />
        );
      case 'numbered_list':
        return (
          <EditableBlockTextarea
            {...editableProps}
            placeholder="Item da lista"
            wrapper={(textarea) => (
              <div className="flex items-start gap-2">
                <span className="mt-1 text-muted-foreground">{index + 1}.</span>
                {textarea}
              </div>
            )}
          />
        );
      case 'checklist':
        return (
          <EditableBlockTextarea
            {...editableProps}
            extraClassName={block.content.checked ? "line-through text-muted-foreground" : ""}
            placeholder="Tarefa"
            wrapper={(textarea) => (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={block.content.checked || false}
                  onChange={(e) => updateBlock(block.id, { ...block.content, checked: e.target.checked })}
                  className="mt-1.5 h-4 w-4 rounded border-muted-foreground/50"
                />
                {textarea}
              </div>
            )}
          />
        );
      case 'quote':
        return (
          <EditableBlockTextarea
            {...editableProps}
            placeholder="Citação..."
            wrapper={(textarea) => (
              <div className="border-l-4 border-primary/50 pl-4 italic">{textarea}</div>
            )}
          />
        );
      case 'code':
        return (
          <EditableBlockTextarea
            {...editableProps}
            extraClassName="font-mono"
            placeholder="// Código..."
            wrapper={(textarea) => (
              <div className="bg-muted rounded-lg p-3 font-mono text-sm">{textarea}</div>
            )}
          />
        );
      case 'callout':
        return (
          <EditableBlockTextarea
            {...editableProps}
            placeholder="Destaque..."
            wrapper={(textarea) => (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
                <span>💡</span>
                {textarea}
              </div>
            )}
          />
        );
      case 'divider':
        return <hr className="border-border my-2" />;
      case 'toggle':
        return (
          <EditableBlockTextarea
            {...editableProps}
            extraClassName="font-medium"
            placeholder="Toggle..."
            wrapper={(textarea) => (
              <details className="group">
                <summary className="cursor-pointer list-none flex items-center gap-2">
                  <ToggleRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                  {textarea}
                </summary>
                <div className="ml-6 mt-2 text-muted-foreground">Conteúdo colapsável...</div>
              </details>
            )}
          />
        );
      case 'image':
        return (
          <AttachmentDisplay
            url={block.content.url}
            fileName={block.content.fileName || 'Imagem'}
            fileType={block.content.fileType || 'image/png'}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      case 'file':
        return (
          <AttachmentDisplay
            url={block.content.url}
            fileName={block.content.fileName || 'Arquivo'}
            fileType={block.content.fileType || 'application/octet-stream'}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      case 'link':
        return (
          <LinkDisplay
            url={block.content.url}
            title={block.content.title || block.content.url}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      case 'embed':
        const embedUrl = block.content.url || '';
        const isYoutube = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be');
        if (isYoutube) {
          const videoId = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
          if (videoId) {
            return (
              <div className="relative aspect-video rounded-lg overflow-hidden border">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                />
              </div>
            );
          }
        }
        return (
          <div className="p-4 rounded-lg border bg-muted/50">
            <p className="text-sm text-muted-foreground">Embed: {embedUrl}</p>
          </div>
        );
      case 'kanban':
        return (
          <InlineKanban
            content={block.content.kanbanData || { columns: [], tasks: [] }}
            onUpdate={(kanbanData) => updateBlock(block.id, { ...block.content, kanbanData })}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      case 'playbook':
        return (
          <InlinePlaybook
            content={block.content.playbookData || { title: '', type: 'atendimento', category: '', content: '' }}
            onUpdate={(playbookData) => updateBlock(block.id, { ...block.content, playbookData })}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      case 'cadence':
        return (
          <InlineCadence
            content={block.content.cadenceData || { name: '', type: 'prospeccao', channels: [], steps: [] }}
            onUpdate={(cadenceData) => updateBlock(block.id, { ...block.content, cadenceData })}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      case 'stage':
        return (
          <InlineStage
            content={block.content.stageData || { stage_name: '', objectives: '', max_time_hours: 24, checklist: [], dos: [], donts: [] }}
            onUpdate={(stageData) => updateBlock(block.id, { ...block.content, stageData })}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      case 'agenda':
        return (
          <InlineAgenda
            content={block.content.agendaData || { nome: '', compromissos: [] }}
            onUpdate={(agendaData) => updateBlock(block.id, { ...block.content, agendaData })}
            onRemove={() => deleteBlock(block.id)}
          />
        );
      default:
        return <EditableBlockTextarea {...editableProps} placeholder="Digite '/' para comandos ou clique + para adicionar..." />;
    }
  };

  const categories = [...new Set(BLOCK_TYPES.map(b => b.category))];

  return (
    <div className="space-y-1 py-4">
      {blocks.length === 0 && (
        <div
          className="flex items-center gap-2 py-2 px-2 text-muted-foreground cursor-pointer hover:bg-muted/50 rounded"
          onClick={() => createBlock('paragraph', 0)}
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">Clique para começar a escrever...</span>
        </div>
      )}
      
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={cn(
            "group relative flex items-start gap-1 py-1 px-2 rounded transition-colors",
            focusedBlockId === block.id && "bg-muted/30"
          )}
        >
          {/* Block Controls */}
          <div className="flex w-14 shrink-0 items-center justify-end gap-0.5 opacity-100 transition-opacity md:opacity-60 md:group-hover:opacity-100">
            <Popover open={showBlockMenu === block.id} onOpenChange={(open) => setShowBlockMenu(open ? block.id : null)}>
              <PopoverTrigger asChild>
                <button className="p-1 hover:bg-muted rounded" aria-label="Adicionar bloco abaixo">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category}>
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">{category.toUpperCase()}</p>
                      <div className="space-y-0.5">
                        {BLOCK_TYPES.filter(b => b.category === category).map(({ type, icon: Icon, label }) => {
                          if (type === 'image' || type === 'file') {
                            return (
                              <FileAttachment
                                key={type}
                                onFileUploaded={(url, fileName, fileType) => handleFileUploaded(url, fileName, fileType, index)}
                                onLinkAdded={(url, title) => handleLinkAdded(url, title, index)}
                                trigger={
                                  <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors">
                                    <Icon className="h-4 w-4" />
                                    <span>{label}</span>
                                  </button>
                                }
                              />
                            );
                          }
                          return (
                            <button
                              key={type}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                              onClick={() => {
                                createBlock(type, index + 1);
                                setShowBlockMenu(null);
                              }}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <button className="p-1 hover:bg-muted rounded cursor-grab">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Block Content */}
          <div className="flex-1 min-w-0">
            {renderBlockContent(block, index)}
          </div>

          {/* Delete Button */}
          <button
            className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => deleteBlock(block.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
      ))}

      {/* Add new block at end */}
      {blocks.length > 0 && (
        <div className="flex items-center gap-2 py-2 px-2 text-muted-foreground">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-muted/50 rounded p-1">
                <Plus className="h-4 w-4" />
                <span className="text-sm">Adicionar bloco</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category}>
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">{category.toUpperCase()}</p>
                    <div className="space-y-0.5">
                      {BLOCK_TYPES.filter(b => b.category === category).map(({ type, icon: Icon, label }) => {
                        if (type === 'image' || type === 'file') {
                          return (
                            <FileAttachment
                              key={type}
                              onFileUploaded={(url, fileName, fileType) => handleFileUploaded(url, fileName, fileType, blocks.length)}
                              onLinkAdded={(url, title) => handleLinkAdded(url, title, blocks.length)}
                              trigger={
                                <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors">
                                  <Icon className="h-4 w-4" />
                                  <span>{label}</span>
                                </button>
                              }
                            />
                          );
                        }
                        return (
                          <button
                            key={type}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                            onClick={() => createBlock(type, blocks.length)}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Dialog para expandir/visualizar texto longo */}
      <Dialog open={!!expandedBlock} onOpenChange={() => setExpandedBlock(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Maximize2 className="h-5 w-5" />
              Visualizar Conteúdo Completo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={expandedBlock?.content.text || ''}
              onChange={(e) => {
                if (expandedBlock) {
                  updateBlock(expandedBlock.id, { ...expandedBlock.content, text: e.target.value });
                  setExpandedBlock({ ...expandedBlock, content: { ...expandedBlock.content, text: e.target.value } });
                }
              }}
              className="min-h-[300px] text-base leading-relaxed"
              placeholder="Digite o conteúdo..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExpandedBlock(null)}>
                <Minimize2 className="h-4 w-4 mr-2" />
                Minimizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
