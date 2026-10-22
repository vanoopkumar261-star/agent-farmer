"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/components/theme/useChartTheme";

/** Tiny single-series area sparkline for stat tiles. No axes, no legend (title names it). */
export default function Sparkline({
  data,
  color,
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  // Resolved here rather than as a default parameter: the first categorical
  // slot is a different colour in each theme, and a default parameter would
  // have frozen the light one at module load.
  const { CATEGORICAL } = useChartTheme();
  const stroke = color ?? CATEGORICAL[0];
  const series = data.map((v, i) => ({ i, v }));
  const id = `spark-${stroke.replace("#", "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
