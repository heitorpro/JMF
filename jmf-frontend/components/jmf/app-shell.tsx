'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  PackageCheck,
  Search,
  Settings,
  Sun,
  Truck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { authClient } from '@/lib/auth/client'
import { cn } from '@/lib/utils'
import {
  apiErrorMessage,
  changeRequestStatus,
  completeSwap as completeSwapApi,
  fetchMe,
  fetchSyncVersion,
  httpJmfService,
  loadClientData,
  loadManagerData,
  markNotificationRead,
  saveSettings,
  updateDumpsterStatus,
  updateProfile,
  PENDING_PROFILE_KEY,
  type ApiMe,
  type JmfSnapshot,
} from '@/lib/jmf/http-service'
import { formatCurrency, formatDate, getInitials } from '@/lib/jmf/format'
import {
  getNextRequestStatus,
  isActiveRequestStatus,
  type ActivityItem,
  type CompanySettings,
  type Dumpster,
  type DumpsterStatus,
  type JmfCustomer,
  type NotificationItem,
  type PageKey,
  type RentalRecord,
  type RentalRequest,
  type RentalRequestInput,
  type WorkspaceMode,
} from '@/lib/jmf/types'
import { ClientDashboard } from './client-dashboard'
import { ClientHistoryPage, ClientProfilePage, ClientRentalPage, ClientTrackingPage, type ProfileUpdate } from './client-pages'
import { ManagerCustomersPage } from './manager-customers'
import { ManagerDumpstersPage, ManagerStockPage } from './manager-fleet'
import { ManagerMapPage } from './manager-map'
import { ManagerOverview } from './manager-overview'
import { ManagerRentalsPage } from './manager-rentals'
import { ManagerRequests } from './manager-requests'
import { ManagerSettingsPage } from './manager-settings'
import { CustomerAvatar } from './ui'

const EMPTY_SETTINGS: CompanySettings = {
  weeklyPrice: 0,
  periodDays: 7,
  price15: 0,
  price30: 0,
  plans: [],
  whatsapp: '',
  email: '',
  phone: '',
  address: '',
}

const clientNavigation: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'alugar', label: 'Alugar caçamba', icon: Truck },
  { key: 'acompanhamento', label: 'Acompanhamento', icon: MapPin },
  { key: 'historico', label: 'Histórico', icon: FileClock },
  { key: 'perfil', label: 'Meu perfil', icon: UserRound },
]

const managerNavigation: { key: PageKey; label: string; icon: typeof LayoutDashboard; group: 'operacao' | 'cadastros' }[] = [
  { key: 'dashboard', label: 'Visão geral', icon: LayoutDashboard, group: 'operacao' },
  { key: 'solicitacoes', label: 'Solicitações', icon: ClipboardList, group: 'operacao' },
  { key: 'cacambas', label: 'Caçambas', icon: Truck, group: 'operacao' },
  { key: 'estoque', label: 'Estoque', icon: Boxes, group: 'operacao' },
  { key: 'mapa', label: 'Mapa', icon: MapPin, group: 'operacao' },
  { key: 'clientes', label: 'Clientes', icon: UsersRound, group: 'cadastros' },
  { key: 'alugueis', label: 'Aluguéis', icon: PackageCheck, group: 'cadastros' },
  { key: 'configuracoes', label: 'Configurações', icon: Settings, group: 'cadastros' },
]

function SidebarNavigation({
  mode,
  activePage,
  pendingCount,
  onNavigate,
  onClose,
}: {
  mode: WorkspaceMode
  activePage: PageKey
  pendingCount: number
  onNavigate: (page: PageKey) => void
  onClose: () => void
}) {
  const firstGroup = mode === 'gestor'
    ? managerNavigation.filter((item) => item.group === 'operacao')
    : clientNavigation
  const secondGroup = mode === 'gestor'
    ? managerNavigation.filter((item) => item.group === 'cadastros')
    : []

  const renderItem = (item: { key: PageKey; label: string; icon: typeof LayoutDashboard }) => {
    const Icon = item.icon
    const current = activePage === item.key
    return (
      <button
        key={item.key}
        type="button"
        aria-current={current ? 'page' : undefined}
        onClick={() => {
          onNavigate(item.key)
          onClose()
        }}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
          current
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.key === 'solicitacoes' ? (
          <span className={cn('flex size-5 items-center justify-center rounded-full text-[10px] font-semibold', current ? 'bg-white/15 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300')}>
            {pendingCount}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <nav aria-label={mode === 'gestor' ? 'Navegação do gestor' : 'Navegação do cliente'} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">{firstGroup.map(renderItem)}</div>
      {secondGroup.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/75 uppercase">Gestão</p>
          {secondGroup.map(renderItem)}
        </div>
      ) : null}
    </nav>
  )
}

function getPageLabel(mode: WorkspaceMode, page: PageKey) {
  if (page === 'perfil') return 'Meu perfil'
  const items = mode === 'gestor' ? managerNavigation : clientNavigation
  return items.find((item) => item.key === page)?.label ?? 'Visão geral'
}

export interface JmfAppShellProps {
  userName?: string
  userEmail?: string
  canManage?: boolean
}

export function JmfAppShell({
  userName,
  userEmail,
  canManage = false,
}: JmfAppShellProps) {
  const router = useRouter()
  const [mode, setMode] = useState<WorkspaceMode>(canManage ? 'gestor' : 'cliente')
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [searchQuery, setSearchQuery] = useState('')
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([])
  const [requests, setRequests] = useState<RentalRequest[]>([])
  const [rentals, setRentals] = useState<RentalRecord[]>([])
  const [customers, setCustomers] = useState<JmfCustomer[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [settings, setSettings] = useState<CompanySettings>(EMPTY_SETTINGS)
  const [customer, setCustomer] = useState<JmfCustomer>({ id: '', name: userName || '', initials: getInitials(userName || userEmail || '?'), cpf: '', phone: '', email: userEmail || '', currentDumpsterId: undefined, totalRentals: 0, status: 'ativo' })
  const modeRef = useRef<WorkspaceMode>(mode)
  // Só exibe as telas depois que o backend informar o papel (evita piscar a área errada).
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<ApiMe | null>(null)
  const [clientAvailable, setClientAvailable] = useState(1)
  const displayName = userName || customer.name
  const displayEmail = userEmail || customer.email
  const pendingCount = requests.filter((request) => ['pendente', 'troca_solicitada', 'retirada_solicitada'].includes(request.status)).length
  const availableDumpsterIds = useMemo(() => {
    // O backend informa em "notes" quando a caçamba está reservada para uma entrega.
    return dumpsters.filter((dumpster) => dumpster.status === 'livre' && !dumpster.notes?.startsWith('Reservada'))
  }, [dumpsters])
  // O cliente não enxerga a frota; a disponibilidade é verificada pela equipe ao aprovar.
  const availableCount = mode === 'cliente' ? clientAvailable : availableDumpsterIds.length
  const activeDumpster = dumpsters.find(
    (dumpster) => dumpster.customerId === customer.id && dumpster.status === 'ocupada',
  )
  const activeRental = rentals.find(
    (rental) => rental.customerId === customer.id && rental.status === 'ativo',
  )

  const applySnapshot = (snapshot: JmfSnapshot) => {
    if (snapshot.customer) setCustomer(snapshot.customer)
    setDumpsters(snapshot.dumpsters)
    setRequests(snapshot.requests)
    setRentals(snapshot.rentals)
    setCustomers(snapshot.customers)
    setNotifications(snapshot.notifications)
    setActivities(snapshot.activities)
    setSettings(snapshot.settings)
    if (snapshot.availableDumpsters != null) setClientAvailable(snapshot.availableDumpsters)
  }

  const reload = async (target: WorkspaceMode = modeRef.current) => {
    try {
      applySnapshot(target === 'gestor' ? await loadManagerData() : await loadClientData())
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não foi possível carregar os dados do servidor.'))
    }
  }

  // Descobre o papel no backend, carrega os dados e mantém sincronizado (verificação a cada 3 s).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let current = await fetchMe()
        // Conclui o cadastro se o telefone não chegou ao servidor na hora da criação da conta.
        try {
          const raw = localStorage.getItem(PENDING_PROFILE_KEY)
          if (raw) {
            const pending = JSON.parse(raw) as { phone?: string; name?: string }
            if (pending.phone && !current.user.phone) {
              current = await updateProfile({ phone: pending.phone, name: pending.name || undefined })
            }
            localStorage.removeItem(PENDING_PROFILE_KEY)
          }
        } catch {
          // segue sem o telefone; o perfil indica "Não informado"
        }
        const target: WorkspaceMode = current.user.role === 'gestor' ? 'gestor' : 'cliente'
        if (cancelled) return
        setMe(current)
        modeRef.current = target
        setMode(target)
        await reload(target)
      } catch (error) {
        toast.error(apiErrorMessage(error, 'Não foi possível conectar ao servidor da JMF.'))
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    // Sincronização rápida: a cada 3 s pergunta ao servidor se algo mudou (resposta mínima) e só então
    // recarrega os dados. Com a aba em segundo plano, pausa; ao voltar, verifica na hora.
    let lastVersion = ''
    let checking = false
    let lastFullReload = Date.now()
    const check = async () => {
      if (checking || cancelled || document.visibilityState !== 'visible') return
      checking = true
      try {
        const version = await fetchSyncVersion()
        const stale = Date.now() - lastFullReload > 60_000 // segurança: recarrega tudo a cada 1 min
        if ((lastVersion && version !== lastVersion) || stale) {
          lastFullReload = Date.now()
          await reload()
        }
        lastVersion = version
      } catch {
        // falha momentânea de rede: tenta de novo no próximo ciclo
      } finally {
        checking = false
      }
    }
    const timer = window.setInterval(() => void check(), 3_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const activeNotifications = notifications.filter((notification) => notification.audience === mode || notification.audience === 'ambos')
  const unreadCount = activeNotifications.filter((notification) => !notification.read).length

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const navigate = (page: PageKey) => {
    setActivePage(page)
    setMobileMenuOpen(false)
    setNotificationsOpen(false)
  }

  const handleCreateRental = async (input: RentalRequestInput) => {
    try {
      const request = await httpJmfService.createRentalRequest(input)
      toast.success(`Solicitação ${request.id} enviada. Acompanhe as próximas etapas por aqui.`)
      await reload()
    } catch (error) {
      toast.error(apiErrorMessage(error))
      throw error
    }
  }

  const handleCreateSwap = async () => {
    if (!activeDumpster?.location) {
      toast.error('Não encontramos uma caçamba ativa para trocar.')
      return
    }
    try {
      const request = await httpJmfService.createSwapRequest({
        customerId: customer.id,
        customerName: customer.name,
        dumpsterId: activeDumpster.id,
        desiredDate: new Date().toISOString().slice(0, 10),
        location: activeDumpster.location,
        price: settings.weeklyPrice,
        reason: 'Troca solicitada pelo cliente',
      })
      toast.success(`Solicitação de troca ${request.id} enviada com sucesso.`)
      await reload()
      setActivePage('acompanhamento')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const handleCreateRemoval = async (reason: string, notes: string) => {
    if (!activeDumpster?.location) {
      toast.error('Não encontramos uma caçamba ativa para retirar.')
      return
    }
    try {
      const request = await httpJmfService.createRemovalRequest({
        customerId: customer.id,
        customerName: customer.name,
        dumpsterId: activeDumpster.id,
        desiredDate: new Date().toISOString().slice(0, 10),
        location: activeDumpster.location,
        reason,
        notes,
      })
      toast.success(`Solicitação de retirada ${request.id} enviada com sucesso.`)
      await reload()
      setActivePage('acompanhamento')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const advanceRequest = async (requestId: string) => {
    const request = requests.find((item) => item.id === requestId)
    if (!request) return
    const nextStatus = getNextRequestStatus(request)
    if (!nextStatus) return
    try {
      const updated = await changeRequestStatus(requestId, nextStatus)
      const messages: Partial<Record<typeof nextStatus, string>> = {
        aprovada: 'Solicitação aprovada.',
        em_entrega: `Entrega iniciada${updated.dumpsterId ? ` com a caçamba ${updated.dumpsterId}` : ''}.`,
        entregue: 'Posicionamento confirmado. O aluguel foi registrado.',
        em_uso: 'Caçamba marcada como em uso.',
        em_retirada: 'Retirada iniciada.',
        finalizada: 'Retirada finalizada. Caçamba liberada no estoque.',
      }
      toast.success(messages[nextStatus] ?? 'Solicitação atualizada.')
      await reload()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const rejectRequest = async (requestId: string) => {
    try {
      await changeRequestStatus(requestId, 'rejeitada')
      toast.success('Solicitação marcada como rejeitada.')
      await reload()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const completeSwap = async (requestId: string, replacementId: string) => {
    try {
      const updated = await completeSwapApi(requestId, replacementId)
      toast.success(`Troca concluída. ${updated.replacementDumpsterId ?? replacementId} em uso; novo aluguel de ${formatCurrency(updated.price)}/semana.`)
      await reload()
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não foi possível concluir a troca. Atualize a disponibilidade e tente novamente.'))
    }
  }

  const changeDumpsterStatus = async (dumpsterId: string, status: DumpsterStatus) => {
    try {
      await updateDumpsterStatus(dumpsterId, status)
      toast.success(`Status da caçamba ${dumpsterId} atualizado.`)
      await reload()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const handleSaveProfile = async (data: ProfileUpdate) => {
    try {
      const updated = await updateProfile({ name: data.name, phone: data.phone, cpf: data.cpf })
      setMe(updated)
      toast.success('Perfil atualizado.')
      await reload()
    } catch (error) {
      toast.error(apiErrorMessage(error))
      throw error
    }
  }

  const handleSaveSettings = async (nextSettings: CompanySettings) => {
    try {
      setSettings(await saveSettings(nextSettings))
      toast.success('Configurações salvas.')
    } catch (error) {
      toast.error(apiErrorMessage(error))
      await reload()
    }
  }

  const handleWhatsApp = () => {
    const phone = settings.whatsapp.replace(/\D/g, '')
    if (!phone) {
      toast.info('O WhatsApp da JMF ainda não foi configurado. O gestor pode adicioná-lo em Configurações.')
      return
    }
    const message = mode === 'cliente'
      ? `Olá, JMF! Preciso de ajuda com minha locação de caçamba. Meu nome é ${customer.name}.`
      : 'Olá, equipe JMF! Preciso de suporte com o sistema de locação.'
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  const handleSignOut = async () => {
    try {
      const { error } = await authClient.signOut()
      if (error) {
        toast.error('Não foi possível encerrar sua sessão. Tente novamente.')
        return
      }
      router.replace('/auth/sign-in')
      router.refresh()
    } catch {
      toast.error('Não foi possível encerrar sua sessão. Tente novamente.')
    }
  }

  const renderContent = () => {
    if (mode === 'cliente') {
      if (activePage === 'alugar') {
        return <ClientRentalPage customer={customer} weeklyPrice={settings.weeklyPrice} plans={settings.plans} availableCount={availableCount} onSubmit={handleCreateRental} onBack={() => navigate('acompanhamento')} />
      }
      if (activePage === 'acompanhamento') {
        return <ClientTrackingPage customerId={customer.id} currentDumpster={activeDumpster} requests={requests} onWhatsApp={handleWhatsApp} onRent={() => navigate('alugar')} onCreateSwap={handleCreateSwap} onCreateRemoval={handleCreateRemoval} />
      }
      if (activePage === 'historico') {
        return <ClientHistoryPage customer={customer} rentals={rentals} onRent={() => navigate('alugar')} />
      }
      if (activePage === 'perfil') return <ClientProfilePage customer={customer} variant="cliente" onSave={handleSaveProfile} />
      return <ClientDashboard customer={customer} dumpster={activeDumpster} activeRental={activeRental} rate={settings.plans.find((plan) => plan.days === (activeRental?.periodDays ?? 7))?.price ?? settings.weeklyPrice} availableCount={availableCount} onRent={() => navigate('alugar')} onTrack={() => navigate('acompanhamento')} onCreateSwap={handleCreateSwap} onCreateRemoval={handleCreateRemoval} onWhatsApp={handleWhatsApp} />
    }

    if (activePage === 'solicitacoes') {
      return <ManagerRequests requests={requests} dumpsters={dumpsters} customers={customers} searchQuery={searchQuery} onAdvance={advanceRequest} onReject={rejectRequest} onCompleteSwap={completeSwap} />
    }
    if (activePage === 'cacambas') {
      return <ManagerDumpstersPage dumpsters={dumpsters} searchQuery={searchQuery} onChangeStatus={changeDumpsterStatus} onNavigate={navigate} />
    }
    if (activePage === 'estoque') return <ManagerStockPage dumpsters={dumpsters} onNavigate={navigate} />
    if (activePage === 'mapa') return <ManagerMapPage dumpsters={dumpsters} />
    if (activePage === 'clientes') return <ManagerCustomersPage customers={customers} dumpsters={dumpsters} rentals={rentals} requests={requests} searchQuery={searchQuery} />
    if (activePage === 'alugueis') return <ManagerRentalsPage rentals={rentals} searchQuery={searchQuery} />
    if (activePage === 'perfil') {
      const name = me?.user.name || displayName
      return (
        <ClientProfilePage
          variant="gestor"
          onSave={handleSaveProfile}
          customer={{
            id: me?.user.id ?? '',
            name,
            initials: getInitials(name),
            cpf: '',
            phone: me?.user.phone ?? '',
            email: me?.user.email || displayEmail,
            currentDumpsterId: undefined,
            totalRentals: 0,
            status: 'ativo',
          }}
        />
      )
    }
    if (activePage === 'configuracoes') return <ManagerSettingsPage settings={settings} onSave={handleSaveSettings} />
    return <ManagerOverview dumpsters={dumpsters} requests={requests} rentals={rentals} customers={customers} activities={activities} weeklyPrice={settings.weeklyPrice} onNavigate={navigate} onAdvanceRequest={advanceRequest} searchQuery={searchQuery} />
  }

  if (!ready) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {mobileMenuOpen ? <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] lg:hidden" /> : null}
      <div className="mx-auto flex min-h-screen max-w-[1920px]">
        <aside className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col border-r border-border/70 bg-card transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          <div className="flex h-[76px] items-center justify-between border-b border-border/70 px-5">
            <a href="#inicio" onClick={(event) => { event.preventDefault(); navigate('dashboard') }} className="flex min-w-0 items-center gap-3" aria-label="JMF — início">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gemini_Generated_Image_ioq9boioq9boioq9-H54AK4vHwpjj9GVxbtWTHgzLDLJpm6.jpg"
                alt="Logo da JMF Entulhos com uma caçamba de entulho e uma seta ascendente."
                width={1408}
                height={768}
                priority
                className="size-10 shrink-0 rounded-xl border border-border/70 bg-white object-cover object-center shadow-sm"
              />
              <span className="min-w-0"><span className="block text-lg font-bold tracking-[0.12em] text-foreground">JMF</span><span className="block text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Aluguel de caçambas</span></span>
            </a>
            <Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="lg:hidden"><X /></Button>
          </div>

          <div className="border-b border-border/70 px-4 py-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted/65 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">{mode === 'gestor' ? <Settings aria-hidden="true" className="size-4" /> : <UserRound aria-hidden="true" className="size-4" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{mode === 'gestor' ? 'Operação JMF' : 'Minha conta'}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{mode === 'gestor' ? 'Painel do gestor' : 'Área do cliente'}</span></span>
              {canManage ? <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /> : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-5">
            <SidebarNavigation mode={mode} activePage={activePage} pendingCount={pendingCount} onNavigate={navigate} onClose={() => setMobileMenuOpen(false)} />
          </div>

          <div className="border-t border-border/70 p-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <button type="button" onClick={() => navigate('perfil')} aria-label="Abrir meu perfil" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left hover:opacity-80">
                <CustomerAvatar name={displayName} initials={getInitials(displayName)} className="size-9" />
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{displayName}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{mode === 'gestor' ? 'Gestor' : 'Cliente'}</span></span>
              </button>
              <Button variant="ghost" size="icon-sm" aria-label="Sair da conta" onClick={handleSignOut}><LogOut /></Button>
            </div>
            <p className="px-2 pb-1 text-[10px] text-muted-foreground">JMF Entulhos · São Luís, MA</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md sm:px-6 xl:px-9">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)} className="lg:hidden"><Menu /></Button>
              <div className="hidden min-w-0 sm:block"><p className="truncate text-xs text-muted-foreground">{mode === 'gestor' ? 'Gestão JMF' : 'Minha conta'} <span className="px-1.5">/</span> <span className="font-medium text-foreground">{getPageLabel(mode, activePage)}</span></p><p className="mt-1 text-[11px] text-muted-foreground">{formatDate(new Date().toISOString())} · São Luís, MA</p></div>
              <div className="sm:hidden"><p className="text-[10px] text-muted-foreground">JMF · {mode === 'gestor' ? 'GESTOR' : 'CLIENTE'}</p><p className="mt-0.5 truncate text-sm font-semibold">{getPageLabel(mode, activePage)}</p></div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {mode === 'gestor' ? (
                <div className="relative hidden w-52 lg:block xl:w-64">
                  <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Buscar clientes, caçambas ou solicitações" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar na operação" className="h-9 border-transparent bg-muted/70 pl-9 focus-visible:border-ring" />
                  {searchQuery ? <Button variant="ghost" size="icon-xs" aria-label="Limpar busca" onClick={() => setSearchQuery('')} className="absolute top-1/2 right-1 -translate-y-1/2"><X /></Button> : null}
                </div>
              ) : null}

              <span className="hidden max-w-28 truncate rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">{mode === 'gestor' ? 'Área do gestor' : 'Área do cliente'}</span>

              <div className="relative">
                <Button variant="ghost" size="icon" aria-label="Notificações" aria-expanded={notificationsOpen} aria-controls="notification-panel" onClick={() => setNotificationsOpen((open) => !open)} className="relative">
                  <Bell />
                  {unreadCount ? <span className="absolute top-1 right-1 flex size-2 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background"><span className="sr-only">{unreadCount} não lidas</span></span> : null}
                </Button>
                {notificationsOpen ? (
                  <div id="notification-panel" className="absolute top-12 right-0 z-30 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
                    <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5"><div><p className="text-sm font-semibold">Notificações</p><p className="mt-0.5 text-xs text-muted-foreground">{activeNotifications.length} atualizações</p></div>{unreadCount ? <Button variant="ghost" size="xs" onClick={() => setNotifications((current) => current.map((item) => ({ ...item, read: true })))}>Marcar lidas</Button> : null}</div>
                    <div className="max-h-80 overflow-y-auto">
                      {activeNotifications.length ? activeNotifications.map((notification) => (
                        <button key={notification.id} type="button" onClick={() => { setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item)); void markNotificationRead(notification.id).catch(() => undefined); setNotificationsOpen(false); if (mode === 'gestor') navigate('solicitacoes'); else navigate('acompanhamento') }} className="flex w-full gap-3 border-b border-border/60 px-4 py-3.5 text-left last:border-b-0 hover:bg-muted/50">
                          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-primary')} />
                          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{notification.description}</span><span className="mt-1.5 block text-[10px] text-muted-foreground">{notification.time}</span></span>
                        </button>
                      )) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>}
                    </div>
                  </div>
                ) : null}
              </div>

              <Separator orientation="vertical" className="hidden h-7 sm:block" />
              <Button variant="ghost" size="icon" aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} className="hidden sm:inline-flex">
                {theme === 'light' ? <Moon /> : <Sun />}
              </Button>
              <button type="button" onClick={() => navigate('perfil')} aria-label="Abrir meu perfil" className="hidden items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-muted sm:flex">
                <CustomerAvatar name={displayName} initials={getInitials(displayName)} className="size-9" />
                <div className="hidden min-w-0 xl:block"><p className="max-w-32 truncate text-xs font-semibold">{displayName}</p><p className="mt-0.5 max-w-32 truncate text-[10px] text-muted-foreground">{displayEmail}</p></div>
              </button>
            </div>
          </header>

          <main id="inicio" className="flex-1 px-4 py-6 sm:px-6 sm:py-7 xl:px-9 xl:py-8">
            <div className="mx-auto w-full max-w-[1500px] animate-in fade-in duration-300">
              {renderContent()}
            </div>
          </main>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-4 text-[11px] text-muted-foreground sm:px-6 xl:px-9">
            <span>JMF Entulhos · Sistema de locação de caçambas</span>
            <span>São Luís · MA</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default JmfAppShell
