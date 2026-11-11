import { z } from 'zod'
import { applySentenceCase } from '@/lib/text/sentence-case'

const personNameField = z
  .string()
  .trim()
  .min(1, 'Este campo es obligatorio')
  .max(100, 'Máximo 100 caracteres')
  .transform(applySentenceCase)

export const workerFormFieldsSchema = z.object({
  firstName: personNameField,
  lastName: personNameField,
  companyId: z.string().optional(),
  branchId: z.string().nullable().optional(),
  medicalProfileId: z.string().optional(),
  dob: z.string().optional(),
  nationalId: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  gender: z.string().optional(),
  publicGeneralAlta: z.enum(['true', 'false']).optional(),
})

export function workerFieldsFromFormData(formData: FormData) {
  return {
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    companyId: String(formData.get('companyId') ?? ''),
    branchId: (formData.get('branchId') as string | null) ?? null,
    medicalProfileId: String(formData.get('medicalProfileId') ?? ''),
    dob: String(formData.get('dob') ?? ''),
    nationalId: String(formData.get('nationalId') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    gender: String(formData.get('gender') ?? ''),
    publicGeneralAlta: (formData.get('publicGeneralAlta') === 'true' ? 'true' : 'false') as 'true' | 'false',
  }
}
