'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Check, ClipboardList, Eye, EyeOff, LoaderCircle, LogIn, MapPin, Sparkles, Truck, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/client'
import { saveProfilePhone } from '@/lib/jmf/http-service'
import {
  PASSWORD_RULES,
  generateStrongPassword,
  isStrongPassword,
  isValidEmail,
  isValidPhone,
  maskPhone,
  normalizeEmail,
  passwordScore,
} from '@/lib/jmf/masks'

type AuthFormMode = 'sign-in' | 'sign-up'

const logoSrc = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gemini_Generated_Image_ioq9boioq9boioq9-H54AK4vHwpjj9GVxbtWTHgzLDLJpm6.jpg'

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState({ phone: false, email: false })
  const isSignUp = mode === 'sign-up'
  const score = passwordScore(password)
  const strengthLabel = ['Muito fraca', 'Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte'][score]
  const strengthColor = score >= 5 ? 'bg-emerald-500' : score >= 4 ? 'bg-lime-500' : score >= 3 ? 'bg-amber-500' : 'bg-destructive'
  const phoneInvalid = touched.phone && phone.length > 0 && !isValidPhone(phone)
  const emailInvalid = touched.email && email.length > 0 && !isValidEmail(email)

  const handleGeneratePassword = () => {
    setPassword(generateStrongPassword())
    setShowPassword(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsPending(true)

    const formData = new FormData(event.currentTarget)
    const normalizedEmail = normalizeEmail(email)
    setTouched({ phone: true, email: true })

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Informe um e-mail válido, como nome@exemplo.com.')
      setIsPending(false)
      return
    }
    if (isSignUp && !isValidPhone(phone)) {
      setErrorMessage('Informe um telefone válido com DDD para contato.')
      setIsPending(false)
      return
    }
    if (isSignUp && !isStrongPassword(password)) {
      setErrorMessage('Crie uma senha forte: atenda a todos os requisitos abaixo do campo de senha.')
      setIsPending(false)
      return
    }

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            email: normalizedEmail,
            name: String(formData.get('name') ?? '').trim(),
            password,
          })
        : await authClient.signIn.email({ email: normalizedEmail, password })

      if (result.error) {
        setErrorMessage(
          isSignUp
            ? 'Não foi possível criar a conta com esses dados. Confira as informações e tente novamente.'
            : 'Não foi possível entrar com esses dados. Confira o e-mail e a senha.',
        )
        return
      }

      if (isSignUp) {
        try {
          await saveProfilePhone(phone, String(formData.get('name') ?? '').trim())
        } catch {
          // Se falhar, o telefone pode ser informado depois no perfil
        }
      }

      router.replace('/')
      router.refresh()
    } catch {
      setErrorMessage(
        isSignUp
          ? 'Não foi possível criar a conta agora. Tente novamente.'
          : 'Não foi possível entrar agora. Confira os dados e tente novamente.',
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/55 px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:gap-10">
        <section className="flex flex-col justify-between gap-8 rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl sm:p-9 lg:min-h-[540px] lg:p-10">
          <div className="flex items-center gap-3">
            <Image
              src={logoSrc}
              alt="Logo da JMF Entulhos"
              width={1408}
              height={768}
              priority
              className="size-14 shrink-0 rounded-2xl border border-border/70 bg-white object-cover shadow-sm"
            />
            <div>
              <p className="text-lg font-bold tracking-[0.16em]">JMF</p>
              <p className="text-xs text-primary-foreground/75">Aluguel de caçambas</p>
            </div>
          </div>

          <div className="max-w-lg">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary-foreground/70 uppercase">Plataforma JMF</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Do pedido à retirada, tudo em um só lugar.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-primary-foreground/75 sm:text-base sm:leading-7">
              Acesse sua área para acompanhar solicitações, entregas, trocas e retiradas com a equipe JMF.
            </p>
            <div className="mt-7 hidden flex-col gap-3 text-sm text-primary-foreground/85 lg:flex">
              <p className="flex items-center gap-2"><ClipboardList aria-hidden="true" className="size-4" /> Solicitações acompanhadas</p>
              <p className="flex items-center gap-2"><Truck aria-hidden="true" className="size-4" /> Entregas e trocas organizadas</p>
              <p className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-4" /> Operação em São Luís, MA</p>
            </div>
          </div>

          <p className="text-xs text-primary-foreground/65">JMF Entulhos · São Luís, Maranhão</p>
        </section>

        <Card className="mx-auto w-full max-w-md border-border/80 shadow-xl">
          <CardHeader className="gap-2 p-6 pb-0 sm:p-8 sm:pb-0">
            <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {isSignUp ? <UserPlus aria-hidden="true" className="size-5" /> : <LogIn aria-hidden="true" className="size-5" />}
            </div>
            <CardTitle className="text-2xl">{isSignUp ? 'Criar sua conta' : 'Acesse sua conta'}</CardTitle>
            <CardDescription>
              {isSignUp
                ? 'Cadastre-se para acompanhar seus aluguéis de caçamba.'
                : 'Entre para continuar no sistema de locação da JMF.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <FieldGroup>
                {isSignUp ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="name">Nome completo</FieldLabel>
                      <Input id="name" name="name" type="text" autoComplete="name" minLength={2} maxLength={80} required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="phone">Telefone para contato</FieldLabel>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="(98) 98888-8888"
                        value={phone}
                        onChange={(event) => setPhone(maskPhone(event.target.value))}
                        onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
                        aria-invalid={phoneInvalid}
                        maxLength={15}
                        required
                      />
                      {phoneInvalid
                        ? <FieldDescription className="text-destructive">Telefone inválido. Use DDD + número, ex.: (98) 98888-8888.</FieldDescription>
                        : <FieldDescription>Usaremos este número para falar sobre entregas, trocas e retiradas.</FieldDescription>}
                    </Field>
                  </>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="nome@exemplo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value.replace(/\s/g, ''))}
                    onBlur={() => {
                      setEmail((current) => normalizeEmail(current))
                      setTouched((current) => ({ ...current, email: true }))
                    }}
                    aria-invalid={emailInvalid}
                    maxLength={254}
                    required
                  />
                  {emailInvalid ? <FieldDescription className="text-destructive">E-mail inválido. Confira o formato, ex.: nome@exemplo.com.</FieldDescription> : null}
                </Field>
                <Field>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor="password">Senha</FieldLabel>
                    {isSignUp ? (
                      <button type="button" onClick={handleGeneratePassword} className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
                        <Sparkles aria-hidden="true" className="size-3.5" /> Gerar senha forte
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={isSignUp ? 8 : undefined}
                      maxLength={128}
                      className="pr-11"
                      required
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
                  {isSignUp ? (
                    <div className="mt-1 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full transition-all ${strengthColor}`} style={{ width: `${(score / PASSWORD_RULES.length) * 100}%` }} />
                        </div>
                        <span className="w-20 text-right text-xs text-muted-foreground">{password ? strengthLabel : ''}</span>
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
                      {showPassword && password ? <FieldDescription>Guarde esta senha em um lugar seguro antes de continuar.</FieldDescription> : null}
                    </div>
                  ) : null}
                </Field>
              </FieldGroup>

              {errorMessage ? <p role="alert" aria-live="polite" className="text-sm text-destructive">{errorMessage}</p> : null}

              <Button type="submit" size="lg" className="w-full" disabled={isPending}>
                {isPending ? (
                  <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" />
                ) : isSignUp ? (
                  <UserPlus aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <LogIn aria-hidden="true" data-icon="inline-start" />
                )}
                {isPending ? 'Conectando…' : isSignUp ? 'Criar conta' : 'Entrar'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-border/70 p-6 text-center text-sm sm:p-8">
            {isSignUp ? (
              <p>Já tem uma conta? <Link href="/auth/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">Entrar</Link></p>
            ) : (
              <p>Ainda não tem conta? <Link href="/auth/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">Criar uma conta</Link></p>
            )}
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
