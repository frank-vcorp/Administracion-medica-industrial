/**
 * @file Server actions para ejecutar los scripts de migración NOVA → AMI.
 * @id IMPL-20260708-FINAL — Fase 4 NOVA absorción (H Migración).
 * @backup context/SPECs/MIGRATION-NOVA-MAPPING.md
 *
 * Cada action:
 *   1. Valida sesión ADMIN
 *   2. Llama al script Python correspondiente por subprocess
 *   3. Devuelve el reporte JSON parseado o un error
 *
 * Por seguridad:
 *   - Solo rol ADMIN puede ejecutar.
 *   - Timeout 30s para evitar cuelgues.
 *   - Argumentos validados contra whitelist.
 */
"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import path from "node:path";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type MigrationReport = {
  ok: boolean;
  mode?: string;
  applied?: boolean;
  scanned?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
  warnings?: string[];
  destination_counts?: Record<string, number>;
  catalogs?: Record<string, number>;
  medical_tests_laboratorio?: number;
  medical_tests_with_novaClave?: number;
  medical_tests_with_metadata?: number;
  lab_analytes_total?: number;
  lab_analytes_with_ranges?: number;
  blocked?: string[];
  instructions?: string[];
  ts?: string;
  id?: string;
  // dry-run puede devolver campos arbitrarios
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function _ensureAdmin(): Promise<ActionResult<true>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: "No autenticado" };
  }
  if (session.user?.role !== "ADMIN") {
    return { ok: false, error: "Acceso restringido a rol ADMIN" };
  }
  return { ok: true, data: true };
}

async function _runScript(
  scriptName: string,
  args: string[],
  timeoutMs = 30000
): Promise<ActionResult<MigrationReport>> {
  const auth = await _ensureAdmin();
  if (!auth.ok) return auth;

  // Resolver path del script (frontend/../backend/scripts/<name>.py)
  const frontendDir = process.cwd();
  const repoRoot = path.resolve(frontendDir, "..");
  const scriptPath = path.join(repoRoot, "backend", "scripts", scriptName);
  const appDir = path.join(repoRoot, "backend", "app");

  // Comando: PYTHONPATH=<appDir> python3 <scriptPath> <args>
  const env = {
    ...process.env,
    PYTHONPATH: appDir,
  };

  let child: import("child_process").ChildProcess;
  try {
    const { spawn } = await import("node:child_process");
    child = spawn("python3", [scriptPath, ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: repoRoot,
    });
  } catch (e) {
    return {
      ok: false,
      error: `spawn failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve({
        ok: false,
        error: `Script timeout (>${timeoutMs}ms)`,
      });
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: `spawn error: ${err.message}. stderr=${stderr.slice(0, 500)}`,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          error: `Script exited code=${code}. stderr=${stderr.slice(0, 500)}`,
        });
        return;
      }
      // Buscar el último bloque JSON en stdout
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        resolve({
          ok: false,
          error: `Script output no contiene JSON. stdout=${stdout.slice(0, 500)}`,
        });
        return;
      }
      try {
        const parsed = JSON.parse(jsonMatch[0]) as MigrationReport;
        resolve({ ok: true, data: parsed });
      } catch (e) {
        resolve({
          ok: false,
          error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}. Raw=${jsonMatch[0].slice(0, 500)}`,
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Actions públicas
// ---------------------------------------------------------------------------

/** Dry-run: audita sin escribir. */
export async function dryRunMigrationAction(): Promise<MigrationReport> {
  const res = await _runScript("migrate_nova.py", ["--dry-run"]);
  if (!res.ok) {
    return {
      ok: false,
      mode: "dry-run",
      errors: [res.error],
      warnings: [],
    };
  }
  return res.data;
}

/** Apply persistent: sincroniza novaClave + metadatos LIS. */
export async function applyPersistentMigrationAction(): Promise<MigrationReport> {
  const res = await _runScript("sync_nova_metadata.py", ["--apply"]);
  if (!res.ok) {
    return {
      ok: false,
      mode: "apply",
      errors: [res.error],
      warnings: [],
    };
  }
  return res.data;
}

/** Validate: reporte del estado actual. */
export async function validateMigrationAction(): Promise<MigrationReport> {
  const res = await _runScript("validate_migration.py", []);
  if (!res.ok) {
    return {
      ok: false,
      mode: "validate",
      errors: [res.error],
      warnings: [],
    };
  }
  return res.data;
}