import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag } from 'lucide-react';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { useAuth } from '@/contexts/AuthContext';
import { cnpjProdutosService, type CnpjProduto } from '@/services/cnpjProdutosService';
import { normalizeProductPhotos, STORE_HIGHLIGHT_LABELS, getHighlightFromTags } from '@/components/cnpj-loja/storefrontUtils';

const formatPrice = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const CnpjProduto = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get('id') || 0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [produtos, setProdutos] = useState<CnpjProduto[]>([]);
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      const result = await cnpjProdutosService.list({
        limit: 200,
        offset: 0,
        cnpj: user?.cnpj || undefined,
        status: 'ativo',
      });

      if (!result.success || !result.data) {
        setProdutos([]);
        setError(result.error || 'Não foi possível carregar os produtos.');
        setLoading(false);
        return;
      }

      setProdutos(result.data.data || []);
      setLoading(false);
    };

    load();
  }, [user?.cnpj]);

  const produtoSelecionado = useMemo(() => {
    if (produtos.length === 0) return null;
    if (selectedId > 0) {
      const found = produtos.find((item) => item.id === selectedId);
      if (found) return found;
    }
    return produtos[0];
  }, [produtos, selectedId]);

  const imagens = useMemo(() => (produtoSelecionado ? normalizeProductPhotos(produtoSelecionado) : []), [produtoSelecionado]);

  useEffect(() => {
    setSelectedImage(imagens[0] || '');
  }, [imagens]);

  const imagemPrincipal = selectedImage || imagens[0] || '';

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0 max-w-full overflow-x-hidden">
      <SimpleTitleBar
        title="Produto para venda"
        subtitle="Página de exibição comercial do produto selecionado"
        icon={<ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />}
        onBack={() => navigate('/dashboard/cnpj-loja')}
      />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="h-[420px] w-full rounded-lg" />
          <Skeleton className="h-[420px] w-full rounded-lg" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : !produtoSelecionado ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Nenhum produto ativo disponível para exibição.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-6">
              {imagemPrincipal ? (
                <img
                  src={imagemPrincipal}
                  alt={`Imagem principal do produto ${produtoSelecionado.nome_produto}`}
                  className="h-[360px] w-full rounded-lg border object-contain"
                  loading="eager"
                />
              ) : (
                <div className="flex h-[360px] w-full items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
                  Sem imagem disponível
                </div>
              )}

              {imagens.length > 1 ? (
                <div className="grid grid-cols-4 gap-2">
                  {imagens.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className="overflow-hidden rounded-md border"
                    >
                      <img src={image} alt={`Miniatura de ${produtoSelecionado.nome_produto}`} className="h-16 w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{produtoSelecionado.categoria || 'Sem categoria'}</Badge>
                  {getHighlightFromTags(produtoSelecionado.tags) ? (
                    <Badge variant="outline">{STORE_HIGHLIGHT_LABELS[getHighlightFromTags(produtoSelecionado.tags)!]}</Badge>
                  ) : null}
                </div>
                <CardTitle className="text-xl">{produtoSelecionado.nome_produto}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-2xl font-bold">{formatPrice(produtoSelecionado.preco)}</p>
                <p className="text-muted-foreground">Empresa: {produtoSelecionado.nome_empresa}</p>
                <p className="text-muted-foreground">CNPJ: {produtoSelecionado.cnpj}</p>
                <p className="text-muted-foreground">Marca: {produtoSelecionado.marca || 'Não informada'}</p>
                <p className="text-muted-foreground">SKU: {produtoSelecionado.sku || 'Não informado'}</p>
                <Button className="w-full" asChild>
                  <a href={`/vendas/produto/${produtoSelecionado.id}`} target="_blank" rel="noreferrer">
                    Abrir página pública de venda
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outros produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {produtos.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams);
                      params.set('id', String(item.id));
                      setSearchParams(params);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate pr-2">{item.nome_produto}</span>
                    <span className="shrink-0 font-medium">{formatPrice(item.preco)}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default CnpjProduto;
