import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, X, LogOut, Wallet, Eye, EyeOff, Languages, PanelLeft } from 'lucide-react';
import NotificationIcon from '@/components/notifications/NotificationIcon';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SimpleCounter } from '@/components/ui/simple-counter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateBR, remainingDaysBR } from '@/utils/timezone';
import { languageOptions, localeContent, useLocale } from '@/contexts/LocaleContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface UserWalletDropdownProps {
  onLogout?: () => void;
}

const localeToNumberFormat: Record<'pt-BR' | 'en' | 'es', string> = {
  'pt-BR': 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

const UserWalletDropdown = ({ onLogout }: UserWalletDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [pendingLocale, setPendingLocale] = useState(languageOptions[0].locale);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user, profile, refreshUser } = useAuth();
  const { balance, isLoading, loadBalance } = useWalletBalance();
  const { subscription, discountPercentage, refreshSubscription } = useUserSubscription();
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();

  const content = localeContent[locale];
  const selectedLanguageOption = languageOptions.find((option) => option.locale === locale) ?? languageOptions[0];
  const avatarSrc = profile?.avatar_url || user?.avatar_url || undefined;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeToNumberFormat[locale], {
      style: 'currency',
      currency: 'BRL',
    });
  };

  useEffect(() => {
    if (isOpen) {
      Promise.all([loadBalance(), refreshUser(), refreshSubscription()]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAddBalance = () => {
    navigate('/dashboard/adicionar-saldo');
    setIsOpen(false);
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  const handleRefreshBalance = async () => {
    await Promise.all([loadBalance(), refreshUser(), refreshSubscription()]);
    toast.success(`${content.walletRefresh}!`);

    window.dispatchEvent(new CustomEvent('balanceUpdated', {
      detail: { timestamp: Date.now(), shouldAnimate: true },
    }));
  };

  const handleOpenPanels = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate('/dashboard');
    setIsOpen(false);
  };

  const openLanguageModal = () => {
    setPendingLocale(locale);
    setIsLanguageModalOpen(true);
  };

  const applyLanguage = () => {
    setLocale(pendingLocale);
    setIsLanguageModalOpen(false);
  };

  if (!user || !profile) return null;

  const currentPlan = subscription?.plan_name || user.tipoplano || content.walletPrepaid;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2 rounded-l-full py-1 px-3 pr-2 -mr-2 bg-brand-purple/20 dark:bg-brand-purple/30 z-0">
          <div className="relative">
            <Avatar className="h-7 w-7 border border-border/60">
              <AvatarImage src={avatarSrc} alt={`Avatar de ${profile?.full_name || user?.full_name || user?.login || 'usuário'}`} />
              <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                {getInitials(profile?.full_name || user?.full_name || user?.login || 'Usuário')}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap mr-2">
            {showBalance ? (
              <SimpleCounter
                value={balance.total}
                formatAsCurrency={true}
                className="text-sm font-bold text-gray-900 dark:text-white"
                duration={800}
              />
            ) : (
              'R$***'
            )}
          </div>
        </div>

        <Button
          size="sm"
          className="whitespace-nowrap text-white bg-green-600 hover:bg-green-700 border-0 uppercase font-bold text-xs leading-4 z-10"
          onClick={(e) => {
            e.stopPropagation();
            handleAddBalance();
          }}
        >
          {content.walletDeposit}
        </Button>
      </div>

      {isOpen && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[10000] backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          >
            <div
              className="bg-white dark:bg-gray-900 border-2 border-border rounded-lg shadow-2xl w-80 md:w-96 max-h-[90vh] overflow-y-auto"
              style={{
                boxShadow: '0px 20px 32px 0px hsl(var(--shadow)/0.15)',
              }}
            >
              <Card className="border-0 bg-transparent">
                <div className="sticky top-0 z-10 p-3">
                  <div className="flex justify-center items-center relative">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        aria-label={content.openLanguage}
                        onClick={(event) => {
                          event.stopPropagation();
                          openLanguageModal();
                        }}
                        className="h-8 w-8 rounded-md flex items-center justify-center border border-border bg-background text-foreground hover:bg-muted transition-colors"
                      >
                        <span className="text-sm leading-none" aria-hidden="true">{selectedLanguageOption.flag}</span>
                      </button>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ThemeSwitcher />
                      </div>
                      <Avatar className="h-11 w-11 border border-border">
                        <AvatarImage src={avatarSrc} alt={`Avatar de ${profile?.full_name || user?.full_name || user?.login || 'usuário'}`} />
                        <AvatarFallback className="text-sm font-semibold bg-muted text-muted-foreground">
                          {getInitials(profile?.full_name || user?.full_name || user?.login || 'Usuário')}
                        </AvatarFallback>
                      </Avatar>
                      <div onClick={(e) => e.stopPropagation()}>
                        <NotificationIcon />
                      </div>
                      <button
                        type="button"
                        aria-label={content.sidebarOnlinePanels}
                        title={content.sidebarOnlinePanels}
                        onClick={handleOpenPanels}
                        className="h-8 w-8 rounded-md flex items-center justify-center border border-border bg-background text-foreground hover:bg-muted transition-colors"
                      >
                        <PanelLeft className="h-4 w-4" />
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="absolute top-0 right-0 h-8 w-8 p-0 hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-center mt-2">
                    <div className="font-bold text-foreground">
                      {profile?.full_name || user?.full_name || user?.login || content.walletUserFallback}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {user?.email || user?.login || ''}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="bg-muted/50 p-4 rounded-lg border">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-brand-purple" />
                        <span className="font-bold">{content.walletBalance}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBalance(!showBalance)}
                          className="h-6 w-6 p-0"
                        >
                          {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {showBalance ? (
                            <SimpleCounter
                              value={balance.total}
                              formatAsCurrency={true}
                              className="text-base font-bold text-gray-900 dark:text-white"
                              duration={800}
                            />
                          ) : (
                            'R$***'
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{content.walletWalletBalance}</span>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {showBalance ? formatCurrency(balance.saldo) : 'R$***'}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{content.walletPlanBalance}</span>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {showBalance ? formatCurrency(balance.saldo_plano) : 'R$***'}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">{content.walletPlan}</span>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {currentPlan}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">{content.walletDiscount}</span>
                          <div className="font-medium text-green-600 dark:text-green-400">
                            {discountPercentage > 0 ? `${discountPercentage}%` : '0%'}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">{content.walletPlanStart}</span>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatDateBR(subscription?.start_date || subscription?.starts_at)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">{content.walletPlanEnd}</span>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatDateBR(subscription?.end_date || subscription?.ends_at)}
                          </div>
                        </div>
                        {(subscription?.end_date || subscription?.ends_at) && (
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-muted-foreground font-semibold">{content.walletDaysRemaining}</span>
                            <div className="font-bold text-blue-600 dark:text-blue-400">
                              {(() => {
                                const days = remainingDaysBR(subscription?.end_date || subscription?.ends_at);
                                return days > 0 ? `${days} ${content.walletDaysSuffix}` : content.walletExpired;
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-4 mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshBalance}
                      disabled={isLoading}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                      {content.walletRefresh}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogoutClick}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-3 w-3" />
                      {content.logout}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>,
        document.body,
      )}

      <Dialog open={isLanguageModalOpen} onOpenChange={setIsLanguageModalOpen}>
        <DialogContent hideOverlay className="z-[10020] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              {content.languageModalTitle}
            </DialogTitle>
            <DialogDescription>{content.languageModalDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {languageOptions.map((option) => {
              const isActive = option.locale === pendingLocale;

              return (
                <button
                  key={option.locale}
                  type="button"
                  onClick={() => setPendingLocale(option.locale)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="text-base" aria-hidden="true">{option.flag}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>

          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsLanguageModalOpen(false)}>
              {content.cancel}
            </Button>
            <Button onClick={applyLanguage}>{content.applyLanguage}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserWalletDropdown;
