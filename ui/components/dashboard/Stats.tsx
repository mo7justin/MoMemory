"use client";
import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useStats } from "@/hooks/useStats";
import Image from "next/image";
import { getAppConfig, Icon } from "@/components/shared/source-app";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";
import { FaRobot } from "react-icons/fa";

const Stats = () => {
  const { locale } = useLanguage();
  const totalMemories = useSelector(
    (state: RootState) => state.profile.totalMemories
  );
  const totalApps = useSelector((state: RootState) => state.profile.totalApps);
  const apps = useSelector((state: RootState) => state.profile.apps).slice(
    0,
    4
  );
  const { fetchStats } = useStats();

  useEffect(() => {
    fetchStats();
  }, []);

  // 获取应用图标和名称的函数
  const resolveApp = (appName: string) => getAppConfig(appName);

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="bg-muted border-b border-border rounded-t-lg p-4">
        <div className="text-foreground text-xl font-semibold">{t('memoriesStats', locale)}</div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-muted-foreground">{t('totalMemories', locale)}</p>
          <h3 className="text-lg font-bold text-foreground">
            {totalMemories} {t('memories', locale)}
          </h3>
        </div>
        <div>
          <p className="text-muted-foreground">{t('totalAppsConnected', locale)}</p>
          <div className="flex flex-col items-start gap-1 mt-2">
            <div className="flex -space-x-2">
              {apps.map((app) => {
                const appConfig = resolveApp(app.name);
                return (
                  <div
                    key={app.id}
                    className={`h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs`}
                  >
                    <div>
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {appConfig.iconImage ? (
                          <Image
                            src={appConfig.iconImage}
                            alt={appConfig.name}
                            width={28}
                            height={28}
                          />
                        ) : (
                          appConfig.icon
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 修改这里：增加宽度和防止换行 */}
            <h3 className="text-lg font-bold text-foreground whitespace-nowrap">
              {totalApps} {t('apps', locale)}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;