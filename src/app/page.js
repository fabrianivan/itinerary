'use client';

import { useState, useRef, useCallback } from 'react';
import PromptInput from '@/components/PromptInput';
import ItineraryTimeline from '@/components/ItineraryTimeline';
import BudgetSummary from '@/components/BudgetSummary';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import MapView from '@/components/MapView';

export default function Home() {
  const [itinerary, setItinerary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [userBudget, setUserBudget] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const scrollRef = useRef(null);

  const parseBudget = (prompt) => {
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
  };

  const handleSubmit = useCallback(async (prompt) => {
    setIsLoading(true);
    setError(null);
    setItinerary(null);
    setHasSearched(true);
    setUserBudget(parseBudget(prompt));

    try {
      const res = await fetch('/api/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal membuat itinerary');
      }

      const data = await res.json();
      if (!data.itinerary) {
        throw new Error('Format itinerary tidak valid');
      }
      setItinerary(data.itinerary);

      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleHover = useCallback((index) => {
    setActiveIndex(index);
  }, []);

  const handleCardClick = useCallback((index) => {
    setActiveIndex(index);
  }, []);

  const handleMarkerClick = useCallback((index) => {
    setActiveIndex(index);
    const card = document.getElementById(`itinerary-card-${index}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleRegenerate = useCallback(() => {
    const input = document.getElementById('prompt-input');
    if (input && input.value.trim()) {
      handleSubmit(input.value.trim());
    }
  }, [handleSubmit]);

  return (
    <div className="split-layout">
      {/* Left Panel — Prompt + Itinerary */}
      <div className="panel-left">
        <PromptInput onSubmit={handleSubmit} isLoading={isLoading} />

        <div className="panel-left-scroll" ref={scrollRef}>
          {/* Loading State */}
          {isLoading && <LoadingSkeleton />}

          {/* Error State */}
          {error && !isLoading && (
            <div className="error-state" style={{ padding: '24px', textAlign: 'center' }}>
              <div className="error-card" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '24px' }}>
                <h4 style={{ color: 'var(--danger)', marginBottom: '8px' }}>⚠️ Terjadi Kendala</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
                <button className="btn btn-primary" onClick={handleRegenerate} style={{ width: 'auto', margin: '0 auto', padding: '10px 24px' }}>
                  🔄 Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* Itinerary Results */}
          {itinerary && !isLoading && (
            <>
              <ItineraryTimeline
                itinerary={itinerary}
                activeIndex={activeIndex}
                onHover={handleHover}
                onClick={handleCardClick}
              />

              <BudgetSummary
                budget={itinerary.budget_breakdown}
                userBudget={userBudget}
              />

              {itinerary.ai_notes && (
                <div className="card-tips" style={{ marginTop: '20px' }}>
                  <span>💡</span>
                  <span>{itinerary.ai_notes}</span>
                </div>
              )}

              <div className="action-buttons">
                <button className="btn btn-primary" onClick={handleRegenerate}>
                  🔄 Buat Variasi Baru
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: itinerary.title,
                        text: `Rencana Perjalanan AI: ${itinerary.title}`,
                        url: window.location.href,
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert('Link itinerary berhasil disalin!');
                    }
                  }}
                >
                  📤 Bagikan
                </button>
              </div>
            </>
          )}

          {/* Welcome Hero State */}
          {!hasSearched && !isLoading && (
            <div className="welcome-state">
              <div className="welcome-badge">✨ Powered by Gemma 4</div>
              <h1 className="welcome-title">Jelajahi Indonesia dengan AI Personal</h1>
              <p className="welcome-desc">
                Cukup ketik destinasi kota, waktu, budget, dan impian wisatamu. AI akan merancang rute perjalanan & kuliner terbaik secara instan.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Map */}
      <div className="panel-right">
        <MapView
          stops={itinerary?.stops}
          activeIndex={activeIndex}
          onMarkerClick={handleMarkerClick}
        />
      </div>
    </div>
  );
}
