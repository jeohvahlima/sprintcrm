import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  aspect?: 'square' | 'video' | 'banner';
  size?: 'sm' | 'md' | 'lg';
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function ImageUploader({ companyId, value, onChange, label = 'Imagem', aspect = 'video', size = 'md' }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const aspectClass = aspect === 'square' ? 'aspect-square' : aspect === 'banner' ? 'aspect-[3/1]' : 'aspect-video';
  const sizeClass = size === 'sm' ? 'max-w-[120px]' : size === 'lg' ? 'max-w-md' : 'max-w-[240px]';

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `sites/${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('capture-page-assets').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('capture-page-assets').getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-medium">{label}</div>}
      <div className="flex items-start gap-3">
        {value ? (
          <div className={`relative ${sizeClass} w-full`}>
            <img src={value} alt="preview" className={`w-full ${aspectClass} object-cover rounded-lg border`} />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 hover:opacity-80"
              aria-label="Remover"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className={`${sizeClass} w-full ${aspectClass} border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30`}>
            <Upload className="w-6 h-6" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input ref={ref} type="file" accept={ACCEPT} className="hidden" onChange={handle} />
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => ref.current?.click()}>
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            {value ? 'Trocar' : 'Enviar'}
          </Button>
          <p className="text-[10px] text-muted-foreground">PNG/JPG/WEBP, máx 5MB</p>
        </div>
      </div>
    </div>
  );
}
