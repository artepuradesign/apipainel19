import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type FaceQualityHeroProps = {
  title: string;
  description: string;
};

const FaceQualityHero = ({ title, description }: FaceQualityHeroProps) => {
  return (
    <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 sm:p-6">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" aria-hidden />

      <div className="relative space-y-3">
        <Badge variant="secondary" className="w-fit">Padrão oficial de imagem facial</Badge>
        <div className="flex items-start gap-3">
          <div className="rounded-md border bg-background/80 p-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Use os exemplos abaixo como referência antes de enviar a foto para evitar reprovação por qualidade.
        </p>
      </div>
    </section>
  );
};

export default FaceQualityHero;