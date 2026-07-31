/**
 * @file CompanyBulkDeleteShell — wrapper client que combina grid seleccionable
 *        y barra inferior de eliminación masiva.
 * @id IMPL-20260730-01 (retry)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-DELETE-COMPANIES-SUPERADMIN.md
 *
 * Mantiene el estado de selección (Set de ids) compartido entre
 * CompanySelectableTable y DeleteCompaniesButton. Se monta sólo si
 * `canDelete` es true (rol SUPERADMIN). Para otros roles, este shell
 * no se renderiza y el padre renderiza la tabla estática plana.
 *
 * Server-component padre (/companies/page.tsx) pasa la lista de empresas
 * saneada y la decisión de rol.
 */
'use client'

import { useCallback, useState } from 'react'
import CompanySelectableTable, {
  type SelectableCompany,
} from '@/components/companies/CompanySelectableTable'
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
      <CompanySelectableTable
        companies={companies}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
      />
      <DeleteCompaniesButton selectedNames={selectedNames} onClearSelection={clearSelection} />
    </>
  )
}