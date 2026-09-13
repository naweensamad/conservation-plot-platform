import { useEffect, useState } from 'react'
import './App.css'

import PlotMap from './components/PlotMap'
import PlotCard from './components/PlotCard'
import type { Plot, PlotStatus } from './types/plot'

type PlotFilter = 'all' | PlotStatus

function App() {
  const [plots, setPlots] = useState<Plot[]>([])
  const [filter, setFilter] = useState<PlotFilter>('all')
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null)
  const [purchasePlot, setPurchasePlot] = useState<Plot | null>(null)

  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [isGift, setIsGift] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')

  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlots() {
      try {
        const response = await fetch('http://localhost:3001/api/plots')

        if (!response.ok) {
          throw new Error('Failed to fetch plots')
        }

        const data: Plot[] = await response.json()

        const parsedPlots = data.map((plot) => ({
          ...plot,
          latitude: Number(plot.latitude),
          longitude: Number(plot.longitude),
          price: Number(plot.price),
          size: Number(plot.size),
        }))

        setPlots(parsedPlots)
      } catch (err) {
        console.error(err)
        setError('Could not load plots.')
      } finally {
        setLoading(false)
      }
    }

    fetchPlots()
  }, [])

  const filteredPlots =
    filter === 'all'
      ? plots
      : plots.filter((plot) => plot.status === filter)

  function openPurchaseForm(plot: Plot) {
    setPurchasePlot(plot)
    setBuyerName('')
    setBuyerEmail('')
    setIsGift(false)
    setRecipientName('')
    setRecipientEmail('')
    setCheckoutError(null)
  }

  function closePurchaseForm() {
    setPurchasePlot(null)
    setCheckoutError(null)
  }

  async function handlePurchaseSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!purchasePlot) {
      return
    }

    try {
      setCheckoutLoading(true)
      setCheckoutError(null)

      const response = await fetch(
        'http://localhost:3001/api/checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plotId: purchasePlot.id,
            buyerName,
            buyerEmail,
            isGift,
            recipientName: isGift ? recipientName : null,
            recipientEmail: isGift ? recipientEmail : null,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout')
      }

      if (!data.checkoutUrl) {
        throw new Error('Checkout URL was not returned')
      }

      window.location.href = data.checkoutUrl
    } catch (err) {
      console.error(err)

      if (err instanceof Error) {
        setCheckoutError(err.message)
      } else {
        setCheckoutError('Could not start checkout.')
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <main>
        <h1>Conservation Plot Platform</h1>
        <p>Loading plots...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main>
        <h1>Conservation Plot Platform</h1>
        <p>{error}</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Conservation Plot Platform</h1>
      <p>Explore and support conservation plots.</p>

      <PlotMap plots={filteredPlots} />

      <section className="plots-section">
        <div className="plots-heading">
          <h2>Browse plots</h2>

          <div className="plot-filters">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>

            <button
              className={filter === 'available' ? 'active' : ''}
              onClick={() => setFilter('available')}
            >
              Available
            </button>

            <button
              className={filter === 'protected' ? 'active' : ''}
              onClick={() => setFilter('protected')}
            >
              Protected
            </button>

            <button
              className={filter === 'already_claimed' ? 'active' : ''}
              onClick={() => setFilter('already_claimed')}
            >
              Already claimed
            </button>
          </div>
        </div>

        <div className="plot-grid">
          {filteredPlots.map((plot) => (
            <PlotCard
              key={plot.id}
              plot={plot}
              onSelect={setSelectedPlot}
            />
          ))}
        </div>
      </section>

      {selectedPlot && (
        <section className="selected-plot">
          <div className="selected-plot-header">
            <h2>{selectedPlot.name}</h2>

            <button
              type="button"
              onClick={() => setSelectedPlot(null)}
            >
              Close
            </button>
          </div>

          <p>{selectedPlot.description}</p>

          <p>
            <strong>Status:</strong>{' '}
            {selectedPlot.status.replace('_', ' ')}
          </p>

          <p>
            <strong>Size:</strong> {selectedPlot.size} m²
          </p>

          <p>
            <strong>Price:</strong> ${selectedPlot.price.toFixed(2)}
          </p>

          <p>
            <strong>GPS:</strong>{' '}
            {selectedPlot.latitude}, {selectedPlot.longitude}
          </p>

          {selectedPlot.status === 'available' && (
            <button
              type="button"
              className="select-plot-button"
              onClick={() => openPurchaseForm(selectedPlot)}
            >
              Select this plot
            </button>
          )}
        </section>
      )}

      {purchasePlot && (
        <section className="purchase-section">
          <div className="purchase-header">
            <div>
              <h2>Purchase {purchasePlot.name}</h2>
              <p>${purchasePlot.price.toFixed(2)}</p>
            </div>

            <button
              type="button"
              onClick={closePurchaseForm}
            >
              Close
            </button>
          </div>

          <form
            className="purchase-form"
            onSubmit={handlePurchaseSubmit}
          >
            <label>
              Buyer name
              <input
                type="text"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                required
              />
            </label>

            <label>
              Buyer email
              <input
                type="email"
                value={buyerEmail}
                onChange={(event) => setBuyerEmail(event.target.value)}
                required
              />
            </label>

            <label className="gift-checkbox">
              <input
                type="checkbox"
                checked={isGift}
                onChange={(event) => setIsGift(event.target.checked)}
              />
              This purchase is a gift
            </label>

            {isGift && (
              <>
                <label>
                  Recipient name
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    required
                  />
                </label>

                <label>
                  Recipient email
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    required
                  />
                </label>
              </>
            )}

            {checkoutError && (
              <p className="checkout-error">
                {checkoutError}
              </p>
            )}

            <button
              type="submit"
              className="checkout-button"
              disabled={checkoutLoading}
            >
              {checkoutLoading
                ? 'Starting checkout...'
                : 'Continue to checkout'}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}

export default App