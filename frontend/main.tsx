import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dynamically load MapMyIndia SDK from environment variables
const mapplsKey = import.meta.env.VITE_MAPPLS_KEY || import.meta.env.VITE_MAPMYINDIA_MAP_KEY;
if (mapplsKey && typeof document !== 'undefined') {
  if (!document.getElementById('mappls-sdk-script')) {
    const s1 = document.createElement('script');
    s1.id = 'mappls-sdk-script';
    s1.src = `https://apis.mappls.com/advancedmaps/api/${mapplsKey}/map_sdk?layer=vector&v=3.0`;
    document.head.appendChild(s1);

    const s2 = document.createElement('script');
    s2.id = 'mappls-plugins-script';
    s2.src = `https://apis.mappls.com/advancedmaps/api/${mapplsKey}/map_sdk_plugins?v=3.0`;
    document.head.appendChild(s2);
  }
}

// Production-ready version
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
} else {
  console.error("Root element not found!");
}