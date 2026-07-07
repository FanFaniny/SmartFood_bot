import { defaultTenantConfig } from '@smartfood/config/default-tenant';
import type { ThemeConfig } from '@smartfood/config';
import type { Product } from '@smartfood/shared';
import { useEffect, useState } from 'react';

import { CartButton } from './components/CartButton';
import { ProductSheet } from './components/ProductSheet';
import { TabBar, type Tab } from './components/TabBar';
import { useBootstrap } from './hooks/queries';
import { useCustomerEvents } from './hooks/useCustomerEvents';
import { cartCount, cartSubtotalCents, useCart } from './store/cart';
import { hideBackButton, showBackButton, tg } from './lib/telegram';
import { CartScreen } from './screens/CartScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoyaltyScreen } from './screens/LoyaltyScreen';
import { OrdersScreen } from './screens/OrdersScreen';

type View = Tab | 'cart';

function applyTheme(theme: ThemeConfig | undefined): void {
  const root = document.documentElement;
  const cfg = theme ?? defaultTenantConfig.theme;
  const colors = { ...cfg.colors };

  if (cfg.mode === 'telegram' && tg) {
    const tp = tg.themeParams;
    if (tp.bg_color) colors.background = tp.bg_color;
    if (tp.text_color) colors.text = tp.text_color;
    if (tp.secondary_bg_color) colors.surface = tp.secondary_bg_color;
    if (tp.button_color) colors.primary = tp.button_color;
    if (tp.hint_color) colors.hint = tp.hint_color;
  }

  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-bg', colors.background);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-text-muted', colors.hint);
}

export function App() {
  const bootstrap = useBootstrap();
  useCustomerEvents();
  const lines = useCart((s) => s.lines);
  const [view, setView] = useState<View>('menu');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const loyaltyEnabled = bootstrap.data?.tenant.features.loyalty ?? true;

  useEffect(() => {
    applyTheme(bootstrap.data?.tenant.theme);
  }, [bootstrap.data]);

  useEffect(() => {
    const handleBack = () => {
      if (selectedProduct) {
        setSelectedProduct(null);
        return;
      }
      if (view !== 'menu') setView('menu');
    };
    const canBack = Boolean(selectedProduct) || view !== 'menu';
    if (canBack) showBackButton(handleBack);
    else hideBackButton();
  }, [selectedProduct, view]);

  const count = cartCount(lines);
  const subtotal = cartSubtotalCents(lines);
  const activeTab: Tab = view === 'cart' ? 'menu' : view;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1">
        {view === 'menu' && (
          <HomeScreen onSelectProduct={setSelectedProduct} onOpenLoyalty={() => setView('loyalty')} />
        )}
        {view === 'cart' && (
          <CartScreen
            onBackToMenu={() => setView('menu')}
            onOrderCreated={(id) => {
              setActiveOrderId(id);
              setView('orders');
            }}
          />
        )}
        {view === 'orders' && <OrdersScreen initialOrderId={activeOrderId} />}
        {view === 'loyalty' && <LoyaltyScreen />}
      </main>

      {view !== 'cart' && <CartButton count={count} subtotalCents={subtotal} onClick={() => setView('cart')} />}

      <TabBar active={activeTab} onChange={(t) => setView(t)} loyaltyEnabled={loyaltyEnabled} />

      <ProductSheet
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onGoToCart={() => {
          setSelectedProduct(null);
          setView('cart');
        }}
      />
    </div>
  );
}
