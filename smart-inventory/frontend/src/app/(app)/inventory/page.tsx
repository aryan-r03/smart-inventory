"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import {
  Search, Plus, Filter, QrCode, RefreshCw,
  ChevronLeft, ChevronRight, Pencil, Trash2, Eye,
  AlertTriangle, CheckCircle, Package
} from "lucide-react";
import {
  formatDate, formatCurrency, getStockStatus,
  getExpiryStatus, CATEGORY_ICONS, cn
} from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";
import { InventoryFormModal } from "@/components/inventory/inventory-form-modal";
import { UsageLogModal } from "@/components/inventory/usage-log-modal";
import { QRScannerModal } from "@/components/inventory/qr-scanner-modal";

const CATEGORIES = ["equipment","book","consumable","chemical","electronic","furniture","other"];

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [usageItem, setUsageItem] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);

  const { isStaff, isAdmin } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", page, search, category, lowStock],
    queryFn: () =>
      inventoryApi.list({ page, page_size: 20, search: search || undefined, category: category || undefined, low_stock: lowStock || undefined })
        .then((r) => r.data),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item deleted");
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div>
      <Header title="Inventory" subtitle={`${data?.total ?? 0} items`} />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search items, SKU, barcode..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>

          <button
            onClick={() => { setLowStock(!lowStock); setPage(1); }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
              lowStock
                ? "border-red-300 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            <AlertTriangle size={14} />
            Low Stock
          </button>

          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:bg-muted"
          >
            <QrCode size={14} />
            Scan
          </button>

          {isStaff() && (
            <button
              onClick={() => { setEditItem(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors ml-auto"
            >
              <Plus size={14} />
              Add Item
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expiry</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cost</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!isLoading && (data?.items ?? []).map((item: any) => {
                  const status = getStockStatus(item.quantity, item.minimum_threshold);
                  const expiry = getExpiryStatus(item.expiry_date);
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-muted-foreground">
                          {CATEGORY_ICONS[item.category]} {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{item.location ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold">{item.quantity}</span>
                        <span className="text-muted-foreground text-xs ml-1">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          status.color === "critical" && "badge-critical",
                          status.color === "warning"  && "badge-warning",
                          status.color === "good"     && "badge-good",
                        )}>
                          {status.color === "critical" && <AlertTriangle size={10} />}
                          {status.color === "good"     && <CheckCircle size={10} />}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {expiry ? (
                          <span className={cn(
                            "text-xs font-medium",
                            expiry.color === "critical" && "text-red-500",
                            expiry.color === "warning"  && "text-amber-500",
                            expiry.color === "good"     && "text-muted-foreground",
                          )}>
                            {expiry.label}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unit_cost)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {isStaff() && (
                            <button
                              onClick={() => setUsageItem(item)}
                              className="p-1.5 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                              title="Log Usage"
                            >
                              <Package size={14} />
                            </button>
                          )}
                          {isStaff() && (
                            <button
                              onClick={() => { setEditItem(item); setShowForm(true); }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {isAdmin() && (
                            <button
                              onClick={() => {
                                if (confirm("Delete this item?")) deleteMutation.mutate(item.id);
                              }}
                              className="p-1.5 rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!isLoading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      No items found. {isStaff() && "Add your first item to get started."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} · {data?.total} items
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <InventoryFormModal
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
      {usageItem && (
        <UsageLogModal item={usageItem} onClose={() => setUsageItem(null)} />
      )}
      {showScanner && (
        <QRScannerModal onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
