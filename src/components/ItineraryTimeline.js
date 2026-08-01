'use client';

import ItineraryCard from './ItineraryCard';

export default function ItineraryTimeline({ itinerary, activeIndex, onHover, onClick }) {
  if (!itinerary) return null;

  const { stops, travel_segments } = itinerary;

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} menit`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}j ${m}m` : `${h} jam`;
  };

  const formatCost = (cost) => {
    return new Intl.NumberFormat('id-ID').format(cost);
  };

  const getTravelSegment = (fromOrder, toOrder) => {
    if (!travel_segments) return null;
    return travel_segments.find(
      (seg) => seg.from_order === fromOrder && seg.to_order === toOrder
    );
  };

  return (
    <div>
      {/* Itinerary Header */}
      <div className="itinerary-header">
        <h2 className="itinerary-title">
          <span>✨</span> {itinerary.title}
        </h2>
        <div className="itinerary-meta">
          <span>⏱️ {formatDuration(itinerary.total_duration_minutes)}</span>
          <span>💰 Rp{formatCost(itinerary.total_estimated_cost)}</span>
          <span>📍 {stops.length} tempat</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline">
        {stops.map((stop, idx) => {
          const travelSeg = idx < stops.length - 1
            ? getTravelSegment(stop.order, stops[idx + 1].order)
            : null;

          return (
            <div key={stop.place_id || idx}>
              <ItineraryCard
                stop={stop}
                index={idx}
                isActive={activeIndex === idx}
                onHover={onHover}
                onClick={onClick}
              />
              {travelSeg && (
                <div className="travel-segment">
                  <span className="travel-icon">🚗</span>
                  <span>{travelSeg.distance_km} km</span>
                  <span>·</span>
                  <span>{travelSeg.travel_minutes} mnt</span>
                  <span>·</span>
                  <span>{travelSeg.transport}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
