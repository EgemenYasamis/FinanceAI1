import { useState } from 'react'

import {

  ArrowLeftRight,

  Bell,

  Footprints,

  LayoutDashboard,

  LogOut,

  PlusCircle,

  MapPin,

  Moon,

  Sun,

} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

import type { NavItem, NavItemId } from '@/types/navigation'

import { NAV_ITEMS } from '@/types/navigation'

import type { Theme } from '@/hooks/use_theme'

import { useAuth } from '@/contexts/auth_context'

import { cn } from '@/lib/utils'



const NAV_ICONS: Record<NavItemId, LucideIcon> = {

  dashboard: LayoutDashboard,

  add_transaction: PlusCircle,

  transactions: ArrowLeftRight,

  alerts: Bell,

  location: MapPin,

  carbon: Footprints,

}



/** Dar menüde gizli; sidebar hover ile genişleyince görünür */

const expandableLabel = cn(

  'max-w-0 overflow-hidden whitespace-nowrap opacity-0',

  'transition-all duration-300 ease-in-out',

  'group-hover:max-w-[11rem] group-hover:opacity-100',

)



type SidebarProps = {

  activeItem: NavItemId

  onNavigate: (id: NavItemId) => void

  theme: Theme

  onToggleTheme: () => void

  onSignOut: () => void | Promise<void>

}



function NavLink({

  item,

  isActive,

  onClick,

}: {

  item: NavItem

  isActive: boolean

  onClick: () => void

}) {

  const Icon = NAV_ICONS[item.id]



  return (

    <button

      type="button"

      onClick={onClick}

      aria-current={isActive ? 'page' : undefined}

      title={item.label}

      className={cn(

        'relative flex w-full items-center rounded-lg py-2.5',

        'justify-center gap-0 px-0',

        'transition-all duration-300 ease-in-out',

        'group-hover:justify-start group-hover:gap-3 group-hover:px-3',

        isActive

          ? cn(

              'bg-white/20 text-white shadow-none',

              'group-hover:border-l-4 group-hover:border-l-white group-hover:pl-2.5',

              'dark:bg-primary/20 dark:text-primary dark:shadow-[0_0_24px_rgba(124,58,237,0.2)]',

              'dark:group-hover:border-l-primary',

            )

          : cn(

              'text-white/75 hover:bg-white/10 hover:text-white',

              'group-hover:border-l-4 group-hover:border-l-transparent',

              'dark:text-slate-400 dark:hover:bg-primary/10 dark:hover:text-primary',

              'dark:hover:shadow-[0_0_20px_rgba(124,58,237,0.25)]',

            ),

      )}

    >

      <Icon

        className={cn(

          'size-5 shrink-0 transition-colors duration-300',

          isActive

            ? 'text-white dark:text-primary'

            : 'text-white/70 group-hover:text-white dark:text-slate-500 dark:group-hover:text-primary',

        )}

        aria-hidden

      />

      <span className={cn('text-sm font-medium', expandableLabel)}>{item.label}</span>

    </button>

  )

}



function ThemeToggle({

  theme,

  onToggle,

}: {

  theme: Theme

  onToggle: () => void

}) {

  const isDark = theme === 'dark'



  return (

    <button

      type="button"

      onClick={onToggle}

      aria-label={isDark ? 'Gündüz moduna geç' : 'Gece moduna geç'}

      className={cn(

        'flex w-full items-center rounded-xl border py-2.5',

        'justify-center gap-0 px-2',

        'border-white/25 bg-white/10 text-white',

        'transition-all duration-300 ease-in-out',

        'group-hover:justify-between group-hover:gap-3 group-hover:px-3',

        'hover:border-white/40 hover:bg-white/15',

        'dark:border-primary/20 dark:bg-primary/5 dark:text-slate-300',

        'dark:hover:border-primary/40 dark:hover:bg-primary/10 dark:hover:text-primary',

      )}

    >

      <span className="flex shrink-0 items-center justify-center group-hover:hidden">

        {isDark ? (

          <Moon className="size-5 text-primary" aria-hidden />

        ) : (

          <Sun className="size-5 text-amber-200" aria-hidden />

        )}

      </span>



      <span

        className={cn(

          'hidden min-w-0 items-center gap-2 text-sm font-medium',

          'group-hover:flex',

          expandableLabel,

          'group-hover:max-w-none group-hover:opacity-100',

        )}

      >

        {isDark ? (

          <>

            <Moon className="size-4 shrink-0 text-primary" aria-hidden />

            Gece Modu

          </>

        ) : (

          <>

            <Sun className="size-4 shrink-0 text-amber-200" aria-hidden />

            Gündüz Modu

          </>

        )}

      </span>



      <span

        className={cn(

          'relative hidden h-6 w-11 shrink-0 rounded-full transition-colors duration-300',

          'group-hover:inline-block',

          isDark ? 'bg-primary/40' : 'bg-white/30',

        )}

        aria-hidden

      >

        <span

          className={cn(

            'absolute top-0.5 size-5 rounded-full bg-white shadow-md transition-transform duration-300',

            isDark ? 'left-0.5' : 'left-[1.375rem]',

          )}

        />

      </span>

    </button>

  )

}



function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() ?? ''
  if (!local) return 'Kullanıcı'
  return local.charAt(0).toLocaleUpperCase('tr-TR') + local.slice(1)
}

function avatarInitials(displayName: string): string {
  const cleaned = displayName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/gi, '')
  if (cleaned.length >= 2) return cleaned.slice(0, 2).toLocaleUpperCase('tr-TR')
  if (cleaned.length === 1) return cleaned.toLocaleUpperCase('tr-TR')
  return 'KU'
}

function UserProfile() {
  const { session, isLoading } = useAuth()
  const email = session?.user?.email?.trim() ?? ''
  const displayName = email ? displayNameFromEmail(email) : 'Kullanıcı'
  const subtitle = email || 'Aktif Kullanıcı'
  const initials = avatarInitials(displayName)

  return (
    <div
      className={cn(
        'flex items-center rounded-xl border py-2.5 backdrop-blur-sm',
        'justify-center gap-0 px-2',
        'border-white/20 bg-white/10',
        'transition-all duration-300 ease-in-out',
        'group-hover:justify-start group-hover:gap-3 group-hover:px-3',
        'dark:border-primary/15 dark:bg-white/5',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          'bg-gradient-to-br from-violet-500 to-purple-700 text-xs font-bold text-white',
          'ring-2 ring-white/40 dark:ring-primary/40',
        )}
        aria-hidden
      >
        {isLoading ? '…' : initials}
      </span>
      <div className={cn('min-w-0 flex-1', expandableLabel)}>
        <p className="truncate text-sm font-semibold text-white">
          {isLoading ? 'Yükleniyor…' : displayName}
        </p>
        <p className="truncate text-xs text-white/70 dark:text-slate-400" title={subtitle}>
          {isLoading ? '—' : subtitle}
        </p>
      </div>
    </div>
  )
}



function LogOutButton({

  onSignOut,

  isSigningOut,

}: {

  onSignOut: () => void | Promise<void>

  isSigningOut: boolean

}) {

  return (

    <button

      type="button"

      onClick={onSignOut}

      disabled={isSigningOut}

      aria-label="Çıkış Yap"

      title="Çıkış Yap"

      className={cn(

        'flex w-full items-center rounded-xl border py-2.5',

        'justify-center gap-0 px-2',

        'border-white/20 bg-white/5 text-white/80',

        'transition-all duration-300 ease-in-out',

        'group-hover:justify-start group-hover:gap-3 group-hover:px-3',

        'hover:border-white/35 hover:bg-white/10 hover:text-white',

        'disabled:cursor-not-allowed disabled:opacity-50',

        'dark:border-red-500/20 dark:bg-red-500/5 dark:text-slate-400',

        'dark:hover:border-red-500/35 dark:hover:bg-red-500/10 dark:hover:text-red-300',

      )}

    >

      <LogOut className="size-5 shrink-0" aria-hidden />

      <span className={cn('text-sm font-medium', expandableLabel)}>Çıkış Yap</span>

    </button>

  )

}



export function Sidebar({

  activeItem,

  onNavigate,

  theme,

  onToggleTheme,

  onSignOut,

}: SidebarProps) {

  const [isSigningOut, setIsSigningOut] = useState(false)



  async function handleSignOut() {

    if (isSigningOut) return

    setIsSigningOut(true)

    try {

      await onSignOut()

    } finally {

      setIsSigningOut(false)

    }

  }



  return (

    <aside

      className={cn(

        'group flex h-screen w-20 shrink-0 flex-col overflow-hidden',

        'border-r border-violet-700/40 bg-violet-600 shadow-lg',

        'transition-all duration-300 ease-in-out hover:w-72',

        'dark:border-primary/25 dark:bg-card-dark/30 dark:backdrop-blur-md',

        'dark:shadow-[inset_-1px_0_0_rgba(124,58,237,0.15)]',

      )}

    >

      <div

        className={cn(

          'border-b border-white/20 py-6 dark:border-primary/20',

          'flex justify-center px-2 transition-all duration-300 ease-in-out',

          'group-hover:justify-start group-hover:px-5',

        )}

      >

        <div

          className={cn(

            'flex items-center gap-0',

            'transition-all duration-300 ease-in-out',

            'group-hover:gap-3',

          )}

        >

          <span

            className={cn(

              'flex size-10 shrink-0 items-center justify-center rounded-xl',

              'bg-white/20 text-white',

              'dark:bg-primary/20 dark:text-primary dark:shadow-[0_0_20px_rgba(124,58,237,0.35)]',

            )}

          >

            <LayoutDashboard className="size-5" aria-hidden />

          </span>

          <div className={expandableLabel}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60 dark:text-primary/70">
              Akıllı Finans
            </p>
            <h1 className="text-lg font-bold tracking-tight text-white">
              FINANCE
              <span className="bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-transparent dark:from-cyan-400 dark:via-primary dark:to-violet-300">
                AI
              </span>
            </h1>
          </div>

        </div>

      </div>



      <nav

        className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2 py-4 group-hover:px-3"

        aria-label="Ana menü"

      >

        {NAV_ITEMS.map((item) => (

          <NavLink

            key={item.id}

            item={item}

            isActive={activeItem === item.id}

            onClick={() => onNavigate(item.id)}

          />

        ))}

      </nav>



      <div

        className={cn(

          'space-y-3 border-t px-2 py-4 group-hover:px-4',

          'border-white/20 dark:border-primary/20',

        )}

      >

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <UserProfile />

        <LogOutButton onSignOut={handleSignOut} isSigningOut={isSigningOut} />

      </div>

    </aside>

  )

}

