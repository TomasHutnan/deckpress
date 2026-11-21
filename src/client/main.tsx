import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/300-italic.css';
import '@fontsource/barlow-condensed/400-italic.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/900.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import '@fontsource/inter/300-italic.css';
import '@fontsource/inter/400-italic.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
