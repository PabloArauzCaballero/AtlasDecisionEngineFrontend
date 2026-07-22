import { createContext } from 'react';
import type { NotificationContextValue } from './notification.types';

export const NotificationContext = createContext<NotificationContextValue | null>(null);
