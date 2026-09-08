/**
 * @fileoverview Shell de aplicación: sidebar y header condicionales según ruta y rol
 * @author SOFIA - Builder
 * @id IMPL-20260324-01
 * @backup context/checkpoints/CHK_IMPL-20260324-01.md
 *
 * Correcciones aplicadas (FIX-20260324-01):
 * - Oculta sidebar/header en /login (usuario no autenticado)
 * - Filtra ítems de navegación según rol (ADMIN, COMPANY_CLIENT, staff)
 * - Expone "Vista 3 Agendas" como entrada secundaria bajo Citas
 * @intervention ARCH-20260327-07
 * @see context/checkpoints/CHK_ARCH-20260327-07-HEADER-MINIMO-WORKSPACE.md
 * @id IMPL-20260527-01
 * @spec context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md
 * @backup context/checkpoints/CHK_IMPL-20260527-01-CALENDARIO-PROYECTOS.md
 * ARCH-20260908-01 — menú blanco, acento púrpura, iconos Lucide
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ReactNode, useEffect, useState, type ComponentType } from 'react'
import {
  Ambulance,
  BadgeCheck,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FlaskConical,
  FolderKanban,
  Globe,
  IdCard,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Menu,
  Microscope,
  RefreshCw,
  ScrollText,
  Settings,
  Stethoscope,
  TestTubes,
  User,
  UserCog,
  UserRoundPen,
  Users,
  X,
  type LucideProps,
} from 'lucide-react'
import { isAdminLike, isSuperAdmin } from '@/lib/auth/roles'
import { BrandLogo } from '@/components/BrandLogo'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'

type Icon = ComponentType<LucideProps>

function NavItem({
  href,
  icon: Icon,
  label,
  secondary,
  collapsed,
  onNavigate,
}: {
  href: string
  icon: Icon
  label: string
  secondary?: boolean
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const hrefPath = href.split('?')[0]
  const isActive = pathname === hrefPath

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={`flex items-center rounded-lg transition-colors ${
        collapsed ? 'justify-center py-2' : `gap-3 px-3 py-1.5 ${secondary ? 'ml-2 text-sm' : ''}`
      } ${
        isActive
          ? 'bg-[#592c82]/10 font-semibold text-[#592c82]'
          : 'text-[#636569] hover:bg-[#592c82]/5 hover:text-[#592c82]'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isActive ? 'bg-[#592c82] text-white' : 'bg-[#592c82]/15 text-[#592c82]'
        }`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}

function NavSection({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div className="mx-3 my-2 border-t border-ami-secondary/10" />
  }

  return (
    <div className="pt-5 pb-1.5">
      <p className="text-[10px] uppercase text-ami-gray/70 font-semibold px-3 tracking-[0.14em]">{label}</p>
    </div>
  )
}

function SidebarAccount({
  fullName,
  collapsed,
  profileHref,
}: {
  fullName?: string | null
  collapsed?: boolean
  profileHref?: string
}) {
  if (collapsed) {
    const account = (
      <div className="px-2 pb-3 pt-2 border-t border-ami-secondary/10">
        <div className="w-10 h-10 mx-auto rounded-xl bg-ami-secondary/10 flex items-center justify-center text-xs font-bold text-ami-secondary">
          {(fullName || 'U').trim().charAt(0).toUpperCase()}
        </div>
      </div>
    )
    return profileHref ? <Link href={profileHref} title="Mi perfil médico">{account}</Link> : account
  }

  const account = (
    <div className="px-4 pb-4 pt-3 border-t border-ami-secondary/10">
      <p className="text-[10px] uppercase tracking-wider text-ami-gray/70 font-semibold">Cuenta</p>
      <div className={`mt-2 flex items-center gap-3 rounded-xl bg-ami-surface border border-ami-secondary/10 px-3 py-2 ${profileHref ? 'hover:border-ami-secondary/25 transition-colors cursor-pointer' : ''}`}>
        <div className="w-9 h-9 rounded-lg bg-ami-secondary/10 text-ami-secondary flex items-center justify-center text-sm font-bold shrink-0">
          {(fullName || 'U').trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ami-secondary truncate">{fullName || 'Usuario'}</p>
          <p className="text-xs text-ami-gray">Sesión activa</p>
        </div>
      </div>
    </div>
  )
  return profileHref ? <Link href={profileHref} aria-label="Abrir mi perfil médico">{account}</Link> : account
}

function ShellNavigation({
  collapsed,
  showStaffItems,
  showAdminItems,
  showPortalItems,
  role,
  onNavigate,
}: {
  collapsed?: boolean
  showStaffItems: boolean
  showAdminItems: boolean
  showPortalItems: boolean
  role?: string
  onNavigate?: () => void
}) {
  return (
    <>
      {showStaffItems && (
        <>
          <NavItem href="/appointments" icon={Calendar} label="Gestión de citas" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/appointments/overview" icon={CalendarDays} label="Vista 3 Agendas" secondary collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/workers" icon={Users} label="Listado de pacientes" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/publico-general" icon={User} label="Público General" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/reception" icon={Stethoscope} label="Proceso de atención clínica" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Agenda" collapsed={collapsed} onNavigate={onNavigate} />

          <NavSection label="Médico" collapsed={collapsed} />
          <NavItem href="/validation" icon={BadgeCheck} label="Validación" collapsed={collapsed} onNavigate={onNavigate} />
          {(role === 'SUPERADMIN' || role === 'DOCTOR_GENERAL' || role === 'DOCTOR_VALIDATOR') && (
            <NavItem href="/profile" icon={UserRoundPen} label="Mi perfil médico" collapsed={collapsed} onNavigate={onNavigate} />
          )}

          <NavSection label="Empresas" collapsed={collapsed} />
          <NavItem href="/companies" icon={Building2} label="Empresas Cliente" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/projects" icon={FolderKanban} label="Proyectos" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/operations/mobile-units" icon={Ambulance} label="Unidades Móviles" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/reports" icon={FileBarChart} label="Reportes Masivos" collapsed={collapsed} onNavigate={onNavigate} />
        </>
      )}

      {showAdminItems && (
        <>
          <NavSection label="Administración" collapsed={collapsed} />
          <NavItem href="/branches" icon={MapPin} label="Sucursales AMI" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/users" icon={UserCog} label="Personal AMI" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/services" icon={FlaskConical} label="Catálogo de Pruebas" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/lab/catalogs?mod=unidades" icon={TestTubes} label="Módulo de Laboratorios" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/lab/migration" icon={RefreshCw} label="Migración NOVA" secondary collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/lab/cutover" icon={ClipboardList} label="Cutover NOVA" secondary collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/lab/reception" icon={Microscope} label="Recepción Lab" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/profiles" icon={IdCard} label="Perfiles Médicos" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/audit" icon={ScrollText} label="Bitácora de Auditoría" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/settings" icon={Settings} label="Configuración" collapsed={collapsed} onNavigate={onNavigate} />
          {isSuperAdmin(role) && (
            <NavItem href="/admin/ai-keys" icon={KeyRound} label="API Keys IA" collapsed={collapsed} onNavigate={onNavigate} />
          )}
        </>
      )}

      {showPortalItems && (
        <>
          <NavSection label="B2B Cliente" collapsed={collapsed} />
          <NavItem href="/portal" icon={Globe} label="Portal de Empresas" collapsed={collapsed} onNavigate={onNavigate} />
        </>
      )}
    </>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const isChromeFreePage =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/demo') ||
    pathname?.startsWith('/solicitar-alta') ||
    pathname?.startsWith('/auto-alta') ||
    pathname?.startsWith('/feedback')
  if (isChromeFreePage) {
    return <>{children}</>
  }

  const role = session?.user?.role
  const isLoading = status === 'loading'
  const isAdmin = isAdminLike(role)
  const isCompanyClient = role === 'COMPANY_CLIENT'
  const showStaffItems = isLoading || (!isCompanyClient && !!role)
  const showAdminItems = isAdmin
  const showPortalItems = isCompanyClient
  const showGlobalSearch = showStaffItems && !isCompanyClient
  const canEditProfile = role === 'SUPERADMIN' || role === 'DOCTOR_GENERAL' || role === 'DOCTOR_VALIDATOR'
  const isEventWorkspace = /^\/events\/[^/]+$/.test(pathname || '')
  const handleSignOut = () => {
    void signOut({ callbackUrl: '/login' })
  }
  const closeMobileNav = () => setMobileNavOpen(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileNavOpen])

  return (
    <div className="flex h-screen bg-ami-surface">
      <aside className={`${isEventWorkspace ? 'w-20' : 'w-64'} hidden md:flex md:flex-col flex-shrink-0 bg-white text-[#636569] border-l-[3px] border-l-[#592c82] border-r border-r-[#f0f0f0] transition-all duration-200`}>
        <div className={`border-b border-ami-secondary/10 ${isEventWorkspace ? 'p-4' : 'px-5 py-5'} flex-shrink-0`}>
          {isEventWorkspace ? (
            <BrandLogo collapsed className="mx-auto" />
          ) : (
            <>
              <BrandLogo className="mb-3 max-h-12 w-auto" />
              <h1 className="text-base font-semibold text-ami-secondary leading-tight">
                Residente Digital
              </h1>
              <p className="text-xs text-ami-gray mt-0.5">AMI Salud Responsable</p>
            </>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto ${isEventWorkspace ? 'px-2' : 'px-3'} py-3 space-y-0.5`}>
          <ShellNavigation
            collapsed={isEventWorkspace}
            showStaffItems={showStaffItems}
            showAdminItems={showAdminItems}
            showPortalItems={showPortalItems}
            role={role}
          />
        </nav>

        <SidebarAccount
          fullName={session?.user?.fullName}
          collapsed={isEventWorkspace}
          profileHref={canEditProfile ? '/profile' : undefined}
        />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-ami-secondary/40"
            onClick={closeMobileNav}
          />
          <aside className="relative z-10 flex h-full w-[min(100%,20rem)] flex-col bg-white text-[#636569] shadow-2xl border-l-[3px] border-l-[#592c82]">
            <div className="flex items-center justify-between border-b border-ami-secondary/10 p-4">
              <div>
                <BrandLogo className="mb-2 max-h-10 w-auto" />
                <p className="text-sm font-semibold text-ami-secondary">Residente Digital</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú de navegación"
                onClick={closeMobileNav}
                className="rounded-lg p-2 text-ami-secondary hover:bg-ami-secondary/5"
              >
                <X className="h-5 w-5 stroke-[1.5]" />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
              <ShellNavigation
                showStaffItems={showStaffItems}
                showAdminItems={showAdminItems}
                showPortalItems={showPortalItems}
                role={role}
                onNavigate={closeMobileNav}
              />
            </nav>

            <div className="border-t border-ami-secondary/10 p-4 space-y-3">
              <SidebarAccount
                fullName={session?.user?.fullName}
                profileHref={canEditProfile ? '/profile' : undefined}
              />
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-full border border-ami-secondary/20 px-4 py-2.5 text-sm font-medium text-ami-secondary hover:bg-ami-secondary/5"
              >
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-ami-secondary/15 bg-white px-4 md:hidden">
          <button
            type="button"
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-ami-secondary hover:bg-ami-secondary/5"
          >
            <Menu className="h-5 w-5 stroke-[1.5]" />
          </button>
          <BrandLogo className="max-h-8 w-auto" />
          <span className="w-10" aria-hidden="true" />
        </header>

        {!isEventWorkspace && (
          <header className="hidden h-16 flex-shrink-0 items-center justify-between border-b-[3px] border-b-[#00afaa] bg-white px-8 md:flex">
            <div>
              <h2 className="text-lg font-semibold text-ami-secondary">Panel de Control</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-ami-gray">
                {session?.user?.fullName || 'Usuario'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ami-secondary/10 text-xs font-bold text-ami-secondary">
                {(session?.user?.fullName || 'U').trim().charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-medium text-ami-secondary hover:text-ami-primary transition-colors px-4 py-1.5 rounded-full border border-ami-secondary/15 hover:border-ami-secondary/40"
                aria-label="Cerrar sesión"
              >
                Cerrar sesión
              </button>
            </div>
          </header>
        )}
        <div className={`flex-1 overflow-y-auto ${isEventWorkspace ? 'p-3 md:p-4' : 'p-4 md:p-8'}`}>
          {children}
        </div>
        {showGlobalSearch && <GlobalSearchLauncher />}
      </main>
    </div>
  )
}
