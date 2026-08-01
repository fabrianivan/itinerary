'use client';

import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  { emoji: '🏛️', label: 'Yogyakarta 2 Hari' },
  { emoji: '🏖️', label: 'Bali Sunset & Pantai' },
  { emoji: '⛰️', label: 'Bandung Wisata Alam' },
  { emoji: '🍖', label: 'Kuliner Legendaris' },
  { emoji: '☕', label: 'Ngopi & Cafe Hopping' },
  { emoji: '👨‍👩‍👧', label: 'Piknik Keluarga' },
  { emoji: '💰', label: 'Budget Rp200rb' },
  { emoji: '🛍️', label: 'Oleh-oleh Khas' },
];

const PLACEHOLDERS = [
  'Yogyakarta 2 hari, budget Rp500rb, wisata candi & kuliner legendaris...',
  'Bali 1 hari, pantai & sunset, kuliner babi guling / halal, Rp300rb...',
  'Bandung 4 jam, ngopi di Braga & belanja oleh-oleh...',
  'Malang 1 hari, museum angkut & bakso legendaris, Rp250rb...',
  'Jakarta 1 hari, wisata sejarah Kota Tua & Soto Betawi...',
  'Ketik destinasi mana saja di Indonesia / Dunia...'
];

export default function PromptInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const textareaRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || isLoading) return;
    onSubmit(value.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChipClick = (label) => {
    const prefix = value.trim() ? value.trim() + ', ' : '';
    setValue(prefix + label.toLowerCase());
    textareaRef.current?.focus();
  };

  return (
    <div className="prompt-container">
      <div className="prompt-wrapper">
        <textarea
          ref={textareaRef}
          className="prompt-input"
          placeholder={PLACEHOLDERS[placeholderIndex]}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
          id="prompt-input"
        />
        <button
          className={`prompt-submit ${isLoading ? 'loading' : ''}`}
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          title="Buatkan Itinerary AI"
          id="submit-button"
        >
          {isLoading ? '⏳' : '✨'}
        </button>
      </div>
      <div className="chips-container">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            className="chip"
            onClick={() => handleChipClick(s.label)}
            disabled={isLoading}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
