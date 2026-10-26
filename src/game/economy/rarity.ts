export const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityRule {
  name: string;
  price: number;
  level: number;
  supply?: number;
  color: string;
}
export const RARITY: Record<Rarity, RarityRule> = {
  common: { name: 'Common', price: 60, level: 1, color: '#6b6560' },
  rare: { name: 'Rare', price: 200, level: 1, color: '#1f6fb8' },
  epic: { name: 'Epic', price: 600, level: 1, color: '#7a3cb4' },
  legendary: { name: 'Legendary', price: 1800, level: 1, color: '#a8740a' },
  mythic: { name: 'Mythic', price: 12000, level: 1, supply: 100, color: '#c81e2a' },
};
