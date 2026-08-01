'use client';

export default function LoadingSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="loading-text">
        <span className="sparkle-anim">✨</span>
        itinerary.ai sedang merancang perjalananmu
        <span className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>

      <div className="skeleton-header">
        <div className="skeleton-line h-lg w-60"></div>
        <div className="skeleton-line w-40"></div>
      </div>

      {[1, 2, 3].map((i) => (
        <div className="skeleton-card" key={i} style={{ animationDelay: `${i * 0.2}s` }}>
          <div className="skeleton-line w-80"></div>
          <div className="skeleton-line w-60"></div>
          <div className="skeleton-line w-40"></div>
        </div>
      ))}
    </div>
  );
}
