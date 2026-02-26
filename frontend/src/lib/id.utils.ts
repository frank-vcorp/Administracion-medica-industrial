/**
 * Utilidades para generación de IDs Automáticos
 * @id IMPL-20260226-ID
 */

/**
 * Genera el ID Universal del Trabajador
 * Formato: [INICIALES]-[YYYYMMDD]-[G]-[AMI-CLI]
 * Algoritmo de iniciales:
 * 1. 1ra letra Apellido Paterno
 * 2. 1ra vocal interna Apellido Paterno
 * 3. 1ra letra Apellido Materno
 * 4. 1ra letra Primer Nombre
 */
export function generateUniversalId(params: {
    firstName: string;
    lastName: string;
    dob?: Date | string | null;
    gender?: 'M' | 'F' | string | null;
}): string {
    const { firstName, lastName, dob, gender } = params;

    // Split names and surnames
    const names = firstName.trim().toUpperCase().split(' ');
    const surnames = lastName.trim().toUpperCase().split(' ');

    const paternal = surnames[0] || 'X';
    const maternal = surnames[1] || 'X';
    const name = names[0] || 'X';

    // 1. 1ra letra Apellido Paterno
    const l1 = paternal[0];

    // 2. 1ra vocal interna Apellido Paterno (empezando desde la 2da letra)
    const vowels = 'AEIOU';
    let l2 = 'X';
    for (let i = 1; i < paternal.length; i++) {
        if (vowels.includes(paternal[i])) {
            l2 = paternal[i];
            break;
        }
    }

    // 3. 1ra letra Apellido Materno
    const l3 = maternal[0];

    // 4. 1ra letra Primer Nombre
    const l4 = name[0];

    const initials = `${l1}${l2}${l3}${l4}`;

    // Fecha Nacimiento YYYYMMDD
    let dateStr = '00000000';
    if (dob) {
        const d = new Date(dob);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateStr = `${y}${m}${day}`;
        }
    }

    // Genero
    const g = (gender?.[0] || 'M').toUpperCase();

    return `${initials}-${dateStr}-${g}-AMI-CLI`;
}

/**
 * Genera el ID de Papeleta (Expediente)
 * Formato: EXP-YYYYNNN
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateExpedientId(prisma: any): Promise<string> {
    const year = new Date().getFullYear();

    const lastAppointment = await prisma.appointment.findFirst({
        where: { expedientId: { startsWith: `EXP-${year}` } },
        orderBy: { expedientId: 'desc' }
    });

    let nextNumber = 1;
    if (lastAppointment?.expedientId) {
        const match = lastAppointment.expedientId.match(/EXP-\d{4}(\d+)/);
        if (match) {
            nextNumber = parseInt(match[1]) + 1;
        }
    }

    const padded = String(nextNumber).padStart(3, '0');
    return `EXP-${year}${padded}`;
}
