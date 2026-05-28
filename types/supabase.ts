export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string
                    email: string
                    phone: string | null
                    role: 'admin' | 'doctor' | 'manager'
                    specialization: string | null
                    avatar_url: string | null
                    color_code: string | null
                    bio: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    full_name: string
                    email: string
                    phone?: string | null
                    role?: 'admin' | 'doctor' | 'manager'
                    specialization?: string | null
                    avatar_url?: string | null
                    color_code?: string | null
                    bio?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string
                    email?: string
                    phone?: string | null
                    role?: 'admin' | 'doctor' | 'manager'
                    specialization?: string | null
                    avatar_url?: string | null
                    color_code?: string | null
                    bio?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            patients: {
                Row: {
                    id: string
                    full_name: string
                    phone: string
                    email: string | null
                    dob: string | null
                    gender: string | null
                    address: string | null
                    notes: string | null
                    total_spent: number
                    total_debt: number
                    last_visit_date: string | null
                    visit_count: number
                    no_show_count: number
                    labels: string[] | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    full_name: string
                    phone: string
                    email?: string | null
                    dob?: string | null
                    gender?: string | null
                    address?: string | null
                    notes?: string | null
                    total_spent?: number
                    total_debt?: number
                    last_visit_date?: string | null
                    visit_count?: number
                    no_show_count?: number
                    labels?: string[] | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string
                    phone?: string
                    email?: string | null
                    dob?: string | null
                    gender?: string | null
                    address?: string | null
                    notes?: string | null
                    total_spent?: number
                    total_debt?: number
                    last_visit_date?: string | null
                    visit_count?: number
                    no_show_count?: number
                    labels?: string[] | null
                    created_at?: string
                    updated_at?: string
                }
            }
            services: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    price: number
                    duration_minutes: number
                    color_code: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    price: number
                    duration_minutes?: number
                    color_code?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    price?: number
                    duration_minutes?: number
                    color_code?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            work_shifts: {
                Row: {
                    id: string
                    doctor_id: string
                    date: string
                    start_time: string
                    end_time: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    doctor_id: string
                    date: string
                    start_time: string
                    end_time: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    doctor_id?: string
                    date?: string
                    start_time?: string
                    end_time?: string
                    is_active?: boolean
                    created_at?: string
                }
            }
            appointments: {
                Row: {
                    id: string
                    doctor_id: string | null
                    patient_id: string
                    service_id: string | null
                    start_time: string
                    end_time: string
                    status: 'planned' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
                    notes: string | null
                    price: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    doctor_id?: string | null
                    patient_id: string
                    service_id?: string | null
                    start_time: string
                    end_time: string
                    status?: 'planned' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
                    notes?: string | null
                    price?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    doctor_id?: string | null
                    patient_id?: string
                    service_id?: string | null
                    start_time?: string
                    end_time?: string
                    status?: 'planned' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
                    notes?: string | null
                    price?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
            transactions: {
                Row: {
                    id: string
                    patient_id: string | null
                    appointment_id: string | null
                    amount: number
                    type: 'payment' | 'refund' | 'expense'
                    payment_method: string | null
                    date: string
                    notes: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    patient_id?: string | null
                    appointment_id?: string | null
                    amount: number
                    type?: 'payment' | 'refund' | 'expense'
                    payment_method?: string | null
                    date?: string
                    notes?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    patient_id?: string | null
                    appointment_id?: string | null
                    amount?: number
                    type?: 'payment' | 'refund' | 'expense'
                    payment_method?: string | null
                    date?: string
                    notes?: string | null
                    created_at?: string
                }
            }
        }
    }
}
