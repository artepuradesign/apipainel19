import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Link as LinkIcon, Loader2, Search, Sparkles } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiModules } from '@/hooks/useApiModules';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import FaceImageGuidelines from '@/components/faceid/FaceImageGuidelines';
import FaceProcessingModal from '@/components/faceid/FaceProcessingModal';
import { useFaceProcessingAnimation } from '@/hooks/useFaceProcessingAnimation';
import FaceQualityHero from '@/components/faceid/FaceQualityHero';

const MODULE_ID = 193;

type AnalysisResult = {
  id: number;
  idade: number;
  genero: 'Masculino' | 'Feminino';
  confianca: number;
  data: string;
};

const toCsv = (rows: AnalysisResult[]) => {
  const header = ['Idade estimada', 'Gênero', 'Confiança', 'Data'];
  const data = rows.map((row) => [row.idade, row.genero, `${row.confianca}%`, row.data]);
  return [header, ...data].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
};

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const FaceIdIdadeg = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const { hasActiveSubscription, subscription, calculateDiscountedPrice } = useUserSubscription();

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [search, setSearch] = useState('');
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null);
  const { modalOpen, progress, startProcessing } = useFaceProcessingAnimation();

  const currentModule = useMemo(
    () => (modules || []).find((module: any) => Number(module?.id) === MODULE_ID) || null,
    [modules]
  );

  const ModuleIcon = useMemo(() => {
    const iconName = String(currentModule?.icon || 'Sparkles');
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || Sparkles;
  }, [currentModule?.icon]);

  const modulePrice = useMemo(() => Number(currentModule?.price ?? 0), [currentModule?.price]);
  const { discountedPrice: finalPrice, hasDiscount } = hasActiveSubscription && modulePrice > 0
    ? calculateDiscountedPrice(modulePrice)
    : { discountedPrice: modulePrice, hasDiscount: false };
  const userPlan = hasActiveSubscription && subscription
    ? subscription.plan_name
    : (user ? localStorage.getItem(`user_plan_${user.id}`) || 'Pré-Pago' : 'Pré-Pago');

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((item) => !q || item.genero.toLowerCase().includes(q) || String(item.idade).includes(q));
  }, [history, search]);

  const handleUpload = (file: File | null) => {
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleProcess = async () => {
    if (!photoPreview) {
      toast.error('Envie uma foto para estimativa de idade e gênero');
      return;
    }

    setProcessing(true);
    await startProcessing(10000);

    const result: AnalysisResult = {
      id: Date.now(),
      idade: Math.floor(Math.random() * 40) + 18,
      genero: Math.random() > 0.5 ? 'Masculino' : 'Feminino',
      confianca: Math.floor(Math.random() * 21) + 78,
      data: new Date().toLocaleString('pt-BR'),
    };

    setCurrentResult(result);
    setHistory((prev) => [result, ...prev]);
    setApiResponse({
      module_id: MODULE_ID,
      action: 'faceid-idadeg.estimate',
      success: true,
      data: {
        estimated_age: result.idade,
        gender: result.genero,
        confidence: result.confianca,
      },
    });
    setProcessing(false);
    toast.success('Estimativa concluída');
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0 max-w-full overflow-x-hidden">
      <SimpleTitleBar
        title={currentModule?.title || 'Estimativa de Idade e Gênero'}
        subtitle={currentModule?.description || 'Analise facial com idade aproximada, gênero e nível de confiança'}
        icon={<ModuleIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
        onBack={() => navigate('/dashboard/cnpj-produtos')}
        useModuleMetadata={false}
        right={
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/cnpj-produtos')}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Plano Ativo</p>
              <p className="text-sm sm:text-base font-semibold truncate">{userPlan}</p>
            </div>
            <div className="text-right shrink-0">
              {hasDiscount ? <p className="text-xs text-muted-foreground line-through">R$ {modulePrice.toFixed(2)}</p> : null}
              <p className="text-lg sm:text-xl font-bold">R$ {finalPrice.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Valor do módulo {MODULE_ID}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <FaceQualityHero
        title="Qualidade da imagem impacta idade e gênero estimados"
        description="Para estimativas consistentes, envie imagem frontal, sem sombras e com olhos totalmente visíveis."
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">faceid-idadeg</Badge>
              <Badge variant="outline">ID {MODULE_ID}</Badge>
            </div>
            <CardTitle>Análise de idade e gênero</CardTitle>
            <CardDescription>Faça upload da foto e receba o resultado com confiança estimada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="analysisPhoto">Foto para análise</Label>
              <Input id="analysisPhoto" type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0] || null)} />
            </div>
            <div className="rounded-md border bg-muted/20 p-2">
              {photoPreview ? <img src={photoPreview} alt="Preview da foto para análise" className="h-44 w-full rounded object-cover" loading="lazy" /> : <p className="text-sm text-muted-foreground">Preview da imagem enviada.</p>}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleProcess} disabled={processing}>
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {processing ? 'Processando...' : 'Processar análise'}
              </Button>
            </div>

            {currentResult ? (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <p className="text-sm"><span className="font-semibold">Idade aproximada:</span> {currentResult.idade} anos</p>
                <p className="text-sm"><span className="font-semibold">Gênero:</span> {currentResult.genero}</p>
                <p className="text-sm"><span className="font-semibold">Nível de confiança:</span> {currentResult.confianca}%</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resposta da API</CardTitle>
            <CardDescription>JSON retornado para integração.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">{JSON.stringify(apiResponse || { info: 'Aguardando processamento...' }, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>

      <FaceImageGuidelines />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de análises</CardTitle>
          <CardDescription>Tabela responsiva com busca e exportação CSV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por idade/gênero" className="pl-9" />
            </div>
            <Button variant="outline" onClick={() => downloadCsv('faceid-idadeg-historico.csv', toCsv(filteredHistory))}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Idade</TableHead>
                  <TableHead>Gênero</TableHead>
                  <TableHead>Confiança</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma análise realizada.</TableCell>
                  </TableRow>
                ) : filteredHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.idade} anos</TableCell>
                    <TableCell>{item.genero}</TableCell>
                    <TableCell>{item.confianca}%</TableCell>
                    <TableCell>{item.data}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FaceProcessingModal
        open={modalOpen}
        imageSrc={photoPreview}
        progress={progress}
        title="Estimativa facial em execução"
        onOpenChange={() => {}}
      />
    </div>
  );
};

export default FaceIdIdadeg;