"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, defaultLocale } from '@/lib/locales';
import axios from 'axios';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: Locale[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const availableLocales: Locale[] = ['en', 'zh-CN', 'zh-TW'];

  // 从localStorage加载语言设置，如果没有则根据IP判断
  useEffect(() => {
    const savedLocale = localStorage.getItem('preferred-language') as Locale | null;
    if (savedLocale && availableLocales.includes(savedLocale)) {
      setLocale(savedLocale);
    } else {
      // 如果没有保存的语言设置，尝试通过IP判断
      const detectLanguage = async () => {
        try {
          // 设置超时时间，避免请求时间过长影响用户体验
          const res = await axios.get('https://ipapi.co/json/', { timeout: 1000 });
          const country = res.data.country_code; // CN, HK, TW, etc.
          
          let detected: Locale = 'en';
          if (country === 'CN') {
            detected = 'zh-CN';
          } else if (country === 'HK' || country === 'TW') {
            detected = 'zh-TW';
          } else {
            // 其他地区默认为英文
            detected = 'en';
          }
          
          console.log(`Detected language from IP (${country}): ${detected}`);
          setLocale(detected);
          localStorage.setItem('preferred-language', detected);
        } catch (e) {
          console.warn('Failed to detect language from IP, falling back to browser language:', e);
          // 如果IP检测失败，回退到浏览器语言
          const browserLang = navigator.language;
          if (browserLang.startsWith('zh')) {
            if (browserLang.includes('TW') || browserLang.includes('HK')) {
              setLocale('zh-TW');
            } else {
              setLocale('zh-CN');
            }
          } else {
            setLocale('en');
          }
        }
      };
      
      detectLanguage();
    }

    const handler = (e: StorageEvent) => {
      if (e.key === 'preferred-language' && e.newValue && availableLocales.includes(e.newValue as Locale)) {
        setLocale(e.newValue as Locale);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []); // availableLocales is constant

  // 保存语言设置到localStorage
  const handleSetLocale = (newLocale: Locale) => {
    if (availableLocales.includes(newLocale)) {
      setLocale(newLocale);
      localStorage.setItem('preferred-language', newLocale);
      window.dispatchEvent(new StorageEvent('storage', { key: 'preferred-language', newValue: newLocale }));
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: handleSetLocale, availableLocales }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};