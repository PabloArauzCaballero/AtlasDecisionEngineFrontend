'use client';

import { useContext } from 'react';
import { NotificationContext } from './NotificationContext';
import type { NotificationContextValue } from './notification.types';

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications requiere que el árbol esté dentro de NotificationProvider');
  }
  return context;
}
