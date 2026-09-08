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
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-4'} rounded-lg transition-colors ${
        secondary
          ? `${collapsed ? 'py-2 text-slate-400 hover:bg-slate-800 hover:text-white' : 'py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white ml-4'}`
          : 'py-3 text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span>{icon}</span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  )
}

function NavSection({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div className="mx-3 my-2 border-t border-slate-800" />
  }

  return (
    <div className="pt-4 pb-2">
      <p className="text-xs uppercase text-slate-500 font-semibold px-2">{label}</p>
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
      <div className="px-2 pb-3 pt-2 border-t border-slate-800">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
          {(fullName || 'U').trim().charAt(0).toUpperCase()}
        </div>
      </div>
    )
    return profileHref ? <Link href={profileHref} title="Mi perfil médico">{account}</Link> : account
  }

  const account = (
    <div className="px-4 pb-4 pt-3 border-t border-slate-800">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Cuenta</p>
      <div className={`mt-2 flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 ${profileHref ? 'hover:bg-slate-700 transition-colors cursor-pointer' : ''}`}>
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-200 shrink-0">
          {(fullName || 'U').trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{fullName || 'Usuario'}</p>
          <p className="text-xs text-slate-400">Sesión activa</p>
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
          <NavItem href="/events" icon="📁" label="Expedientes Activos" collapsed={collapsed} onNavigate={onNavigate} />
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
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar desktop — oculto en móvil (< md) */}
      <aside className={`${isEventWorkspace ? 'w-20' : 'w-64'} bg-slate-900 text-white hidden md:flex md:flex-col flex-shrink-0 transition-all duration-200`}>
        <div className={`${isEventWorkspace ? 'p-4' : 'p-6'} flex-shrink-0`}>
          {isEventWorkspace ? (
            <BrandLogo collapsed className="mx-auto" />
          ) : (
            <>
              <BrandLogo className="mb-3 max-h-12 w-auto" />
              <h1 className="text-lg font-bold text-slate-100 leading-tight">
                Residente Digital
              </h1>
              <p className="text-xs text-slate-400 mt-1">Administración Médica v0.1</p>
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
            className="absolute inset-0 bg-slate-950/60"
            onClick={closeMobileNav}
          />
          <aside className="relative z-10 flex h-full w-[min(100%,20rem)] flex-col bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div>
                <BrandLogo className="mb-2 max-h-10 w-auto" />
                <p className="text-sm font-bold text-slate-100">Residente Digital</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú de navegación"
                onClick={closeMobileNav}
                className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
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

            <div className="border-t border-slate-800 p-4 space-y-3">
              <SidebarAccount
                fullName={session?.user?.fullName}
                profileHref={canEditProfile ? '/profile' : undefined}
              />
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
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
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:hidden">
          <button
            type="button"
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <span className="text-xl leading-none">☰</span>
          </button>
          <BrandLogo className="max-h-8 w-auto" />
          <span className="w-10" aria-hidden="true" />
        </header>

        {!isEventWorkspace && (
          <header className="hidden h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm md:flex">
            <div>
              <h2 className="text-lg font-medium text-slate-700">Panel de Control</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                {session?.user?.fullName || 'Usuario'}
              </span>
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300"></div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors px-3 py-1.5 rounded-md border border-slate-200 hover:border-red-200"
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
      </main>
    </div>
  )
}
