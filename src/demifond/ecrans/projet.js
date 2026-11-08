/* Onglet Projet : paramètres de la course et % de VMA de chaque coureur. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, notifier, rafraichir, vue } from '../../noyau/interface.js';
import { decimal, esc, formatChrono, uid } from '../../noyau/outils.js';
import { PCT_DEFAUT, PCT_MAX, PCT_MIN, PCT_PAS } from '../contenu.js';
import { projetCoureur, vitesseCible, zoneDe } from '../calculs.js';
import { coureurDe, courseEnCours, reglagesDemifond } from '../etat.js';

const kmh = (n) => decimal(n.toFixed(1));

/* Paramètres de la prochaine course : choix enregistrés, sinon réglages de l'enseignant. */
function parametres() {
  const r = reglagesDemifond();
  const p = etat.prepCourse;
  return {
    type: p.type,
    distance: p.distance,
    duree: p.duree,
    plots: p.plots ?? r.distancePlots,
    tolerance: p.tolerance ?? r.tolerance,
  };
}

const coureursChoisis = () => etat.prepCourse.selection.map(coureurDe).filter((c) => c?.vma);
const pctDe = (id) => etat.prepCourse.pct[id] ?? PCT_DEFAUT;
const nombre = (texte) => parseFloat(String(texte).replace(',', '.'));

declarerActions({
  'df-type': ({ type }) => {
    etat.prepCourse.type = type;
    sauver();
    rafraichir();
  },
  'df-param': ({ param, min }, champ) => {
    const valeur = nombre(champ.value);
    if (!(valeur >= Number(min))) {
      notifier('Valeur invalide.');
      return rafraichir();
    }
    etat.prepCourse[param] = param === 'duree' ? Math.round(valeur * 60) : valeur;
    sauver();
    rafraichir();
  },
  'df-pct': ({ id, pas }) => {
    const suivant = pctDe(id) + Number(pas);
    etat.prepCourse.pct[id] = Math.min(PCT_MAX, Math.max(PCT_MIN, suivant));
    sauver();
    rafraichir();
  },
  'df-creer': () => {
    if (courseEnCours()) {
      vue.ongletDF = 'course';
      return rafraichir();
    }
    const coureurs = coureursChoisis();
    if (!coureurs.length) return notifier('Choisis au moins un coureur avec sa VMA.');
    const p = parametres();
    const { zones } = reglagesDemifond();
    const course = {
      id: uid(),
      ...p,
      depart: null,
      finLe: null,
      journal: [],
      coureurs: coureurs.map((c) => {
        const pct = pctDe(c.id);
        return {
          coureurId: c.id,
          eleveId: c.eleveId,
          nom: c.nom,
          classe: c.classe,
          vma: c.vma,
          pct,
          cible: vitesseCible(c.vma, pct),
          zone: zoneDe(pct, zones),
          passages: [],
        };
      }),
    };
    etat.courses.push(course);
    etat.courseEnCours = course.id;
    vue.ongletDF = 'course';
    sauver();
    rafraichir();
  },
});

function carteCoureur(c, p, zones) {
  const pct = pctDe(c.id);
  const vitesse = vitesseCible(c.vma, pct);
  const projet = projetCoureur(vitesse, p);
  const distanceKm = decimal((projet.distance / 1000).toFixed(2));
  const zone = zoneDe(pct, zones);
  return `<div class="carte carte-projet">
    <div class="rangee sans-marge">
      <div class="etire"><b>${esc(c.nom)}</b><br><small>${esc(c.classe)} · VMA ${kmh(c.vma)} km/h</small></div>
      <div class="reglage-pct">
        <button class="btn-rond" aria-label="Baisser le pourcentage de ${esc(c.nom)}" ${pct <= PCT_MIN ? 'disabled' : ''} data-action="df-pct" data-id="${esc(c.id)}" data-pas="${-PCT_PAS}">−</button>
        <b>${pct} %</b>
        <button class="btn-rond" aria-label="Monter le pourcentage de ${esc(c.nom)}" ${pct >= PCT_MAX ? 'disabled' : ''} data-action="df-pct" data-id="${esc(c.id)}" data-pas="${PCT_PAS}">+</button>
      </div>
    </div>
    ${zone ? `<span class="badge-zone">${esc(zone)}</span>` : ''}
    <div class="infos-projet">
      <div><b>${kmh(vitesse)}</b><span>km/h</span></div>
      <div><b>${distanceKm}</b><span>km</span></div>
      <div><b>${formatChrono(projet.temps)}</b><span>temps</span></div>
      <div><b>${Math.round(projet.parPlot)} s</b><span>par plot</span></div>
    </div>
  </div>`;
}

export function vueProjet() {
  const coureurs = coureursChoisis();
  if (!coureurs.length) {
    return `<div class="carte centre"><p class="aide">Choisis d'abord les coureurs et saisis leur VMA.</p>
      <button class="btn" data-action="df-onglet" data-onglet="coureurs">Aller aux coureurs</button></div>`;
  }
  const p = parametres();
  const { zones } = reglagesDemifond();
  const type = (id, libelle) =>
    `<button class="choix-sport ${p.type === id ? 'actif' : ''}" aria-pressed="${p.type === id}" data-action="df-type" data-type="${id}">${libelle}</button>`;
  return `
    <div class="carte"><h2 class="carte-titre">🏁 La course</h2>
      <div class="choix-sports">${type('distance', '📏 Sur une distance')}${type('temps', '⏱️ Sur un temps')}</div>
      <div class="grille-parametres">
        ${
          p.type === 'distance'
            ? `<label>Distance (m)<input inputmode="numeric" value="${p.distance}" data-choix="df-param" data-param="distance" data-min="50"></label>`
            : `<label>Durée (min)<input inputmode="decimal" value="${decimal(p.duree / 60)}" data-choix="df-param" data-param="duree" data-min="0.5"></label>`
        }
        <label>Entre deux plots (m)<input inputmode="numeric" value="${p.plots}" data-choix="df-param" data-param="plots" data-min="10"></label>
        <label>Tolérance (km/h)<input inputmode="decimal" value="${decimal(p.tolerance)}" data-choix="df-param" data-param="tolerance" data-min="0"></label>
      </div>
    </div>
    <h2 class="titre-section">Le projet de chaque coureur</h2>
    <div class="grille-reglages">${coureurs.map((c) => carteCoureur(c, p, zones)).join('')}</div>
    <button class="btn bouton-large" data-action="df-creer">${courseEnCours() ? '⏱️ Retourner à la course en cours' : '🏃 Préparer la course'}</button>`;
}
