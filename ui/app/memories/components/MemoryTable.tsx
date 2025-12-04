"use client";
import {
  Edit,
  MoreHorizontal,
  Trash2,
  Pause,
  Archive,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import {
  selectMemory,
  deselectMemory,
  selectAllMemories,
  clearSelection,
} from "@/store/memoriesSlice";
import SourceApp from "@/components/shared/source-app";
import { HiMiniRectangleStack } from "react-icons/hi2";
import { PiSwatches } from "react-icons/pi";
import { GoPackage } from "react-icons/go";
import { CiCalendar } from "react-icons/ci";
import { useRouter } from "next/navigation";
import Categories from "@/components/shared/categories";
import { useUI } from "@/hooks/useUI";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/helpers";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";

export function MemoryTable() {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const dispatch = useDispatch();
  const selectedMemoryIds = useSelector(
    (state: RootState) => state.memories.selectedMemoryIds
  );
  const memories = useSelector((state: RootState) => state.memories.memories);

  const { deleteMemories, updateMemoryState, isLoading, fetchMemoryById, fetchAccessLogs, fetchRelatedMemories } = useMemoriesApi();

  const handleDeleteMemory = (id: string) => {
    deleteMemories([id]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      dispatch(selectAllMemories());
    } else {
      dispatch(clearSelection());
    }
  };

  const handleSelectMemory = (id: string, checked: boolean) => {
    if (checked) {
      dispatch(selectMemory(id));
    } else {
      dispatch(deselectMemory(id));
    }
  };
  const { handleOpenUpdateMemoryDialog } = useUI();

  const handleEditMemory = (memory_id: string, memory_content: string) => {
    handleOpenUpdateMemoryDialog(memory_id, memory_content);
  };

  const handleUpdateMemoryState = async (id: string, newState: string) => {
    try {
      await updateMemoryState([id], newState);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update memory state",
        variant: "destructive",
      });
    }
  };

  const isAllSelected =
    memories.length > 0 && selectedMemoryIds.length === memories.length;
  const isPartiallySelected =
    selectedMemoryIds.length > 0 && selectedMemoryIds.length < memories.length;

  const handleMemoryClick = async (id: string) => {
    const event = new CustomEvent('open-memory-details-sheet', { detail: { open: true } });
    window.dispatchEvent(event);
    Promise.allSettled([
      fetchMemoryById(id),
      fetchAccessLogs(id, 1, 10),
      fetchRelatedMemories(id)
    ]).then(() => {}).catch(() => {});
  };

  return (
    <div className="rounded-md border w-full overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-full">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className="w-[50px] pl-4">
              <Checkbox
                className="data-[state=checked]:border-primary border-border"
                checked={isAllSelected}
                data-state={
                  isPartiallySelected
                    ? "indeterminate"
                    : isAllSelected
                    ? "checked"
                    : "unchecked"
                }
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="border-border">
              <div className="flex items-center w-full">
                <HiMiniRectangleStack className="mr-1 flex-shrink-0" />
                <span className="truncate">{t('memory', locale)}</span>
              </div>
            </TableHead>
            <TableHead className="border-border hidden md:table-cell">
              <div className="flex items-center">
                <PiSwatches className="mr-1" size={15} />
                {t('categories', locale)}
              </div>
            </TableHead>
            <TableHead className="w-[250px] border-border hidden md:table-cell">
              <div className="flex items-center">
                <GoPackage className="mr-1" />
                {t('sourceApp', locale)}
              </div>
            </TableHead>
            <TableHead className="w-[140px] border-border hidden md:table-cell">
              <div className="flex items-center w-full justify-center">
                <CiCalendar className="mr-1" size={16} />
                {t('createdOn', locale)}
              </div>
            </TableHead>
            <TableHead className="text-right border-border flex justify-center">
              <div className="flex items-center justify-end">
                <MoreHorizontal className="h-4 w-4 mr-2" />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memories.map((memory) => (
            <TableRow
              key={memory.id}
              className={`hover:bg-accent/20 ${
                memory.state === "paused" || memory.state === "archived"
                  ? "text-muted-foreground"
                  : ""
              } ${isLoading ? "animate-pulse opacity-50" : ""}`}
            >
              <TableCell className="pl-4">
                <Checkbox
                  className="data-[state=checked]:border-primary border-border"
                  checked={selectedMemoryIds.includes(memory.id)}
                  onCheckedChange={(checked) =>
                    handleSelectMemory(memory.id, checked as boolean)
                  }
                />
              </TableCell>
              <TableCell className="max-w-[200px] md:max-w-none truncate">
                {memory.state === "paused" || memory.state === "archived" ? (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => handleMemoryClick(memory.id)}
                          className={`font-medium ${
                            memory.state === "paused" ||
                            memory.state === "archived"
                              ? "text-muted-foreground"
                              : "text-foreground"
                          } cursor-pointer truncate`}
                        >
                          {memory.memory}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                      {t('thisMemoryIs', locale)} 
                          <span className="font-bold">
                            {memory.state === "paused" ? t('paused', locale) : t('archivedStatus', locale)}
                          </span>{" "}
                          and <span className="font-bold">disabled</span>.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div
                    onClick={() => handleMemoryClick(memory.id)}
                    className={`font-medium text-foreground cursor-pointer truncate`}
                  >
                    {memory.memory}
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-wrap gap-1">
                  <Categories
                    categories={memory.categories}
                    isPaused={
                      memory.state === "paused" || memory.state === "archived"
                    }
                  />
                </div>
              </TableCell>
              <TableCell className="w-[250px] text-center hidden md:table-cell">
                <SourceApp source={memory.app_name} />
              </TableCell>
              <TableCell className="w-[140px] text-center hidden md:table-cell">
                {formatDate(memory.created_at, locale)}
              </TableCell>
              <TableCell className="text-right flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-card border-border"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        const newState =
                          memory.state === "active" ? "paused" : "active";
                        handleUpdateMemoryState(memory.id, newState);
                      }}
                    >
                      {memory?.state === "active" ? (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          {t('pause', locale)}
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          {t('resume', locale)}
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        const newState =
                          memory.state === "active" ? "archived" : "active";
                        handleUpdateMemoryState(memory.id, newState);
                      }}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {memory?.state !== "archived" ? (
                        <>{t('archive', locale)}</>
                      ) : (
                        <>{t('unarchive', locale)}</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => handleMemoryClick(memory.id)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {t('edit', locale)}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-red-500 focus:text-red-500"
                      onClick={() => handleDeleteMemory(memory.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('delete', locale)}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
