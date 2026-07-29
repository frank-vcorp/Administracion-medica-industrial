// Definición de eventos globales para comunicación entre componentes client-side

export const EVENTS = {
    OPEN_APPOINTMENT_MODAL: 'open-appointment-modal'
} as const;

export interface OpenAppointmentModalDetail {
    workerId?: string;
    branchId?: string;
    companyId?: string;
}

export type CustomEventMap = {
    [EVENTS.OPEN_APPOINTMENT_MODAL]: CustomEvent<OpenAppointmentModalDetail>;
};

// SPEC FIX-20260729-01-BASELINE: WindowEventMap se declara con `interface extends`
// (no alias de tipo vacío) para que ESLint lo reconozca como no-vacía y TS
// fusione las declaraciones en `declare global` sin error de duplicate identifier.
type _Used = Parameters<typeof JSON.stringify>[1] | CustomEventMap
declare global {
    interface WindowEventMap extends CustomEventMap {}
}
void (0 as unknown as _Used)
