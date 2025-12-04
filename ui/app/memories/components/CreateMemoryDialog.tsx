"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { GoPlus } from "react-icons/go";
import { Loader2 } from "lucide-react";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { useStats } from "@/hooks/useStats";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";

// Add JSX namespace to fix intrinsic elements typing
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

export function CreateMemoryDialog() {
  const { locale } = useLanguage();
  const { createMemory, isLoading, fetchMemories } = useMemoriesApi();
  const { fetchStats } = useStats();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleCreateMemory = async () => {
    // 检查输入是否为空
    if (!inputValue.trim()) {
      toast.error(t('memoryContentCannotBeEmpty', locale));
      return;
    }
    
    try {
      await createMemory(inputValue);
      toast.success(t('memoryCreatedSuccessfully', locale));
      // Reset input and close the dialog
      setInputValue('');
      setOpen(false);
      // refetch memories and stats to update UI
      await fetchMemories();
      await fetchStats();
    } catch (error: any) {
      console.error("Create memory error:", error);
      toast.error(t('failedToCreateMemory', locale));
    }
  };

  // Reset input when dialog opens
  React.useEffect(() => {
    if (open) {
      setInputValue('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <GoPlus />
          {t('createMemory', locale)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>{t('createNewMemory', locale)}</DialogTitle>
          <DialogDescription>
            {t('addNewMemoryDescription', locale)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="memory">{t('memory', locale)}</Label>
            <Textarea
              id="memory"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="bg-background border-border min-h-[150px]"
              placeholder={t('memoryPlaceholder', locale)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel', locale)}
          </Button>
          <Button
            disabled={isLoading || !inputValue.trim()}
            onClick={handleCreateMemory}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              "Save Memory"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
