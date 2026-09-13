import { useState } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import type { Plot, PlotStatus } from '../types/plot'

interface PlotMapProps {
  plots: Plot[]
}

const statusColors: Record<PlotStatus, string> = {
  available: '#2e7d32',
  protected: '#1565c0',
  already_claimed: '#757575',
}

function PlotMap({ plots }: PlotMapProps) {
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null)

  return (
    <div>
      <div style={{ width: '100%', height: '500px' }}>
        <Map
          initialViewState={{
            longitude: 150.3119,
            latitude: -33.7128,
            zoom: 11,
          }}
          mapStyle={{
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [
              {
                id: 'osm',
                type: 'raster',
                source: 'osm',
              },
            ],
          }}
        >
          <NavigationControl position="top-right" />

          {plots.map((plot) => (
            <Marker
              key={plot.id}
              longitude={plot.longitude}
              latitude={plot.latitude}
              anchor="center"
              onClick={(event) => {
                event.originalEvent.stopPropagation()
                setSelectedPlot(plot)
              }}
            >
              <button
                type="button"
                aria-label={`View ${plot.name}`}
                title={plot.name}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '3px solid white',
                  backgroundColor: statusColors[plot.status],
                  boxShadow: '0 1px 5px rgba(0, 0, 0, 0.4)',
                  cursor: 'pointer',
                }}
              />
            </Marker>
          ))}

          {selectedPlot && (
            <Popup
              longitude={selectedPlot.longitude}
              latitude={selectedPlot.latitude}
              anchor="top"
              onClose={() => setSelectedPlot(null)}
            >
              <div>
                <h3>{selectedPlot.name}</h3>
                <p>Status: {selectedPlot.status.replace('_', ' ')}</p>
                <p>Size: {selectedPlot.size} m²</p>
                <p>Price: ${selectedPlot.price.toFixed(2)}</p>
                <p>{selectedPlot.description}</p>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      <div className="map-legend">
        <div>
          <span className="legend-dot available"></span>
          Available
        </div>

        <div>
          <span className="legend-dot protected"></span>
          Protected
        </div>

        <div>
          <span className="legend-dot claimed"></span>
          Already claimed
        </div>
      </div>
    </div>
  )
}

export default PlotMap