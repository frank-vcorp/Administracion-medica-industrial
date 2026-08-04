/**
 * Tipos compartidos para el calendario de mantenimiento y su vinculación con proyectos.
 * @id ARCH-20260804-03 — tipos aditivos para superposición proyecto↔mantenimiento.
 */
import type { ProjectStatus, MaintenanceStatus, MaintenanceType } from '@prisma/client'

/** Subconjunto de Project que retorna `getProjectsByMobileUnit`. */
export interface UnitProjectItem {
  id: string
  name: string
  status: ProjectStatus
  startDate: Date | string
  endDate: Date | string
  companyId: string | null
  company: { id: string; name: string } | null
  branchId: string | null
  unitRef: string | null
  mobileUnitId?: string | null
  _count: { workers: number }
}

/** Subconjunto de MaintenanceRecord que retorna `getMaintenancesByUnitIds`. */
export interface UnitMaintenanceItem {
  id: string
  mobileUnitId: string
  type: MaintenanceType
  status: MaintenanceStatus
  scheduledDate: Date | string
  technician: string | null
}

/** Conflicto visual proyecto↔mantenimiento detectado client-side. */
export interface CalendarConflict {
  dateISO: string
  unitId: string
  projectId: string
  projectName: string
  maintenanceId: string
  maintenanceType: MaintenanceType
}