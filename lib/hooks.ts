import useSWR from 'swr'
import { db } from './insforge'

if (typeof window !== 'undefined') {
    window.addEventListener('lifedental-local-db-change', () => {
        import('swr').then(({ mutate }) => mutate(() => true))
    })
}

// Generic fetcher for InsForge
const fetcher = async (key: string) => {
    const [table, ...rest] = key.split('/')
    // Simple select * for now, can be optimized
    const { data, error } = await db.from(table).select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
}

const swrOptions = {
    dedupingInterval: 30000,
    keepPreviousData: true,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
}

export function useDoctors() {
    const { data, error, mutate } = useSWR('doctors', fetcher, swrOptions)
    return {
        doctors: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function usePatients() {
    const { data, error, mutate } = useSWR('patients', fetcher, swrOptions)
    return {
        patients: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useAppointments() {
    const { data, error, mutate } = useSWR('appointments', fetcher, swrOptions)
    return {
        appointments: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useShifts() {
    const { data, error, mutate } = useSWR('work_shifts', fetcher, swrOptions)
    return {
        shifts: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useLeads() {
    const { data, error, mutate } = useSWR('leads', fetcher, swrOptions)
    return {
        leads: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useClinics() {
    const { data, error, mutate } = useSWR('clinics', fetcher, swrOptions)
    return {
        clinics: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useTasks() {
    const { data, error, mutate } = useSWR('tasks', fetcher, swrOptions)
    return {
        tasks: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useContactHistory() {
    const { data, error, mutate } = useSWR('contact_history', fetcher, swrOptions)
    return {
        contacts: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useTreatmentPlans() {
    const { data, error, mutate } = useSWR('treatment_plans', fetcher, swrOptions)
    return {
        plans: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function usePayments() {
    const { data, error, mutate } = useSWR('payments', fetcher, swrOptions)
    return {
        payments: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useServices() {
    const { data, error, mutate } = useSWR('services', fetcher, swrOptions)
    return {
        services: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useManagers() {
    const { data, error, mutate } = useSWR('managers', fetcher, swrOptions)
    return {
        managers: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useJivoConversations() {
    const { data, error, mutate } = useSWR('jivo_conversations', fetcher, swrOptions)
    return {
        conversations: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useJivoEvents() {
    const { data, error, mutate } = useSWR('jivo_events', fetcher, swrOptions)
    return {
        events: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useManagerKpiTargets() {
    const { data, error, mutate } = useSWR('manager_kpi_targets', fetcher, swrOptions)
    return {
        targets: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useGoogleCalendarSources() {
    const { data, error, mutate } = useSWR('google_calendar_sources', fetcher, swrOptions)
    return {
        sources: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useGoogleCalendarEvents() {
    const { data, error, mutate } = useSWR('google_calendar_events', fetcher, swrOptions)
    return {
        googleEvents: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}
