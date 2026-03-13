"use client";
import { Bell, Search, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { alertsApi } from "@/lib/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);
  const { user } = useAuthStore();

  const { data: notifs } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => alertsApi.myNotifications(true).then((r) => r.data),
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const unreadCount = notifs?.length ?? 0;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="font-display text-xl font-600 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse-ring">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-medium text-sm">
                Notifications {unreadCount > 0 && <span className="badge-critical ml-2 px-1.5 py-0.5 rounded text-xs">{unreadCount} new</span>}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifs && notifs.length > 0 ? (
                  notifs.map((n: any) => (
                    <div key={n.id} className="px-4 py-3 border-b border-border/50 hover:bg-muted/50 last:border-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    All caught up! ✓
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        {user && (
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
