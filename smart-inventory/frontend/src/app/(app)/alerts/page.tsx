"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertsApi, predictionsApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import {
  AlertTriangle, Clock, TrendingDown, CheckCircle,
  Eye, X, Zap, Calendar
} from "lucide-react";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery as useQ } from "@tanstack/react-query";

const ALERT_ICONS: Record<string, any> = {
  low_stock:          AlertTriangle,
  expiry:             Calendar,
  predicted_shortage: TrendingDown,
  reorder:            Zap,
};

const SEVERITY_CONFIG = {
  critical: { border: "border-l-red-500",   bg: "bg-red-50 dark:bg-red-950/20",    badge: "badge-critical" },
  high:     { border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", badge: "badge-warning" },
  medium:   { border: "border-l-blue-500",  bg: "bg-blue-50 dark:bg-blue-950/20",   badge: "badge-info" },
  low:      { border: "border-l-gray-400",  bg: "bg-gray-50 dark:bg-gray-950/20",   badge: "" },
};

export default function AlertsPage() {
  const [status, setStatus] = useState<string>("active");
  const qc = useQueryClient();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", status],
    queryFn: () => alertsApi.list(status ? { status } : {}).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: predictions } = useQuery({
    queryKey: ["bulk-predictions"],
    queryFn: () => predictionsApi.bulk().then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => alertsApi.acknowledge(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); toast.success("Alert acknowledged"); },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => alertsApi.resolve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); toast.success("Alert resolved"); },
  });

  const criticalCount = (alerts ?? []).filter((a: any) => a.severity === "critical").length;

  return (
    <div>
      <Header
        title="Alerts"
        subtitle={criticalCount > 0 ? `${criticalCount} critical alerts require attention` : "All systems nominal"}
      />

      <div className="p-6 space-y-6">
        {/* Status tabs */}
        <div className="flex items-center gap-2">
          {["active", "acknowledged", "resolved", ""].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts list */}
          <div className="lg:col-span-2 space-y-3">
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="skeleton h-4 w-3/4 mb-2" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}

            {!isLoading && (alerts ?? []).length === 0 && (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <CheckCircle className="mx-auto mb-3 text-emerald-500" size={36} />
                <p className="font-medium">No {status} alerts</p>
                <p className="text-sm text-muted-foreground mt-1">Everything is looking good!</p>
              </div>
            )}

            {(alerts ?? []).map((alert: any) => {
              const sev = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.medium;
              const Icon = ALERT_ICONS[alert.alert_type] ?? AlertTriangle;
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "bg-card border border-l-4 rounded-xl p-4 transition-shadow hover:shadow-md",
                    sev.border,
                    "border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg mt-0.5", sev.bg)}>
                      <Icon size={14} className={
                        alert.severity === "critical" ? "text-red-500" :
                        alert.severity === "high" ? "text-amber-500" : "text-blue-500"
                      } />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{alert.item?.item_name ?? "Unknown"}</p>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", sev.badge)}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {alert.alert_type.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(alert.created_at)}</p>
                    </div>

                    {alert.status === "active" && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Acknowledge"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => resolveMutation.mutate(alert.id)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-colors"
                          title="Resolve"
                        >
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prediction panel */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={16} className="text-purple-500" />
              <h2 className="font-display font-600 text-sm">Predicted Shortages</h2>
            </div>
            <div className="space-y-3">
              {(predictions ?? [])
                .filter((p: any) => p.days_until_stockout != null)
                .sort((a: any, b: any) => a.days_until_stockout - b.days_until_stockout)
                .slice(0, 8)
                .map((p: any) => (
                  <div key={p.item_id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                      p.days_until_stockout <= 7  ? "bg-red-500" :
                      p.days_until_stockout <= 14 ? "bg-amber-400" : "bg-blue-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.item_name}</p>
                      <p className="text-xs text-muted-foreground">
                        ~{p.days_until_stockout}d · restock {p.recommended_restock_qty}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold">{p.current_quantity}</p>
                      <p className="text-[10px] text-muted-foreground">in stock</p>
                    </div>
                  </div>
                ))}
              {(!predictions || predictions.filter((p: any) => p.days_until_stockout != null).length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">No imminent shortages predicted</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
