'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: { month: string; value: number }[];
  /** Tailwind-compatible CSS color. Defaults to the primary CSS variable. */
  color?: string;
}

export function SparklineChart({ data, color = 'hsl(var(--primary))' }: SparklineChartProps) {
  // Flat line for insufficient data
  if (data.length < 2) {
    return (
      <div className="h-6 w-[60px] flex items-end">
        <div className="w-full border-t border-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="h-6 w-[60px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#sparkGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
