export type NotificationTone = 'success' | 'error' | 'warning' | 'info';

export interface NotificationAction {
  label: string;
  onSelect: () => void;
}

/** What a caller provides when raising a notification. */
export interface NotificationInput {
  title: string;
  description?: string;
  tone?: NotificationTone;
  /** Milliseconds on screen. `null` keeps the toast until dismissed by hand. */
  durationMs?: number | null;
  action?: NotificationAction;
}

/** A notification once the provider has stamped it with identity and time. */
export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  tone: NotificationTone;
  durationMs: number | null;
  action?: NotificationAction;
  createdAt: number;
  read: boolean;
  /** True once dismissal starts, so the viewport can play the exit animation. */
  leaving: boolean;
}

export interface NotificationContextValue {
  /** Toasts currently on screen, oldest first. */
  toasts: AppNotification[];
  /** Recent notifications for the bell menu, newest first. */
  history: AppNotification[];
  unreadCount: number;
  /** Auto-dismiss countdowns are frozen (pointer is over the stack). */
  paused: boolean;
  notify: (input: NotificationInput) => string;
  dismiss: (id: string) => void;
  pauseTimers: () => void;
  resumeTimers: () => void;
  markAllRead: () => void;
  clearHistory: () => void;
}
