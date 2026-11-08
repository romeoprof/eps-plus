/* Espace enseignant : progression d'un élève dans tous les sports. */
import { etat } from '../../noyau/etat.js';
import { declarerActions, rafraichir } from '../../noyau/interface.js';
import { decimal, esc, pourcent } from '../../noyau/outils.js';
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
    ${blocContrat(s.contrat)}
    ${s.parts.length ? `<h4>Part des points gagnés par rencontre</h4>${courbe(s.parts)}${evolution(s.parts)}` : ''}
    ${lignes ? `<h4>Actions observées</h4><div class="defile"><table>${lignes}</table></div>` : ''}
    ${projets ? `<h4>Projets de jeu évalués</h4><ul>${projets}</ul>` : ''}
    ${fiche ? `<h4>Fiche d'observation (moyenne)</h4><ul>${fiche}</ul>` : ''}
  </div>`;
}

function vueEleve(eleve) {
  const suivi = suiviEleve(etat, eleve.id);
  if (!suivi.rencontres) {
    return `<div class="carte centre"><p class="aide">Aucun match observé pour ${esc(eleve.nom)} sur cette tablette.</p></div>`;
  }
  const tuile = (valeur, libelle) => `<div class="tuile-stat"><b>${valeur}</b><span>${libelle}</span></div>`;
  return `
    <div class="tuiles-stats">
      ${tuile(suivi.sports.length, suivi.sports.length > 1 ? 'sports' : 'sport')}
      ${tuile(suivi.rencontres, suivi.rencontres > 1 ? 'rencontres' : 'rencontre')}
      ${tuile(`${suivi.victoires} / ${suivi.nuls} / ${suivi.defaites}`, 'V / N / D')}
      ${tuile(`⭐ ${suivi.pointsContrat}`, 'points de contrat')}
      ${etat.reglages.contratBonus ? tuile(`+${decimal(bonusContrat(suivi.pointsContrat, etat.reglages))}`, 'bonus de contrat') : ''}
    </div>
    ${suivi.sports.map(carteSport).join('')}`;
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
      <p class="aide">En sport collectif, l'élève reçoit les statistiques de son équipe. Sont comptés les matchs observés sur cette tablette et ceux récupérés des autres (onglet « Récupérer les données »).</p>
    </div>
    ${eleve ? vueEleve(eleve) : ''}`;
}
