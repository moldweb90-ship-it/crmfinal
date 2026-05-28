'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/insforge'
import { managerDefaultPermissions } from '@/lib/access-control'

const SESSION_KEY = 'lifedental_auth_user_id'

type AuthContextValue = {
  user: any
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const defaultUsers = [
  {
    id: 'user-admin',
    full_name: 'Администратор',
    email: 'admin@lifedental.local',
    password: 'admin123',
    phone: '+373 69 214 434',
    role: 'admin',
    permissions: [],
    is_active: true,
  },
  {
    id: 'manager-main',
    full_name: 'Менеджер',
    email: 'manager@lifedental.local',
    password: 'manager123',
    phone: '+373 69 000 000',
    role: 'manager',
    permissions: managerDefaultPermissions,
    is_active: true,
  },
]

async function ensureDefaultUsers() {
  for (const user of defaultUsers) {
    const { data } = await db.from('managers').select('*').eq('id', user.id)
    if (data?.length) {
      const current = data[0]
      await db.from('managers').update({
        password: current.password || user.password,
        permissions: Array.isArray(current.permissions) ? current.permissions : user.permissions,
        is_active: current.is_active !== false,
        role: current.role || user.role,
      }).eq('id', user.id)
    } else {
      await db.from('managers').insert([user])
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const userId = window.localStorage.getItem(SESSION_KEY)
    if (!userId) {
      setUser(null)
      return
    }
    const { data } = await db.from('managers').select('*').eq('id', userId)
    const current = data?.[0]
    if (!current || current.is_active === false) {
      window.localStorage.removeItem(SESSION_KEY)
      setUser(null)
      return
    }
    setUser(current)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      await ensureDefaultUsers()
      if (alive) await refreshUser()
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const login = async (email: string, password: string) => {
    await ensureDefaultUsers()
    const { data } = await db.from('managers').select('*')
    const found = (data || []).find((item: any) => String(item.email || '').toLowerCase() === email.trim().toLowerCase())

    if (!found || found.password !== password) return { ok: false, message: 'Неверный email или пароль' }
    if (found.is_active === false) return { ok: false, message: 'Пользователь отключен' }

    window.localStorage.setItem(SESSION_KEY, found.id)
    setUser(found)
    return { ok: true }
  }

  const logout = () => {
    window.localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
