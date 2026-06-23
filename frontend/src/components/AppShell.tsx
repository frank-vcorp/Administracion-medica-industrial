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
import { useSession } from 'next-auth/react'
import { ReactNode } from 'react'

function NavItem({ href, icon, label, secondary, collapsed }: { href: string; icon: string; label: string; secondary?: boolean; collapsed?: boolean }) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
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
}: {
  fullName?: string | null
  collapsed?: boolean
}) {
  if (collapsed) {
    return (
      <div className="px-2 pb-3 pt-2 border-t border-slate-800">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
          {(fullName || 'U').trim().charAt(0).toUpperCase()}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-3 border-t border-slate-800">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Cuenta</p>
      <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2">
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
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  // Sin chrome en pantalla de login y en rutas /demo (datos estáticos, sin AMI chrome)
  // IMPL-20260623-02: bypass también para /demo/* (demo navegable público)
  const isChromeFreePage = pathname?.startsWith('/login') || pathname?.startsWith('/demo')
  if (isChromeFreePage) {
    return <>{children}</>
  }

  const role = session?.user?.role
  const isLoading = status === 'loading'
  const isAdmin = role === 'ADMIN'
  const isCompanyClient = role === 'COMPANY_CLIENT'
  // Mostrar ítems de staff si se está cargando (middleware ya validó autenticación)
  // o si el usuario es staff interno (no COMPANY_CLIENT)
  const showStaffItems = isLoading || (!isCompanyClient && !!role)
  const showAdminItems = isAdmin
  const showPortalItems = isCompanyClient
  const isEventWorkspace = /^\/events\/[^/]+$/.test(pathname || '')

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar — FIX REFERENCE: FIX-20260324-01 */}
      <aside className={`${isEventWorkspace ? 'w-20' : 'w-64'} bg-slate-900 text-white hidden md:flex md:flex-col flex-shrink-0 transition-all duration-200`}>
        <div className={`${isEventWorkspace ? 'p-4' : 'p-6'} flex-shrink-0`}>
          {isEventWorkspace ? (
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-xl font-bold">
              AMI
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                Residente Digital
              </h1>
              <p className="text-xs text-slate-400 mt-1">Administración Médica v0.1</p>
            </>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto ${isEventWorkspace ? 'px-2' : 'px-4'} pb-6 space-y-1`}>
          {/* Ítems operativos — personal interno */}
          {showStaffItems && (
            <>
              <NavItem href="/dashboard" icon="📊" label="Dashboard" collapsed={isEventWorkspace} />
              <NavItem href="/workers" icon="👥" label="Trabajadores" collapsed={isEventWorkspace} />
              <NavItem href="/reception" icon="🏥" label="Piso Clínico" collapsed={isEventWorkspace} />
              <NavItem href="/appointments" icon="📅" label="Gestión de Citas" collapsed={isEventWorkspace} />
              {/* Vista de 3 agendas simultáneas como acceso secundario */}
              <NavItem href="/appointments/overview" icon="🗓️" label="Vista 3 Agendas" secondary collapsed={isEventWorkspace} />

              <NavSection label="Médico" collapsed={isEventWorkspace} />
              <NavItem href="/events" icon="📁" label="Expedientes Activos" collapsed={isEventWorkspace} />
              <NavItem href="/validation" icon="✅" label="Validación" collapsed={isEventWorkspace} />

              <NavSection label="Empresas" collapsed={isEventWorkspace} />
              <NavItem href="/companies" icon="🏢" label="Empresas Cliente" collapsed={isEventWorkspace} />
              <NavItem href="/projects" icon="🗂️" label="Proyectos" collapsed={isEventWorkspace} />
            </>
          )}

          {/* Sección Administración — solo ADMIN */}
          {showAdminItems && (
            <>
              <NavSection label="Administración" collapsed={isEventWorkspace} />
              <NavItem href="/branches" icon="🏥" label="Sucursales AMI" collapsed={isEventWorkspace} />
              <NavItem href="/admin/users" icon="👨‍⚕️" label="Personal AMI" collapsed={isEventWorkspace} />
              <NavItem href="/admin/services" icon="🧪" label="Catálogo de Pruebas" collapsed={isEventWorkspace} />
              <NavItem href="/admin/profiles" icon="🩻" label="Perfiles Médicos" collapsed={isEventWorkspace} />
              <NavItem href="/admin/audit" icon="📋" label="Bitácora de Auditoría" collapsed={isEventWorkspace} />
            </>
          )}

          {/* Sección B2B — solo COMPANY_CLIENT */}
          {showPortalItems && (
            <>
              <NavSection label="B2B Cliente" collapsed={isEventWorkspace} />
              <NavItem href="/portal" icon="🌐" label="Portal de Empresas" collapsed={isEventWorkspace} />
            </>
          )}
        </nav>

        <SidebarAccount fullName={session?.user?.fullName} collapsed={isEventWorkspace} />
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        {!isEventWorkspace && (
          <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shadow-sm">
            <div>
              <h2 className="text-lg font-medium text-slate-700">Panel de Control</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                {session?.user?.fullName || 'Usuario'}
              </span>
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300"></div>
            </div>
          </header>
        )}
        <div className={isEventWorkspace ? 'p-3 md:p-4' : 'p-8'}>
          {children}
        </div>
      </main>
    </div>
  )
}
