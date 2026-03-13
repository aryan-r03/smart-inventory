"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { procurementApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Sparkles, Plus, CheckCircle, XCircle, Package, Clock, TruckIcon } from "lucide-react";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  suggested:  { label: "Suggested",  color: "badge-info",     icon: Sparkles },
  approved:   { label: "Approved",   color: "badge-good",     icon: CheckCircle },
  ordered:    { label: "Ordered",    color: "badge-warning",  icon: Clock },
  received:   { label: "Received",   color: "badge-good",     icon: TruckIcon },
  cancelled:  { label: "Cancelled",  color: "badge-critical", icon: XCircle },
};

const STATUS_FLOW: Record<string, string[]> = {
  suggested: ["approved", "cancelled"],
  approved:  ["ordered", "cancelled"],
  ordered:   ["received", "cancelled"],
};

export default function ProcurementPage() {
  const [filter, setFilter] = useState("");
  const qc = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["procurement", filter],
    queryFn: () => procurementApi.list(filter ? { status: filter } : {}).then((r) => r.data),
  });

  const autoSuggestMutation = useMutation({
    mutationFn: () => procurementApi.autoSuggest(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["procurement"] });
      toast.success(`${res.data.created} procurement suggestions generated`);
    },
    onError: () => toast.error("Failed to generate suggestions"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      procurementApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement"] });
      toast.success("Order updated");
    },
  });

  const totalValue = (orders ?? []).reduce((sum: number, o: any) => sum + (o.total_cost ?? 0), 0);

  return (
    <div>
      <Header title="Procurement" subtitle="Purchase orders and restocking suggestions" />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {["", "suggested", "approved", "ordered", "received"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors",
                  filter === s
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s || "All"}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-bold text-foreground">{formatCurrency(totalValue)}</span>
            </span>
            <button
              onClick={() => autoSuggestMutation.mutate()}
              disabled={autoSuggestMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors"
            >
              <Sparkles size={14} />
              {autoSuggestMutation.isPending ? "Generating…" : "AI Auto-Suggest"}
            </button>
          </div>
        </div>

        {/* Orders grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
              {[1,2,3].map(j => <div key={j} className="skeleton h-4" />)}
            </div>
          ))}

          {!isLoading && (orders ?? []).map((order: any) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.suggested;
            const StatusIcon = cfg.icon;
            const nextStatuses = STATUS_FLOW[order.status] ?? [];

            return (
              <div key={order.id} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{order.item?.item_name ?? "Unknown Item"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{order.item?.category}</p>
                  </div>
                  <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", cfg.color)}>
                    <StatusIcon size={10} />
                    {cfg.label}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="font-mono font-bold">{order.quantity} <span className="text-xs font-normal text-muted-foreground">{order.item?.unit}</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                    <p className="font-medium">{formatCurrency(order.total_cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Supplier</p>
                    <p className="text-xs truncate">{order.supplier?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expected</p>
                    <p className="text-xs">{formatDate(order.expected_delivery)}</p>
                  </div>
                </div>

                {/* Reason */}
                {order.reason && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 line-clamp-2">
                    {order.ai_generated && "🤖 "}{order.reason}
                  </p>
                )}

                {/* Actions */}
                {nextStatuses.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    {nextStatuses.map((ns) => (
                      <button
                        key={ns}
                        onClick={() => updateMutation.mutate({ id: order.id, status: ns })}
                        disabled={updateMutation.isPending}
                        className={cn(
                          "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors",
                          ns === "cancelled"
                            ? "border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            : "border-primary/30 text-primary hover:bg-primary/5"
                        )}
                      >
                        → {ns}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!isLoading && (orders ?? []).length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <ShoppingCartIcon className="mx-auto mb-3 opacity-30" size={40} />
              <p>No procurement orders found.</p>
              <p className="text-sm mt-1">Run "AI Auto-Suggest" to generate recommendations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShoppingCartIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="8" cy="21" r="1"/>
      <circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
  );
}
