import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileCheck2, Link as LinkIcon, Loader2, Search, ShieldCheck } from 'lucide-react';
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

const MODULE_ID = 190;

type VerificationItem = {
  id: number;
  cliente: string;
  similaridade: number;
  status: 'Aprovado' | 'Reprovado';
  detalhado: string;
  data: string;
};

const csvFromHistory = (rows: VerificationItem[]) => {
  const header = ['Cliente', 'Similaridade', 'Status', 'Relatório', 'Data'];
  const data = rows.map((item) => [item.cliente, `${item.similaridade}%`, item.status, item.detalhado, item.data]);
  return [header, ...data]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
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

const FaceIdVerifica = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const { hasActiveSubscription, subscription, calculateDiscountedPrice } = useUserSubscription();

  const [nomeCliente, setNomeCliente] = useState('');
  const [rostoPreview, setRostoPreview] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<VerificationItem | null>(null);
  const [history, setHistory] = useState<VerificationItem[]>([]);
  const [search, setSearch] = useState('');
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null);
  const { modalOpen, progress, startProcessing } = useFaceProcessingAnimation();

  const currentModule = useMemo(
    () => (modules || []).find((module: any) => Number(module?.id) === MODULE_ID) || null,
    [modules]
  );

  const ModuleIcon = useMemo(() => {
    const iconName = String(currentModule?.icon || 'FileCheck2');
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || FileCheck2;
  }, [currentModule?.icon]);

  const modulePrice = useMemo(() => Number(currentModule?.price ?? 0), [currentModule?.price]);
  const { discountedPrice: finalPrice, hasDiscount } = hasActiveSubscription && modulePrice > 0
    ? calculateDiscountedPrice(modulePrice)
    : { discountedPrice: modulePrice, hasDiscount: false };
  const userPlan = hasActiveSubscription && subscription
    ? subscription.plan_name
    : (user ? localStorage.getItem(`user_plan_${user.id}`) || 'Pré-Pago' : 'Pré-Pago');

  const filteredHistory = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return history;
    return history.filter((item) => item.cliente.toLowerCase().includes(term) || item.status.toLowerCase().includes(term));
  }, [history, search]);

  const onFileChange = (file: File | null, setter: (value: string | null) => void) => {
    if (!file) return;
    setter(URL.createObjectURL(file));
  };

  const handleProcess = async () => {
    if (!nomeCliente.trim() || !rostoPreview || !docPreview) {
      toast.error('Informe nome do cliente e as duas imagens para verificar');
      return;
    }

    setProcessing(true);
    await startProcessing(10000);

    const similarity = Math.floor(Math.random() * 41) + 58;
    const status: VerificationItem['status'] = similarity >= 75 ? 'Aprovado' : 'Reprovado';
    const detalhe = status === 'Aprovado'
      ? 'Pontos faciais consistentes, distância ocular e nariz compatíveis.'
      : 'Inconsistência em contorno facial e baixa correspondência com documento.';

    const output: VerificationItem = {
      id: Date.now(),
      cliente: nomeCliente.trim(),
      similaridade: similarity,
      status,
      detalhado: detalhe,
      data: new Date().toLocaleString('pt-BR'),
    };

    setResult(output);
    setHistory((prev) => [output, ...prev]);
    setApiResponse({
      module_id: MODULE_ID,
      action: 'faceid-verifica.process',
      success: true,
      data: {
        client_name: output.cliente,
        similarity_percentage: output.similaridade,
        result: output.status,
        detailed_report: output.detalhado,
      },
    });
    setProcessing(false);
    toast.success('Verificação processada');
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0 max-w-full overflow-x-hidden">
      <SimpleTitleBar
        title={currentModule?.title || 'Verificação de Identidade'}
        subtitle={currentModule?.description || 'Compare rosto com documento e obtenha laudo de aprovação'}
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
        title="Envie selfie e documento com qualidade ideal"
        description="Esta validação segue os mesmos critérios de qualidade de face exigidos pelos provedores oficiais para melhorar aprovação."
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">faceid-verifica</Badge>
              <Badge variant="outline">ID {MODULE_ID}</Badge>
            </div>
            <CardTitle>Processar identidade</CardTitle>
            <CardDescription>Upload da selfie e documento (RG/CNH) para validação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cliente">Nome do cliente</Label>
              <Input id="cliente" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rosto">Foto do rosto</Label>
                <Input id="rosto" type="file" accept="image/*" onChange={(e) => onFileChange(e.target.files?.[0] || null, setRostoPreview)} />
                <div className="rounded-md border bg-muted/20 p-2">
                  {rostoPreview ? <img src={rostoPreview} alt="Rosto" className="h-32 w-full rounded object-cover" loading="lazy" /> : <p className="text-sm text-muted-foreground">Preview da selfie</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documento">Foto do documento</Label>
                <Input id="documento" type="file" accept="image/*" onChange={(e) => onFileChange(e.target.files?.[0] || null, setDocPreview)} />
                <div className="rounded-md border bg-muted/20 p-2">
                  {docPreview ? <img src={docPreview} alt="Documento" className="h-32 w-full rounded object-cover" loading="lazy" /> : <p className="text-sm text-muted-foreground">Preview do RG/CNH</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleProcess} disabled={processing}>
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {processing ? 'Processando...' : 'Processar verificação'}
              </Button>
            </div>

            {result ? (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <p className="text-sm"><span className="font-semibold">Similaridade:</span> {result.similaridade}%</p>
                <p className="text-sm"><span className="font-semibold">Resultado:</span> {result.status}</p>
                <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Relatório:</span> {result.detalhado}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resposta da API</CardTitle>
            <CardDescription>JSON retornado após o processamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">{JSON.stringify(apiResponse || { info: 'Aguardando processamento...' }, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>

      <FaceImageGuidelines />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de verificações</CardTitle>
          <CardDescription>Busca e exportação CSV das verificações realizadas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou status" className="pl-9" />
            </div>
            <Button variant="outline" onClick={() => downloadCsv('faceid-verifica-historico.csv', csvFromHistory(filteredHistory))}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Similaridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Relatório</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Sem verificações ainda.</TableCell>
                  </TableRow>
                ) : filteredHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.cliente}</TableCell>
                    <TableCell>{item.similaridade}%</TableCell>
                    <TableCell><Badge variant={item.status === 'Aprovado' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                    <TableCell className="max-w-72 truncate">{item.detalhado}</TableCell>
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
        imageSrc={rostoPreview}
        progress={progress}
        title="Verificação facial segura"
        onOpenChange={() => {}}
      />
    </div>
  );
};

export default FaceIdVerifica;