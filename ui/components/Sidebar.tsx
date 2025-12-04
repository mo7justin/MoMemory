"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { t } from "@/lib/locales";
import { useLanguage } from "./shared/LanguageContext";
import axios from "axios";
import { cn } from "@/lib/utils";

// Icons
import { HiMiniRectangleStack } from "react-icons/hi2";
import { RiApps2AddFill } from "react-icons/ri";
import { Settings, User, LayoutDashboard, HelpCircle, Key, Box, Activity, Share2 } from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, ...props }: SidebarProps) {
  const pathname = usePathname();
  const { locale } = useLanguage();
  
  const [userInfo, setUserInfo] = useState<{email?: string} | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminAvailable, setAdminAvailable] = useState<boolean>(true);
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'tan_jia@hotmail.com').toLowerCase();
  const userId = useSelector((state: RootState) => state.profile.userId);

  // Sync User Info (Simplified)
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) setUserInfo(JSON.parse(storedUserInfo));
    const handle = () => {
        const s = localStorage.getItem('userInfo');
        if (s) setUserInfo(JSON.parse(s));
    };
    try { window.addEventListener('userInfoUpdated' as any, handle as any); } catch {}
    return () => { try { window.removeEventListener('userInfoUpdated' as any, handle as any); } catch {} };
  }, []);

  // Admin Check
  useEffect(() => {
    const URL = typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL.trim() ? process.env.NEXT_PUBLIC_API_URL.trim() : '';
    const uid = userId || userInfo?.email || undefined;
    if (!uid || uid === 'user') return;
    const run = async () => {
      try {
        const res = await axios.get(`${URL}/api/v1/auth/profile`, { params: { user_id: uid } });
        if (res.data && (res.data.is_admin === true || res.data.role === 'admin')) setIsAdmin(true);
        try {
          const ping = await axios.get(`${URL}/api/v1/admin/users`, { params: { user_id: uid, page: 1, size: 1 } });
          setAdminAvailable(ping.status >= 200 && ping.status < 300);
        } catch (e: any) {
          if ([404, 405, 400].includes(e?.response?.status)) setAdminAvailable(false); else setAdminAvailable(true);
        }
      } catch (e) { setIsAdmin(false); setAdminAvailable(false); }
    };
    run();
  }, [userId, userInfo?.email]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === href;
    return pathname?.startsWith(href);
  };

  return (
    <aside className={cn("flex flex-col h-full w-64 border-r bg-card text-card-foreground flex-shrink-0 pt-6", className)} {...props}>
      <ScrollArea className="flex-1 px-4">
        <nav className="space-y-3 flex flex-col h-full">
          <div className="space-y-3">
            {/* Get Started Section */}
            <Link href="/get-started" className="block mb-4">
                <div className={cn(
                    "group flex flex-col rounded-lg border p-3 transition-all hover:bg-accent",
                    isActive("/get-started") ? "bg-accent border-primary/20" : "border-transparent bg-secondary/50 hover:border-primary/10"
                )}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#7634F9] mb-1">
                        <Box className="h-4 w-4 text-[#7634F9]" />
                        <span>{t('getStarted', locale)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                        {t('getStartedDesc', locale)}
                    </span>
                </div>
            </Link>

            <Link href="/">
                <Button variant={isActive("/") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                <LayoutDashboard className="mr-3 h-4 w-4" />
              {t('dashboard', locale)} <span className="text-[10px] ml-2 opacity-50">v2.3</span>
            </Button>
            </Link>
            <Link href="/memories">
                <Button variant={isActive("/memories") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                <HiMiniRectangleStack className="mr-3 h-4 w-4" />
                {t('memories', locale)}
                </Button>
            </Link>
            <Link href="/apps">
                <Button variant={isActive("/apps") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                <RiApps2AddFill className="mr-3 h-4 w-4" />
                {t('apps', locale)}
                </Button>
            </Link>

            <Link href="/usage">
                <Button variant={isActive("/usage") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                <Activity className="mr-3 h-4 w-4" />
                {t('usage', locale)}
                </Button>
            </Link>

            <Link href="/graph">
                <Button variant={isActive("/graph") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                <Share2 className="mr-3 h-4 w-4" />
                {t('graphMemory', locale)}
                </Button>
            </Link>
            
            {/* Admin Link (if available) - kept near top/apps usually */}
            {adminAvailable && userInfo?.email && (userInfo.email.toLowerCase() === adminEmail || isAdmin) && (
                <Link href="/admin/users">
                    <Button variant={isActive("/admin/users") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                        <User className="mr-3 h-4 w-4" />
                        {t('adminUsers', locale)}
                    </Button>
                </Link>
            )}
          </div>
        </nav>
      </ScrollArea>

      <div className="mt-auto px-4 pb-6 space-y-3 border-t pt-4 bg-card z-10">
             {/* Get API Key */}
             <Link href="/api-keys">
                <Button variant={isActive("/api-keys") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                  <Key className="mr-3 h-4 w-4" />
                  {t('getApiKey', locale)}
                </Button>
             </Link>

             {/* Settings */}
             <Link href="/settings">
                <Button variant={isActive("/settings") ? "secondary" : "ghost"} className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                  <Settings className="mr-3 h-4 w-4" />
                  {t('settings', locale)}
                </Button>
             </Link>
             
             {/* Help/Support */}
             <a href="mailto:postmaster@momemory.com">
                <Button variant="ghost" className="w-full justify-start font-medium text-sm text-foreground/90 h-10">
                  <HelpCircle className="mr-3 h-4 w-4" />
                  {t('helpSupport', locale)}
                </Button>
             </a>
      </div>
    </aside>
  );
}
