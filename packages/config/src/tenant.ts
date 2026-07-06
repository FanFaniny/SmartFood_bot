import { z } from 'zod';

export const ThemeColorsSchema = z.object({
  primary: z.string(),
  background: z.string(),
  surface: z.string(),
  text: z.string(),
  hint: z.string(),
});
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

export const ThemeConfigSchema = z.object({
  mode: z.enum(['telegram', 'custom']),
  colors: ThemeColorsSchema,
});
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const VenueConfigSchema = z.object({
  name: z.string(),
  locale: z.string(),
  currency: z.string(),
});
export type VenueConfig = z.infer<typeof VenueConfigSchema>;

export const LoyaltyConfigSchema = z.object({
  earnRatePercent: z.number().min(0).max(100),
  pointToUah: z.number().positive(),
  maxSpendPercentOfOrder: z.number().min(0).max(100),
});
export type LoyaltyConfig = z.infer<typeof LoyaltyConfigSchema>;

/**
 * Несекретная часть конфигурации оплаты. Токены и URL вебхука MonoPay
 * хранятся только в .env (MONOPAY_TOKEN, MONOPAY_WEBHOOK_URL).
 */
export const PaymentsConfigSchema = z.object({
  provider: z.enum(['monopay']),
  enabled: z.boolean(),
});
export type PaymentsConfig = z.infer<typeof PaymentsConfigSchema>;

export const FeatureFlagsSchema = z.object({
  loyalty: z.boolean(),
  drinkOptions: z.boolean(),
  staffTelegramFlow: z.boolean(),
  payments: z.boolean(),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

export const TenantConfigSchema = z.object({
  tenantId: z.string(),
  venue: VenueConfigSchema,
  theme: ThemeConfigSchema,
  loyalty: LoyaltyConfigSchema,
  payments: PaymentsConfigSchema,
  features: FeatureFlagsSchema,
});

export type TenantConfig = z.infer<typeof TenantConfigSchema>;
