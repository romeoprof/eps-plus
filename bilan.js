import { etat, remplacerEtat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../../noyau/interface.js';
import { esc, lireNombre } from '../../noyau/outils.js';
import { APSA, NIVEAUX_FICHE, NIVEAUX_PROJET, REPERES } from '../contenu/apsa.js';
import { nomZone, TERRAINS } from '../contenu/terrains.js';
import { score } from '../calculs/match.js';
import { indicateurs } from '../calculs/stats.js';
import { profilJoueur, rencontresParEquipe } from '../calculs/suivi.js';
import { exporterCsv, exporterSauvegarde } from '../donnees/export.js';
import { lireSauvegarde } from '../donnees/migration.js';
import { reinitialiserBilans } from '../donnees/operations.js';
import { nomCote, nomEquipe } from '../reglages.js';
import { afficherFiche } from './fiche.js';
import { terrain } from './terrain.js';

const COTES = [0, 1];
const matchsObserves = () => etat.matchs.filter((m) => m.apsa === etat.apsa && m.evenements.length);
const matchAffiche = () => {
  const liste = matchsObserves();
  return liste.find((m) => m.id === etat.matchBilan) || liste[0];
};

declarerActions({
  'bilan-match': (_, champ) => {
    etat.matchBilan = champ.value;
    sauver();
    rafraichir();
  },
  'bilan-fiche': ({ cote }) => afficherFiche(matchAffiche(), Number(cote)),
  'bilan-csv': () => exporterCsv(etat),
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

function courbe(parts) {
  const L = 240;
  const H = 64;
  const points = parts.map((v, i) => [parts.length > 1 ? 12 + (i * (L - 24)) / (parts.length - 1) : L / 2, H - 10 - v * (H - 20)]);
  return `<svg class="courbe" viewBox="0 0 ${L} ${H}" role="img" aria-label="Part des points gagnés à chaque rencontre">
    <polyline fill="none" stroke="#2563eb" stroke-width="2" points="${points.map((p) => p.join(',')).join(' ')}"/>
    ${points.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#ea580c"/><text x="${p[0]}" y="${p[1] - 6}" font-size="9" text-anchor="middle">${Math.round(parts[i] * 100)} %</text>`).join('')}
  </svg>`;
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

export function vueBilan() {
  const liste = matchsObserves();
  const m = matchAffiche();
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
    ${carteMatch}
    ${carteProgression()}
    ${carteSuivi()}
    <div class="carte"><h2 class="carte-titre">💾 Exporter et sauvegarder</h2>
      <div class="rangee">
        <button class="btn" data-action="bilan-csv">Exporter les stats (Excel)</button>
        <button class="btn secondaire" data-action="bilan-sauvegarder">Sauvegarder</button>
        <label class="btn secondaire">Restaurer<input type="file" accept=".json" hidden data-choix="bilan-restaurer"></label>
      </div>
      <p class="aide">« Restaurer » accepte aussi les fichiers sauvegarde_eps.json de l'ancienne version.</p>
    </div>
    <button class="btn secondaire" data-action="bilan-reinitialiser">Réinitialiser les bilans</button>`;
}
