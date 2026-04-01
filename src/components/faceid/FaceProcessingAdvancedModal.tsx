import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

type Landmark = { x: number; y: number; z?: number };
type ScanPhase = 'idle' | 'points' | 'mesh' | 'done';

type FaceProcessingAdvancedModalProps = {
  open: boolean;
  imageSrc: string | null;
  progress: number;
  title?: string;
  onOpenChange: (open: boolean) => void;
};

const connections = [
  [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  [33, 160, 158, 133, 153, 144, 33],
  [362, 385, 387, 263, 373, 380, 362],
  [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
  [70, 63, 105, 66, 107],
  [336, 296, 334, 293, 300],
] as const;

const fallbackPoints = (): Landmark[] =>
  Array.from({ length: 468 }, (_, i) => {
    const angle = (i / 468) * Math.PI * 2;
    const radius = 0.25 + (i % 13) * 0.012;
    return {
      x: 0.5 + Math.cos(angle) * radius * 0.55,
      y: 0.5 + Math.sin(angle) * radius * 0.68,
      z: Math.sin(angle * 3) * 0.04,
    };
  });

const cssHslToHsla = (token: string, alpha: number) => {
  const [h, s, l] = token
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => parseFloat(part.replace('%', '')));

  if ([h, s, l].some((value) => Number.isNaN(value))) {
    return `rgba(255,255,255,${alpha})`;
  }

  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
};

const getPhaseFromProgress = (progress: number): { phase: ScanPhase; ratio: number } => {
  const normalized = Math.max(0, Math.min(progress / 100, 1));

  if (normalized <= 0.5) {
    return { phase: 'points', ratio: normalized / 0.5 };
  }

  if (normalized < 1) {
    return { phase: 'mesh', ratio: (normalized - 0.5) / 0.5 };
  }

  return { phase: 'done', ratio: 1 };
};

const getContainedImageBounds = (
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
) => {
  if (!naturalWidth || !naturalHeight) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }

  const containerRatio = containerWidth / containerHeight;
  const imageRatio = naturalWidth / naturalHeight;

  if (imageRatio > containerRatio) {
    const width = containerWidth;
    const height = width / imageRatio;
    return { x: 0, y: (containerHeight - height) / 2, width, height };
  }

  const height = containerHeight;
  const width = height * imageRatio;
  return { x: (containerWidth - width) / 2, y: 0, width, height };
};

const FaceProcessingAdvancedModal = ({
  open,
  imageSrc,
  progress,
  title = 'Verificação facial em andamento',
  onOpenChange,
}: FaceProcessingAdvancedModalProps) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [foregroundToken, setForegroundToken] = useState('0 0% 100%');

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setForegroundToken(styles.getPropertyValue('--foreground').trim() || '0 0% 100%');
  }, []);

  useEffect(() => {
    if (!open || !imageSrc) return;
    setLandmarks(fallbackPoints());
  }, [open, imageSrc]);

  const pointOrder = useMemo(() => {
    if (landmarks.length === 0) return [] as Array<{ i: number; y: number; centerDistance: number }>;

    let minX = 1;
    let maxX = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const x = landmarks[i].x;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const centerX = (minX + maxX) * 0.5;

    return landmarks
      .map((p, i) => ({ i, y: p.y, centerDistance: Math.abs(p.x - centerX) }))
      .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.centerDistance - b.centerDistance));
  }, [landmarks]);

  useEffect(() => {
    if (!open || !canvasRef.current || !imageRef.current || landmarks.length === 0) return;

    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = image.clientWidth || 1;
    const height = image.clientHeight || 1;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const imageBounds = getContainedImageBounds(
      width,
      height,
      image.naturalWidth || width,
      image.naturalHeight || height,
    );

    const toCanvasPoint = (point: Landmark) => ({
      x: imageBounds.x + point.x * imageBounds.width,
      y: imageBounds.y + point.y * imageBounds.height,
    });

    const { phase, ratio } = getPhaseFromProgress(progress);
    const normalized = Math.max(0, Math.min(progress / 100, 1));
    const scanProgress = normalized <= 0.5 ? normalized * 2 : (1 - normalized) * 2;

    const pointsVisibleCount = phase === 'points' ? Math.floor(landmarks.length * ratio) : landmarks.length;
    const visiblePoints = new Uint8Array(landmarks.length);
    for (let i = 0; i < pointsVisibleCount; i++) {
      const item = pointOrder[i];
      if (!item) continue;
      visiblePoints[item.i] = 1;
    }

    const totalConnectionSegments = connections.reduce((acc, group) => acc + Math.max(0, group.length - 1), 0);
    const visibleConnectionSegments =
      phase === 'mesh' ? Math.floor(totalConnectionSegments * ratio) : phase === 'done' ? totalConnectionSegments : 0;
    const scanY = imageBounds.y + scanProgress * imageBounds.height;

    for (let i = 0; i < landmarks.length; i++) {
      if (!visiblePoints[i]) continue;
      const p = landmarks[i];
      const { x, y } = toCanvasPoint(p);
      if (phase === 'points' && y > scanY + 10) continue;

      const pulseBoost = phase === 'points' ? Math.max(0, 1 - Math.abs((y - scanY) / 20)) : 0;
      const pointRadius = 0.8 + pulseBoost * 0.4;

      ctx.beginPath();
      ctx.fillStyle = cssHslToHsla(foregroundToken, phase === 'done' ? 0.95 : 0.85);
      ctx.shadowBlur = 0;
      ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (visibleConnectionSegments > 0) {
      ctx.strokeStyle = cssHslToHsla(foregroundToken, 0.6);
      ctx.lineWidth = 0.6;
      let drawnSegments = 0;

      for (let g = 0; g < connections.length; g++) {
        const group = connections[g];
        for (let i = 0; i < group.length - 1; i++) {
          if (drawnSegments >= visibleConnectionSegments) break;

          const a = group[i];
          const b = group[i + 1];
          if (!visiblePoints[a] || !visiblePoints[b]) {
            drawnSegments += 1;
            continue;
          }

          const cpa = toCanvasPoint(landmarks[a]);
          const cpb = toCanvasPoint(landmarks[b]);
          if ((phase === 'points' || phase === 'mesh') && (cpa.y > scanY + 10 || cpb.y > scanY + 10)) {
            drawnSegments += 1;
            continue;
          }

          ctx.beginPath();
          ctx.moveTo(cpa.x, cpa.y);
          ctx.lineTo(cpb.x, cpb.y);
          ctx.stroke();
          drawnSegments += 1;
        }
      }
    }

    if (phase === 'points' || phase === 'mesh') {
      ctx.strokeStyle = cssHslToHsla(foregroundToken, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(imageBounds.x, scanY);
      ctx.lineTo(imageBounds.x + imageBounds.width, scanY);
      ctx.stroke();
    }
  }, [open, landmarks, pointOrder, progress, foregroundToken]);

  useEffect(() => {
    if (!open || landmarks.length === 0) return;

    const tick = () => {
      if (!canvasRef.current || !imageRef.current) return;

      const canvas = canvasRef.current;
      const image = imageRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = image.clientWidth || 1;
      const height = image.clientHeight || 1;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const event = new Event('resize');
      window.dispatchEvent(event);
    };

    const rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [open, landmarks, progress]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Mapeando landmarks faciais e refinando malha biométrica em tempo real.</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-md border bg-muted/20">
            {imageSrc ? (
              <>
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Face enviada para validação"
                  className="h-64 w-full object-contain bg-background/60 sm:h-80"
                  loading="lazy"
                />
                <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
              </>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Aguardando imagem</div>
            )}
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-center text-sm text-muted-foreground">Reconstrução facial profissional • {Math.round(progress)}%</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaceProcessingAdvancedModal;