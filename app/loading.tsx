export default function Loading() {
  return (
    <div className="animate-soft-in space-y-5">
      <div className="h-24 rounded-[2rem] border border-white/80 bg-white/70 shadow-sm" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-3xl border border-white/80 bg-white/70 shadow-sm" />
        ))}
      </div>
      <div className="h-[420px] rounded-[2rem] border border-white/80 bg-white/70 shadow-sm" />
    </div>
  )
}
