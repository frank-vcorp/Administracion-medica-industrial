/**
 * @file Banner informativo neutro (estilo AMI).
 * @id IMPL-20260706-02
 *
 * Reemplaza los banners amarillos "demo" del módulo LAB para mantener
 * consistencia visual con el resto del admin AMI (Catálogo de Pruebas,
 * Usuarios, Auditoría, etc. — usan paleta slate).
 *
 * Variantes:
 *   - "info"   → fondo slate-50 + borde slate-200 + texto slate-700 (default)
 *   - "warn"   → fondo amber-50 + borde amber-200 + texto amber-900 (uso medido)
 *   - "error"  → fondo red-50 + borde red-200 + texto red-700
 *   - "success"→ fondo emerald-50 + borde emerald-200 + texto emerald-700
 */
import type { ReactNode } from "react";

type Variant = "info" | "warn" | "error" | "success";

const VARIANT_STYLES: Record<Variant, string> = {
  info: "bg-slate-50 border-slate-200 text-slate-700",
  warn: "bg-amber-50 border-amber-200 text-amber-900",
  error: "bg-red-50 border-red-200 text-red-700",
  success: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

export interface InfoBannerProps {
  variant?: Variant;
  title?: string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function InfoBanner({
  variant = "info",
  title,
  icon,
  className = "",
  children,
}: InfoBannerProps) {
  const base =
    "rounded-lg border px-4 py-3 flex items-start gap-3 text-sm";
  const palette = VARIANT_STYLES[variant];

  return (
    <div className={`${base} ${palette} ${className}`.trim()}>
      {icon && <span className="text-base leading-5 flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export default InfoBanner;