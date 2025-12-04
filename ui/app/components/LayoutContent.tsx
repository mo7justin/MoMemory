"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { toast } from 'sonner';

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname?.startsWith('/register/') || pathname === '/privacypolicy' || pathname?.toLowerCase() === '/privacypolicy';
  const isOAuthFlow = typeof window !== 'undefined' && (window.location?.search?.includes('oauth=') || window.location?.pathname === '/login' && window.location?.search?.includes('code='));

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isAuthPage && !isOAuthFlow) {
      try { toast.warning('请先登录'); } catch {}
      router.replace('/login');
      return;
    }
  }, [isLoading, isAuthenticated, isAuthPage, router]);

  if (isLoading) {
    return <div className="fixed inset-0 w-full h-full flex items-center justify-center">Loading...</div>;
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden md:flex" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
            <ScrollArea className="flex-1 h-full">
                {children}
            </ScrollArea>
        </main>
      </div>
    </div>
  );
}