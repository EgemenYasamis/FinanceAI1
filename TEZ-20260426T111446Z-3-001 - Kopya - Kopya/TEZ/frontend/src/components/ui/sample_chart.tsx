import {

  Area,

  AreaChart,

  CartesianGrid,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts'



export type ChartPoint = {

  name: string

  value: number

}



type SampleChartProps = {

  data?: ChartPoint[]

}



export function SampleChart({ data }: SampleChartProps) {

  if (!data?.length) {

    return (

      <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">

        Trend verisi henüz yok.

      </div>

    )

  }



  return (

    <div className="h-64 w-full">

      <ResponsiveContainer width="100%" height="100%">

        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>

          <defs>

            <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">

              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.45} />

              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />

            </linearGradient>

          </defs>

          <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />

          <XAxis

            dataKey="name"

            axisLine={false}

            tickLine={false}

            tick={{ fill: '#94a3b8', fontSize: 12 }}

          />

          <YAxis

            axisLine={false}

            tickLine={false}

            tick={{ fill: '#94a3b8', fontSize: 12 }}

          />

          <Tooltip

            contentStyle={{

              backgroundColor: '#1e293b',

              border: '1px solid #334155',

              borderRadius: '0.5rem',

              color: '#e2e8f0',

            }}

            formatter={(value) => [

              typeof value === 'number'

                ? `₺${value.toLocaleString('tr-TR')}`

                : value,

              'Harcama',

            ]}

          />

          <Area

            type="monotone"

            dataKey="value"

            stroke="#7c3aed"

            strokeWidth={2}

            fill="url(#primaryGradient)"

          />

        </AreaChart>

      </ResponsiveContainer>

    </div>

  )

}

