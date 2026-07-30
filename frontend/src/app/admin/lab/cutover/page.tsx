/**
 * @file Página admin con checklist del cutover NOVA → AMI.
 * @id IMPL-20260708-FINAL — Fase 4 NOVA absorción (I Cutover y deprecación).
 * @backup context/SPECs/MIGRATION-NOVA-MAPPING.md
 *
 * Server component que llama a /api/v1/lab/cutover-status y delega el
 * render al client component CutoverChecklist.
 */
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { isAdminLike } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import CutoverChecklist from "./_components/CutoverChecklist";

export const dynamic = "force-dynamic";

type SliceStatus = "closed" | "partial" | "in_progress" | "pending";

type CutoverStatus = {
  ready: boolean;
  slices: Record<string, SliceStatus>;
  completed: string[];
  pending: string[];
  nova_deprecated: boolean;
  next_actions: string[];
};

async function fetchCutoverStatus(): Promise<CutoverStatus | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000";
  try {
    const res = await fetch(`${baseUrl}/api/v1/lab/cutover-status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CutoverStatus;
  } catch {
    return null;
  }
}

export default async function LabCutoverPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/admin/lab/cutover");
  }
  if (!isAdminLike(session.user?.role)) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-300 text-red-900 rounded-lg p-6">
          <h2 className="font-semibold mb-2">Acceso restringido</h2>
          <p className="text-sm">
            El checklist de cutover es exclusivo para rol ADMIN.
          </p>
        </div>
      </div>
    );
  }

  const status = await fetchCutoverStatus();
  if (!status) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-6">
          <h2 className="font-semibold mb-2">Backend no disponible</h2>
          <p className="text-sm">
            No se pudo contactar <code>/api/v1/lab/cutover-status</code>.
            Verifica que el backend FastAPI esté corriendo.
          </p>
        </div>
      </div>
    );
  }

  return <CutoverChecklist status={status} />;
}