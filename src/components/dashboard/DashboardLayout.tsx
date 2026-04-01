import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from '../ThemeProvider';
import LoadingScreen from '@/components/layout/LoadingScreen';
import GlobalAnimatedBackground from '@/components/layout/GlobalAnimatedBackground';

import Sidebar from './layout/Sidebar';
import MenuSuperior from '../MenuSuperior';
import { createSidebarItems } from './layout/sidebarData';
import { usePanelMenus } from '@/hooks/usePanelMenus';
import UserNotifications from '@/components/notifications/UserNotifications';
import AdminNotifications from '@/components/notifications/AdminNotifications';
import { useNotificationDuplicationPrevention } from '@/hooks/useNotificationDuplicationPrevention';
import { toastNotificationManager } from '@/utils/toastNotificationManager';
import { usePageVisitTracker } from '@/hooks/usePageVisitTracker';
import { useLocale } from '@/contexts/LocaleContext';

const DashboardLayout = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isTablet, setIsTablet] = useState(false);
  const { isSupport, user, loading, signOut } = useAuth();
  const { locale } = useLocale();
  
  // Registrar visitas de página
  usePageVisitTracker();
  // Detectar tablet de forma reativa
  useEffect(() => {
    const checkTablet = () => {
      setIsTablet(window.innerWidth >= 768 && window.innerWidth <= 1024);
    };
    
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);
  const { panelMenus, isLoading: panelsLoading } = usePanelMenus();
  
  // Sidebar expandida em desktop (>1024px) por padrão
  // Para admin/suporte, sempre expandida em desktop e tablet
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      // Sempre iniciar expandido em desktop/tablet
      return window.innerWidth < 768; // Apenas colapsado em mobile
    }
    return false;
  });
  
  // Ajustar automaticamente sidebar por breakpoint
  useEffect(() => {
    // Mobile e tablet: recolhida | Desktop: expandida
    setCollapsed(isMobile || isTablet);
  }, [isMobile, isTablet]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const previousViewport = viewportMeta?.getAttribute('content') ?? null;
    const previousHtmlOverflowX = html.style.overflowX;
    const previousBodyOverflowX = body.style.overflowX;
    const previousHtmlTouchAction = html.style.touchAction;
    const previousBodyTouchAction = body.style.touchAction;

    const preventGesture = (event: Event) => event.preventDefault();
    const preventZoomWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    if (isMobile) {
      html.style.overflowX = 'hidden';
      body.style.overflowX = 'hidden';
      html.style.touchAction = 'pan-y';
      body.style.touchAction = 'pan-y';

      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      }

      document.addEventListener('gesturestart', preventGesture, { passive: false });
      document.addEventListener('gesturechange', preventGesture, { passive: false });
      document.addEventListener('wheel', preventZoomWheel, { passive: false });
    }

    return () => {
      html.style.overflowX = previousHtmlOverflowX;
      body.style.overflowX = previousBodyOverflowX;
      html.style.touchAction = previousHtmlTouchAction;
      body.style.touchAction = previousBodyTouchAction;

      if (viewportMeta && previousViewport) {
        viewportMeta.setAttribute('content', previousViewport);
      }

      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('wheel', preventZoomWheel);
    };
  }, [isMobile]);
  
  // Prevenir duplicação de notificações
  useNotificationDuplicationPrevention();

  // Limpeza automática de notificações antigas no localStorage (diária)
  useEffect(() => {
    const cleanup = () => {
      toastNotificationManager.cleanup();
    };
    
    // Executar limpeza a cada 24 horas
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
    
    // Executar uma vez no mount
    cleanup();
    
    return () => clearInterval(interval);
  }, []);
  
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // CORREÇÃO: Verificação mais robusta para evitar loop
  useEffect(() => {
    console.log('🔍 [DASHBOARD_LAYOUT] Estado atual:', {
      loading,
      hasUser: !!user,
      userId: user?.id,
      currentPath: location.pathname,
      timestamp: new Date().toISOString()
    });

    // CRÍTICO: Só redirecionar se DEFINITIVAMENTE não há usuário E a verificação terminou
    if (!loading && !user) {
      console.log('🚨 [DASHBOARD_LAYOUT] REDIRECIONANDO - Sem usuário após loading completo');
      navigate('/login', { replace: true });
    } else if (!loading && user) {
      console.log('✅ [DASHBOARD_LAYOUT] Usuário autenticado confirmado:', user.email);
    }
  }, [user, loading, navigate, location.pathname]);

  // Mostrar loading enquanto verifica
  if (loading) {
    return (
      <LoadingScreen 
        message="Carregando..." 
        variant="dashboard" 
      />
    );
  }

  // Se não há usuário, não renderizar nada (redirecionamento já aconteceu)
  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      toast.success("Logout realizado com sucesso!");
      await signOut();
    } catch (error) {
      console.error('Erro no logout:', error);
      window.location.href = '/login';
    }
  };

  const sidebarItems = createSidebarItems(handleLogout, isSupport, panelMenus, locale);

  const isSubmenuActive = (subItems?: any[]) => {
    if (!subItems) return false;
    return subItems.some(subItem => location.pathname === subItem.path);
  };

  const handleSubmenuMouseEnter = () => {
    // Manter submenu aberto quando mouse está sobre ele
  };

  const handleSubmenuMouseLeave = () => {
    // Fechar submenu quando mouse sai
  };

  const handleSubItemClick = (subItem: any) => {
    if (subItem.onClick) {
      subItem.onClick();
    } else if (subItem.path !== '#') {
      navigate(subItem.path);
    }
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen relative overflow-x-hidden`}>
      <GlobalAnimatedBackground variant="dashboard" />
      
      {/* Notificações de fundo para toasts */}
      <div className="fixed bottom-4 right-4 z-50">
        <UserNotifications />
        <AdminNotifications />
      </div>
      
      <div className="relative z-10 min-h-screen">
        {/* Menu Superior - sticky com transparência, igual à página inicial */}
        <MenuSuperior />
        
        <div className="flex min-h-[calc(100vh-4rem)]">
          {/* Sidebar - mostrar em tablets (>=768px) e desktop */}
          {(isTablet || (!isMobile && !isTablet)) && (
            <Sidebar
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              mobileMenuOpen={mobileMenuOpen}
              filteredItems={sidebarItems}
              location={location}
              isMobile={isMobile}
              isTablet={isTablet}
              setMobileMenuOpen={setMobileMenuOpen}
              isSubmenuActive={isSubmenuActive}
              handleSubItemClick={handleSubItemClick}
            />
          )}
          
          {/* Main content */}
          <main 
            className={`
              flex-1 
              relative 
              z-20 
              transition-all 
              duration-300 
              ease-in-out
              ${isMobile ? 'p-2' : 'p-3 md:p-4'}
              ${!isMobile && !collapsed ? 'ml-0' : ''}
            `}
          >
              <div className="w-full max-w-full overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
