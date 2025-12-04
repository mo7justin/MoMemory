"use client";

import { useLanguage } from "@/components/shared/LanguageContext";

const localizedCopy = {
  en: {
    heroBadge: "Install Mem0",
    heroTitle: "Install Mem0 easily in your preferred stack",
    heroSubtitle:
      "Connect Momemory to your tools in minutes. Follow the curated steps below for Python, NodeJS, or the REST API.",
    quickGuide: "Quick guide",
    duration: "5 mins",
    stackTabs: [
      { label: "Python", helper: "Install mem0ai" },
      { label: "NodeJS", helper: "Use the REST API" },
      { label: "API", helper: "REST + SSE" },
    ],
    stepsTitle: "How to get started",
    stepLabel: "Step",
    steps: [
      {
        title: "Install the SDK",
        desc: "Run `pip install mem0ai` inside your virtual environment.",
      },
      {
        title: "Copy API Key",
        desc: "Grab the auto-generated `m0-*******r9Nx` key from the API keys list.",
      },
      {
        title: "Initialize the client",
        desc: "Pass the API key to `MemoryClient` and point it to the Momemory API.",
      },
      {
        title: "Add memory",
        desc: "Call `client.add(messages, user_id='alex')` to store important chats.",
      },
    ],
    snippetNote: "Launch the API Playground or view the full documentation for extended examples.",
    snippetCodeLabel: "Code",
  },
  zh: {
    heroBadge: "安装 Mem0",
    heroTitle: "在常用技术栈中 5 分钟接入 Mem0",
    heroSubtitle: "按照下面的步骤，即可把 Momemory 连接到 Python、NodeJS 或通用 REST API。",
    quickGuide: "快速引导",
    duration: "约 5 分钟",
    stackTabs: [
      { label: "Python", helper: "使用 pip 安装 mem0ai" },
      { label: "NodeJS", helper: "调用 REST API" },
      { label: "API", helper: "REST + SSE" },
    ],
    stepsTitle: "开始使用的步骤",
    stepLabel: "步骤",
    steps: [
      {
        title: "安装 SDK",
        desc: "在你的虚拟环境中执行 `pip install mem0ai`。",
      },
      {
        title: "复制 API Key",
        desc: "在控制台生成并复制以 m0- 开头的 API Key。",
      },
      {
        title: "初始化客户端",
        desc: "把 API Key 传入 `MemoryClient`，并设置 Momemory 的 API 地址。",
      },
      {
        title: "写入记忆",
        desc: "调用 `client.add(messages, user_id='alex')` 将对话存入 Momemory。",
      },
    ],
    snippetNote: "也可以打开 API Playground 或查看完整文档，获取更多示例。",
    snippetCodeLabel: "代码",
  },
} as const;

const snippets = [
  {
    label: "bash",
    text: "pip install mem0ai",
  },
  {
    label: "api_key",
    text: "m0-********r9Nx",
  },
  {
    label: "python",
    text: 'from mem0 import MemoryClient\n\nclient = MemoryClient(api_key="your-api-key")',
  },
  {
    label: "python",
    text: `messages = [
  { "role": "user", "content": "Hi, I'm Alex. I'm a vegetarian and I'm allergic to nuts." },
  { "role": "assistant", "content": "Hello Alex! I see that you're a vegetarian with a nut allergy." },
]\n\nclient.add(messages, user_id="alex")`,
  },
];

export default function GetStartedPage() {
  const { locale } = useLanguage();
  const lang = locale?.startsWith("zh") ? "zh" : "en";
  const copy = localizedCopy[lang];
  const stackTabs = copy.stackTabs;
  const steps = copy.steps;

  return (
    <main className="min-h-screen bg-[#05060a] text-white">
      <div className="relative isolate overflow-hidden">
        <div className="absolute left-1/2 top-0 h-96 w-[28rem] -translate-x-1/2 rounded-full bg-purple-600/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 lg:px-8">
          <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0d0d16] to-[#07070d] p-6 shadow-[0_25px_50px_rgba(15,11,36,0.45)] md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.6em] text-purple-300">{copy.heroBadge}</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-white md:text-4xl">{copy.heroTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70">{copy.heroSubtitle}</p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/30">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span className="text-xs uppercase tracking-[0.4em]">{copy.quickGuide}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-purple-200">
                  {copy.duration}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                {stackTabs.map((tab) => (
                  <button
                    key={tab.label}
                    className="rounded-full border border-white/20 px-3 py-1 text-white/80 transition hover:border-purple-400 hover:text-white"
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-white/60">
                {stackTabs.map((tab) => (
                  <span key={`${tab.label}-help`} className="rounded-full bg-white/5 px-3 py-1">
                    {tab.helper}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-6 rounded-3xl border border-white/5 bg-[#080813] p-6 shadow-[0_20px_60px_rgba(9,9,27,0.65)]">
              <h2 className="text-xl font-semibold text-white">{copy.stepsTitle}</h2>
              <div className="space-y-6">
                {steps.map((step, index) => (
                  <article
                    key={step.title}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-semibold text-purple-200">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm text-white/60">
                        {copy.stepLabel} {index + 1}
                      </p>
                      <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                      <p className="mt-1 text-sm text-white/70">{step.desc}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/5 bg-gradient-to-b from-[#11121b] via-[#080811] to-[#040408] p-6 shadow-[0_10px_40px_rgba(8,7,25,0.7)]">
              {snippets.map((snippet) => (
                <div key={`${snippet.label}-${snippet.text.slice(0, 10)}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-white/60">
                    <span>{snippet.label}</span>
                    <span className="text-[10px] text-white/40">{copy.snippetCodeLabel}</span>
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm font-semibold text-white">
                    {snippet.text}
                  </pre>
                </div>
              ))}
              <div className="rounded-2xl border border-purple-600/30 bg-white/5 p-4 text-sm text-white/70">
                {copy.snippetNote}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}