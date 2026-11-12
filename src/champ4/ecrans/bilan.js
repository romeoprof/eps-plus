import { etat, remplacerEtat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../../noyau/interface.js';
import { esc, lireNombre } from '../../noyau/outils.js';
import { APSA, NIVEAUX_FICHE, NIVEAUX_PROJET, REPERES } from '../contenu/apsa.js';
import { nomZone, TERRAINS } from '../contenu/terrains.js';
import { score } from '../calculs/match.js';
import { cumulEquipe, indicateurs, rencontresObservees } from '../calculs/stats.js';
import { profilJoueur, rencontresParEquipe } from '../calculs/suivi.js';
import { exporterClasseur, exporterSauvegarde } from '../donnees/export.js';
import { lireSauvegarde } from '../donnees/migration.js';
import { reinitialiserBilans } from '../donnees/operations.js';
import { nomCote, nomEquipe } from '../reglages.js';
import { courbe } from './courbe.js';
import { afficherFiche } from './fiche.js';
import { terrain } from './terrain.js';

const COTES = [0, 1];
const matchsObserves = () => etat.matchs.filter((m) => m.apsa === etat.apsa && m.evenements.length);
const matchAffiche = () => {
  const liste = matchsObserves();
  return liste.find((m) => m.id === etat.matchBilan) || liste[0];
};

/* Bilan rencontre par rencontre, ou cumul de toutes les rencontres d'une équipe / d'un joueur. */
let modeBilan = 'rencontre';
let equipeCumul = '';

declarerActions({
  'bilan-mode': ({ mode }) => {
    modeBilan = mode;
    rafraichir();
  },
  'bilan-equipe': (_, champ) => {
    equipeCumul = champ.value;
    rafraichir();
  },
  'bilan-voir-match': ({ id }) => {
    etat.matchBilan = id;
    modeBilan = 'rencontre';
    sauver();
    rafraichir();
    window.scrollTo(0, 0);
  },
  'bilan-match': (_, champ) => {
    etat.matchBilan = champ.value;
    sauver();
    rafraichir();
  },
  'bilan-fiche': ({ cote }) => afficherFiche(matchAffiche(), Number(cote)),
  'bilan-csv': () => exporterClasseur(etat, etat.apsa),
  'bilan-sauvegarder': () => exporterSauvegarde(etat),
  'bilan-restaurer': async (_, champ) => {
    const fichier = champ.files[0];
    if (!fichier) return;
    try {
      const nouveau = lireSauvegarde(JSON.parse(await fichier.text()));
      const ok = await demander({
        titre: 'Restaurer cette sauvegarde ?',
        texte: 'Les données actuelles de cette tablette seront remplacées par celles du fichier.',
        confirmer: 'Restaurer',
        danger: true,
      });
      if (ok) {
        remplacerEtat(nouveau);
        notifier('Sauvegarde restaurée ✔');
        rafraichir();
      }
    } catch {
      notifier('Fichier de sauvegarde non reconnu.');
    }
    champ.value = '';
  },
  'bilan-reinitialiser': async () => {
    const ok = await demander({
      titre: 'Supprimer les bilans ?',
      texte: `Les bilans des matchs de ${etat.apsa} seront effacés ; équipes, élèves et poules sont conservés. Cette action est irréversible.`,
      confirmer: 'Supprimer les bilans',
      danger: true,
    });
    if (!ok) return;
    reinitialiserBilans(etat, etat.apsa);
    sauver();
    rafraichir();
  },
});

function barre(valeur, couleur, repere) {
  const largeur = Math.min(100, lireNombre(valeur) || 0);
  const zone = repere
    ? `<i class="barre-repere" style="left:${repere[0]}%;width:${repere[1] - repere[0]}%"></i>`
    : '';
  return `<div class="barre"><div class="barre-fond">${zone}<b style="width:${largeur}%;background:${couleur}"></b></div><span>${esc(valeur)}</span></div>`;
}

function ligneIndicateur([libelle, a, b]) {
  if (!String(a).endsWith('%') && !String(b).endsWith('%')) {
    return `<tr><td>${esc(libelle)}</td><td>${esc(a)}</td><td>${esc(b)}</td></tr>`;
  }
  const repere = REPERES[libelle];
  const couleur = (valeur) => {
    const x = lireNombre(valeur);
    if (Number.isNaN(x) || !repere) return 'var(--bleu)';
    if (x < repere[0]) return 'var(--rouge)';
    return x > repere[1] ? 'var(--orange)' : 'var(--vert)';
  };
  return `<tr><td colspan="3" class="ligne-barres">${esc(libelle)}${repere ? ` <small>(repère ${repere[0]}–${repere[1]} %)</small>` : ''}${barre(a, couleur(a), repere)}${barre(b, couleur(b), repere)}</td></tr>`;
}

function impacts(m) {
  if (!TERRAINS[m.apsa]) return '';
  return `<div class="grille-impacts">${COTES.map((cote) => {
    const cellule = (z) => {
      const n = m.evenements.filter((e) => e.equipe === cote && e.zone === z).length;
      return `<div class="zone-impact" style="background:rgba(255,200,0,${n ? Math.min(0.85, 0.2 + n / 6) : 0})">${n || ''}</div>`;
    };
    return `<div><p><b>Impacts : ${esc(nomCote(m, cote))}</b></p>${terrain(m, cellule)}</div>`;
  }).join('')}</div>`;
}

function detailsMatch(m) {
  let html = '';
  if (m.conseils[0] || m.conseils[1]) {
    html += `<p><b>Conseils</b><br>${esc(nomCote(m, 0))} : ${esc(m.conseils[0] || '–')}<br>${esc(nomCote(m, 1))} : ${esc(m.conseils[1] || '–')}</p>`;
  }
  html += impacts(m);
  COTES.forEach((cote) => {
    if (m.projets[cote].length) {
      html += `<p><b>Projet de jeu de ${esc(nomCote(m, cote))} pour la prochaine rencontre</b><br>${m.projets[cote].map(esc).join(' · ')}</p>`;
    }
    const bilan = Object.entries(m.bilanProjet[cote]);
    if (bilan.length) {
      html += `<p><b>Projet de jeu mis en œuvre par ${esc(nomCote(m, cote))}</b><br>${bilan.map(([p, n]) => `${esc(p)} : ${NIVEAUX_PROJET[n]}`).join('<br>')}</p>`;
    }
    const fiche = Object.entries(m.fiche[cote]);
    if (fiche.length) {
      html += `<p><b>Fiche d'observation : ${esc(nomCote(m, cote))}</b><br>${fiche.map(([x, n]) => `${esc(x)} : ${NIVEAUX_FICHE[n - 1]}`).join('<br>')}</p>`;
    }
  });
  return html;
}

function carteProgression() {
  if (!APSA[etat.apsa].terrain) return '';
  const parEquipe = rencontresParEquipe(etat.matchs, etat.apsa);
  const html = Object.keys(parEquipe)
    .map((id) => {
      const rencontres = parEquipe[id];
      const profil = profilJoueur(rencontres);
      const details = [
        'Points gagnés par rencontre',
        profil.coup && `Coup préféré : ${esc(profil.coup.libelle)} (${profil.coup.nombre})`,
        profil.zone != null && `Zone visée : ${nomZone(profil.zone)}`,
        profil.faute && `Faute fréquente : ${esc(profil.faute.libelle)} (${profil.faute.nombre})`,
      ]
        .filter(Boolean)
        .join(' · ');
      return `<p><b>${esc(nomEquipe(id))}</b> <small>(${rencontres.length} rencontre${rencontres.length > 1 ? 's' : ''})</small></p>${courbe(profil.parts)}<p class="aide">${details}</p>`;
    })
    .join('');
  return html ? `<div class="carte"><h2 class="carte-titre">📈 Progression et profil des joueurs</h2>${html}</div>` : '';
}

function carteSuivi() {
  const parEquipe = rencontresParEquipe(etat.matchs, etat.apsa);
  const html = Object.keys(parEquipe)
    .map((id) => {
      const lignes = parEquipe[id]
        .map(([m, cote], rang) => {
          const bilan = Object.entries(m.bilanProjet[cote]);
          const projet = m.projets[cote];
          if (!bilan.length && !projet.length) return '';
          return `<p class="aide">Rencontre ${rang + 1} contre ${esc(nomCote(m, 1 - cote))}
            ${bilan.length ? `<br>✔ Projet précédent : ${bilan.map(([p, n]) => `${esc(p)} → ${NIVEAUX_PROJET[n]}`).join(' ; ')}` : ''}
            ${projet.length ? `<br>🎯 Nouveau projet : ${projet.map(esc).join(' · ')}` : ''}</p>`;
        })
        .join('');
      return lignes ? `<p><b>${esc(nomEquipe(id))}</b></p>${lignes}` : '';
    })
    .join('');
  return html ? `<div class="carte"><h2 class="carte-titre">🎯 Suivi des projets de jeu</h2>${html}</div>` : '';
}

/* Une équipe ou un joueur, toutes ses rencontres réunies sur un seul écran. */
function carteCumul() {
  const ids = [...new Set(matchsObserves().flatMap((x) => [x.a, x.b]))].sort((p, q) => nomEquipe(p).localeCompare(nomEquipe(q)));
  if (!ids.length) return `<div class="carte centre"><p class="aide">Aucun match observé pour cette APSA.</p></div>`;
  if (!ids.includes(equipeCumul)) equipeCumul = ids[0];
  const rencontres = rencontresObservees(etat.matchs, etat.apsa, equipeCumul);
  const c = cumulEquipe(rencontres);
  const nom = nomEquipe(equipeCumul);
  const tuile = (valeur, libelle) => `<div class="tuile-stat"><b>${valeur}</b><span>${libelle}</span></div>`;
  const lignes = c.lignes
    .map(([libelle, a, b, moy]) => `<tr><td>${esc(libelle)}</td><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td>${esc(moy) || '–'}</td></tr>`)
    .join('');
  const liste = rencontres
    .map(([m, cote], rang) => {
      const pour = score(m, cote);
      const contre = score(m, 1 - cote);
      const resultat = !m.termine ? 'en cours' : pour > contre ? 'victoire' : pour < contre ? 'défaite' : 'nul';
      return `<li><span>Rencontre ${rang + 1} · contre <b>${esc(nomCote(m, 1 - cote))}</b> · ${pour}-${contre} <small>(${resultat})</small></span>
        <button class="btn-mini" data-action="bilan-voir-match" data-id="${esc(m.id)}">Voir le détail</button></li>`;
    })
    .join('');
  return `<div class="carte"><h2 class="carte-titre">🧮 Cumul de toutes les rencontres</h2>
      <label class="etiquette" for="bilan-equipe">Équipe ou joueur</label>
      <select id="bilan-equipe" data-choix="bilan-equipe">${ids.map((id) => `<option value="${esc(id)}" ${id === equipeCumul ? 'selected' : ''}>${esc(nomEquipe(id))}</option>`).join('')}</select>
      <div class="tuiles-stats marge-haut">
        ${tuile(c.rencontres, c.rencontres > 1 ? 'rencontres' : 'rencontre')}
        ${tuile(`${c.victoires} / ${c.nuls} / ${c.defaites}`, 'V / N / D')}
        ${tuile(`${c.pour} – ${c.contre}`, 'points pour – contre')}
      </div>
      <div class="defile"><table>
        <tr><th>Indicateur</th><th>${esc(nom)}</th><th>Adversaires</th><th>Moyenne par rencontre</th></tr>
        ${lignes}
      </table></div>
      <p class="aide">Totaux sur toutes les rencontres observées ; les pourcentages sont recalculés sur l'ensemble.</p>
    </div>
    <div class="carte"><h2 class="carte-titre">📅 Rencontre par rencontre</h2><ul class="liste-rencontres">${liste}</ul></div>`;
}

export function vueBilan() {
  const liste = matchsObserves();
  const m = matchAffiche();
  const choixMode = `<div class="choix-sports choix-test">
      <button class="choix-sport ${modeBilan === 'rencontre' ? 'actif' : ''}" aria-pressed="${modeBilan === 'rencontre'}" data-action="bilan-mode" data-mode="rencontre">📊 Par rencontre</button>
      <button class="choix-sport ${modeBilan === 'cumul' ? 'actif' : ''}" aria-pressed="${modeBilan === 'cumul'}" data-action="bilan-mode" data-mode="cumul">🧮 Cumul d'une équipe / d'un joueur</button>
    </div>`;
  if (modeBilan === 'cumul') return `${choixMode}${carteCumul()}${carteExport()}`;
  const carteMatch = m
    ? `<div class="carte"><h2 class="carte-titre">📊 Bilan du match</h2>
        <select data-choix="bilan-match">${liste
          .map((x) => `<option value="${esc(x.id)}" ${x.id === m.id ? 'selected' : ''}>${esc(nomEquipe(x.a))} – ${esc(nomEquipe(x.b))} (${score(x, 0)}-${score(x, 1)})</option>`)
          .join('')}</select>
        <div class="defile"><table>
          <tr><th>Indicateur</th><th>${esc(nomCote(m, 0))}</th><th>${esc(nomCote(m, 1))}</th></tr>
          ${indicateurs(m).map(ligneIndicateur).join('')}
        </table></div>
        ${detailsMatch(m)}
      </div>
      <div class="carte rangee"><b class="etire">Fiche à partager</b>
        ${COTES.map((cote) => `<button class="btn secondaire" data-action="bilan-fiche" data-cote="${cote}">${esc(nomCote(m, cote))}</button>`).join('')}
      </div>`
    : `<div class="carte centre"><p class="aide">Aucun match observé pour cette APSA.</p></div>`;
  return `
    ${choixMode}
    ${carteMatch}
    ${carteProgression()}
    ${carteSuivi()}
    ${carteExport()}
    <button class="btn secondaire" data-action="bilan-reinitialiser">Réinitialiser les bilans</button>`;
}

const carteExport = () => `
    <div class="carte"><h2 class="carte-titre">💾 Exporter et sauvegarder</h2>
      <div class="rangee">
        <button class="btn" data-action="bilan-csv">📗 Exporter les stats (Excel)</button>
        <button class="btn secondaire" data-action="bilan-sauvegarder">Sauvegarder</button>
        <label class="btn secondaire">Restaurer<input type="file" accept=".json" hidden data-choix="bilan-restaurer"></label>
      </div>
      <p class="aide">Le fichier Excel a trois feuilles : la liste des rencontres, le détail de chaque rencontre et le cumul de chaque équipe ou joueur. « Restaurer » accepte aussi les fichiers sauvegarde_eps.json de l'ancienne version.</p>
    </div>`;
