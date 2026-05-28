'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Loader2, Upload, X } from 'lucide-react'
import { db } from '@/lib/insforge'
import type { Doctor } from './doctors-list'

type AddDoctorDialogProps = {
    open: boolean
    onOpenChange: () => void
    onSuccess: () => void
    editingDoctor: Doctor | null
}

const colorOptions = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
]

export function AddDoctorDialog({ open, onOpenChange, onSuccess, editingDoctor }: AddDoctorDialogProps) {
    const [loading, setLoading] = useState(false)
    const [photoError, setPhotoError] = useState('')
    const [formData, setFormData] = useState({
        full_name: '',
        specialization: '',
        phone: '',
        email: '',
        bio: '',
        photo_url: '',
        color_code: '#3b82f6',
    })

    useEffect(() => {
        if (editingDoctor) {
            setFormData({
                full_name: editingDoctor.full_name || '',
                specialization: editingDoctor.specialization || '',
                phone: editingDoctor.phone || '',
                email: editingDoctor.email || '',
                bio: editingDoctor.bio || '',
                photo_url: editingDoctor.photo_url || '',
                color_code: editingDoctor.color_code || '#3b82f6',
            })
        } else {
            setFormData({
                full_name: '',
                specialization: '',
                phone: '',
                email: '',
                bio: '',
                photo_url: '',
                color_code: '#3b82f6',
            })
        }
    }, [editingDoctor, open])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        setPhotoError('')
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setPhotoError('Выберите файл изображения.')
            return
        }

        if (file.size > 1.5 * 1024 * 1024) {
            setPhotoError('Фото слишком большое. Лучше до 1.5 MB.')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            setFormData(prev => ({ ...prev, photo_url: String(reader.result || '') }))
        }
        reader.onerror = () => setPhotoError('Не удалось прочитать фото.')
        reader.readAsDataURL(file)
    }

    const clearPhoto = () => {
        setFormData(prev => ({ ...prev, photo_url: '' }))
        setPhotoError('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (editingDoctor) {
                // Update
                const { error } = await db
                    .from('doctors')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingDoctor.id)
                if (error) throw error
            } else {
                // Insert
                const { error } = await db
                    .from('doctors')
                    .insert(formData)
                if (error) throw error
            }
            onSuccess()
        } catch (err) {
            console.error('Error saving doctor:', err)
            alert('Ошибка сохранения. Проверьте консоль.')
        } finally {
            setLoading(false)
        }
    }

    const initials = formData.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingDoctor ? 'Редактировать врача' : 'Добавить врача'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Photo Upload */}
                    <div className="flex flex-col items-center space-y-3">
                        <div className="relative group">
                            <Avatar className="h-24 w-24 ring-4 ring-blue-50">
                                <AvatarImage src={formData.photo_url} alt={formData.full_name} />
                                <AvatarFallback className="text-2xl font-bold bg-blue-100 text-blue-600">
                                    {initials || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                <Camera className="h-6 w-6 text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                            </label>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button type="button" variant="outline" size="sm" className="rounded-xl" asChild>
                                <label>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Загрузить фото
                                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                </label>
                            </Button>
                            {formData.photo_url && (
                                <Button type="button" variant="ghost" size="sm" className="rounded-xl text-slate-500" onClick={clearPhoto}>
                                    <X className="mr-2 h-4 w-4" />
                                    Убрать
                                </Button>
                            )}
                        </div>
                        <Input
                            name="photo_url"
                            placeholder="URL фото или загрузите файл"
                            value={formData.photo_url}
                            onChange={handleChange}
                            className="max-w-xs text-center text-sm"
                        />
                        {photoError && <p className="text-xs text-red-500">{photoError}</p>}
                        <p className="max-w-xs text-center text-xs text-slate-400">
                            Локальная CRM сохранит фото в браузере. Для стабильной работы выбирайте сжатое фото до 1.5 MB.
                        </p>
                    </div>

                    {/* Color Picker */}
                    <div className="flex items-center justify-center space-x-2">
                        {colorOptions.map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, color_code: color }))}
                                className={`h-6 w-6 rounded-full transition-transform ${formData.color_code === color ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-110'}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>

                    {/* Form Fields */}
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">ФИО *</Label>
                                <Input
                                    id="full_name"
                                    name="full_name"
                                    placeholder="Иванов Иван Иванович"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="specialization">Специализация *</Label>
                                <Input
                                    id="specialization"
                                    name="specialization"
                                    placeholder="Терапевт"
                                    value={formData.specialization}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Телефон</Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    placeholder="+373 78 123 456"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="doctor@lifedental.md"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bio">О враче</Label>
                            <Textarea
                                id="bio"
                                name="bio"
                                placeholder="Краткая биография и опыт работы..."
                                value={formData.bio}
                                onChange={handleChange}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onOpenChange}>
                            Отмена
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingDoctor ? 'Сохранить' : 'Добавить'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
