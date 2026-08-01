'use client';

import { useState } from 'react';

const REGIONAL_EXPLORE_DATA = {
  Yogyakarta: [
    { name: 'Candi Ratu Boko', cat: 'wisata_sejarah', cost: 40000, dur: 90, lat: -7.7705, lng: 110.4894, desc: 'Situs istana kuno di atas bukit dengan pemandangan sunset terbaik di Jogja.' },
    { name: 'Kopi Klotok Pakem', cat: 'kopi', cost: 25000, dur: 60, lat: -7.6685, lng: 110.4225, desc: 'Warung kopi khas pedesaan dengan lodeh telor krispi legendaris.' },
    { name: 'Taman Sari Water Castle', cat: 'wisata_sejarah', cost: 15000, dur: 60, lat: -7.8099, lng: 110.3589, desc: 'Bekas taman pemandian kerajaan Kesultanan Yogyakarta yang estetis.' },
    { name: 'Bakmi Jawa Pak Pele', cat: 'kuliner', cost: 30000, dur: 45, lat: -7.8025, lng: 110.3688, desc: 'Bakmi goreng & godhog dimasak arang otentik di Alun-Alun Utara.' }
  ],
  Bali: [
    { name: 'Pura Uluwatu & Tari Kecak', cat: 'wisata_sejarah', cost: 150000, dur: 120, lat: -8.8291, lng: 115.0849, desc: 'Pertunjukan tari Kecak di tebing laut Uluwatu saat matahari terbenam.' },
    { name: 'Nasi Ayam Kedewatan Ibu Mangku', cat: 'kuliner', cost: 45000, dur: 45, lat: -8.4875, lng: 115.2542, desc: 'Nasi campur ayam otentik khas Ubud dengan sate lilit dan sambal matah.' },
    { name: 'Pantai Melasti Ungasan', cat: 'pantai', cost: 15000, dur: 90, lat: -8.8485, lng: 115.1588, desc: 'Pantai pasir putih jernih diapit tebing kapur megah.' }
  ],
  Default: [
    { name: 'Kuliner Lokal UMKM Legendaris', cat: 'kuliner', cost: 35000, dur: 45, lat: -7.8045, lng: 110.3645, desc: 'Sajian kuliner khas lokal resep otentik setempat.' },
    { name: 'Taman Kota & Spot Fotogenik', cat: 'wisata_alam', cost: 15000, dur: 60, lat: -7.7928, lng: 110.3658, desc: 'Kawasan hijau dan ruang terbuka publik khas daerah.' },
    { name: 'Kedai Kopi & Resto Khas', cat: 'kopi', cost: 25000, dur: 45, lat: -7.7520, lng: 110.4914, desc: 'Tempat bersantai menikmati sajian kopi lokal dan jajanan tradisional.' }
  ]
};

export default function ExploreView({ region, onAddStop }) {
  const [addedPlaces, setAddedPlaces] = useState({});

  const places = REGIONAL_EXPLORE_DATA[region] || REGIONAL_EXPLORE_DATA.Yogyakarta || REGIONAL_EXPLORE_DATA.Default;

  const handleAdd = (place, idx) => {
    setAddedPlaces((prev) => ({ ...prev, [idx]: true }));
    if (onAddStop) {
      onAddStop({
        name: place.name,
        category: place.cat,
        estimated_cost: place.cost,
        duration_minutes: place.dur,
        description: place.desc,
        location: { lat: place.lat, lng: place.lng },
        arrival_time: '14:00',
        day_number: 1,
        time_of_day: 'Afternoon'
      });
    }
  };

  const formatCost = (cost) => new Intl.NumberFormat('id-ID').format(cost);

  return (
    <div className="explore-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          🔍 Rekomendasi Destinasi di {region || 'Destinasi'}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Temukan kuliner legendaris, tempat wisata unik, dan UMKM pilihan untuk ditambahkan ke itinerary kamu.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {places.map((place, idx) => (
          <div
            key={place.name}
            style={{
              background: 'var(--bg-card)',
              border: 'var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {place.name}
                </h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {place.desc}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>💰 Rp{formatCost(place.cost)}</span>
                <span>⏱️ {place.dur} mnt</span>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => handleAdd(place, idx)}
                disabled={addedPlaces[idx]}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-full)',
                  width: 'auto',
                  flex: 'none'
                }}
              >
                {addedPlaces[idx] ? '✅ Ditambahkan' : '+ Tambah ke Itinerary'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
