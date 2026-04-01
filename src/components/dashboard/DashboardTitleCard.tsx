import React, { useMemo } from "react";

import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLiquidGlass } from "@/contexts/LiquidGlassContext";
import { cn } from "@/lib/utils";

interface DashboardTitleCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Por padrão volta para /dashboard (como solicitado) */
  backTo?: string;
  right?: React.ReactNode;
}

const DashboardTitleCard = ({
  title,
  subtitle,
  icon,
  backTo = "/dashboard",
  right,
}: DashboardTitleCardProps) => {
  const navigate = useNavigate();
  const { config: liquidGlassConfig } = useLiquidGlass();

  const glassStyle = useMemo<React.CSSProperties>(() => {
    if (!liquidGlassConfig.enabled) return {};
    const filter = `blur(${liquidGlassConfig.strength + liquidGlassConfig.extraBlur}px) saturate(${liquidGlassConfig.tintSaturation}%) contrast(${liquidGlassConfig.contrast}%) brightness(${liquidGlassConfig.brightness}%) invert(${liquidGlassConfig.invert}%) hue-rotate(${liquidGlassConfig.tintHue}deg)`;
    const bgAlpha = liquidGlassConfig.backgroundAlpha / 100;
    const specHighAlpha = liquidGlassConfig.edgeSpecularity / 200;
    const specLowAlpha = liquidGlassConfig.edgeSpecularity / 300;
    const borderAlpha = liquidGlassConfig.backgroundAlpha / 200;
    return {
      borderRadius: `${liquidGlassConfig.cornerRadius}px`,
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
      background: `hsl(var(--card) / ${Math.min(bgAlpha, 0.92)})`,
      boxShadow: `0 0 ${liquidGlassConfig.softness}px hsl(var(--foreground) / ${specHighAlpha}), inset 0 1px 0 hsl(var(--background) / ${specLowAlpha})`,
      opacity: liquidGlassConfig.opacity / 100,
      border: `1px solid hsl(var(--border) / ${Math.min(borderAlpha, 0.7)})`,
    };
  }, [liquidGlassConfig]);

  return (
    <Card 
      className={cn(
        "border-border/70",
        liquidGlassConfig.enabled && "bg-transparent border-transparent"
      )}
      style={liquidGlassConfig.enabled ? glassStyle : undefined}
    >
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex flex-1 items-start gap-3">
            {icon ? (
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-primary">
                {icon}
              </span>
            ) : null}

            <div className="min-w-0">
              <CardTitle className="text-base sm:text-xl font-semibold tracking-tight leading-tight">
                <span className="block truncate">{title}</span>
              </CardTitle>
            {subtitle ? (
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
            ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {right ? right : null}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(backTo)}
              className="h-10 w-10 rounded-full border-border bg-background/80 hover:bg-accent"
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

export default DashboardTitleCard;
