import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { pool } from './db.js'
import { getShopifyAccessToken } from './shopify.js'
import { generateCertificate } from './certificate.js'
import { sendCertificateEmail } from './email.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())

// Shopify webhook verification needs the exact raw request body,
// so this route must come BEFORE express.json().
app.post(
  '/api/webhooks/shopify/orders-paid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
    const shopifyHmac = req.get('X-Shopify-Hmac-Sha256')

    if (!clientSecret || !shopifyHmac) {
      return res.status(401).send('Missing webhook verification data')
    }

    const rawBody = req.body as Buffer

    const calculatedHmac = crypto
      .createHmac('sha256', clientSecret)
      .update(rawBody)
      .digest('base64')

    const receivedBuffer = Buffer.from(shopifyHmac)
    const calculatedBuffer = Buffer.from(calculatedHmac)

    if (
      receivedBuffer.length !== calculatedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, calculatedBuffer)
    ) {
      console.error('Invalid Shopify webhook signature')
      return res.status(401).send('Invalid webhook signature')
    }

    try {
      const order = JSON.parse(rawBody.toString('utf8'))

      console.log('Shopify paid order received:', {
        id: order.id,
        name: order.name,
        email: order.email,
      })

      const attributes = Object.fromEntries(
        (order.note_attributes ?? []).map(
          (attribute: { name: string; value: string }) => [
            attribute.name,
            attribute.value,
          ],
        ),
      )

      let plotId = Number(attributes._plot_id)

      // Fallback: identify plot using Shopify variant ID
      if (!plotId && order.line_items?.length > 0) {
        const variantId = String(order.line_items[0].variant_id)

        const plotResult = await pool.query(
          `
            SELECT id
            FROM plots
            WHERE shopify_variant_id = $1
          `,
          [variantId],
        )

        if (plotResult.rows.length > 0) {
          plotId = plotResult.rows[0].id
        }
      }

      if (!plotId) {
        console.error(
          'Could not identify plot for Shopify order',
          order.id,
        )

        return res.status(400).send('Plot could not be identified')
      }

      const buyerName =
        attributes._buyer_name ||
        [
          order.billing_address?.first_name,
          order.billing_address?.last_name,
        ]
          .filter(Boolean)
          .join(' ') ||
        'Shopify Customer'

      const buyerEmail =
        attributes._buyer_email ||
        order.email ||
        order.contact_email

      if (!buyerEmail) {
        return res.status(400).send('Buyer email is missing')
      }

      const isGift = attributes._is_gift === 'true'

      const recipientName = isGift
        ? attributes._recipient_name || null
        : null

      const recipientEmail = isGift
        ? attributes._recipient_email || null
        : null

      const shopifyOrderId = String(order.id)

      const purchaseDate = order.created_at
        ? new Date(order.created_at)
        : new Date()

      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        // Prevent webhook retries from creating duplicate purchases
        const existingPurchase = await client.query(
          `
            SELECT id
            FROM purchases
            WHERE shopify_order_id = $1
          `,
          [shopifyOrderId],
        )

        if (existingPurchase.rows.length > 0) {
          await client.query('COMMIT')

          console.log(
            `Order ${shopifyOrderId} was already processed`,
          )

          return res.status(200).send('Already processed')
        }

        const plotResult = await client.query(
          `
            SELECT
              id,
              name,
              status,
              size,
              latitude,
              longitude
            FROM plots
            WHERE id = $1
            FOR UPDATE
          `,
          [plotId],
        )

        if (plotResult.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).send('Plot not found')
        }

        const plot = plotResult.rows[0]

        const purchaseResult = await client.query(
          `
            INSERT INTO purchases (
              plot_id,
              shopify_order_id,
              buyer_name,
              buyer_email,
              recipient_name,
              recipient_email,
              purchase_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `,
          [
            plotId,
            shopifyOrderId,
            buyerName,
            buyerEmail,
            recipientName,
            recipientEmail,
            purchaseDate,
          ],
        )

        const purchaseId = purchaseResult.rows[0].id

        const certificateRecipient =
          recipientName || buyerName

        const certificateUrl = await generateCertificate({
          purchaseId,
          plotName: plot.name,
          plotSize: Number(plot.size),
          latitude: Number(plot.latitude),
          longitude: Number(plot.longitude),
          recipientName: certificateRecipient,
          purchaseDate,
        })

        await client.query(
          `
            UPDATE purchases
            SET certificate_url = $1
            WHERE id = $2
          `,
          [certificateUrl, purchaseId],
        )

        await client.query(
          `
            UPDATE plots
            SET status = 'already_claimed'
            WHERE id = $1
          `,
          [plotId],
        )

        await client.query('COMMIT')

        console.log(`Purchase ${purchaseId} saved.`)
        console.log(`Certificate generated: ${certificateUrl}`)
        console.log(
          `Plot ${plotId} marked as already_claimed.`,
        )

        const certificateEmail =
          recipientEmail || buyerEmail

        const certificateEmailName =
          recipientName || buyerName

        const certificatePath =
          `certificates/certificate-${purchaseId}.pdf`

        try {
          await sendCertificateEmail({
            to: certificateEmail,
            recipientName: certificateEmailName,
            plotName: plot.name,
            certificatePath,
          })

          console.log(
            `Certificate emailed to ${certificateEmail}`,
          )
        } catch (emailError) {
          console.error(
            'Purchase completed, but certificate email failed:',
            emailError,
          )
        }

        return res.status(200).send('Webhook processed')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      console.error(
        'Error processing Shopify webhook:',
        error,
      )

      return res.status(500).send('Webhook processing failed')
    }
  },
)

app.use(express.json())

// Make generated certificates available from the backend
app.use(
  '/certificates',
  express.static('certificates'),
)

app.get('/', (_req, res) => {
  res.json({
    message: 'Conservation Plot Platform API is running',
  })
})

// Get all plots
app.get('/api/plots', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM plots ORDER BY id',
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching plots:', error)

    res.status(500).json({
      message: 'Failed to fetch plots',
    })
  }
})

// Test Shopify authentication
app.get('/api/shopify/test', async (_req, res) => {
  try {
    const accessToken = await getShopifyAccessToken()

    res.json({
      message: 'Shopify authentication successful',
      connected: true,
      tokenReceived: Boolean(accessToken),
    })
  } catch (error) {
    console.error(
      'Shopify authentication error:',
      error,
    )

    res.status(500).json({
      message: 'Shopify authentication failed',
      connected: false,
    })
  }
})

// Register Shopify orders/paid webhook
app.post(
  '/api/shopify/register-webhook',
  async (_req, res) => {
    try {
      const shop = process.env.SHOPIFY_SHOP

      if (!shop) {
        return res.status(500).json({
          message: 'SHOPIFY_SHOP is not configured',
        })
      }

      const accessToken = await getShopifyAccessToken()

      const webhookUrl =
        'https://pdf-campaigns-carnival-affected.trycloudflare.com/api/webhooks/shopify/orders-paid'

      const response = await fetch(
        `https://${shop}.myshopify.com/admin/api/2026-07/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({
            query: `
              mutation webhookSubscriptionCreate(
                $topic: WebhookSubscriptionTopic!
                $webhookSubscription: WebhookSubscriptionInput!
              ) {
                webhookSubscriptionCreate(
                  topic: $topic
                  webhookSubscription: $webhookSubscription
                ) {
                  webhookSubscription {
                    id
                    topic
                    uri
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            variables: {
              topic: 'ORDERS_PAID',
              webhookSubscription: {
                uri: webhookUrl,
              },
            },
          }),
        },
      )

      const data = await response.json()

      const result =
        data?.data?.webhookSubscriptionCreate

      if (!response.ok) {
        return res
          .status(response.status)
          .json(data)
      }

      if (result?.userErrors?.length > 0) {
        return res.status(400).json({
          message:
            'Shopify rejected the webhook subscription',
          errors: result.userErrors,
        })
      }

      res.json({
        message: 'Webhook registered successfully',
        webhook: result?.webhookSubscription,
      })
    } catch (error) {
      console.error(
        'Error registering Shopify webhook:',
        error,
      )

      res.status(500).json({
        message: 'Failed to register Shopify webhook',
      })
    }
  },
)

// Fetch Shopify product
app.get(
  '/api/shopify/products/:productId',
  async (req, res) => {
    try {
      const { productId } = req.params
      const accessToken = await getShopifyAccessToken()
      const shop = process.env.SHOPIFY_SHOP

      if (!shop) {
        return res.status(500).json({
          message: 'SHOPIFY_SHOP is not configured',
        })
      }

      const response = await fetch(
        `https://${shop}.myshopify.com/admin/api/2026-07/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({
            query: `
              query GetProduct($id: ID!) {
                product(id: $id) {
                  id
                  title
                  handle
                  variants(first: 10) {
                    nodes {
                      id
                      title
                      price
                    }
                  }
                }
              }
            `,
            variables: {
              id: `gid://shopify/Product/${productId}`,
            },
          }),
        },
      )

      const data = await response.json()

      res.status(response.status).json(data)
    } catch (error) {
      console.error(
        'Error fetching Shopify product:',
        error,
      )

      res.status(500).json({
        message: 'Failed to fetch Shopify product',
      })
    }
  },
)

// Create checkout URL
app.post('/api/checkout', async (req, res) => {
  try {
    const {
      plotId,
      buyerName,
      buyerEmail,
      isGift,
      recipientName,
      recipientEmail,
    } = req.body

    if (!plotId || !buyerName || !buyerEmail) {
      return res.status(400).json({
        message:
          'Plot, buyer name and buyer email are required',
      })
    }

    if (
      isGift &&
      (!recipientName || !recipientEmail)
    ) {
      return res.status(400).json({
        message:
          'Recipient name and email are required for gifts',
      })
    }

    const result = await pool.query(
      `
        SELECT
          id,
          name,
          status,
          shopify_variant_id
        FROM plots
        WHERE id = $1
      `,
      [plotId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Plot not found',
      })
    }

    const plot = result.rows[0]

    if (plot.status !== 'available') {
      return res.status(409).json({
        message: 'This plot is no longer available',
      })
    }

    if (!plot.shopify_variant_id) {
      return res.status(400).json({
        message:
          'This plot has not been linked to Shopify',
      })
    }

    const shop = process.env.SHOPIFY_SHOP

    if (!shop) {
      return res.status(500).json({
        message: 'SHOPIFY_SHOP is not configured',
      })
    }

    const params = new URLSearchParams()

    params.set('checkout[email]', buyerEmail)

    params.set(
      'attributes[_plot_id]',
      String(plot.id),
    )

    params.set(
      'attributes[_buyer_name]',
      buyerName,
    )

    params.set(
      'attributes[_buyer_email]',
      buyerEmail,
    )

    params.set(
      'attributes[_is_gift]',
      isGift ? 'true' : 'false',
    )

    if (isGift) {
      params.set(
        'attributes[_recipient_name]',
        recipientName,
      )

      params.set(
        'attributes[_recipient_email]',
        recipientEmail,
      )
    }

    const checkoutUrl =
      `https://${shop}.myshopify.com/cart/` +
      `${plot.shopify_variant_id}:1?${params.toString()}`

    console.log('Checkout started:', {
      plotId: plot.id,
      plotName: plot.name,
      buyerName,
      buyerEmail,
      isGift: Boolean(isGift),
      recipientName:
        isGift ? recipientName : null,
      recipientEmail:
        isGift ? recipientEmail : null,
    })

    res.json({
      checkoutUrl,
    })
  } catch (error) {
    console.error(
      'Error creating checkout:',
      error,
    )

    res.status(500).json({
      message: 'Failed to create checkout',
    })
  }
})

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`,
  )
})