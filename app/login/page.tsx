'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.message || 'Не удалось войти')
      return
    }
    router.replace('/')
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_34%),linear-gradient(135deg,#f8fdff,#eefcf9_48%,#f7fbff)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <Badge variant="outline" className="mb-5 border-teal-200 bg-white/70 text-teal-700">LIFE DENTAL manager CRM</Badge>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950">
            Контроль клиники, заявок, пациентов и менеджеров в одном спокойном рабочем экране.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Вход по роли: администратор управляет всем, менеджер видит только разрешенные разделы и свои рабочие сценарии.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {['Роли', 'Доступы', 'Контроль'].map((item) => (
              <div key={item} className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
                <ShieldCheck className="mb-3 h-5 w-5 text-teal-600" />
                <div className="font-semibold text-slate-950">{item}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,118,110,0.18)] backdrop-blur-xl sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 text-lg font-semibold text-white">L</div>
            <div>
              <div className="font-semibold text-slate-950">LIFE DENTAL</div>
              <div className="text-sm text-slate-500">Вход в CRM</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" className="h-12 rounded-2xl pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Пароль</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" className="h-12 rounded-2xl pl-9" />
              </div>
            </div>
            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-600 hover:to-sky-600">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Войти
            </Button>
          </form>

        </section>
      </div>
    </main>
  )
}
