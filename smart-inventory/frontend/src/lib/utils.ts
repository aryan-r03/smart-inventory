import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDatetime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy HH:mm");
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function getStockStatus(quantity: number, threshold: number) {
  if (quantity === 0) return { label: "Out of Stock", color: "critical" };
  if (quantity <= threshold) return { label: "Critical", color: "critical" };
  if (quantity <= threshold * 2) return { label: "Low Stock", color: "warning" };
  return { label: "In Stock", color: "good" };
}

export function getExpiryStatus(expiryDate: string | null | undefined) {
  if (!expiryDate) return null;
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: "Expired", color: "critical", days };
  if (days <= 7) return { label: `${days}d left`, color: "critical", days };
  if (days <= 30) return { label: `${days}d left`, color: "warning", days };
  return { label: `${days}d left`, color: "good", days };
}

export const CATEGORY_COLORS: Record<string, string> = {
  equipment:   "#3b82f6",
  book:        "#8b5cf6",
  consumable:  "#f59e0b",
  chemical:    "#ef4444",
  electronic:  "#10b981",
  furniture:   "#6b7280",
  other:       "#64748b",
};

export const CATEGORY_ICONS: Record<string, string> = {
  equipment:   "⚗️",
  book:        "📚",
  consumable:  "🧴",
  chemical:    "🧪",
  electronic:  "🔌",
  furniture:   "🪑",
  other:       "📦",
};
