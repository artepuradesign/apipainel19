import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type ProductPhotoUploaderProps = {
  photos: string[];
  uploading: boolean;
  onUpload: (slotIndex: number, file: File | null) => void;
  onRemove: (slotIndex: number) => void;
};

const SLOT_HINTS = [
  'Foto principal',
  'Verso/ingredientes',
  'Lateral',
  'Código de barras',
  'Embalagem aberta',
];

export default function ProductPhotoUploader({ photos, uploading, onUpload, onRemove }: ProductPhotoUploaderProps) {
  const usedSlots = useMemo(() => photos.filter((photo) => photo.trim().length > 0).length, [photos]);
  const [visibleSlots, setVisibleSlots] = useState(1);
  const [localPreviews, setLocalPreviews] = useState<Record<number, string>>({});
  const [previewErrorSlots, setPreviewErrorSlots] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setVisibleSlots((prev) => Math.min(5, Math.max(prev, Math.max(1, usedSlots))));
  }, [usedSlots]);

  useEffect(() => {
    return () => {
      Object.values(localPreviews).forEach((previewUrl) => {
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
      });
    };
  }, [localPreviews]);

  const clearLocalPreview = (slotIndex: number) => {
    setLocalPreviews((prev) => {
      const current = prev[slotIndex];
      if (current?.startsWith('blob:')) {
        URL.revokeObjectURL(current);
      }

      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
    setPreviewErrorSlots((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  };

  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
      {SLOT_HINTS.slice(0, visibleSlots).map((hint, index) => {
        const remotePhotoUrl = photos[index] || '';
        const photoUrl = localPreviews[index] || remotePhotoUrl;
        const showImage = photoUrl.trim().length > 0 && !previewErrorSlots[index];

        return (
          <div key={`photo-slot-${index}`} className="rounded-lg border bg-card p-2.5 space-y-2 min-w-0 w-full">
            <input
              id={`foto-slot-${index}`}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] || null;
                if (file) {
                  const previewUrl = URL.createObjectURL(file);
                  setLocalPreviews((prev) => {
                    const current = prev[index];
                    if (current?.startsWith('blob:')) {
                      URL.revokeObjectURL(current);
                    }
                    return { ...prev, [index]: previewUrl };
                  });
                  setPreviewErrorSlots((prev) => ({ ...prev, [index]: false }));
                }
                onUpload(index, file);
                event.currentTarget.value = '';
              }}
            />

            <Label
              htmlFor={`foto-slot-${index}`}
              className="relative aspect-square rounded-md border border-dashed bg-muted/20 overflow-hidden flex items-center justify-center cursor-pointer transition-colors hover:bg-muted/40"
            >
              <div className="w-full h-full">
                {showImage ? (
                  <img
                    src={photoUrl}
                    alt={`Foto ${index + 1} do produto`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={() => setPreviewErrorSlots((prev) => ({ ...prev, [index]: true }))}
                  />
                ) : (
                  <div className="w-full h-full p-3 flex flex-col items-center justify-center gap-2 text-center">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Adicionar foto</p>
                      <p className="text-[11px] text-muted-foreground">Toque para escolher</p>
                    </div>
                  </div>
                )}
              </div>
              <span className="absolute top-2 left-2 rounded bg-background/90 border px-1.5 py-0.5 text-[10px] font-medium">
                {index + 1}/5
              </span>
            </Label>

            <div className="space-y-1">
              <p className="text-xs font-medium">
                Foto {index + 1}
              </p>
              <p className="text-[11px] text-muted-foreground">{hint}</p>
              {previewErrorSlots[index] && (
                <p className="text-[11px] text-muted-foreground">Pré-visualização indisponível no momento.</p>
              )}
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={uploading || !photoUrl}
                onClick={() => {
                  clearLocalPreview(index);
                  onRemove(index);
                }}
                title="Remover foto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
      </div>

      {visibleSlots < 5 && (
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => setVisibleSlots((prev) => Math.min(5, prev + 1))}
        >
          Adicionar mais fotos
        </Button>
      )}
    </div>
  );
}