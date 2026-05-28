'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

export function BulkShiftDialog() {
    const [open, setOpen] = useState(false)
    const [date, setDate] = useState<Date | undefined>(new Date())

    // Mock Doctors
    const doctors = [
        { id: '1', name: 'Д-р Иванов' },
        { id: '2', name: 'Д-р Петрова' },
    ]

    const weekDays = [
        { id: 'mon', label: 'Пн' },
        { id: 'tue', label: 'Вт' },
        { id: 'wed', label: 'Ср' },
        { id: 'thu', label: 'Чт' },
        { id: 'fri', label: 'Пт' },
        { id: 'sat', label: 'Сб' },
        { id: 'sun', label: 'Вс' },
    ]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">Массовое назначение</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Назначение смен</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">

                    {/* Doctor Selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="doctor" className="text-right">Врач</Label>
                        <div className="col-span-3">
                            <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите врача" />
                                </SelectTrigger>
                                <SelectContent>
                                    {doctors.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Time Range */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Время</Label>
                        <div className="col-span-3 flex items-center space-x-2">
                            <Input type="time" defaultValue="09:00" className="w-24" />
                            <span>-</span>
                            <Input type="time" defaultValue="18:00" className="w-24" />
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Начало</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP", { locale: ru }) : <span>Выберите дату</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ru} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Days of Week */}
                    <div className="grid grid-cols-4 gap-4">
                        <Label className="text-right pt-2">Дни</Label>
                        <div className="col-span-3 flex flex-wrap gap-2">
                            {weekDays.map(day => (
                                <div key={day.id} className="flex items-center space-x-1 border p-1 rounded hover:bg-slate-50 cursor-pointer">
                                    <Checkbox id={day.id} />
                                    <label htmlFor={day.id} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer pl-1">{day.label}</label>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
                <DialogFooter>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Применить</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
