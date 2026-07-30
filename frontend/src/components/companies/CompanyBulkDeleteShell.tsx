/**
 * @file CompanyBulkDeleteShell — wrapper client que combina grid seleccionable
 *        y barra inferior de eliminación masiva.
 * @id IMPL-20260730-01 (retry)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-DELETE-COMPANIES-SUPERADMIN.md
 *
 * Mantiene el estado de selección (Set de ids) compartido entre
 * CompanySelectableGrid y DeleteCompaniesButton. Se monta sólo si
 * `selectable` es true (rol SUPERADMIN). Para otros roles, este shell
 * no se renderiza y el padre renderiza el grid estático legacy.
 *
 * Server-component padre (/companies/page.tsx) pasa la lista de empresas
 * saneada y la decisión de rol.
 */
'use client'

import { useCallback, useState } from 'react'
import CompanySelectableGrid, {
  type SelectableCompany,
} from '@/components/companies/CompanySelectableGrid'
import DeleteCompaniesButton from '@/components/companies/DeleteCompaniesButton'

interface Props {
  companies: SelectableCompany[]
}

export default function CompanyBulkDeleteShell({ companies }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedNames, setSelectedNames] = useState<
    Array<{ id: string; name: string; rfc: string }>
  >([])

  const onSelectionChange = useCallback(
    (next: Set<string>, meta: { selectedNames: Array<{ id: string; name: string; rfc: string }> }) => {
      setSelectedIds(next)
      setSelectedNames(meta.selectedNames)
    },
    []
  )

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectedNames([])
  }, [])

  return (
    <>
      <CompanySelectableGrid
        companies={companies}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
      />
      <DeleteCompaniesButton selectedNames={selectedNames} onClearSelection={clearSelection} />
    </>
  )
}