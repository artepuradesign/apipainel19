import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type BarcodeScannerProps = {
  onDetected: (code: string) => void;
  enabled?: boolean;
};

export default function BarcodeScanner({ onDetected, enabled = true }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modeLabel, setModeLabel] = useState('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    const stopScanner = () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const startScanner = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Seu navegador não suporta acesso à câmera.');
          return;
        }

        const BarcodeDetectorCtor = (window as Window & { BarcodeDetector?: any }).BarcodeDetector;
        if (BarcodeDetectorCtor) {
          setModeLabel('Leitura automática com detector nativo');

          const detector = new BarcodeDetectorCtor({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar'],
          });

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
            },
            audio: false,
          });

          if (!active || !videoRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const scanFrame = async () => {
            if (!active || !videoRef.current) return;

            try {
              if (videoRef.current.readyState >= 2) {
                const barcodes = await detector.detect(videoRef.current);
                const detectedCode = barcodes?.[0]?.rawValue?.trim();
                if (detectedCode) {
                  onDetected(detectedCode);
                  stopScanner();
                  return;
                }
              }
            } catch {
              // ignora erros transitórios de leitura
            }

            frameRef.current = requestAnimationFrame(scanFrame);
          };

          frameRef.current = requestAnimationFrame(scanFrame);
          return;
        }

        if (!videoRef.current) return;

        setModeLabel('Leitura automática com webcam (modo compatibilidade)');
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
            },
            audio: false,
          },
          videoRef.current,
          (result) => {
            const detectedCode = result?.getText()?.trim();
            if (!active || !detectedCode) return;
            onDetected(detectedCode);
            stopScanner();
          },
        );

        controlsRef.current = controls;
      } catch (scannerError) {
        setError(scannerError instanceof Error ? scannerError.message : 'Não foi possível iniciar a câmera.');
      }
    };

    startScanner();

    return () => {
      active = false;
      stopScanner();
    };
  }, [onDetected, enabled]);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border bg-muted/30">
        <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline autoPlay />
      </div>

      <p className="text-xs text-muted-foreground">Aponte a câmera para o código de barras do produto.</p>
      {modeLabel && <p className="text-xs text-muted-foreground">{modeLabel}</p>}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2 rounded-md border p-3">
        <Label htmlFor="manual-barcode">Código de barras manual</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="manual-barcode"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value.replace(/\s+/g, ''))}
            placeholder="Digite o código de barras"
          />
          <Button
            type="button"
            onClick={() => {
              if (!manualCode.trim()) return;
              onDetected(manualCode.trim());
            }}
          >
            Usar código
          </Button>
        </div>
      </div>
    </div>
  );
}