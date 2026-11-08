/* Petite courbe d'évolution : une valeur entre 0 et 1 par rencontre. */
export function courbe(parts, description = 'Part des points gagnés à chaque rencontre') {
  const L = 240;
  const H = 64;
  const points = parts.map((v, i) => [parts.length > 1 ? 12 + (i * (L - 24)) / (parts.length - 1) : L / 2, H - 10 - v * (H - 20)]);
  return `<svg class="courbe" viewBox="0 0 ${L} ${H}" role="img" aria-label="${description}">
    <polyline fill="none" stroke="#2563eb" stroke-width="2" points="${points.map((p) => p.join(',')).join(' ')}"/>
    ${points.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#ea580c"/><text x="${p[0]}" y="${p[1] - 6}" font-size="9" text-anchor="middle">${Math.round(parts[i] * 100)} %</text>`).join('')}
  </svg>`;
}
