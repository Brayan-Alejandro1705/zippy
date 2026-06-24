import React from 'react';
import { useTheme } from '../context/ThemeContext';
import '../styles/dark-theme.css';

const ThemeToggle = () => {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      className={`theme-toggle-btn${isDark ? ' theme-toggle-btn--dark' : ''}`}
      onClick={toggle}
      aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <span className="ttb-track">
        <span className="ttb-star ttb-star--1">✦</span>
        <span className="ttb-star ttb-star--2">✦</span>
        <span className="ttb-thumb">
          <span className="ttb-icon">{isDark ? '🌙' : '☀️'}</span>
        </span>
      </span>
    </button>
  );
};

export default ThemeToggle;
