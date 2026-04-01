import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, Search, Users } from 'lucide-react';
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

const MODULE_ID = 191;
const MAX_RESULTS = 20;
const GUIDELINES_CLOSED_STORAGE_KEY = 'faceid-similiridade-guidelines-closed';

type SimilarityResult = {
  id: number;
  nome: string;
  cpf: string;
  similaridade: number;
  data: string;
};

const mockPeopleBase = [
  { nome: 'Ana Souza', cpf: '111.111.111-11' },
  { nome: 'Bruno Costa', cpf: '222.222.222-22' },
  { nome: 'Carla Lima', cpf: '333.333.333-33' },
  { nome: 'Daniel Nunes', cpf: '444.444.444-44' },
  { nome: 'Elisa Prado', cpf: '555.555.555-55' },
  { nome: 'Fábio Alves', cpf: '666.666.666-66' },
  { nome: 'Gabriela Rocha', cpf: '777.777.777-77' },
  { nome: 'Henrique Melo', cpf: '888.888.888-88' },
  { nome: 'Isabela Freitas', cpf: '999.999.999-99' },
  { nome: 'João Matos', cpf: '101.101.101-10' },
  { nome: 'Kelly Pires', cpf: '202.202.202-20' },
  { nome: 'Lucas Bernardes', cpf: '303.303.303-30' },
  { nome: 'Marina Teixeira', cpf: '404.404.404-40' },
  { nome: 'Natan Ribeiro', cpf: '505.505.505-50' },
  { nome: 'Olivia Santos', cpf: '606.606.606-60' },
  { nome: 'Paulo Viana', cpf: '707.707.707-70' },
  { nome: 'Queila Gomes', cpf: '808.808.808-80' },
  { nome: 'Rafael Moraes', cpf: '909.909.909-90' },
  { nome: 'Silvia Campos', cpf: '123.123.123-12' },
  { nome: 'Tiago Dantas', cpf: '321.321.321-32' },
  { nome: 'Ursula Azevedo', cpf: '456.456.456-45' },
  { nome: 'Vitor Kato', cpf: '654.654.654-65' },
] as const;

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
  const [nomeCpfFilter, setNomeCpfFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedResult, setSelectedResult] = useState<SimilarityResult | null>(null);
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
    return results.filter((item) => !q || item.nome.toLowerCase().includes(q) || item.cpf.toLowerCase().includes(q));
  }, [results, search]);

  const handleUpload = (file: File | null) => {
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleProcess = async () => {
    if (!photoPreview) {
      toast.error('Envie uma foto para processar a similaridade');
      return;
    }

    setProcessing(true);
    await startProcessing(10000);

    const filteredBase = mockPeopleBase.filter((person) => {
      const term = nomeCpfFilter.toLowerCase().trim();
      if (!term) return true;
      return person.nome.toLowerCase().includes(term) || person.cpf.toLowerCase().includes(term);
    });

    const generated = filteredBase
      .map((person, index) => ({
        id: Date.now() + index,
        nome: person.nome,
        cpf: person.cpf,
        similaridade: Math.floor(Math.random() * 31) + 70,
        data: new Date().toLocaleString('pt-BR'),
      }))
      .filter((item) => item.similaridade >= 70)
      .sort((a, b) => b.similaridade - a.similaridade)
      .slice(0, MAX_RESULTS);

    setResults(generated);
    setSelectedResult(generated[0] || null);
    setApiResponse({
      module_id: MODULE_ID,
      action: 'faceid-similiridade.search',
      success: true,
      data: {
        threshold: 70,
        total_found: generated.length,
        max_results: MAX_RESULTS,
        results: generated,
      },
    });
    setProcessing(false);
    toast.success('Busca de similaridade finalizada');
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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">faceid-similiridade</Badge>
              <Badge variant="outline">ID {MODULE_ID}</Badge>
            </div>
            <CardTitle>Buscar por semelhança</CardTitle>
            <CardDescription>Envie a foto e retorne até 20 correspondências acima de 70%.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="facePhoto">Foto para busca</Label>
              <Input id="facePhoto" type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0] || null)} />
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
            <div className="space-y-2">
              <Label htmlFor="filterNameCpf">Filtro por nome/CPF</Label>
              <Input id="filterNameCpf" value={nomeCpfFilter} onChange={(e) => setNomeCpfFilter(e.target.value)} placeholder="Opcional para refinar antes da busca" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleProcess} disabled={processing} className="w-full sm:w-auto">
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {processing ? 'Processando...' : 'Processar busca'}
              </Button>
            </div>

            {selectedResult ? (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <p className="text-sm"><span className="font-semibold">Melhor match:</span> {selectedResult.nome}</p>
                <p className="text-sm"><span className="font-semibold">CPF:</span> {selectedResult.cpf}</p>
                <p className="text-sm"><span className="font-semibold">Similaridade:</span> {selectedResult.similaridade}%</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resposta da API</CardTitle>
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
          <CardDescription>Ordenados do maior para o menor, com limite de 20 registros.</CardDescription>
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
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Similaridade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum resultado encontrado.</TableCell>
                  </TableRow>
                ) : filteredResults.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>{item.cpf}</TableCell>
                    <TableCell>{item.similaridade}%</TableCell>
                    <TableCell>{item.data}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedResult(item)}>Ver detalhes</Button>
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
    </div>
  );
};

export default FaceIdSimiliridade;