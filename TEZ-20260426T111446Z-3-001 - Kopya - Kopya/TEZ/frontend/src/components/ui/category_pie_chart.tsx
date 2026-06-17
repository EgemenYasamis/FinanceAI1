import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { formatCategory } from '@/lib/categories'
import { formatCurrency } from '@/lib/format'

export type CategorySlice = {
  category: string
  toplam: number
}

const SLICE_COLORS = [
  '#7c3aed',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#6366f1',
]

type CategoryPieChartProps = {
  data?: CategorySlice[]
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (!data?.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Kategori verisi henüz yok.
      </div>
    )
  }

  const chartData = data.map((item) => ({
    name: formatCategory(item.category),
    value: item.toplam,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={88}
            paddingAngle={2}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`slice-${index}`}
                fill={SLICE_COLORS[index % SLICE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#e2e8f0',
            }}
            formatter={(value) => [
              typeof value === 'number' ? formatCurrency(value) : value,
              'Harcama',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
