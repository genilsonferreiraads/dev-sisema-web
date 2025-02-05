import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Manipuladores de erro - definidos antes da renderização
const originalError = console.error;
const originalWarn = console.warn;

// Sobrescreve o console.error
console.error = function(...args) {
  if (args.some(arg => 
    String(arg).includes('query') || 
    (arg instanceof Error && String(arg.stack).includes('content.js'))
  )) {
    return; // Suprime o erro
  }
  originalError.apply(console, args);
};

// Sobrescreve o console.warn
console.warn = function(...args) {
  if (args.some(arg => 
    String(arg).includes('query') || 
    (arg instanceof Error && String(arg.stack).includes('content.js'))
  )) {
    return; // Suprime o aviso
  }
  originalWarn.apply(console, args);
};

// Manipulador global de erros não tratados
window.addEventListener('unhandledrejection', function(event) {
  if (event.reason instanceof Error && 
      (String(event.reason).includes('query') || 
       String(event.reason.stack).includes('content.js'))) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
); 