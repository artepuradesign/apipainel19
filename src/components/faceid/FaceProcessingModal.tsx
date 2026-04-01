import React from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

type FaceProcessingModalProps = {
  open: boolean;
  imageSrc: string | null;
  progress: number;
  title?: string;
  onOpenChange: (open: boolean) => void;
};

const FACE_POINTS = [
  { x: '30%', y: '26%' }, { x: '50%', y: '24%' }, { x: '70%', y: '26%' },
  { x: '38%', y: '38%' }, { x: '50%', y: '40%' }, { x: '62%', y: '38%' },
  { x: '35%', y: '54%' }, { x: '43%', y: '56%' }, { x: '50%', y: '57%' },
  { x: '57%', y: '56%' }, { x: '65%', y: '54%' }, { x: '50%', y: '70%' },
  { x: '28%', y: '35%' }, { x: '72%', y: '35%' }, { x: '26%', y: '48%' },
  { x: '74%', y: '48%' }, { x: '32%', y: '64%' }, { x: '68%', y: '64%' },
  { x: '40%', y: '72%' }, { x: '60%', y: '72%' }, { x: '50%', y: '50%' },
  { x: '45%', y: '47%' }, { x: '55%', y: '47%' },
];

const FaceProcessingModal = ({ open, imageSrc, progress, title = 'Verificação facial em andamento', onOpenChange }: FaceProcessingModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Mapeando pontos biométricos da face e validando qualidade da imagem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-muted/30">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt="Face enviada para validação"
                className="h-64 w-full object-contain bg-background/60"
                loading="lazy"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Aguardando imagem</div>
            )}

            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent"
              initial={{ opacity: 0.25 }}
              animate={{ opacity: [0.25, 0.6, 0.25] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
              className="absolute left-0 right-0 h-10 bg-gradient-to-b from-primary/10 via-primary/25 to-primary/10"
              animate={{ y: ['-15%', '95%', '-15%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
            />

            <motion.div
              className="absolute inset-[18%] rounded-full border border-primary/30"
              animate={{ scale: [0.9, 1.03, 0.9], opacity: [0.2, 0.45, 0.2] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />

            {FACE_POINTS.map((point, index) => (
              <motion.span
                key={`${point.x}-${point.y}`}
                className="absolute h-2 w-2 rounded-full bg-primary"
                style={{ left: point.x, top: point.y }}
                animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.3, repeat: Infinity, delay: index * 0.05, ease: 'easeInOut' }}
              />
            ))}
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">Construindo identificação facial • {Math.round(progress)}%</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaceProcessingModal;