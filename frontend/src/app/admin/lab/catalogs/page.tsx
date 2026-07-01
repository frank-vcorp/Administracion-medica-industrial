/**
 * @file Página principal del módulo de catálogos LIS (Slice A).
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * Server Component: lee `?mod=` desde searchParams (Next.js 16+ requiere await).
 * Si el mod no es válido, redirige a `?mod=unidades` (render defensivo).
 */
import { redirect } from "next/navigation";
import LabCatalogClient from "./_components/CatalogClient";
import { resolveLabMod } from "@/lib/validations/lab-catalog";

export const dynamic = "force-dynamic";

export default async function LabCatalogsPage({
  searchParams,
}: {
  searchParams: Promise<{ mod?: string }>;
}) {
  const { mod } = await searchParams;
  const resolved = resolveLabMod(mod);
  if (mod && mod !== resolved) {
    // Mod inválido → redirect a la URL canónica (alineado con SPEC §6.2)
    redirect(`/admin/lab/catalogs?mod=${resolved}`);
  }
  return <LabCatalogClient initialMod={resolved} />;
}