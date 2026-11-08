/* Onglet Course : un appui sur la carte d'un coureur à chaque passage de plot. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir, vue } from '../../noyau/interface.js';
import { avecSigne, decimal, esc, formatChrono } from '../../noyau/outils.js';
import { CONSIGNES } from '../contenu.js';
import {
  allureFinale,
  annulerPassage,
  avanceeSegment,
  consigne,
  distanceAuPlot,
  distanceFinaleValide,
  dureeSegmentPrevue,
  enregistrerPassage,
  estArrive,
  plotsPrevus,
  projetCoureur,
  tempsCourse,
  vitesseInstantanee,
  vitesseMoyenne,
} from '../calculs.js';
import { courseEnCours, reglagesDemifond } from '../etat.js';

/* Place du grand trait sur la barre (en %) : l'espace après lui montre le retard. */
const POSITION_PLOT = 80;

let vueSimple = false;
let contexteAudio = null;
let verrouEcran = null;

const kmh = (n) => (n == null ? '–' : decimal(n.toFixed(1)));
const signe = avecSigne;

function jouer(frequence, duree = 0.13) {
  if (!reglagesDemifond().sons) return;
  try {
    contexteAudio = contexteAudio || new (window.AudioContext || window.webkitAudioContext)();
    contexteAudio.resume?.();
    const oscillateur = contexteAudio.createOscillator();
    const volume = contexteAudio.createGain();
    oscillateur.frequency.value = frequence;
    volume.gain.value = 0.15;
    oscillateur.connect(volume).connect(contexteAudio.destination);
    oscillateur.start();
    oscillateur.stop(contexteAudio.currentTime + duree);
  } catch {
    /* son non disponible */
  }
}

const SONS = { super: 880, accelere: 330, ralentis: 520 };

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

const etatCoureur = (course, c) =>
  estArrive(course, c) ? 'fin' : consigne(vitesseInstantanee(course, c), c.cible, course.tolerance);

const projetDe = (course, c) => projetCoureur(c.cible, course);

function tuileCoureur(course, c, rang) {
  const etatActuel = etatCoureur(course, c);
  const n = c.passages.length;
  const projet = projetDe(course, c);
  const prevus = course.type === 'distance' ? plotsPrevus(course) : Math.round(projet.distance / course.plots);
  const moyenne = vitesseMoyenne(course, c);
  const ecart = moyenne == null ? null : moyenne - c.cible;
  const actif = course.depart && etatActuel !== 'fin';
  return `<button class="tuile-course etat-${etatActuel}" ${actif ? `data-plot="${rang}"` : 'disabled'} aria-label="Passage de plot pour ${esc(c.nom)}">
    <span class="tc-haut">
      <b class="tc-nom">${esc(c.nom)}</b>
      <span class="tc-consigne">${CONSIGNES[etatActuel]}</span>
      <span class="tc-plots"><b>${n}</b><small>plot${n > 1 ? 's' : ''}</small></span>
    </span>
    <span class="tc-barre" aria-hidden="true">
      <i id="df-avance-${rang}" style="width:0%"></i>
      <u class="trait-moitie" style="left:${POSITION_PLOT / 2}%"></u>
      <u class="trait-plot" style="left:${POSITION_PLOT}%"></u>
    </span>
    <span class="tc-infos">
      <span><b>${kmh(vitesseInstantanee(course, c))}</b><small>km/h</small></span>
      <span><b>${kmh(moyenne)}</b><small>moyenne</small></span>
      <span><b>${Math.max(0, prevus - n)}</b><small>restants</small></span>
      <span><b>${signe(ecart)}</b><small>écart</small></span>
    </span>
    <span class="tc-bas">Projet ${kmh(c.cible)} km/h · <span id="df-prochain-${rang}">${Math.round(projet.parPlot)} s/plot</span></span>
  </button>`;
}

/* Un appui compte dès que le doigt touche l'écran : plusieurs coureurs peuvent passer en même temps. */
function appuyer(element) {
  const course = courseEnCours();
  if (!course) return;
  const rang = Number(element.dataset.plot);
  const resultat = enregistrerPassage(course, rang);
  if (!resultat.accepte) {
    if (resultat.raison === 'double') notifier(`Double appui ignoré : ${course.coureurs[rang].nom}`);
    return;
  }
  const c = course.coureurs[rang];
  const nouvelEtat = etatCoureur(course, c);
  try {
    navigator.vibrate?.(40);
  } catch {
    /* non disponible */
  }
  jouer(SONS[nouvelEtat] || 660);
  sauver();
  element.outerHTML = tuileCoureur(course, c, rang);
  actualiser();
  const bouton = document.querySelector('[data-action="df-annuler"]');
  if (bouton) bouton.disabled = false;
}

document.addEventListener('pointerdown', (e) => {
  const element = e.target.closest?.('[data-plot]');
  if (!element) return;
  e.preventDefault();
  appuyer(element);
});
/* Au clavier, le clic n'a pas de position de doigt (detail = 0). */
document.addEventListener('click', (e) => {
  const element = e.target.closest?.('[data-plot]');
  if (element && e.detail === 0) appuyer(element);
});

function actualiser() {
  const course = courseEnCours();
  const chrono = document.querySelector('#df-chrono');
  if (!course || !chrono || !course.depart) return;
  const t = tempsCourse(course);
  if (course.finLe) return;
  /* Course sur temps : elle s'arrête seule, puis on demande les distances finales. */
  if (course.type === 'temps' && t >= course.duree) {
    course.finLe = course.depart + course.duree * 1000;
    jouer(990, 0.7);
    sauver();
    rafraichir();
    return;
  }
  chrono.textContent = formatChrono(t);
  course.coureurs.forEach((c, rang) => {
    if (estArrive(course, c)) return;
    /* La barre avance à la vitesse du projet et atteint le grand trait à l'heure prévue au plot. */
    const avancee = avanceeSegment(course, c, t);
    const barre = document.querySelector(`#df-avance-${rang}`);
    if (barre) {
      barre.style.width = `${Math.min(100, avancee * POSITION_PLOT)}%`;
      barre.classList.toggle('en-retard', avancee > 1);
    }
    const prochain = document.querySelector(`#df-prochain-${rang}`);
    if (prochain) {
      const reste = Math.round(dureeSegmentPrevue(course, c) * (1 - avancee));
      prochain.textContent = reste >= 0 ? `plot dans ${reste} s` : `retard ${-reste} s`;
    }
  });
}

setInterval(actualiser, 100);

const lireMetres = (texte) => {
  const propre = String(texte).trim().replace(',', '.');
  return propre === '' ? 0 : parseFloat(propre);
};

function terminer(course) {
  course.finLe = course.finLe || Date.now();
  etat.courseBilan = course.id;
  etat.courseEnCours = null;
  vue.ongletDF = 'bilan';
  sauver();
  rafraichir();
}

declarerActions({
  'df-depart': () => {
    const course = courseEnCours();
    if (!course || course.depart) return;
    course.depart = Date.now();
    jouer(990, 0.35);
    garderEcranAllume();
    sauver();
    rafraichir();
  },
  'df-annuler': () => {
    const course = courseEnCours();
    const c = course && annulerPassage(course);
    if (!c) return;
    sauver();
    rafraichir();
    notifier(`Dernier plot annulé : ${c.nom}`);
  },
  'df-simple': () => {
    vueSimple = !vueSimple;
    rafraichir();
  },
  'df-distance-saisie': ({ rang }, champ) => {
    const course = courseEnCours();
    const c = course?.coureurs[rang];
    const affichage = document.querySelector(`#df-allure-${rang}`);
    if (!c || !affichage) return;
    const metres = lireMetres(champ.value);
    const valide = distanceFinaleValide(course, c, metres);
    const allure = valide ? allureFinale(course, c, metres) : null;
    affichage.textContent = !valide ? 'Distance impossible' : allure == null ? '–' : `${kmh(allure)} km/h`;
    affichage.classList.toggle('erreur', !valide);
  },
  'df-distances-valider': () => {
    const course = courseEnCours();
    if (!course) return;
    const saisies = course.coureurs.map((c, rang) => ({
      c,
      metres: lireMetres(document.querySelector(`#df-distance-${rang}`)?.value ?? ''),
    }));
    const erreur = saisies.find(({ c, metres }) => !distanceFinaleValide(course, c, metres));
    if (erreur) return notifier(`Distance impossible : ${erreur.c.nom}`);
    saisies.forEach(({ c, metres }) => {
      c.distanceFinale = metres;
    });
    terminer(course);
  },
  'df-terminer': async () => {
    const course = courseEnCours();
    if (!course) return;
    if (course.coureurs.some((c) => !estArrive(course, c))) {
      const ok = await demander({
        titre: 'Terminer la course ?',
        texte: "Tous les coureurs n'ont pas fini. Les passages déjà notés seront gardés.",
        confirmer: 'Terminer',
      });
      if (!ok) return;
    }
    terminer(course);
  },
  'df-abandon': async () => {
    const course = courseEnCours();
    if (!course) return;
    const ok = await demander({
      titre: 'Annuler cette course ?',
      texte: 'Elle sera effacée, ainsi que ses passages déjà notés.',
      confirmer: 'Annuler la course',
      danger: true,
    });
    if (!ok) return;
    etat.courses = etat.courses.filter((c) => c.id !== course.id);
    etat.courseEnCours = null;
    vue.ongletDF = 'projet';
    sauver();
    rafraichir();
  },
});

/* Fin d'une course sur temps : distance de chaque coureur depuis son dernier plot. */
function fenetreDistances(course) {
  const lignes = course.coureurs
    .map((c, rang) => {
      const n = c.passages.length;
      return `<div class="ligne-distance">
        <label for="df-distance-${rang}"><b>${esc(c.nom)}</b><small>dernier plot : ${distanceAuPlot(course, n)} m</small></label>
        <span class="champ-metres"><input id="df-distance-${rang}" inputmode="decimal" placeholder="0" data-saisie="df-distance-saisie" data-rang="${rang}"> m</span>
        <output id="df-allure-${rang}" class="allure-finale">–</output>
      </div>`;
    })
    .join('');
  return `<div class="fenetre-fond"><div class="fenetre fenetre-distances" role="dialog" aria-modal="true" aria-labelledby="titre-fin">
    <h2 id="titre-fin">⏱️ Temps écoulé !</h2>
    <p>Quelle distance chaque coureur a-t-il parcourue <b>depuis son dernier plot</b> ?</p>
    <div class="liste-distances">${lignes}</div>
    <button class="btn bouton-large" data-action="df-distances-valider">Valider et voir le bilan</button>
  </div></div>`;
}

export function vueCourse() {
  const course = courseEnCours();
  if (!course) {
    return `<div class="carte centre"><p class="aide">Aucune course en cours.</p>
      <button class="btn" data-action="df-onglet" data-onglet="projet">Préparer une course</button></div>`;
  }
  const objectif = course.type === 'distance'
    ? `${decimal(course.distance / 1000)} km`
    : formatChrono(course.duree);
  if (course.depart) garderEcranAllume();
  const annulable = course.journal.length > 0;
  return `
    <div class="barre-course">
      <div class="barre-course-chrono"><b id="df-chrono">${formatChrono(tempsCourse(course))}</b><small>${objectif} · plots tous les ${course.plots} m · ±${decimal(course.tolerance)} km/h</small></div>
      ${
        course.depart
          ? `<button class="btn secondaire" data-action="df-annuler" ${annulable ? '' : 'disabled'}>↩ Annuler le dernier</button>
             <button class="btn secondaire" aria-pressed="${vueSimple}" data-action="df-simple">👁 ${vueSimple ? 'Vue détaillée' : 'Vue simple'}</button>
             ${
               course.type === 'distance'
                 ? `<button class="btn contour-rouge" id="df-terminer" data-action="df-terminer">🏁 Terminer</button>`
                 : `<button class="btn secondaire" data-action="df-abandon">Annuler la course</button>`
             }`
          : `<button class="btn bouton-depart" data-action="df-depart">▶ Départ</button>
             <button class="btn secondaire" data-action="df-abandon">Annuler la course</button>`
      }
    </div>
    <div class="grille-course ${vueSimple ? 'simple' : ''}">
      ${course.coureurs.map((c, rang) => tuileCoureur(course, c, rang)).join('')}
    </div>
    ${course.type === 'temps' && course.finLe ? fenetreDistances(course) : ''}`;
}
