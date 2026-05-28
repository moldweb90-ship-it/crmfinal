'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Plus, Phone, Mail, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { db } from '@/lib/insforge'
import { AddDoctorDialog } from './add-doctor-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Doctor = {
    id: string
    full_name: string
    specialization: string
    phone: string | null
    email: string | null
    bio: string | null
    photo_url: string | null
    color_code: string
    is_active: boolean
    created_at: string
}

export function DoctorsList() {
    const [doctors, setDoctors] = useState<Doctor[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)

    const fetchDoctors = async () => {
        setLoading(true)
        try {
            const { data, error } = await db
                .from('doctors')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setDoctors(data || [])
        } catch (err) {
            console.error('Error fetching doctors:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDoctors()
    }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('Вы уверены, что хотите удалить этого врача?')) return
        try {
            const { error } = await db.from('doctors').delete().eq('id', id)
            if (error) throw error
            fetchDoctors()
        } catch (err) {
            console.error('Error deleting doctor:', err)
        }
    }

    const handleEdit = (doctor: Doctor) => {
        setEditingDoctor(doctor)
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
        setEditingDoctor(null)
    }

    const handleSuccess = () => {
        handleDialogClose()
        fetchDoctors()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-800">Врачи клиники</h2>
                    <p className="text-slate-500">LIFE DENTAL — Управление персоналом</p>
                </div>
                <Button
                    onClick={() => setDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200"
                >
                    <Plus className="mr-2 h-4 w-4" /> Добавить врача
                </Button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="border-none shadow-sm animate-pulse">
                            <CardContent className="p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="h-16 w-16 rounded-full bg-slate-200" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : doctors.length === 0 ? (
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-12 text-center">
                        <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Plus className="h-8 w-8 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">Нет врачей</h3>
                        <p className="text-slate-500 mb-4">Добавьте первого врача в вашу клинику</p>
                        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" /> Добавить врача
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {doctors.map((doctor) => (
                        <Card
                            key={doctor.id}
                            className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group overflow-hidden"
                        >
                            <CardContent className="p-0">
                                {/* Color Bar */}
                                <div className="h-2" style={{ backgroundColor: doctor.color_code }} />

                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center space-x-4">
                                            <Avatar className="h-16 w-16 ring-4 ring-slate-50 shadow-sm">
                                                <AvatarImage src={doctor.photo_url || ''} alt={doctor.full_name} />
                                                <AvatarFallback className="text-lg font-bold bg-blue-100 text-blue-600">
                                                    {doctor.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">{doctor.full_name}</h3>
                                                <Badge variant="secondary" className="mt-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                                                    {doctor.specialization}
                                                </Badge>
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(doctor)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Редактировать
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(doctor.id)} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {doctor.bio && (
                                        <p className="text-sm text-slate-500 mb-4 line-clamp-2">{doctor.bio}</p>
                                    )}

                                    <div className="space-y-2 pt-4 border-t">
                                        {doctor.phone && (
                                            <div className="flex items-center text-sm text-slate-600">
                                                <Phone className="h-4 w-4 mr-2 text-slate-400" />
                                                {doctor.phone}
                                            </div>
                                        )}
                                        {doctor.email && (
                                            <div className="flex items-center text-sm text-slate-600">
                                                <Mail className="h-4 w-4 mr-2 text-slate-400" />
                                                {doctor.email}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AddDoctorDialog
                open={dialogOpen}
                onOpenChange={handleDialogClose}
                onSuccess={handleSuccess}
                editingDoctor={editingDoctor}
            />
        </div>
    )
}
