import { useEffect, useRef } from "react";
import {
  Bell,
  Check,
  ShoppingBag,
  Package,
  AlertTriangle,
  X,
} from "lucide-react";
import type { Notification } from "@/types";
import { useUIStore } from "@/store";
import { useNotifications } from "@/hooks/useNotifications";
import gsap from "gsap";
import { formatDistanceToNow } from "date-fns";

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount } = useUIStore();
  const { markAllRead, markRead } = useNotifications();

  useEffect(() => {
    gsap.fromTo(
      panelRef.current,
      { scale: 0.95, opacity: 0, y: -8, transformOrigin: "top right" },
      { scale: 1, opacity: 1, y: 0, duration: 0.2, ease: "back.out(1.4)" },
    );

    const handleClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const iconFor = (type: string) => {
    switch (type) {
      case "new_order":
        return <ShoppingBag size={14} />;
      case "order_ready":
        return <Package size={14} />;
      case "low_stock":
        return <AlertTriangle size={14} />;
      default:
        return <Bell size={14} />;
    }
  };

  const handleMarkRead = (notif: Notification) => {
    if (!notif.is_read) {
      markRead(Number(notif.id));
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 max-h-[420px] overflow-hidden flex flex-col rounded-2xl shadow-modal z-50"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold brand-gradient text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-[var(--surface-3)]"
              style={{ color: "var(--text-muted)" }}
            >
              <Check size={11} /> Mark all read
            </button>
          )}
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bell
              size={28}
              className="mb-2"
              style={{ color: "var(--text-muted)" }}
            />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No notifications yet
            </p>
          </div>
        ) : (
          notifications.slice(0, 30).map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleMarkRead(notif)}
              className={`
                flex gap-3 px-4 py-3 cursor-pointer transition-colors
                border-b border-[var(--border)] last:border-0
                hover:bg-[var(--surface-3)]
                ${!notif.is_read ? "bg-[rgba(var(--brand-rgb),0.04)]" : ""}
              `}
            >
              {/* Icon */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${!notif.is_read ? "brand-gradient text-white" : ""}`}
                style={
                  !notif.is_read
                    ? undefined
                    : {
                        background: "var(--surface-3)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {iconFor(notif.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium line-clamp-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {notif.title}
                </p>
                <p
                  className="text-xs line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {notif.body}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatDistanceToNow(new Date(notif.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              {/* Unread dot */}
              {!notif.is_read && (
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                  style={{ background: "var(--brand-500)" }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
