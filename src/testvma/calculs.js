/* Test VMA à paliers, sans affichage. Vitesses en km/h, distances en m, temps en s. */

export const PARAMETRES_DEFAUT = { vitesse: 10, increment: 1, duree: 120, distance: 25 };
const VITESSE_PLAFOND = 25;
const VO2_PAR_KMH = 3.5;

const BORNES = {
  vitesse: [3, VITESSE_PLAFOND, 'Vitesse initiale : entre 3 et 25 km/h.'],
  increment: [0.1, 5, 'Incrémentation : entre 0,1 et 5 km/h.'],
  duree: [10, 600, "Durée d'un palier : entre 10 et 600 secondes."],
  distance: [5, 200, 'Distance entre repères : entre 5 et 200 m.'],
};

/* Renvoie le message d'erreur d'un paramètre, ou null s'il est correct. */
export function erreurParametre(nom, valeur) {
  const [min, max, message] = BORNES[nom];
  return valeur >= min && valeur <= max ? null : message;
}

/* Paliers du test. Un palier contient autant de repères entiers que sa durée le permet :
   il peut donc durer un peu moins que la durée demandée. */
export function paliersDuTest({ vitesse, increment, duree, distance }) {
  const paliers = [];
  let temps = 0;
  for (let rang = 0; ; rang += 1) {
    const v = Math.round((vitesse + rang * increment) * 100) / 100;
    if (v > VITESSE_PLAFOND) break;
    const parRepere = distance / (v / 3.6);
    const nombre = Math.max(1, Math.floor(duree / parRepere));
    const passages = [];
    for (let i = 0; i < nombre; i += 1) {
      temps += parRepere;
      passages.push(temps);
    }
    paliers.push({ numero: rang + 1, vitesse: v, passages });
  }
  return paliers;
}

/* Tous les passages à la suite, avec leur palier et leur place dans ce palier. */
const aPlat = (paliers) =>
  paliers.flatMap((palier) => palier.passages.map((t, i) => ({ palier, colonne: i + 1, t })));

/* Où en est le test à l'instant t : dernier repère passé et repère suivant. */
export function situationTest(paliers, t) {
  const liste = aPlat(paliers);
  let rang = -1;
  while (rang + 1 < liste.length && liste[rang + 1].t <= t) rang += 1;
  return {
    rang,
    dernier: rang >= 0 ? liste[rang] : null,
    suivant: liste[rang + 1] || null,
    total: liste.length,
  };
}

/* VMA : vitesse du palier + part de l'incrément selon l'avancée dans ce palier. */
export function resultatTest(paliers, t, parametres) {
  const { dernier, rang } = situationTest(paliers, t);
  const palier = dernier ? dernier.palier : paliers[0];
  const avancee = dernier ? dernier.colonne / palier.passages.length : 0;
  const vma = palier.vitesse + parametres.increment * avancee;
  return {
    vma,
    vo2: vma * VO2_PAR_KMH,
    palier: palier.numero,
    reperes: rang + 1,
    distance: (rang + 1) * parametres.distance,
    temps: t,
  };
}
