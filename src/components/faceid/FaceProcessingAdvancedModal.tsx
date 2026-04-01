import React, { useEffect, useMemo, useRef, useState } from 'react';
import Delaunator from 'delaunator';
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

const loadMediaPipe = async () => {
  const importFromUrl = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
  return importFromUrl('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs');
};

const buildDenseMesh = (points: Landmark[]) => {
  const edges = new Set<string>();
  const triangles = Delaunator.from(points, (p) => p.x, (p) => p.y).triangles;

  const addEdge = (a: number, b: number) => {
    const i = Math.min(a, b);
    const j = Math.max(a, b);
    if (i === j) return;
    edges.add(`${i}-${j}`);
  };

  connections.forEach((group) => {
    for (let i = 0; i < group.length - 1; i++) addEdge(group[i], group[i + 1]);
  });

  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i];
    const b = triangles[i + 1];
    const c = triangles[i + 2];
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  return Array.from(edges).map((edge) => edge.split('-').map(Number) as [number, number]);
};

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
  const [meshEdges, setMeshEdges] = useState<[number, number][]>([]);
  const [primaryToken, setPrimaryToken] = useState('0 0% 100%');
  const [accentToken, setAccentToken] = useState('0 0% 100%');
  const phaseRef = useRef<ScanPhase>('idle');

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setPrimaryToken(styles.getPropertyValue('--primary').trim() || '0 0% 100%');
    setAccentToken(styles.getPropertyValue('--accent').trim() || '0 0% 100%');
  }, []);

  useEffect(() => {
    const detect = async () => {
      if (!open || !imageSrc) return;

      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      let points = fallbackPoints();

      try {
        const { FaceLandmarker, FilesetResolver } = await loadMediaPipe();
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm');
        const detector = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          numFaces: 1,
        });
        const result = detector.detect(img);
        const found = result.faceLandmarks?.[0] as Landmark[] | undefined;
        if (found && found.length > 100) points = found;
      } catch {
        points = fallbackPoints();
      }

      setLandmarks(points);
      setMeshEdges(buildDenseMesh(points));
    };

    detect();
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
    phaseRef.current = phase;
    const elapsed = performance.now();

    const pointsVisibleCount = phase === 'points' ? Math.floor(landmarks.length * ratio) : landmarks.length;
    const visiblePoints = new Uint8Array(landmarks.length);
    for (let i = 0; i < pointsVisibleCount; i++) {
      const item = pointOrder[i];
      if (!item) continue;
      visiblePoints[item.i] = 1;
    }

    const meshVisibleCount = phase === 'mesh' ? Math.floor(meshEdges.length * ratio) : phase === 'done' ? meshEdges.length : 0;
    const scanLineProgress = phase === 'points' || phase === 'mesh' ? ratio : 1;
    const scanY = imageBounds.y + scanLineProgress * imageBounds.height;

    for (let i = 0; i < landmarks.length; i++) {
      if (!visiblePoints[i]) continue;
      const p = landmarks[i];
      const { x, y } = toCanvasPoint(p);
      if (phase === 'points' && y > scanY + 10) continue;

      const doneLoop = (Math.sin(elapsed * 0.004 + i * 0.08) + 1) * 0.5;
      const pulseBoost = phase === 'points' ? Math.max(0, 1 - Math.abs((y - scanY) / 24)) : 0;
      const pointRadius = 0.85 + pulseBoost * 0.85;

      ctx.beginPath();
      ctx.fillStyle = phase === 'done' ? `hsla(0, 0%, ${doneLoop * 100}%, 1)` : cssHslToHsla(primaryToken, 1);
      ctx.shadowColor = cssHslToHsla(primaryToken, 1);
      ctx.shadowBlur = phase === 'done' ? 12 + doneLoop * 10 : 8;
      ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
      ctx.fill();

      if (phase === 'points' && pulseBoost > 0.1) {
        ctx.beginPath();
        ctx.strokeStyle = cssHslToHsla(primaryToken, 0.24 + pulseBoost * 0.32);
        ctx.lineWidth = 0.45;
        ctx.arc(x, y, pointRadius + 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (meshVisibleCount > 0) {
      const energy = 0.35 + Math.sin(elapsed * 0.01) * 0.15;
      ctx.strokeStyle = cssHslToHsla(primaryToken, Math.min(0.95, 0.52 + energy));
      ctx.lineWidth = 0.45;
      ctx.shadowBlur = 6;
      ctx.shadowColor = cssHslToHsla(primaryToken, 0.9);

      for (let i = 0; i < meshVisibleCount; i++) {
        const [a, b] = meshEdges[i];
        if (!visiblePoints[a] || !visiblePoints[b]) continue;
        const pa = landmarks[a];
        const pb = landmarks[b];
        const cpa = toCanvasPoint(pa);
        const cpb = toCanvasPoint(pb);
        const yA = cpa.y;
        const yB = cpb.y;
        if ((phase === 'points' || phase === 'mesh') && (yA > scanY + 10 || yB > scanY + 10)) continue;

        ctx.beginPath();
        ctx.moveTo(cpa.x, yA);
        ctx.lineTo(cpb.x, yB);
        ctx.stroke();
      }

      ctx.strokeStyle = cssHslToHsla(accentToken, 0.85);
      ctx.lineWidth = 0.65;
      ctx.shadowBlur = 5;

      connections.forEach((group) => {
        for (let i = 0; i < group.length - 1; i++) {
          const a = group[i];
          const b = group[i + 1];
          if (!visiblePoints[a] || !visiblePoints[b]) continue;
          const pa = landmarks[a];
          const pb = landmarks[b];
          const cpa = toCanvasPoint(pa);
          const cpb = toCanvasPoint(pb);
          const yA = cpa.y;
          const yB = cpb.y;
          if ((phase === 'points' || phase === 'mesh') && (yA > scanY + 10 || yB > scanY + 10)) continue;

          ctx.beginPath();
          ctx.moveTo(cpa.x, yA);
          ctx.lineTo(cpb.x, yB);
          ctx.stroke();
        }
      });

      if (phase === 'mesh' || phase === 'done') {
        ctx.fillStyle = cssHslToHsla(primaryToken, 0.5);
        for (let i = 0; i < landmarks.length; i++) {
          if (!visiblePoints[i]) continue;
          const cp = landmarks[i];
          const cpoint = toCanvasPoint(cp);
          const donePulse = phase === 'done' ? (Math.sin(elapsed * 0.003 + i * 0.25) + 1) * 0.5 : 0.25;
          ctx.beginPath();
          ctx.shadowBlur = phase === 'done' ? 10 + donePulse * 8 : 6;
          ctx.arc(cpoint.x, cpoint.y, 0.72 + donePulse * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (phase === 'points' || phase === 'mesh') {
      const gradient = ctx.createLinearGradient(0, scanY - 24, 0, scanY + 24);
      gradient.addColorStop(0, cssHslToHsla(primaryToken, 0));
      gradient.addColorStop(0.5, cssHslToHsla(primaryToken, 0.35));
      gradient.addColorStop(1, cssHslToHsla(primaryToken, 0));
      ctx.fillStyle = gradient;
      const scanTop = Math.max(imageBounds.y, scanY - 24);
      const scanBottom = Math.min(imageBounds.y + imageBounds.height, scanY + 24);
      if (scanBottom > scanTop) {
        ctx.fillRect(imageBounds.x, scanTop, imageBounds.width, scanBottom - scanTop);
      }
    }
  }, [open, landmarks, meshEdges, pointOrder, progress, primaryToken, accentToken]);

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