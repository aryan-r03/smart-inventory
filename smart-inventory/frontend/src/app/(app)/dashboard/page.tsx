"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, alertsApi, inventoryApi, procurementApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Package, AlertTriangle, ShoppingCart, TrendingUp,
  DollarSign, Calendar, Bell, Boxes
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { formatCurrency, formatDate, getStockStatus, CATEGORY_COLORS } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: monthly } = useQuery({
    queryKey: ["monthly-consumption"],
    queryFn: () => analyticsApi.monthlyConsumption(6).then((r) => r.data),
  });

  const { data: topItems } = useQuery({
    queryKey: ["top-items"],
    queryFn: () => analyticsApi.topItems(30, 5).then((r) => r.data),
  });

  const { data: turnover } = useQuery({
    queryKey: ["turnover"],
    queryFn: () => analyticsApi.turnover().then((r) => r.data),
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts-active"],
    queryFn: () => alertsApi.list({ status: "active" }).then((r) => r.data),
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["inventory-low"],
    queryFn: () => inventoryApi.list({ low_stock: true, page_size: 5 }).then((r) => r.data),
  });

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={`Overview · ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`}
      />

      <div className="p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Items"
            value={stats?.total_items ?? "—"}
            icon={Package}
            color="blue"
          />
          <StatCard
            title="Low Stock"
            value={stats?.low_stock_count ?? "—"}
            subtitle="Items below threshold"
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title="Active Alerts"
            value={stats?.active_alerts ?? "—"}
            icon={Bell}
            color="amber"
          />
          <StatCard
            title="Inventory Value"
            value={stats ? formatCurrency(stats.total_inventory_value) : "—"}
            icon={DollarSign}
            color="green"
          />
          <StatCard
            title="Expiring Soon"
            value={stats?.expiring_soon_count ?? "—"}
            subtitle="Within 30 days"
            icon={Calendar}
            color="amber"
          />
          <StatCard
            title="Procurement Pending"
            value={stats?.procurement_pending ?? "—"}
            icon={ShoppingCart}
            color="purple"
          />
          <StatCard
            title="Added This Month"
            value={stats?.items_added_this_month ?? "—"}
            icon={Boxes}
            color="blue"
          />
          <StatCard
            title="Categories"
            value={turnover?.length ?? "—"}
            icon={TrendingUp}
            color="green"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Consumption trend */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h2 className="font-display font-600 text-base mb-4">Monthly Consumption</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly ?? []}>
                <defs>
                  <linearGradient id="consumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="total_consumed"
                  stroke="hsl(221,83%,53%)"
                  strokeWidth={2}
                  fill="url(#consumption)"
                  name="Units Consumed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category turnover pie */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-display font-600 text-base mb-4">By Category</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={turnover ?? []}
                  dataKey="consumed"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {(turnover ?? []).map((entry: any) => (
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[entry.category] ?? "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Legend
                  formatter={(value) => <span className="capitalize text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top consumed items */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-600 text-base">Top Consumed (30d)</h2>
              <Link href="/analytics" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="space-y-2">
              {(topItems ?? []).map((item: any, idx: number) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-muted-foreground text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.item_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{item.total_consumed}</span>
                    <span className="text-xs text-muted-foreground ml-1">units</span>
                  </div>
                  <div className="w-20 bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (item.total_consumed / (topItems[0]?.total_consumed || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low stock alerts */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-600 text-base">Low Stock Items</h2>
              <Link href="/inventory?low_stock=true" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="space-y-2">
              {(lowStockItems?.items ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">✓ All items well stocked</p>
              )}
              {(lowStockItems?.items ?? []).map((item: any) => {
                const status = getStockStatus(item.quantity, item.minimum_threshold);
                return (
                  <div key={item.id} className="flex items-center gap-3 py-1.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      status.color === "critical" ? "bg-red-500" : "bg-amber-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground">{item.location ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        status.color === "critical" ? "text-red-500" : "text-amber-500"
                      }`}>
                        {item.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground">/{item.minimum_threshold}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
