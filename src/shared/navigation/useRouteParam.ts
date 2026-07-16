'use client';

import { useParams } from 'next/navigation';

/**
 * Reads one App Router path parameter and normalizes catch-all values.
 */
export function useRouteParam(name: string): string {
  const params = useParams<Record<string, string | string[]>>() ?? {};
  const value = params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
