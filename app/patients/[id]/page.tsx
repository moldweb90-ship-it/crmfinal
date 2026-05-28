import { PatientProfile } from '@/components/patients/patient-profile'

export default function PatientProfilePage({ params }: { params: { id: string } }) {
  return <PatientProfile patientId={params.id} />
}
