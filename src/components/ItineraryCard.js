'use client';

export default function ItineraryCard({ stop, index, isActive, onHover, onClick }) {
  const getCategoryIcon = (category) => {
    if (!category) return '📍';
    const cat = category.toLowerCase();
    if (cat.includes('wisata_alam') || cat.includes('agrowisata')) return '🏞️';
    if (cat.includes('wisata_air') || cat.includes('bahari')) return '🌊';
    if (cat.includes('wisata_edukasi')) return '📚';
    if (cat.includes('wisata_sejarah') || cat.includes('buatan')) return '🏛️';
    if (cat.includes('kuliner') || cat.includes('sate') || cat.includes('seafood') || cat.includes('kopi') || cat.includes('nasi')) return '🍖';
    if (cat.includes('oleh_oleh') || cat.includes('pusat_umkm')) return '🛍️';
    return '📍';
  };

  const getCategoryClass = (category) => {
    if (!category) return 'category-default';
    const cat = category.toLowerCase();
    if (cat.includes('wisata')) return 'category-wisata';
    if (cat.includes('kuliner') || cat.includes('sate') || cat.includes('seafood') || cat.includes('kopi') || cat.includes('nasi')) return 'category-kuliner';
    if (cat.includes('oleh') || cat.includes('umkm')) return 'category-oleh-oleh';
    return 'category-default';
  };

  const formatCost = (cost) => {
    return new Intl.NumberFormat('id-ID').format(cost);
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} menit`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`;
  };

  const category = stop.category || '';

  return (
    <div
      className="itinerary-card"
      onMouseEnter={() => onHover && onHover(index)}
      onMouseLeave={() => onHover && onHover(null)}
      onClick={() => onClick && onClick(index)}
      id={`itinerary-card-${index}`}
    >
      <div className={`timeline-dot ${getCategoryClass(category)}`}>
        <span>{index + 1}</span>
      </div>
      <div className={`card-body ${isActive ? 'active' : ''}`}>
        <div className="card-top-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="card-category-icon">{getCategoryIcon(category)}</span>
            <span className="card-name">{stop.name}</span>
          </div>
          {stop.arrival_time && (
            <span className="card-arrival-time">{stop.arrival_time}</span>
          )}
        </div>

        <p className="card-description">{stop.description}</p>

        <div className="card-meta-row">
          <span>⏱️ {formatDuration(stop.duration_minutes)}</span>
          <span>💰 Rp{formatCost(stop.estimated_cost)}</span>
        </div>

        {stop.tips && (
          <div className="card-tips">
            <span>💡</span>
            <span>{stop.tips}</span>
          </div>
        )}
      </div>
    </div>
  );
}
