// Definición de eventos globales para comunicación entre componentes client-side

export const EVENTS = {
    OPEN_APPOINTMENT_MODAL: 'open-appointment-modal'
} as const;

export interface OpenAppointmentModalDetail {
    workerId?: string;
    branchId?: string;
}

export interface CustomEventMap {
    [EVENTS.OPEN_APPOINTMENT_MODAL]: CustomEvent<OpenAppointmentModalDetail>;
}

declare global {
    interface WindowEventMap extends CustomEventMap {}
}
