import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/shared/LanguageContext";
import { useTheme } from "next-themes";
import {
  Activity,
  Database,
  MessageCircle,
  Share2,
  Shield,
  Users,
  Zap,
} from "lucide-react";

const featureIconMap = {
  database: Database,
  users: Users,
  zap: Zap,
  message: MessageCircle,
  shield: Shield,
  share: Share2,
  activity: Activity,
};

const localizedBillingCopy = {
  en: {
    summary: [
      { label: "Plan renewal", value: "Dec 05, 2025" },
      { label: "Total memories", value: "38,256 items" },
      { label: "Monthly retrievals", value: "11,204 calls" },
    ],
    currentPlanLabel: "Current plan",
    currentPlanName: "Starter Plan",
    manageButton: "Manage plan",
    choosePlan: "Choose plan",
    planOptions: [
      {
        name: "Entry (Free)",
        price: "$0",
        period: "/month",
        tagline: "Perfect for exploring Momemory or running small tests.",
        badge: undefined,
        current: false,
        accent: "border border-slate-200 dark:border-white/10",
        highlighted: false,
        features: [
          { icon: "database", text: "10,000 memories" },
          { icon: "users", text: "Unlimited end users" },
          { icon: "zap", text: "1,000 retrieval API calls / month" },
          { icon: "message", text: "Momemory email support, 1-2 day response" },
        ],
      },
      {
        name: "Professional",
        price: "$49",
        period: "/month",
        tagline: "Recommended for builders who need dependable throughput.",
        badge: "Popular",
        current: true,
        highlighted: true,
        accent: "border border-purple-200 dark:border-purple-500 bg-white/5 shadow-[0_10px_40px_rgba(27,0,73,0.45)] dark:bg-white/10",
        features: [
          { icon: "database", text: "50,000 memories" },
          { icon: "users", text: "Unlimited end users" },
          { icon: "zap", text: "5,000 retrieval API calls / month" },
          { icon: "shield", text: "Momemory email support, 1-2 day response" },
        ],
      },
      {
        name: "Enterprise",
        price: "$299",
        period: "/month",
        tagline: "Full power for enterprise-grade deployments.",
        badge: undefined,
        current: false,
        highlighted: false,
        accent: "border border-slate-200 dark:border-white/10",
        features: [
          { icon: "database", text: "Unlimited memories" },
          { icon: "users", text: "Unlimited end users" },
          { icon: "zap", text: "Unlimited retrieval API calls" },
          { icon: "share", text: "Dedicated manager support" },
          { icon: "activity", text: "Graph memory" },
        ],
      },
    ],
    paymentHistoryLabel: "Payment history",
    invoicesTitle: "Recent invoices",
    downloadStatements: "Download statements",
    invoices: [
      { id: "#7412", date: "Nov 05, 2025", amount: "$29.00", status: "Paid" },
      { id: "#7310", date: "Oct 05, 2025", amount: "$29.00", status: "Paid" },
      { id: "#7209", date: "Sep 05, 2025", amount: "$0.00", status: "Free tier" },
    ],
  },
  zh: {
    summary: [
      { label: "续订日期", value: "2025-12-05" },
      { label: "当前记忆总量", value: "38,256 条" },
      { label: "本月检索", value: "11,204 次" },
    ],
    currentPlanLabel: "当前套餐",
    currentPlanName: "入门版（Starter）",
    manageButton: "管理套餐",
    choosePlan: "选择套餐",
    planOptions: [
      {
        name: "入门版（Free）",
        price: "¥0",
        period: "/月",
        tagline: "适合体验 Momemory 或少量调试。",
        badge: undefined,
        current: false,
        highlighted: false,
        accent: "border border-slate-200 dark:border-white/10",
        features: [
          { icon: "database", text: "10,000 条记忆" },
          { icon: "users", text: "无限终端用户" },
          { icon: "zap", text: "每月 1,000 次检索" },
          { icon: "message", text: "Momemory 邮件支持，1-2 天响应" },
        ],
      },
      {
        name: "专业版（Pro）",
        price: "¥49",
        period: "/月",
        tagline: "面向需要稳定吞吐的高级使用者。",
        badge: "热门",
        current: true,
        highlighted: true,
        accent: "border border-purple-200 dark:border-purple-500 bg-white/5 shadow-[0_10px_40px_rgba(27,0,73,0.45)] dark:bg-white/10",
        features: [
          { icon: "database", text: "50,000 条记忆" },
          { icon: "users", text: "无限终端用户" },
          { icon: "zap", text: "每月 5,000 次检索" },
          { icon: "shield", text: "Momemory 邮件支持，1-2 天响应" },
        ],
      },
      {
        name: "企业版（Enterprise）",
        price: "¥299",
        period: "/月",
        tagline: "满足企业级生产部署需求。",
        badge: undefined,
        current: false,
        highlighted: false,
        accent: "border border-slate-200 dark:border-white/10",
        features: [
          { icon: "database", text: "无限记忆容量" },
          { icon: "users", text: "无限终端用户" },
          { icon: "zap", text: "无限制检索" },
          { icon: "share", text: "专属经理支持" },
          { icon: "activity", text: "图谱记忆" },
        ],
      },
    ],
    paymentHistoryLabel: "付款记录",
    invoicesTitle: "近期账单",
    downloadStatements: "下载账单",
    invoices: [
      { id: "#7412", date: "2025-11-05", amount: "¥29.00", status: "已支付" },
      { id: "#7310", date: "2025-10-05", amount: "¥29.00", status: "已支付" },
      { id: "#7209", date: "2025-09-05", amount: "¥0.00", status: "免费版" },
    ],
  },
} as const;

export function BillingTab() {
  const { locale } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const lang = locale?.startsWith("zh") ? "zh" : "en";
  const copy = localizedBillingCopy[lang];
  const baseSurface = isDark ? "bg-[rgb(21,21,24)] text-white" : "bg-white text-slate-900";
  const borderBase = isDark ? "border-white/10" : "border-slate-200";
  const mutedText = isDark ? "text-white/70" : "text-slate-600";
  const titleText = isDark ? "text-white" : "text-slate-900";
  const faintSurface = isDark ? "bg-[rgb(21,21,24)]/85" : "bg-slate-50";
  const buttonPrimary =
    "rounded-full border border-purple-600/60 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 hover:opacity-90";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {copy.summary.map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border ${borderBase} ${baseSurface} p-5 shadow-[0_10px_30px_rgba(6,5,18,0.25)]`}
          >
            <p className={`text-sm font-medium ${mutedText}`}>{item.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${titleText}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className={`text-sm ${mutedText}`}>{copy.currentPlanLabel}</p>
          <h3 className={`text-xl font-semibold ${titleText}`}>{copy.currentPlanName}</h3>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {copy.planOptions.map((plan) => {
            const iconColor = plan.highlighted
              ? "text-purple-500"
              : isDark
                ? "text-white/70"
                : "text-slate-600";
            const buttonClass = plan.highlighted
              ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white"
              : "border border-purple-600/30 text-purple-600 bg-transparent dark:text-purple-200";
            const buttonLabel = plan.current ? copy.currentPlanLabel : copy.choosePlan;
            return (
              <div
                key={plan.name}
                className={`flex h-full flex-col rounded-3xl ${plan.accent} ${baseSurface} p-6 transition hover:-translate-y-1 hover:border-purple-400`}
              >
                <div className="flex items-center justify-between">
                  <h4 className={`text-base font-semibold ${titleText}`}>{plan.name}</h4>
                  {plan.badge && (
                    <span className="rounded-full bg-purple-600/30 px-3 py-1 text-xs font-semibold text-purple-100">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-xs ${mutedText}`}>{plan.tagline}</p>
                <div className="mt-4">
                  <span className={`text-3xl font-semibold ${titleText}`}>{plan.price}</span>
                  <span className={`text-xs font-semibold ml-2 ${mutedText}`}>{plan.period}</span>
                </div>
                <div className="mt-6 flex-1">
                  <ul className={`space-y-3 text-xs ${isDark ? "text-white/80" : "text-slate-700"}`}>
                    {plan.features.map((feature) => {
                      const Icon = featureIconMap[feature.icon as keyof typeof featureIconMap] ?? Database;
                      return (
                        <li key={feature.text} className="flex items-center gap-3 leading-relaxed">
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                          <span>{feature.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Button
                  className={`mt-8 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold shadow-lg shadow-purple-900/40 hover:opacity-90 ${buttonClass}`}
                >
                  {buttonLabel}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`space-y-4 rounded-3xl border ${borderBase} ${baseSurface} p-6 shadow-[0_20px_60px_rgba(5,0,20,0.25)]`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm ${mutedText}`}>{copy.paymentHistoryLabel}</p>
            <h3 className={`text-xl font-semibold ${titleText}`}>{copy.invoicesTitle}</h3>
          </div>
          <Button className="rounded-full border border-purple-500/60 bg-gradient-to-r from-purple-500/20 to-purple-600/20 px-5 py-2 text-sm font-semibold text-purple-200 shadow-lg shadow-purple-900/50 hover:opacity-90">
            {copy.downloadStatements}
          </Button>
        </div>
        <div className="space-y-2">
          {copy.invoices.map((invoice) => (
            <div
              key={invoice.id}
              className={`flex flex-col rounded-2xl border ${borderBase} ${faintSurface} p-4 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div>
                <p className={`text-sm font-semibold ${titleText}`}>{invoice.id}</p>
                <p className={`text-xs ${mutedText}`}>{invoice.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-semibold ${titleText}`}>{invoice.amount}</span>
                <span className="rounded-full bg-purple-600/20 px-3 py-1 text-[11px] font-semibold text-purple-100">
                  {invoice.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
