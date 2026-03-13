"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import { X, ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  item: any;
  onClose: () => void;
}

const ACTIONS = [
  { value: "checkout",   label: "Check Out",  icon: ArrowDown, color: "text-red-500",   desc: "Remove stock (usage)" },
  { value: "checkin",    label: "Check In",   icon: ArrowUp,   color: "text-green-500", desc: "Return items" },
  { value: "restock",    label: "Restock",    icon: RotateCcw, color: "text-blue-500",  desc: "Add new stock" },
];

export function UsageLogModal({ item, onClose }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch } = useForm({
    defaultValues: { action: "checkout", quantity: 1, notes: "", department: "" },
  });
  const action = watch("action");

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const sign = data.action === "checkout" ? -1 : 1;
      return inventoryApi.logUsage(item.id, {
        quantity_change: sign * Number(data.quantity),
        action: data.action,
        notes: data.notes || undefined,
        department: data.department || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Usage logged successfully");
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error logging usage"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display font-600 text-lg">Log Usage</h2>
            <p className="text-sm text-muted-foreground">{item.item_name} · <span className="font-mono">{item.quantity} {item.unit}s</span> in stock</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-5 space-y-4">
          {/* Action selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ACTIONS.map((a) => (
                <label
                  key={a.value}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    action === a.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
                  }`}
                >
                  <input type="radio" {...register("action")} value={a.value} className="sr-only" />
                  <a.icon size={16} className={a.color} />
                  <span className="text-xs font-medium">{a.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantity *</label>
            <input
              type="number"
              min="1"
              {...register("quantity", { required: true, min: 1 })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
            <input
              {...register("department")}
              placeholder="e.g. Chemistry, Biology…"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Optional notes…"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {mutation.isPending ? "Saving…" : "Log Usage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
