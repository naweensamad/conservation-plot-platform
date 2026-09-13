# Conservation Plot Platform

Conservation Plot Platform is a full-stack web application that allows users to explore conservation plots on an interactive map, view plot details, purchase available plots through Shopify, and receive personalised PDF certificates by email after payment.

## Features

- Browse conservation plots on an interactive map
- Filter plots by available, protected and already claimed status
- View plot location, size, price and description
- Purchase available plots through Shopify checkout
- Support gift purchases with separate recipient details
- Process completed payments using Shopify webhooks
- Store purchase information in PostgreSQL
- Automatically mark purchased plots as claimed
- Generate personalised PDF certificates
- Automatically email certificates to buyers or gift recipients
- Verify Shopify webhook requests using HMAC signatures
- Prevent duplicate purchases when Shopify retries webhooks

## Tech Stack

**Frontend:** React, TypeScript, Vite, MapLibre GL, CSS  
**Backend:** Node.js, Express, TypeScript  
**Database:** PostgreSQL  
**Integration:** Shopify Admin API, Shopify Webhooks, Nodemailer  
**Other:** PDFKit, OpenStreetMap

## How It Works

1. Browse conservation plots using the interactive map or plot cards.
2. Filter plots based on their current status.
3. Select an available plot and enter purchase details.
4. Continue to Shopify to complete checkout.
5. Shopify sends a webhook to the backend after payment.
6. The purchase is recorded and the plot is marked as claimed.
7. A personalised PDF certificate is generated.
8. The certificate is automatically emailed to the buyer or gift recipient.

## Project Structure

```text
conservation-plot-platform/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PlotCard.tsx
│   │   │   └── PlotMap.tsx
│   │   ├── types/
│   │   │   └── plot.ts
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── server/
    ├── src/
    │   ├── certificate.ts
    │   ├── db.ts
    │   ├── email.ts
    │   ├── index.ts
    │   └── shopify.ts
    └── package.json
```

## Shopify Integration

The application integrates with Shopify to handle checkout and payment processing for conservation plots.

After a successful payment, Shopify sends an `orders/paid` webhook to the backend. The webhook signature is verified using HMAC before the order is processed. The application prevents duplicate webhook processing, records the purchase, updates the plot status, generates a personalised PDF certificate and emails it to the buyer or gift recipient.

Shopify credentials, database credentials and email credentials are excluded from source control.

## Author

**Naween Samad**