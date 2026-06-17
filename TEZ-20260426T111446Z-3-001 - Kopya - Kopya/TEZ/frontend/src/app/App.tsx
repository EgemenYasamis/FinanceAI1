import { useCallback, useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuth } from '@/contexts/auth_context'
import { useTheme } from '@/hooks/use_theme'
import { AuthPage } from '@/pages/auth_page'
import { DashboardPage } from '@/pages/dashboard_page'
import { AlertsPage } from '@/pages/alerts_page'
import { AddTransactionPage } from '@/pages/add_transaction_page'
import { TransactionsPage } from '@/pages/transactions_page'
import { LocationPage } from '@/pages/location_page'
import { CarbonPage } from '@/pages/carbon_page'
import type { NavItemId } from '@/types/navigation'

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-bg-dark">
      <div className="flex flex-col items-center gap-4">
        <span
          className="size-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
          aria-hidden
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">Oturum kontrol ediliyor…</p>
      </div>
    </div>
  )
}

function MainContent({ activeItem }: { activeItem: NavItemId }) {
  if (activeItem === 'dashboard') {
    return <DashboardPage />
  }

  if (activeItem === 'add_transaction') {
    return <AddTransactionPage />
  }

  if (activeItem === 'transactions') {
    return <TransactionsPage />
  }

  if (activeItem === 'alerts') {
    return <AlertsPage />
  }

  if (activeItem === 'location') {
    return <LocationPage />
  }

  if (activeItem === 'carbon') {
    return <CarbonPage />
  }

  return null
}

export default function App() {
  const [activeItem, setActiveItem] = useState<NavItemId>('dashboard')
  const { session, userId, isLoading, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
    } catch {
      // signOut hata logunu context içinde yazıyor
    }
  }, [signOut])

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  if (!session || !userId) {
    return <AuthPage />
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        activeItem={activeItem}
        onNavigate={setActiveItem}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={handleSignOut}
      />

      <main className="min-h-screen flex-1 overflow-y-auto bg-slate-50 transition-colors duration-300 dark:bg-bg-dark">
        <MainContent activeItem={activeItem} />
      </main>
    </div>
  )
}
