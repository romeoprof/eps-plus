/* Test VMA : réglages personnalisés, bip à chaque repère, vue Focus ou tableau complet. */
import { etat, sauver } from '../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir, vue } from '../noyau/interface.js';
import { decimal, esc, formatChrono } from '../noyau/outils.js';
import { erreurParametre, paliersDuTest, PARAMETRES_DEFAUT, resultatTest, situationTest } from './calculs.js';

let affichage = 'focus';
let rangConnu = null;
let brouillon = null; // valeurs saisies, pas encore validées
let contexteAudio = null;
let verrouEcran = null;

const CHAMPS = [
  { nom: 'vitesse', libelle: 'Vitesse initiale (km/h)', mode: 'decimal' },
  { nom: 'increment', libelle: 'Incrémentation des paliers (km/h)', mode: 'decimal' },
  { nom: 'duree', libelle: "Durée d'un palier (secondes)", mode: 'numeric' },
  { nom: 'distance', libelle: 'Distance entre repères (m)', mode: 'numeric' },
];

const test = () => etat.testVma;
const valeurAffichee = (nom) => brouillon?.[nom] ?? decimal(test()[nom]);
const enCours = () => !!test().depart && !test().arret;
const tempsEcoule = (maintenant = Date.now()) =>
  test().depart ? ((test().arret || maintenant) - test().depart) / 1000 : 0;
const kmh = (n) => decimal(n.toFixed(1));

function bip(frequence = 1000, duree = 0.12, volume = 0.22) {
  try {
    contexteAudio = contexteAudio || new (window.AudioContext || window.webkitAudioContext)();
    contexteAudio.resume?.();
    const debut = contexteAudio.currentTime;
    const oscillateur = contexteAudio.createOscillator();
    const gain = contexteAudio.createGain();
    oscillateur.frequency.value = frequence;
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
    oscillateur.connect(gain).connect(contexteAudio.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
  } catch {
    /* son non disponible */
  }
}

function garderEcranAllume() {
  try {
    if (navigator.wakeLock && !verrouEcran) {
      navigator.wakeLock
        .request('screen')
        .then((v) => {
          verrouEcran = v;
          v.addEventListener('release', () => {
            verrouEcran = null;
          });
        })
        .catch(() => {});
    }
  } catch {
    /* non disponible */
  }
}

function terminer() {
  test().arret = Date.now();
  rangConnu = null;
  sauver();
  if (vue.ecran === 'testvma') rafraichir();
}

/* Vérifié souvent : le bip reste fidèle au temps de passage. Un seul bip si l'écran a été en veille. */
function actualiser() {
  if (!enCours()) return;
  const paliers = paliersDuTest(test());
  const t = tempsEcoule();
  const situation = situationTest(paliers, t);
  const chrono = document.querySelector('#tv-chrono');
  if (chrono) chrono.textContent = formatChrono(t);
  if (rangConnu === null) rangConnu = situation.rang;
  if (situation.rang !== rangConnu) {
    const changePalier = situation.dernier?.colonne === 1;
    rangConnu = situation.rang;
    if (changePalier) bip(1400, 0.25, 0.3);
    else bip();
    if (!situation.suivant) {
      notifier('Dernier palier terminé.');
      terminer();
      return;
    }
    if (vue.ecran === 'testvma') rafraichir();
  }
}
setInterval(actualiser, 50);

declarerActions({
  'tv-saisie': ({ nom }, champ) => {
    brouillon = { ...brouillon, [nom]: champ.value };
    document.querySelector('[data-action="tv-valider"]')?.classList.add('a-valider');
  },
  'tv-valider': () => {
    const valeurs = {};
    for (const { nom } of CHAMPS) {
      const valeur = parseFloat(String(valeurAffichee(nom)).replace(',', '.'));
      const erreur = erreurParametre(nom, valeur);
      if (erreur) return notifier(erreur);
      valeurs[nom] = valeur;
    }
    Object.assign(test(), valeurs);
    brouillon = null;
    sauver();
    rafraichir();
    notifier('Test mis à jour ✔');
  },
  'tv-defaut': () => {
    Object.assign(test(), PARAMETRES_DEFAUT);
    brouillon = null;
    sauver();
    rafraichir();
  },
  'tv-depart': () => {
    if (brouillon) return notifier('Valide d\'abord tes valeurs.');
    bip(1000, 0.05, 0.05); // débloque le son sur tablette
    test().depart = Date.now();
    test().arret = null;
    rangConnu = -1;
    garderEcranAllume();
    sauver();
    rafraichir();
  },
  'tv-stop': async () => {
    const ok = await demander({
      titre: 'Arrêter le test ?',
      texte: 'La VMA sera calculée à partir du dernier repère passé.',
      confirmer: 'Arrêter',
      danger: true,
    });
    if (ok && enCours()) terminer();
  },
  'tv-zero': () => {
    test().depart = null;
    test().arret = null;
    rangConnu = null;
    sauver();
    rafraichir();
  },
  'tv-affichage': ({ mode }) => {
    affichage = mode;
    rafraichir();
  },
});

const carteReglages = () => `
  <div class="carte"><h2 class="carte-titre">⚙️ Réglages du test</h2>
    <div class="grille-parametres">
      ${CHAMPS.map(
        (c) => `<label>${esc(c.libelle)}<input inputmode="${c.mode}" value="${esc(valeurAffichee(c.nom))}" data-saisie="tv-saisie" data-nom="${c.nom}"></label>`,
      ).join('')}
    </div>
    <div class="rangee sans-marge">
      <button class="btn ${brouillon ? 'a-valider' : ''}" data-action="tv-valider">✓ Valider ces valeurs</button>
      <button class="btn secondaire" data-action="tv-defaut">Rétablir les valeurs d'origine</button>
    </div>
    <p class="aide marge-haut">Les valeurs restent enregistrées sur cette tablette. Un palier contient un nombre entier de repères : il peut durer un peu moins que la durée choisie.</p>
  </div>`;

function carteResultat(paliers) {
  const r = resultatTest(paliers, tempsEcoule(), test());
  return `<div class="carte carte-resultat"><h2 class="carte-titre">🏁 Résultat du test</h2>
    <div class="tuiles-stats">
      <div class="tuile-stat tuile-principale"><b>${kmh(r.vma)} km/h</b><span>VMA</span></div>
      <div class="tuile-stat"><b>${kmh(r.vo2)}</b><span>VO₂max estimée (ml/kg/min)</span></div>
      <div class="tuile-stat"><b>${r.palier}</b><span>Palier atteint</span></div>
      <div class="tuile-stat"><b>${r.distance} m</b><span>${r.reperes} repère${r.reperes > 1 ? 's' : ''}</span></div>
      <div class="tuile-stat"><b>${formatChrono(r.temps)}</b><span>Temps</span></div>
    </div>
  </div>`;
}

function vueFocus(situation, paliers) {
  const palier = situation.suivant?.palier || situation.dernier?.palier || paliers[0];
  return `<div class="focus-test">
    <div class="tuile-focus"><span>Palier</span><b>${palier.numero}</b></div>
    <div class="tuile-focus"><span>Vitesse (km/h)</span><b>${kmh(palier.vitesse)}</b></div>
    <div class="tuile-focus passe"><span>Dernier temps</span><b>${formatChrono(situation.dernier?.t ?? 0)}</b></div>
    <div class="tuile-focus suivant"><span>Temps suivant</span><b>${situation.suivant ? formatChrono(situation.suivant.t) : '–'}</b></div>
  </div>`;
}

function vueTableau(situation, paliers) {
  const lignes = paliers
    .map((palier) => {
      const actif = (situation.suivant?.palier || situation.dernier?.palier) === palier;
      const cases = palier.passages
        .map((t) => {
          const suivant = situation.suivant?.t === t;
          const passe = situation.dernier && t <= situation.dernier.t;
          return `<td class="${passe ? 'case-passee' : ''} ${suivant ? 'case-suivante' : ''}">${formatChrono(t)}</td>`;
        })
        .join('');
      return `<tr class="${actif ? 'ligne-active' : ''}"><th scope="row">${palier.numero}</th><th scope="row">${kmh(palier.vitesse)}</th>${cases}</tr>`;
    })
    .join('');
  return `<div class="tableau-test" id="tv-tableau"><table>
    <thead><tr><th>Palier</th><th>km/h</th><th class="titre-temps">Temps de passage</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table></div>`;
}

/* Garde la ligne en cours au milieu du tableau. */
function centrerLigne() {
  requestAnimationFrame(() => {
    const zone = document.querySelector('#tv-tableau');
    const ligne = zone?.querySelector('.ligne-active');
    const cible = zone?.querySelector('.case-suivante') || ligne;
    if (!zone || !ligne || !cible) return;
    zone.scrollTop = ligne.offsetTop - zone.clientHeight / 2;
    zone.scrollLeft = cible.offsetLeft - zone.clientWidth / 2;
  });
}

export function vueTestVma() {
  const paliers = paliersDuTest(test());
  const t = tempsEcoule();
  const situation = situationTest(paliers, t);
  const fini = !!test().arret;
  const onglet = (mode, libelle) =>
    `<button class="choix-sport ${affichage === mode ? 'actif' : ''}" aria-pressed="${affichage === mode}" data-action="tv-affichage" data-mode="${mode}">${libelle}</button>`;
  let commandes;
  if (enCours()) {
    garderEcranAllume();
    commandes = `<button class="btn bouton-stop" data-action="tv-stop">⏹ Stop</button>`;
  } else if (fini) {
    commandes = `<button class="btn bouton-depart" data-action="tv-depart">▶ Nouveau départ</button>
      <button class="btn secondaire" data-action="tv-zero">↺ Remettre à zéro</button>`;
  } else {
    commandes = `<button class="btn bouton-depart" data-action="tv-depart">▶ Départ</button>`;
  }
  if (affichage === 'tout') centrerLigne();
  return `
    <div class="barre-course">
      <div class="barre-course-chrono"><b id="tv-chrono" class="chrono-test">${formatChrono(t)}</b></div>
      ${commandes}
    </div>
    ${fini ? carteResultat(paliers) : ''}
    ${enCours() ? '' : carteReglages()}
    <div class="carte">
      <div class="rangee">
        <h2 class="etire titre-passage">Temps de passage par palier</h2>
        <div class="choix-sports sans-marge">${onglet('focus', 'Focus')}${onglet('tout', 'Tout')}</div>
      </div>
      ${affichage === 'focus' ? vueFocus(situation, paliers) : vueTableau(situation, paliers)}
    </div>`;
}
