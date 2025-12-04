"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Category, Client } from "../../../components/types";
import { MemoryTable } from "./MemoryTable";
import MemoryDetailsSheet from "./MemoryDetailsSheet";
import { MemoryPagination } from "./MemoryPagination";
import { CreateMemoryDialog } from "./CreateMemoryDialog";
import { PageSizeSelector } from "./PageSizeSelector";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { useRouter, useSearchParams } from "next/navigation";
import { MemoryTableSkeleton } from "@/skeleton/MemoryTableSkeleton";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";

export function MemoriesSection() {
  const { locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchMemories } = useMemoriesApi();
  const [memories, setMemories] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentPageRaw = searchParams.get("page");
  const itemsPerPageRaw = searchParams.get("size");
  const currentPage = Math.max(1, Number(currentPageRaw || 1) || 1);
  const itemsPerPage = Math.max(1, Number(itemsPerPageRaw || 10) || 10);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  );
  const [selectedClient, setSelectedClient] = useState<Client | "all">("all");

  useEffect(() => {
    const loadMemories = async () => {
      setIsLoading(true);
      try {
        const searchQuery = searchParams.get("search") || "";
        const result = await fetchMemories(
          searchQuery,
          currentPage,
          itemsPerPage
        );
        setMemories(Array.isArray(result.memories) ? result.memories : []);
        setTotalItems(Number(result.total) || 0);
        setTotalPages(Math.max(1, Number(result.pages) || 1));
      } catch (error) {
        console.error("Failed to fetch memories:", error);
      }
      setIsLoading(false);
    };

    loadMemories();
  }, [currentPage, itemsPerPage, fetchMemories, searchParams]);

  useEffect(() => {
    const handler = (e: Event) => {
      setSheetOpen(true);
    };
    window.addEventListener('open-memory-details-sheet', handler as EventListener);
    return () => {
      window.removeEventListener('open-memory-details-sheet', handler as EventListener);
    };
  }, []);

  const setCurrentPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    params.set("size", itemsPerPage.toString());
    router.replace(`?${params.toString()}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // Reset to page 1 when changing page size
    params.set("size", size.toString());
    router.replace(`?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="w-full bg-transparent">
        <MemoryTableSkeleton />
        <div className="flex items-center justify-between mt-4">
          <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
          <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent">
      <div>
        {memories.length > 0 ? (
          <>
            <MemoryTable />
            <MemoryDetailsSheet open={sheetOpen} onOpenChange={setSheetOpen} />
            <div className="flex items-center justify-between mt-4">
              <PageSizeSelector
                pageSize={itemsPerPage}
                onPageSizeChange={handlePageSizeChange}
              />
              <div className="text-sm text-zinc-500 mr-2">
                {t('showingRangeOfTotalMemories', locale).replace('{{start}}', ((currentPage - 1) * itemsPerPage + 1).toString()).replace('{{end}}', Math.min(currentPage * itemsPerPage, totalItems).toString()).replace('{{total}}', totalItems.toString())}
              </div>
              <MemoryPagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-800 p-3 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-zinc-400"
              >
                <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path>
                <path d="M16 2v6h6"></path>
                <path d="M12 18v-6"></path>
                <path d="M9 15h6"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium">{t('noMemoriesFound', locale)}</h3>
            <p className="text-zinc-400 mt-1 mb-4">
              {selectedCategory !== "all" || selectedClient !== "all"
                ? t('tryAdjustingFilters', locale)
                : t('createYourFirstMemoryToSee', locale)}
            </p>
            {selectedCategory !== "all" || selectedClient !== "all" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedClient("all");
                }}
              >
                {t('clearFilters', locale)}
              </Button>
            ) : (
              <CreateMemoryDialog />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
