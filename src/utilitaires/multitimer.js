/*
 * MULTI-TIMER (Utilitaires) : un outil simple, sans élèves ni enregistrement de résultats.
 *  - Chrono : départ, pause, tours (le meilleur tour est repéré).
 *  - Multichrono : plusieurs chronos côte à côte (départ commun ou un par un), avec tours.
 *  - Intervalles : préparation, travail / repos × séries, avec bips de fin de phase.
 *  - Minuteur : compte à rebours qui sonne à zéro.
 * Seuls les réglages sont gardés (durées, noms des chronos, son) ; les temps restent en mémoire.
 */
import { bip, garderEcranAllume, vibrer } from '../noyau/appareil.js';
import { etat, sauver } from '../noyau/etat.js';
import { declarerActions, rafraichir, vue } from '../noyau/interface.js';
import { esc } from '../noyau/outils.js';
import { arreter, borner, chronoVide, demarrer, dureeTotale, ecoule, formatDuree, phaseIntervalles, resteSecondes } from './minuteurs.js';

const MODES = [
  { id: 'chrono', libelle: '⏱️ Chrono' },
  { id: 'multi', libelle: '🏁 Multichrono' },
  { id: 'intervalles', libelle: '🔁 Intervalles' },
  { id: 'minuteur', libelle: '⏳ Minuteur' },
];
const PRESETS_INTERVALLES = [
  { nom: 'Tabata 20/10 × 8', prepa: 10, travail: 20, repos: 10, series: 8 },
  { nom: '30/30 × 10', prepa: 10, travail: 30, repos: 30, series: 10 },
  { nom: '45/15 × 8', prepa: 10, travail: 45, repos: 15, series: 8 },
  { nom: '1 min / 1 min × 5', prepa: 10, travail: 60, repos: 60, series: 5 },
];
const PRESETS_MINUTEUR = [30, 60, 120, 180, 300, 600]; // secondes
const PHASES = { prepa: 'Préparation', travail: 'Travail', repos: 'Repos', fini: 'Terminé' };
const MAX_CHRONOS = 8;

function reglages() {
  if (!etat.multitimer) {
    etat.multitimer = {
      mode: 'chrono',
      son: true,
      noms: ['Chrono 1', 'Chrono 2', 'Chrono 3', 'Chrono 4'],
      intervalles: { ...PRESETS_INTERVALLES[1] },
      minuteur: 300,
    };
  }
  return etat.multitimer;
}

/* Temps en cours : en mémoire seulement. */
const mt = {
  chrono: { c: chronoVide(), tours: [] },
  multi: [],
  int: { c: chronoVide(), rang: -1, bip: -1 },
  minu: { c: chronoVide(), bip: -1, fini: false },
};

function lignesMulti() {
  const noms = reglages().noms;
  while (mt.multi.length < noms.length) mt.multi.push({ c: chronoVide(), tours: [] });
  mt.multi.length = noms.length;
  return mt.multi;
}

const son = (frequence, duree, volume) => reglages().son && bip(frequence, duree, volume);
const lancer = (c) => {
  demarrer(c);
  garderEcranAllume();
};

/* ---------- Textes mis à jour 10 fois par seconde ---------- */
function texte(cle) {
  const r = reglages();
  if (cle === 'chrono') return formatDuree(ecoule(mt.chrono.c));
  if (cle.startsWith('multi-')) return formatDuree(ecoule(lignesMulti()[Number(cle.slice(6))]?.c ?? chronoVide()));
  if (cle === 'int-reste' || cle === 'int-total') {
    const ms = ecoule(mt.int.c);
    const p = phaseIntervalles(r.intervalles, ms);
    if (cle === 'int-reste') return formatDuree(resteSecondes(p.reste, 0) * 1000, { dixiemes: false });
    return formatDuree(dureeTotale(r.intervalles) - ms, { dixiemes: false });
  }
  if (cle === 'minuteur') return formatDuree(resteSecondes(r.minuteur * 1000, ecoule(mt.minu.c)) * 1000, { dixiemes: false });
  return '';
}

/* Intervalles : bip à chaque changement de phase, et « 3, 2, 1 » avant la fin de chaque phase. */
function surveillerIntervalles() {
  const { c } = mt.int;
  if (c.debut == null) return false;
  const r = reglages();
  const p = phaseIntervalles(r.intervalles, ecoule(c));
  if (p.fini) {
    arreter(c);
    c.cumul = dureeTotale(r.intervalles);
    mt.int.rang = p.rang;
    son(880, 0.9, 0.3);
    vibrer([300, 120, 300]);
    return true;
  }
  let change = false;
  if (p.rang !== mt.int.rang) {
    mt.int.rang = p.rang;
    mt.int.bip = -1;
    son(p.phase === 'travail' ? 1320 : 660, 0.45, 0.3);
    vibrer(p.phase === 'travail' ? 200 : 80);
    change = true;
  }
  const s = resteSecondes(p.reste, 0);
  if (s <= 3 && s >= 1 && s !== mt.int.bip) {
    mt.int.bip = s;
    son(990, 0.1);
  }
  return change;
}

function surveillerMinuteur() {
  const { c } = mt.minu;
  if (c.debut == null) return false;
  const duree = reglages().minuteur * 1000;
  const s = resteSecondes(duree, ecoule(c));
  if (s <= 0) {
    arreter(c);
    c.cumul = duree;
    mt.minu.fini = true;
    [0, 350, 700].forEach((d) => setTimeout(() => son(1100, 0.3, 0.3), d));
    vibrer([400, 150, 400, 150, 400]);
    return true;
  }
  if (s <= 3 && s !== mt.minu.bip) {
    mt.minu.bip = s;
    son(990, 0.1);
  }
  return false;
}

/* Les sons partent même si l'on regarde un autre écran ; l'affichage n'est mis à jour que sur celui-ci. */
let horloge = null;
function demarrerHorloge() {
  if (horloge) return;
  horloge = setInterval(() => {
    const change = [surveillerIntervalles(), surveillerMinuteur()].some(Boolean);
    if (vue.ecran !== 'multitimer') return;
    if (change) return rafraichir();
    document.querySelectorAll('[data-mt]').forEach((el) => {
      const t = texte(el.dataset.mt);
      if (el.textContent !== t) el.textContent = t;
    });
  }, 100);
}

/* ---------- Actions ---------- */
const basculer = (c) => (c.debut == null ? lancer(c) : arreter(c));

declarerActions({
  'mt-mode': ({ mode }) => {
    reglages().mode = mode;
    sauver();
    rafraichir();
  },
  'mt-son': () => {
    reglages().son = !reglages().son;
    sauver();
    rafraichir();
  },

  /* Chrono */
  'mt-chrono': () => {
    basculer(mt.chrono.c);
    rafraichir();
  },
  'mt-tour': () => {
    if (mt.chrono.c.debut == null) return;
    mt.chrono.tours.push(ecoule(mt.chrono.c));
    rafraichir();
  },
  'mt-chrono-zero': () => {
    mt.chrono = { c: chronoVide(), tours: [] };
    rafraichir();
  },

  /* Multichrono */
  'mt-multi': ({ i }) => {
    basculer(lignesMulti()[Number(i)].c);
    rafraichir();
  },
  'mt-multi-tour': ({ i }) => {
    const l = lignesMulti()[Number(i)];
    if (l.c.debut == null) return;
    l.tours.push(ecoule(l.c));
    rafraichir();
  },
  'mt-multi-zero': ({ i }) => {
    lignesMulti()[Number(i)] = { c: chronoVide(), tours: [] };
    rafraichir();
  },
  'mt-multi-tous': () => {
    const t = Date.now(); // le même instant pour tous
    lignesMulti().forEach((l) => l.c.debut == null && ecoule(l.c) === 0 && demarrer(l.c, t));
    garderEcranAllume();
    rafraichir();
  },
  'mt-multi-stop': () => {
    const t = Date.now();
    lignesMulti().forEach((l) => arreter(l.c, t));
    rafraichir();
  },
  'mt-multi-raz': () => {
    mt.multi = [];
    rafraichir();
  },
  'mt-multi-nombre': ({ pas }) => {
    const noms = reglages().noms;
    if (Number(pas) > 0 && noms.length < MAX_CHRONOS) noms.push(`Chrono ${noms.length + 1}`);
    if (Number(pas) < 0 && noms.length > 1) noms.pop();
    sauver();
    rafraichir();
  },
  'mt-nom': ({ i }, champ) => {
    reglages().noms[Number(i)] = champ.value.trim().slice(0, 20) || `Chrono ${Number(i) + 1}`;
    sauver();
  },

  /* Intervalles */
  'mt-int': () => {
    const { c } = mt.int;
    if (phaseIntervalles(reglages().intervalles, ecoule(c)).fini) mt.int = { c: chronoVide(), rang: -1, bip: -1 };
    basculer(mt.int.c);
    rafraichir();
  },
  'mt-int-zero': () => {
    mt.int = { c: chronoVide(), rang: -1, bip: -1 };
    rafraichir();
  },
  'mt-int-reglage': ({ cle }, champ) => {
    mt.int = { c: chronoVide(), rang: -1, bip: -1 }; // seulement possible à l'arrêt ou une fois terminé
    const bornes = { prepa: [0, 120, 10], travail: [1, 3600, 30], repos: [0, 3600, 15], series: [1, 99, 8] }[cle];
    reglages().intervalles[cle] = borner(champ.value, ...bornes);
    delete reglages().intervalles.nom;
    sauver();
    rafraichir();
  },
  'mt-int-preset': ({ n }) => {
    reglages().intervalles = { ...PRESETS_INTERVALLES[Number(n)] };
    mt.int = { c: chronoVide(), rang: -1, bip: -1 };
    sauver();
    rafraichir();
  },

  /* Minuteur */
  'mt-minu': () => {
    if (mt.minu.fini) mt.minu = { c: chronoVide(), bip: -1, fini: false };
    basculer(mt.minu.c);
    if (mt.minu.c.debut != null) son(990, 0.08, 0.15); // débloque aussi le son sur la tablette
    rafraichir();
  },
  'mt-minu-zero': () => {
    mt.minu = { c: chronoVide(), bip: -1, fini: false };
    rafraichir();
  },
  'mt-minu-duree': ({ s, pas }) => {
    const r = reglages();
    r.minuteur = s ? Number(s) : Math.max(5, Math.min(5940, r.minuteur + Number(pas)));
    if (s) mt.minu = { c: chronoVide(), bip: -1, fini: false };
    sauver();
    rafraichir();
  },
});

/* ---------- Affichage ---------- */
const bouton = (action, libelle, classe = '', attrs = '') => `<button class="btn ${classe}" data-action="${action}" ${attrs}>${libelle}</button>`;
const departArret = (c, action, attrs = '') =>
  c.debut == null ? bouton(action, ecoule(c) ? '▶ Reprendre' : '▶ Départ', 'mt-go', attrs) : bouton(action, '⏸ Stop', 'danger', attrs);

function vueChrono() {
  const { c, tours } = mt.chrono;
  const durees = tours.map((t, i) => t - (tours[i - 1] ?? 0));
  const meilleur = durees.length > 1 ? Math.min(...durees) : null;
  const liste = tours
    .map((t, i) => `<li class="${durees[i] === meilleur ? 'mt-meilleur' : ''}"><span>Tour ${i + 1}</span><b>${formatDuree(durees[i])}</b><span>${formatDuree(t)}</span></li>`)
    .reverse()
    .join('');
  return `<div class="mt-ecran"><div class="mt-temps" data-mt="chrono">${texte('chrono')}</div></div>
    <div class="mt-boutons">
      ${departArret(c, 'mt-chrono')}
      ${c.debut != null ? bouton('mt-tour', '🔁 Tour', 'secondaire') : bouton('mt-chrono-zero', '⟲ Remettre à zéro', 'secondaire', ecoule(c) ? '' : 'disabled')}
    </div>
    ${tours.length ? `<ol class="mt-tours">${liste}</ol>` : ''}`;
}

function vueMulti() {
  const r = reglages();
  const lignes = lignesMulti();
  const enCours = lignes.some((l) => l.c.debut != null);
  const lignesHtml = lignes
    .map((l, i) => {
      const dernier = l.tours.length ? l.tours[l.tours.length - 1] - (l.tours[l.tours.length - 2] ?? 0) : null;
      return `<div class="mt-ligne ${l.c.debut != null ? 'actif' : ''}">
        <input class="mt-nom" value="${esc(r.noms[i])}" maxlength="20" aria-label="Nom du chrono ${i + 1}" data-choix="mt-nom" data-i="${i}">
        <div class="mt-ligne-temps"><b data-mt="multi-${i}">${texte(`multi-${i}`)}</b>${l.tours.length ? `<small>${l.tours.length} tour${l.tours.length > 1 ? 's' : ''} · dernier ${formatDuree(dernier)}</small>` : ''}</div>
        ${departArret(l.c, 'mt-multi', `data-i="${i}"`)}
        <button class="btn secondaire" data-action="mt-multi-tour" data-i="${i}" ${l.c.debut == null ? 'disabled' : ''}>🔁 Tour</button>
        <button class="btn-rond" aria-label="Remettre ${esc(r.noms[i])} à zéro" data-action="mt-multi-zero" data-i="${i}" ${ecoule(l.c) ? '' : 'disabled'}>⟲</button>
      </div>`;
    })
    .join('');
  return `<div class="mt-boutons">
      ${bouton('mt-multi-tous', '▶ Départ commun', 'mt-go')}
      ${bouton('mt-multi-stop', '⏸ Tout arrêter', 'danger', enCours ? '' : 'disabled')}
      ${bouton('mt-multi-raz', '⟲ Tout à zéro', 'secondaire', lignes.some((l) => ecoule(l.c)) ? '' : 'disabled')}
    </div>
    <div class="mt-lignes">${lignesHtml}</div>
    <div class="vl-ecart">
      <span class="etiquette">Nombre de chronos</span>
      <button class="btn-rond" aria-label="Un chrono de moins" data-action="mt-multi-nombre" data-pas="-1" ${lignes.length <= 1 ? 'disabled' : ''}>−</button>
      <b>${lignes.length}</b>
      <button class="btn-rond" aria-label="Un chrono de plus" data-action="mt-multi-nombre" data-pas="1" ${lignes.length >= MAX_CHRONOS ? 'disabled' : ''}>+</button>
    </div>
    <p class="aide">« Départ commun » lance d'un coup les chronos encore à zéro ; chacun s'arrête ensuite avec son bouton. Touche un nom pour le changer (groupe, couloir…).</p>`;
}

function vueIntervalles() {
  const cfg = reglages().intervalles;
  const { c } = mt.int;
  const ms = ecoule(c);
  const p = phaseIntervalles(cfg, ms);
  const demarre = ms > 0;
  const phase = demarre ? p.phase : 'attente';
  const bloque = demarre && !p.fini ? 'disabled' : ''; // réglages fermés pendant une séance (en pause aussi)
  const champ = (cle, libelle) =>
    `<label class="mt-champ">${libelle}<input type="number" inputmode="numeric" value="${cfg[cle]}" data-choix="mt-int-reglage" data-cle="${cle}" ${bloque}></label>`;
  return `<div class="mt-ecran mt-${phase}">
      <div class="mt-phase">${demarre ? PHASES[p.phase] : 'Prêt'}</div>
      <div class="mt-temps" data-mt="int-reste">${demarre ? texte('int-reste') : formatDuree((cfg.prepa || cfg.travail) * 1000, { dixiemes: false })}</div>
      <div class="mt-infos">${p.fini ? `${cfg.series} séries faites 💪` : `Série ${Math.max(1, p.serie)} / ${cfg.series} · reste <span data-mt="int-total">${texte('int-total')}</span>`}</div>
    </div>
    <div class="mt-boutons">
      ${p.fini ? bouton('mt-int', '▶ Recommencer', 'mt-go') : departArret(c, 'mt-int')}
      ${bouton('mt-int-zero', '⟲ Remettre à zéro', 'secondaire', demarre ? '' : 'disabled')}
    </div>
    <div class="mt-reglages">
      ${champ('prepa', 'Préparation (s)')}${champ('travail', 'Travail (s)')}${champ('repos', 'Repos (s)')}${champ('series', 'Séries')}
    </div>
    <div class="mt-presets">${PRESETS_INTERVALLES.map(
      (pr, n) => `<button class="choix-sport ${cfg.nom === pr.nom ? 'actif' : ''}" aria-pressed="${cfg.nom === pr.nom}" data-action="mt-int-preset" data-n="${n}" ${bloque}>${pr.nom}</button>`,
    ).join('')}</div>
    <p class="aide">Un bip aigu lance le travail, un bip grave le repos ; trois bips courts annoncent la fin de chaque phase. Pour changer les durées, remets d'abord à zéro.</p>`;
}

const libelleDuree = (s) => (s < 60 ? `${s} s` : `${s / 60} min`);
function vueMinuteur() {
  const r = reglages();
  const { c, fini } = mt.minu;
  return `<div class="mt-ecran ${fini ? 'mt-fini' : c.debut != null ? 'mt-travail' : ''}">
      ${fini ? '<div class="mt-phase">Terminé !</div>' : ''}
      <div class="mt-temps" data-mt="minuteur">${texte('minuteur')}</div>
    </div>
    <div class="mt-boutons">
      ${fini ? bouton('mt-minu', '▶ Relancer', 'mt-go') : departArret(c, 'mt-minu')}
      ${bouton('mt-minu-zero', '⟲ Remettre à zéro', 'secondaire', ecoule(c) || fini ? '' : 'disabled')}
    </div>
    <div class="mt-presets">
      ${PRESETS_MINUTEUR.map((s) => `<button class="choix-sport ${r.minuteur === s ? 'actif' : ''}" aria-pressed="${r.minuteur === s}" data-action="mt-minu-duree" data-s="${s}">${libelleDuree(s)}</button>`).join('')}
    </div>
    <div class="mt-presets">
      ${[-60, -10, 10, 60].map((pas) => `<button class="btn-mini" data-action="mt-minu-duree" data-pas="${pas}">${pas > 0 ? '+' : '−'} ${libelleDuree(Math.abs(pas))}</button>`).join('')}
    </div>`;
}

export function vueMultitimer() {
  demarrerHorloge();
  const r = reglages();
  const vues = { chrono: vueChrono, multi: vueMulti, intervalles: vueIntervalles, minuteur: vueMinuteur };
  return `<div class="carte mt-carte">
      <div class="mt-modes" role="tablist">
        ${MODES.map((m) => `<button role="tab" class="choix-sport ${r.mode === m.id ? 'actif' : ''}" aria-selected="${r.mode === m.id}" data-action="mt-mode" data-mode="${m.id}">${m.libelle}</button>`).join('')}
        <button class="btn-mini mt-son" data-action="mt-son" aria-pressed="${r.son}" aria-label="Son">${r.son ? '🔔 Son' : '🔕 Muet'}</button>
      </div>
      ${(vues[r.mode] || vueChrono)()}
    </div>`;
}
