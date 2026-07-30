/**
 * @file Página admin para ejecutar el runner de migración NOVA → AMI.
 * @id IMPL-20260708-FINAL — Fase 4 NOVA absorción (H Migración).
 * @backup context/SPECs/MIGRATION-NOVA-MAPPING.md
 *
 * Server component que delega el render al client component MigrationRunner.
 * Solo accesible para ADMIN.
 */
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { isAdminLike } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import MigrationRunner from "./_components/MigrationRunner";

export const dynamic = "force-dynamic";

export default async function LabMigrationPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/admin/lab/migration");
  }
  if (!isAdminLike(session.user?.role)) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-300 text-red-900 rounded-lg p-6">
          <h2 className="font-semibold mb-2">Acceso restringido</h2>
          <p className="text-sm">
            La página de migración NOVA → AMI es exclusiva para rol ADMIN.
            Tu rol actual: <code>{String(session.user?.role || "?")}</code>.
          </p>
        </div>
      </div>
    );
  }
  return <MigrationRunner />;
}