"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { CATEGORY_COLORS } from "@/lib/utils";
import { TrendingUp, BarChart3, PieChart as PieIcon, Activity } from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data: monthly } = useQuery({
    queryKey: ["monthly-consumption", 12],
    queryFn: () => analyticsApi.monthlyConsumption(12).then((r) => r.data),
  });

  const { data: topItems } = useQuery({
    queryKey: ["top-items", days],
    queryFn: () => analyticsApi.topItems(days, 10).then((r) => r.data),
  });

  const { data: deptUsage } = useQuery({
    queryKey: ["dept-usage", days],
    queryFn: () => analyticsApi.departmentUsage(days).then((r) => r.data),
  });

  const { data: turnover } = useQuery({
    queryKey: ["turnover", days],
    queryFn: () => analyticsApi.turnover(days).then((r) => r.data),
  });

  const chartStyle = {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8,
      fontSize: 12,
    },
  };

  return (
    <div>
      <Header title="Analytics" subtitle="Usage insights and inventory trends" />

      <div className="p-6 space-y-6">
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Period:</span>
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  days === opt.days
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Monthly trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Activity size={16} className="text-primary" />
            <h2 className="font-display font-600">Monthly Consumption (12 months)</h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthly ?? []}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip {...chartStyle} />
              <Area
                type="monotone"
                dataKey="total_consumed"
                stroke="hsl(221,83%,53%)"
                strokeWidth={2.5}
                fill="url(#grad1)"
                name="Units Consumed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top items + Dept usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top consumed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={16} className="text-emerald-500" />
              <h2 className="font-display font-600">Top Consumed Items</h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topItems ?? []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="item_name"
                  tick={{ fontSize: 10 }}
                  width={120}
                  tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "…" : v}
                />
                <Tooltip {...chartStyle} />
                <Bar dataKey="total_consumed" name="Units" radius={[0, 4, 4, 0]}>
                  {(topItems ?? []).map((entry: any, idx: number) => (
                    <Cell
                      key={idx}
                      fill={CATEGORY_COLORS[entry.category] ?? "hsl(221,83%,53%)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Department usage */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={16} className="text-purple-500" />
              <h2 className="font-display font-600">Consumption by Department</h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deptUsage ?? []} margin={{ bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip {...chartStyle} />
                <Bar dataKey="total_consumed" name="Units" fill="hsl(262,83%,58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Turnover + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Turnover table */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-amber-500" />
              <h2 className="font-display font-600">Inventory Turnover by Category</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Category</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Items</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Current Stock</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Consumed</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Turnover</th>
                </tr>
              </thead>
              <tbody>
                {(turnover ?? []).map((row: any) => (
                  <tr key={row.category} className="border-b border-border/40">
                    <td className="py-2.5 capitalize font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: CATEGORY_COLORS[row.category] }}
                        />
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">{row.item_count}</td>
                    <td className="py-2.5 text-right font-mono">{row.current_stock}</td>
                    <td className="py-2.5 text-right font-mono text-emerald-600">{row.consumed}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-amber-400"
                            style={{ width: `${Math.min(100, row.turnover_rate * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs w-10 text-right">
                          {(row.turnover_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pie */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon size={16} className="text-blue-500" />
              <h2 className="font-display font-600">Stock Distribution</h2>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={turnover ?? []}
                  dataKey="current_stock"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {(turnover ?? []).map((entry: any) => (
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[entry.category] ?? "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip {...chartStyle} />
                <Legend
                  iconSize={8}
                  formatter={(v) => <span className="text-xs capitalize">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
