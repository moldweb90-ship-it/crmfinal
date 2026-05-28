'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { BulkShiftDialog } from './bulk-shift-dialog'
import { useDoctors, useShifts } from '@/lib/hooks'
import { db } from '@/lib/insforge'

export function ShiftCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const { doctors, isLoading: doctorsLoading } = useDoctors()
    const { shifts, isLoading: shiftsLoading, mutate: mutateShifts } = useShifts()

    // Filter shifts for current month/view (client-side for now)
    // In real app, fetcher should accept date range

    const daysDocs = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
    })

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))

    const handleShiftClick = async (doctor: any, day: Date) => {
        // Toggle shift logic (Simplify for MVP: Create 9-18 shift or Delete)
        const dateStr = format(day, 'yyyy-MM-dd')
        const existingShift = shifts.find((s: any) => s.doctor_id === doctor.id && s.date === dateStr)

        try {
            if (existingShift) {
                // Delete
                await db.from('work_shifts').delete().eq('id', existingShift.id)
            } else {
                // Create
                await db.from('work_shifts').insert([{
                    doctor_id: doctor.id,
                    date: dateStr,
                    start_time: '09:00:00',
                    end_time: '18:00:00'
                }])
            }
            mutateShifts()
        } catch (err) {
            console.error('Error toggling shift', err)
        }
    }

    if (doctorsLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-slate-400" /></div>

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-white z-20">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-bold w-40 text-center capitalize text-slate-800">
                        {format(currentDate, 'LLLL yyyy', { locale: ru })}
                    </span>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <BulkShiftDialog />
            </div>

            {/* Timeline Grid */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Doctors Column (Sticky Left) */}
                <div className="w-64 border-r bg-white flex-shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col">
                    <div className="h-12 border-b bg-slate-50/50 flex items-center px-4 font-medium text-slate-500 text-sm">
                        Врачи
                    </div>
                    <ScrollArea className="flex-1">
                        {doctors.map((doc: any) => (
                            <div key={doc.id} className="h-16 flex items-center px-4 border-b hover:bg-slate-50 transition-colors group">
                                <Avatar className="h-9 w-9 mr-3 ring-2 ring-transparent group-hover:ring-blue-100 transition-all">
                                    <AvatarImage src={doc.photo_url} />
                                    <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">{doc.full_name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="overflow-hidden">
                                    <div className="font-semibold text-slate-700 truncate text-sm">{doc.full_name}</div>
                                    <div className="text-xs text-slate-500 truncate">{doc.specialization}</div>
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </div>

                {/* Calendar Grid (Scrollable) */}
                <ScrollArea className="flex-1 bg-white">
                    <div className="inline-block min-w-max pb-4">
                        {/* Days Header */}
                        <div className="flex sticky top-0 z-10 bg-white shadow-sm h-12 border-b">
                            {daysDocs.map((day) => (
                                <div key={day.toString()} className={cn(
                                    "flex-shrink-0 w-12 border-r flex flex-col items-center justify-center text-xs text-slate-500",
                                    (day.getDay() === 0 || day.getDay() === 6) && "bg-slate-50/50" // Highlight weekends
                                )}>
                                    <span className="font-bold">{format(day, 'd')}</span>
                                    <span className="text-[10px] uppercase text-slate-400">{format(day, 'EEE', { locale: ru })}</span>
                                </div>
                            ))}
                        </div>

                        {/* Shifts Grid */}
                        <div>
                            {doctors.map((doc: any) => (
                                <div key={doc.id} className="flex h-16 border-b transition-colors hover:bg-slate-50/30">
                                    {daysDocs.map((day) => {
                                        const dateStr = format(day, 'yyyy-MM-dd')
                                        const shift = shifts.find((s: any) => s.doctor_id === doc.id && s.date === dateStr)
                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6

                                        return (
                                            <div
                                                key={day.toString()}
                                                onClick={() => handleShiftClick(doc, day)}
                                                className={cn(
                                                    "flex-shrink-0 w-12 border-r cursor-pointer transition-all relative group flex items-center justify-center",
                                                    isWeekend ? "bg-slate-50/30" : "bg-white",
                                                    "hover:bg-blue-50"
                                                )}
                                            >
                                                {shift ? (
                                                    <div className="w-10 h-8 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shadow-sm border border-blue-200">
                                                        {shift.start_time.slice(0, 5)}
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-8 rounded-md border border-dashed border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <Plus className="h-3 w-3 text-slate-400" />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" className="h-3" />
                </ScrollArea>
            </div>
        </div>
    )
}
