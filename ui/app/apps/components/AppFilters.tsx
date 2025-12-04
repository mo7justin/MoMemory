"use client";
import { useEffect, useState } from "react";
import { Search, ChevronDown, SortAsc, SortDesc } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  setSearchQuery,
  setActiveFilter,
  setSortBy,
  setSortDirection,
} from "@/store/appsSlice";
import { RootState } from "@/store/store";
import { useCallback } from "react";
import debounce from "lodash/debounce";
import { useAppsApi } from "@/hooks/useAppsApi";
import { AppFiltersSkeleton } from "@/skeleton/AppFiltersSkeleton";
import { t, Locale } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const getSortOptions = (locale: Locale) => [
  { value: "name", label: t("name", locale) },
  { value: "memories", label: t("memoriesCreated", locale) },
  { value: "memories_accessed", label: t("memoriesAccessed", locale) },
];

const getSortOptionLabel = (value: string, locale: Locale) => {
  const options = getSortOptions(locale);
  return options.find((o) => o.value === value)?.label || value;
};

export function AppFilters() {
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.apps.filters);
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);
  const { isLoading } = useAppsApi();

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      dispatch(setSearchQuery(query));
    }, 300),
    [dispatch]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setLocalSearch(query);
    debouncedSearch(query);
  };

  const handleActiveFilterChange = (value: string) => {
    dispatch(setActiveFilter(value === "all" ? "all" : value === "true"));
  };

  const setSorting = (sortBy: "name" | "memories" | "memories_accessed") => {
    const newDirection =
      filters.sortBy === sortBy && filters.sortDirection === "asc"
        ? "desc"
        : "asc";
    dispatch(setSortBy(sortBy));
    dispatch(setSortDirection(newDirection));
  };

  useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  const { locale } = useLanguage();

  if (isLoading) {
    return <AppFiltersSkeleton />;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchApps", locale)}
          className="pl-8"
          value={localSearch}
          onChange={handleSearchChange}
        />
      </div>

      <Select
        value={String(filters.isActive)}
        onValueChange={handleActiveFilterChange}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder={t("status", locale)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allStatus", locale)}</SelectItem>
          <SelectItem value="true">{t("active", locale)}</SelectItem>
          <SelectItem value="false">{t("inactive", locale)}</SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 px-4"
            >
              {filters.sortDirection === "asc" ? (
                <SortDesc className="h-4 w-4 mr-2" />
              ) : (
                <SortAsc className="h-4 w-4 mr-2" />
              )}
              {t("sortBy", locale)}: {getSortOptionLabel(filters.sortBy, locale)}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{t('sortBy', locale)}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {getSortOptions(locale).map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() =>
                  setSorting(
                    option.value as "name" | "memories" | "memories_accessed"
                  )
                }
                className="cursor-pointer flex justify-between items-center"
              >
                {option.label}
                {filters.sortBy === option.value &&
                  (filters.sortDirection === "asc" ? (
                    <SortAsc className="h-4 w-4 text-primary" />
                  ) : (
                    <SortDesc className="h-4 w-4 text-primary" />
                  ))}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
