import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Download, Search, UserPlus, Link as LinkIcon, Loader2 } from 'lucide-react';
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

const MODULE_ID = 189;

type FacialCustomer = {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  photo: string | null;
  status: 'tem facial' | 'não tem';
  createdAt: string;
};

const toCsv = (rows: FacialCustomer[]) => {
  const header = ['Nome', 'CPF', 'E-mail', 'Telefone', 'Status', 'Data'];
  const data = rows.map((row) => [row.nome, row.cpf, row.email, row.telefone, row.status, row.createdAt]);
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

const FaceIdFacial = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const { hasActiveSubscription, subscription, calculateDiscountedPrice } = useUserSubscription();

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'tem facial' | 'não tem'>('todos');
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null);
  const [customers, setCustomers] = useState<FacialCustomer[]>([]);
  const { modalOpen, progress, startProcessing } = useFaceProcessingAnimation();

  const currentModule = useMemo(
    () => (modules || []).find((module: any) => Number(module?.id) === MODULE_ID) || null,
    [modules]
  );

  const ModuleIcon = useMemo(() => {
    const iconName = String(currentModule?.icon || 'Camera');
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || Camera;
  }, [currentModule?.icon]);

  const modulePrice = useMemo(() => Number(currentModule?.price ?? 0), [currentModule?.price]);
  const { discountedPrice: finalPrice, hasDiscount } = hasActiveSubscription && modulePrice > 0
    ? calculateDiscountedPrice(modulePrice)
    : { discountedPrice: modulePrice, hasDiscount: false };
  const userPlan = hasActiveSubscription && subscription
    ? subscription.plan_name
    : (user ? localStorage.getItem(`user_plan_${user.id}`) || 'Pré-Pago' : 'Pré-Pago');

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((item) => {
      const matchesSearch = !query
        || item.nome.toLowerCase().includes(query)
        || item.cpf.toLowerCase().includes(query)
        || item.email.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  const handlePhotoUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const previews = Array.from(files)
      .slice(0, 5)
      .map((file) => URL.createObjectURL(file));
    setPhotoPreviews(previews);
  };

  const handleCadastrar = async () => {
    if (!nome.trim() || !cpf.trim() || !email.trim() || !telefone.trim()) {
      toast.error('Preencha nome, CPF, e-mail e telefone');
      return;
    }

    setProcessing(true);
    await startProcessing(10000);

    const entry: FacialCustomer = {
      id: Date.now(),
      nome: nome.trim(),
      cpf: cpf.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      photo: photoPreviews[0] || null,
      status: photoPreviews.length ? 'tem facial' : 'não tem',
      createdAt: new Date().toLocaleString('pt-BR'),
    };

    const response = {
      module_id: MODULE_ID,
      action: 'faceid-facial.create',
      success: true,
      data: entry,
    };

    setCustomers((prev) => [entry, ...prev]);
    setApiResponse(response);
    setNome('');
    setCpf('');
    setEmail('');
    setTelefone('');
    setPhotoPreviews([]);
    setProcessing(false);
    toast.success('Cliente facial cadastrado com sucesso');
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0 max-w-full overflow-x-hidden">
      <SimpleTitleBar
        title={currentModule?.title || 'Cadastro de Facial'}
        subtitle={currentModule?.description || 'Cadastre clientes com fotos faciais para validações rápidas'}
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
        title="Cadastro facial com padrão de qualidade real"
        description="As imagens enviadas no cadastro devem seguir o padrão oficial para reduzir falhas em validações futuras."
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">faceid-facial</Badge>
              <Badge variant="outline">ID {MODULE_ID}</Badge>
            </div>
            <CardTitle>Novo cliente facial</CardTitle>
            <CardDescription>Preencha os dados do cliente e envie foto(s) para cadastrar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photos">Upload de foto(s) do rosto</Label>
              <Input id="photos" type="file" accept="image/*" multiple onChange={(e) => handlePhotoUpload(e.target.files)} />
            </div>

            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {photoPreviews.length > 0 ? photoPreviews.map((preview, index) => (
                <div key={preview} className="rounded-md border bg-muted/20 p-2">
                  <img src={preview} alt={`Pré-visualização ${index + 1}`} className="h-24 w-full rounded object-cover" loading="lazy" />
                </div>
              )) : (
                <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">Preview aparecerá aqui.</div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCadastrar} disabled={processing}>
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {processing ? 'Processando...' : 'Processar cadastro'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resposta da API</CardTitle>
            <CardDescription>Visualização JSON do retorno da integração.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">{JSON.stringify(apiResponse || { info: 'Aguardando processamento...' }, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>

      <FaceImageGuidelines />

      <Card>
        <CardHeader>
          <CardTitle>Clientes cadastrados</CardTitle>
          <CardDescription>Tabela responsiva com busca, filtro por status e exportação CSV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF ou e-mail" className="pl-9" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'tem facial' | 'não tem')}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="tem facial">Tem facial</option>
              <option value="não tem">Não tem</option>
            </select>
            <Button variant="outline" onClick={() => downloadCsv('faceid-facial-clientes.csv', toCsv(filteredCustomers))}>
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
                  <TableHead>CPF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum cliente encontrado.</TableCell>
                  </TableRow>
                ) : filteredCustomers.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.photo ? <img src={item.photo} alt={item.nome} className="h-10 w-10 rounded object-cover" loading="lazy" /> : <span className="text-xs text-muted-foreground">Sem foto</span>}
                    </TableCell>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>{item.cpf}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'tem facial' ? 'default' : 'secondary'}>{item.status}</Badge>
                    </TableCell>
                    <TableCell>{item.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FaceProcessingModal
        open={modalOpen}
        imageSrc={photoPreviews[0] || null}
        progress={progress}
        title="Criação de identificação facial"
        onOpenChange={() => {}}
      />
    </div>
  );
};

export default FaceIdFacial;