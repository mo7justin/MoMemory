"use client";

import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import Image from "next/image";
import { t, Locale } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { toast } from "sonner";

// 定义基本的客户端选项卡配置
const basicClientTabs = [
  { key: "claude", icon: "/images/claude.webp" },
  { key: "cursor", icon: "/images/cursor.png" },
  { key: "cline", icon: "/images/cline.png" },
  { key: "roocline", icon: "/images/roocline.png" },
  { key: "windsurf", icon: "/images/windsurf.png" },
  { key: "witsy", icon: "/images/witsy.png" },
  { key: "enconvo", icon: "/images/enconvo.png" },
];

// 获取带翻译标签的客户端选项卡
const getClientTabs = (locale: Locale) => {
  return basicClientTabs.map(tab => ({
    ...tab,
    label: t(tab.key === 'roocline' ? 'rooCline' : tab.key as any, locale)
  }));
};

const colorGradientMap: { [key: string]: string } = {
  claude:
    "data-[state=active]:bg-[linear-gradient(to_top,_rgba(239,108,60,0.3),_rgba(239,108,60,0))] data-[state=active]:border-[#EF6C3C]",
  cline:
    "data-[state=active]:bg-[linear-gradient(to_top,_rgba(112,128,144,0.3),_rgba(112,128,144,0))] data-[state=active]:border-[#708090]",
  cursor:
    "data-[state=active]:bg-[linear-gradient(to_top,_rgba(255,255,255,0.08),_rgba(255,255,255,0))] data-[state=active]:border-[#708090]",
  roocline:
    "data-[state=active]:bg-[linear-gradient(to_top,_rgba(45,32,92,0.8),_rgba(45,32,92,0))] data-[state=active]:border-[#7E3FF2]",
  windsurf:
    "data-[state=active]:bg-[linear-gradient(to_top,_rgba(0,176,137,0.3),_rgba(0,176,137,0))] data-[state=active]:border-[#00B089]",
  witsy:
    "data-[state=active]:bg-[linear-gradient(to_top,_rgba(33,135,255,0.3),_rgba(33,135,255,0))] data-[state=active]:border-[#2187FF]",
  enconvo:
    "data-[state=active]:bg-[linear-gradient(to_top,_rgba(126,63,242,0.3),_rgba(126,63,242,0))] data-[state=active]:border-[#7E3FF2]",
};

const getColorGradient = (color: string) => {
  if (colorGradientMap[color]) {
    return colorGradientMap[color];
  }
  return "data-[state=active]:bg-[linear-gradient(to_top,_rgba(126,63,242,0.3),_rgba(126,63,242,0))] data-[state=active]:border-[#7E3FF2]";
};

export const Install = () => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const { locale } = useLanguage();
  const user = useSelector((state: RootState) => state.profile.userId);
  const URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8765";
  
  // 获取客户端选项卡
  const clientTabs = getClientTabs(locale);
  const allTabs = clientTabs;

  const handleCopy = async (tab: string, isMcp: boolean = false) => {
    const text = isMcp
      ? `${URL}/mcp/openmemory/sse/${user}`
      : `npx install-mcp i ${URL}/mcp/${tab}/sse/${user} --client ${tab}`;

    try {
      // Try using the Clipboard API first
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: Create a temporary textarea element
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      // Update UI to show success
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 1500); // Reset after 1.5s
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Copy failed");
    }
  };

  return (
    <div>
      <h2 className={`text-xl font-bold mb-6 text-foreground`}>{t('installOpenMemory', locale)}</h2>

      <div className="hidden">
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(239,108,60,0.3),_rgba(239,108,60,0))] data-[state=active]:border-[#EF6C3C]"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(112,128,144,0.3),_rgba(112,128,144,0))] data-[state=active]:border-[#708090]"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(45,32,92,0.3),_rgba(45,32,92,0))] data-[state=active]:border-[#2D205C]"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(0,176,137,0.3),_rgba(0,176,137,0))] data-[state=active]:border-[#00B089]"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(33,135,255,0.3),_rgba(33,135,255,0))] data-[state=active]:border-[#2187FF]"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(126,63,242,0.3),_rgba(126,63,242,0))] data-[state=active]:border-[#7E3FF2]"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(239,108,60,0.3),_rgba(239,108,60,0))] data-[state=active]:border-[#EF6C3C]"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(107,33,168,0.3),_rgba(107,33,168,0))] data-[state=active]:border-primary"></div>
        <div className="data-[state=active]:bg-[linear-gradient(to_top,_rgba(255,255,255,0.08),_rgba(255,255,255,0))] data-[state=active]:border-[#708090]"></div>
      </div>

      <Tabs defaultValue="claude" className="w-full">
        <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 p-0 grid grid-cols-8">
          {allTabs.map(({ key, label, icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              className={`flex-1 px-0 pb-2 rounded-none ${getColorGradient(
                key
              )} data-[state=active]:border-b-2 data-[state=active]:shadow-none text-white data-[state=active]:text-white flex items-center justify-center gap-2 text-sm`}
            >
              {icon.startsWith("/") ? (
                <div>
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    <Image src={icon} alt={label} width={40} height={40} />
                  </div>
                </div>
              ) : (
                <div className="h-6">
                  <span className="relative top-1">{icon}</span>
                </div>
              )}
              <span className={`text-foreground`}>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        

        {/* Client Tabs Content */}
        {clientTabs.map(({ key }) => (
          <TabsContent key={key} value={key} className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader className="py-4">
                <CardTitle className={`text-xl text-foreground`}>
                  {key === 'claude' ? t('claude', locale) : 
               key === 'cursor' ? t('cursor', locale) :
               key === 'cline' ? t('cline', locale) :
               key === 'roo' ? t('rooCline', locale) :
               key === 'windsurf' ? t('windsurf', locale) :
               key === 'wisty' ? t('witsy', locale) :
               key === 'enconvo' ? t('enconvo', locale) :
               t("installationCommand", locale)}
                </CardTitle>
              </CardHeader>
              <hr className="border-border" />
              <CardContent className="py-4">
                <div className="relative">
                  <pre className="bg-muted px-4 py-3 rounded-md overflow-x-auto text-sm">
                    <code className={`text-foreground`}>
                      {`npx install-mcp i ${URL}/mcp/${key}/sse/${user} --client ${key}`}
                    </code>
                  </pre>
                  <div>
                    <button
                      className="absolute top-0 right-0 py-3 px-4 rounded-md hover:bg-accent bg-muted-foreground/10"
                      aria-label="Copy to clipboard"
                      onClick={() => handleCopy(key)}
                    >
                      {copiedTab === key ? (
                        <Check className="h-5 w-5 text-green-400" />
                      ) : (
                        <Copy className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Install;
