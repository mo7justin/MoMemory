"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from "@/components/shared/LanguageContext";
import { t } from "@/lib/locales";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Trash2, Plus, Key, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from 'axios';
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  created_at: string;
  last_used_at?: string;
  is_active: boolean;
}

const localizedApiCopy = {
  en: {
    description: "Manage your API keys to access Momemory programmatically.",
    newKeyLabel: "New Key Name",
    newKeyPlaceholder: "e.g. My App, Testing Script",
    createButton: "Create Key",
    creating: "Creating...",
    tableHeaders: ["Name", "Key / Token", "Created", "Status", "Actions"],
    empty: "No API keys found. Create one to get started.",
    statusActive: "Active",
    statusInactive: "Inactive",
    deleteConfirm: "Are you sure you want to delete this API Key? This action cannot be undone.",
    validationName: "Please enter a name for your API Key",
    createSuccess: "API Key created successfully",
    createError: "Failed to create API Key",
    deleteSuccess: "API Key deleted",
    deleteError: "Failed to delete API Key",
    copied: "Copied to clipboard",
    infoTitle: "Developer Note",
    infoDesc: "API keys allow full access to your memories. Keep them secure and never commit them to public repositories.",
  },
  zh: {
    description: "管理你的 API Key，以便在程序或代理中访问 Momemory。",
    newKeyLabel: "新的 Key 名称",
    newKeyPlaceholder: "例如：我的应用、测试脚本",
    createButton: "创建 Key",
    creating: "正在创建...",
    tableHeaders: ["名称", "Key / Token", "创建时间", "状态", "操作"],
    empty: "暂无 API Key，创建后即可开始使用。",
    statusActive: "启用",
    statusInactive: "停用",
    deleteConfirm: "确定要删除这个 API Key 吗？该操作无法撤销。",
    validationName: "请先填写 API Key 的名称",
    createSuccess: "API Key 创建成功",
    createError: "创建 API Key 失败",
    deleteSuccess: "API Key 已删除",
    deleteError: "删除 API Key 失败",
    copied: "已复制到剪贴板",
    infoTitle: "开发者提示",
    infoDesc: "API Key 拥有读取/写入记忆的权限，请妥善保存，不要提交到公共仓库。",
  },
} as const;

export function ApiKeyManager() {
  const { locale } = useLanguage();
  const lang = locale?.startsWith("zh") ? "zh" : "en";
  const text = localizedApiCopy[lang];
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  
  const userEmail = useSelector((state: RootState) => state.profile.email);
  const userId = useSelector((state: RootState) => state.profile.userId);

  const fetchApiKeys = async () => {
    if (!userId && !userEmail) return;
    
    try {
      setLoading(true);
      const uid = userId || userEmail;
      // Mock data for now if endpoint fails or not ready
      try {
          const res = await axios.get(`/api/v1/api-keys`, { params: { user_id: uid } });
          setApiKeys(res.data);
      } catch (e) {
          console.warn("API Key endpoint not ready, using mock");
          setApiKeys([]); 
      }
      
    } catch (error) {
      console.error("Failed to fetch API keys", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, [userId, userEmail]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(text.validationName);
      return;
    }

    try {
      setCreateLoading(true);
      const uid = userId || userEmail;
      const res = await axios.post('/api/v1/api-keys', {
        user_id: uid,
        name: newKeyName
      });
      
      toast.success(text.createSuccess);
      setNewKeyName("");
      fetchApiKeys(); // Refresh list
      
      // Show the key to user (usually only shown once)
      if (res.data.key) {
          // Ideally show a dialog with the key
      }
    } catch (error) {
      console.error("Failed to create API key", error);
      toast.error(text.createError);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm(text.deleteConfirm)) return;
    
    try {
      await axios.delete(`/api/v1/api-keys/${id}`);
      toast.success(text.deleteSuccess);
      setApiKeys(prev => prev.filter(k => k.id !== id));
    } catch (error) {
      console.error("Failed to delete API key", error);
      toast.error(text.deleteError);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(localizedApiCopy[lang].copied);
  };

  const dateFormat = lang === "en" ? "MMM d, yyyy" : "yyyy-MM-dd";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {t('apiKeys', locale)}
        </CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create New Key */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="keyName">{text.newKeyLabel}</Label>
            <Input 
              id="keyName" 
              placeholder={text.newKeyPlaceholder} 
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>
          <Button onClick={handleCreateKey} disabled={createLoading}>
            {createLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {text.creating}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {text.createButton}
              </>
            )}
          </Button>
        </div>

        {/* Keys List */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {text.tableHeaders.map((header, index) => (
                  <TableHead key={header} className={index === text.tableHeaders.length - 1 ? "text-right" : undefined}>
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {text.empty}
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[150px]">{apiKey.key}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(apiKey.key)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(apiKey.created_at), dateFormat)}</TableCell>
                    <TableCell>
                      <Badge variant={apiKey.is_active ? "default" : "secondary"}>
                        {apiKey.is_active ? text.statusActive : text.statusInactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteKey(apiKey.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground flex gap-3 items-start">
           <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
           <div>
             <p className="font-medium text-foreground mb-1">{text.infoTitle}</p>
             <p>{text.infoDesc}</p>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
