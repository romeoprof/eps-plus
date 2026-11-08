import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, notifier, rafraichir } from '../../noyau/interface.js';
import { esc, formatChrono } from '../../noyau/outils.js';
import { APSA, NIVEAUX_PROJET } from '../contenu/apsa.js';
import { TERRAINS } from '../contenu/terrains.js';
import { compte, libelleDe, possesseur, score, tempsEcoule } from '../calculs/match.js';
import { contratDuMatch, membresDuCote } from '../calculs/progression.js';
import { projetPrecedent } from '../calculs/suivi.js';
import { nouveauMatch } from '../donnees/modele.js';
import { criteresApsa, criteresDuMatch, equipesActives, ficheApsa, matchCourant, nomCote, projetsApsa } from '../reglages.js';
import { terrain } from './terrain.js';

let zoneChoisie = null;
let positionBalle = 50;
let matchDeLaBalle = null;
let minuteurRetour;
let verrouEcran = null;

const COTES = [0, 1];
const idCote = (m, cote) => (cote ? m.b : m.a);

function garderEcranAllume() {
  try {
    if (navigator.wakeLock && !verrouEcran) {
      navigator.wakeLock
        .request('screen')
        .then((verrou) => {
          verrouEcran = verrou;
          verrou.addEventListener('release', () => {
            verrouEcran = null;
          });
        })
        .catch(() => {});
    }
  } catch {
    /* non disponible sur cet appareil */
  }
}

function retourAction(match, equipe, cle) {
  try {
    navigator.vibrate?.(35);
  } catch {
    /* non disponible (iPad) */
  }
  const bulle = document.querySelector('#retour-action');
  bulle.textContent = `✓ ${libelleDe(match, cle)} · ${nomCote(match, equipe)}`;
  bulle.classList.add('visible');
  clearTimeout(minuteurRetour);
  minuteurRetour = setTimeout(() => bulle.classList.remove('visible'), 1300);
}

/* Au premier événement, le contrat de chaque élève est enregistré dans le match. */
function figerContrats(m) {
  m.contrats = m.contrats || {};
  COTES.forEach((cote) =>
    membresDuCote(etat, m, cote).forEach((id) => {
      m.contrats[id] = contratDuMatch(etat, m, id);
    }),
  );
}

const clesContrat = (m, cote) => membresDuCote(etat, m, cote).map((id) => contratDuMatch(etat, m, id));

function arreterChrono(m) {
  if (m.departChrono) {
    m.duree += (Date.now() - m.departChrono) / 1000;
    m.departChrono = 0;
  }
}

declarerActions({
  'match-demarrer': () => {
    const a = document.querySelector('#match-a').value;
    const b = document.querySelector('#match-b').value;
    if (!a || a === b) return notifier('Choisis deux équipes différentes.');
    const m = nouveauMatch(etat.apsa, a, b);
    etat.matchs.push(m);
    etat.matchCourant = m.id;
    sauver();
    rafraichir();
  },
  'match-marquer': ({ equipe, cle }) => {
    const m = matchCourant();
    if (!m || m.termine) return;
    if (!m.evenements.length) figerContrats(m);
    if (!m.criteres) m.criteres = criteresApsa(m.apsa).map((c) => ({ ...c }));
    const evenement = { equipe: Number(equipe), critere: cle, t: Math.round(tempsEcoule(m) * 10) / 10 };
    if (zoneChoisie != null) evenement.zone = zoneChoisie;
    zoneChoisie = null;
    m.evenements.push(evenement);
    retourAction(m, evenement.equipe, cle);
    sauver();
    rafraichir();
  },
  'match-annuler': () => {
    const m = matchCourant();
    if (!m || m.termine) return;
    m.evenements.pop();
    sauver();
    rafraichir();
  },
  'match-chrono': () => {
    const m = matchCourant();
    if (m.departChrono) arreterChrono(m);
    else m.departChrono = Date.now();
    sauver();
    rafraichir();
  },
  'match-fin': () => {
    const m = matchCourant();
    arreterChrono(m);
    m.termine = !m.termine;
    if (m.termine) m.termineLe = Date.now();
    sauver();
    rafraichir();
  },
  'match-fermer': () => {
    etat.matchCourant = null;
    sauver();
    rafraichir();
  },
  'match-contrat': ({ eleve }, champ) => {
    const m = matchCourant();
    etat.contrats[eleve] = { ...etat.contrats[eleve], [m.apsa]: champ.value };
    m.contrats = { ...m.contrats, [eleve]: champ.value };
    sauver();
    rafraichir();
  },
  'match-zone': ({ zone }) => {
    const z = Number(zone);
    zoneChoisie = zoneChoisie === z ? null : z;
    rafraichir();
  },
  'match-fiche': ({ cote, rang, niveau }) => {
    const m = matchCourant();
    m.fiche[cote][ficheApsa(m.apsa)[rang]] = Number(niveau);
    sauver();
    rafraichir();
  },
  'match-bilan-projet': ({ cote, rang, niveau }) => {
    const m = matchCourant();
    const projet = projetPrecedent(etat.matchs, m, idCote(m, Number(cote)))[rang];
    m.bilanProjet[cote][projet] = Number(niveau);
    sauver();
    rafraichir();
  },
  'match-projet': ({ cote, rang }, champ) => {
    const m = matchCourant();
    const projet = projetsApsa(m.apsa)[rang];
    m.projets[cote] = m.projets[cote].filter((p) => p !== projet);
    if (champ.checked) m.projets[cote].push(projet);
    sauver();
  },
  'match-conseil': ({ cote }, champ) => {
    matchCourant().conseils[cote] = champ.value;
    sauver();
  },
});

/* Le chrono s'actualise sans redessiner tout l'écran. */
setInterval(() => {
  const m = matchCourant();
  const affichage = document.querySelector('#chrono');
  if (m?.departChrono && affichage) affichage.textContent = formatChrono(tempsEcoule(m));
}, 500);

function vueMatchLibre() {
  const equipes = equipesActives();
  const options = (rangDefaut) =>
    equipes
      .map(
        (t, rang) => `<option value="${esc(t.id)}" ${rang === rangDefaut ? 'selected' : ''}>${esc(t.nom)}${t.classe ? ` (${esc(t.classe)})` : ''}</option>`,
      )
      .join('');
  if (equipes.length < 2) {
    return `<div class="carte centre"><h2 class="carte-titre">⏱️ Match libre</h2>
      <p class="aide">Il faut au moins deux équipes pour démarrer un match.</p>
      <button class="btn" data-action="onglet" data-onglet="equipes">Créer les équipes</button></div>`;
  }
  return `<div class="carte"><h2 class="carte-titre">⏱️ Match libre</h2>
    <label class="etiquette" for="match-a">Équipe A</label><select id="match-a">${options(0)}</select>
    <label class="etiquette" for="match-b">Équipe B</label><select id="match-b">${options(1)}</select>
    <button class="btn" data-action="match-demarrer">Démarrer l'observation</button></div>
    <p class="aide centre">Pour un match de poule, ouvre l'onglet Poules.</p>`;
}

function barrePossession(m) {
  const qui = possesseur(m);
  const cible = qui == null ? 50 : qui ? 88 : 12;
  if (matchDeLaBalle !== m.id) {
    matchDeLaBalle = m.id;
    positionBalle = cible;
  }
  const depart = positionBalle;
  positionBalle = cible;
  setTimeout(() => {
    const balle = document.querySelector('#balle');
    if (balle) balle.style.left = `${cible}%`;
  }, 40);
  return `<div class="possession">
    <small>${esc(nomCote(m, 0))}</small>
    <div class="possession-rail"><span class="balle" id="balle" style="left:${depart}%">${APSA[m.apsa].icone}</span></div>
    <small>${esc(nomCote(m, 1))}</small>
  </div>`;
}

function carteContrats(m) {
  const manieres = criteresDuMatch(m).filter((c) => c.points > 0);
  const lignes = COTES.flatMap((cote) => membresDuCote(etat, m, cote)).map((id) => {
    const eleve = etat.eleves.find((e) => e.id === id);
    const choix = contratDuMatch(etat, m, id);
    return `<div class="rangee ligne-contrat">
      <label class="etire" for="contrat-${esc(id)}"><b>${esc(eleve.nom)}</b></label>
      <select id="contrat-${esc(id)}" data-choix="match-contrat" data-eleve="${esc(id)}">
        <option value="">Aucun contrat</option>
        ${manieres.map((c) => `<option value="${esc(c.cle)}" ${c.cle === choix ? 'selected' : ''}>${esc(c.libelle)}</option>`).join('')}
      </select>
    </div>`;
  });
  const contenu = lignes.length
    ? lignes.join('')
    : `<p class="aide">Le contrat est disponible pour les joueurs créés depuis la liste d'élèves.</p>`;
  return `<div class="carte"><h2 class="carte-titre">⭐ Contrat <small>la manière de marquer que chaque élève veut valoriser</small></h2>${contenu}</div>`;
}

function colonneEquipe(m, cote) {
  const contrats = clesContrat(m, cote);
  const boutons = criteresDuMatch(m)
    .map((c) => {
      const couleur = c.points > 0 ? 'vert' : c.points < 0 ? 'rouge' : c.cle === 'perte' || c.cle === 'faute' ? 'orange' : '';
      const contrat = contrats.includes(c.cle);
      return `<button class="critere ${couleur} ${contrat ? 'contrat' : ''}" ${m.termine ? 'disabled' : ''} data-action="match-marquer" data-equipe="${cote}" data-cle="${esc(c.cle)}">
        <span>${contrat ? '⭐ ' : ''}${esc(c.libelle)}</span><b>${compte(m, cote, c.cle)}</b></button>`;
    })
    .join('');
  return `<div class="colonne-equipe"><h3 class="nom-equipe cote-${cote}">${esc(nomCote(m, cote))}</h3>${boutons}</div>`;
}

function carteZones(m) {
  const cellule = (z) =>
    `<button class="zone ${zoneChoisie === z ? 'choisie' : ''}" data-action="match-zone" data-zone="${z}" aria-label="Zone ${z + 1}">${zoneChoisie === z ? '●' : ''}</button>`;
  return `<div class="carte"><h2 class="carte-titre">Où ? <small>Touche la zone, puis le critère.</small></h2>${terrain(m, cellule)}</div>`;
}

function carteProjetAObserver(m) {
  const lignes = COTES.map((cote) => {
    const projet = projetPrecedent(etat.matchs, m, idCote(m, cote));
    return projet.length ? `<p><b>${esc(nomCote(m, cote))}</b> : ${projet.map(esc).join(' · ')}</p>` : '';
  }).join('');
  return lignes ? `<div class="carte"><h2 class="carte-titre">🎯 Projet de jeu à observer</h2>${lignes}</div>` : '';
}

function carteBilanProjet(m) {
  const lignes = COTES.map((cote) => {
    const projet = projetPrecedent(etat.matchs, m, idCote(m, cote));
    if (!projet.length) return '';
    return `<p><b>${esc(nomCote(m, cote))}</b></p>${projet
      .map(
        (p, rang) => `<div class="rangee"><span class="etire">${esc(p)}</span>${NIVEAUX_PROJET.map(
          (libelle, niveau) => `<button class="btn ${m.bilanProjet[cote][p] === niveau ? '' : 'secondaire'}" data-action="match-bilan-projet" data-cote="${cote}" data-rang="${rang}" data-niveau="${niveau}">${libelle}</button>`,
        ).join('')}</div>`,
      )
      .join('')}`;
  }).join('');
  return lignes ? `<div class="carte"><h2 class="carte-titre">Le projet de jeu précédent a-t-il été mis en œuvre ?</h2>${lignes}</div>` : '';
}

function carteFiche(m) {
  const lignes = COTES.map(
    (cote) => `<p><b>${esc(nomCote(m, cote))}</b></p>${ficheApsa(m.apsa)
      .map(
        (x, rang) => `<div class="rangee"><span class="etire">${esc(x)}</span>${[1, 2, 3, 4]
          .map(
            (n) => `<button class="btn rond ${m.fiche[cote][x] === n ? '' : 'secondaire'}" data-action="match-fiche" data-cote="${cote}" data-rang="${rang}" data-niveau="${n}">${n}</button>`,
          )
          .join('')}</div>`,
      )
      .join('')}`,
  ).join('');
  return `<div class="carte"><h2 class="carte-titre">📋 Fiche d'observation <small>1 rarement · 2 parfois · 3 souvent · 4 toujours</small></h2>${lignes}</div>`;
}

function carteProjets(m) {
  const lignes = COTES.map(
    (cote) => `<p><b>${esc(nomCote(m, cote))}</b></p>
      <div class="pastilles">${projetsApsa(m.apsa)
        .map(
          (x, rang) => `<label class="pastille"><input type="checkbox" ${m.projets[cote].includes(x) ? 'checked' : ''} data-choix="match-projet" data-cote="${cote}" data-rang="${rang}">${esc(x)}</label>`,
        )
        .join('')}</div>
      <textarea rows="2" placeholder="Autre conseil (facultatif)" data-saisie="match-conseil" data-cote="${cote}">${esc(m.conseils[cote])}</textarea>`,
  ).join('');
  return `<div class="carte"><h2 class="carte-titre">🎯 Projet de jeu pour la prochaine rencontre <small>choisis 1 ou 2 projets</small></h2>${lignes}</div>`;
}

function carteJournal(m) {
  if (!m.evenements.length) return '';
  const lignes = m.evenements
    .slice(-5)
    .reverse()
    .map((e) => `<li>${esc(nomCote(m, e.equipe))} : ${esc(libelleDe(m, e.critere))}</li>`)
    .join('');
  return `<div class="carte"><h2 class="carte-titre">Journal du match</h2><ul class="journal">${lignes}</ul></div>`;
}

export function vueMatch() {
  const m = matchCourant();
  if (!m || m.apsa !== etat.apsa) return vueMatchLibre();
  garderEcranAllume();
  const avecTerrain = !m.termine && TERRAINS[m.apsa];
  const apresMatch = m.termine
    ? carteBilanProjet(m) + carteFiche(m) + (etat.reglages.conseil ? carteProjets(m) : '')
    : carteProjetAObserver(m);
  return `
    <div class="carte tableau-score">
      <div class="score"><span class="score-a">${score(m, 0)}</span><span class="score-tiret">–</span><span class="score-b">${score(m, 1)}</span></div>
      <p class="chrono" id="chrono">${formatChrono(tempsEcoule(m))}</p>
      ${barrePossession(m)}
      <div class="rangee centre-rangee">
        <button class="btn secondaire" data-action="match-chrono">${m.departChrono ? '⏸ Pause' : '▶ Chrono'}</button>
        <button class="btn secondaire" data-action="match-annuler" ${m.termine || !m.evenements.length ? 'disabled' : ''}>↩ Annuler le dernier</button>
        <button class="btn contour-rouge" data-action="match-fin">${m.termine ? 'Reprendre le match' : 'Fin du match'}</button>
        <button class="btn secondaire" data-action="match-fermer">Fermer</button>
      </div>
    </div>
    ${apresMatch}
    ${APSA[m.apsa].terrain && !m.termine ? carteContrats(m) : ''}
    <div class="disposition ${avecTerrain ? 'avec-terrain' : ''}">
      ${avecTerrain ? carteZones(m) : ''}
      <div class="colonnes-equipes">${colonneEquipe(m, 0)}${colonneEquipe(m, 1)}</div>
    </div>
    ${carteJournal(m)}`;
}
