import { ShiftCalendar } from '@/components/shifts/shift-calendar'

export default function ShiftManagementPage() {
    return (
        <div className="container py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Управление сменами</h1>
            </div>
            <div className="bg-slate-50/50 rounded-xl">
                <ShiftCalendar />
            </div>
        </div>
    )
}
