/**
 * @file Banner persistente que indica que NOVA Connection está deprecado.
 * @id IMPL-20260708-FINAL — Fase 4 NOVA absorción (I Cutover y deprecación).
 * @backup context/SPECs/MIGRATION-NOVA-MAPPING.md
 *
 * Aparece en /admin/lab/* y /lab/* cuando el endpoint
 * /api/v1/lab/cutover-status reporta `nova_deprecated: true` o `slices.H = partial`.
 *
 * Server component: lee el status en SSR (sin parpadeo de hidratación).
 * Si el endpoint falla (network down, backend en mantenimiento), el banner
 * NO se muestra para no spamear al operador.
 *
 * Uso:
 *   import NOVAIsDeprecatedBanner from "@/components/NOVAIsDeprecatedBanner";
 *   <NOVAIsDeprecatedBanner />  // en /admin/lab/* o /lab/* layout
 */
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type CutoverStatus = {
  ready: boolean;
  slices: Record<string, "closed" | "partial" | "in_progress" | "pending">;
  nova_deprecated: boolean;
};

async function fetchCutoverStatus(baseUrl: string): Promise<CutoverStatus | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/lab/cutover-status`, {
      cache: "no-store",
      // Timeout corto para no bloquear el render
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CutoverStatus;
  } catch {
    return null;
  }
}

export default async function NOVAIsDeprecatedBanner() {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  // Preferir variable de entorno pública para evitar problemas de proxy
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    `${proto}://${host}`;

  const status = await fetchCutoverStatus(baseUrl);
  // Si no pudimos contactar el backend, no mostramos nada
  if (!status) return null;

  // Mostrar el banner si NOVA está deprecado O si todavía hay slices pendientes
  if (!status.nova_deprecated && status.ready) return null;

  const pending = Object.entries(status.slices)
    .filter(([, v]) => v !== "closed")
    .map(([k]) => k);

  const isFullyDeprecated = status.nova_deprecated;
  const tone = isFullyDeprecated
    ? "bg-amber-100 border-amber-300 text-amber-900"
    : "bg-sky-50 border-sky-300 text-sky-900";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${tone} border-b px-4 py-2 text-sm flex items-center justify-between gap-4`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{isFullyDeprecated ? "⚠️" : "ℹ️"}</span>
        <span>
          <strong>NOVA Connection deprecado</strong>
          {isFullyDeprecated
            ? " — sistema único: AMI. Las órdenes se capturan 100% en AMI."
            : ` — sistema único: AMI. Slices pendientes: ${pending.join(", ")}.`}
        </span>
      </div>
      <a
        href="/admin/lab/cutover"
        className="text-xs underline hover:no-underline whitespace-nowrap"
      >
        Ver checklist de cutover →
      </a>
    </div>
  );
}