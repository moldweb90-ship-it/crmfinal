import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { cn } from '@/lib/utils'
import MainLayout from '@/components/layout/main-layout'
import { AuthProvider } from '@/lib/auth'

const geist = localFont({
  src: [
    { path: './fonts/GeistVF.woff', weight: '100 900', style: 'normal' },
  ],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Dental CRM Manager',
  description: 'Pro scheduler and patient management for dental clinics.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        geist.variable
      )}>
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
