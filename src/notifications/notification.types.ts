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
  /**
   * Huella con la que reconocer el mismo suceso repetido. Por omisión se deriva
   * del tono y los textos; pásala para fundir avisos que se escriben distinto o
   * para separar los que se escriben igual.
   */
  dedupeKey?: string;
  /**
   * Avance de una operación en curso: `0`–`1`, o `null` si no se sabe cuánto
   * falta. Definirlo marca el aviso como «en curso» y le cambia el icono.
   */
  progress?: number | null;
}

/** Retoque de un aviso ya en pantalla. Lo que no se nombra, no se toca. */
export type NotificationPatch = Partial<Omit<NotificationInput, 'dedupeKey'>>;

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
  progress?: number | null;
  /** Huella con la que se funden las repeticiones. */
  dedupeKey: string;
  /** Cuándo ocurrió por última vez, contando las repeticiones fundidas. */
  lastOccurredAt: number;
  /** Veces que ha ocurrido. `1` es el caso normal; >1 lo muestra el visor. */
  repeatCount: number;
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
  /** Retoca un aviso vivo: avance, desenlace, tono. Ignora los ya retirados. */
  update: (id: string, patch: NotificationPatch) => void;
  dismiss: (id: string) => void;
  pauseTimers: () => void;
  resumeTimers: () => void;
  markAllRead: () => void;
  clearHistory: () => void;
}
