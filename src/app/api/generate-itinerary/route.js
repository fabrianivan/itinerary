import { NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const MODEL_NAME = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

const SYSTEM_PROMPT = `Kamu adalah "itinerary.ai", asisten cerdas pembuat rencana perjalanan wisata dan kuliner lokal untuk SELURUH WILAYAH INDONESIA dan DUNIA.

Tugas utama:
Mengubah permintaan pengguna (misal: "Yogyakarta 2 hari, budget Rp500rb, wisata candi & kuliner legendaris", "Trip To New York City 3 days", "Bali 1 hari pantai & sunset budget 300rb", dll) menjadi rute perjalanan (itinerary) yang presisi, terstruktur per hari (Day 1, Day 2), serta terbagi waktu (Morning/Pagi, Afternoon/Siang-Sore, Evening/Malam).

PRINSIP & ATURAN:
1. BERLAKU UNIVERSAL: Bisa memproses kota/wilayah mana saja di Indonesia maupun dunia.
2. PRESI LOKASI REAL: Berikan koordinat GPS (latitude & longitude) yang akurat untuk setiap tempat agar bisa ditampilkan tepat di peta interaktif.
3. KELOMPOK HARI & WAKTU: Kelompokkan setiap tempat ke dalam "day_number" (1, 2, 3...) dan "time_of_day" ("Morning", "Afternoon", "Evening").
4. KULINER & UMKM LOKAL: Selalu sertakan minimal 1 destinasi UMKM / kuliner lokal khas daerah tersebut.
5. DOKUMEN HARUS FORMAT JSON VALID KETAT.

SCHEMA JSON OUTPUT:
{
  "itinerary": {
    "title": "string - judul perjalanan e.g. Trip to Yogyakarta",
    "region": "string - nama kota destinasi",
    "dates": "string - estimasi rentang tanggal e.g. 10/17/26 - 10/19/26",
    "total_days": number,
    "total_duration_minutes": number,
    "total_estimated_cost": number,
    "stops": [
      {
        "order": 1,
        "day_number": 1,
        "time_of_day": "Morning",
        "place_id": "string - slug id unique",
        "name": "string - nama tempat",
        "category": "wisata_alam / kuliner / wisata_sejarah / oleh_oleh / pantai / kopi",
        "arrival_time": "HH:MM",
        "duration_minutes": number,
        "estimated_cost": number,
        "description": "deskripsi singkat 1-2 kalimat",
        "tips": "tips khusus pengunjung",
        "location": { "lat": number, "lng": number }
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
    "ai_notes": "pesan dari AI pemandu"
  }
}`;

const DAY_COLORS = ['#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

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

function buildDaysStructure(stops) {
  if (!stops || stops.length === 0) return [];

  const dayMap = new Map();

  stops.forEach((stop, idx) => {
    let dayNum = Number(stop.day_number) || 1;
    if (!stop.day_number) {
      dayNum = Math.floor(idx / 3) + 1;
    }
    stop.day_number = dayNum;

    let timeOfDay = stop.time_of_day || 'Morning';
    if (!stop.time_of_day && stop.arrival_time) {
      const hour = parseInt(stop.arrival_time.split(':')[0], 10);
      if (hour < 11) timeOfDay = 'Morning';
      else if (hour < 17) timeOfDay = 'Afternoon';
      else timeOfDay = 'Evening';
    }
    stop.time_of_day = timeOfDay;

    const color = DAY_COLORS[(dayNum - 1) % DAY_COLORS.length];
    stop.day_color = color;

    if (!dayMap.has(dayNum)) {
      dayMap.set(dayNum, {
        day_number: dayNum,
        day_title: `Day ${dayNum}`,
        color: color,
        sections: {
          Morning: [],
          Afternoon: [],
          Evening: []
        }
      });
    }

    const dayObj = dayMap.get(dayNum);
    if (!dayObj.sections[timeOfDay]) {
      dayObj.sections[timeOfDay] = [];
    }
    dayObj.sections[timeOfDay].push(stop);
  });

  return Array.from(dayMap.values()).map(d => ({
    day_number: d.day_number,
    day_title: `Day ${d.day_number}`,
    color: d.color,
    sections: [
      { time_of_day: 'Morning', title: 'Morning', stops: d.sections.Morning || [] },
      { time_of_day: 'Afternoon', title: 'Afternoon', stops: d.sections.Afternoon || [] },
      { time_of_day: 'Evening', title: 'Evening', stops: d.sections.Evening || [] }
    ].filter(s => s.stops.length > 0)
  }));
}

function normalizeItineraryResponse(payload, promptText = '') {
  if (!payload?.itinerary) return payload;

  const itinerary = payload.itinerary;
  let stops = Array.isArray(itinerary.stops) ? itinerary.stops : [];
  const travelSegments = Array.isArray(itinerary.travel_segments) ? itinerary.travel_segments : [];

  // Fix stop order numbers sequentially per stop
  stops = stops.map((stop, idx) => ({
    ...stop,
    order: stop.order || (idx + 1)
  }));

  let tiketWisata = 0;
  let kuliner = 0;
  let olehOleh = 0;

  stops.forEach((stop) => {
    const cost = Number(stop.estimated_cost) || 0;
    const cat = String(stop.category || '').toLowerCase();

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

  const daysStructure = buildDaysStructure(stops);

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
      title: itinerary.title || `Trip to ${itinerary.region || 'Indonesia'}`,
      dates: itinerary.dates || 'Hari 1 - Hari 2',
      total_estimated_cost: total,
      stops: stops,
      days: daysStructure,
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
              maxOutputTokens: 3000,
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

    // Dynamic Fallback Generator
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

function generateDynamicItinerary(prompt) {
  const p = prompt.toLowerCase();
  let city = 'Yogyakarta';
  let sampleStops = [];

  if (p.includes('bali') || p.includes('kuta') || p.includes('ubud') || p.includes('denpasar')) {
    city = 'Bali';
    sampleStops = [
      { day_number: 1, time_of_day: 'Morning', name: 'Tegallalang Rice Terrace', cat: 'wisata_alam', cost: 25000, dur: 90, lat: -8.4312, lng: 115.2792, desc: 'Pemandangan terasering sawah hijau yang memukau di Ubud.', tips: 'Gunakan pakaian terang untuk foto terbaik di ayunan.' },
      { day_number: 1, time_of_day: 'Afternoon', name: 'Warung Babi Guling Ibu Oka', cat: 'kuliner', cost: 55000, dur: 45, lat: -8.5069, lng: 115.2625, desc: 'Kuliner khas Bali otentik dengan kulit renyah dan bumbu genep.', tips: 'Datang sebelum jam makan siang agar tidak kehabisan.' },
      { day_number: 2, time_of_day: 'Afternoon', name: 'Pantai Tanah Lot', cat: 'pantai', cost: 30000, dur: 90, lat: -8.6212, lng: 115.0868, desc: 'Pura ikonik di atas batu karang dengan pemandangan sunset spektakuler.', tips: 'Cek jadwal pasang surut air laut sebelum mendekati pura.' },
      { day_number: 2, time_of_day: 'Evening', name: 'Krisna Oleh-Oleh Bali', cat: 'oleh_oleh', cost: 40000, dur: 45, lat: -8.7056, lng: 115.1764, desc: 'Pusat oleh-oleh khas Bali terlengkap mulai dari pie susu hingga kain pantai.', tips: 'Pie susu original adalah oleh-oleh favorit utama.' }
    ];
  } else if (p.includes('new york') || p.includes('nyc')) {
    city = 'New York City';
    sampleStops = [
      { day_number: 1, time_of_day: 'Morning', name: 'Breakfast at Breads Bakery (Union Square)', cat: 'kuliner', cost: 150000, dur: 45, lat: 40.7367, lng: -73.9904, desc: 'Famous bakery known for chocolate babka and fresh pastries.', tips: 'Try the legendary chocolate babka.' },
      { day_number: 1, time_of_day: 'Morning', name: 'A tour of the Tenement Museum', cat: 'wisata_sejarah', cost: 250000, dur: 90, lat: 40.7188, lng: -73.9901, desc: 'Immersive historical tour of immigrant life in New York.', tips: 'Book tickets online in advance.' },
      { day_number: 2, time_of_day: 'Afternoon', name: 'Lunch at Katz\'s Delicatessen', cat: 'kuliner', cost: 300000, dur: 60, lat: 40.7223, lng: -73.9874, desc: 'Iconic Jewish deli serving legendary pastrami on rye.', tips: 'Hang on to your ticket given at the door.' },
      { day_number: 2, time_of_day: 'Afternoon', name: 'Walk the Williamsburg Bridge', cat: 'wisata_alam', cost: 0, dur: 60, lat: 40.7136, lng: -73.9724, desc: 'Scenic bridge walk with views of Manhattan skyline.', tips: 'Great photo spot at golden hour.' },
      { day_number: 2, time_of_day: 'Evening', name: 'Local sights in Williamsburg', cat: 'oleh_oleh', cost: 100000, dur: 90, lat: 40.7142, lng: -73.9614, desc: 'Vibrant neighborhood with trendy boutiques, cafes, and street art.', tips: 'Explore Bedford Avenue for local shops.' }
    ];
  } else if (p.includes('bandung') || p.includes('lembang') || p.includes('braga')) {
    city = 'Bandung';
    sampleStops = [
      { day_number: 1, time_of_day: 'Morning', name: 'Kawah Putih Ciwidey', cat: 'wisata_alam', cost: 40000, dur: 90, lat: -7.1662, lng: 107.4021, desc: 'Danau kawah vulkanik berwarna putih kehijauan yang sangat fotogenik.', tips: 'Gunakan masker karena aroma belerang cukup kuat.' },
      { day_number: 1, time_of_day: 'Afternoon', name: 'Warung Nasi Ibu Imas', cat: 'kuliner', cost: 35000, dur: 45, lat: -6.9242, lng: 107.6045, desc: 'Kuliner Sunda legendaris dengan karedok dan sambal dadak pedas mantap.', tips: 'Sambal dadak dan ayam goreng basah adalah kombinasi wajib.' },
      { day_number: 2, time_of_day: 'Afternoon', name: 'Kopi Toko Djawa Jalan Braga', cat: 'kopi', cost: 25000, dur: 45, lat: -6.9175, lng: 107.6094, desc: 'Kedai kopi estetis khas Braga dengan Kopi Awan yang creamy.', tips: 'Beli bolu gulung cokelat sebagai pendamping kopi.' },
      { day_number: 2, time_of_day: 'Evening', name: 'Kartika Sari Hertasning', cat: 'oleh_oleh', cost: 50000, dur: 30, lat: -6.9125, lng: 107.6145, desc: 'Pusat pisang molen dan pastry khas Bandung ternama.', tips: 'Pisang keju molen fresh from the oven.' }
    ];
  } else {
    city = p.includes('brebes') ? 'Brebes' : 'Yogyakarta';
    sampleStops = [
      { day_number: 1, time_of_day: 'Morning', name: 'Candi Prambanan', cat: 'wisata_sejarah', cost: 50000, dur: 90, lat: -7.7520, lng: 110.4914, desc: 'Kompleks candi Hindu terbesar di Indonesia beraksitektur megah.', tips: 'Sewa pemandu lokal untuk cerita sejarah yang mendalam.' },
      { day_number: 1, time_of_day: 'Afternoon', name: 'Gudeg Yu Djum Wijilan', cat: 'kuliner', cost: 35000, dur: 45, lat: -7.8045, lng: 110.3645, desc: 'Gudeg Jogja otentik dengan krecek pedas dan telur bacem gurih.', tips: 'Beli kemasan besek atau kaleng jika ingin dijadikan oleh-oleh.' },
      { day_number: 2, time_of_day: 'Afternoon', name: 'Jalan Malioboro & Pasar Beringharjo', cat: 'oleh_oleh', cost: 30000, dur: 60, lat: -7.7928, lng: 110.3658, desc: 'Pusat belanja souvenir, batik, dan pernak-pemik khas Yogyakarta.', tips: 'Tawar harga dengan ramah saat membeli batik.' }
    ];
  }

  const stops = sampleStops.map((item, idx) => ({
    order: idx + 1,
    day_number: item.day_number,
    time_of_day: item.time_of_day,
    place_id: `place_${city.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx + 1}`,
    name: item.name,
    category: item.cat,
    arrival_time: item.time_of_day === 'Morning' ? '08:30' : item.time_of_day === 'Afternoon' ? '12:30' : '18:30',
    duration_minutes: item.dur,
    estimated_cost: item.cost,
    description: item.desc,
    tips: item.tips,
    location: { lat: item.lat, lng: item.lng }
  }));

  const travelSegments = [];
  for (let i = 0; i < stops.length - 1; i++) {
    travelSegments.push({
      from_order: i + 1,
      to_order: i + 2,
      distance_km: Number((2 + Math.random() * 4).toFixed(1)),
      travel_minutes: 20,
      transport: 'motor/mobil'
    });
  }

  return {
    itinerary: {
      title: `Trip To ${city}`,
      region: city,
      dates: '10/17/26 - 10/20/26',
      total_days: 2,
      total_duration_minutes: 275,
      total_estimated_cost: 0,
      stops: stops,
      travel_segments: travelSegments,
      budget_breakdown: {},
      ai_notes: `Itinerary ini disusun per hari dengan waktu Morning, Afternoon, & Evening untuk kawasan ${city}.`
    }
  };
}
