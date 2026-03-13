"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Package, BarChart3, ShoppingCart,
  Bell, Settings, LogOut, ChevronLeft, ChevronRight,
  Beaker, BookOpen, Zap, Users, QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard",    roles: ["admin","lab_staff","student"] },
  { href: "/inventory",     icon: Package,          label: "Inventory",    roles: ["admin","lab_staff","student"] },
  { href: "/analytics",     icon: BarChart3,        label: "Analytics",    roles: ["admin","lab_staff"] },
  { href: "/procurement",   icon: ShoppingCart,     label: "Procurement",  roles: ["admin","lab_staff"] },
  { href: "/alerts",        icon: Bell,             label: "Alerts",       roles: ["admin","lab_staff"] },
  { href: "/settings",      icon: Settings,         label: "Settings",     roles: ["admin"] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const visibleItems = navItems.filter(item =>
    !user || item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-border",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <Beaker className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-display font-700 text-sm leading-tight">LabTrack</p>
            <p className="text-xs text-muted-foreground">Smart Inventory</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn(
        "border-t border-border p-3",
        collapsed ? "flex justify-center" : ""
      )}>
        {!collapsed && user && (
          <div className="mb-2 px-2">
            <p className="text-sm font-medium truncate">{user.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role.replace("_", " ")}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={16} />
          {!collapsed && "Sign out"}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
