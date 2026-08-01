'use client';

import { useState } from 'react';

export default function ItineraryTimeline({
  itinerary,
  activeIndex,
  onHover,
  onClick,
  activeTab,
  onTabChange,
  onAddStop
}) {
  if (!itinerary) return null;

  const { title, dates, days, stops } = itinerary;

  // Track expanded state for each day (Day 1 expanded by default, Day 2+ expanded/collapsed)
  const [expandedDays, setExpandedDays] = useState({ 1: true, 2: true, 3: true });
  const [addingStopFor, setAddingStopFor] = useState(null); // { dayNum, timeOfDay }
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceCost, setNewPlaceCost] = useState('');

  const toggleDay = (dayNum) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum]
    }));
  };

  const handleOpenAddForm = (dayNum, timeOfDay) => {
    setAddingStopFor({ dayNum, timeOfDay });
    setNewPlaceName('');
    setNewPlaceCost('25000');
  };

  const handleSaveNewStop = (e) => {
    e.preventDefault();
    if (!newPlaceName.trim() || !addingStopFor) return;

    const costNum = parseInt(newPlaceCost, 10) || 25000;

    if (onAddStop) {
      onAddStop({
        name: newPlaceName.trim(),
        category: 'kuliner',
        estimated_cost: costNum,
        duration_minutes: 45,
        description: 'Destinasi kustom yang ditambahkan pengguna.',
        tips: 'Disarankan konfirmasi jam operasional.',
        location: { lat: -7.7928, lng: 110.3658 },
        arrival_time: addingStopFor.timeOfDay === 'Morning' ? '09:00' : addingStopFor.timeOfDay === 'Afternoon' ? '13:00' : '19:00',
        day_number: addingStopFor.dayNum,
        time_of_day: addingStopFor.timeOfDay
      });
    }

    setAddingStopFor(null);
  };

  const formatCost = (cost) => new Intl.NumberFormat('id-ID').format(cost || 0);

  // Global index lookup across flat stops array for map marker syncing
  const getGlobalIndex = (targetStop) => {
    if (!stops) return 0;
    return stops.findIndex(
      (s) => s.name === targetStop.name || (s.place_id && s.place_id === targetStop.place_id)
    );
  };

  return (
    <div>
      {/* Top Title & Dates Header */}
      <div className="itinerary-main-header">
        <h1 className="trip-main-title">{title || 'Trip To Destination'}</h1>
        {dates && (
          <div className="trip-dates-row">
            <span className="dates-label">Dates:</span>
            <span className="dates-value">{dates}</span>
          </div>
        )}
      </div>

      {/* Tab Bar Switcher [ Itinerary | Explore ] */}
      <div className="tab-switcher-container">
        <button
          className={`tab-btn ${activeTab === 'itinerary' ? 'active' : ''}`}
          onClick={() => onTabChange('itinerary')}
        >
          Itinerary
        </button>
        <button
          className={`tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => onTabChange('explore')}
        >
          Explore
        </button>
      </div>

      {/* Accordion Days List */}
      {days && days.length > 0 ? (
        <div className="days-accordion-list">
          {days.map((day) => {
            const isExpanded = !!expandedDays[day.day_number];

            return (
              <div key={day.day_number} className="day-accordion-card">
                {/* Day Header Bar */}
                <div
                  className="day-accordion-header"
                  onClick={() => toggleDay(day.day_number)}
                >
                  <div className="day-title-left">
                    <span
                      className="day-color-badge"
                      style={{ background: day.color || '#3b82f6' }}
                    />
                    <span className="day-title-text">
                      Day {day.day_number} {day.date_label ? `- ${day.date_label}` : ''}
                    </span>
                  </div>
                  <button className="toggle-expand-btn">
                    {isExpanded ? 'collapse' : 'expand'}
                  </button>
                </div>

                {/* Day Content Body */}
                {isExpanded && (
                  <div className="day-accordion-body">
                    {day.sections && day.sections.map((section) => (
                      <div key={section.time_of_day} className="time-section">
                        <h4 className="time-section-title">{section.time_of_day}</h4>

                        <div className="stops-sublist">
                          {section.stops.map((stop) => {
                            const globalIdx = getGlobalIndex(stop);
                            const stopColor = stop.day_color || day.color || '#3b82f6';
                            const isCardActive = activeIndex === globalIdx;

                            return (
                              <div
                                key={stop.place_id || stop.name}
                                className={`stop-list-item ${isCardActive ? 'active' : ''}`}
                                onMouseEnter={() => onHover && onHover(globalIdx)}
                                onMouseLeave={() => onHover && onHover(null)}
                                onClick={() => onClick && onClick(globalIdx)}
                                id={`itinerary-card-${globalIdx}`}
                              >
                                <span className="stop-arrow">›</span>
                                <div className="stop-name-desc">
                                  <span className="stop-action-name">
                                    {stop.category?.includes('kuliner') || stop.category?.includes('kopi') ? 'Eat / Coffee at ' : 'Visit '}
                                    <strong style={{ color: 'var(--text-primary)' }}>{stop.name}</strong>
                                  </span>
                                  <span className="stop-sub-meta">
                                    ⏱️ {stop.duration_minutes || 45}m · 💰 Rp{formatCost(stop.estimated_cost)}
                                  </span>
                                </div>
                                <span
                                  className="stop-pin-badge"
                                  style={{ background: stopColor }}
                                >
                                  {globalIdx + 1}
                                </span>
                              </div>
                            );
                          })}

                          {/* Inline Add Form or Add Stop Button */}
                          {addingStopFor?.dayNum === day.day_number && addingStopFor?.timeOfDay === section.time_of_day ? (
                            <form onSubmit={handleSaveNewStop} className="add-stop-inline-form">
                              <input
                                type="text"
                                className="inline-add-input"
                                placeholder="Nama tempat baru..."
                                value={newPlaceName}
                                onChange={(e) => setNewPlaceName(e.target.value)}
                                autoFocus
                              />
                              <input
                                type="number"
                                className="inline-add-input cost"
                                placeholder="Estimasi biaya (Rp)..."
                                value={newPlaceCost}
                                onChange={(e) => setNewPlaceCost(e.target.value)}
                              />
                              <div className="inline-form-actions">
                                <button type="submit" className="btn btn-primary btn-sm">Simpan</button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddingStopFor(null)}>Batal</button>
                              </div>
                            </form>
                          ) : (
                            <button
                              className="add-stop-btn"
                              onClick={() => handleOpenAddForm(day.day_number, section.time_of_day)}
                            >
                              + Add Stop
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
