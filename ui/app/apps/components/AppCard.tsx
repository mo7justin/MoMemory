import type React from "react";
import { ArrowRight, Edit3, Check, X, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { constants, Icon, getAppConfig } from "@/components/shared/source-app";
import { App } from "@/store/appsSlice";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { t, type TranslationKey } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";
import { FaRobot } from "react-icons/fa";
import { useState } from "react";

interface AppCardProps {
  app: App;
}

export function AppCard({ app }: AppCardProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  
  // 获取应用配置，如果存在预定义配置则使用，否则检查是否为endpoint URL格式或MoMemory-test1111
  const appConfig = getAppConfig(app.name);
  
  // 使用配置中的名称，如果没有则使用应用名称
  const appName = appConfig.name || app.name;
  const isActive = app.is_active;

  const handleEditClick = () => {
    setEditName(appName);
    setIsEditing(true);
  };

  const handleSaveName = async () => {
    try {
      // 调用API更新应用名称
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/v1/apps/${app.id}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editName }),
        credentials: 'include',
      });

      if (response.ok) {
        toast.success(t('success', locale), {
          description: t('appNameUpdatedSuccessfully', locale)
        });
        setIsEditing(false);
        // 刷新页面以显示更新后的名称
        window.location.reload();
      } else {
        const errorData = await response.json();
        toast.error(t('error', locale), {
          description: errorData.detail || t('failedToUpdateAppName', locale)
        });
      }
    } catch (error) {
      console.error("Failed to update app name:", error);
      toast.error(t('error', locale), {
        description: t('failedToUpdateAppName', locale)
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName("");
  };

  const handleDeleteApp = async () => {
    // 确认删除
    if (!window.confirm(t('confirmDeleteApp' as TranslationKey, locale))) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/v1/apps/${app.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success(t('success', locale), {
          description: t('appDeletedSuccessfully' as TranslationKey, locale)
        });
        // 重新加载页面以反映删除
        window.location.reload();
      } else {
        const errorData = await response.json();
        toast.error(t('error', locale), {
          description: errorData.detail || t('failedToDeleteApp' as TranslationKey, locale)
        });
      }
    } catch (error) {
      console.error("Failed to delete app:", error);
      toast.error(t('error', locale), {
        description: t('failedToDeleteApp' as TranslationKey, locale)
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1">
          <div className="relative z-10 rounded-full overflow-hidden bg-[#2a2a2a] w-6 h-6 flex items-center justify-center flex-shrink-0">
            {appConfig.iconImage ? (
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                <Image
                  src={appConfig.iconImage}
                  alt={appName}
                  width={28}
                  height={28}
                />
              </div>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                {appConfig.icon}
              </div>
            )}
          </div>
          {/* 应用名称显示或编辑 */}
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-lg font-semibold"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleSaveName}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full min-w-0">
              <h2 className="text-xl font-semibold truncate whitespace-nowrap flex-grow mr-2 min-w-0">
                {appName}
              </h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 添加编辑图标 */}
                <Edit3 
                  className="h-4 w-4 text-blue-500 hover:text-blue-700 cursor-pointer"
                  onClick={handleEditClick}
                />
                {/* 只有当应用没有记忆时才显示删除图标 */}
                {app.total_memories_created === 0 && (
                  <Trash2 
                    className="h-4 w-4 text-red-500 hover:text-red-700 cursor-pointer"
                    onClick={handleDeleteApp}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4 my-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-sm mb-1">{t('memoriesCreated', locale)}</p>
            <p className="text-xl font-medium">
              {app.total_memories_created.toLocaleString()} {t('memory', locale)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">{t('memoriesAccessed', locale)}</p>
            <p className="text-xl font-medium">
              {app.total_memories_accessed.toLocaleString()} {t('memory', locale)}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t p-0 px-6 py-2 flex justify-between items-center">
        <div
          className={`${
            isActive
              ? "bg-green-800 text-white hover:bg-green-500/20"
              : "bg-red-500/20 text-red-400 hover:bg-red-500/20"
          } rounded-lg px-2 py-0.5 flex items-center text-sm`}
        >
          <span className="h-2 w-2 my-auto mr-1 rounded-full inline-block bg-current"></span>
          {isActive ? t('active', locale) : t('inactive', locale)}
        </div>
        <div
          onClick={() => router.push(`/apps/${app.id}`)}
          className="border hover:cursor-pointer flex items-center px-3 py-1 text-sm rounded-lg p-0"
        >
          {t('view', locale)} {t('details', locale)} <ArrowRight className="ml-2 h-4 w-4" />
        </div>
      </CardFooter>
    </Card>
  );
}