import { describe, expect, it } from 'vitest'
import { SendGridSmtpSaveSchema } from '@/schemas/sendgrid-smtp.schema'

describe('SendGridSmtpSaveSchema', () => {
  it('accepts port 465 and empty optional emails', () => {
    const parsed = SendGridSmtpSaveSchema.safeParse({
      port: 465,
      enabled: true,
      fromAddress: '',
      fromPortalAccess: '',
      fromResults: '',
      fromReceipts: '',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid port', () => {
    const parsed = SendGridSmtpSaveSchema.safeParse({
      port: 2525,
      enabled: true,
      fromAddress: '',
      fromPortalAccess: '',
      fromResults: '',
      fromReceipts: '',
    })
    expect(parsed.success).toBe(false)
  })
})
