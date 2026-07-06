// Тонкая типизированная обёртка над глобальным Telegram WebApp (telegram-web-app.js).

export interface TelegramThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
}

interface BackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

interface HapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  ready: () => void;
  expand: () => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  close: () => void;
  BackButton: BackButton;
  HapticFeedback?: HapticFeedback;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export const tg: TelegramWebApp | undefined =
  typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export function isTelegram(): boolean {
  return Boolean(tg && tg.initData.length > 0);
}

export function getInitDataRaw(): string {
  return tg?.initData ?? '';
}

export function initTelegram(): void {
  if (!tg) return;
  tg.ready();
  tg.expand();
}

let backCb: (() => void) | null = null;

export function showBackButton(cb: () => void): void {
  if (!tg) return;
  if (backCb) tg.BackButton.offClick(backCb);
  backCb = cb;
  tg.BackButton.onClick(cb);
  tg.BackButton.show();
}

export function hideBackButton(): void {
  if (!tg) return;
  if (backCb) {
    tg.BackButton.offClick(backCb);
    backCb = null;
  }
  tg.BackButton.hide();
}

export function openExternal(url: string): void {
  if (tg) tg.openLink(url);
  else window.open(url, '_blank');
}

export function haptic(type: 'success' | 'error' | 'warning'): void {
  tg?.HapticFeedback?.notificationOccurred(type);
}

export function hapticTap(): void {
  tg?.HapticFeedback?.impactOccurred('light');
}
