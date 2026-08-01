import './globals.css';

export const metadata = {
  title: 'itinerary.ai — Rencanakan Perjalananmu di Indonesia dengan AI',
  description: 'Asisten perjalanan AI modern berbasis Gemma 4 yang merancang itinerary wisata & kuliner lokal di seluruh wilayah Indonesia dan dunia.',
  keywords: ['itinerary', 'wisata', 'UMKM', 'AI', 'travel planner', 'Indonesia', 'kuliner lokal', 'Gemma 4'],
  openGraph: {
    title: 'itinerary.ai — Rencanakan Perjalananmu dengan AI',
    description: 'Rekomendasi perjalanan wisata & UMKM lokal dipersonalisasi AI untuk seluruh wilayah Indonesia.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {/* Navbar */}
        <nav className="navbar">
          <a href="/" className="navbar-brand" id="nav-brand">
            <span className="sparkle">✨</span>
            <span>itinerary.ai</span>
          </a>
          <div className="navbar-badge">
            🇮🇩 Destinasi Seluruh Indonesia & Dunia
          </div>
        </nav>

        {/* Main Content */}
        <main className="app-container">
          {children}
        </main>
      </body>
    </html>
  );
}
