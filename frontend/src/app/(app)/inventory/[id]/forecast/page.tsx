"use client";
import { useParams, useRouter } from "next/navigation";
import { useInventoryItem } from "@/hooks/useInventory";
import { useItemPrediction } from "@/hooks/useInventory";
import { Header } from "@/components/layout/header";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  TrendingDown, Calendar, Package, AlertTriangle,
  BarChart3, ChevronLeft, Sparkles
} from "lucide-react";
import { formatDate, formatNumber, getStockStatus, cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export default function ItemForecastPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: item, isLoading: itemLoading } = useInventoryItem(id);
  const { data: prediction, isLoading: predLoading } = useItemPrediction(id);

  const isLoading = itemLoading || predLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!item || !prediction) {
    return <div className="p-6 text-muted-foreground">Item not found.</div>;
  }

  const status = getStockStatus(item.quantity, item.minimum_threshold);
  const todayStock = item.quantity;

  // Build cumulative depletion chart data
  const chartData = prediction.forecast_data.map((d: any) => ({
    date: format(parseISO(d.date), "MMM d"),
    predicted: parseFloat(d.predicted.toFixed(1)),
    lower: parseFloat(d.lower.toFixed(1)),
    upper: parseFloat(d.upper.toFixed(1)),
  }));

  // Compute running stock for depletion view
  let running = todayStock;
  const depletionData = [
    { date: "Today", stock: running, threshold: item.minimum_threshold },
    ...prediction.forecast_data.map((d: any) => {
      running = Math.max(0, running - d.predicted);
      return {
        date: format(parseISO(d.date), "MMM d"),
        stock: parseFloat(running.toFixed(1)),
        threshold: item.minimum_threshold,
      };
    }),
  ];

  const confidencePct = prediction.confidence_score
    ? Math.round(prediction.confidence_score * 100)
    : null;

  return (
    <div>
      <Header title={`Forecast: ${item.item_name}`} subtitle="ML-powered stock prediction" />

      <div className="p-6 space-y-6">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={14} /> Back to inventory
        </button>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: Package,
              label: "Current Stock",
              value: `${item.quantity} ${item.unit}s`,
              color: status.color === "critical" ? "text-red-500" : "text-foreground",
            },
            {
              icon: TrendingDown,
              label: "Daily Consumption",
              value: prediction.daily_consumption_rate
                ? `${prediction.daily_consumption_rate.toFixed(2)}/day`
                : "Insufficient data",
              color: "text-foreground",
            },
            {
              icon: Calendar,
              label: "Predicted Stockout",
              value: prediction.predicted_stockout_date
                ? `${prediction.days_until_stockout} days (${formatDate(prediction.predicted_stockout_date)})`
                : "Not predicted",
              color: prediction.days_until_stockout != null && prediction.days_until_stockout <= 7
                ? "text-red-500"
                : prediction.days_until_stockout != null && prediction.days_until_stockout <= 14
                ? "text-amber-500"
                : "text-emerald-600",
            },
            {
              icon: BarChart3,
              label: "Recommended Reorder",
              value: `${prediction.recommended_restock_qty} ${item.unit}s`,
              color: "text-primary",
            },
          ].map((card) => (
            <div key={card.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <card.icon size={14} />
                <span className="text-xs font-medium">{card.label}</span>
              </div>
              <p className={cn("font-display font-600 text-base", card.color)}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Model info badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
            <Sparkles size={11} />
            Model: <strong className="capitalize">{prediction.model_used.replace("_", " ")}</strong>
            {confidencePct !== null && ` · ${confidencePct}% confidence`}
          </span>
        </div>

        {/* Stock depletion chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-600 mb-1">Projected Stock Depletion</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Based on historical consumption, with academic demand cycle adjustments
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={depletionData}>
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={Math.floor(depletionData.length / 6)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <ReferenceLine
                y={item.minimum_threshold}
                stroke="#ef4444"
                strokeDasharray="5 3"
                label={{ value: "Min threshold", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }}
              />
              <Area
                type="monotone"
                dataKey="stock"
                stroke="hsl(221,83%,53%)"
                strokeWidth={2.5}
                fill="url(#stockGrad)"
                name="Projected Stock"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily consumption forecast */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-600 mb-1">Daily Consumption Forecast</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Shaded bands show 95% prediction intervals
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(262,83%,58%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(262,83%,58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="transparent"
                fill="hsl(262,83%,58%)"
                fillOpacity={0.1}
                name="Upper bound"
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="hsl(262,83%,58%)"
                strokeWidth={2}
                fill="url(#forecastGrad)"
                name="Predicted consumption"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="transparent"
                fill="hsl(var(--background))"
                fillOpacity={1}
                name="Lower bound"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
