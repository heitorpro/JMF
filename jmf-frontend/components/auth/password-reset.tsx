'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, LoaderCircle, MailCheck, Sparkles, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/client'
import {
  PASSWORD_RULES,
  generateStrongPassword,
  isStrongPassword,
  isValidEmail,
  normalizeEmail,
  passwordScore,
} from '@/lib/jmf/masks'

function AuthCard({ icon, title, description, children, footer }: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/55 px-4 py-8 sm:px-6">
      <Card className="w-full max-w-md border-border/80 shadow-xl">
        <CardHeader className="gap-2 p-6 pb-0 sm:p-8 sm:pb-0">
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">{children}</CardContent>
        <CardFooter className="justify-center border-t border-border/70 p-6 text-center text-sm sm:p-8">
          {footer ?? (
            <Link href="/auth/sign-in" className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline">
              <ArrowLeft aria-hidden="true" className="size-4" /> Voltar para o login
            </Link>
          )}
        </CardFooter>
      </Card>
    </main>
  )
}

/** Etapa 1: o cliente informa o e-mail e recebe o link para criar uma nova senha. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    const normalized = normalizeEmail(email)
    if (!isValidEmail(normalized)) {
      setErrorMessage('Informe um e-mail válido, como nome@exemplo.com.')
      return
    }
    setIsPending(true)
    try {
      const result = await authClient.requestPasswordReset({
        email: normalized,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (result?.error && (result.error.status ?? 0) >= 500) {
        setErrorMessage('Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.')
        return
      }
      // Por segurança, a mesma mensagem aparece mesmo que o e-mail não esteja cadastrado.
      setSent(true)
    } catch {
      setErrorMessage('Não foi possível enviar o e-mail agora. Confira sua conexão e tente novamente.')
    } finally {
      setIsPending(false)
    }
  }

  if (sent) {
    return (
      <AuthCard
        icon={<MailCheck aria-hidden="true" className="size-5" />}
        title="Confira seu e-mail"
        description={`Se ${normalizeEmail(email)} estiver cadastrado, você receberá um link para criar uma nova senha.`}
      >
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>O link vale por <strong className="text-foreground">1 hora</strong>. Não encontrou? Veja também a caixa de spam ou lixo eletrônico.</p>
          <Button variant="outline" onClick={() => setSent(false)}>Enviar para outro e-mail</Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      icon={<KeyRound aria-hidden="true" className="size-5" />}
      title="Esqueceu sua senha?"
      description="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="nome@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value.replace(/\s/g, ''))}
              maxLength={254}
              required
              autoFocus
            />
          </Field>
        </FieldGroup>
        {errorMessage ? <p role="alert" aria-live="polite" className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : <MailCheck aria-hidden="true" data-icon="inline-start" />}
          {isPending ? 'Enviando…' : 'Enviar link de redefinição'}
        </Button>
      </form>
    </AuthCard>
  )
}

/** Etapa 2: o cliente abre o link do e-mail e define a nova senha. */
export function ResetPasswordForm({ token, linkError }: { token?: string; linkError?: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const score = passwordScore(password)
  const strengthColor = score >= 5 ? 'bg-emerald-500' : score >= 4 ? 'bg-lime-500' : score >= 3 ? 'bg-amber-500' : 'bg-destructive'
  const mismatch = confirm.length > 0 && confirm !== password

  if (!token || linkError) {
    return (
      <AuthCard
        icon={<X aria-hidden="true" className="size-5" />}
        title="Link inválido ou expirado"
        description="Este link de redefinição não é mais válido. Os links valem por 1 hora e só podem ser usados uma vez."
        footer={<Link href="/auth/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">Voltar para o login</Link>}
      >
        <Link href="/auth/forgot-password" className={buttonVariants({ size: 'lg', className: 'w-full' })}>Pedir um novo link</Link>
      </AuthCard>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    if (!isStrongPassword(password)) {
      setErrorMessage('Crie uma senha forte: atenda a todos os requisitos abaixo do campo de senha.')
      return
    }
    if (password !== confirm) {
      setErrorMessage('As senhas não coincidem.')
      return
    }
    setIsPending(true)
    try {
      const result = await authClient.resetPassword({ newPassword: password, token })
      if (result?.error) {
        setErrorMessage('Não foi possível redefinir a senha. O link pode ter expirado; peça um novo link.')
        return
      }
      router.replace('/auth/sign-in?senha=redefinida')
    } catch {
      setErrorMessage('Não foi possível redefinir a senha agora. Tente novamente.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AuthCard
      icon={<KeyRound aria-hidden="true" className="size-5" />}
      title="Crie uma nova senha"
      description="Escolha uma senha forte que você ainda não tenha usado nesta conta."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
              <button type="button" onClick={() => { const generated = generateStrongPassword(); setPassword(generated); setConfirm(generated); setShowPassword(true) }} className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
                <Sparkles aria-hidden="true" className="size-3.5" /> Gerar senha forte
              </button>
            </div>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                className="pr-11"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              </button>
            </div>
            <div className="mt-1 flex flex-col gap-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all ${strengthColor}`} style={{ width: `${(score / PASSWORD_RULES.length) * 100}%` }} />
              </div>
              <ul className="grid gap-1 text-xs sm:grid-cols-2">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password)
                  return (
                    <li key={rule.id} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {ok ? <Check aria-hidden="true" className="size-3.5" /> : <X aria-hidden="true" className="size-3.5" />}
                      {rule.label}
                    </li>
                  )
                })}
              </ul>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">Confirme a nova senha</FieldLabel>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={mismatch}
              maxLength={128}
              required
            />
            {mismatch ? <FieldDescription className="text-destructive">As senhas não coincidem.</FieldDescription> : null}
          </Field>
        </FieldGroup>
        {errorMessage ? <p role="alert" aria-live="polite" className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : <KeyRound aria-hidden="true" data-icon="inline-start" />}
          {isPending ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthCard>
  )
}
