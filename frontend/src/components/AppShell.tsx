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
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ReactNode } from 'react'

function NavItem({ href, icon, label, secondary }: { href: string; icon: string; label: string; secondary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 rounded-lg transition-colors ${
        secondary
          ? 'py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white ml-4'
          : 'py-3 text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}

function NavSection({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-2">
      <p className="text-xs uppercase text-slate-500 font-semibold px-2">{label}</p>
    </div>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  // Sin chrome en pantalla de login
  if (pathname?.startsWith('/login')) {
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

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar — FIX REFERENCE: FIX-20260324-01 */}
      <aside className="w-64 bg-slate-900 text-white hidden md:flex md:flex-col flex-shrink-0">
        <div className="p-6 flex-shrink-0">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            Residente Digital
          </h1>
          <p className="text-xs text-slate-400 mt-1">Administración Médica v0.1</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
          {/* Ítems operativos — personal interno */}
          {showStaffItems && (
            <>
              <NavItem href="/dashboard" icon="📊" label="Dashboard" />
              <NavItem href="/workers" icon="👥" label="Trabajadores" />
              <NavItem href="/reception" icon="🏥" label="Piso Clínico" />
              <NavItem href="/appointments" icon="📅" label="Gestión de Citas" />
              {/* Vista de 3 agendas simultáneas como acceso secundario */}
              <NavItem href="/appointments/overview" icon="🗓️" label="Vista 3 Agendas" secondary />

              <NavSection label="Médico" />
              <NavItem href="/events" icon="📁" label="Expedientes Activos" />
              <NavItem href="/validation" icon="✅" label="Validación" />

              <NavSection label="Empresas" />
              <NavItem href="/companies" icon="🏢" label="Empresas Cliente" />
            </>
          )}

          {/* Sección Administración — solo ADMIN */}
          {showAdminItems && (
            <>
              <NavSection label="Administración" />
              <NavItem href="/branches" icon="🏥" label="Sucursales AMI" />
              <NavItem href="/admin/users" icon="👨‍⚕️" label="Personal AMI" />
              <NavItem href="/admin/services" icon="🩺" label="Catálogo Servicios" />
              <NavItem href="/admin/profiles" icon="🩻" label="Perfiles Médicos" />
              <NavItem href="/admin/audit" icon="📋" label="Bitácora de Auditoría" />
            </>
          )}

          {/* Sección B2B — solo COMPANY_CLIENT */}
          {showPortalItems && (
            <>
              <NavSection label="B2B Cliente" />
              <NavItem href="/portal" icon="🌐" label="Portal de Empresas" />
            </>
          )}
        </nav>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shadow-sm">
          <h2 className="text-lg font-medium text-slate-700">Panel de Control</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {session?.user?.fullName || 'Usuario'}
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300"></div>
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
