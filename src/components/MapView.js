'use client';

import { useEffect, useRef, useState } from 'react';

const MAP_STYLES = {
  light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const INDONESIA_CENTER = [-2.5489, 118.0149];
const DEFAULT_ZOOM = 5;

const DAY_FALLBACK_COLORS = ['#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

export default function MapView({ stops, activeIndex, onMarkerClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const [isClient, setIsClient] = useState(false);
  const leafletRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || mapInstanceRef.current) return;

    let cancelled = false;

    async function initMap() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      leafletRef.current = L;

      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: INDONESIA_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(MAP_STYLES.light, {
        attribution: MAP_STYLES.attribution,
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      if (stops && stops.length > 0) {
        renderMarkers(L, map, stops);
      }
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, [isClient]);

  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current || !stops) return;
    renderMarkers(leafletRef.current, mapInstanceRef.current, stops);
  }, [stops]);

  useEffect(() => {
    if (!markersRef.current.length) return;

    markersRef.current.forEach((marker, idx) => {
      const el = marker.getElement?.();
      if (el) {
        const innerDiv = el.querySelector('.custom-marker');
        if (innerDiv) {
          if (idx === activeIndex) {
            innerDiv.classList.add('active');
          } else {
            innerDiv.classList.remove('active');
          }
        }
      }
    });
  }, [activeIndex]);

  function renderMarkers(L, map, stops) {
    // Clear existing markers & polylines
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    polylinesRef.current.forEach((p) => p.remove());
    polylinesRef.current = [];

    if (!stops || stops.length === 0) {
      map.setView(INDONESIA_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = [];
    const dayBoundsMap = new Map();

    stops.forEach((stop, idx) => {
      if (!stop.location) return;
      const lat = parseFloat(stop.location.lat);
      const lng = parseFloat(stop.location.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.push([lat, lng]);

      const dayNum = Number(stop.day_number) || 1;
      const color = stop.day_color || DAY_FALLBACK_COLORS[(dayNum - 1) % DAY_FALLBACK_COLORS.length];

      if (!dayBoundsMap.has(dayNum)) {
        dayBoundsMap.set(dayNum, { color, points: [] });
      }
      dayBoundsMap.get(dayNum).points.push([lat, lng]);

      const icon = L.divIcon({
        className: 'marker-wrapper',
        html: `<div class="custom-marker" style="background:${color}"><span>${idx + 1}</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      const formatCost = (cost) => new Intl.NumberFormat('id-ID').format(cost || 0);

      marker.bindPopup(
        `<div class="popup-content">
          <h4 style="color:${color}; margin-bottom:4px;">Day ${dayNum} · #${idx + 1}</h4>
          <h3 style="font-size:0.98rem; font-weight:700; margin-bottom:6px;">${stop.name}</h3>
          <p>💰 Rp${formatCost(stop.estimated_cost)}</p>
          <p>⏱️ ${stop.duration_minutes || 45} mnt</p>
        </div>`,
        { className: 'custom-popup' }
      );

      marker.on('click', () => {
        if (onMarkerClick) onMarkerClick(idx);
      });

      markersRef.current.push(marker);
    });

    // Draw polylines per day
    dayBoundsMap.forEach((dayData) => {
      if (dayData.points.length > 1) {
        const poly = L.polyline(dayData.points, {
          color: dayData.color,
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 6',
          smoothFactor: 1,
        }).addTo(map);

        polylinesRef.current.push(poly);
      }
    });

    // Fit bounds dynamically
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
  }

  if (!isClient) {
    return (
      <div className="map-placeholder">
        <span className="map-icon">🗺️</span>
        <p>Memuat peta interaktif...</p>
      </div>
    );
  }

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-view" />
      {(!stops || stops.length === 0) && (
        <div className="map-placeholder" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }}>
          <span className="map-icon">🗺️</span>
          <p style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Peta Rute Perjalanan Interaktif</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Masukkan tujuan kotamu di panel kiri untuk menampilkan pin lokasi & rute perjalanan.</p>
        </div>
      )}
    </div>
  );
}
