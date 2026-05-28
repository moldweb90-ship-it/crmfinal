'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/insforge'
import { usePatients } from '@/lib/hooks'
import { patientSources } from '@/lib/patient-crm'

type AddPatientDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const initialForm = {
    full_name: '',
    phone: '',
    email: '',
    birth_date: '',
    source: 'phone',
    preferred_contact_method: 'phone',
    next_follow_up_at: '',
    planned_checkup_at: '',
    address: '',
    notes: '',
    manager_notes: '',
}

export function AddPatientDialog({ open, onOpenChange }: AddPatientDialogProps) {
    const [loading, setLoading] = useState(false)
    const { mutate } = usePatients()
    const [formData, setFormData] = useState(initialForm)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await db.from('patients').insert([{
                ...formData,
                birth_date: formData.birth_date || null,
                next_follow_up_at: formData.next_follow_up_at ? new Date(formData.next_follow_up_at).toISOString() : null,
                planned_checkup_at: formData.planned_checkup_at || null,
                status: formData.next_follow_up_at ? 'needs_follow_up' : 'active',
                total_spent: 0,
                debt: 0,
            }])

            if (error) throw error

            await mutate()
            onOpenChange(false)
            setFormData(initialForm)
        } catch (err) {
            console.error('Error adding patient:', err)
            alert('Ошибка при добавлении пациента')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>Новый пациент</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="full_name">ФИО *</Label>
                            <Input id="full_name" name="full_name" placeholder="Иванов Петр Сергеевич" required value={formData.full_name} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Телефон</Label>
                            <Input id="phone" name="phone" placeholder="+373 69 ..." value={formData.phone} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="patient@example.com" value={formData.email} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="birth_date">Дата рождения</Label>
                            <Input id="birth_date" name="birth_date" type="date" value={formData.birth_date} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Откуда узнал</Label>
                            <Select value={formData.source} onValueChange={(source) => setFormData({ ...formData, source })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {patientSources.map((source) => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Следующий контакт</Label>
                            <Input name="next_follow_up_at" type="datetime-local" value={formData.next_follow_up_at} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Плановый осмотр</Label>
                            <Input name="planned_checkup_at" type="date" value={formData.planned_checkup_at} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Предпочитает связь</Label>
                            <Select value={formData.preferred_contact_method} onValueChange={(preferred_contact_method) => setFormData({ ...formData, preferred_contact_method })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="phone">Телефон</SelectItem>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="sms">SMS</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Адрес</Label>
                            <Input id="address" name="address" placeholder="г. Кишинев, ул. ..." value={formData.address} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="notes">Медицинские заметки</Label>
                            <Textarea id="notes" name="notes" placeholder="Аллергии, противопоказания, особенности..." value={formData.notes} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="manager_notes">Заметки менеджера</Label>
                            <Textarea id="manager_notes" name="manager_notes" placeholder="Что обещали, как общается, когда лучше звонить..." value={formData.manager_notes} onChange={handleChange} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Добавить
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
