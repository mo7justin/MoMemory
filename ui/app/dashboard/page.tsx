"use client";

import { useStats, StatsTrendItem } from "@/hooks/useStats";
import { MemoryFilters } from "@/app/memories/components/MemoryFilters";
import { MemoriesSection } from "@/app/memories/components/MemoriesSection";
import "@/styles/animation.css";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Server, Activity, Calendar as CalendarIcon, Gauge } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO, eachDayOfInterval } from "date-fns";
import { enUS, zhCN, zhTW } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface DashboardStatCardProps {
  icon: ReactNode;
  title: string;
  tooltip: string;
  value: string;
  subtext: string;
}

const DashboardStatCard = ({ icon, title, tooltip, value, subtext }: DashboardStatCardProps) => (
  <Card className="min-w-0 bg-[rgb(39,39,42)] border border-white/5 text-white shadow-lg">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center">
            {icon}
          </div>
          <CardTitle className="text-base font-semibold text-white">{title}</CardTitle>
        </div>
        <UiTooltip>
          <UiTooltipTrigger asChild>
            <button
              type="button"
              className="h-6 w-6 rounded-full border border-white/40 text-[11px] font-bold text-white/80 flex items-center justify-center hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              !
            </button>
          </UiTooltipTrigger>
          <UiTooltipContent className="max-w-xs text-xs leading-relaxed">
            {tooltip}
          </UiTooltipContent>
        </UiTooltip>
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-4xl font-bold text-white">{value}</div>
      <p className="text-xs text-white/70 mt-2">{subtext}</p>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { stats, fetchStats, fetchTrends, plan } = useStats();
  const { locale } = useLanguage();
  
  const dateFnsLocale = locale === 'zh-CN' ? zhCN : locale === 'zh-TW' ? zhTW : enUS;
  
  // Data state
  const [trendData, setTrendData] = useState<StatsTrendItem[]>([]);
  const [rangeUsageTotals, setRangeUsageTotals] = useState({
    total: 0,
    breakdown: { add: 0, search: 0, list: 0, delete: 0 },
    timeline: [] as Array<{ date: string; add: number; search: number; list: number; delete: number; count: number }>,
  });
  const [cycleUsageTotals, setCycleUsageTotals] = useState({
    total: 0,
    percent: 0,
    quota: 0,
  });
  const [showApiDetails, setShowApiDetails] = useState(false);
  
  // Date state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(dateRange);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    try {
      const cookies = typeof document !== 'undefined' ? document.cookie || '' : '';
      const match = cookies.match(/(?:^|; )userInfo=([^;]+)/);
      if (match && match[1]) {
        const json = decodeURIComponent(match[1]);
        const info = JSON.parse(json);
        if (info && (info.email || info.userId)) {
          localStorage.setItem('userInfo', json);
          const id = info.email || info.userId || info.unionid || info.openid || '';
          if (id) localStorage.setItem('userEmail', id);
          window.dispatchEvent(new Event('userInfoUpdated'));
        }
      }
    } catch {}
    
    // Fetch stats
    fetchStats();
    // Fetch trends (default 365 days)
    fetchTrends(365).then(data => {
        setTrendData(data);
    });
  }, []);
  
  // Filter Data based on Date Range and fill missing days with 0
  const filteredData = useMemo(() => {
    if (!dateRange?.from) return [];
    
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to || dateRange.from);
    
    if (to < from) return [];

    // Generate all days in range to ensure continuous x-axis
    const allDays = eachDayOfInterval({ start: from, end: to });
    
    return allDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const found = trendData.find(item => item.date === dateStr);
        
        return {
            date: dateStr,
            apiUsage: found?.apiUsage || 0,
            memoryGrowth: found?.memoryGrowth || 0
        };
    });
  }, [dateRange, trendData]);

  const apiUsageChartData = filteredData.map(item => ({
    name: format(parseISO(item.date), 'MMM dd', { locale: dateFnsLocale }),
    value: item.apiUsage
  }));

  const memoryGrowthChartData = filteredData.map(item => ({
    name: format(parseISO(item.date), 'MMM dd', { locale: dateFnsLocale }),
    value: item.memoryGrowth
  }));

  const planCycleRange = useMemo(() => {
    if (!plan) return null;
    const cycleDays = plan.billing_cycle === 'monthly' ? 30 : plan.billing_cycle === 'yearly' ? 365 : 30;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    let start = plan.purchase_date ? new Date(plan.purchase_date) : subDays(now, cycleDays);
    if (Number.isNaN(start.getTime())) {
      start = subDays(now, cycleDays);
    }
    let end = plan.renewal_date ? new Date(plan.renewal_date) : new Date(start.getTime() + cycleDays * dayMs);
    if (Number.isNaN(end.getTime()) || end <= start) {
      end = new Date(start.getTime() + cycleDays * dayMs);
    }
    while (end < now) {
      start = end;
      end = new Date(start.getTime() + cycleDays * dayMs);
    }
    return { start, end };
  }, [plan?.purchase_date, plan?.renewal_date, plan?.billing_cycle]);

  const fetchUsageSummary = useCallback(
    async (start: Date, end: Date, target: "range" | "cycle") => {
      try {
        const params = new URLSearchParams();
        params.append("start_date", format(start, "yyyy-MM-dd"));
        params.append("end_date", format(end, "yyyy-MM-dd"));
        
        // Add user_id from localStorage manually to ensure it is present
        // This is a temporary fix for the dashboard 401 issue
        let uid = '';
        try {
          const s = typeof window !== 'undefined' ? localStorage.getItem('userInfo') : null;
          const obj = s ? JSON.parse(s) : null;
          uid = obj?.email || obj?.userId || '';
        } catch {}
        if (uid) params.append('user_id', uid);
        
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${apiBase}/api/v1/stats/usage?${params.toString()}`, {
          credentials: "include",
        });
        
        if (!response.ok) {
            // If auth failed or other error, use safe defaults instead of throwing
            // This prevents the whole page from crashing
            console.warn(`Fetch usage failed: ${response.status}`);
            const safeDefaults = target === "range"
                ? { total_requests: 0, requests_by_type: {}, usage_by_date: [] }
                : { total_requests: 0, plan_quota: plan?.quota || 0, plan_usage_percent: 0 };
            
            // Mimic successful data structure with empty values
            const data = safeDefaults as any;
            if (target === "range") {
              setRangeUsageTotals({
                total: 0,
                breakdown: { add: 0, search: 0, list: 0, delete: 0 },
                timeline: [],
              });
            } else {
               setCycleUsageTotals({
                total: 0,
                quota: plan?.quota || 0,
                percent: 0,
               });
            }
            return;
        }
        
        const data = await response.json();
        if (target === "range") {
          setRangeUsageTotals({
            total: data.total_requests || 0,
            breakdown: {
              add: data.requests_by_type?.add || 0,
              search: data.requests_by_type?.search || 0,
              list: data.requests_by_type?.list || 0,
              delete: data.requests_by_type?.delete || 0,
            },
            timeline: Array.isArray(data.usage_by_date) ? data.usage_by_date : [],
          });
        } else {
          const quota = data.plan_quota || data.plan?.quota || plan?.quota || 0;
          const percent = typeof data.plan_usage_percent === "number"
            ? data.plan_usage_percent
            : quota
              ? (data.total_requests / quota) * 100
              : 0;
          setCycleUsageTotals({
            total: data.total_requests || 0,
            quota,
            percent,
          });
        }
      } catch (error) {
        console.error("Failed to load usage summary", error);
        if (target === "range") {
          setRangeUsageTotals({
            total: 0,
            breakdown: { add: 0, search: 0, list: 0, delete: 0 },
            timeline: [],
          });
        } else {
          setCycleUsageTotals({
            total: 0,
            quota: plan?.quota || 0,
            percent: 0,
          });
        }
      }
    },
    [plan?.quota]
  );

  useEffect(() => {
    if (!dateRange?.from) return;
    const from = dateRange.from;
    const to = dateRange.to || dateRange.from;
    fetchUsageSummary(from, to, "range");
  }, [dateRange, fetchUsageSummary]);

  useEffect(() => {
    if (!planCycleRange) return;
    fetchUsageSummary(planCycleRange.start, planCycleRange.end, "cycle");
  }, [planCycleRange, fetchUsageSummary]);
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t('loading', locale)}...</div>;
  }
  
  const isOAuthFlow = typeof window !== 'undefined' && (window.location?.search?.includes('oauth=') || window.location?.search?.includes('code='));
  if (!isAuthenticated && !isOAuthFlow) {
    router.push('/login');
    return <div className="flex items-center justify-center h-full">Redirecting...</div>;
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempDateRange(range);
  };

  const handleApply = () => {
    setDateRange(tempDateRange);
    setIsCalendarOpen(false);
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
  };
  
  const versionLabel = "Dashboard preview v2.3.0 (fresh)";

  return (
    <div className="space-y-6 p-4 md:p-6 pb-20">
      {/* Header with Date Filter (Left Aligned) */}
      <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn(
                "w-full md:w-[260px] justify-start text-left font-normal bg-background border-input hover:bg-accent hover:text-accent-foreground",
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
                    <Button size="sm" onClick={handleApply} className="text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90">
                        {t('apply', locale)}
                    </Button>
                </div>
            </div>
            </PopoverContent>
        </Popover>

        <div className="flex items-center bg-muted/40 p-1 rounded-lg text-sm w-full md:w-auto overflow-x-auto no-scrollbar">
            <button 
                onClick={() => selectDays(365)}
                className={cn(
                    "px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                    !dateRange?.from || (dateRange.to && Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) > 30 * 24 * 60 * 60 * 1000 * 2) // Rough check for "All Time" / long range
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                {t('allTime', locale)}
            </button>
            <button 
                onClick={() => selectDays(1)}
                className={cn(
                    "px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                    dateRange?.from && dateRange.to && Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) < 2 * 24 * 60 * 60 * 1000
                        ? "bg-background shadow-sm text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                1{t('day', locale)}
            </button>
            <button 
                onClick={() => selectDays(7)}
                className={cn(
                    "px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                    dateRange?.from && dateRange.to && Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) > 6 * 24 * 60 * 60 * 1000 && Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) < 8 * 24 * 60 * 60 * 1000
                        ? "bg-background shadow-sm text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                {t('last7Days', locale)}
            </button>
            <button 
                onClick={() => selectDays(30)}
                className={cn(
                    "px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                    dateRange?.from && dateRange.to && Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) > 28 * 24 * 60 * 60 * 1000 && Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) < 32 * 24 * 60 * 60 * 1000
                        ? "bg-background shadow-sm text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                {t('last30Days', locale)}
            </button>
            </div>
          </div>
          <div className="text-xs text-white/60">
            {versionLabel}
          </div>
          
      {/* Top Row: Stats Cards */}
      <TooltipProvider delayDuration={0}>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard
            icon={<Brain className="h-4 w-4" strokeWidth={1.8} />}
            title={t('totalMemories', locale)}
            tooltip={t('totalMemoriesTooltip', locale)}
            value={(stats?.total_memories ?? 0).toLocaleString()}
            subtext={t('allStoredMemories', locale)}
          />
          <DashboardStatCard
            icon={<Gauge className="h-4 w-4" strokeWidth={1.8} />}
            title={t('retrievalEvents', locale)}
            tooltip={t('apiUsageTooltip', locale)}
            value={
              plan
                ? `${Math.min(100, Math.max(0, cycleUsageTotals.percent || 0)).toFixed(1)}%`
                : '--'
            }
            subtext={
              plan && cycleUsageTotals.quota
                ? `${cycleUsageTotals.total.toLocaleString()} / ${cycleUsageTotals.quota.toLocaleString()} ${t('apiCallsUnit', locale)}`
                : t('planQuotaUnknown', locale)
            }
          />
          <DashboardStatCard
            icon={<Server className="h-4 w-4" strokeWidth={1.8} />}
            title={t('apps', locale)}
            tooltip={t('totalAppsTooltip', locale)}
            value={(stats?.total_apps ?? 0).toLocaleString()}
            subtext={t('connectedDevices', locale)}
          />
          <DashboardStatCard
            icon={<Activity className="h-4 w-4" strokeWidth={1.8} />}
            title={t('addEvents', locale)}
            tooltip={t('apiCallCountTooltip', locale)}
            value={rangeUsageTotals.total.toLocaleString()}
            subtext={t('apiCallCountSubtext', locale)}
          />
        </div>
      </TooltipProvider>

      {/* Second Row: Charts (Equal Width) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card className="min-w-0 w-full bg-[rgb(26,26,29)] border border-white/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white">{t('apiUsageCardTitle', locale)}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-3 text-white/70 hover:text-white"
                onClick={() => setShowApiDetails((prev) => !prev)}
              >
                {showApiDetails ? t('hideDetails', locale) : t('showDetails', locale)}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pl-2 space-y-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rangeUsageTotals.timeline.length ? rangeUsageTotals.timeline.map(item => ({
                  name: format(parseISO(item.date), 'MM-dd', { locale: dateFnsLocale }),
                  add: item.add || 0,
                  search: item.search || 0,
                  list: item.list || 0,
                  delete: item.delete || 0,
                })) : apiUsageChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3a3a3d" />
                  <XAxis dataKey="name" stroke="#ccc" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ccc" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'rgb(26,26,29)', borderColor: '#555', color: '#fff' }}
                  />
                  <Bar dataKey="add" stackId="calls" fill="#7634F9" radius={[4, 4, 0, 0]} name={t('requestTypeAdd', locale)} />
                  <Bar dataKey="search" stackId="calls" fill="#38bdf8" radius={[4, 4, 0, 0]} name={t('requestTypeSearch', locale)} />
                  <Bar dataKey="list" stackId="calls" fill="#22c55e" radius={[4, 4, 0, 0]} name={t('requestTypeList', locale)} />
                  <Bar dataKey="delete" stackId="calls" fill="#f97316" radius={[4, 4, 0, 0]} name={t('requestTypeDelete', locale)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {showApiDetails && (
              <div className="grid gap-2 text-sm text-white/80">
                {['add', 'search', 'list', 'delete'].map((key) => {
                  const value = (rangeUsageTotals.breakdown as any)[key] || 0;
                  const percent = rangeUsageTotals.total ? (value / rangeUsageTotals.total) * 100 : 0;
                  const labelMap: Record<string, string> = {
                    add: t('requestTypeAdd', locale),
                    search: t('requestTypeSearch', locale),
                    list: t('requestTypeList', locale),
                    delete: t('requestTypeDelete', locale),
                  };
                  const colorMap: Record<string, string> = {
                    add: '#7634F9',
                    search: '#38bdf8',
                    list: '#22c55e',
                    delete: '#f97316',
                  };
                  return (
                    <div key={key} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorMap[key] }} />
                        <span>{labelMap[key]}</span>
                      </div>
                      <div className="text-right text-xs md:text-sm">
                        <div className="font-semibold">{value.toLocaleString()}</div>
                        <div className="text-white/60">{percent.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 bg-[rgb(26,26,29)] border border-white/5">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">{t('memoryGrowthTrend', locale)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memoryGrowthChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#444" />
                        <XAxis dataKey="name" stroke="#ccc" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                            cursor={{fill: 'var(--muted)'}}
                            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                            itemStyle={{ color: 'var(--foreground)' }}
                        />
                        <Bar dataKey="value" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
          </div>
      
      {/* Third Row: Memories List */}
      <div>
        <div className="mb-4">
            {/* Using t('recentMemories') now */}
            <h2 className="text-lg font-semibold mb-2">{t('recentMemories', locale) || "Recent Memories"}</h2>
            <MemoryFilters />
        </div>
        <MemoriesSection />
      </div>
    </div>
  );
}
