/* Dessins des terrains à zones (sports de raquette), sur une grille de 100 × 160. */
const LIGNES = '<g fill="none" stroke="#fff" stroke-width="1.1">';
const FILET = '<path d="M4 80H96" stroke="#111" stroke-width="2.4"/><path d="M4 80H96" stroke="#fff" stroke-width="1" stroke-dasharray="1.5 1.5"/>';

const dessin = (fond, couleur, [x, y, l, h], interieur) =>
  `<rect width="100" height="160" fill="${fond}"/><rect x="${x}" y="${y}" width="${l}" height="${h}" fill="${couleur}"/>${LIGNES}<rect x="${x}" y="${y}" width="${l}" height="${h}"/>${interieur}</g>`;

const TABLE = [12, 8, 76, 144];
const COURT = [18, 10, 64, 140];

export const TERRAINS = {
  'Tennis de table': {
    cadre: TABLE,
    svg: dessin('#d9e2e8', '#1b5fa6', TABLE, `<path d="M50 8V152"/>${FILET}`),
  },
  Badminton: {
    cadre: COURT,
    svg: dessin('#cfe3d8', '#2e8b6e', COURT, `<path d="M23 10V150M77 10V150M18 59H82M18 101H82M50 10V59M50 101V150M18 18H82M18 142H82"/>${FILET}`),
  },
};

/* Nom lisible d'une zone (0 à 17). */
export function nomZone(zone) {
  const profondeur = zone < 9 ? ['fond', 'milieu', 'filet'] : ['filet', 'milieu', 'fond'];
  return `${profondeur[Math.floor((zone % 9) / 3)]} ${['gauche', 'centre', 'droite'][zone % 3]}`;
}
