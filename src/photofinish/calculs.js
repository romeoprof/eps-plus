/*
 * PhotoFinish : calculs sans caméra ni micro, vérifiés par les tests.
 * - mouvement sur la ligne d'arrivée (comparaison de deux images de la bande filmée) ;
 * - détecteur de passages (un passage par coureur, puis réarmement) ;
 * - reconnaissance du coup de sifflet dans le spectre du son.
 */

export const REGLAGES_PF = {
  depart: 'sifflet', // 'sifflet', 'toucher' ou 'decompte'
  ligne: 0.5, // position de la ligne dans l'image, de 0 (gauche) à 1 (droite)
  haut: 0.1, // zone surveillée sur la ligne, de 0 (haut) à 1 (bas)
  bas: 0.95,
  sensibilite: 60, // détection des passages, de 5 à 100
  sensibiliteSifflet: 50, // de 0 à 100
  camera: 'environment', // caméra arrière par défaut
  libelle: '',
  classe: '',
};

export const ECART_PIXEL = 20; // différence de luminosité (0 à 255) qui compte comme un changement
export const DELAI_MIN = 150; // ms minimum entre deux passages détectés

/* Luminosité moyenne de chaque ligne de la bande (pixels RVBA de largeur × hauteur). */
export function luminositesLignes(pixels, largeur, hauteur) {
  const lignes = new Float32Array(hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    let somme = 0;
    for (let x = 0; x < largeur; x += 1) {
      const i = (y * largeur + x) * 4;
      somme += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    }
    lignes[y] = somme / largeur;
  }
  return lignes;
}

const mediane = (valeurs) => {
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri.length ? tri[Math.floor(tri.length / 2)] : 0;
};

/* Part des lignes de la bande qui ont changé (0 à 1).
   Un changement de lumière de toute l'image (nuage, réglage automatique de la caméra)
   est retiré : seule compte la différence par rapport à la variation générale. */
export function partEnMouvement(actuelles, precedentes, ecart = ECART_PIXEL) {
  if (!precedentes || precedentes.length !== actuelles.length || !actuelles.length) return 0;
  const differences = Array.from(actuelles, (v, i) => v - precedentes[i]);
  const generale = mediane(differences);
  const changees = differences.filter((d) => Math.abs(d - generale) > ecart).length;
  return changees / actuelles.length;
}

/* Sensibilité 5 à 100 → part de la bande qui doit bouger pour compter un passage. */
export const seuilMouvement = (sensibilite) => Math.min(0.5, Math.max(0.025, (105 - sensibilite) / 200));

/* Un passage au début du mouvement sur la ligne ; le détecteur se réarme quand la ligne est redevenue calme. */
export const nouveauDetecteur = () => ({ arme: true, calme: 0, dernier: -Infinity });

export function analyserImage(detecteur, part, temps, seuil) {
  if (detecteur.arme) {
    if (part >= seuil && temps - detecteur.dernier >= DELAI_MIN) {
      detecteur.arme = false;
      detecteur.calme = 0;
      detecteur.dernier = temps;
      return true;
    }
    return false;
  }
  if (part < seuil / 2) {
    detecteur.calme += 1;
    if (detecteur.calme >= 2) detecteur.arme = true;
  } else {
    detecteur.calme = 0;
  }
  return false;
}

/* Son : niveau le plus fort entre 1 800 et 4 500 Hz (le sifflet), comparé au niveau moyen.
   octets : spectre de 0 à 255 (getByteFrequencyData), hzParCase = fréquence d'échantillonnage ÷ taille FFT. */
export function analyseSon(octets, hzParCase) {
  const caseDe = (hz) => Math.min(octets.length - 1, Math.round(hz / hzParCase));
  let niveau = 0;
  for (let i = caseDe(1800); i <= caseDe(4500); i += 1) niveau = Math.max(niveau, octets[i]);
  let somme = 0;
  const debut = caseDe(200);
  const fin = caseDe(8000);
  for (let i = debut; i <= fin; i += 1) somme += octets[i];
  const moyenne = somme / (fin - debut + 1);
  return { niveau, contraste: niveau - moyenne };
}

/* Sensibilité 0 à 100 → niveau à atteindre (0 à 255). */
export const seuilSifflet = (sensibilite) => Math.round(235 - sensibilite * 1.3);
/* Un sifflet est un son fort et aigu, bien au-dessus du bruit ambiant (voix, applaudissements). */
export const CONTRASTE_SIFFLET = 45;
export const estSifflet = (son, sensibilite) =>
  son.niveau >= seuilSifflet(sensibilite) && son.contraste >= CONTRASTE_SIFFLET;

/* Temps en millisecondes → « 12,34 » ou « 1:02,34 » (centièmes tronqués, comme un chrono). */
export function formatTemps(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '–';
  const centiemes = Math.floor(ms / 10);
  const minutes = Math.floor(centiemes / 6000);
  const secondes = Math.floor((centiemes % 6000) / 100);
  const reste = String(centiemes % 100).padStart(2, '0');
  return minutes ? `${minutes}:${String(secondes).padStart(2, '0')},${reste}` : `${secondes},${reste}`;
}

export const nouvelleCourse = ({ methode, libelle = '', classe = '' }, depart) => ({
  id: `pf${depart}`,
  depart, // heure du départ (Date.now)
  methode,
  libelle,
  classe,
  fin: null,
  passages: [], // { id, t (ms après le départ), source, eleveId, nom }
});

export const passagesTries = (course) => [...course.passages].sort((a, b) => a.t - b.t);

export function ajouterPassage(course, t, source) {
  const passage = { id: `p${course.passages.length}-${Math.round(t)}`, t: Math.max(0, Math.round(t)), source, eleveId: '', nom: '' };
  while (course.passages.some((p) => p.id === passage.id)) passage.id += 'b';
  course.passages.push(passage);
  return passage;
}

export const nomPassage = (passage, eleves) =>
  (passage.eleveId && eleves.find((e) => e.id === passage.eleveId)?.nom) || passage.nom || '';

/* Classement exportable : Rang ; Temps (s) ; Nom ; Classe */
export function lignesCsvCourse(course, eleves) {
  const lignes = [['Rang', 'Temps (s)', 'Nom', 'Classe']];
  passagesTries(course).forEach((p, i) => {
    const eleve = eleves.find((e) => e.id === p.eleveId);
    lignes.push([String(i + 1), formatTemps(p.t), nomPassage(p, eleves), eleve?.classe || course.classe || '']);
  });
  return lignes;
}
