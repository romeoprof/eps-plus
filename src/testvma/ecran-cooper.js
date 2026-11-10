/* Demi-Cooper, utilisable par les élèves : un gros bouton à chaque repère, la vitesse en direct. */
import { bip, garderEcranAllume, vibrer } from '../noyau/appareil.js';
import { etat, sauver } from '../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir, vue } from '../noyau/interface.js';
import { decimal, esc, formatChrono } from '../noyau/outils.js';
import { allureFinale, annulerPassage, distanceAuPlot, distanceFinaleValide, enregistrerPassage } from '../demifond/calculs.js';
import { COOPER_DEFAUT, cooperEnDirect, DUREE_COOPER, nouveauDemiCooper, resultatCooper } from './cooper.js';

/* Signaux sonores : à mi-parcours et à la dernière minute. */
const ANNONCES = [
  { reste: 180, texte: 'Mi-parcours : encore 3 minutes !' },
  { reste: 60, texte: 'Dernière minute !' },
];
let annoncesFaites = new Set();
let testSuivi = null;

/* Toujours le même objet : une ancienne sauvegarde sans demi-Cooper reçoit les valeurs de départ. */
export const cooper = () => {
  if (!etat.testVma.cooper) etat.testVma.cooper = { ...COOPER_DEFAUT };
  return etat.testVma.cooper;
};
const leTest = () => cooper().test;
export const cooperEnCours = () => !!leTest() && !leTest().finLe;
const tempsEcoule = (t = leTest(), maintenant = Date.now()) => ((t.finLe || maintenant) - t.depart) / 1000;
const kmh = (n) => (n == null ? '–' : decimal(n.toFixed(1)));
const lireNombre = (texte) => {
  const propre = String(texte).trim().replace(',', '.');
  return propre === '' ? 0 : parseFloat(propre);
};

/* Après un rechargement, les annonces déjà passées ne sonnent pas une seconde fois. */
function suivreAnnonces(test) {
  if (testSuivi === test.id) return;
  testSuivi = test.id;
  const reste = DUREE_COOPER - tempsEcoule(test);
  annoncesFaites = new Set(ANNONCES.filter((a) => reste <= a.reste).map((a) => a.reste));
}

function actualiser() {
  if (!cooperEnCours()) return;
  const test = leTest();
  suivreAnnonces(test);
  const t = tempsEcoule(test);
  if (t >= DUREE_COOPER) {
    test.finLe = test.depart + DUREE_COOPER * 1000;
    bip(990, 0.8, 0.35);
    sauver();
    if (vue.ecran === 'testvma') rafraichir();
    return;
  }
  const reste = DUREE_COOPER - t;
  ANNONCES.forEach((a) => {
    if (reste <= a.reste && !annoncesFaites.has(a.reste)) {
      annoncesFaites.add(a.reste);
      bip(1300, 0.18, 0.3);
      setTimeout(() => bip(1300, 0.18, 0.3), 260);
      notifier(a.texte);
    }
  });
  const chrono = document.querySelector('#tvc-restant');
  if (chrono) chrono.textContent = formatChrono(Math.ceil(reste));
}
setInterval(actualiser, 100);

/* L'appui compte dès que le doigt touche l'écran. */
function appuyer() {
  const test = leTest();
  if (!cooperEnCours()) return;
  const resultat = enregistrerPassage(test, 0);
  if (!resultat.accepte) {
    if (resultat.raison === 'double') notifier('Double appui ignoré');
    return;
  }
  vibrer();
  bip(880);
  sauver();
  rafraichir();
}
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest?.('[data-repere]')) return;
  e.preventDefault();
  appuyer();
});
document.addEventListener('click', (e) => {
  if (e.target.closest?.('[data-repere]') && e.detail === 0) appuyer();
});

declarerActions({
  'tvc-nom': (_, champ) => {
    cooper().nom = champ.value.trim();
    sauver();
  },
  'tvc-plots': (_, champ) => {
    const v = lireNombre(champ.value);
    if (!(v >= 10 && v <= 400)) {
      notifier('Distance entre repères : entre 10 et 400 m.');
      return rafraichir();
    }
    cooper().plots = v;
    sauver();
  },
  'tvc-depart': () => {
    bip(990, 0.35, 0.3);
    cooper().test = nouveauDemiCooper(cooper(), Date.now());
    garderEcranAllume();
    sauver();
    rafraichir();
  },
  'tvc-annuler': () => {
    if (!cooperEnCours() || !annulerPassage(leTest())) return;
    sauver();
    rafraichir();
    notifier('Dernier repère annulé');
  },
  'tvc-abandon': async () => {
    const ok = await demander({
      titre: 'Arrêter le test ?',
      texte: 'Le test sera effacé. Il faudra recommencer les 6 minutes.',
      confirmer: 'Arrêter',
      danger: true,
    });
    if (!ok) return;
    cooper().test = null;
    sauver();
    rafraichir();
  },
  'tvc-distance-saisie': (_, champ) => {
    const test = leTest();
    const c = test.coureurs[0];
    const metres = lireNombre(champ.value);
    const valide = distanceFinaleValide(test, c, metres);
    const allure = valide ? allureFinale(test, c, metres) : null;
    const affichage = document.querySelector('#tvc-allure');
    affichage.textContent = !valide ? 'Distance impossible' : allure == null ? '–' : `${kmh(allure)} km/h`;
    affichage.classList.toggle('erreur', !valide);
  },
  'tvc-distance-valider': () => {
    const test = leTest();
    const c = test.coureurs[0];
    const metres = lireNombre(document.querySelector('#tvc-distance').value);
    if (!distanceFinaleValide(test, c, metres)) return notifier('Distance impossible.');
    c.distanceFinale = metres;
    sauver();
    rafraichir();
  },
  'tvc-nouveau': () => {
    cooper().test = null;
    sauver();
    rafraichir();
  },
});

const vueAvant = () => `
  <div class="carte"><h2 class="carte-titre">⏱️ Demi-Cooper</h2>
    <p><b>Cours le plus loin possible en 6 minutes</b>, à une allure régulière. Ton camarade touche le gros bouton à chaque repère.</p>
    <p class="aide">VMA (km/h) = distance parcourue (m) ÷ 100. C'est une estimation : ne pars pas trop vite.</p>
    <div class="grille-parametres">
      <label>Prénom du coureur (facultatif)<input value="${esc(cooper().nom)}" autocomplete="off" data-choix="tvc-nom"></label>
      <label>Distance entre repères (m)<input inputmode="numeric" value="${decimal(cooper().plots)}" data-choix="tvc-plots"></label>
    </div>
  </div>
  <button class="btn bouton-depart bouton-large-depart" data-action="tvc-depart">▶ Départ</button>`;

function vuePendant(test) {
  const d = cooperEnDirect(test);
  const reste = Math.ceil(DUREE_COOPER - tempsEcoule(test));
  const nom = test.coureurs[0].nom;
  return `
    <div class="cooper-haut">
      <div><span>Temps restant</span><b id="tvc-restant" class="chrono-test">${formatChrono(reste)}</b></div>
      ${nom ? `<div class="cooper-nom">${esc(nom)}</div>` : ''}
    </div>
    <div class="cooper-direct">
      <div class="tuile-focus"><span>Distance</span><b>${d.distance} m</b></div>
      <div class="tuile-focus suivant"><span>Vitesse (dernier repère)</span><b>${kmh(d.vitesse)}</b></div>
      <div class="tuile-focus passe"><span>VMA estimée en direct</span><b>${kmh(d.vmaEstimee)}</b></div>
      <div class="tuile-focus"><span>Distance prévue à ce rythme</span><b>${d.distancePrevue == null ? '–' : `${d.distancePrevue} m`}</b></div>
    </div>
    <button class="bouton-repere" data-repere aria-label="Repère passé : ajouter ${decimal(test.plots)} mètres">
      🏁 REPÈRE<small>+ ${decimal(test.plots)} m · ${d.reperes} repère${d.reperes > 1 ? 's' : ''}</small>
    </button>
    <div class="rangee centre-rangee marge-haut">
      <button class="btn secondaire" data-action="tvc-annuler" ${test.journal.length ? '' : 'disabled'}>↩ Annuler le dernier</button>
      <button class="btn secondaire" data-action="tvc-abandon">Arrêter le test</button>
    </div>`;
}

function fenetreFinale(test) {
  const n = test.coureurs[0].passages.length;
  return `<div class="fenetre-fond"><div class="fenetre fenetre-distances" role="dialog" aria-modal="true" aria-labelledby="tvc-titre-fin">
    <h2 id="tvc-titre-fin">⏱️ Temps écoulé !</h2>
    <p>Combien de mètres le coureur a-t-il parcourus <b>depuis le dernier repère</b> ?</p>
    <div class="ligne-distance">
      <label for="tvc-distance"><b>Après le dernier repère</b><small>dernier repère : ${distanceAuPlot(test, n)} m</small></label>
      <span class="champ-metres"><input id="tvc-distance" inputmode="decimal" placeholder="0" data-saisie="tvc-distance-saisie"> m</span>
      <output id="tvc-allure" class="allure-finale">–</output>
    </div>
    <button class="btn bouton-large marge-haut" data-action="tvc-distance-valider">Voir ma VMA</button>
  </div></div>`;
}

function vueResultat(test) {
  const r = resultatCooper(test);
  const nom = test.coureurs[0].nom;
  const statistique = (libelle, valeur) => `<div class="tuile-stat"><b>${valeur}</b><span>${libelle}</span></div>`;
  const segments = r.vitesses
    .map((v, i) => {
      const dernier = r.allureFinale != null && i === r.vitesses.length - 1;
      return `<li><span>${dernier ? 'Fin' : `Repère ${i + 1}`}</span><b>${kmh(v)} km/h</b></li>`;
    })
    .join('');
  return `
    <div class="carte carte-resultat"><h2 class="carte-titre">🏁 Résultat du demi-Cooper${nom ? ` · ${esc(nom)}` : ''}</h2>
      <div class="tuiles-stats">
        <div class="tuile-stat tuile-principale"><b>${kmh(r.vma)} km/h</b><span>VMA</span></div>
        ${statistique('Distance en 6 min', `${r.distance} m`)}
        ${statistique('Vitesse max (entre deux repères)', `${kmh(r.vitesseMax)} km/h`)}
        ${statistique('Régularité', r.regularite == null ? '–' : `${r.regularite}/100`)}
      </div>
      <p class="aide">Note ta VMA sur ta fiche. Calcul : ${r.distance} m ÷ 100 = ${kmh(r.vma)} km/h.</p>
      ${segments ? `<h4>Vitesse entre les repères</h4><ul class="liste-vitesses">${segments}</ul>` : ''}
    </div>
    <button class="btn bouton-large" data-action="tvc-nouveau">↺ Nouveau test</button>`;
}

export function vueCooper() {
  const test = leTest();
  if (!test) return vueAvant();
  if (!test.finLe) {
    garderEcranAllume();
    return vuePendant(test);
  }
  if (test.coureurs[0].distanceFinale == null) return vuePendant(test) + fenetreFinale(test);
  return vueResultat(test);
}
