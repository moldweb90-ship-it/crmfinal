'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PatientTable } from '@/components/patients/patient-table'
import { AddPatientDialog } from '@/components/patients/add-patient-dialog'
import { Button } from '@/components/ui/button'

export default function PatientsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Пациенты</h1>
          <p className="mt-1 max-w-3xl text-slate-500">
            Рабочая база менеджера: контакты, источники, долги, повторные визиты, дни рождения и пациенты, которых нужно обработать.
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 px-5 text-white shadow-lg shadow-cyan-200/50 hover:from-teal-600 hover:to-sky-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Добавить пациента
        </Button>
      </div>

      <PatientTable />

      <AddPatientDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  )
}
