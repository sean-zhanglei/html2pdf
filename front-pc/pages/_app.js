'use client';

import React, { useEffect, useState } from 'react';
import '@/styles/globals.css';

export default function _app({ Component, pageProps }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // 检查本地存储和系统偏好
    const isDark =
      localStorage.getItem('darkMode') === 'true' ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches &&
        !localStorage.getItem('darkMode'));
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
    document.documentElement.classList.toggle('dark', newMode);
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Component {...pageProps} toggleDarkMode={toggleDarkMode} />
    </div>
  );
}
