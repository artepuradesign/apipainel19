
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown } from 'lucide-react';

export interface PageHeaderCardProps {
  title: string;
  subtitle: string;
  isControlPanel?: boolean;
  extra?: React.ReactElement;
  currentPlan?: string;
  badgeText?: string;
  value?: string;
  valueDetails?: string;
  showAddButton?: boolean;
  isCompact?: boolean;
}

const PageHeaderCard: React.FC<PageHeaderCardProps> = ({ 
  title, 
  subtitle, 
  isControlPanel = false,
  extra,
  currentPlan,
  badgeText,
  value,
  valueDetails,
  showAddButton,
  isCompact
}) => {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 lg:pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg lg:text-2xl font-bold">
              {isControlPanel && <Crown className="h-4 w-4 lg:h-6 lg:w-6 text-yellow-500" />}
              {title}
              {badgeText && (
                <span className="text-xs lg:text-sm bg-brand-purple text-white px-2 py-1 rounded-full">
                  {badgeText}
                </span>
              )}
            </CardTitle>
            <p className="hidden sm:block text-muted-foreground mt-1 text-sm lg:text-base">
              {subtitle}
            </p>
            {currentPlan && (
              <p className="text-sm text-brand-purple font-medium mt-1">
                Plano: {currentPlan}
              </p>
            )}
            {value && (
              <div className="mt-2">
                <p className="text-lg font-semibold">
                  {value}
                </p>
                {valueDetails && (
                  <p className="text-sm text-muted-foreground">
                    {valueDetails}
                  </p>
                )}
              </div>
            )}
          </div>
          {extra && (
            <div>
              {extra}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
};

export default PageHeaderCard;
