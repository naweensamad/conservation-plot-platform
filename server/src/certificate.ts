import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

interface CertificateData {
  purchaseId: number
  plotName: string
  plotSize: number
  latitude: number
  longitude: number
  recipientName: string
  purchaseDate: Date
}

export async function generateCertificate(
  data: CertificateData,
): Promise<string> {
  const pdfDoc = await PDFDocument.create()

  const page = pdfDoc.addPage([842, 595])

  const { width, height } = page.getSize()

  const titleFont = await pdfDoc.embedFont(
    StandardFonts.HelveticaBold,
  )

  const normalFont = await pdfDoc.embedFont(
    StandardFonts.Helvetica,
  )

  // Border
  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderWidth: 3,
    borderColor: rgb(0.15, 0.35, 0.2),
  })

  // Title
  const title = 'Certificate of Conservation Support'

  const titleWidth = titleFont.widthOfTextAtSize(title, 28)

  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: 490,
    size: 28,
    font: titleFont,
    color: rgb(0.15, 0.35, 0.2),
  })

  const subtitle = 'Conservation Plot Platform'

  const subtitleWidth = normalFont.widthOfTextAtSize(
    subtitle,
    16,
  )

  page.drawText(subtitle, {
    x: (width - subtitleWidth) / 2,
    y: 455,
    size: 16,
    font: normalFont,
  })

  const intro = 'This certificate recognises'

  const introWidth = normalFont.widthOfTextAtSize(
    intro,
    16,
  )

  page.drawText(intro, {
    x: (width - introWidth) / 2,
    y: 395,
    size: 16,
    font: normalFont,
  })

  const nameWidth = titleFont.widthOfTextAtSize(
    data.recipientName,
    24,
  )

  page.drawText(data.recipientName, {
    x: (width - nameWidth) / 2,
    y: 355,
    size: 24,
    font: titleFont,
  })

  const supportText =
    'for supporting the conservation of'

  const supportWidth = normalFont.widthOfTextAtSize(
    supportText,
    16,
  )

  page.drawText(supportText, {
    x: (width - supportWidth) / 2,
    y: 320,
    size: 16,
    font: normalFont,
  })

  const plotWidth = titleFont.widthOfTextAtSize(
    data.plotName,
    20,
  )

  page.drawText(data.plotName, {
    x: (width - plotWidth) / 2,
    y: 280,
    size: 20,
    font: titleFont,
    color: rgb(0.15, 0.35, 0.2),
  })

  page.drawText(`Plot size: ${data.plotSize} m²`, {
    x: 280,
    y: 220,
    size: 14,
    font: normalFont,
  })

  page.drawText(
    `GPS: ${data.latitude}, ${data.longitude}`,
    {
      x: 280,
      y: 195,
      size: 14,
      font: normalFont,
    },
  )

  page.drawText(
    `Date: ${data.purchaseDate.toLocaleDateString('en-AU')}`,
    {
      x: 280,
      y: 170,
      size: 14,
      font: normalFont,
    },
  )

  page.drawText(
    `Certificate ID: CPP-${data.purchaseId}`,
    {
      x: 280,
      y: 145,
      size: 14,
      font: normalFont,
    },
  )

  const footer =
    'Thank you for supporting conservation.'

  const footerWidth = normalFont.widthOfTextAtSize(
    footer,
    13,
  )

  page.drawText(footer, {
    x: (width - footerWidth) / 2,
    y: 80,
    size: 13,
    font: normalFont,
  })

  const pdfBytes = await pdfDoc.save()

  const certificatesDirectory = path.join(
    process.cwd(),
    'certificates',
  )

  await fs.mkdir(certificatesDirectory, {
    recursive: true,
  })

  const fileName = `certificate-${data.purchaseId}.pdf`

  const filePath = path.join(
    certificatesDirectory,
    fileName,
  )

  await fs.writeFile(filePath, pdfBytes)

  return `/certificates/${fileName}`
}