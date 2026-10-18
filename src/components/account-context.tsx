'use client';
import { createContext, useContext } from 'react';
import type { State } from '@/domain/types';
export const AccountContext = createContext<State['account'] | null>(null);
export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('Account context is required.');
  return account;
}
