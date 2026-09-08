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
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ReactNode, useEffect, useState } from 'react'
import { isAdminLike, isSuperAdmin } from '@/lib/auth/roles'
import { BrandLogo } from '@/components/BrandLogo'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'

function NavItem({
  href,
  icon,
  label,
  secondary,
  collapsed,
  onNavigate,
}: {
  href: string
  icon: string
  label: string
  secondary?: boolean
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const hrefPath = href.split('?')[0]
  const isActive = pathname === hrefPath

  const pad = collapsed ? 'py-3' : secondary ? 'py-2 ml-4' : 'py-3'
  const inactive = secondary
    ? `${collapsed ? 'py-2' : 'py-2 text-sm ml-4'} text-white/70 hover:bg-white/10 hover:text-white`
    : 'py-3 text-white/80 hover:bg-white/10 hover:text-white'

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-4'} rounded-xl transition-colors ${
        isActive ? `${pad} bg-ami-primary text-white` : inactive
      }`}
    >
      <span>{icon}</span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  )
}

function NavSection({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div className="mx-3 my-2 border-t border-white/15" />
  }

  return (
    <div className="pt-4 pb-2">
      <p className="text-xs uppercase text-white/50 font-semibold px-2 tracking-wider">{label}</p>
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
      <div className="px-2 pb-3 pt-2 border-t border-white/15">
        <div className="w-10 h-10 mx-auto rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white">
          {(fullName || 'U').trim().charAt(0).toUpperCase()}
        </div>
      </div>
    )
    return profileHref ? <Link href={profileHref} title="Mi perfil médico">{account}</Link> : account
  }

  const account = (
    <div className="px-4 pb-4 pt-3 border-t border-white/15">
      <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Cuenta</p>
      <div className={`mt-2 flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 px-3 py-2 ${profileHref ? 'hover:bg-white/15 transition-colors cursor-pointer' : ''}`}>
        <div className="w-9 h-9 rounded-lg bg-ami-accent text-ami-secondary flex items-center justify-center text-sm font-bold shrink-0">
          {(fullName || 'U').trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{fullName || 'Usuario'}</p>
          <p className="text-xs text-white/60">Sesión activa</p>
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
          <NavItem href="/appointments" icon="📅" label="Gestión de citas" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/appointments/overview" icon="🗓️" label="Vista 3 Agendas" secondary collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/workers" icon="👥" label="Listado de pacientes" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/publico-general" icon="🧍" label="Público General" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/reception" icon="🏥" label="Proceso de atención clínica" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/dashboard" icon="📊" label="Agenda" collapsed={collapsed} onNavigate={onNavigate} />

          <NavSection label="Médico" collapsed={collapsed} />
          <NavItem href="/validation" icon="✅" label="Validación" collapsed={collapsed} onNavigate={onNavigate} />
          {(role === 'SUPERADMIN' || role === 'DOCTOR_GENERAL' || role === 'DOCTOR_VALIDATOR') && (
            <NavItem href="/profile" icon="🖋️" label="Mi perfil médico" collapsed={collapsed} onNavigate={onNavigate} />
          )}

          <NavSection label="Empresas" collapsed={collapsed} />
          <NavItem href="/companies" icon="🏢" label="Empresas Cliente" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/projects" icon="🗂️" label="Proyectos" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/operations/mobile-units" icon="🚑" label="Unidades Móviles" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/reports" icon="📊" label="Reportes Masivos" collapsed={collapsed} onNavigate={onNavigate} />
        </>
      )}

      {showAdminItems && (
        <>
          <NavSection label="Administración" collapsed={collapsed} />
          <NavItem href="/branches" icon="🏥" label="Sucursales AMI" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/users" icon="👨‍⚕️" label="Personal AMI" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/services" icon="🧪" label="Catálogo de Pruebas" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/lab/catalogs?mod=unidades" icon="🧬" label="Módulo de Laboratorios" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/lab/migration" icon="🔄" label="Migración NOVA" secondary collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/lab/cutover" icon="🚦" label="Cutover NOVA" secondary collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/lab/reception" icon="🧪" label="Recepción Lab" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/profiles" icon="🩻" label="Perfiles Médicos" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/audit" icon="📋" label="Bitácora de Auditoría" collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem href="/admin/settings" icon="⚙️" label="Configuración" collapsed={collapsed} onNavigate={onNavigate} />
          {isSuperAdmin(role) && (
            <NavItem href="/admin/ai-keys" icon="🔑" label="API Keys IA" collapsed={collapsed} onNavigate={onNavigate} />
          )}
        </>
      )}

      {showPortalItems && (
        <>
          <NavSection label="B2B Cliente" collapsed={collapsed} />
          <NavItem href="/portal" icon="🌐" label="Portal de Empresas" collapsed={collapsed} onNavigate={onNavigate} />
        </>
      )}
    </>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Sin chrome en pantalla de login y en rutas públicas (sin AMI chrome)
  // IMPL-20260623-02: bypass también para /demo/* (demo navegable público)
  // FIX-20260805-01: bypass también para /solicitar-alta y /auto-alta/* (portales
  // públicos de auto-registro; un prospecto no debe ver sidebar admin ni "Cerrar sesión").
  // NOTA: Esta lista DEBE mantenerse sincronizada con la lista isPublicRoute de
  // middleware.ts:30. Considerar extraer a constante compartida (FIX-20260805-02).
  const isChromeFreePage =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/demo') ||
    pathname?.startsWith('/solicitar-alta') ||
    pathname?.startsWith('/auto-alta')
  if (isChromeFreePage) {
    return <>{children}</>
  }

  const role = session?.user?.role
  const isLoading = status === 'loading'
  const isAdmin = isAdminLike(role)
  const isCompanyClient = role === 'COMPANY_CLIENT'
  // Mostrar ítems de staff si se está cargando (middleware ya validó autenticación)
  // o si el usuario es staff interno (no COMPANY_CLIENT)
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
      {/* Sidebar desktop — púrpura institucional AMI */}
      <aside className={`${isEventWorkspace ? 'w-20' : 'w-64'} bg-ami-secondary text-white hidden md:flex md:flex-col flex-shrink-0 transition-all duration-200`}>
        <div className={`${isEventWorkspace ? 'p-4' : 'p-6'} flex-shrink-0`}>
          {isEventWorkspace ? (
            <BrandLogo collapsed className="mx-auto" />
          ) : (
            <>
              <div className="mb-3 rounded-2xl bg-white p-2">
                <BrandLogo className="max-h-12 w-auto" />
              </div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Residente Digital
              </h1>
              <p className="text-xs text-white/60 mt-1">AMI Salud Responsable</p>
            </>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto ${isEventWorkspace ? 'px-2' : 'px-4'} pb-6 space-y-1`}>
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

      {/* Drawer móvil */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-ami-secondary-hover/70"
            onClick={closeMobileNav}
          />
          <aside className="relative z-10 flex h-full w-[min(100%,20rem)] flex-col bg-ami-secondary text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 p-4">
              <div>
                <div className="mb-2 rounded-xl bg-white p-2">
                  <BrandLogo className="max-h-10 w-auto" />
                </div>
                <p className="text-sm font-bold text-white">Residente Digital</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú de navegación"
                onClick={closeMobileNav}
                className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
              <ShellNavigation
                showStaffItems={showStaffItems}
                showAdminItems={showAdminItems}
                showPortalItems={showPortalItems}
                role={role}
                onNavigate={closeMobileNav}
              />
            </nav>

            <div className="border-t border-white/15 p-4 space-y-3">
              <SidebarAccount
                fullName={session?.user?.fullName}
                profileHref={canEditProfile ? '/profile' : undefined}
              />
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Contenido principal */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra superior móvil — hamburguesa + logo */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b-2 border-ami-secondary bg-white px-4 md:hidden">
          <button
            type="button"
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg bg-ami-accent p-2 text-ami-secondary hover:bg-ami-accent-hover"
          >
            <span className="text-xl leading-none">☰</span>
          </button>
          <BrandLogo className="max-h-8 w-auto" />
          <span className="w-10" aria-hidden="true" />
        </header>

        {!isEventWorkspace && (
          <header className="hidden h-16 flex-shrink-0 items-center justify-between border-t-2 border-t-ami-secondary border-b-[6px] border-b-ami-primary bg-white px-8 md:flex">
            <div>
              <h2 className="text-lg font-semibold text-ami-secondary">Panel de Control</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-ami-gray">
                {session?.user?.fullName || 'Usuario'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ami-accent text-xs font-bold text-ami-secondary">
                {(session?.user?.fullName || 'U').trim().charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-semibold text-ami-secondary hover:text-ami-primary transition-colors px-4 py-1.5 rounded-full border border-ami-secondary/20 hover:border-ami-primary"
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
