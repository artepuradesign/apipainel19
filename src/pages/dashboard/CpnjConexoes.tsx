import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Smartphone, Link as LinkIcon, Bot, CheckCircle2, RefreshCw, Copy, ShieldCheck, SmartphoneNfc } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import ReactQRCode from 'react-qr-code';
import { toast } from 'sonner';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiModules } from '@/hooks/useApiModules';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { cnpjChatInteligenteService, type WhatsAppConnection } from '@/services/cnpjChatInteligenteService';
import { fetchApiConfig, getApiUrl } from '@/config/api';

const MODULE_ID = 188;

const CpnjConexoes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const { hasActiveSubscription, subscription, calculateDiscountedPrice } = useUserSubscription();
  const [sessionName, setSessionName] = useState('Minha conexão WhatsApp');
  const [phone, setPhone] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('https://n8n.apipainel.com.br/webhook/waha-connect');
  const [wahaIp, setWahaIp] = useState('187.77.227.205');
  const [wahaPort, setWahaPort] = useState('3000');
  const [wahaApiKey, setWahaApiKey] = useState('');
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [keepConnected, setKeepConnected] = useState<boolean>(() => localStorage.getItem('cnpj_keep_connected_browser') !== '0');
  const [apiBase, setApiBase] = useState('https://api.apipainel.com.br');
  const [loadingConnections, setLoadingConnections] = useState(false);

  const currentModule = useMemo(
    () => (modules || []).find((module: any) => Number(module?.id) === MODULE_ID) || null,
    [modules]
  );

  const ModuleIcon = useMemo(() => {
    const iconName = String(currentModule?.icon || 'Link');
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || LinkIcon;
  }, [currentModule?.icon]);

  const modulePrice = useMemo(() => Number(currentModule?.price ?? 0), [currentModule?.price]);
  const { discountedPrice: finalPrice, hasDiscount } = hasActiveSubscription && modulePrice > 0
    ? calculateDiscountedPrice(modulePrice)
    : { discountedPrice: modulePrice, hasDiscount: false };
  const userPlan = hasActiveSubscription && subscription
    ? subscription.plan_name
    : (user ? localStorage.getItem(`user_plan_${user.id}`) || 'Pré-Pago' : 'Pré-Pago');

  const activeConnection = useMemo(
    () => connections.find((item) => item.connection_status === 'conectado') || null,
    [connections]
  );

  const selectedConnection = useMemo(() => {
    if (!connections.length) return null;
    if (!selectedConnectionId) return activeConnection || connections[0];
    return connections.find((item) => item.id === selectedConnectionId) || activeConnection || connections[0];
  }, [connections, selectedConnectionId, activeConnection]);

  const runtimeConfigUrl = useMemo(() => {
    if (!selectedConnection?.integration_token) return '';
    return `${apiBase}/cnpj-chatinteligente/n8n/runtime-config?token=${selectedConnection.integration_token}`;
  }, [apiBase, selectedConnection?.integration_token]);

  const syncStatusUrl = useMemo(() => {
    if (!selectedConnection?.integration_token) return '';
    return `${apiBase}/cnpj-chatinteligente/n8n/sync?token=${selectedConnection.integration_token}`;
  }, [apiBase, selectedConnection?.integration_token]);

  const qrPayload = useMemo(() => {
    const qr = selectedConnection?.qr_code?.trim() || '';
    if (!qr) return { mode: 'empty' as const, value: '' };

    if (qr.startsWith('data:image')) {
      return { mode: 'image' as const, value: qr };
    }

    if (qr.startsWith('http://') || qr.startsWith('https://')) {
      return { mode: 'image' as const, value: qr };
    }

    const looksLikeImageBase64 = /^[A-Za-z0-9+/=\n\r]+$/.test(qr) && qr.length > 120;
    if (looksLikeImageBase64) {
      return { mode: 'image' as const, value: `data:image/png;base64,${qr}` };
    }

    return { mode: 'raw' as const, value: qr };
  }, [selectedConnection?.qr_code]);

  const loadConnections = useCallback(async (silent = false) => {
    if (!silent) setLoadingConnections(true);
    const result = await cnpjChatInteligenteService.listConnections();
    if (result.success && result.data?.data) {
      setConnections(result.data.data);
      if (!selectedConnectionId && result.data.data.length > 0) {
        const preferred = result.data.data.find((item) => item.connection_status === 'conectado') || result.data.data[0];
        setSelectedConnectionId(preferred.id);
      }
    }
    if (!silent) setLoadingConnections(false);
  }, [selectedConnectionId]);

  useEffect(() => {
    const bootstrap = async () => {
      await fetchApiConfig();
      setApiBase(getApiUrl());
      await loadConnections();
    };
    void bootstrap();
  }, [loadConnections]);

  useEffect(() => {
    if (!selectedConnectionId) return;
    const timer = window.setInterval(() => {
      void loadConnections(true);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [selectedConnectionId, loadConnections]);

  useEffect(() => {
    localStorage.setItem('cnpj_keep_connected_browser', keepConnected ? '1' : '0');
  }, [keepConnected]);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const handleConnect = async () => {
    if (phone.replace(/\D+/g, '').length < 10) {
      toast.error('Informe um WhatsApp válido com DDD');
      return;
    }

    if (!n8nWebhookUrl.trim().startsWith('http')) {
      toast.error('Informe a URL do webhook do n8n');
      return;
    }

    if (!wahaIp.trim()) {
      toast.error('Informe o IP do WAHA');
      return;
    }

    const parsedPort = Number(wahaPort);
    if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      toast.error('Informe uma porta WAHA válida (1-65535)');
      return;
    }

    if (!wahaApiKey.trim()) {
      toast.error('Informe o token da API do WAHA');
      return;
    }

    setConnecting(true);
    try {
      const createResult = await cnpjChatInteligenteService.createConnection({
        session_name: sessionName.trim() || 'Minha conexão WhatsApp',
        whatsapp_number: phone.trim(),
      });

      if (!createResult.success || !createResult.data?.id) {
        toast.error(createResult.error || 'Não foi possível criar a conexão');
        return;
      }

      setSelectedConnectionId(createResult.data.id);

      const integrationToken = createResult.data.integration_token;
      if (!integrationToken) {
        toast.error('Conexão criada, mas sem integration_token para disparar o n8n');
        await loadConnections();
        return;
      }

      const n8nResult = await cnpjChatInteligenteService.triggerWahaConnect({
        webhook_url: n8nWebhookUrl.trim(),
        integration_token: integrationToken,
        ip: wahaIp.trim(),
        porta: parsedPort,
        api_key: wahaApiKey.trim(),
      });

      await loadConnections();

      if (!n8nResult.success) {
        toast.error(n8nResult.error || 'Conexão criada, mas falhou ao acionar o webhook do n8n');
        return;
      }

      toast.success('Conexão criada! n8n acionado, aguardando sincronização do QR.');
    } finally {
      setConnecting(false);
    }
  };

  const handleRotateToken = async () => {
    if (!selectedConnection?.id) return;
    const result = await cnpjChatInteligenteService.rotateConnectionToken({ id: selectedConnection.id });
    if (!result.success) {
      toast.error(result.error || 'Falha ao gerar novo token');
      return;
    }
    await loadConnections();
    toast.success('Novo token de integração gerado');
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0 max-w-full overflow-x-hidden">
      <SimpleTitleBar
        title={currentModule?.title || 'Conexões do Chat'}
        subtitle={currentModule?.description || 'Conecte o WhatsApp para o agente de IA atender seus clientes'}
        icon={<ModuleIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
        onBack={() => navigate('/dashboard/cnpj-chatinteligente')}
        useModuleMetadata={false}
        right={
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/cnpj-chatinteligente')}>
            <Bot className="mr-2 h-4 w-4" />
            Voltar ao agente
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

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">WhatsApp</Badge>
              <Badge variant="outline">Conexão ativa</Badge>
            </div>
            <CardTitle className="text-base sm:text-lg">Escaneie para entrar</CardTitle>
            <CardDescription>
              Use a câmera do seu celular para escanear o QR code e vincular esta sessão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="sessionName">Nome da conexão</Label>
                  <Input
                    id="sessionName"
                    value={sessionName}
                    onChange={(event) => setSessionName(event.target.value)}
                    placeholder="Ex.: WhatsApp Loja Centro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Conectar com número de telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">1. Abra o WhatsApp no celular</p>
                  <p className="text-muted-foreground">2. Toque em Dispositivos conectados</p>
                  <p className="text-muted-foreground">3. Escaneie o QR code novamente para acessar sua conta</p>
                </div>

                <div className="space-y-3 rounded-md border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">Configuração n8n + WAHA</p>
                  <div className="space-y-2">
                    <Label htmlFor="n8nWebhookUrl">Webhook n8n</Label>
                    <Input
                      id="n8nWebhookUrl"
                      value={n8nWebhookUrl}
                      onChange={(event) => setN8nWebhookUrl(event.target.value)}
                      placeholder="https://n8n.apipainel.com.br/webhook/waha-connect"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="wahaIp">IP WAHA</Label>
                      <Input
                        id="wahaIp"
                        value={wahaIp}
                        onChange={(event) => setWahaIp(event.target.value)}
                        placeholder="187.77.227.205"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wahaPort">Porta WAHA</Label>
                      <Input
                        id="wahaPort"
                        value={wahaPort}
                        onChange={(event) => setWahaPort(event.target.value)}
                        placeholder="3000"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wahaApiKey">Token API WAHA</Label>
                    <Input
                      id="wahaApiKey"
                      value={wahaApiKey}
                      onChange={(event) => setWahaApiKey(event.target.value)}
                      placeholder="token_user"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={keepConnected}
                    onChange={(event) => setKeepConnected(event.target.checked)}
                  />
                  Continuar conectado neste navegador
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => navigate('/dashboard/cnpj-chatinteligente')}>
                    Ajustar agente
                  </Button>
                  <Button onClick={handleConnect} disabled={connecting}>
                    <Smartphone className="mr-2 h-4 w-4" />
                    {connecting ? 'Conectando...' : 'Conectar WhatsApp'}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mx-auto flex h-48 w-48 items-center justify-center overflow-hidden rounded-md border bg-background">
                  {qrPayload.mode === 'image' ? (
                    <img src={qrPayload.value} alt="QR code do WhatsApp" className="h-full w-full object-contain" loading="lazy" />
                  ) : qrPayload.mode === 'raw' ? (
                    <div className="rounded-md bg-white p-2">
                      <ReactQRCode value={qrPayload.value} size={170} />
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <QrCode className="mx-auto mb-2 h-7 w-7" />
                      <p className="text-xs">QR code aparecerá aqui</p>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {selectedConnection?.connection_status === 'conectado'
                    ? 'Sessão conectada com sucesso.'
                    : 'Aguardando QR do seu provedor Baileys/n8n.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conexões cadastradas</Label>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {connections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma conexão criada ainda.</p>
                ) : (
                  connections.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedConnectionId(item.id)}
                      className={`w-full rounded-md border p-3 text-left transition ${selectedConnection?.id === item.id ? 'bg-muted/40' : 'bg-background'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{item.session_name}</p>
                        <Badge variant={item.connection_status === 'conectado' ? 'default' : 'secondary'}>{item.connection_status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.whatsapp_number}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status da integração</CardTitle>
            <CardDescription>Acompanhe QR, pareamento por número e endpoints do n8n.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                {activeConnection ? <CheckCircle2 className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                {activeConnection ? 'Conexão pronta para uso' : 'Aguardando conexão'}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeConnection
                  ? 'Seu WhatsApp está vinculado e pronto para receber mensagens com IA.'
                  : 'Preencha os dados e clique em conectar para iniciar o vínculo com seu WhatsApp.'}
              </p>
              {selectedConnection ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sessão selecionada: <strong>{selectedConnection.session_name}</strong> • Número: <strong>{selectedConnection.whatsapp_number}</strong>
                </p>
              ) : null}
              {selectedConnection?.pairing_code ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Código de telefone: <strong>{selectedConnection.pairing_code}</strong>
                </p>
              ) : null}
              {selectedConnection?.connection_error ? (
                <p className="mt-2 text-xs text-muted-foreground">Erro atual: {selectedConnection.connection_error}</p>
              ) : null}
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Token da integração</p>
                <Button type="button" variant="outline" size="sm" onClick={handleRotateToken} disabled={!selectedConnection?.id}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Gerar novo
                </Button>
              </div>
              <Input value={selectedConnection?.integration_token || ''} readOnly placeholder="Crie uma conexão para gerar token" />
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Endpoint Runtime Config (n8n → API)</p>
              <div className="flex items-center gap-2">
                <Input value={runtimeConfigUrl} readOnly placeholder="Selecione uma conexão" />
                <Button type="button" variant="outline" size="icon" onClick={() => void handleCopy(runtimeConfigUrl, 'URL runtime')} disabled={!runtimeConfigUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Endpoint Sync Status (n8n → API)</p>
              <div className="flex items-center gap-2">
                <Input value={syncStatusUrl} readOnly placeholder="Selecione uma conexão" />
                <Button type="button" variant="outline" size="icon" onClick={() => void handleCopy(syncStatusUrl, 'URL de sync')} disabled={!syncStatusUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => void loadConnections()} disabled={loadingConnections}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar agora
              </Button>
              <Button className="w-full" variant="outline" onClick={() => navigate('/dashboard/cnpj-chatinteligente')}>
                <SmartphoneNfc className="mr-2 h-4 w-4" />
                Ir para agente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CpnjConexoes;