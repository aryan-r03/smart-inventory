import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "blue" | "red" | "amber" | "green" | "purple";
  className?: string;
}

const colorMap = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",   icon: "text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400" },
  red:    { bg: "bg-red-50 dark:bg-red-950/30",     icon: "text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-400" },
  amber:  { bg: "bg-amber-50 dark:bg-amber-950/30", icon: "text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400" },
  green:  { bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/30", icon: "text-purple-600 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-400" },
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = "blue", className }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-5 flex items-start gap-4 hover:shadow-md transition-shadow",
      className
    )}>
      <div className={cn("p-2.5 rounded-xl", colors.icon)}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-2xl font-display font-700 mt-0.5 leading-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <p className={cn(
            "text-xs mt-1 font-medium",
            trend.value >= 0 ? "text-emerald-600" : "text-red-500"
          )}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
