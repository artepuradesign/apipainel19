import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Bot, KeyRound, MessageSquareText, Save, Link as LinkIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApiModules } from '@/hooks/useApiModules';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { cnpjChatInteligenteService } from '@/services/cnpjChatInteligenteService';

const MODULE_ID = 187;

const agentSchema = z.object({
  apiKey: z.string().trim().max(255, 'API Key inválida').optional().or(z.literal('')),
  agentName: z.string().trim().min(2, 'Informe o nome do agente').max(80, 'Máximo de 80 caracteres'),
  prompt: z.string().trim().min(20, 'Informe um prompt com mais contexto').max(5000, 'Máximo de 5000 caracteres'),
});

const CnpjChatInteligente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const { hasActiveSubscription, subscription, calculateDiscountedPrice } = useUserSubscription();
  const [form, setForm] = useState({
    apiKey: '',
    agentName: '',
    prompt: '',
  });
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);

  const currentModule = useMemo(
    () => (modules || []).find((module: any) => Number(module?.id) === MODULE_ID) || null,
    [modules]
  );

  const ModuleIcon = useMemo(() => {
    const iconName = String(currentModule?.icon || 'Bot');
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || Bot;
  }, [currentModule?.icon]);

  const modulePrice = useMemo(() => Number(currentModule?.price ?? 0), [currentModule?.price]);
  const { discountedPrice: finalPrice, hasDiscount } = hasActiveSubscription && modulePrice > 0
    ? calculateDiscountedPrice(modulePrice)
    : { discountedPrice: modulePrice, hasDiscount: false };
  const userPlan = hasActiveSubscription && subscription
    ? subscription.plan_name
    : (user ? localStorage.getItem(`user_plan_${user.id}`) || 'Pré-Pago' : 'Pré-Pago');

  const canFillMainFields = useMemo(() => form.apiKey.trim().length > 0, [form.apiKey]);

  useEffect(() => {
    const loadConfig = async () => {
      setLoadingConfig(true);
      const result = await cnpjChatInteligenteService.getAgentConfig();

      if (result.success && result.data) {
        setForm((prev) => ({
          ...prev,
          agentName: result.data?.agent_name || '',
          prompt: result.data?.prompt || '',
          apiKey: '',
        }));
        setHasSavedApiKey(Boolean(result.data?.has_api_key));
      }

      setLoadingConfig(false);
    };

    void loadConfig();
  }, []);

  const handleSave = async () => {
    if (!hasSavedApiKey && form.apiKey.trim().length < 20) {
      toast.error('Informe uma API Key válida da OpenAI');
      return;
    }

    const parsed = agentSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Verifique os campos do agente');
      return;
    }

    setSaving(true);
    try {
      const result = await cnpjChatInteligenteService.saveAgentConfig({
        agent_name: parsed.data.agentName,
        prompt: parsed.data.prompt,
        openai_api_key: parsed.data.apiKey,
        keep_existing_api_key: !parsed.data.apiKey.trim() && hasSavedApiKey,
      });

      if (!result.success) {
        toast.error(result.error || 'Não foi possível salvar a configuração do agente');
        return;
      }

      setHasSavedApiKey(true);
      setForm((prev) => ({ ...prev, apiKey: '' }));
      toast.success('Configuração do agente salva com sucesso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0 max-w-full overflow-x-hidden">
      <SimpleTitleBar
        title={currentModule?.title || 'CNPJ Chat Inteligente'}
        subtitle={currentModule?.description || 'Configure seu agente de IA para atendimento no WhatsApp'}
        icon={<ModuleIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
        onBack={() => navigate('/dashboard/cnpj-produtos')}
        useModuleMetadata={false}
        right={
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/cnpj-conexoes')}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Ir para conexões
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

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">OpenAI</Badge>
            <Badge variant="outline">WhatsApp Agent</Badge>
          </div>
          <CardTitle className="text-base sm:text-lg">Dados do agente</CardTitle>
          <CardDescription>
            Preencha a API Key e configure nome e prompt para criar o comportamento do seu agente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              API Key (OpenAI)
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={hasSavedApiKey ? 'Chave já cadastrada (preencha para substituir)' : 'sk-...'}
              value={form.apiKey}
              onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
            />
            {hasSavedApiKey ? <p className="text-xs text-muted-foreground">Já existe uma chave salva para este agente.</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agentName">Nome do agente</Label>
              <Input
                id="agentName"
                placeholder="Ex.: Assistente Comercial"
                disabled={!canFillMainFields && !hasSavedApiKey}
                value={form.agentName}
                onChange={(event) => setForm((prev) => ({ ...prev, agentName: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Canal</Label>
              <Input value="WhatsApp" disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt" className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" />
              Prompt do agente
            </Label>
            <Textarea
              id="prompt"
              placeholder="Explique como o agente deve responder, tom de voz, regras e limites..."
              className="min-h-44"
              disabled={!canFillMainFields && !hasSavedApiKey}
              value={form.prompt}
              onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/cnpj-conexoes')}>
              Configurar conexão WhatsApp
            </Button>
            <Button onClick={handleSave} disabled={saving || loadingConfig}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar agente'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CnpjChatInteligente;