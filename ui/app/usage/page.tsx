'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from "@/components/shared/LanguageContext";
import { t } from "@/lib/locales";
import { Activity, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays } from "date-fns";
import { enUS, zhCN, zhTW } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface UsageStats {
  total_requests: number;
  total_tokens_estimated: number;
  plan_quota?: number;
  plan_usage_percent?: number;
  plan?: {
    id: string;
    name: string;
    tier: string;
    quota: number;
    price: number;
    currency: string;
    billing_cycle: string;
    status: string;
    purchase_date: string;
    renewal_date: string;
  };
  requests_by_type: {
    search: number;
    add: number;
    list: number;
    delete: number;
  };
  usage_by_date: Array<{
    date: string;
    count: number;
    search: number;
    add: number;
    list: number;
    delete: number;
  }>;
  usage_by_app: Array<{
    app_id: string;
    app_name: string;
    count: number;
  }>;
}

export default function UsagePage() {
  const { locale } = useLanguage();
  const dateFnsLocale = locale === 'zh-CN' ? zhCN : locale === 'zh-TW' ? zhTW : enUS;

  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  // Date state aligned with Dashboard
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(dateRange);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [quickRange, setQuickRange] = useState<"week" | "month" | null>("month");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append("start_date", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        params.append("end_date", format(dateRange.to, "yyyy-MM-dd"));
      }

      const response = await fetch(`/api/v1/stats/usage?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  // Calendar handlers
  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempDateRange(range);
  };

  const handleApply = () => {
    setDateRange(tempDateRange);
    setIsCalendarOpen(false);
    setQuickRange(null);
  };

  const handleCancel = () => {
    setTempDateRange(dateRange);
    setIsCalendarOpen(false);
  };

  // Quick range handlers
  const selectDays = (days: number) => {
      const to = new Date();
      const from = subDays(to, days);
      const range = { from, to };
      setDateRange(range);
      setTempDateRange(range);
    setQuickRange(days <= 7 ? "week" : "month");
  };

  const breakdownItems = useMemo(() => {
    if (!stats) return [];
    const total = stats.total_requests || 0;
    const entries = [
      { key: 'add', label: t('requestTypeAdd', locale) || 'Add', value: stats.requests_by_type?.add || 0, color: 'text-purple-400' },
      { key: 'search', label: t('requestTypeSearch', locale) || 'Search', value: stats.requests_by_type?.search || 0, color: 'text-sky-400' },
      { key: 'list', label: t('requestTypeList', locale) || 'List', value: stats.requests_by_type?.list || 0, color: 'text-emerald-400' },
      { key: 'delete', label: t('requestTypeDelete', locale) || 'Delete', value: stats.requests_by_type?.delete || 0, color: 'text-rose-400' },
    ];
    return entries.map(item => ({
      ...item,
      percent: total ? (item.value / total) * 100 : 0,
    }));
  }, [stats, locale]);

  const maxBarValue = useMemo(() => {
    if (!stats?.usage_by_date?.length) return 0;
    return Math.max(
      ...stats.usage_by_date.flatMap(item => [
        item.add || 0,
        item.search || 0,
        item.list || 0,
        item.delete || 0,
      ])
    );
  }, [stats]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section with Date Picker */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
            {/* Date Picker Popover */}
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-full md:w-[260px] justify-start text-left font-normal bg-background border-input hover:bg-accent hover:text-accent-foreground h-10",
                    !dateRange && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                    dateRange.to ? (
                        <>
                        {format(dateRange.from, "LLL dd, y", { locale: dateFnsLocale })} -{" "}
                        {format(dateRange.to, "LLL dd, y", { locale: dateFnsLocale })}
                        </>
                    ) : (
                        format(dateRange.from, "LLL dd, y", { locale: dateFnsLocale })
                    )
                    ) : (
                    <span>{t('pickADateRange', locale)}</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <div className="p-0">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={tempDateRange?.from}
                        selected={tempDateRange}
                        onSelect={handleCalendarSelect}
                        numberOfMonths={2}
                        locale={dateFnsLocale}
                        className="p-3"
                    />
                    <div className="flex items-center justify-between p-3 border-t border-border">
                        <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs h-8">
                            {t('cancel', locale)}
                        </Button>
                        <Button size="sm" onClick={handleApply} className="text-xs h-8 bg-[rgb(119,50,227)] text-white hover:bg-[rgb(119,50,227)]/90">
                            {t('apply', locale)}
                        </Button>
                    </div>
                </div>
                </PopoverContent>
            </Popover>

            {/* Quick Select Buttons */}
            <div className="flex items-center bg-muted/40 p-1 rounded-lg text-sm w-full md:w-auto overflow-x-auto no-scrollbar h-10">
                {/* This Week */}
                <button 
                    onClick={() => selectDays(7)}
                    className={cn(
                        "px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 h-8 flex items-center",
                        quickRange === "week"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {t('thisWeek', locale)}
                </button>
                
                {/* This Month */}
                <button 
                    onClick={() => selectDays(30)}
                    className={cn(
                        "px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 h-8 flex items-center",
                        quickRange === "month"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {t('thisMonth', locale)}
                </button>
            </div>
        </div>

        <div className="flex items-center">
           <Button variant="outline" size="sm" onClick={fetchStats} className="h-10">
             <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
             {t('refresh', locale)}
           </Button>
        </div>
      </div>

      {/* Overview Cards Container */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
           <h2 className="text-2xl font-semibold text-foreground tracking-tight">Overview</h2>
        </div>
        
        {/* Usage Type List */}
        <div className="divide-y divide-border">
           {/* API Requests Row */}
           <button
             onClick={() => setShowBreakdown(prev => !prev)}
             className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
           >
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-[rgb(119,50,227)] shadow-[0_0_8px_rgba(119,50,227,0.5)]"></div>
                 <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {t('totalApiCalls', locale)}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showBreakdown && "rotate-180")} />
                 </span>
              </div>
              <div className="text-base font-mono font-semibold text-foreground">
                 {loading ? '...' : stats?.total_requests.toLocaleString() || 0}
              </div>
           </button>
           {showBreakdown && (
             <div className="bg-muted/30 divide-y divide-border">
                {breakdownItems.map(item => (
                  <div key={item.key} className="flex items-center justify-between px-6 py-2">
                    <span className={`text-sm ${item.color}`}>{item.label}</span>
                    <span className="text-sm font-mono text-foreground">
                      {item.value.toLocaleString()} ({item.percent.toFixed(1)}%)
                    </span>
                  </div>
                ))}
             </div>
           )}

           {/* Quota Row */}
           <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-[rgb(119,50,227)] shadow-[0_0_8px_rgba(119,50,227,0.5)]"></div>
                 <span className="text-sm font-medium text-muted-foreground">
                   {locale?.startsWith('zh') ? '本账单周期 API 调用额度（已使用百分比）' : 'Billing cycle API quota (usage %)'}
                 </span>
              </div>
              <div className="text-sm font-mono font-medium text-foreground">
                 {loading
                   ? '...'
                   : stats?.plan_quota
                     ? `${Math.min(stats.plan_quota, stats.total_requests || 0).toLocaleString()} / ${stats.plan_quota.toLocaleString()} (${Math.min(100, stats.plan_usage_percent || ((stats.total_requests || 0) / stats.plan_quota) * 100).toFixed(1)}%)`
                     : (stats?.total_requests || 0).toLocaleString()}
              </div>
           </div>
        </div>
      </div>

      {/* Monthly API Requests Card (Placeholder for Chart) */}
      <div className="bg-card rounded-lg border border-border p-6 min-h-[300px] flex flex-col mt-6">
         <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
           <h3 className="text-base font-semibold text-foreground">{t('apiUsageTrend', locale) || t('apiUsageOverTime', locale)}</h3>
           <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
             <div className="flex items-center gap-2">
               <span className="h-2 w-2 rounded-full bg-purple-500"></span>{t('requestTypeAdd', locale) || 'Add'}
             </div>
             <div className="flex items-center gap-2">
               <span className="h-2 w-2 rounded-full bg-sky-400"></span>{t('requestTypeSearch', locale) || 'Search'}
             </div>
             <div className="flex items-center gap-2">
               <span className="h-2 w-2 rounded-full bg-emerald-400"></span>{t('requestTypeList', locale) || 'List'}
             </div>
             <div className="flex items-center gap-2">
               <span className="h-2 w-2 rounded-full bg-rose-400"></span>{t('requestTypeDelete', locale) || 'Delete'}
             </div>
           </div>
         </div>
         
         <div className="flex-1 flex items-center justify-center">
            {loading ? (
               <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading data...
               </div>
            ) : !stats || !stats.usage_by_date?.length ? (
               <div className="text-muted-foreground text-sm">
                  {t('noUsageData', locale)}
               </div>
            ) : (
               /* Chart placeholder - using standard HTML/CSS for stability */
               <div className="w-full h-64 overflow-x-auto no-scrollbar">
                  <div className="flex items-end gap-3 h-full px-2 pb-4">
                    {stats.usage_by_date.map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center w-16 gap-2">
                        <div className="flex-1 flex items-end gap-1 w-full">
                          {['add','search','list','delete'].map(type => {
                            const value = item[type as keyof typeof item] as number;
                            const height = maxBarValue ? (value / maxBarValue) * 100 : 0;
                            const color =
                              type === 'add'
                                ? 'bg-purple-500'
                                : type === 'search'
                                  ? 'bg-sky-400'
                                  : type === 'list'
                                    ? 'bg-emerald-400'
                                    : 'bg-rose-400';
                            return (
                              <div key={type} className="group flex-1 flex items-end">
                                <div
                                  className={`${color} w-full rounded-t relative transition-all`}
                                  style={{ height: `${height}%` }}
                                >
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none shadow border border-border whitespace-nowrap">
                                    {item.date} · {value}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{item.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
