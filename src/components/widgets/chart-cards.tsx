'use client'

import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const CHART_COLORS = [
  '#0369A1',
  '#22C55E',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#F97316',
  '#EC4899',
]

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <div className="bg-muted animate-pulse rounded-md" style={{ height }} />
}

interface BaseCardProps {
  title: string
  description?: string
  className?: string
  loading?: boolean
  children: React.ReactNode
  action?: React.ReactNode
}

function ChartCard({ title, description, className, loading, children, action }: BaseCardProps) {
  return (
    <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      {loading ? <ChartSkeleton /> : children}
    </div>
  )
}

// ─── Line Chart ───────────────────────────────────────────────────────────────

interface LineChartData {
  name: string
  [key: string]: string | number
}

interface LineChartCardProps {
  title: string
  description?: string
  data: LineChartData[]
  lines: { key: string; label: string; color?: string }[]
  className?: string
  loading?: boolean
  action?: React.ReactNode
  yPrefix?: string
}

export function LineChartCard({
  title,
  description,
  data,
  lines,
  className,
  loading,
  action,
  yPrefix,
}: LineChartCardProps) {
  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      loading={loading}
      action={action}
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (yPrefix ? `${yPrefix}${v}` : String(v))}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: 12,
            }}
            formatter={(v, name) => [yPrefix ? `${yPrefix}${v}` : v, name]}
          />
          {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

interface BarChartData {
  name: string
  [key: string]: string | number
}

interface BarChartCardProps {
  title: string
  description?: string
  data: BarChartData[]
  bars: { key: string; label: string; color?: string }[]
  className?: string
  loading?: boolean
  action?: React.ReactNode
  yPrefix?: string
  layout?: 'horizontal' | 'vertical'
}

export function BarChartCard({
  title,
  description,
  data,
  bars,
  className,
  loading,
  action,
  yPrefix,
  layout = 'horizontal',
}: BarChartCardProps) {
  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      loading={loading}
      action={action}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          {layout === 'horizontal' ? (
            <>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (yPrefix ? `${yPrefix}${v}` : String(v))}
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (yPrefix ? `${yPrefix}${v}` : String(v))}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: 12,
            }}
            formatter={(v, name) => [yPrefix ? `${yPrefix}${v}` : v, name]}
          />
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {bars.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutData {
  name: string
  value: number
  color?: string
}

interface DonutChartCardProps {
  title: string
  description?: string
  data: DonutData[]
  className?: string
  loading?: boolean
  action?: React.ReactNode
  valuePrefix?: string
}

export function DonutChartCard({
  title,
  description,
  data,
  className,
  loading,
  action,
  valuePrefix,
}: DonutChartCardProps) {
  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      loading={loading}
      action={action}
    >
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie data={data} innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
              {data.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: 12,
              }}
              formatter={(v, name) => [valuePrefix ? `${valuePrefix}${v}` : v, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: item.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-muted-foreground truncate text-xs">{item.name}</span>
              </div>
              <span className="font-mono text-xs font-semibold">
                {valuePrefix}
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

// ─── Area Chart ───────────────────────────────────────────────────────────────

interface AreaChartCardProps {
  title: string
  description?: string
  data: LineChartData[]
  areas: { key: string; label: string; color?: string }[]
  className?: string
  loading?: boolean
  action?: React.ReactNode
  yPrefix?: string
}

export function AreaChartCard({
  title,
  description,
  data,
  areas,
  className,
  loading,
  action,
  yPrefix,
}: AreaChartCardProps) {
  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      loading={loading}
      action={action}
    >
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            {areas.map((a, i) => {
              const color = a.color ?? CHART_COLORS[i % CHART_COLORS.length]
              return (
                <linearGradient key={a.key} id={`grad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              )
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (yPrefix ? `${yPrefix}${v}` : String(v))}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: 12,
            }}
            formatter={(v, name) => [yPrefix ? `${yPrefix}${v}` : v, name]}
          />
          {areas.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {areas.map((a, i) => {
            const color = a.color ?? CHART_COLORS[i % CHART_COLORS.length]
            return (
              <Area
                key={a.key}
                type="monotone"
                dataKey={a.key}
                name={a.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${a.key})`}
              />
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
