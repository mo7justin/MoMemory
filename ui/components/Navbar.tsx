"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreateMemoryDialog } from "@/app/memories/components/CreateMemoryDialog";
import { BindDeviceDialog } from "@/components/BindDeviceDialog";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Settings, Moon, Sun, LogOut, Menu } from "lucide-react"; 
import { LanguageSwitcher } from "./shared/LanguageSwitcher";
import { t } from "@/lib/locales";
  import { useLanguage } from "./shared/LanguageContext";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"; 
import { Sidebar } from "@/components/Sidebar"; 

export function Navbar() {
  const { locale } = useLanguage();
  const router = useRouter();
  const { logout } = useAuth();
  const pathname = usePathname();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [userInfo, setUserInfo] = useState<{name: string; email?: string; loginType: string; avatar?: string; userId?: string} | null>(null);
  const userId = useSelector((state: RootState) => state.profile.userId);
  
  // Sync User Info Logic
  const getCookieUserId = (): string => {
    try {
      const cookies = typeof document !== 'undefined' ? document.cookie || '' : '';
      const match = cookies.match(/(?:^|; )userInfo=([^;]+)/);
      if (match && match[1]) {
        const info = JSON.parse(decodeURIComponent(match[1]));
        return info?.email || info?.userId || info?.unionid || info?.openid || '';
      }
    } catch {}
    return '';
  };

  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
    }
    try {
      const cid = getCookieUserId();
      const currentEmail = localStorage.getItem('userEmail') || '';
      if (cid && !currentEmail) {
        const s = localStorage.getItem('userInfo');
        const info = s ? JSON.parse(s) : {};
        info.userId = info.userId || cid;
        info.email = info.email || cid;
        localStorage.setItem('userInfo', JSON.stringify(info));
        localStorage.setItem('userEmail', cid);
        setUserInfo(info);
        try { window.dispatchEvent(new Event('userInfoUpdated')); } catch {}
      }
    } catch {}
    const handleUserInfoUpdated = () => {
      try {
        const s = localStorage.getItem('userInfo');
        if (s) setUserInfo(JSON.parse(s));
      } catch {}
    };
    try { window.addEventListener('userInfoUpdated' as any, handleUserInfoUpdated as any); } catch {}
    return () => {
      try { window.removeEventListener('userInfoUpdated' as any, handleUserInfoUpdated as any); } catch {}
    };
  }, []);

  const handleLogout = async () => {
    try {
      setUserInfo(null);
      await logout();
    } catch (error) {
      setUserInfo(null);
      setTimeout(() => {
        router.push('/login');
      }, 300);
    }
  };
  
  const getUserAvatar = () => {
    const initial = userInfo?.name ? userInfo.name.charAt(0).toUpperCase() : 'U';
    const avatar = userInfo?.avatar || (userInfo as any)?.metadata_?.avatar || '';
    if (avatar) {
      return (
        <img src={avatar} alt={userInfo?.name || 'user'} className="w-9 h-9 rounded-full object-cover" />
      );
    }
    return (
      <div className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center text-white font-semibold">
        {initial}
      </div>
    );
  };
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      try {
        const menu = document.querySelector('.absolute.right-0');
        const button = document.querySelector('button.rounded-full');
        const target = event.target as Node | null;
        if (!target) return;
        if (userMenuOpen && menu && button && !menu.contains(target) && !button.contains(target)) {
          setUserMenuOpen(false);
        }
      } catch {}
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  if (pathname === '/login') return null;

  return (
    // Changed h-14 to h-16 for taller navbar
    <header className="sticky top-0 z-50 w-full border-b border-border bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
      {/* Removed container class and used w-full px-6 to push content to edges */}
      <div className="w-full flex h-16 items-center justify-between px-6">
        <div className="flex items-center">
            {/* Mobile Menu Trigger */}
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden mr-2">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 flex flex-col">
                    <div className="p-6 pb-0">
                        <div className="flex items-center justify-start">
                            <img 
                                src="/logo.svg" 
                                alt="OpenMemory Logo" 
                                className="object-contain h-8 dark:invert invert-0" 
                            />
                        </div>
                    </div>
                    <Sidebar className="w-full border-r-0 pt-6 flex-1" />
                </SheetContent>
            </Sheet>

            {/* Hide Logo on Mobile, show only on Desktop */}
            <Link href="/" className="hidden md:flex items-center py-2">
            <div className="w-40 h-10 flex items-center justify-start">
            <img 
              src="/logo.svg" 
              alt="OpenMemory Logo" 
                className="object-contain h-8 dark:invert invert-0" 
            />
          </div>
          </Link>
        </div>
        
        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <div className="hidden md:block">
             <CreateMemoryDialog />
          </div>
          <div className="md:hidden">
          <CreateMemoryDialog />
          </div>
          
          <div className="hidden md:block">
          <BindDeviceDialog />
          </div>
           
          <div className="hidden md:block">
          <LanguageSwitcher />
          </div>
          
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full overflow-hidden p-0 w-9 h-9 border border-transparent hover:border-violet-400 dark:hover:border-violet-500"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              {getUserAvatar()}
            </Button>
            
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg bg-card border border-border shadow-lg py-2 z-50">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {t('hi', locale)} {userInfo?.name || 'User'}!
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(() => {
                      const displayId = (userInfo as any)?.email || (userInfo as any)?.userId || userId || getCookieUserId() || '';
                      // 如果有邮箱，优先显示邮箱
                      if ((userInfo as any)?.email) return (userInfo as any).email;
                      
                      if (userInfo?.name && !displayId.includes('@')) return userInfo.name; // 如果没有邮箱且有名字，可能显示名字（视情况而定，这里保持原逻辑或调整）
                      
                      if (userInfo?.loginType === 'qq') return `QQ: ${displayId}`;
                      if (userInfo?.loginType === 'wechat') return `${t('wechat', locale)}: ${displayId}`;
                      return displayId;
                    })()}
                  </p>
                </div>
                
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{t('theme', locale)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTheme('light')}
                        className={`p-2 rounded-md transition-colors ${
                          theme === 'light' 
                            ? 'bg-violet-100 dark:bg-violet-900/30 text-foreground' 
                            : 'text-muted-foreground hover:bg-violet-50 dark:hover:bg-violet-900/20'
                        }`}
                      >
                        <Sun size={16} />
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`p-2 rounded-md transition-colors ${
                          theme === 'dark' 
                            ? 'bg-violet-100 dark:bg-violet-900/30 text-foreground' 
                            : 'text-muted-foreground hover:bg-violet-50 dark:hover:bg-violet-900/20'
                        }`}
                      >
                        <Moon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Language Switcher inside User Menu */}
                <div className="px-4 py-3 border-b border-border md:hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Language</span>
                        <div className="flex gap-2">
                             <LanguageSwitcher />
                        </div>
                    </div>
                </div>

                {/* Mobile Bind Device inside User Menu */}
                <div className="px-4 py-3 border-b border-border md:hidden">
                    <BindDeviceDialog />
                </div>
                
                <ChangePasswordDialog />
                
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-sm text-left text-foreground hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center gap-2"
                >
                  <LogOut size={16} />
                  {t('logout', locale)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}