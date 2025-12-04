"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountTab } from '@/components/settings/AccountTab';
import { BillingTab } from '@/components/settings/BillingTab';
import { ApiKeyManager } from '@/components/ApiKeyManager';
import { User, Key, CreditCard } from "lucide-react";
import { t } from "@/lib/locales";
import { useLanguage } from "@/components/shared/LanguageContext";

export default function SettingsPage() {
  const { locale } = useLanguage();

  return (
    <div className="container max-w-7xl py-6 space-y-8">
      <Tabs defaultValue="account" className="w-full">
        <div className="border-b mb-8">
            <TabsList className="bg-transparent h-auto p-0 w-full justify-start gap-6 rounded-none">
            <TabsTrigger 
                value="account" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 gap-2"
            >
                <User className="h-4 w-4" /> {t('account', locale)}
            </TabsTrigger>
            
            <TabsTrigger 
                value="api-keys" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 gap-2"
            >
                <Key className="h-4 w-4" /> {t('apiKeys', locale)}
            </TabsTrigger>
            
            <TabsTrigger 
                value="billing" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 gap-2"
            >
                <CreditCard className="h-4 w-4" /> {t('planBilling', locale)}
            </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="account" className="space-y-6 animate-in fade-in-50 duration-300">
            <AccountTab />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-6 animate-in fade-in-50 duration-300">
            <ApiKeyManager readOnly={true} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 animate-in fade-in-50 duration-300">
            <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
