/* Logo d'EPS + (écran d'accueil). Le même dessin sert d'icône de l'application. */
export const logoSvg = (titre = 'EPS +') => `
<svg class="logo-eps" viewBox="0 0 180 180" role="img" aria-label="${titre}">
  <rect width="180" height="180" rx="44" fill="#1d4ed8"/>
  <path d="M0 132 L180 62 L180 180 L0 180 Z" fill="#2563eb"/>
  <g transform="translate(98 80) skewX(-14)">
    <rect x="-17" y="-52" width="34" height="104" rx="9" fill="#f97316"/>
    <rect x="-52" y="-17" width="104" height="34" rx="9" fill="#f97316"/>
  </g>
  <path d="M22 64 L60 64 M14 82 L48 82 M26 100 L54 100" stroke="#bfdbfe" stroke-width="7" stroke-linecap="round"/>
  <text x="118" y="160" text-anchor="middle" transform="skewX(-10)" style="font: 900 italic 34px sans-serif; fill: #ffffff; letter-spacing: 1px">EPS</text>
</svg>`;
