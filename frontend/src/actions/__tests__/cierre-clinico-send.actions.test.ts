import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCierreClinicoContactInfo,
  sendCierreClinico,
} from '../cierre-clinico-send.actions'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    medicalEvent: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/smtp-mail', () => ({
  sendSmtpMail: vi.fn(),
}))

vi.mock('@/actions/whatsapp-send.actions', () => ({
  sendWhatsAppDocumentMessage: vi.fn(),
}))

vi.mock('@/lib/zip-cierre-clinico', () => ({
  buildCierreClinicoZip: vi.fn(),
  CierreClinicoError: class CierreClinicoError extends Error {},
}))

vi.mock('@/lib/clinical/study-pdf-for-zip', () => ({
  readPersistedPdfBytes: vi.fn(),
}))

vi.mock('@/lib/patient-dictamen-pdf', () => ({
  renderPatientHealthDictamenToMemory: vi.fn(),
}))

vi.mock('@/lib/sme-brand', () => ({
  resolveSmeLogoDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,mockLogo'),
}))

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { sendSmtpMail } from '@/lib/smtp-mail'
import { sendWhatsAppDocumentMessage } from '@/actions/whatsapp-send.actions'
import { buildCierreClinicoZip } from '@/lib/zip-cierre-clinico'
import { readPersistedPdfBytes } from '@/lib/clinical/study-pdf-for-zip'
import { renderPatientHealthDictamenToMemory } from '@/lib/patient-dictamen-pdf'

describe('cierre-clinico-send.actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin-1', role: 'SUPERADMIN' },
    } as any)
  })

  const mockEvent = {
    id: 'ev-100',
    worker: {
      firstName: 'Ernesto',
      lastName: 'De la Cruz',
      universalId: 'DELE-19830914-M-AMI-CLI',
      email: 'ernesto@worker.com',
      phone: '8110001111',
      company: {
        name: 'Systron Industrial',
        email: 'rrhh@systron.com',
        phone: '8120002222',
      },
      reportEmails: [{ email: 'copia@systron.com' }],
    },
    exam: {
      physicalExamData: {
        aptitud: 'APTO',
        recomendaciones_clinicas: 'Uso de lentes para laborar',
      },
    },
    verdict: {
      id: 'verd-100',
      finalDiagnosis: 'Miopía leve',
      recommendations: 'Revisión anual',
      signedAt: new Date('2026-11-26'),
      patientPdfUrl: 'dictamen-paciente-ev-100-signed.pdf',
      validator: { fullName: 'Dr. Frank Saavedra', professionalLicense: '12345' },
    },
    studies: [],
    eventTests: [],
  }

  describe('getCierreClinicoContactInfo', () => {
    it('retorna contactos de empresa y trabajador', async () => {
      vi.mocked(prisma.medicalEvent.findUnique).mockResolvedValue(mockEvent as any)

      const info = await getCierreClinicoContactInfo('ev-100')
      expect(info.success).toBe(true)
      expect(info.companyName).toBe('Systron Industrial')
      expect(info.companyEmail).toBe('rrhh@systron.com')
      expect(info.companyPhone).toBe('8120002222')
      expect(info.workerEmail).toBe('ernesto@worker.com')
      expect(info.workerPhone).toBe('8110001111')
      expect(info.additionalEmails).toContain('copia@systron.com')
    })
  })

  describe('sendCierreClinico a Empresa (recipientType=company / default)', () => {
    it('envía ZIP completo a la empresa por correo', async () => {
      vi.mocked(prisma.medicalEvent.findUnique).mockResolvedValue(mockEvent as any)
      vi.mocked(buildCierreClinicoZip).mockResolvedValue({
        zip: new Uint8Array([1, 2, 3]),
        filename: 'CierreClinico-DELE-19830914-M-AMI-CLI.zip',
      } as any)
      vi.mocked(sendSmtpMail).mockResolvedValue({ success: true } as any)

      const res = await sendCierreClinico({
        eventId: 'ev-100',
        channel: 'email',
        recipientType: 'company',
      })

      expect(res.success).toBe(true)
      expect(buildCierreClinicoZip).toHaveBeenCalledWith('ev-100')
      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'rrhh@systron.com, copia@systron.com',
          subject: expect.stringContaining('Cierre Clínico'),
          attachments: [
            expect.objectContaining({
              filename: 'CierreClinico-DELE-19830914-M-AMI-CLI.zip',
            }),
          ],
        }),
      )
    })

    it('envía ZIP a la empresa por WhatsApp con teléfono de empresa por defecto', async () => {
      vi.mocked(prisma.medicalEvent.findUnique).mockResolvedValue(mockEvent as any)
      vi.mocked(buildCierreClinicoZip).mockResolvedValue({
        zip: new Uint8Array([1, 2, 3]),
        filename: 'CierreClinico-DELE-19830914-M-AMI-CLI.zip',
      } as any)
      vi.mocked(sendWhatsAppDocumentMessage).mockResolvedValue({ sent: true } as any)

      const res = await sendCierreClinico({
        eventId: 'ev-100',
        channel: 'whatsapp',
        recipientType: 'company',
      })

      expect(res.success).toBe(true)
      expect(sendWhatsAppDocumentMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '5218120002222',
          mimetype: 'application/zip',
          caption: expect.stringContaining('Cierre clínico de Ernesto De la Cruz (Systron Industrial)'),
        }),
      )
    })
  })

  describe('sendCierreClinico a Trabajador (recipientType=worker)', () => {
    it('envía únicamente PDF de recomendaciones al trabajador por correo (sin ZIP)', async () => {
      vi.mocked(prisma.medicalEvent.findUnique).mockResolvedValue(mockEvent as any)
      vi.mocked(readPersistedPdfBytes).mockResolvedValue(new Uint8Array([4, 5, 6]))
      vi.mocked(sendSmtpMail).mockResolvedValue({ success: true } as any)

      const res = await sendCierreClinico({
        eventId: 'ev-100',
        channel: 'email',
        recipientType: 'worker',
      })

      expect(res.success).toBe(true)
      // NO debe construir el ZIP patronal
      expect(buildCierreClinicoZip).not.toHaveBeenCalled()
      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ernesto@worker.com',
          subject: 'Recomendaciones de Salud y Bienestar — Ernesto De la Cruz',
          attachments: [
            expect.objectContaining({
              filename: 'Recomendaciones-Salud-DELE-19830914-M-AMI-CLI.pdf',
            }),
          ],
        }),
      )
    })

    it('envía únicamente PDF de recomendaciones al trabajador por WhatsApp', async () => {
      vi.mocked(prisma.medicalEvent.findUnique).mockResolvedValue(mockEvent as any)
      vi.mocked(readPersistedPdfBytes).mockResolvedValue(new Uint8Array([4, 5, 6]))
      vi.mocked(sendWhatsAppDocumentMessage).mockResolvedValue({ sent: true } as any)

      const res = await sendCierreClinico({
        eventId: 'ev-100',
        channel: 'whatsapp',
        recipientType: 'worker',
      })

      expect(res.success).toBe(true)
      expect(buildCierreClinicoZip).not.toHaveBeenCalled()
      expect(sendWhatsAppDocumentMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '5218110001111',
          mimetype: 'application/pdf',
          fileName: 'Recomendaciones-Salud-DELE-19830914-M-AMI-CLI.pdf',
          caption: expect.stringContaining('te compartimos tus recomendaciones médicas y de bienestar'),
        }),
      )
    })

    it('soporta enviar a múltiples números de WhatsApp si se especifican', async () => {
      vi.mocked(prisma.medicalEvent.findUnique).mockResolvedValue(mockEvent as any)
      vi.mocked(readPersistedPdfBytes).mockResolvedValue(new Uint8Array([4, 5, 6]))
      vi.mocked(sendWhatsAppDocumentMessage).mockResolvedValue({ sent: true } as any)

      const res = await sendCierreClinico({
        eventId: 'ev-100',
        channel: 'whatsapp',
        recipientType: 'worker',
        recipientPhone: '8110001111',
        additionalPhones: ['8122334455'],
      })

      expect(res.success).toBe(true)
      expect(sendWhatsAppDocumentMessage).toHaveBeenCalledTimes(2)
      expect(sendWhatsAppDocumentMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ phone: '5218110001111' }),
      )
      expect(sendWhatsAppDocumentMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ phone: '5218122334455' }),
      )
    })
  })
})
