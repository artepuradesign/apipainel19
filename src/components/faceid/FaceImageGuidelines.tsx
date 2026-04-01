import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import img2457 from '@/assets/faceid-exemplos/image-24-57.png';
import img4753 from '@/assets/faceid-exemplos/image-47-53.png';
import img4813 from '@/assets/faceid-exemplos/image-48-13.png';
import img4828 from '@/assets/faceid-exemplos/image-48-28.png';
import img4905 from '@/assets/faceid-exemplos/image-49-05.png';
import img4923 from '@/assets/faceid-exemplos/image-49-23.png';
import img4955 from '@/assets/faceid-exemplos/image-49-55.png';
import img5010 from '@/assets/faceid-exemplos/image-50-10.png';
import img5026 from '@/assets/faceid-exemplos/image-50-26.png';
import img5047 from '@/assets/faceid-exemplos/image-50-47.png';
import img5059 from '@/assets/faceid-exemplos/image-50-59.png';
import img5111 from '@/assets/faceid-exemplos/image-51-11.png';
import img5117 from '@/assets/faceid-exemplos/image-51-17.png';
import img2faces from '@/assets/faceid-exemplos/image-2faces.png';

const examples = [
  { title: 'Sem borrão ou sujeira', src: img2457 },
  { title: 'Contraste adequado', src: img4753 },
  { title: 'Cor e resolução adequadas', src: img4813 },
  { title: 'Olhos visíveis', src: img4828 },
  { title: 'Rosto reto', src: img4905 },
  { title: 'Fundo e enquadramento', src: img4923 },
  { title: 'Sem flash e olhos vermelhos', src: img4955 },
  { title: 'Sem sombras', src: img5010 },
  { title: 'Sem lente bloqueando olhos', src: img5026 },
  { title: 'Sem armação cobrindo olhos', src: img5047 },
  { title: 'Sem chapéu', src: img5059 },
  { title: 'Rosto descoberto', src: img5111 },
  { title: 'Proporção correta', src: img5117 },
  { title: 'Não enviar 2 faces na mesma imagem', src: img2faces },
];

const FaceImageGuidelines = () => {
  return (
    <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-background">
      <CardHeader>
        <CardTitle>Requisitos de imagem facial (padrão oficial)</CardTitle>
        <CardDescription>
          Referência de envio: face mínima 250x250 px (ideal 750x750), JPG/PNG/PDF, até 3MB, com fundo uniforme, boa nitidez e sem oclusões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {examples.map((item) => (
            <div key={item.title} className="rounded-md border bg-background/80 p-2 shadow-sm animate-fade-in">
              <img src={item.src} alt={`Exemplo oficial: ${item.title}`} className="h-40 w-full rounded object-cover" loading="lazy" />
              <p className="mt-2 text-xs font-medium text-foreground">{item.title}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FaceImageGuidelines;
