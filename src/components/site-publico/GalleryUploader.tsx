import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
  images: string[];
  onChange: (images: string[]) => void;
}

export function GalleryUploader({ companyId, images, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const novas: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: maior que 5MB, ignorado`);
        continue;
      }
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `sites/${companyId}/galeria/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('capture-page-assets').upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        });
        if (error) throw error;
        const { data } = supabase.storage.from('capture-page-assets').getPublicUrl(path);
        novas.push(data.publicUrl);
      } catch (err: any) {
        toast.error(`${file.name}: ${err.message}`);
      }
    }
    if (novas.length) {
      onChange([...images, ...novas]);
      toast.success(`${novas.length} imagem(ns) enviada(s)`);
    }
    setUploading(false);
    if (ref.current) ref.current.value = '';
  };

  const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <input ref={ref} type="file" multiple accept="image/*" className="hidden" onChange={handle} />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
        Enviar imagens
      </Button>
      {images.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma imagem ainda.</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {images.map((url, i) => (
          <div key={i} className="relative group">
            <img src={url} alt={`g${i}`} className="w-full aspect-square object-cover rounded-lg border" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition"
              aria-label="Remover"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
