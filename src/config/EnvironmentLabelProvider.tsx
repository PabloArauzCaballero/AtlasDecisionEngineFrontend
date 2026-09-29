'use client';

import { createContext, useContext, type PropsWithChildren } from 'react';
import { env } from './env';

const EnvironmentLabelContext = createContext<string>(env.environmentLabel);

/** Reparte el ambiente que resolvió el servidor (ver `environment-label.ts`). */
export function EnvironmentLabelProvider({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <EnvironmentLabelContext.Provider value={label}>{children}</EnvironmentLabelContext.Provider>
  );
}

/** El ambiente en el que trabaja la persona; vacío = sin declarar, no se muestra nada. */
export function useEnvironmentLabel(): string {
  return useContext(EnvironmentLabelContext);
}
