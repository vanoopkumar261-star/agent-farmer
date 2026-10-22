"use client";

import { useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";
import { useChartTheme } from "@/components/theme/useChartTheme";
import { rupee, rupeeShort } from "@/lib/format";
import { useT } from "@/components/i18n/LanguageProvider";

/*
  EMERALD / AMBER / RAMP used to be module constants. They are resolved inside
  the component now, because each is a different colour per theme and a module
  constant would have captured whichever theme happened to load first.

  On RAMP: the old emerald version zig-zagged in lightness (#059669, #10B981,
  #34D399, #6EE7B7, then back down to #047857) so slice order carried no
  meaning. SEQUENTIAL_GREEN steps monotonically, which is what makes the split
  readable without colour vision — note it runs dark→light in the light theme
  and light→dark in the dark one, for the same reason. Identity is the legend.
*/

export default function ExpenseCharts({
  byCategory,
  byMonth,
}: {
  byCategory: { category: string; amount: number }[];
  byMonth: { month: string; income: number; expense: number }[];
}) {
  const { t } = useT();
  const { SERIES, SEQUENTIAL_GREEN, GRID, AXIS, LEGEND_INK, tooltipStyle, CURSOR_FILL, MARK } =
    useChartTheme();
  const EMERALD = SERIES.income;
  const AMBER = SERIES.expense;
  const RAMP = SEQUENTIAL_GREEN;
  const total = byCategory.reduce((s, c) => s + c.amount, 0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pieData = byCategory.map((c, i) => ({
    label: c.category,
    value: c.amount,
    color: RAMP[i % RAMP.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category composition */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-primary">
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
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/*
              Bklit donut. The slice colours still come from chartTheme's
              sequential ramp, so the split stays readable without colour
              vision — the ramp steps monotonically in lightness.

              Hover is CONTROLLED and shared with the list beside it: pointing
              at a slice lights its row and vice versa. That pairing is the
              reason the list stays hand-rolled rather than using the library's
              own Legend — ours carries the rupee amount and the share, which a
              generic legend has nowhere to put.
            */}
            <div className="shrink-0">
              <PieChart
                data={pieData}
                size={168}
                innerRadius={48}
                padAngle={0.02}
                cornerRadius={3}
                hoveredIndex={hoveredIndex}
                onHoverChange={setHoveredIndex}
              >
                {pieData.map((_, i) => (
                  <PieSlice index={i} key={i} />
                ))}
                <PieCenter defaultLabel={t("expenseCharts.total")}>
                  {({ value, label }) => (
                    <div className="text-center">
                      <div className="font-mono text-[15px] font-semibold text-af-ink">
                        {rupee(value)}
                      </div>
                      <div className="text-[10px] text-af-muted truncate max-w-[88px]">
                        {label}
                      </div>
                    </div>
                  )}
                </PieCenter>
              </PieChart>
            </div>
            <ul className="flex-1 space-y-1.5 min-w-0">
              {byCategory.map((c, i) => (
                <li
                  key={c.category}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`flex items-center gap-2 text-meta rounded-[8px] px-1.5 py-0.5 -mx-1.5 transition-colors ${
                    hoveredIndex === i ? "bg-af-bg" : ""
                  }`}
                >
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
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-primary">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">{t("expenseCharts.monthlyCashFlow")}</h2>
            <p className="text-meta text-af-muted">{t("expenseCharts.incomeVsExpense")}</p>
          </div>
        </div>
        {byMonth.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-[14px] border border-dashed border-af-border text-sm text-af-muted">
            {t("expenseCharts.noMonthly")}
          </div>
        ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 6, right: 8, bottom: 0, left: -8 }} barGap={4}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => rupeeShort(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupee(v)} cursor={{ fill: CURSOR_FILL }} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              // Identity is the legend dot; the text stays in ink. Recharts
              // colours legend labels with the series colour by default, which
              // puts mustard type at 2.2:1 on white.
              formatter={(value) => <span style={{ color: LEGEND_INK }}>{value}</span>}
              />
              <Bar dataKey="income" name="Income" fill={EMERALD} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </Card>
    </div>
  );
}
