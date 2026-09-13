let cachedAccessToken: string | null = null
let tokenExpiresAt = 0

export async function getShopifyAccessToken() {
  const shop = process.env.SHOPIFY_SHOP
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET

  if (!shop || !clientId || !clientSecret) {
    throw new Error('Missing Shopify environment variables')
  }

  const now = Date.now()

  if (cachedAccessToken && now < tokenExpiresAt) {
    return cachedAccessToken
  }

  const response = await fetch(
    `https://${shop}.myshopify.com/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify authentication failed: ${errorText}`)
  }

  const data = await response.json() as {
    access_token: string
    scope: string
    expires_in: number
  }

  cachedAccessToken = data.access_token

  // Refresh one minute before expiry
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000

  return cachedAccessToken
}