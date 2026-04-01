import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cnpjProdutosService, type CnpjProduto } from '@/services/cnpjProdutosService';

const VendaProduto = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [produto, setProduto] = useState<CnpjProduto | null>(null);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    const load = async () => {
      const productId = Number(id);
      if (!Number.isFinite(productId) || productId <= 0) {
        setError('Produto inválido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      const result = await cnpjProdutosService.detalhePublico(productId);

      if (!result.success || !result.data) {
        setError(result.error || 'Produto não encontrado.');
        setProduto(null);
        setLoading(false);
        return;
      }

      setProduto(result.data);
      const firstImage =
        result.data.external_featured_image_url ||
        (Array.isArray(result.data.fotos) && result.data.fotos.length > 0 ? result.data.fotos[0] : '');
      setSelectedImage(firstImage || '');
      setLoading(false);
    };

    load();
  }, [id]);

  const images = useMemo(() => {
    if (!produto) return [];
    const merged = [produto.external_featured_image_url, ...(produto.fotos || [])].filter(
      (item): item is string => Boolean(item && item.trim())
    );

    return Array.from(new Set(merged));
  }, [produto]);

  const preco = useMemo(() => {
    if (!produto) return 'R$ 0,00';
    return Number(produto.preco || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }, [produto]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[360px] w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (error || !produto) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Produto indisponível</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{error || 'Não foi possível carregar o produto.'}</p>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        <header className="space-y-3">
          <Badge variant="secondary">Produto disponível</Badge>
          <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{produto.nome_produto}</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Comercializado por <span className="font-medium text-foreground">{produto.nome_empresa}</span> • CNPJ {produto.cnpj}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardContent className="space-y-4 p-4 md:p-6">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={`Imagem principal do produto ${produto.nome_produto}`}
                  className="h-[340px] w-full rounded-lg border object-contain"
                  loading="eager"
                />
              ) : (
                <div className="flex h-[340px] w-full items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
                  Sem imagem disponível
                </div>
              )}

              {images.length > 1 ? (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className="overflow-hidden rounded-md border"
                      aria-label="Selecionar imagem do produto"
                    >
                      <img src={image} alt={`Miniatura de ${produto.nome_produto}`} loading="lazy" className="h-16 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{preco}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SKU</span>
                  <span className="font-medium">{produto.sku || 'Não informado'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Código de barras</span>
                  <span className="font-medium">{produto.codigo_barras || 'Não informado'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Categoria</span>
                  <span className="font-medium">{produto.categoria || 'Não informada'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Marca</span>
                  <span className="font-medium">{produto.marca || 'Não informada'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estoque</span>
                  <span className="font-medium">
                    {produto.controlar_estoque === true || produto.controlar_estoque === 1 ? produto.estoque : 'Não controlado'}
                  </span>
                </div>
                <Button className="w-full" type="button">
                  Solicitar orçamento
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalhes comerciais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Empresa:</span> {produto.nome_empresa}
                </p>
                <p>
                  <span className="font-medium text-foreground">CNPJ:</span> {produto.cnpj}
                </p>
                <p>
                  <span className="font-medium text-foreground">Tags:</span> {produto.tags || 'Não informadas'}
                </p>
                <p>
                  <span className="font-medium text-foreground">ID interno:</span> #{produto.id}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
};

export default VendaProduto;