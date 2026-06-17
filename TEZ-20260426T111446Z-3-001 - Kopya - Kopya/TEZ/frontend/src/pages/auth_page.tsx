import { type FormEvent, useState } from 'react'
import { Lock, Mail, Sparkles } from 'lucide-react'
import { PageBrandTitle } from '@/components/ui/page_brand_eyebrow'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type AuthMode = 'signIn' | 'signUp'

function mapAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) {
    return 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.'
  }
  if (lower.includes('user already registered')) {
    return 'Bu e-posta adresi zaten kayıtlı.'
  }
  if (lower.includes('password') && lower.includes('least')) {
    return 'Şifre en az 6 karakter olmalıdır.'
  }
  if (lower.includes('valid email')) {
    return 'Geçerli bir e-posta adresi girin.'
  }
  if (lower.includes('email not confirmed')) {
    return 'E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzu kontrol edin.'
  }
  return message
}

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setIsSubmitting(true)

    try {
      if (mode === 'signIn') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) {
          setError(mapAuthError(signInError.message))
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (signUpError) {
          setError(mapAuthError(signUpError.message))
          return
        }
        if (data.session) {
          return
        }
        setInfo(
          'Kayıt başarılı. Hesabınızı etkinleştirmek için e-postanıza gelen doğrulama bağlantısına tıklayın.',
        )
      }
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSignIn = mode === 'signIn'

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-bg-dark">
      <div
        className={cn(
          'w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl',
          'dark:border-primary/30 dark:bg-card-dark/40 dark:backdrop-blur-md',
          'dark:shadow-[0_0_60px_rgba(124,58,237,0.12)]',
        )}
      >
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-[0_0_24px_rgba(124,58,237,0.35)]">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <PageBrandTitle />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Akıllı finans paneline güvenli giriş
          </p>
        </div>

        <div
          className="mb-6 flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-primary/20 dark:bg-bg-dark/50"
          role="tablist"
          aria-label="Giriş veya kayıt"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isSignIn}
            onClick={() => switchMode('signIn')}
            className={cn(
              'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200',
              isSignIn
                ? 'bg-primary text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                : 'text-slate-500 hover:text-primary dark:text-slate-400',
            )}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignIn}
            onClick={() => switchMode('signUp')}
            className={cn(
              'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200',
              !isSignIn
                ? 'bg-primary text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                : 'text-slate-500 hover:text-primary dark:text-slate-400',
            )}
          >
            Kayıt Ol
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              E-posta
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className={cn(
                  'w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4',
                  'text-slate-800 placeholder:text-slate-400',
                  'dark:border-primary/20 dark:bg-bg-dark/60 dark:text-white dark:placeholder:text-slate-500',
                  'outline-none transition-colors duration-200',
                  'focus:border-primary/50 focus:ring-2 focus:ring-primary/25',
                )}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              Şifre
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                id="auth-password"
                type="password"
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  'w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4',
                  'text-slate-800 placeholder:text-slate-400',
                  'dark:border-primary/20 dark:bg-bg-dark/60 dark:text-white dark:placeholder:text-slate-500',
                  'outline-none transition-colors duration-200',
                  'focus:border-primary/50 focus:ring-2 focus:ring-primary/25',
                )}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white',
              'transition-all duration-200 ease-out',
              'hover:scale-[1.02] hover:bg-primary/90 hover:shadow-[0_0_28px_rgba(124,58,237,0.45)]',
              'active:scale-[0.98]',
              'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
            )}
          >
            {isSubmitting
              ? 'İşleniyor…'
              : isSignIn
                ? 'Giriş Yap'
                : 'Kayıt Ol'}
          </button>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
            >
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center text-sm text-primary/90">
              {info}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
