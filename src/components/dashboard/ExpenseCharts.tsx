"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";

const GRID = "#E4E9E3";
const AXIS = "#8A8A8A";
const EMERALD = "#10B981";
const AMBER = "#F59E0B";

// Single-hue emerald ramp — composition read by lightness (CVD-safe), identity by legend.
const RAMP = ["#059669", "#10B981", "#34D399", "#6EE7B7", "#047857", "#065F46", "#0B3B2E", "#A7F3D0"];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #E4E9E3",
  boxShadow: "0 12px 32px rgba(16,24,20,0.08)",
  fontSize: 12,
  padding: "8px 12px",
};

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function ExpenseCharts({
  byCategory,
  byMonth,
}: {
  byCategory: { category: string; amount: number }[];
  byMonth: { month: string; income: number; expense: number }[];
}) {
  const total = byCategory.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category composition */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
            <PieIcon className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-af-ink leading-tight">Where money goes</h2>
            <p className="text-[13px] text-af-muted">Expenses by category</p>
          </div>
        </div>

        {byCategory.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-af-muted">
            No expenses logged yet.
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-[150px] h-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={RAMP[i % RAMP.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupee(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 min-w-0">
              {byCategory.map((c, i) => (
                <li key={c.category} className="flex items-center gap-2 text-[13px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RAMP[i % RAMP.length] }} />
                  <span className="font-semibold text-af-ink truncate">{c.category}</span>
                  <span className="ml-auto font-mono text-af-ink-2">{rupee(c.amount)}</span>
                  <span className="w-10 text-right font-mono text-[11px] text-af-muted">
                    {Math.round((c.amount / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Monthly cash flow */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-af-ink leading-tight">Monthly cash flow</h2>
            <p className="text-[13px] text-af-muted">Income vs expense</p>
          </div>
        </div>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 6, right: 8, bottom: 0, left: -8 }} barGap={4}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupee(v)} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="income" name="Income" fill={EMERALD} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
