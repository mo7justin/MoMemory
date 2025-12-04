"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from './LanguageContext';
import { localeNames } from '@/lib/locales';

export const LanguageSwitcher = () => {
  const { locale, setLocale, availableLocales } = useLanguage();

  return (
    <Select value={locale} onValueChange={(value) => setLocale(value as any)}>
      <SelectTrigger className="w-[140px] h-8 text-xs border-border/50 bg-card">
        <SelectValue placeholder={localeNames[locale]} />
      </SelectTrigger>
      <SelectContent className="bg-card border-border text-foreground">
        {availableLocales.map((lang) => (
          <SelectItem key={lang} value={lang} className="data-[state=checked]:bg-muted">
            {localeNames[lang]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};