import type { CartItemInput, Product, ServiceType } from '@smartfood/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  product: Product;
  quantity: number;
  serviceType?: ServiceType;
  allergensNote?: string;
  preferencesNote?: string;
}

interface CartState {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      addLine: (line) =>
        set((state) => {
          const existing = state.lines.find((l) => l.product.id === line.product.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.product.id === line.product.id
                  ? { ...line, quantity: l.quantity + line.quantity }
                  : l,
              ),
            };
          }
          return { lines: [...state.lines, line] };
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.product.id !== productId)
              : state.lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l)),
        })),
      removeLine: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.product.id !== productId) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'smartfood_cart' },
  ),
);

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.product.priceUahCents * l.quantity, 0);
}

export function toCartItemsInput(lines: CartLine[]): CartItemInput[] {
  return lines.map((l) => ({
    productId: l.product.id,
    quantity: l.quantity,
    ...(l.serviceType ? { serviceType: l.serviceType } : {}),
    ...(l.allergensNote ? { allergensNote: l.allergensNote } : {}),
    ...(l.preferencesNote ? { preferencesNote: l.preferencesNote } : {}),
  }));
}
