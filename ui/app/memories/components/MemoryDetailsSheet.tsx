"use client";

import { useLanguage } from "@/components/shared/LanguageContext";
import { t } from "@/lib/locales";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import Categories from "@/components/shared/categories";
import SourceApp from "@/components/shared/source-app";
import { formatDate } from "@/lib/helpers";
import { useMemo, useEffect, useState } from "react";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { Button } from "@/components/ui/button";
import { Copy, Check, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface MemoryDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MemoryDetailsSheet({ open, onOpenChange }: MemoryDetailsSheetProps) {
  const { locale } = useLanguage();
  const selectedMemory = useSelector((state: RootState) => state.memories.selectedMemory);
  const accessLogs = useSelector((state: RootState) => state.memories.accessLogs);
  const relatedMemories = useSelector((state: RootState) => state.memories.relatedMemories);
  const { fetchUserEndpoints, fetchUserApps, fetchAppById, fetchAccessLogs, fetchRelatedMemories, userEndpoints } = useMemoriesApi();
  const { updateMemory } = useMemoriesApi();
  const [endpointForUser, setEndpointForUser] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState('');

  const createdTs = useMemo(() => {
    const v = (selectedMemory?.created_at as any) || null;
    if (!v) return null;
    try {
      const ts = new Date(v).getTime();
      return Number.isFinite(ts) ? ts : null;
    } catch { return null; }
  }, [selectedMemory?.created_at]);
  const updatedTs = useMemo(() => {
    const v = (selectedMemory as any)?.updated_at || (selectedMemory as any)?.metadata?.updated_at || null;
    if (!v) return null;
    try {
      const ts = new Date(v).getTime();
      return Number.isFinite(ts) ? ts : null;
    } catch { return null; }
  }, [selectedMemory]);
  const websocketMeta = useMemo(() => {
    const meta = (selectedMemory as any)?.metadata || (selectedMemory as any)?.metadata_ || {};
    return meta.websocket_url || meta.endpoint || meta.endpoint_url || null;
  }, [selectedMemory]);

  const memoryDeviceName = useMemo(() => {
    const meta = (selectedMemory as any)?.metadata || (selectedMemory as any)?.metadata_ || {};
    return meta.device_name || meta.device || meta.name || selectedMemory?.app_name || null;
  }, [selectedMemory]);
  const headerWsUrl = useMemo(() => {
    if (!accessLogs || !accessLogs.length) return null;
    for (const log of accessLogs) {
      const meta: any = (log as any).metadata_ || {};
      const v = meta['X-Xiaozhi-WebSocket-Url'] || meta.endpointWebSocketUrl || meta.websocket_url || meta.endpoint_url;
      if (v) return v as string;
    }
    return null;
  }, [accessLogs]);

  const headerAgentId = useMemo(() => {
    if (!accessLogs || !accessLogs.length) return null;
    for (const log of accessLogs) {
      const meta: any = (log as any).metadata_ || {};
      const v = meta['x-agent-id'] || meta['agent_id'] || null;
      if (v) return String(v);
    }
    return null;
  }, [accessLogs]);

  useEffect(() => {
    Promise.all([fetchUserEndpoints(), fetchUserApps()]).then(([endpoints, apps]) => {
      let chosen: string | null = null;
      const norm = (s: any) => (s ? String(s).trim().toLowerCase() : "");
      const stripPrefix = (s: string) => {
        const x = norm(s);
        return x
          .replace(/^ai机器人-/, "")
          .replace(/^ai設備-/, "")
          .replace(/^机器人-/, "")
          .replace(/^設備-/, "");
      };
      const memName = norm(memoryDeviceName);
      const memNameStripped = stripPrefix(memoryDeviceName || "");
      // 1) match by agentId from header
      if (!chosen && headerAgentId) {
        const ep = endpoints.find(it => String(it.agent_id || '') === headerAgentId);
        if (ep?.endpoint_url) chosen = ep.endpoint_url;
        if (!chosen) {
          const ap = apps.find(a => String(a.agent_id || '') === headerAgentId);
          if (ap?.websocket_url) chosen = ap.websocket_url as string;
        }
      }
      // 2) match by app_name/device_name
      if (!chosen) {
        const epByName = endpoints.find(it => {
          const dn = norm(it.device_name);
          const an = norm(it.app_name);
          return dn === memName || an === memName || dn === memNameStripped || an === memNameStripped;
        });
        if (epByName?.endpoint_url) chosen = epByName.endpoint_url;
      }
      if (!chosen) {
        const apByName = apps.find(a => {
          const nn = norm(a.name);
          const dn = norm(a.device_name);
          return nn === memName || dn === memName || nn === memNameStripped || dn === memNameStripped;
        });
        if (apByName?.websocket_url) chosen = apByName.websocket_url as string;
      }
      // 2.5) direct app_id match
      if (!chosen && (selectedMemory as any)?.app_id) {
        const apById = apps.find(a => String(a.id) === String((selectedMemory as any).app_id));
        if (apById?.websocket_url) chosen = apById.websocket_url as string;
      }
      setEndpointForUser(chosen);
    });
  }, [selectedMemory?.app_name, headerAgentId, memoryDeviceName]);

  // Ensure memory-specific access logs load when a memory is selected
  useEffect(() => {
    const mid = selectedMemory?.id;
    if (mid) {
      fetchAccessLogs(mid, 1, 10).catch(() => {});
    }
  }, [selectedMemory?.id]);

  const [appEndpointProp, setAppEndpointProp] = useState<string | null>(null);
  const [appType, setAppType] = useState<string | null>(null);
  useEffect(() => {
    const aid = (selectedMemory as any)?.app_id;
    if (aid) {
      fetchAppById(String(aid)).then(app => {
        const meta = app?.metadata_ || (app as any)?.metadata || {};
        setAppType(meta.type || null);
        setAppEndpointProp(app?.websocket_url || null);
      });
    } else {
      setAppEndpointProp(null);
      setAppType(null);
    }
  }, [selectedMemory?.app_id]);

  const mcpEndpoint = useMemo(() => {
    // 只有AI机器人或者有明确WS地址时才显示
    const hasWsUrl = appEndpointProp || endpointForUser || websocketMeta || headerWsUrl;
    if (!hasWsUrl) return null;
    
    // 如果是Cursor或其他IDE，通常不需要显示Endpoint，除非明确绑定了
    const appNameLower = String(selectedMemory?.app_name || '').toLowerCase();
    const deviceNameLower = String(memoryDeviceName || '').toLowerCase();
    const typeLower = String(appType || '').toLowerCase();
    
    const isIde = appNameLower.includes('cursor') || appNameLower.includes('windsurf') || appNameLower.includes('cline') || appNameLower.includes('vscode') || typeLower === 'ide' || typeLower === 'ide_plugin';
    const isRobot = appNameLower.includes('xiaozhi') || appNameLower.includes('机器人') || appNameLower.includes('bot') || deviceNameLower.includes('xiaozhi');
    
    if (isIde && !isRobot) return null;
    
    return hasWsUrl;
  }, [appEndpointProp, endpointForUser, websocketMeta, headerWsUrl, selectedMemory?.app_name, memoryDeviceName, appType]);

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t('details', locale)}{selectedMemory?.id && (
              <span className="ml-2 text-muted-foreground text-sm">#{selectedMemory.id.slice(0, 6)}</span>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">{t('details', locale)}</TabsTrigger>
              <TabsTrigger value="sourceUpdates" className="flex-1">{t('sourceAndUpdates', locale)}</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              {!selectedMemory ? (
                <div className="text-sm text-muted-foreground">{t('loading', locale)}...</div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">ID</div>
                      <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(selectedMemory.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-foreground break-all mt-1">{selectedMemory.id}</div>
                  </div>

                  <div className="border-l-2 border-primary pl-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">{t('memory', locale)}</div>
                      <Button
                        aria-label="Edit"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditText(selectedMemory?.content || ''); setEditOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-foreground break-words">{selectedMemory.content}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Categories categories={selectedMemory.categories || []} isPaused={selectedMemory.state === 'paused' || selectedMemory.state === 'archived'} />
                    </div>
                    <div className="text-right">
                      <SourceApp source={selectedMemory.app_name} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div className="text-sm text-muted-foreground">{t('createdOn', locale)}</div>
                      <div className="text-foreground mt-1">{createdTs ? formatDate(createdTs, locale, true) : '-'}</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-sm text-muted-foreground">{t('updatedOn', locale)}</div>
                    <div className="text-foreground mt-1">{updatedTs ? formatDate(updatedTs, locale, true) : '-'}</div>
                  </div>

                  {mcpEndpoint && (
                    <div className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">{t('mcpEndpointUrl', locale)}</div>
                        <Button variant="ghost" size="icon" onClick={() => { if (mcpEndpoint) navigator.clipboard.writeText(mcpEndpoint); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-foreground break-all mt-1 text-xs">{mcpEndpoint || '-'}</div>
                    </div>
                  )}

                  <div className="border rounded p-3">
                    <div className="text-sm text-muted-foreground mb-1">Metadata</div>
                    {selectedMemory.metadata && Object.keys(selectedMemory.metadata).length > 0 ? (
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(selectedMemory.metadata, null, 2)}</pre>
                    ) : (
                      <div className="text-sm text-muted-foreground">{t('noMetadata', locale)}</div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="sourceUpdates" className="mt-4">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">{t('accessLog', locale)}</div>
                  {accessLogs && accessLogs.length > 0 ? (
                    <>
                    <div className="text-xs text-muted-foreground mb-1">下滑查看更多</div>
                    <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
                      {accessLogs.map((log) => {
                        const meta: any = (log as any).metadata_ || {};
                        const assistantText = meta?.assistant_text || meta?.response_text || meta?.output || meta?.reply || null;
                        const queryText = meta?.query || null;
                        const score = typeof meta?.score === 'number' ? meta.score : (meta?.score ? Number(meta.score) : null);
                        const rawOp = ((log as any).access_type || '').toString().toUpperCase();
                        const op = rawOp === 'UPDATE_CREATE' || rawOp === 'PROCESS' || rawOp === 'DELETE' ? 'UPDATE' : rawOp || 'UPDATE';
                        const dotClass = op === 'ADD' ? 'bg-green-500' : op === 'SEARCH' ? 'bg-blue-500' : 'bg-amber-500';
                        const labelLatest = t('latest', locale) || (String(locale).toLowerCase().startsWith('zh') ? '最新' : 'Latest');
                        const labelScore = t('score', locale) || (String(locale).toLowerCase().startsWith('zh') ? '分数' : 'Score');
                        const labelQuery = t('query', locale) || (String(locale).toLowerCase().startsWith('zh') ? '查询' : 'Query');
                        return (
                          <div key={log.id} className="border rounded p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{log.app_name}</div>
                                <div className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium">
                                  <span className={`h-2 w-2 rounded-full ${dotClass}`}></span>
                                  {op}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">{formatDate(new Date(log.accessed_at).getTime(), locale)}</div>
                            </div>
                            {score !== null && (
                              <div className="text-xs text-white mt-1">{labelScore}: {Number(score).toFixed(3)}</div>
                            )}
                            {assistantText && (
                              <div className="text-sm whitespace-pre-wrap mt-2">
                                {assistantText}
                                {op === 'UPDATE' && selectedMemory?.content && (
                                  <div className="mt-2 text-xs text-white">
                                    {labelLatest}: {selectedMemory.content}
                                  </div>
                                )}
                              </div>
                            )}
                            {!assistantText && queryText && (
                              <div className="text-sm whitespace-pre-wrap mt-2 text-white">{labelQuery}: {queryText}</div>
                            )}
                            {!assistantText && !queryText && meta?.previous_memory && (
                              <div className="text-sm whitespace-pre-wrap mt-2">Previous: {meta.previous_memory}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">{t('noAccessLogsAvailable', locale)}</div>
                  )}
                </div>

                {/* Related memories removed per request */}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('edit', locale)}</DialogTitle>
          <DialogDescription>{t('memory', locale)}</DialogDescription>
        </DialogHeader>
        <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[140px]" />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEditOpen(false)}>{t('cancel', locale)}</Button>
          <Button
            onClick={async () => {
              if (!selectedMemory?.id) return;
              try {
                await updateMemory(selectedMemory.id, editText);
                setEditOpen(false);
              } catch {}
            }}
          >
            {t('save', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
