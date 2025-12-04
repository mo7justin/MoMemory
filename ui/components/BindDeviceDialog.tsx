"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone } from "lucide-react";
import { useLanguage } from "./shared/LanguageContext";
import { t } from "@/lib/locales";
import { toast } from "sonner";

export function BindDeviceDialog() {
  const [open, setOpen] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { locale } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证MCP接入点地址格式
    if (!endpointUrl) {
      setError(t('mcpEndpointRequired', locale));
      return;
    }

    // 验证设备名称
    if (!deviceName) {
      setError(t('deviceNameRequired', locale));
      return;
    }

    setIsLoading(true);

    try {
      // 获取用户信息
      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        setError(t('pleaseLogin', locale));
        setIsLoading(false);
        return;
      }

      const user = JSON.parse(userInfo);
      // 优先使用环境变量，否则使用相对路径（依赖 Nginx 代理），避免移动端访问 localhost 失败
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      
      // 优先使用 userId，其次是 email
      // 注意：对于第三方登录（如微信/QQ），user_id 是 UnionID/OpenID，而 email 可能为空或与 ID 相同
      const userIdToUse = user.userId || user.email;

      // 调用绑定endpoint URL API
      const response = await fetch(`${apiUrl}/api/v1/auth/bind-endpoint?user_id=${encodeURIComponent(userIdToUse)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint_url: endpointUrl,
          device_name: deviceName
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        // 检查具体的响应状态
        if (data.status === "already_bound") {
          toast.success(t('endpointAlreadyBound', locale).replace('{{url}}', endpointUrl));
          setEndpointUrl("");
          setDeviceName("");
          setOpen(false);
        } else if (data.status === "success") {
          toast.success(t('bindSuccessMessage', locale).replace('{{url}}', endpointUrl));
          setEndpointUrl("");
          setDeviceName("");
          setOpen(false);

          // 刷新页面以更新应用列表
          window.location.reload();
        } else {
          const msg = data.message || t('bindFailed', locale);
          setError(msg);
          toast.error(msg);
        }
      } else {
        const msg = data.detail || t('bindFailed', locale);
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error('绑定设备失败:', err);
      const msg = t('networkErrorRetry', locale);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-violet-400 dark:border-violet-500 text-foreground hover:bg-violet-50 dark:hover:bg-violet-900/20"
        >
          <Smartphone size={16} />
          {t('bindDevice', locale)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('bindAiDevice', locale)}</DialogTitle>
          <DialogDescription>
            {t('bindDescription', locale)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="endpointUrl">{t('mcpEndpointUrl', locale)}</Label>
              <Input
                id="endpointUrl"
                placeholder={t('endpointUrlPlaceholder', locale)}
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('endpointFormatHint', locale)}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deviceName">{t('deviceName', locale)}</Label>
              <Input
                id="deviceName"
                placeholder={t('deviceNamePlaceholder', locale)}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('inputDeviceNameHint', locale)}
              </p>
            </div>
            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {t('cancel', locale)}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('binding', locale) : t('confirmBind', locale)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}