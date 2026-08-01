import { NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
// Model specified in Gemma Hackathon guide: publishers/google/models/gemma-4-26b-a4b-it-maas or gemma-4-26b-a4b-it
const MODEL_NAME = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

const SYSTEM_PROMPT = `Kamu adalah "itinerary.ai", asisten cerdas pembuat rencana perjalanan wisata dan kuliner lokal untuk SELURUH WILAYAH INDONESIA dan DUNIA.

Tugas utama:
Mengubah permintaan natural language pengguna (misal: "Yogyakarta 2 hari, budget Rp500rb, wisata candi & kuliner legendaris", "Bali 1 hari pantai & sunset budget 300rb", "Bandung 4 jam ngopi & kuliner", dll) menjadi rute perjalanan (itinerary) yang sangat presisi, relevan, logis, dan dipersonalisasi.

PRINSIP & ATURAN:
1. BERLAKU UNIVERSAL: Bisa memproses kota/wilayah mana saja di Indonesia maupun dunia.
2. PRESI LOKASI REAL: Berikan koordinat GPS (latitude & longitude) yang akurat untuk setiap tempat agar bisa ditampilkan tepat di peta interaktif Leaflet.
3. BUDGET REALISTIS: Total estimasi biaya (tiket + kuliner + oleh-oleh + estimasi transport) HARUS mematuhi budget pengguna jika disebutkan.
4. KULINER & UMKM LOKAL: Selalu sertakan minimal 1 destinasi UMKM / kuliner lokal khas daerah tersebut.
5. URUTAN RUTE EFEKTIF: Susun urutan tempat berdasarkan kedekatan geografis (jarak minimal) dan logika waktu (pagi -> siang -> sore -> malam).
6. DOKUMEN HARUS FORMAT JSON VALID KETAT.

SCHEMA JSON OUTPUT (WAJIB SESUAI FORMAT INI):
{
  "itinerary": {
    "title": "string - judul perjalanan yang menarik dan estetis",
    "region": "string - nama kota / wilayah destinasi",
    "total_duration_minutes": number,
    "total_estimated_cost": number,
    "stops": [
      {
        "order": 1,
        "place_id": "string - unique slug id e.g. jogja_candi_prambanan",
        "name": "string - nama lengkap tempat / tempat kuliner",
        "category": "string - misal: wisata_alam / kuliner / wisata_sejarah / oleh_oleh / pantai / kopi",
        "arrival_time": "HH:MM",
        "duration_minutes": number,
        "estimated_cost": number,
        "description": "string - deskripsi singkat 1-2 kalimat mengapa wajib dikunjungi",
        "tips": "string - tips praktis khusus pengunjung",
        "location": { "lat": number, "lng": number }
      }
    ],
    "travel_segments": [
      {
        "from_order": 1,
        "to_order": 2,
        "distance_km": number,
        "travel_minutes": number,
        "transport": "string - misal: motor/mobil / jalan kaki / sewa sepeda"
      }
    ],
    "budget_breakdown": {
      "tiket_wisata": number,
      "kuliner": number,
      "transportasi": number,
      "oleh_oleh": number,
      "total": number,
      "sisa_budget": number
    },
    "ai_notes": "string - pesan ramah dari AI pemandu mengenai rute ini"
  }
}`;

function parseUserBudget(prompt) {
  if (!prompt) return 300000;
  const p = prompt.toLowerCase();
  const match = p.match(/(?:rp|budget|biaya)?\s*(\d+(?:[\.,]\d+)?)\s*(rb|ribu|k|jt|juta)?/i);
  if (match) {
    let numStr = match[1].replace(/\./g, '').replace(',', '.');
    let num = parseFloat(numStr);
    if (!isNaN(num)) {
      const unit = (match[2] || '').toLowerCase();
      if (unit === 'rb' || unit === 'ribu' || unit === 'k') {
        num *= 1000;
      } else if (unit === 'jt' || unit === 'juta') {
        num *= 1000000;
      } else if (num < 1000) {
        num *= 1000;
      }
      if (num >= 10000) return num;
    }
  }
  return 300000;
}

function normalizeItineraryResponse(payload, promptText = '') {
  if (!payload?.itinerary) return payload;

  const itinerary = payload.itinerary;
  const stops = Array.isArray(itinerary.stops) ? itinerary.stops : [];
  const travelSegments = Array.isArray(itinerary.travel_segments) ? itinerary.travel_segments : [];

  let tiketWisata = 0;
  let kuliner = 0;
  let olehOleh = 0;

  stops.forEach((stop) => {
    const cost = Number(stop.estimated_cost) || 0;
    const cat = String(stop.category || '').toLowerCase();

    // Mutually exclusive categorization to prevent double counting or missed costs
    if (cat.includes('kuliner') || cat.includes('kopi') || cat.includes('makan') || cat.includes('nasi') || cat.includes('sate') || cat.includes('bakso') || cat.includes('cafe') || cat.includes('resto') || cat.includes('food') || cat.includes('drink')) {
      kuliner += cost;
    } else if (cat.includes('oleh') || cat.includes('belanja') || cat.includes('umkm') || cat.includes('souvenir') || cat.includes('pasar') || cat.includes('mall') || cat.includes('toko')) {
      olehOleh += cost;
    } else {
      tiketWisata += cost;
    }
  });

  const transportasi = travelSegments.length > 0 
    ? travelSegments.length * 15000 
    : Math.max(15000, Math.floor(stops.length * 10000));
    
  const total = tiketWisata + kuliner + transportasi + olehOleh;
  const userBudget = parseUserBudget(promptText);

  const nextBudgetBreakdown = {
    tiket_wisata: tiketWisata,
    kuliner: kuliner,
    transportasi: transportasi,
    oleh_oleh: olehOleh,
    total: total,
    sisa_budget: Math.max(0, userBudget - total),
  };

  return {
    ...payload,
    itinerary: {
      ...itinerary,
      total_estimated_cost: total,
      budget_breakdown: nextBudgetBreakdown,
    },
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt perjalanan tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const apiKey = API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (apiKey) {
      // Try Gemma 4 Model Garden / AI Studio API
      const endpointModel = MODEL_NAME.includes('/') ? MODEL_NAME : `models/${MODEL_NAME}`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${endpointModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${SYSTEM_PROMPT}\n\nPERMINTAAN PENGGUNA:\n"${prompt.trim()}"\n\nBuatkan itinerary dalam JSON valid:` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              maxOutputTokens: 2500,
              responseMimeType: 'application/json'
            }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (candidateText) {
          try {
            const cleanJsonStr = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
            const parsed = JSON.parse(cleanJsonStr);
            if (parsed?.itinerary?.stops?.length > 0) {
              return NextResponse.json(normalizeItineraryResponse(parsed, prompt.trim()));
            }
          } catch (e) {
            console.error('Failed to parse Gemma 4 AI JSON response:', e, candidateText);
          }
        }
      } else {
        const errText = await response.text();
        console.warn('Gemma 4 API call warning:', response.status, errText);
      }
    }

    // Fallback dynamic generator for testing without API Key or when API quota is reached
    const dynamicResult = generateDynamicItinerary(prompt.trim());
    return NextResponse.json(normalizeItineraryResponse(dynamicResult, prompt.trim()));

  } catch (error) {
    console.error('Error generating itinerary:', error);
    return NextResponse.json(
      { error: 'Gagal membuat itinerary. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}

// Smart dynamic generator supporting universal locations in Indonesia
function generateDynamicItinerary(prompt) {
  const p = prompt.toLowerCase();
  let city = 'Yogyakarta';
  let sampleStops = [];

  if (p.includes('bali') || p.includes('kuta') || p.includes('ubud') || p.includes('denpasar') || p.includes('canggu') || p.includes('sanur')) {
    city = 'Bali';
    sampleStops = [
      { name: 'Tegallalang Rice Terrace', cat: 'wisata_alam', cost: 25000, dur: 90, lat: -8.4312, lng: 115.2792, desc: 'Pemandangan terasering sawah hijau yang memukau di Ubud.', tips: 'Gunakan pakaian terang untuk foto terbaik di ayunan.' },
      { name: 'Warung Babi Guling / Kuliner Khas Bali', cat: 'kuliner', cost: 55000, dur: 45, lat: -8.5069, lng: 115.2625, desc: 'Kuliner khas Bali otentik kaya rempah bumbu genep.', tips: 'Datang sebelum jam makan siang agar tidak kehabisan.' },
      { name: 'Pantai Tanah Lot', cat: 'pantai', cost: 30000, dur: 90, lat: -8.6212, lng: 115.0868, desc: 'Pura ikonik di atas batu karang dengan pemandangan sunset spektakuler.', tips: 'Cek jadwal pasang surut air laut sebelum mendekati pura.' },
      { name: 'Krisna Oleh-Oleh Bali', cat: 'oleh_oleh', cost: 40000, dur: 45, lat: -8.7056, lng: 115.1764, desc: 'Pusat oleh-oleh khas Bali terlengkap mulai dari pie susu hingga kain pantai.', tips: 'Pie susu original adalah oleh-oleh favorit utama.' }
    ];
  } else if (p.includes('bandung') || p.includes('lembang') || p.includes('dago') || p.includes('ciwidey')) {
    city = 'Bandung';
    sampleStops = [
      { name: 'Kawah Putih Ciwidey', cat: 'wisata_alam', cost: 40000, dur: 90, lat: -7.1662, lng: 107.4021, desc: 'Danau kawah vulkanik berwarna putih kehijauan yang sangat fotogenik.', tips: 'Gunakan masker karena aroma belerang cukup kuat.' },
      { name: 'Warung Nasi Ibu Imas', cat: 'kuliner', cost: 35000, dur: 45, lat: -6.9242, lng: 107.6045, desc: 'Kuliner Sunda legendaris dengan karedok dan sambal dadak pedas mantap.', tips: 'Sambal dadak dan ayam goreng basah adalah kombinasi wajib.' },
      { name: 'Kopi Toko Djawa Jalan Braga', cat: 'kopi', cost: 25000, dur: 45, lat: -6.9175, lng: 107.6094, desc: 'Kedai kopi estetis khas Braga dengan Kopi Awan yang creamy.', tips: 'Beli bolu gulung cokelat sebagai pendamping kopi.' },
      { name: 'Kartika Sari Hertasning', cat: 'oleh_oleh', cost: 50000, dur: 30, lat: -6.9125, lng: 107.6145, desc: 'Pusat pisang molen dan pastry khas Bandung ternama.', tips: 'Pisang keju molen fresh from the oven.' }
    ];
  } else if (p.includes('malang') || p.includes('batu') || p.includes('bromo')) {
    city = 'Malang & Batu';
    sampleStops = [
      { name: 'Museum Angkut Batu', cat: 'wisata_sejarah', cost: 110000, dur: 120, lat: -7.8785, lng: 112.5195, desc: 'Museum transportasi zona Eropa dan Amerika terpopuler.', tips: 'Siapkan baterai kamera penuh karena banyak spot foto.' },
      { name: 'Bakso President Malang', cat: 'kuliner', cost: 30000, dur: 45, lat: -7.9642, lng: 112.6364, desc: 'Bakso legendaris di pinggir rel kereta api sejak tahun 1977.', tips: 'Minta bakso bakar bumbu kecap manis pedas.' },
      { name: 'Toko Oen Malang', cat: 'kuliner', cost: 40000, dur: 45, lat: -7.9825, lng: 112.6308, desc: 'Resto vintage bergaya kolonial Belanda dengan es krim buatan sendiri.', tips: 'Coba es krim Tutti Frutti khas sejak 1930.' }
    ];
  } else if (p.includes('jakarta') || p.includes('monas') || p.includes('pik') || p.includes('fatahillah')) {
    city = 'Jakarta';
    sampleStops = [
      { name: 'Monumen Nasional (Monas)', cat: 'wisata_sejarah', cost: 15000, dur: 90, lat: -6.1754, lng: 106.8272, desc: 'Ikon ibu kota dengan museum sejarah nasional dan pelataran puncak.', tips: 'Datang pagi hari untuk menghindari antrean lift ke puncak.' },
      { name: 'Soto Betawi H. Husein', cat: 'kuliner', cost: 45000, dur: 45, lat: -6.2089, lng: 106.8456, desc: 'Soto Betawi kuah santan susu gurih resep otentik Manggarai.', tips: 'Pesan campur daging dan paru goreng garing.' },
      { name: 'Kota Tua & Museum Fatahillah', cat: 'wisata_sejarah', cost: 10000, dur: 90, lat: -6.1352, lng: 106.8133, desc: 'Kawasan peninggalan kolonial dengan sepeda ontel warna-warni.', tips: 'Sewa sepeda ontel dan topi kompeni untuk keliling alun-alun.' }
    ];
  } else if (p.includes('surabaya') || p.includes('madura')) {
    city = 'Surabaya';
    sampleStops = [
      { name: 'Monumen Kapal Selam (Monkasel)', cat: 'wisata_sejarah', cost: 15000, dur: 60, lat: -7.2655, lng: 112.7505, desc: 'Museum kapal selam sungguhan KRI Pasopati 410 buatan Uni Soviet.', tips: 'Rasakan atmosfer di dalam bilik torpedo dan periskop.' },
      { name: 'Rawon Setan Mbak Endang', cat: 'kuliner', cost: 40000, dur: 45, lat: -7.2628, lng: 112.7412, desc: 'Rawon kuah kluwek hitam pekat dengan potongan daging sapi empuk besar.', tips: 'Tambahkan telur asin dan sambal terasi pedas.' },
      { name: 'Pusat Oleh-Oleh Sambal Bu Rudy', cat: 'oleh_oleh', cost: 50000, dur: 45, lat: -7.2758, lng: 112.7562, desc: 'Pusat oleh-oleh khas Surabaya ternama dengan Sambal Bawang legenda.', tips: 'Borong Sambal Bawang Khas Bu Rudy dan Udang Crispy.' }
    ];
  } else if (p.includes('semarang') || p.includes('lawang sewu')) {
    city = 'Semarang';
    sampleStops = [
      { name: 'Lawang Sewu', cat: 'wisata_sejarah', cost: 20000, dur: 90, lat: -6.9839, lng: 110.4104, desc: 'Bangunan bersejarah bersejarah ribuan pintu dengan arsitektur megah.', tips: 'Sewa pemandu untuk cerita sejarah kantor pusat NIS.' },
      { name: 'Lunpia Mbok Cik Pandanaran', cat: 'kuliner', cost: 30000, dur: 45, lat: -6.9856, lng: 110.4145, desc: 'Lunpia Semarang otentik dengan isian rebung manis gurih dan saus kental.', tips: 'Pesan lunpia goreng dan lunpia basah komplit.' },
      { name: 'Kota Lama Semarang', cat: 'wisata_sejarah', cost: 0, dur: 60, lat: -6.9685, lng: 110.4282, desc: 'Kawasan bangunan kolonial Belanda Little Netherlands yang instagramable.', tips: 'Nikmati suasana sore hari sambil minum kopi di Spiegel Cafe.' }
    ];
  } else if (p.includes('lombok') || p.includes('mandalika') || p.includes('gili')) {
    city = 'Lombok';
    sampleStops = [
      { name: 'Pantai Kuta Mandalika', cat: 'pantai', cost: 10000, dur: 90, lat: -8.8955, lng: 116.2825, desc: 'Pantai pasir putih berbutir seperti merica dengan air laut biru jernih.', tips: 'Panjat Bukit Merese untuk pemandangan teluk yang memukau.' },
      { name: 'Ayam Taliwang Irama', cat: 'kuliner', cost: 50000, dur: 45, lat: -8.5833, lng: 116.1000, desc: 'Ayam bakar Taliwang khas Sasak dengan plecing kangkung pedas mantap.', tips: 'Pesan level pedas sedang jika tidak kuat rasa cabai pedas.' },
      { name: 'Desa Tenun Sukarara', cat: 'oleh_oleh', cost: 20000, dur: 60, lat: -8.7125, lng: 116.2145, desc: 'Desa perajin kain tenun ikat dan songket Lombok otentik.', tips: 'Bisa mencoba pakaian adat Sasak dan foto gratis di rumah adat.' }
    ];
  } else {
    let extractedCity = 'Yogyakarta';
    const words = prompt.split(/[\s,]+/);
    for (const w of words) {
      if (w.length > 3 && !['hari', 'jam', 'budget', 'rp', 'wisata', 'kuliner', 'pantai', 'kopi', 'murah', 'legendaris', 'dengan'].includes(w.toLowerCase())) {
        extractedCity = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        break;
      }
    }
    city = extractedCity;

    if (city.toLowerCase() === 'brebes') {
      sampleStops = [
        { name: 'Pantai Randusanga Indah', cat: 'pantai', cost: 15000, dur: 90, lat: -6.8125, lng: 109.0542, desc: 'Destinasi wisata pantai pesisir utara Brebes yang asri.', tips: 'Nikmati es kelapa muda segar di tepi pantai.' },
        { name: 'Sate Kambing Muda H. Suharjo', cat: 'kuliner', cost: 45000, dur: 45, lat: -6.8712, lng: 109.0425, desc: 'Sate kambing empuk tanpa bau prengus dengan bumbu kecap pedas.', tips: 'Minta dipotongkan lemak garing khas Brebes.' },
        { name: 'Sentra Telur Asin H. Yes Brebes', cat: 'oleh_oleh', cost: 35000, dur: 30, lat: -6.8755, lng: 109.0468, desc: 'Pusat oleh-oleh telur asin bakar dan asap khas Brebes.', tips: 'Telur asin bakar memiliki aroma wangi dan masir berminyak.' }
      ];
    } else {
      sampleStops = [
        { name: `Candi & Wisata Utama ${city}`, cat: 'wisata_sejarah', cost: 40000, dur: 90, lat: -7.7520, lng: 110.4914, desc: `Destinasi budaya & wisata bersejarah terpopuler di kawasan ${city}.`, tips: 'Sewa pemandu lokal untuk cerita sejarah yang mendalam.' },
        { name: `Kuliner Khas & Legendaris ${city}`, cat: 'kuliner', cost: 35000, dur: 45, lat: -7.8045, lng: 110.3645, desc: `Sajian makanan otentik resep turun-temurun khas daerah ${city}.`, tips: 'Datang di jam makan siang untuk menikmati porsi hangat segar.' },
        { name: `Pusat Oleh-Oleh & UMKM ${city}`, cat: 'oleh_oleh', cost: 35000, dur: 60, lat: -7.7928, lng: 110.3658, desc: `Pusat kerajinan souvenir, jajanan khas, dan produk UMKM lokal ${city}.`, tips: 'Tawar harga dengan ramah saat membeli cinderamata.' }
      ];
    }
  }

  let currentMin = 8 * 60;
  const stops = sampleStops.map((item, idx) => {
    if (idx > 0) currentMin += 20;
    const h = Math.floor(currentMin / 60);
    const m = currentMin % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    currentMin += item.dur;

    return {
      order: idx + 1,
      place_id: `place_${city.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx + 1}`,
      name: item.name,
      category: item.cat,
      arrival_time: timeStr,
      duration_minutes: item.dur,
      estimated_cost: item.cost,
      description: item.desc,
      tips: item.tips,
      location: { lat: item.lat, lng: item.lng }
    };
  });

  const travelSegments = [];
  for (let i = 0; i < stops.length - 1; i++) {
    travelSegments.push({
      from_order: i + 1,
      to_order: i + 2,
      distance_km: Number((3 + Math.random() * 5).toFixed(1)),
      travel_minutes: 20,
      transport: 'motor/mobil'
    });
  }

  return {
    itinerary: {
      title: `Eksplorasi Pesona & Cita Rasa ${city}`,
      region: city,
      total_duration_minutes: currentMin - 8 * 60,
      total_estimated_cost: 0,
      stops: stops,
      travel_segments: travelSegments,
      budget_breakdown: {},
      ai_notes: `Itinerary ini dirancang khusus untuk kawasan ${city} sesuai preferensi kamu.`
    }
  };
}
