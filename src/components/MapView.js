'use client';

import { useEffect, useRef, useState } from 'react';

const MAP_STYLES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
};

// Default center of Indonesia
const INDONESIA_CENTER = [-2.5489, 118.0149];
const DEFAULT_ZOOM = 5;

const MARKER_COLORS = {
  wisata: '#10b981',
  kuliner: '#f59e0b',
  'oleh-oleh': '#6366f1',
  pantai: '#06b6d4',
  kopi: '#d97706',
  default: '#14b8a6',
};

function getMarkerCategory(category) {
  if (!category) return 'default';
  const cat = category.toLowerCase();
  if (cat.includes('pantai') || cat.includes('air') || cat.includes('bahari')) return 'pantai';
  if (cat.includes('kopi') || cat.includes('cafe')) return 'kopi';
  if (cat.includes('wisata') || cat.includes('candi') || cat.includes('alam') || cat.includes('sejarah')) return 'wisata';
  if (cat.includes('kuliner') || cat.includes('sate') || cat.includes('makan') || cat.includes('nasi') || cat.includes('bakso')) return 'kuliner';
  if (cat.includes('oleh') || cat.includes('belanja') || cat.includes('umkm')) return 'oleh-oleh';
  return 'default';
}

export default function MapView({ stops, activeIndex, onMarkerClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const leafletRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map
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

      L.tileLayer(MAP_STYLES.dark, {
        attribution: MAP_STYLES.attribution,
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;

      // If stops already exist, render them
      if (stops && stops.length > 0) {
        renderMarkers(L, map, stops);
      }
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, [isClient]);

  // Update markers when stops change
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current || !stops) return;
    renderMarkers(leafletRef.current, mapInstanceRef.current, stops);
  }, [stops]);

  // Handle active index highlight
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
    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!stops || stops.length === 0) {
      map.setView(INDONESIA_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = [];

    stops.forEach((stop, idx) => {
      if (!stop.location || typeof stop.location.lat !== 'number' || typeof stop.location.lng !== 'number') return;

      const { lat, lng } = stop.location;
      bounds.push([lat, lng]);

      const cat = getMarkerCategory(stop.category);
      const color = MARKER_COLORS[cat] || MARKER_COLORS.default;

      const icon = L.divIcon({
        className: 'marker-wrapper',
        html: `<div class="custom-marker ${cat}" style="background:${color}"><span>${idx + 1}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      const formatCost = (cost) => new Intl.NumberFormat('id-ID').format(cost || 0);

      marker.bindPopup(
        `<div class="popup-content">
          <h4>${stop.name}</h4>
          <p>💰 Rp${formatCost(stop.estimated_cost)}</p>
          <p>⏱️ ${stop.duration_minutes || 45} menit</p>
        </div>`,
        { className: 'custom-popup' }
      );

      marker.on('click', () => {
        if (onMarkerClick) onMarkerClick(idx);
      });

      markersRef.current.push(marker);
    });

    // Draw route polyline
    if (bounds.length > 1) {
      polylineRef.current = L.polyline(bounds, {
        color: '#14b8a6',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8',
        smoothFactor: 1,
      }).addTo(map);
    }

    // Fit bounds dynamically
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    }
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
