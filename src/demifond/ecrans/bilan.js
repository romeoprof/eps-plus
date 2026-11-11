/* Onglet Bilan : résultats de chaque course, graphique et export. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, rafraichir } from '../../noyau/interface.js';
import { avecSigne, decimal, esc, formatChrono, telecharger } from '../../noyau/outils.js';
import { bilanCoureur } from '../calculs.js';
import { dateCourte } from '../etat.js';

let coureurVu = 0;

const kmh = (n) => (n == null ? '–' : decimal(n.toFixed(1)));
const pct = (n) => (n == null ? '–' : `${Math.round(n)} %`);
const signe = avecSigne;

const coursesFinies = () => etat.courses.filter((c) => c.finLe).sort((a, b) => b.finLe - a.finLe);
const courseAffichee = () => {
  const liste = coursesFinies();
  return liste.find((c) => c.id === etat.courseBilan) || liste[0];
};
const titreCourse = (c) =>
  `${dateCourte(c.finLe)} · ${c.type === 'distance' ? `${decimal(c.distance / 1000)} km` : formatChrono(c.duree)} · ${c.coureurs.length} coureur${c.coureurs.length > 1 ? 's' : ''}`;

function exporterCsv(course) {
  const lignes = [['Date', 'Coureur', 'Classe', 'VMA', '% VMA projet', 'Zone', 'Projet km/h', 'Vitesse moyenne', '% VMA réalisé', 'Écart km/h', 'Objectif atteint', 'Distance m', 'Temps', 'Plots', 'Vitesse max', 'Régularité', 'Distance après le dernier plot (m)', 'Allure du dernier morceau', 'Temps de passage (s)']];
  course.coureurs.forEach((c) => {
    const b = bilanCoureur(course, c);
    lignes.push([dateCourte(course.finLe), c.nom, c.classe, decimal(c.vma), c.pct, c.zone, kmh(c.cible), kmh(b.moyenne), b.pctReel == null ? '' : Math.round(b.pctReel), signe(b.ecart), b.atteint ? 'Oui' : 'Non', b.distance, formatChrono(b.temps), b.plots, kmh(b.vitesseMax), b.regularite ?? '', b.distanceFinale == null ? '' : decimal(b.distanceFinale), b.allureFinale == null ? '' : kmh(b.allureFinale), c.passages.map((t) => decimal(t)).join(' | ')]);
  });
  const texte = lignes.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
  telecharger(`demi-fond_${dateCourte(course.finLe).replaceAll('/', '-')}.csv`, `﻿${texte}`, 'text/csv');
}

declarerActions({
  'df-bilan-course': (_, champ) => {
    etat.courseBilan = champ.value;
    coureurVu = 0;
    sauver();
    rafraichir();
  },
  'df-bilan-coureur': ({ rang }) => {
    coureurVu = Number(rang);
    rafraichir();
  },
  'df-bilan-csv': () => exporterCsv(courseAffichee()),
  'df-bilan-supprimer': async () => {
    const course = courseAffichee();
    const ok = await demander({
      titre: 'Supprimer cette course ?',
      texte: 'Ses résultats disparaîtront du bilan et de la Progression sur cette tablette.',
      confirmer: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    etat.courses = etat.courses.filter((c) => c.id !== course.id);
    etat.courseBilan = null;
    coureurVu = 0;
    sauver();
    rafraichir();
  },
});

/* Graphique des vitesses par plot, avec le projet en pointillés (aussi dans la Progression). */
export function graphique(vitesses, cible, tolerance, avecFinale = false) {
  if (!vitesses.length) return '<p class="aide">Aucun passage noté.</p>';
  const L = 640;
  const H = 240;
  const G = 42;
  const B = 28;
  const haut = 16;
  const valeurs = [...vitesses, cible + tolerance, cible - tolerance];
  const min = Math.floor(Math.min(...valeurs) - 1);
  const max = Math.ceil(Math.max(...valeurs) + 1);
  const x = (i) => (vitesses.length > 1 ? G + (i * (L - G - 14)) / (vitesses.length - 1) : (L + G) / 2);
  const y = (v) => haut + ((max - v) * (H - haut - B)) / (max - min);
  const pasGrille = Math.max(1, Math.ceil((max - min) / 5));
  const graduations = [];
  for (let v = min; v <= max; v += pasGrille) {
    graduations.push(`<line x1="${G}" x2="${L - 8}" y1="${y(v)}" y2="${y(v)}" class="gr-grille"/><text x="${G - 7}" y="${y(v) + 4}" text-anchor="end" class="gr-texte">${v}</text>`);
  }
  const points = vitesses.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const pasEtiquette = Math.ceil(vitesses.length / 12);
  return `<svg class="graphique-vitesse" viewBox="0 0 ${L} ${H}" role="img" aria-label="Vitesse à chaque plot comparée au projet de ${kmh(cible)} km/h">
    ${graduations.join('')}
    <rect x="${G}" width="${L - 8 - G}" y="${y(cible + tolerance)}" height="${y(cible - tolerance) - y(cible + tolerance)}" class="gr-zone"/>
    <line x1="${G}" x2="${L - 8}" y1="${y(cible)}" y2="${y(cible)}" class="gr-projet"/>
    <polyline points="${points}" class="gr-ligne"/>
    ${vitesses
      .map((v, i) => {
        const etiquette = i % pasEtiquette === 0 || i === vitesses.length - 1;
        return `<circle cx="${x(i)}" cy="${y(v)}" r="4" class="gr-point"/>${etiquette ? `<text x="${x(i)}" y="${y(v) - 9}" text-anchor="middle" class="gr-valeur">${kmh(v)}</text><text x="${x(i)}" y="${H - 9}" text-anchor="middle" class="gr-texte">${avecFinale && i === vitesses.length - 1 ? 'fin' : i + 1}</text>` : ''}`;
      })
      .join('')}
  </svg>
  <p class="aide">Vitesse en km/h à chaque plot. Pointillés : projet. Bande verte : tolérance de ±${decimal(tolerance)} km/h.</p>`;
}

export function vueBilanDF() {
  const liste = coursesFinies();
  if (!liste.length) {
    return `<div class="carte centre"><p class="aide">Aucune course terminée pour l'instant.</p>
      <button class="btn" data-action="df-onglet" data-onglet="coureurs">Préparer une course</button></div>`;
  }
  const course = courseAffichee();
  if (coureurVu >= course.coureurs.length) coureurVu = 0;
  const lignes = course.coureurs.map((c) => ({ c, b: bilanCoureur(course, c) }));
  const { c, b } = lignes[coureurVu];
  const statistique = (libelle, valeur, detail = '') =>
    `<div class="stat-ligne"><span>${libelle}</span><b>${valeur}</b>${detail ? `<small>${detail}</small>` : ''}</div>`;
  const groupe = (titre, contenu) => `<section class="groupe-stats"><h4>${titre}</h4>${contenu}</section>`;
  return `
    <div class="carte"><h2 class="carte-titre">📊 Bilan de la course</h2>
      <select data-choix="df-bilan-course" aria-label="Course">${liste.map((x) => `<option value="${esc(x.id)}" ${x.id === course.id ? 'selected' : ''}>${esc(titreCourse(x))}</option>`).join('')}</select>
      <div class="defile"><table>
        <tr><th>Coureur</th><th>Projet</th><th>Moyenne</th><th>Écart</th><th>Distance</th><th>Temps</th><th>Objectif</th></tr>
        ${lignes
          .map(
            (l, rang) => `<tr class="${rang === coureurVu ? 'ligne-choisie' : ''}"><td>${esc(l.c.nom)}</td><td>${kmh(l.c.cible)}</td><td>${kmh(l.b.moyenne)}</td><td>${signe(l.b.ecart)}</td><td>${l.b.distance} m</td><td>${formatChrono(l.b.temps)}</td><td>${l.b.atteint ? '✅' : '–'}</td></tr>`,
          )
          .join('')}
      </table></div>
    </div>
    <div class="choix-sports">${lignes
      .map(
        (l, rang) => `<button class="choix-sport ${rang === coureurVu ? 'actif' : ''}" aria-pressed="${rang === coureurVu}" data-action="df-bilan-coureur" data-rang="${rang}">${esc(l.c.nom)}</button>`,
      )
      .join('')}</div>
    <div class="carte"><h2 class="carte-titre">🏃 ${esc(c.nom)} <small>${esc(c.classe)} · VMA ${kmh(c.vma)} km/h${c.zone ? ` · ${esc(c.zone)}` : ''}</small></h2>
      <div class="verdict-course ${b.atteint ? 'reussi' : 'manque'}">
        <div class="verdict-titre">${b.atteint ? '✅ Objectif atteint' : '❌ Objectif non atteint'}<small>tolérance ±${decimal(course.tolerance)} km/h</small></div>
        <div class="verdict-comparaison">
          <div><span>Projet</span><b>${kmh(c.cible)}</b><small>km/h · ${c.pct} % VMA</small></div>
          <div class="verdict-fleche" aria-hidden="true">→</div>
          <div><span>Réalisé</span><b>${kmh(b.moyenne)}</b><small>km/h · ${pct(b.pctReel)} VMA</small></div>
          <div class="verdict-ecart"><span>Écart</span><b>${signe(b.ecart)}</b><small>km/h${b.ecartPct == null ? '' : ` · ${signe(b.ecartPct)} %`}</small></div>
        </div>
      </div>
      <div class="groupes-stats">
        ${groupe(
          '📏 La course',
          `${statistique('Distance', `${b.distance} m`, `${b.plots} plot${b.plots > 1 ? 's' : ''}`)}
           ${statistique('Temps', formatChrono(b.temps))}
           ${b.distanceFinale ? statistique('Après le dernier plot', `${decimal(b.distanceFinale)} m`, `allure ${kmh(b.allureFinale)} km/h`) : ''}`,
        )}
        ${groupe(
          '⚡ L’allure',
          `${statistique('Vitesse max', `${kmh(b.vitesseMax)} km/h`, 'entre deux plots')}
           ${statistique('Régularité', b.regularite == null ? '–' : `${b.regularite}/100`, '100 = toujours la même vitesse')}`,
        )}
      </div>
      <h4>Évolution de la vitesse</h4>
      ${graphique(b.vitesses, c.cible, course.tolerance, b.allureFinale != null)}
    </div>
    <div class="rangee">
      <button class="btn" data-action="df-bilan-csv">Exporter cette course (Excel)</button>
      <button class="btn secondaire" data-action="df-bilan-supprimer">Supprimer cette course</button>
    </div>`;
}
