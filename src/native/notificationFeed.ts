import { useEffect, useState } from "react";
import type { NotificationCategory } from "./notificationPrefs";

export interface ActiveNotification {
  id: string;
  category: NotificationCategory | "emergency" | "general";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timing?: "advance" | "start";
  timestamp: number;
}

type NotificationListener = (notification: ActiveNotification | null) => void;

const listeners = new Set<NotificationListener>();
let currentNotification: ActiveNotification | null = null;

export function getActiveNotification(): ActiveNotification | null {
  return currentNotification;
}

export function postActiveNotification(notification: ActiveNotification) {
  currentNotification = notification;
  for (const listener of listeners) {
    try {
      listener(currentNotification);
    } catch {
      // ignore
    }
  }
}

export function dismissActiveNotification(id?: string) {
  if (id && currentNotification && currentNotification.id !== id) {
    return;
  }
  currentNotification = null;
  for (const listener of listeners) {
    try {
      listener(null);
    } catch {
      // ignore
    }
  }
}

export function subscribeActiveNotification(
  listener: NotificationListener
): () => void {
  listeners.add(listener);
  listener(currentNotification);
  return () => {
    listeners.delete(listener);
  };
}

export function useActiveNotification(): {
  notification: ActiveNotification | null;
  dismiss: (id?: string) => void;
} {
  const [notification, setNotification] = useState<ActiveNotification | null>(
    currentNotification
  );

  useEffect(() => {
    return subscribeActiveNotification((notif) => {
      setNotification(notif);
    });
  }, []);

  return {
    notification,
    dismiss: dismissActiveNotification,
  };
}

