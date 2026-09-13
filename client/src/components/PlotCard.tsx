import type { Plot } from '../types/plot'

interface PlotCardProps {
  plot: Plot
  onSelect: (plot: Plot) => void
}

function PlotCard({ plot, onSelect }: PlotCardProps) {
  return (
    <article className="plot-card">
      <div className="plot-card-header">
        <h3>{plot.name}</h3>

        <span className={`plot-status ${plot.status}`}>
          {plot.status.replace('_', ' ')}
        </span>
      </div>

      <p>{plot.description}</p>

      <div className="plot-card-details">
        <span>{plot.size} m²</span>
        <strong>${plot.price.toFixed(2)}</strong>
      </div>

      <button
        type="button"
        className="view-plot-button"
        onClick={() => onSelect(plot)}
      >
        View plot
      </button>
    </article>
  )
}

export default PlotCard