import nodemailer from 'nodemailer'

interface SendCertificateEmailData {
  to: string
  recipientName: string
  plotName: string
  certificatePath: string
}

export async function sendCertificateEmail(
  data: SendCertificateEmailData,
) {
  const emailUser = process.env.EMAIL_USER
  const emailPassword = process.env.EMAIL_APP_PASSWORD

  if (!emailUser || !emailPassword) {
    throw new Error('Email credentials are not configured')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  })

  await transporter.sendMail({
    from: `"Conservation Plot Platform" <${emailUser}>`,
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
        path: data.certificatePath,
      },
    ],
  })
}