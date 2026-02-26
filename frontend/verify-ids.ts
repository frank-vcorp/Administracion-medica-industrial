import { generateUniversalId } from './src/lib/id.utils';

function testIdGen() {
    console.log('🧪 INICIANDO PRUEBAS DE GENERACIÓN DE IDS (QODO-STYLE)\n');

    const cases = [
        {
            name: 'Caso Normal: Frank Saavedra',
            fn: 'Frank', ln: 'Saavedra Gallegos', dob: '1985-03-15', gender: 'M',
            expected: 'SAVA-19850315-M-AMI-CLI' // S(1ra Ap) A(1ra vocal Ap) G(1ra Ap2) F(1ra Nom) -> SAGF? 
            // Mi algoritmo: l1=P[0], l2=vocal interna, l3=M[0], l4=N[0]
            // Saavedra -> l1=S, l2=A, Gallegos -> l3=G, Frank -> l4=F -> SAGF
        },
        {
            name: 'Caso 1 Apellido: Juan Perez',
            fn: 'Juan', ln: 'Perez', dob: '1990-01-01', gender: 'M',
            expected: 'PEXE-19900101-M-AMI-CLI' // P(1ra Ap) E(vocal) X(no ap2) J(1ra Nom) -> PEXJ
        },
        {
            name: 'Caso Nombre Compuesto: Maria Jose Ortiz Rico',
            fn: 'Maria Jose', ln: 'Ortiz Rico', dob: '1992-12-24', gender: 'F'
        }
    ];

    cases.forEach(c => {
        const id = generateUniversalId({ firstName: c.fn, lastName: c.ln, dob: c.dob, gender: c.gender });
        console.log(`[${c.name}] -> RESULTADO: ${id}`);
    });
}

testIdGen();
