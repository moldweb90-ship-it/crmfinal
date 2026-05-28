'use client'

import { cn } from '@/lib/utils'

type Point = {
  label: string
  value: number
}

type Segment = {
  label: string
  value: number
  color: string
}

const clampMax = (values: number[]) => Math.max(1, ...values)

export function AreaTrendChart({ data, className }: { data: Point[]; className?: string }) {
  const width = 640
  const height = 190
  const padding = 18
  const max = clampMax(data.map((item) => item.value))
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0
  const points = data.map((item, index) => {
    const x = padding + index * step
    const y = height - padding - (item.value / max) * (height - padding * 2)
    return { ...item, x, y }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`

  return (
    <div className={cn('relative h-[220px] overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-50 via-white to-mint-50 p-4', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            x2={width - padding}
            y1={padding + (height - padding * 2) * ratio}
            y2={padding + (height - padding * 2) * ratio}
            stroke="#dbeafe"
            strokeDasharray="5 8"
            strokeWidth="1"
          />
        ))}
        <polygon points={area} fill="url(#areaFill)" />
        <polyline points={line} fill="none" stroke="#0f766e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" filter="url(#softGlow)" />
        <polyline points={line} fill="none" stroke="#67e8f9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="#fff" stroke="#0f766e" strokeWidth="3" />
            <text x={point.x} y={height - 2} textAnchor="middle" className="fill-slate-400 text-[18px]">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function SoftBarChart({ data, className }: { data: Point[]; className?: string }) {
  const max = clampMax(data.map((item) => item.value))
  return (
    <div className={cn('flex h-[220px] items-end gap-3 rounded-3xl bg-white/70 p-4', className)}>
      {data.map((item, index) => {
        const height = Math.max(12, (item.value / max) * 150)
        return (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-[160px] w-full items-end rounded-2xl bg-slate-50 p-1">
              <div
                className={cn(
                  'w-full rounded-xl shadow-sm transition-all duration-500',
                  index % 3 === 0 && 'bg-gradient-to-t from-teal-500 to-cyan-300',
                  index % 3 === 1 && 'bg-gradient-to-t from-sky-500 to-blue-200',
                  index % 3 === 2 && 'bg-gradient-to-t from-emerald-500 to-lime-200'
                )}
                style={{ height }}
              />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-800">{item.value}</div>
              <div className="truncate text-xs text-slate-400">{item.label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DonutChart({ segments, centerLabel, centerValue }: { segments: Segment[]; centerLabel: string; centerValue: string | number }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1
  let offset = 25

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r="44" fill="none" stroke="#eef2f7" strokeWidth="16" />
          {segments.map((segment) => {
            const dash = (segment.value / total) * 276.46
            const current = offset
            offset += dash
            return (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke={segment.color}
                strokeDasharray={`${dash} 276.46`}
                strokeDashoffset={-current}
                strokeLinecap="round"
                strokeWidth="16"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-2xl font-semibold text-slate-950">{centerValue}</div>
          <div className="text-xs text-slate-500">{centerLabel}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate text-sm text-slate-600">{segment.label}</span>
            </div>
            <span className="text-sm font-semibold text-slate-950">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RadialScore({ value, label }: { value: number; label: string }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const dash = (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e0f2fe" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#14b8a6"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="12"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold text-slate-950">{value}%</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  )
}
