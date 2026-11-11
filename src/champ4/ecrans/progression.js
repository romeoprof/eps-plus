/* Espace enseignant : progression d'un élève dans tous les sports. */
import { etat } from '../../noyau/etat.js';
import { declarerActions, rafraichir } from '../../noyau/interface.js';
import { avecSigne, decimal, esc, formatChrono, pourcent } from '../../noyau/outils.js';
import { suiviDemifond } from '../../demifond/calculs.js';
import { testsVmaEleve } from '../../testvma/cooper.js';
import { formatTemps, tempsPfEleve } from '../../photofinish/calculs.js';
import { dateCourte } from '../../demifond/etat.js';
import { APSA, NIVEAUX_PROJET } from '../contenu/apsa.js';
import { bonusContrat, elevesSuivis, suiviEleve } from '../calculs/progression.js';
import { nomCote } from '../reglages.js';
import { courbe } from './courbe.js';

let classeChoisie = '';
let eleveChoisi = '';

declarerActions({
  'progression-classe': (_, champ) => {
    classeChoisie = champ.value;
    eleveChoisi = '';
    rafraichir();
  },
  'progression-eleve': (_, champ) => {
    eleveChoisi = champ.value;
    rafraichir();
  },
});

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
/* Qui a observé : l'enseignant, un élève identifié, ou « – » (élève non identifié). */
const observePar = (donnee) => esc(donnee?.observePar?.nom || '–');

/* Écart entre la première et la dernière rencontre, en points de pourcentage. */
function evolution(parts) {
  if (parts.length < 2) return '';
  const ecart = Math.round((parts[parts.length - 1] - parts[0]) * 100);
  if (!ecart) return `<span class="evolution">= stable depuis la première rencontre</span>`;
  const sens = ecart > 0 ? 'hausse' : 'baisse';
  return `<span class="evolution ${sens}">${ecart > 0 ? '↗ +' : '↘ '}${ecart} points de % depuis la première rencontre</span>`;
}

function blocContrat(contrat) {
  if (!contrat) return '';
  const lignes = contrat.lignes
    .map(
      (l, rang) => `<tr>
        <td>Rencontre ${rang + 1}${l.match.termine ? '' : ' (en cours)'}<br><small>contre ${esc(nomCote(l.match, 1 - l.cote))}</small></td>
        <td>${esc(l.libelle)}</td><td><b>${l.points}</b> / ${l.gagnes}</td></tr>`,
    )
    .join('');
  return `<div class="bloc-contrat">
    <h4>⭐ Contrat : ${pluriel(contrat.points, 'point')} sur ${contrat.gagnes} gagnés (${pourcent(contrat.points, contrat.gagnes)})${etat.reglages.contratBonus ? ` · bonus +${decimal(bonusContrat(contrat.points, etat.reglages))}` : ''}</h4>
    <div class="defile"><table><tr><th>Rencontre</th><th>Manière de marquer</th><th>Points du contrat</th></tr>${lignes}</table></div>
    ${contrat.parts.length ? `${courbe(contrat.parts, 'Part des points gagnés avec le contrat à chaque rencontre')}${evolution(contrat.parts)}` : ''}
  </div>`;
}

function carteSport(s) {
  const lignes = s.criteres
    .filter((c) => c.nombre)
    .map((c) => {
      const classe = c.points > 0 ? 'positif' : c.points < 0 ? 'negatif' : '';
      return `<tr class="${classe}"><td>${esc(c.libelle)}</td><td>${c.nombre}</td></tr>`;
    })
    .join('');
  const fiche = s.fiche
    .map((x) => `<li>${esc(x.texte)} : <b>${decimal(x.moyenne.toFixed(1))}/4</b></li>`)
    .join('');
  const projets = s.projets
    .map((p) => `<li>${esc(p.texte)} : <b>${NIVEAUX_PROJET[p.niveau]}</b></li>`)
    .join('');
  return `<div class="carte">
    <h2 class="carte-titre"><span class="icone-titre">${APSA[s.apsa]?.icone || ''}</span> ${esc(s.apsa)}
      <small>${pluriel(s.rencontres, 'rencontre')}</small></h2>
    <p>${s.terminees ? `<b>${pluriel(s.victoires, 'victoire')}</b> · ${pluriel(s.nuls, 'nul')} · ${pluriel(s.defaites, 'défaite')}` : 'Aucune rencontre terminée'}
      — ${s.pointsPour} points gagnés, ${s.pointsContre} perdus</p>
    ${s.observateurs.length ? `<p class="aide">Observé par : ${s.observateurs.map(esc).join(', ')}</p>` : ''}
    ${blocContrat(s.contrat)}
    ${s.parts.length ? `<h4>Part des points gagnés par rencontre</h4>${courbe(s.parts)}${evolution(s.parts)}` : ''}
    ${lignes ? `<h4>Actions observées</h4><div class="defile"><table>${lignes}</table></div>` : ''}
    ${projets ? `<h4>Projets de jeu évalués</h4><ul>${projets}</ul>` : ''}
    ${fiche ? `<h4>Fiche d'observation (moyenne)</h4><ul>${fiche}</ul>` : ''}
  </div>`;
}

const vitesse = (n) => (n == null ? '–' : decimal(n.toFixed(1)));

/* Bloc Demi-fond : vitesse, respect du projet et régularité à chaque course. */
function carteDemifond(df) {
  const min = Math.min(...df.lignes.map((l) => l.moyenne));
  const max = Math.max(...df.lignes.map((l) => l.moyenne));
  const parts = df.lignes.map((l) => (max > min ? 0.15 + ((l.moyenne - min) / (max - min)) * 0.7 : 0.5));
  const lignes = df.lignes
    .map(
      (l) => `<tr><td>${dateCourte(l.course.finLe)}</td><td>${vitesse(l.coureur.cible)}<br><small>${l.coureur.pct} % VMA</small></td><td><b>${vitesse(l.moyenne)}</b></td><td>${avecSigne(l.ecart)}</td><td>${l.distance} m</td><td>${formatChrono(l.temps)}</td><td>${l.regularite ?? '–'}</td><td>${l.atteint ? '✅' : '–'}</td><td>${observePar(l.course)}</td></tr>`,
    )
    .join('');
  const derniereVma = df.lignes[df.lignes.length - 1].coureur.vma;
  return `<div class="carte">
    <h2 class="carte-titre"><span class="icone-titre">🏃</span> Demi-fond <small>${pluriel(df.courses, 'course')} · VMA ${vitesse(derniereVma)} km/h</small></h2>
    <p><b>Projet respecté : ${df.atteints} / ${df.courses}</b> · meilleure vitesse moyenne : ${vitesse(df.meilleure)} km/h${df.regulariteMoyenne == null ? '' : ` · régularité moyenne : ${df.regulariteMoyenne}/100`}</p>
    <h4>Vitesse moyenne à chaque course (km/h)</h4>
    ${courbe(parts, 'Vitesse moyenne à chaque course', df.lignes.map((l) => vitesse(l.moyenne)))}
    <div class="defile"><table>
      <tr><th>Date</th><th>Projet</th><th>Réalisé</th><th>Écart</th><th>Distance</th><th>Temps</th><th>Régularité</th><th>Objectif</th><th>Observé par</th></tr>
      ${lignes}
    </table></div>
  </div>`;
}

/* Bloc Tests VMA : résultats du demi-Cooper. */
function carteTestsVma(tests) {
  const min = Math.min(...tests.map((t) => t.vma));
  const max = Math.max(...tests.map((t) => t.vma));
  const parts = tests.map((t) => (max > min ? 0.15 + ((t.vma - min) / (max - min)) * 0.7 : 0.5));
  const lignes = tests
    .map((t) => `<tr><td>${dateCourte(t.date)}</td><td>Demi-Cooper</td><td>${t.distance} m</td><td><b>${vitesse(t.vma)} km/h</b></td><td>${observePar(t)}</td></tr>`)
    .join('');
  return `<div class="carte">
    <h2 class="carte-titre"><span class="icone-titre">📈</span> Tests VMA <small>${pluriel(tests.length, 'test')} · dernière VMA ${vitesse(tests[tests.length - 1].vma)} km/h</small></h2>
    ${tests.length > 1 ? `<h4>VMA à chaque test (km/h)</h4>${courbe(parts, 'VMA à chaque test', tests.map((t) => vitesse(t.vma)))}` : ''}
    <div class="defile"><table><tr><th>Date</th><th>Test</th><th>Distance</th><th>VMA</th><th>Observé par</th></tr>${lignes}</table></div>
  </div>`;
}

/* Bloc PhotoFinish : chaque temps attribué à l'élève, regroupé par nom de course (même épreuve). */
function cartePhotofinish(temps) {
  const epreuves = new Map();
  temps.forEach((t) => {
    const cle = t.libelle || 'Course sans nom';
    epreuves.set(cle, [...(epreuves.get(cle) || []), t]);
  });
  const blocs = [...epreuves.entries()]
    .map(([libelle, liste]) => {
      const meilleur = Math.min(...liste.map((t) => t.t));
      const lignes = liste
        .map((t) => `<tr><td>${dateCourte(t.date)}</td><td><b>${formatTemps(t.t)} s</b>${t.t === meilleur && liste.length > 1 ? ' 🏅' : ''}</td><td>${t.rang} / ${t.partants}</td></tr>`)
        .join('');
      return `<h4>${esc(libelle)} <small>· meilleur temps ${formatTemps(meilleur)} s</small></h4>
        <div class="defile"><table><tr><th>Date</th><th>Temps</th><th>Rang</th></tr>${lignes}</table></div>`;
    })
    .join('');
  return `<div class="carte">
    <h2 class="carte-titre"><span class="icone-titre">📸</span> PhotoFinish <small>${temps.length} temps</small></h2>
    ${blocs}
  </div>`;
}

export function vueEleve(eleve) {
  const suivi = suiviEleve(etat, eleve.id);
  const df = suiviDemifond(etat, eleve.id);
  const tests = testsVmaEleve(etat, eleve.id);
  const temps = tempsPfEleve(etat, eleve.id);
  if (!suivi.rencontres && !df.courses && !tests.length && !temps.length) {
    return `<div class="carte centre"><p class="aide">Aucun match observé pour ${esc(eleve.nom)} sur cette tablette.</p></div>`;
  }
  const tuile = (valeur, libelle) => `<div class="tuile-stat"><b>${valeur}</b><span>${libelle}</span></div>`;
  const nbSports = suivi.sports.length + (df.courses ? 1 : 0) + (tests.length ? 1 : 0) + (temps.length ? 1 : 0);
  return `
    <div class="tuiles-stats">
      ${tuile(nbSports, nbSports > 1 ? 'sports' : 'sport')}
      ${suivi.rencontres ? tuile(suivi.rencontres, suivi.rencontres > 1 ? 'rencontres' : 'rencontre') : ''}
      ${suivi.rencontres ? tuile(`${suivi.victoires} / ${suivi.nuls} / ${suivi.defaites}`, 'V / N / D') : ''}
      ${suivi.pointsContrat ? tuile(`⭐ ${suivi.pointsContrat}`, 'points de contrat') : ''}
      ${suivi.pointsContrat && etat.reglages.contratBonus ? tuile(`+${decimal(bonusContrat(suivi.pointsContrat, etat.reglages))}`, 'bonus de contrat') : ''}
      ${df.courses ? tuile(`🏃 ${df.courses}`, df.courses > 1 ? 'courses' : 'course') : ''}
      ${tests.length ? tuile(`${vitesse(tests[tests.length - 1].vma)}`, 'dernière VMA (km/h)') : ''}
    </div>
    ${tests.length ? carteTestsVma(tests) : ''}
    ${temps.length ? cartePhotofinish(temps) : ''}
    ${suivi.sports.map(carteSport).join('')}
    ${df.courses ? carteDemifond(df) : ''}`;
}

export function vueProgression() {
  const eleves = elevesSuivis(etat);
  if (!eleves.length) {
    return `<div class="carte centre"><h2 class="carte-titre">📈 Progression des élèves</h2>
      <p class="aide">Aucun élève suivi pour l'instant : choisis des élèves de la liste pour former une équipe ou un joueur seul.</p></div>`;
  }
  const classes = [...new Set(eleves.map((e) => e.classe))].sort();
  const classe = classes.includes(classeChoisie) ? classeChoisie : classes[0];
  const dansClasse = eleves.filter((e) => e.classe === classe).sort((a, b) => a.nom.localeCompare(b.nom));
  const eleve = dansClasse.find((e) => e.id === eleveChoisi);
  return `
    <div class="carte"><h2 class="carte-titre">📈 Progression des élèves</h2>
      <div class="deux-colonnes">
        <div><label class="etiquette" for="progression-classe">Classe</label>
          <select id="progression-classe" data-choix="progression-classe">${classes.map((c) => `<option ${c === classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div><label class="etiquette" for="progression-eleve">Élève</label>
          <select id="progression-eleve" data-choix="progression-eleve">
            <option value="">Choisis un élève…</option>
            ${dansClasse.map((e) => `<option value="${esc(e.id)}" ${e.id === eleveChoisi ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}
          </select></div>
      </div>
      <p class="aide">En sport collectif, l'élève reçoit les statistiques de son équipe. Sont comptés les matchs et les courses de cette tablette, et ceux récupérés des autres (onglet « Récupérer les données »).</p>
    </div>
    ${eleve ? vueEleve(eleve) : ''}`;
}
