import type { CategoryType } from './schema';
import { uuidv5 } from './uuidv5';

// Default accounts and categories. MUST match handle_new_user() in
// supabase/migrations/20261003000000_init.sql (defaults.test.ts checks this).
// Ids are UUIDv5(user_id, '<kind>:<key>') on both sides, so device and server
// create the same rows and never duplicate them.

export const DEFAULT_ACCOUNTS = [
  { key: 'cash', name: 'Cash', icon: 'cash', color: '#2E7D32' },
  { key: 'bkash', name: 'bKash', icon: 'cellphone', color: '#E2136E' },
  { key: 'bank', name: 'Bank', icon: 'bank', color: '#1565C0' },
] as const;

export const DEFAULT_CATEGORIES: readonly {
  key: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sortOrder: number;
}[] = [
  { key: 'food', name: 'Food & Groceries', type: 'expense', icon: 'food-apple', color: '#EF6C00', sortOrder: 0 },
  { key: 'transport', name: 'Transport', type: 'expense', icon: 'bus', color: '#1E88E5', sortOrder: 1 },
  { key: 'house_rent', name: 'House Rent', type: 'expense', icon: 'home', color: '#6D4C41', sortOrder: 2 },
  { key: 'utility_bills', name: 'Utility Bills', type: 'expense', icon: 'flash', color: '#FDD835', sortOrder: 3 },
  { key: 'mobile_recharge', name: 'Mobile Recharge', type: 'expense', icon: 'cellphone', color: '#00ACC1', sortOrder: 4 },
  { key: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping', color: '#D81B60', sortOrder: 5 },
  { key: 'health', name: 'Health', type: 'expense', icon: 'medical-bag', color: '#E53935', sortOrder: 6 },
  { key: 'education', name: 'Education', type: 'expense', icon: 'school', color: '#3949AB', sortOrder: 7 },
  { key: 'family_support', name: 'Family Support', type: 'expense', icon: 'account-group', color: '#8E24AA', sortOrder: 8 },
  { key: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'movie-open', color: '#43A047', sortOrder: 9 },
  { key: 'other_expense', name: 'Other', type: 'expense', icon: 'dots-horizontal', color: '#757575', sortOrder: 10 },
  { key: 'salary', name: 'Salary', type: 'income', icon: 'briefcase', color: '#2E7D32', sortOrder: 0 },
  { key: 'business', name: 'Business', type: 'income', icon: 'store', color: '#00897B', sortOrder: 1 },
  { key: 'freelance', name: 'Freelance', type: 'income', icon: 'laptop', color: '#5E35B1', sortOrder: 2 },
  { key: 'gift', name: 'Gift', type: 'income', icon: 'gift', color: '#F4511E', sortOrder: 3 },
  { key: 'other_income', name: 'Other', type: 'income', icon: 'dots-horizontal', color: '#757575', sortOrder: 4 },
];

export const defaultRowId = (userId: string, kind: 'account' | 'category', key: string) =>
  uuidv5(`${kind}:${key}`, userId);
