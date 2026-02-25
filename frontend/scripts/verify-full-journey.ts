import { PrismaClient, EventStatus } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Configurable constants
const BACKEND_URL = 'http://localhost:8000'
const USER_ID_UNIVERSAL = 'U-TEST-2026-001'

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
    console.log('\n🎬 INICIANDO SIMULACIÓN DE FLUJO COMPLETO: AGENDA -> DIAGNÓSTICO IA\n')

    try {
        // ---------------------------------------------------------
        // 1. ANTECEDENTES (Setup)
        // ---------------------------------------------------------
        console.log('🏗️  1. Preparando entorno (Empresa, Sucursal, Trabajador)...')

        // Ensure Tenant & Branch
        const tenant = await prisma.tenant.upsert({
            where: { id: 'default-tenant' },
            update: {},
            create: { id: 'default-tenant', name: 'Salud Industrial Global' }
        })

        const branch = await prisma.branch.create({
            data: { name: 'Clinica Monterrey Centro', tenantId: tenant.id }
        })

        // Ensure Company
        const company = await prisma.company.create({
            data: { name: 'Automotriz del Norte S.A. de C.V.', rfc: 'ADN20250101' }
        })

        // Create Worker (Paciente)
        // We try to clean up previous test users with same universal ID to avoid conflict?
        // Or just create a random one. Let's create random.
        const uniqueId = `U-${Date.now()}`
        const worker = await prisma.worker.create({
            data: {
                universalId: uniqueId,
                firstName: 'Juan',
                lastName: 'Pérez Prueba',
                companyId: company.id
            }
        })
        console.log(`✅ Paciente Creado: ${worker.firstName} ${worker.lastName} (${worker.universalId})`)


        // ---------------------------------------------------------
        // 2. AGENDAMIENTO (Simulado)
        // ---------------------------------------------------------
        console.log('\n📅 2. Agendando Cita...')
        // En el sistema real, esto sería crear un MedicalEvent con status SCHEDULED.

        const event = await prisma.medicalEvent.create({
            data: {
                workerId: worker.id,
                branchId: branch.id,
                status: EventStatus.SCHEDULED
            }
        })
        console.log(`✅ Cita Agendada. Evento ID: ${event.id}`)


        // ---------------------------------------------------------
        // 3. RECEPCIÓN (Check-in)
        // ---------------------------------------------------------
        console.log('\n👋 3. Paciente llega a Recepción (Check-in)...')

        const checkedEvent = await prisma.medicalEvent.update({
            where: { id: event.id },
            data: {
                status: EventStatus.IN_PROGRESS, // O CHECKED_IN
                checkInDate: new Date()
            }
        })
        console.log(`✅ Check-in Completado. Estado: ${checkedEvent.status}`)


        // ---------------------------------------------------------
        // 4. TABLERO MÉDICO - CARGA DE ESTUDIOS
        // ---------------------------------------------------------
        console.log('\n📂 4. Médico/Enfermera sube archivos (Audiometría)...')

        // Create a dummy PDF file (locally)
        const dummyPath = path.join(process.cwd(), '../uploads', `audiometria_${uniqueId}.pdf`)
        const dummyContent = Buffer.from('%PDF-1.4 ... (Contenido Simulado de Audiometría con Hipoacusia) ... audimetria hz 500 ...')
        await fs.writeFile(dummyPath, dummyContent)

        // Determine relative path for DB
        const relativePath = `/uploads/audiometria_${uniqueId}.pdf`

        // Create DB Record (Initial State)
        const study = await prisma.studyRecord.create({
            data: {
                eventId: event.id,
                serviceName: 'Analizando (Clínico)...',
                fileUrl: relativePath,
                isCompleted: false
            }
        })
        console.log(`✅ Archivo Subido: ${relativePath}`)


        // ---------------------------------------------------------
        // 5. PROCESAMIENTO IA (Trigger Manual)
        // ---------------------------------------------------------
        console.log('\n🧠 5. Enviando a IA (Gemini Vision) para Análisis...')

        // In the real app, this happens inside the Server Action. 
        // Here we simulate the call that the Server Action makes.

        const response = await fetch(`${BACKEND_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: relativePath })
        })

        const aiResult = await response.json()
        console.log('🤖 Respuesta de Gemini:', JSON.stringify(aiResult.classification, null, 2))

        if (aiResult.status !== 'success') {
            throw new Error('Fallo en IA')
        }

        // ---------------------------------------------------------
        // 6. ACTUALIZACIÓN AUTOMÁTICA
        // ---------------------------------------------------------
        console.log('\n✨ 6. Actualizando Expediente con Resultados IA...')

        const finalName = `${aiResult.classification.detected_type} (IA)`

        await prisma.studyRecord.update({
            where: { id: study.id },
            data: {
                serviceName: finalName,
                isCompleted: true,
                extractedData: aiResult.extraction || {}
            }
        })

        console.log(`✅ Expediente Actualizado: El estudio ahora se llama "${finalName}"`)


        // ---------------------------------------------------------
        // 7. DICTAMEN FINAL
        // ---------------------------------------------------------
        console.log('\n👨‍⚕️ 7. Médico emite Dictamen Final...')

        // Create a doctor user first
        const doctor = await prisma.user.create({
            data: { email: `doc_${uniqueId}@test.com`, fullName: 'Dr. House', hashedPassword: await hash('test123', 10), role: 'DOCTOR_VALIDATOR' }
        })

        const verdict = await prisma.medicalVerdict.create({
            data: {
                eventId: event.id,
                validatorId: doctor.id,
                finalDiagnosis: 'Apto con Restricciones (Hipoacusia detectada por IA)',
                recommendations: 'Uso obligatorio de protección auditiva.'
            }
        })

        await prisma.medicalEvent.update({
            where: { id: event.id },
            data: { status: EventStatus.COMPLETED }
        })

        console.log(`✅ Dictamen Guardado: "${verdict.finalDiagnosis}"`)
        console.log('🎉 FLUJO COMPLETO EXITOSO')

    } catch (e) {
        console.error('❌ Error en la simulación:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
