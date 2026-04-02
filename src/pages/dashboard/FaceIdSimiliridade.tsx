import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, Search, Settings, Users } from 'lucide-react';
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
import FaceProcessingAdvancedModal from '@/components/faceid/FaceProcessingAdvancedModal';
import { useFaceProcessingAnimation } from '@/hooks/useFaceProcessingAnimation';
import { faceSimilarityService, type FaceLandmark } from '@/services/faceSimilarityService';

const MODULE_ID = 191;
const MAX_RESULTS = 10;
const GUIDELINES_CLOSED_STORAGE_KEY = 'faceid-similiridade-guidelines-closed';

type SimilarityResult = {
  id: number;
  nome: string;
  cpf: string;
  photo_filename?: string;
  photo_url?: string | null;
  gender?: string | null;
  similaridade: number;
  data: string;
};

const loadMediaPipe = async () => {
  const importFromUrl = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
  return importFromUrl('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs');
};

const extractLandmarksFromImage = async (imageSrc: string): Promise<FaceLandmark[]> => {
  const img = new Image();
  img.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem para análise facial'));
  });

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
  const landmarks = result.faceLandmarks?.[0] as FaceLandmark[] | undefined;
  if (!landmarks || landmarks.length < 100) {
    throw new Error('Não foi possível detectar os pontos faciais na foto enviada');
  }

  return landmarks;
};

const toCsv = (rows: SimilarityResult[]) => {
  const header = ['Nome', 'CPF', 'Similaridade', 'Data'];
  const data = rows.map((item) => [item.nome, item.cpf, `${item.similaridade}%`, item.data]);
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

const FaceIdSimiliridade = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const { hasActiveSubscription, subscription, calculateDiscountedPrice } = useUserSubscription();

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [search, setSearch] = useState('');
  const [bestMatch, setBestMatch] = useState<SimilarityResult | null>(null);
  const [detailResult, setDetailResult] = useState<SimilarityResult | null>(null);
  const [detailProgress, setDetailProgress] = useState(0);
  const [genderFilter, setGenderFilter] = useState<'male' | 'female'>('male');
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null);
  const [guidelinesCollapsed, setGuidelinesCollapsed] = useState(false);
  const [guidelinesClosed, setGuidelinesClosed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(GUIDELINES_CLOSED_STORAGE_KEY) === 'true';
  });
  const { modalOpen, progress, startProcessing } = useFaceProcessingAnimation();

  const currentModule = useMemo(
    () => (modules || []).find((module: any) => Number(module?.id) === MODULE_ID) || null,
    [modules]
  );

  const ModuleIcon = useMemo(() => {
    const iconName = String(currentModule?.icon || 'Users');
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || Users;
  }, [currentModule?.icon]);

  const modulePrice = useMemo(() => Number(currentModule?.price ?? 0), [currentModule?.price]);
  const { discountedPrice: finalPrice, hasDiscount } = hasActiveSubscription && modulePrice > 0
    ? calculateDiscountedPrice(modulePrice)
    : { discountedPrice: modulePrice, hasDiscount: false };
  const userPlan = hasActiveSubscription && subscription
    ? subscription.plan_name
    : (user ? localStorage.getItem(`user_plan_${user.id}`) || 'Pré-Pago' : 'Pré-Pago');

  const filteredResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    return results.filter((item) =>
      !q ||
      item.nome.toLowerCase().includes(q) ||
      item.cpf.toLowerCase().includes(q) ||
      (item.photo_filename || '').toLowerCase().includes(q) ||
      (item.gender || '').toLowerCase().includes(q)
    );
  }, [results, search]);

  useEffect(() => {
    if (!detailResult) {
      setDetailProgress(0);
      return;
    }

    setDetailProgress(0);
    const startedAt = Date.now();
    const duration = 2600;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min((elapsed / duration) * 100, 100);
      setDetailProgress(next);
      if (next >= 100) {
        window.clearInterval(timer);
      }
    }, 60);

    return () => window.clearInterval(timer);
  }, [detailResult]);

  const handleUpload = (file: File | null) => {
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleProcess = async () => {
    if (!photoPreview) {
      toast.error('Envie uma foto para processar a similaridade');
      return;
    }

    try {
      setProcessing(true);

      const [landmarks, _animation] = await Promise.all([
        extractLandmarksFromImage(photoPreview),
        startProcessing(10000),
      ]);

      const response = await faceSimilarityService.searchByLandmarks(landmarks, MAX_RESULTS, 70, genderFilter);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Não foi possível buscar similaridade');
      }

      const now = new Date().toLocaleString('pt-BR');
      const parsedResults: SimilarityResult[] = response.data.results.map((item) => ({
        id: item.id,
        nome: item.photo_filename || `Registro #${item.id}`,
        cpf: '-',
        photo_filename: item.photo_filename,
        photo_url: item.photo_url,
        gender: item.gender,
        similaridade: item.similaridade,
        data: now,
      }));

      setResults(parsedResults);
      setBestMatch(parsedResults[0] || null);
      setDetailResult(null);
      setApiResponse({
        module_id: MODULE_ID,
        action: 'faceid-similiridade.search',
        success: true,
        data: {
          threshold: response.data.threshold,
          total_found: response.data.total_found,
          max_results: response.data.max_results,
          landmarks_points: landmarks.length,
          results: parsedResults,
        },
      });

      toast.success('Busca de similaridade finalizada');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar similaridade';
      toast.error(errorMessage);
      setResults([]);
      setBestMatch(null);
      setDetailResult(null);
      setApiResponse({
        module_id: MODULE_ID,
        action: 'faceid-similiridade.search',
        success: false,
        error: errorMessage,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 px-0 sm:space-y-6 max-w-full overflow-x-hidden">
      <SimpleTitleBar
        title={currentModule?.title || 'Verificação de Semelhança'}
        subtitle={currentModule?.description || 'Compare uma foto com a base de clientes e encontre os mais próximos'}
        icon={<ModuleIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
        onBack={() => navigate('/dashboard/cnpj-produtos')}
        useModuleMetadata={false}
      />

      {!guidelinesClosed ? (
        <FaceImageGuidelines
          collapsed={guidelinesCollapsed}
          onToggleCollapsed={() => setGuidelinesCollapsed((prev) => !prev)}
          onClose={() => {
            setGuidelinesClosed(true);
            window.localStorage.setItem(GUIDELINES_CLOSED_STORAGE_KEY, 'true');
          }}
        />
      ) : null}

      <div className="mt-4 md:mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 md:gap-6 lg:gap-8">
        <Card className="w-full">
          <CardHeader className="pb-4">
            <div className="relative rounded-lg border bg-gradient-to-br from-primary/10 via-background to-accent/10 shadow-sm transition-all duration-300">
              {hasDiscount ? (
                <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 pointer-events-none">
                  <Badge className="border-0 bg-gradient-to-r from-primary to-accent px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-lg">
                    OFF
                  </Badge>
                </div>
              ) : null}
              <div className="relative p-3.5 md:p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="h-10 w-1 flex-shrink-0 rounded-full bg-gradient-to-b from-primary to-accent" />
                    <div className="min-w-0">
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Plano Ativo</p>
                      <h3 className="truncate text-sm font-bold sm:text-base">{userPlan}</h3>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                    {hasDiscount ? <span className="text-[10px] text-muted-foreground line-through sm:text-xs">R$ {modulePrice.toFixed(2)}</span> : null}
                    <span className="whitespace-nowrap bg-gradient-to-r from-primary to-accent bg-clip-text text-xl font-bold text-transparent md:text-2xl">
                      R$ {finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">faceid-similiridade</Badge>
              <Badge variant="outline">ID {MODULE_ID}</Badge>
            </div>
            <CardTitle>Buscar por semelhança</CardTitle>
            <CardDescription>Envie a foto e retorne até 10 correspondências acima de 70%.</CardDescription>

            <div className="space-y-2">
              <Label htmlFor="facePhoto" className="text-success">Foto para busca</Label>
              <Input id="facePhoto" type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0] || null)} className="border-success/50 focus-visible:ring-success" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sexoBusca">Sexo para filtro</Label>
              <select
                id="sexoBusca"
                value={genderFilter}
                onChange={(e) => setGenderFilter((e.target.value as 'male' | 'female'))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>
            </div>
            <div className="rounded-md border bg-muted/20 p-2">
              {photoPreview ? (
                <div className="flex min-h-52 items-center justify-center overflow-hidden rounded bg-background/60">
                  <img
                    src={photoPreview}
                    alt="Foto para similaridade"
                    className="max-h-72 w-full rounded object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Preview da imagem enviada.</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleProcess} disabled={processing} className="w-full sm:w-auto">
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {processing ? 'Processando...' : 'Processar busca'}
              </Button>
            </div>

            {bestMatch ? (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded border bg-background/60 p-2">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Foto de referência</p>
                    {photoPreview ? (
                      <img src={photoPreview} alt="Referência enviada" className="h-52 w-full rounded object-contain" loading="lazy" />
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem referência</p>
                    )}
                  </div>
                  <div className="rounded border bg-background/60 p-2">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Melhor match</p>
                    {bestMatch.photo_url ? (
                      <img
                        src={bestMatch.photo_url}
                        alt={`Foto com similaridade ${bestMatch.similaridade}%`}
                        className="h-52 w-full rounded object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem foto</p>
                    )}
                  </div>
                </div>
                <p className="text-sm"><span className="font-semibold">Melhor match:</span> {bestMatch.nome}</p>
                <p className="text-sm"><span className="font-semibold">Arquivo:</span> {bestMatch.photo_filename || '-'}</p>
                <p className="text-sm"><span className="font-semibold">Sexo:</span> {bestMatch.gender || '-'}</p>
                <p className="text-sm"><span className="font-semibold">Similaridade:</span> {bestMatch.similaridade}%</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center text-lg sm:text-xl lg:text-2xl">
              <Settings className="mr-2 h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" />
              <span className="truncate">Resposta da API</span>
            </CardTitle>
            <CardDescription>JSON dos resultados retornados.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3 text-xs">
              {JSON.stringify(apiResponse || { info: 'Aguardando processamento...' }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resultados de semelhança</CardTitle>
            <CardDescription>Ordenados do maior para o menor, com limite de 10 registros.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar na tabela por nome/CPF" className="pl-9" />
            </div>
            <Button variant="outline" onClick={() => downloadCsv('faceid-similiridade-resultados.csv', toCsv(filteredResults))}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Similaridade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum resultado encontrado.</TableCell>
                  </TableRow>
                ) : filteredResults.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt={`Resultado com similaridade ${item.similaridade}%`}
                          className="h-12 w-12 rounded object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem foto</span>
                      )}
                    </TableCell>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>{item.photo_filename || '-'}</TableCell>
                    <TableCell>{item.gender || '-'}</TableCell>
                    <TableCell>{item.similaridade}%</TableCell>
                    <TableCell>{item.data}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setDetailResult(item)}>Ver detalhes</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FaceProcessingAdvancedModal
        open={modalOpen}
        imageSrc={photoPreview}
        progress={progress}
        title="Análise de similaridade facial"
        onOpenChange={() => {}}
      />

      <FaceProcessingAdvancedModal
        open={Boolean(detailResult)}
        imageSrc={detailResult?.photo_url || null}
        progress={detailProgress}
        title="Detalhes da correspondência"
        description="Animação de varredura com fixação dos pontos encontrados na foto correspondente."
        showProgress={false}
        details={
          detailResult ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <p><span className="font-semibold">Arquivo:</span> {detailResult.photo_filename || '-'}</p>
              <p><span className="font-semibold">Sexo:</span> {detailResult.gender || '-'}</p>
              <p><span className="font-semibold">Similaridade:</span> {detailResult.similaridade}%</p>
              <p><span className="font-semibold">Data:</span> {detailResult.data}</p>
            </div>
          ) : null
        }
        onOpenChange={(open) => {
          if (!open) setDetailResult(null);
        }}
      />
    </div>
  );
};

export default FaceIdSimiliridade;