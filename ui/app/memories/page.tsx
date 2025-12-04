"use client";

import React, { useEffect, useState } from "react";
import { MemoriesSection } from "@/app/memories/components/MemoriesSection";
import { MemoryFilters } from "@/app/memories/components/MemoryFilters";
import { useRouter, useSearchParams } from "next/navigation";
import "@/styles/animation.css";
import UpdateMemory from "@/components/shared/update-memory";
import { useUI } from "@/hooks/useUI";
import { useAuth } from "@/hooks/useAuth";

export default function MemoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateMemoryDialog, handleCloseUpdateMemoryDialog } = useUI();
  const { isAuthenticated, isLoading } = useAuth();
  const [paramsReady, setParamsReady] = useState(false);
  useEffect(() => {
    if (!searchParams.has("page") || !searchParams.has("size")) {
      const params = new URLSearchParams(searchParams.toString());
      if (!searchParams.has("page")) params.set("page", "1");
      if (!searchParams.has("size")) params.set("size", "10");
      router.replace(`?${params.toString()}`);
    }
    setParamsReady(true);
  }, []);
  
  const showLoading = isLoading;
  const showRedirecting = !isLoading && !isAuthenticated;
  

  class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) {
      return { hasError: true, error };
    }
    componentDidCatch(error: any, info: any) {
      console.error("MemoriesPage error boundary caught:", error, info);
    }
    render() {
      if (this.state.hasError) {
        return <div className="fixed inset-0 w-full h-full flex items-center justify-center text-red-500">页面出现错误，请刷新或返回。</div>;
      }
      return this.props.children as any;
    }
  }

  return (
    <ErrorBoundary>
    <div className="">
      <UpdateMemory
        memoryId={updateMemoryDialog.memoryId || ""}
        memoryContent={updateMemoryDialog.memoryContent || ""}
        open={updateMemoryDialog.isOpen}
        onOpenChange={handleCloseUpdateMemoryDialog}
      />
      {showLoading || !paramsReady ? (
        <div className="fixed inset-0 w-full h-full flex items-center justify-center">Loading...</div>
      ) : showRedirecting ? (
        <div className="fixed inset-0 w-full h-full flex items-center justify-center">Redirecting...</div>
      ) : (
        <main className="flex-1 py-6">
          <div className="container">
            <div className="mt-1 pb-4 animate-fade-slide-down">
              <MemoryFilters />
            </div>
            <div className="animate-fade-slide-down delay-1">
              <MemoriesSection />
            </div>
          </div>
        </main>
      )}
    </div>
    </ErrorBoundary>
  );
}
