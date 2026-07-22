'use client';

import { useContext } from 'react';
import {
  NavigationProgressContext,
  type NavigationProgressValue,
} from './NavigationProgressContext';

export function useNavigationProgress(): NavigationProgressValue {
  const context = useContext(NavigationProgressContext);
  if (!context) {
    throw new Error(
      'useNavigationProgress requiere que el árbol esté dentro de NavigationProgressProvider',
    );
  }
  return context;
}
