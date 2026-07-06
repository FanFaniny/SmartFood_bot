export type Tab = 'menu' | 'orders' | 'loyalty';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'menu', label: 'Меню', icon: '🍽️' },
  { id: 'orders', label: 'Замовлення', icon: '🧾' },
  { id: 'loyalty', label: 'Бали', icon: '⭐' },
];

export function TabBar({
  active,
  onChange,
  loyaltyEnabled,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  loyaltyEnabled: boolean;
}) {
  const tabs = loyaltyEnabled ? TABS : TABS.filter((t) => t.id !== 'loyalty');
  return (
    <nav className="sticky bottom-0 z-30 grid border-t border-gray-200/70 bg-[var(--color-bg)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex flex-col items-center gap-0.5 py-2.5 text-xs transition ${
            active === tab.id ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
