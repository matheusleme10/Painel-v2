import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.jsx';
import { sha256 } from './utils/security.js';

sha256('ITAL123').then((hash) => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    React.createElement(App, { correctHash: hash })
  );
});
