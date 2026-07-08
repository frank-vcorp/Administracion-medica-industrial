/**
 * @file Tests vitest para el componente CutoverChecklist.
 * @id IMPL-20260708-FINAL — Fase 4 NOVA absorción (I Cutover).
 * @backup context/SPECs/MIGRATION-NOVA-MAPPING.md
 *
 * Cubre ≥ 2 casos sin depender de @testing-library/react (no instalada).
 * Valida la lógica de transformación del status en mensajes.
 *
 * El componente exporta default con prop `status`. Re-exportamos una
 * función pura `_summarizeStatus` desde el módulo solo si existe; si no,
 * validamos el comportamiento end-to-end con React's renderToStaticMarkup.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import CutoverChecklist from "@/app/admin/lab/cutover/_components/CutoverChecklist";

const baseStatus = {
  ready: false,
  slices: {
    A: "closed" as const,
    "B-v2": "closed" as const,
    C: "closed" as const,
    D: "closed" as const,
    E: "closed" as const,
    F: "closed" as const,
    G: "closed" as const,
    H: "partial" as const,
    I: "in_progress" as const,
  },
  completed: ["A", "B-v2", "C", "D", "E", "F", "G"],
  pending: ["H", "I"],
  nova_deprecated: false,
  next_actions: [
    "Slice H: Frank debe compartir dump NOVA (.sql o .csv)",
    "Slice I: Comunicar fecha de cutover a Lolis/Leticia/Dra. Erika",
  ],
};

function _render(props: Parameters<typeof CutoverChecklist>[0]): string {
  return renderToStaticMarkup(createElement(CutoverChecklist, props));
}

describe("CutoverChecklist", () => {
  it("renderiza los 9 slices del roadmap NOVA→AMI", () => {
    const html = _render({ status: baseStatus });
    for (const sliceKey of ["A", "B-v2", "C", "D", "E", "F", "G", "H", "I"]) {
      expect(html).toContain(`slice-row-${sliceKey}`);
    }
    // Conteo de filas con data-testid=slice-row-*
    const matches = html.match(/data-testid="slice-row-/g) || [];
    expect(matches).toHaveLength(9);
  });

  it("muestra badge IN_PROGRESS y lista de acciones cuando hay slices pendientes", () => {
    const html = _render({ status: baseStatus });
    expect(html).toContain("IN_PROGRESS");
    expect(html).toContain("dump NOVA");
    expect(html).toContain("data-testid=\"next-actions-list\"");
    // 9 slices, 2 acciones
    expect(html).toContain("1.");
    expect(html).toContain("2.");
  });

  it("muestra badge READY cuando ready=true y slices todos cerrados", () => {
    const readyStatus = {
      ...baseStatus,
      ready: true,
      slices: Object.fromEntries(
        Object.entries(baseStatus.slices).map(([k]) => [k, "closed" as const])
      ),
      pending: [],
      next_actions: [],
      nova_deprecated: true,
    };
    const html = _render({ status: readyStatus });
    expect(html).toContain("READY");
    expect(html).toContain("AMI es el sistema único");
    // No debe haber next-actions-list cuando no hay pendientes
    expect(html).not.toContain("data-testid=\"next-actions-list\"");
  });

  it("muestra correctamente el conteo de slices cerrados en el resumen", () => {
    const html = _render({ status: baseStatus });
    // 7 de 9 cerrados
    expect(html).toContain("7 de 9");
  });
});