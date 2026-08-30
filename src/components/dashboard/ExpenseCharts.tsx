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
import { SERIES, SEQUENTIAL_GREEN, GRID, AXIS, tooltipStyle } from "@/lib/chartTheme";
import { useT } from "@/components/i18n/LanguageProvider";

const EMERALD = SERIES.income;
const AMBER = SERIES.expense;

/**
 * Composition ramp. The old emerald version zig-zagged in lightness (#059669,
 * #10B981, #34D399, #6EE7B7, then back down to #047857) so slice order carried
 * no meaning; SEQUENTIAL_GREEN steps monotonically dark→light, which is what
 * makes the split readable without colour vision. Identity is the legend list.
 */
const RAMP = SEQUENTIAL_GREEN;

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function ExpenseCharts({
  byCategory,
  byMonth,
}: {
  byCategory: { category: string; amount: number }[];
  byMonth: { month: string; income: number; expense: number }[];
}) {
  const { t } = useT();
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
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">{t("expenseCharts.whereMoneyGoes")}</h2>
            <p className="text-meta text-af-muted">{t("expenseCharts.byCategory")}</p>
          </div>
        </div>

        {byCategory.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-af-muted">
            {t("expenseCharts.noExpenses")}
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
                <li key={c.category} className="flex items-center gap-2 text-meta">
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
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">{t("expenseCharts.monthlyCashFlow")}</h2>
            <p className="text-meta text-af-muted">{t("expenseCharts.incomeVsExpense")}</p>
          </div>
        </div>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 6, right: 8, bottom: 0, left: -8 }} barGap={4}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupee(v)} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              // Identity is the legend dot; the text stays in ink. Recharts
              // colours legend labels with the series colour by default, which
              // puts mustard type at 2.2:1 on white.
              formatter={(value) => <span style={{ color: "#3F5347" }}>{value}</span>}
              />
              <Bar dataKey="income" name="Income" fill={EMERALD} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
