"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import { X, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = ["equipment","book","consumable","chemical","electronic","furniture","other"];

interface Props {
  item?: any;
  onClose: () => void;
}

export function InventoryFormModal({ item, onClose }: Props) {
  const qc = useQueryClient();
  const isEdit = !!item;

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: item
      ? {
          item_name: item.item_name,
          category: item.category,
          quantity: item.quantity,
          minimum_threshold: item.minimum_threshold,
          reorder_quantity: item.reorder_quantity,
          unit: item.unit,
          unit_cost: item.unit_cost ?? "",
          location: item.location ?? "",
          expiry_date: item.expiry_date
            ? new Date(item.expiry_date).toISOString().split("T")[0]
            : "",
        }
      : {
          category: "equipment",
          quantity: 0,
          minimum_threshold: 10,
          reorder_quantity: 50,
          unit: "unit",
        },
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? inventoryApi.update(item.id, data) : inventoryApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(isEdit ? "Item updated" : "Item created");
      onClose();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.detail ?? "Something went wrong");
    },
  });

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      quantity: Number(data.quantity),
      minimum_threshold: Number(data.minimum_threshold),
      reorder_quantity: Number(data.reorder_quantity),
      unit_cost: data.unit_cost ? Number(data.unit_cost) : null,
      expiry_date: data.expiry_date || null,
    };
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display font-600 text-lg">
            {isEdit ? "Edit Item" : "Add New Item"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Item Name *
              </label>
              <input
                {...register("item_name", { required: true })}
                className={cn(
                  "mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                  errors.item_name ? "border-destructive" : "border-border"
                )}
                placeholder="e.g. Bunsen Burner"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Category *
              </label>
              <select
                {...register("category", { required: true })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Unit
              </label>
              <input
                {...register("unit")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
                placeholder="unit, box, pack…"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Quantity *
              </label>
              <input
                type="number"
                {...register("quantity", { required: true, min: 0 })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Min Threshold
              </label>
              <input
                type="number"
                {...register("minimum_threshold", { min: 0 })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Reorder Qty
              </label>
              <input
                type="number"
                {...register("reorder_quantity", { min: 1 })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Unit Cost (₹)
              </label>
              <input
                type="number"
                step="0.01"
                {...register("unit_cost")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
                placeholder="0.00"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Location
              </label>
              <input
                {...register("location")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
                placeholder="Lab A, Shelf 3"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Expiry Date
              </label>
              <input
                type="date"
                {...register("expiry_date")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              <Save size={14} />
              {mutation.isPending ? "Saving…" : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
