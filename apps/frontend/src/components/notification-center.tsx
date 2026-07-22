"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { InAppNotification } from "@/lib/api";

export function NotificationCenter({
  notifications,
  unreadCount,
  onOpen,
  onReadAll
}: {
  notifications: InAppNotification[];
  unreadCount: number;
  onOpen: (notification: InAppNotification) => void;
  onReadAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative grid h-10 w-10 place-items-center rounded-md border border-border bg-white text-foreground transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Уведомления"
        aria-expanded={open}
        title="Уведомления"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed left-3 right-3 top-16 z-50 overflow-hidden rounded-md border border-border bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[390px]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="font-semibold">Уведомления</p>
              <p className="text-xs text-muted">Непрочитанных: {unreadCount}</p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-xs font-medium text-primary hover:bg-primarySoft"
                onClick={onReadAll}
              >
                <CheckCheck className="h-4 w-4" />
                Прочитать все
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(65vh,520px)] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Новых событий пока нет.</p>
            ) : notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`block w-full border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${notification.readAt ? "bg-white" : "bg-blue-50/70"}`}
                onClick={() => {
                  onOpen(notification);
                  setOpen(false);
                }}
              >
                <span className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-slate-300" : "bg-primary"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{notification.title}</span>
                    <span className="mt-1 block text-sm leading-5 text-muted">{notification.message}</span>
                    <span className="mt-2 block text-xs text-muted">{formatNotificationDate(notification.createdAt)}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
