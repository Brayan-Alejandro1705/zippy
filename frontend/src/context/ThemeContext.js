import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => useContext(ThemeContext);

const prefersDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export const ThemeProvider = ({ children }) => {
  // Sin preferencia guardada -> seguimos el tema del sistema operativo.
  // Con preferencia guardada -> el usuario la eligió a mano, respetamos esa elección.
  const hasManualOverride = useRef(localStorage.getItem('theme') !== null);
  const [isDark, setIsDark] = useState(() =>
    hasManualOverride.current ? localStorage.getItem('theme') === 'dark' : prefersDarkQuery().matches
  );

  useEffect(() => {
    document.body.classList.toggle('dark-theme', isDark);
    if (hasManualOverride.current) {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (hasManualOverride.current) return;
    const mq = prefersDarkQuery();
    const onChange = e => setIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    hasManualOverride.current = true;
    setIsDark(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};
