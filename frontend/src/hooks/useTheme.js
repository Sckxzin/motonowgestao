import { useEffect, useState } from 'react';

export default function useTheme() {
  const [light, setLight] = useState(() => localStorage.getItem('mn_theme') === 'light');

  useEffect(() => {
    if (light) {
      document.body.classList.add('light');
      localStorage.setItem('mn_theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('mn_theme', 'dark');
    }
  }, [light]);

  return [light, () => setLight(v => !v)];
}
