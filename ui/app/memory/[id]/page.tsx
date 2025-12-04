"use client";

import "@/styles/animation.css";
import { useEffect } from "react";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import React from "react";
import { MemorySkeleton } from "@/skeleton/MemorySkeleton";
import { MemoryDetails } from "./components/MemoryDetails";
import UpdateMemory from "@/components/shared/update-memory";
import { useUI } from "@/hooks/useUI";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import NotFound from "@/app/not-found";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

function MemoryContent({ id }: { id: string }) {
  const { fetchMemoryById, isLoading, error } = useMemoriesApi();
  const memory = useSelector(
    (state: RootState) => state.memories.selectedMemory
  );

  useEffect(() => {
    const loadMemory = async () => {
      try {
        await fetchMemoryById(id);
      } catch (err) {
        console.error("Failed to load memory:", err);
      }
    };
    loadMemory();
  }, []);

  if (isLoading) {
    return <MemorySkeleton />;
  }

  if (error) {
    return <NotFound message={error} />;
  }

  if (!memory) {
    return <NotFound message="Memory not found" statusCode={404} />;
  }

  return <MemoryDetails memory_id={memory.id} />;
}

export default function MemoryPage({
  params,
}: {
  params: { id: string };
}) {
  const resolvedParams = params;
  const { updateMemoryDialog, handleCloseUpdateMemoryDialog } = useUI();
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
  
  // 添加调试信息
  useEffect(() => {
    console.log("UpdateMemory dialog state:", updateMemoryDialog);
  }, [updateMemoryDialog]);

  return (
    <div>
      <div className="animate-fade-slide-down delay-1">
        <UpdateMemory
          memoryId={updateMemoryDialog.memoryId || ""}
          memoryContent={updateMemoryDialog.memoryContent || ""}
          open={updateMemoryDialog.isOpen}
          onOpenChange={handleCloseUpdateMemoryDialog}
        />
      </div>
      <div className="animate-fade-slide-down delay-2">
        <MemoryContent id={resolvedParams.id} />
      </div>
    </div>
  );
}