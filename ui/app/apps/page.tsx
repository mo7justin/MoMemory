"use client";

import { AppFilters } from "./components/AppFilters";
import { AppGrid } from "./components/AppGrid";
import "@/styles/animation.css";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function AppsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  // 如果还在加载认证状态，显示加载状态
  if (isLoading) {
    return <div className="fixed inset-0 w-full h-full flex items-center justify-center">Loading...</div>;
  }
  
  // 如果用户未认证，重定向到登录页面
  if (!isAuthenticated) {
    router.push('/login');
    return <div className="fixed inset-0 w-full h-full flex items-center justify-center">Redirecting...</div>;
  }
  
  return (
    <main className="flex-1 py-6">
      <div className="container">
        <div className="mt-1 pb-4 animate-fade-slide-down">
          <AppFilters />
        </div>
        <div className="animate-fade-slide-down delay-1">
          <AppGrid />
        </div>
      </div>
    </main>
  );
}
