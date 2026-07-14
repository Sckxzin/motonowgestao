// Aplica tema salvo
if (localStorage.getItem('mn_theme') === 'light') {
  document.body.classList.add('light');
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
