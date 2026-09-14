import { Resend } from 'resend'
import fs from 'fs'

interface SendCertificateEmailData {
  to: string
  recipientName: string
  plotName: string
  certificatePath: string
}

export async function sendCertificateEmail(
  data: SendCertificateEmailData,
) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const resend = new Resend(apiKey)

  const certificate = fs.readFileSync(data.certificatePath)

  const { error } = await resend.emails.send({
    from: 'Conservation Plot Platform <onboarding@resend.dev>',
    to: data.to,
    subject: `Your conservation certificate – ${data.plotName}`,
    text: `Hi ${data.recipientName},

Thank you for supporting ${data.plotName}.

Your personalised conservation certificate is attached to this email.

Regards,
Conservation Plot Platform`,
    attachments: [
      {
        filename: 'conservation-certificate.pdf',
        content: certificate,
      },
    ],
  })

  if (error) {
    throw new Error(
      `Failed to send certificate email: ${error.message}`,
    )
  }
}