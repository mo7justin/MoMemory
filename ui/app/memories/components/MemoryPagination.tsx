"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";

interface MemoryPaginationProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}

export function MemoryPagination({
  currentPage,
  totalPages,
  setCurrentPage,
}: MemoryPaginationProps) {
  const { locale } = useLanguage();
  return (
    <div className="flex items-center justify-between my-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm">
          {t('pageOf', locale).replace('{{current}}', currentPage.toString()).replace('{{total}}', totalPages.toString())}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
