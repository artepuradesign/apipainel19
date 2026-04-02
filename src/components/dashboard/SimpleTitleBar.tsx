import React, { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Package } from "lucide-react";
import * as Icons from "lucide-react";
import { useLocation } from "react-router-dom";
import { useApiModules } from "@/hooks/useApiModules";

interface SimpleTitleBarProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  useModuleMetadata?: boolean;
}

const SimpleTitleBar = ({
  title,
  subtitle,
  onBack,
  icon,
  right,
  useModuleMetadata = true,
}: SimpleTitleBarProps) => {
  const location = useLocation();
  const { modules } = useApiModules();

  const normalizedPath = useMemo(() => {
    const path = (location?.pathname || "").trim();
    // ignora query/hash (pathname já vem limpo, mas deixamos robusto)
    return path || "/";
  }, [location?.pathname]);

  const currentModule = useMemo(() => {
    const normalizeToPath = (raw: string): string => {
      if (!raw) return "";
      const trimmed = raw.trim();
      if (trimmed.startsWith("/dashboard/")) return trimmed;
      if (trimmed.startsWith("dashboard/")) return `/${trimmed}`;
      if (trimmed.startsWith("/")) return `/dashboard${trimmed}`;
      return `/dashboard/${trimmed}`;
    };

    console.log('🔍 [SimpleTitleBar] Buscando módulo para:', normalizedPath);
    console.log('🔍 [SimpleTitleBar] Total de módulos:', modules?.length);

    const match = (modules || []).find((m: any) => {
      const apiEndpoint = normalizeToPath(m?.api_endpoint || "");
      const modulePath = normalizeToPath(m?.path || "");
      
      const isMatch = (apiEndpoint && apiEndpoint === normalizedPath) || 
             (modulePath && modulePath === normalizedPath);
      
      if (isMatch) {
        console.log('✅ [SimpleTitleBar] Módulo encontrado:', m?.title, 'icon:', m?.icon);
      }
      
      return isMatch;
    });

    if (!match) {
      console.log('❌ [SimpleTitleBar] Nenhum módulo encontrado para:', normalizedPath);
      // Log dos primeiros 5 módulos para debug
      (modules || []).slice(0, 5).forEach((m: any) => {
        console.log('  📦 Módulo:', m?.title, '| api_endpoint:', m?.api_endpoint, '| path:', m?.path);
      });
    }

    return match || null;
  }, [modules, normalizedPath]);

  const moduleTitle = currentModule?.title?.toString().trim() || "";
  const moduleDescription = currentModule?.description?.toString().trim() || "";

  // Obter o componente do ícone dinamicamente
  const ModuleIcon = useMemo(() => {
    if (icon) return null; // Se já foi passado um ícone, não precisamos buscar

    const iconName = currentModule?.icon;
    if (!iconName) return Package;

    const IconComponent = Icons[iconName as keyof typeof Icons] as React.ComponentType<any>;
    return IconComponent || Package;
  }, [currentModule?.icon, icon]);

  // Obter a cor do módulo
  const moduleColor = currentModule?.color || null;

  const displayTitle = useModuleMetadata ? (moduleTitle || title) : title;
  const displaySubtitle = useModuleMetadata ? (moduleDescription || subtitle) : subtitle;

  // Gerar estilos dinâmicos baseados na cor do módulo
  const getIconStyles = () => {
    if (moduleColor) {
      return {
        backgroundColor: `${moduleColor}15`, // 15% opacity
        borderColor: `${moduleColor}30`, // 30% opacity
      };
    }
    return {};
  };

  // Renderizar o ícone grande à esquerda
  const renderLargeIcon = () => {
    if (icon) {
      return (
        <div 
          className="shrink-0 p-1.5 md:p-2 rounded-lg border"
          style={moduleColor ? getIconStyles() : undefined}
        >
          <span style={moduleColor ? { color: moduleColor } : undefined} className={!moduleColor ? "text-primary" : ""}>
            {icon}
          </span>
        </div>
      );
    }
    
    // Mostrar ícone dinâmico em todas as telas
    if (ModuleIcon) {
      return (
        <div 
          className="shrink-0 p-1.5 md:p-2 rounded-lg border"
          style={moduleColor ? getIconStyles() : undefined}
        >
          <ModuleIcon 
            className="h-6 w-6 md:h-8 md:w-8" 
            style={moduleColor ? { color: moduleColor } : undefined}
          />
        </div>
      );
    }

    return null;
  };

  const iconElement = renderLargeIcon();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="px-4 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Ícone à esquerda ocupando espaço das duas linhas */}
            {iconElement}
            
            {/* Título e descrição */}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">
                <span className="truncate">{displayTitle}</span>
              </CardTitle>
              {displaySubtitle ? (
                <p className="hidden sm:block text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2 md:line-clamp-none">
                  {displaySubtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {right ? right : null}
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="rounded-full h-9 w-9"
              aria-label="Voltar"
              title="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

export default SimpleTitleBar;
