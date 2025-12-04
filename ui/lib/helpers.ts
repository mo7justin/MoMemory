import { t } from './locales';
import { defaultLocale } from './locales';
import type { Locale } from './locales';

const capitalize = (str: string) => {
    if (!str) return ''
    if (str.length <= 1) return str.toUpperCase()
    return str.toUpperCase()[0] + str.slice(1)
}

function formatDate(timestamp: number, locale: Locale = defaultLocale, precise: boolean = false) {
  if (!timestamp || Number.isNaN(timestamp)) return t('justNow', locale);
  const isMilliseconds = timestamp > 1e11;
  const date = new Date(isMilliseconds ? timestamp : timestamp * 1000);
  if (precise) {
    const year = date.getFullYear();
    const monthNum = date.getMonth() + 1;
    const dayNum = date.getDate();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    if (String(locale).startsWith('zh')) {
      return `${year}年${String(monthNum).padStart(2, '0')}月${String(dayNum).padStart(2, '0')}日，${hh}:${mm}`;
    }
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = String(dayNum).padStart(2, '0');
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  }
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffInSeconds = Math.floor(diff / 1000);
  if (!Number.isFinite(diffInSeconds)) return t('justNow', locale);
  if (diffInSeconds < 60) {
    return t('justNow', locale);
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? t('minute', locale) : t('minutes', locale)} ${t('ago', locale)}`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? t('hour', locale) : t('hours', locale)} ${t('ago', locale)}`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  return `${days} ${days === 1 ? t('day', locale) : t('days', locale)} ${t('ago', locale)}`;
}

export { capitalize, formatDate }