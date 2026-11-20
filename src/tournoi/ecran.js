/*
 * GÉNÉRATEUR DE TOURNOI (Utilitaires) : création, lieux en jeu, rencontres, classement, joueurs.
 * Ouvert aux élèves et à l'enseignant. La logique est dans tournoi/calculs.js.
 */
import { etat, sauver } from '../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../noyau/interface.js';
import { esc } from '../noyau/outils.js';
import { eleveConnecte, estEnseignant } from '../noyau/espace.js';
import { FAMILLES } from '../contenu/familles.js';
import { APSA } from '../champ4/contenu/apsa.js';
import { masquer } from '../champ4/donnees/masques.js';
import {
  FORMULES, MODES, PROFILS, ajouterParticipant, basculerAbsent, changerNombreLieux, classementGeneral, classementPoule,
  corrigerResultat, creerTournoi, enregistrerDansProgression, enregistrerResultat, etatLieu, formerEquipes,
  lancerTableauFinal, nomParticipant, nomTour, participant, poulesFinies, profil, remplir, reporter, tableauLance,
  appeler, choisirArbitre, choisirJoueurs, choisirRencontre, proposition, rencontresPossibles,
  ajouterJoueur, ajouterPoule, changerPoule, deplacerJoueur, placerDansTableau, poulesModifiables, retirerJoueur, retirerPoule, tirageModifiable,
} from './calculs.js';

const local = { onglet: 'lieux', saisie: null, correction: null, choix: null, classe: '' };

/* APSA proposées : celles des familles « Sports collectifs » et « Affrontements interindividuels ». */
const APSA_TOURNOI = FAMILLES.flatMap((f) => f.activites).map((a) => a.nom).filter((nom) => PROFILS[nom]);
const iconeApsa = (apsa) => PROFILS[apsa]?.icone || APSA[apsa]?.icone || '🏆';

const tournoiCourant = () => (etat.tournois || []).find((t) => t.id === etat.tournoiCourant);

/* ---------- Préparation ---------- */
function reglagesApsa(apsa) {
  const p = profil(apsa);
  return { apsa, mode: p.modes[0], lieux: p.defautLieux, duree: Math.round(p.duree / 60), points: p.points, taille: p.modes[0] === 'double' ? 2 : p.taille || 1, nbEquipes: 0, equipes: [], source: 'hasard' };
}

function prep() {
  if (!etat.tournoiPrep) {
    etat.tournoiPrep = { formule: 'qpr', selection: [], invites: [], nom: '', progression: true, nbPoules: 0, qualifies: 2, pts: { v: 3, n: 2, d: 1 }, ...reglagesApsa(APSA_TOURNOI[0]) };
  }
  return etat.tournoiPrep;
}

const equipesExistantes = (apsa) => etat.equipes.filter((e) => e.apsa === apsa && !e.archivee && (e.membres || []).length);

/* Participants du futur tournoi : [{ nom, membres }]. */
function participantsPrep(p, alea) {
  const choisis = p.selection.map((id) => etat.eleves.find((e) => e.id === id)).filter(Boolean);
  const invites = p.invites.map((nom) => ({ id: null, nom }));
  const joueur = (e) => ({ id: e.id || null, nom: e.nom });
  if (p.mode === 'simple') return [...choisis, ...invites].map((e) => ({ nom: e.nom, joueurs: [joueur(e)] }));
  if (p.source === 'existantes') {
    return equipesExistantes(p.apsa)
      .filter((eq) => p.equipes.includes(eq.id))
      .map((eq) => ({ nom: eq.nom, joueurs: eq.membres.map((id) => etat.eleves.find((e) => e.id === id)).filter(Boolean).map(joueur) }));
  }
  const taille = p.mode === 'double' ? 2 : Math.max(1, p.taille || 1);
  const nombre = p.mode === 'equipes' ? p.nbEquipes || 0 : 0;
  return formerEquipes([...choisis, ...invites], taille, alea, nombre).map((groupe, i) => ({
    nom: p.mode === 'double' ? groupe.map((e) => e.nom).join(' & ') : `Équipe ${i + 1}`,
    joueurs: groupe.map(joueur),
  }));
}

function nombrePrevu(p) {
  if (p.mode !== 'simple' && p.source === 'existantes') return p.equipes.length;
  const n = p.selection.length + p.invites.length;
  if (p.mode === 'simple') return n;
  if (p.mode === 'equipes' && p.nbEquipes) return n ? Math.min(p.nbEquipes, n) : 0;
  return Math.max(n ? 1 : 0, Math.floor(n / (p.mode === 'double' ? 2 : Math.max(1, p.taille || 1))));
}

/* Sports collectifs : « 14 élèves → 3 équipes de 4 à 5 joueurs (2 remplaçants) ». */
function resumeEquipes(p) {
  const n = p.selection.length + p.invites.length;
  if (!n) return '';
  const nb = nombrePrevu(p);
  const min = Math.floor(n / nb);
  const max = Math.ceil(n / nb);
  const ecart = n - nb * p.taille;
  const detail = ecart > 0 ? ` · ${ecart} remplaçant${ecart > 1 ? 's' : ''} en plus des ${p.taille} joueurs` : ecart < 0 ? ` · il manque ${-ecart} élève${ecart < -1 ? 's' : ''} pour ${nb} équipes de ${p.taille}` : '';
  return `<p class="aide">${n} élèves → <b>${nb} équipe${nb > 1 ? 's' : ''}</b> de ${min === max ? min : `${min} à ${max}`} élèves${detail}. Les équipes se recomposent ensuite dans l'onglet Joueurs.</p>`;
}

function lancer() {
  const p = prep();
  const participants = participantsPrep(p);
  if (participants.length < 2) return notifier('Il faut au moins 2 participants.');
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const t = creerTournoi({
    nom: p.nom.trim() || `Tournoi de ${p.apsa} · ${date}`,
    apsa: p.apsa,
    formule: p.formule,
    mode: p.mode,
    lieux: p.lieux,
    participants,
    progression: p.progression,
    duree: 0, // pas de chronométrage des rencontres
    points: Math.max(0, Number(p.points) || 0),
    pts: p.pts,
    nbPoules: p.nbPoules || 0,
    qualifies: p.qualifies,
    organisePar: estEnseignant() ? 'Enseignant' : eleveConnecte()?.nom || null,
  });
  etat.tournois = [...(etat.tournois || []), t];
  etat.tournoiCourant = t.id;
  enregistrerDansProgression(etat, t);
  local.onglet = 'lieux';
  local.saisie = null;
  sauver();
  rafraichir();
}

/* ---------- Après chaque changement ---------- */
function annoncer(t, appels) {
  if (!appels?.length) return;
  const p = profil(t.apsa);
  const [premier] = appels;
  const texte = `${p.lieu} ${premier.table + 1} : ${nomParticipant(t, premier.a)} contre ${nomParticipant(t, premier.b)}`;
  notifier(appels.length > 1 ? `${texte} (+${appels.length - 1} autre${appels.length > 2 ? 's' : ''})` : texte);
}

function apresChangement(t, appels) {
  enregistrerDansProgression(etat, t);
  sauver();
  rafraichir();
  annoncer(t, appels);
}

function lireSaisie(bouton) {
  const panneau = bouton.closest('.tn-saisie');
  return {
    panneau,
    resultat: {
      gagnant: bouton.dataset.gagnant || null,
      sa: panneau.querySelector('.tn-sa').value,
      sb: panneau.querySelector('.tn-sb').value,
    },
  };
}

declarerActions({
  /* Préparation */
  'tn-apsa': ({ apsa }) => {
    Object.assign(prep(), reglagesApsa(apsa));
    sauver();
    rafraichir();
  },
  'tn-formule': ({ formule }) => {
    prep().formule = formule;
    sauver();
    rafraichir();
  },
  'tn-mode': ({ mode }) => {
    const p = prep();
    p.mode = mode;
    p.taille = mode === 'double' ? 2 : profil(p.apsa).taille || 1;
    sauver();
    rafraichir();
  },
  'tn-source': ({ source }) => {
    prep().source = source;
    sauver();
    rafraichir();
  },
  'tn-prep-lieux': ({ pas }) => {
    const p = prep();
    p.lieux = Math.max(1, Math.min(40, p.lieux + Number(pas)));
    sauver();
    rafraichir();
  },
  'tn-prep-valeur': ({ cle }, champ) => {
    const p = prep();
    if (cle === 'nom') p.nom = champ.value;
    else if (cle === 'progression') p.progression = champ.checked;
    else if (cle.startsWith('pts-')) p.pts = { ...p.pts, [cle.slice(4)]: Math.max(0, Number(champ.value) || 0) };
    else p[cle] = Math.max(0, Number(champ.value) || 0);
    sauver();
    if (['taille', 'nbPoules', 'nbEquipes'].includes(cle)) rafraichir();
  },
  'tn-classe': (_, champ) => {
    local.classe = champ.value;
    rafraichir();
  },
  'tn-eleve': ({ id }) => {
    const p = prep();
    p.selection = p.selection.includes(id) ? p.selection.filter((x) => x !== id) : [...p.selection, id];
    sauver();
    rafraichir();
  },
  'tn-classe-entiere': ({ classe, cocher }) => {
    const p = prep();
    const ids = etat.eleves.filter((e) => e.classe === classe).map((e) => e.id);
    p.selection = cocher === '1' ? [...new Set([...p.selection, ...ids])] : p.selection.filter((id) => !ids.includes(id));
    sauver();
    rafraichir();
  },
  'tn-equipe': ({ id }) => {
    const p = prep();
    p.equipes = p.equipes.includes(id) ? p.equipes.filter((x) => x !== id) : [...p.equipes, id];
    sauver();
    rafraichir();
  },
  'tn-invite': () => {
    const champ = document.querySelector('#tn-invite');
    const nom = champ?.value.trim();
    if (!nom) return;
    prep().invites.push(nom);
    sauver();
    rafraichir();
  },
  'tn-invite-retirer': ({ rang }) => {
    prep().invites.splice(Number(rang), 1);
    sauver();
    rafraichir();
  },
  'tn-lancer': lancer,

  /* Liste des tournois */
  'tn-ouvrir': ({ id }) => {
    etat.tournoiCourant = id;
    local.onglet = 'lieux';
    local.saisie = null;
    sauver();
    rafraichir();
  },
  'tn-liste': () => {
    etat.tournoiCourant = null;
    sauver();
    rafraichir();
  },
  'tn-supprimer': async ({ id }) => {
    const t = (etat.tournois || []).find((x) => x.id === id);
    if (!t) return;
    const ok = await demander({ titre: 'Supprimer ce tournoi ?', texte: `« ${t.nom} » et ses résultats disparaissent de cette tablette (le serveur garde ce qu'il a déjà reçu).`, confirmer: 'Supprimer', danger: true });
    if (!ok) return;
    etat.tournois = etat.tournois.filter((x) => x.id !== id);
    etat.resTournois = (etat.resTournois || []).filter((r) => r.tournoiId !== id);
    masquer(etat, 'tournois', [id]);
    if (etat.tournoiCourant === id) etat.tournoiCourant = null;
    sauver();
    rafraichir();
  },

  /* Tournoi en cours */
  'tn-onglet': ({ onglet }) => {
    local.onglet = onglet;
    local.choix = null;
    local.saisie = null;
    local.correction = null;
    rafraichir();
  },
  'tn-lieux': ({ pas }) => {
    const t = tournoiCourant();
    if (!t) return;
    const ok = changerNombreLieux(t, t.lieux + Number(pas));
    if (!ok) notifier(`Le dernier ${profil(t.apsa).lieu.toLowerCase()} est occupé : il sera retiré dès qu'il se libère.`);
    apresChangement(t, []);
  },
  'tn-score': ({ lieu }) => {
    local.choix = null;
    local.saisie = Number(lieu);
    rafraichir();
    document.querySelector('.tn-saisie .tn-sa')?.focus();
  },
  'tn-corriger': ({ id }) => {
    local.correction = id;
    rafraichir();
  },
  'tn-annuler': () => {
    local.choix = null;
    local.saisie = null;
    local.correction = null;
    rafraichir();
  },
  'tn-valider': (_, bouton) => {
    const t = tournoiCourant();
    if (!t) return;
    const { panneau, resultat } = lireSaisie(bouton);
    if (panneau.dataset.match) {
      if (!corrigerResultat(t, panneau.dataset.match, resultat)) {
        return notifier('Correction impossible : score incomplet, égalité, ou tour suivant déjà commencé.');
      }
      local.correction = null;
      return apresChangement(t, []);
    }
    const appels = enregistrerResultat(t, Number(panneau.dataset.lieu), resultat);
    if (!appels) {
      return notifier(resultat.sa !== '' && resultat.sa === resultat.sb ? 'Égalité : touche le vainqueur.' : 'Indique le score ou touche le vainqueur.');
    }
    local.saisie = null;
    apresChangement(t, appels);
  },
  'tn-reporter': ({ lieu }) => {
    const t = tournoiCourant();
    if (t) apresChangement(t, reporter(t, Number(lieu)));
  },
  'tn-absent': ({ id }) => {
    const t = tournoiCourant();
    if (t) apresChangement(t, basculerAbsent(t, id));
  },
  'tn-ajouter': () => {
    const t = tournoiCourant();
    if (!t) return;
    const choix = document.querySelector('#tn-ajout-eleve')?.value;
    const texte = document.querySelector('#tn-ajout-nom')?.value.trim();
    const eleve = etat.eleves.find((e) => e.id === choix);
    if (!eleve && !texte) return notifier('Choisis un élève ou écris un nom.');
    ajouterParticipant(t, eleve ? { nom: eleve.nom, membres: [eleve.id] } : { nom: texte, membres: [] });
    notifier(`${eleve ? eleve.nom : texte} rejoint le tournoi`);
    apresChangement(t, []);
  },
  'tn-tableau': () => {
    const t = tournoiCourant();
    if (!t || !lancerTableauFinal(t)) return;
    notifier('Tableau final lancé 🏆');
    local.onglet = 'lieux';
    apresChangement(t, []);
  },
  'tn-terminer': async () => {
    const t = tournoiCourant();
    if (!t) return;
    const enCours = t.matchs.filter((m) => m.etat === 'enjeu').length + t.tables.filter((x) => x.a && x.b && !x.matchId).length;
    const ok = await demander({
      titre: 'Terminer le tournoi ?',
      texte: enCours ? `${enCours} rencontre(s) en cours ne seront pas comptée(s). Le classement est figé.` : 'Le classement est figé. Tu pourras le rouvrir si besoin.',
      confirmer: 'Terminer',
    });
    if (!ok) return;
    t.matchs.filter((m) => m.etat === 'enjeu').forEach((m) => Object.assign(m, { etat: 'attente', table: null, debut: 0 }));
    /* Les lieux se vident, les arbitres restent. */
    t.tables.forEach((x) => Object.assign(x, { a: null, b: null, matchId: null, debut: 0, reste: null, dernier: null }));
    t.termine = true;
    t.termineLe = Date.now();
    local.onglet = 'classement';
    apresChangement(t, []);
  },
  'tn-rouvrir': () => {
    const t = tournoiCourant();
    if (!t) return;
    t.termine = false;
    t.termineLe = null;
    if (t.formule === 'qpr') {
      /* Les joueurs qui étaient sur les lieux reviennent dans la file. */
      const dansFile = new Set(t.file);
      t.participants.forEach((p) => !dansFile.has(p.id) && !p.absent && t.file.push(p.id));
    }
    local.onglet = 'lieux';
    apresChangement(t, remplir(t, Date.now(), true));
  },

  /* Arbitre d'un lieu : un élève de la liste, ou un participant hors liste (« p:id »). */
  'tn-arbitre': ({ lieu }, champ) => {
    const t = tournoiCourant();
    if (!t) return;
    const valeur = champ.value;
    let arbitre = null;
    if (valeur.startsWith('p:')) arbitre = { id: null, nom: participant(t, valeur.slice(2))?.nom };
    else if (valeur) arbitre = etat.eleves.find((e) => e.id === valeur);
    choisirArbitre(t, Number(lieu), arbitre && { id: arbitre.id, nom: arbitre.nom });
    sauver();
  },

  /* Appel des rencontres : automatique, ou au choix sur chaque lieu libre. */
  'tn-auto': () => {
    const t = tournoiCourant();
    if (!t) return;
    t.auto = t.auto === false;
    notifier(t.auto ? 'Appel automatique : chaque lieu libre reçoit la rencontre suivante.' : 'Appel au choix : touche « Lancer » ou « Choisir » sur chaque lieu libre.');
    apresChangement(t, remplir(t));
  },
  'tn-appeler': ({ lieu }) => {
    const t = tournoiCourant();
    if (t) apresChangement(t, appeler(t, Number(lieu)));
  },
  'tn-choisir': ({ lieu }) => {
    local.choix = Number(lieu);
    local.saisie = null;
    rafraichir();
  },
  'tn-prendre': ({ lieu, id }) => {
    const t = tournoiCourant();
    if (!t) return;
    if (!choisirRencontre(t, Number(lieu), id)) return notifier('Cette rencontre ne peut pas être jouée ici.');
    local.choix = null;
    const m = t.matchs.find((x) => x.id === id);
    apresChangement(t, [{ table: Number(lieu), a: m.a, b: m.b }]);
  },
  /* Composition (onglet Joueurs) */
  'tn-poule': ({ id }, champ) => {
    const t = tournoiCourant();
    if (!t) return;
    if (!changerPoule(t, id, Number(champ.value))) notifier('Les poules ne se modifient plus : des rencontres ont commencé.');
    apresChangement(t, []);
  },
  'tn-poule-ajouter': () => {
    const t = tournoiCourant();
    if (t && ajouterPoule(t)) apresChangement(t, []);
  },
  'tn-poule-retirer': ({ numero }) => {
    const t = tournoiCourant();
    if (t && retirerPoule(t, Number(numero))) apresChangement(t, []);
  },
  'tn-tirage': ({ place }, champ) => {
    const t = tournoiCourant();
    if (!t) return;
    if (!placerDansTableau(t, Number(place), champ.value)) notifier('Cette place ne se modifie pas.');
    apresChangement(t, []);
  },
  'tn-equipe-deplacer': ({ de, rang }, champ) => {
    const t = tournoiCourant();
    if (!t || !champ.value) return;
    joueursDe(participant(t, de));
    joueursDe(participant(t, champ.value));
    deplacerJoueur(t, de, Number(rang), champ.value);
    apresChangement(t, []);
  },
  'tn-equipe-retirer': ({ id, rang }) => {
    const t = tournoiCourant();
    if (!t) return;
    joueursDe(participant(t, id));
    retirerJoueur(t, id, Number(rang));
    apresChangement(t, []);
  },
  'tn-equipe-ajouter': ({ id }, champ) => {
    const t = tournoiCourant();
    const eleve = etat.eleves.find((e) => e.id === champ.value);
    if (!t || !eleve) return;
    joueursDe(participant(t, id));
    ajouterJoueur(t, id, { id: eleve.id, nom: eleve.nom });
    apresChangement(t, []);
  },  'tn-prendre-joueurs': ({ lieu }) => {
    const t = tournoiCourant();
    if (!t) return;
    const a = document.querySelector('#tn-choix-a')?.value;
    const b = document.querySelector('#tn-choix-b')?.value;
    if (!choisirJoueurs(t, Number(lieu), a, b)) return notifier('Choisis deux joueurs différents.');
    local.choix = null;
    apresChangement(t, [{ table: Number(lieu), a, b }]);
  },
});

/* ---------- Affichage : écran de départ ---------- */
const puce = (actif, action, attributs, texte) =>
  `<button class="cq-puce ${actif ? 'actif' : ''}" data-action="${action}" ${attributs} aria-pressed="${actif}">${texte}</button>`;

function blocParticipants(p) {
  const pr = profil(p.apsa);
  const modes = pr.modes.length > 1 ? `<div class="cq-puces">${pr.modes.map((m) => puce(p.mode === m, 'tn-mode', `data-mode="${m}"`, MODES[m])).join('')}</div>` : '';
  const existantes = equipesExistantes(p.apsa);
  const sources =
    p.mode !== 'simple' && existantes.length
      ? `<div class="cq-puces">${puce(p.source === 'hasard', 'tn-source', 'data-source="hasard"', '🎲 Former au hasard avec les élèves cochés')}${puce(p.source === 'existantes', 'tn-source', 'data-source="existantes"', `👥 Équipes déjà formées en ${esc(p.apsa)}`)}</div>`
      : '';
  if (p.mode !== 'simple' && p.source === 'existantes' && existantes.length) {
    return `${modes}${sources}<div class="cq-puces">${existantes.map((eq) => puce(p.equipes.includes(eq.id), 'tn-equipe', `data-id="${esc(eq.id)}"`, esc(eq.nom))).join('')}</div>`;
  }
  const classes = [...new Set(etat.eleves.map((e) => e.classe))].sort();
  const classe = classes.includes(local.classe) ? local.classe : classes[0] || '';
  const eleves = etat.eleves.filter((e) => e.classe === classe).sort((a, b) => a.nom.localeCompare(b.nom));
  const parClasse = classes
    .map((c) => [c, etat.eleves.filter((e) => e.classe === c && p.selection.includes(e.id)).length])
    .filter(([, n]) => n)
    .map(([c, n]) => `${esc(c)} : ${n}`)
    .join(' · ');
  const taille =
    p.mode === 'equipes'
      ? `<div class="tn-regles">
          <label class="tn-champ">Nombre d'équipes (0 = selon les joueurs par équipe) <input type="number" min="0" max="40" value="${p.nbEquipes || 0}" data-choix="tn-prep-valeur" data-cle="nbEquipes"></label>
          <label class="tn-champ">Joueurs par équipe (sur le terrain) <input type="number" min="1" max="15" value="${p.taille}" data-choix="tn-prep-valeur" data-cle="taille"></label>
        </div>${resumeEquipes(p)}`
      : '';
  const liste = classes.length
    ? `<div class="rangee"><label class="etiquette" for="tn-classe">Classe</label>
        <select id="tn-classe" data-choix="tn-classe">${classes.map((c) => `<option ${c === classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <button class="btn-mini" data-action="tn-classe-entiere" data-classe="${esc(classe)}" data-cocher="1">✔ Toute la classe</button>
        <button class="btn-mini" data-action="tn-classe-entiere" data-classe="${esc(classe)}" data-cocher="0">✖ Personne</button></div>
      <div class="cq-puces">${eleves.map((e) => puce(p.selection.includes(e.id), 'tn-eleve', `data-id="${esc(e.id)}"`, esc(e.nom))).join('')}</div>
      ${parClasse ? `<p class="aide">Cochés : ${parClasse}</p>` : ''}`
    : `<p class="aide">Aucune liste d'élèves sur cette tablette : ajoute les participants à la main ci-dessous (prénom + initiale).</p>`;
  const invites = p.invites.length
    ? `<div class="cq-puces">${p.invites.map((nom, i) => `<span class="cq-puce-groupe"><span class="cq-puce coulisse">${esc(nom)}</span><button class="cq-puce-x" aria-label="Retirer ${esc(nom)}" data-action="tn-invite-retirer" data-rang="${i}">×</button></span>`).join('')}</div>`
    : '';
  return `${modes}${sources}${taille}${liste}
    <div class="rangee"><input id="tn-invite" class="etire" maxlength="30" placeholder="Autre participant (prénom + initiale)" aria-label="Autre participant">
      <button class="btn secondaire" data-action="tn-invite">+ Ajouter</button></div>
    ${invites}
    <p class="aide">Les participants ajoutés à la main jouent le tournoi, mais n'ont pas de Progression.</p>`;
}

function vueCreation() {
  const p = prep();
  const pr = profil(p.apsa);
  const n = nombrePrevu(p);
  const regles = [

    pr.points || p.points
      ? `<label class="tn-champ">Rencontre en … points <input type="number" min="0" max="99" value="${p.points}" data-choix="tn-prep-valeur" data-cle="points"></label>`
      : '',
    ['championnat', 'poules'].includes(p.formule)
      ? `<div class="tn-champ">Points au classement
          <span class="rangee"><label>Victoire <input type="number" min="0" max="9" value="${p.pts.v}" data-choix="tn-prep-valeur" data-cle="pts-v"></label>
          ${pr.nul ? `<label>Nul <input type="number" min="0" max="9" value="${p.pts.n}" data-choix="tn-prep-valeur" data-cle="pts-n"></label>` : ''}
          <label>Défaite <input type="number" min="0" max="9" value="${p.pts.d}" data-choix="tn-prep-valeur" data-cle="pts-d"></label></span></div>`
      : '',
    p.formule === 'poules'
      ? `<label class="tn-champ">Nombre de poules (0 = automatique) <input type="number" min="0" max="16" value="${p.nbPoules}" data-choix="tn-prep-valeur" data-cle="nbPoules"></label>
         <label class="tn-champ">Qualifiés par poule pour le tableau <input type="number" min="1" max="8" value="${p.qualifies}" data-choix="tn-prep-valeur" data-cle="qualifies"></label>`
      : '',
  ].join('');
  const simultanes = Math.min(p.lieux, Math.floor(n / 2));
  return `
    <div class="carte"><h2 class="carte-titre">🏆 Nouveau tournoi</h2>
      <h3 class="tn-etape">1. APSA</h3>
      <div class="tn-apsa">${APSA_TOURNOI.map((a) => `<button class="tn-apsa-choix ${a === p.apsa ? 'actif' : ''}" data-action="tn-apsa" data-apsa="${esc(a)}" aria-pressed="${a === p.apsa}"><span class="tn-apsa-icone">${iconeApsa(a)}</span>${esc(a)}</button>`).join('')}</div>

      <h3 class="tn-etape">2. Formule</h3>
      <div class="tn-formules">${Object.entries(FORMULES).map(([id, f]) => `<button class="tn-formule ${id === p.formule ? 'actif' : ''}" data-action="tn-formule" data-formule="${id}" aria-pressed="${id === p.formule}"><b>${f.icone} ${f.nom}</b><small>${f.texte}</small></button>`).join('')}</div>

      <h3 class="tn-etape">3. ${pr.lieux} en jeu</h3>
      <div class="tn-compteur"><button class="btn-rond" aria-label="Un de moins" data-action="tn-prep-lieux" data-pas="-1" ${p.lieux <= 1 ? 'disabled' : ''}>−</button>
        <b>${p.lieux}</b> <span>${p.lieux > 1 ? pr.lieux.toLowerCase() : pr.lieu.toLowerCase()}</span>
        <button class="btn-rond" aria-label="Un de plus" data-action="tn-prep-lieux" data-pas="1">+</button></div>
      <p class="aide">Modifiable pendant le tournoi si ${pr.lieu === 'Tapis' ? 'un tapis' : `un${pr.lieu === 'Table' ? 'e' : ''} ${pr.lieu.toLowerCase()}`} se libère ou s'ajoute.</p>

      <h3 class="tn-etape">4. Participants <small>${n} ${p.mode === 'simple' ? `joueur${n > 1 ? 's' : ''}` : p.mode === 'double' ? `double${n > 1 ? 's' : ''}` : `équipe${n > 1 ? 's' : ''}`}${n >= 2 ? ` · jusqu'à ${simultanes} rencontre${simultanes > 1 ? 's' : ''} en même temps` : ''}</small></h3>
      ${blocParticipants(p)}

      ${regles ? `<h3 class="tn-etape">5. Règles</h3><div class="tn-regles">${regles}</div>` : ''}

      <h3 class="tn-etape">${regles ? 6 : 5}. Nom et résultats</h3>
      <input value="${esc(p.nom)}" maxlength="60" placeholder="Tournoi de ${esc(p.apsa)}" aria-label="Nom du tournoi" data-choix="tn-prep-valeur" data-cle="nom">
      <label class="tn-case"><input type="checkbox" ${p.progression ? 'checked' : ''} data-choix="tn-prep-valeur" data-cle="progression"> Enregistrer les résultats dans la <b>Progression</b> de chaque élève (visible par lui et par l'enseignant seulement)</label>

      <button class="btn bouton-large" data-action="tn-lancer" ${n < 2 ? 'disabled' : ''}>🏆 Lancer le tournoi</button>
    </div>`;
}

function vueListe() {
  const tournois = [...(etat.tournois || [])].sort((a, b) => b.cree - a.cree);
  if (!tournois.length) return '';
  return `<div class="carte"><h2 class="carte-titre">📋 Tournois de cette tablette</h2>
    <div class="tn-liste">${tournois
      .map((t) => {
        const joues = t.matchs.filter((m) => m.etat === 'fini' && !m.exempt).length;
        return `<div class="tn-liste-ligne">
          <span class="tn-apsa-icone">${iconeApsa(t.apsa)}</span>
          <div class="etire"><b>${esc(t.nom)}</b><small>${new Date(t.cree).toLocaleDateString('fr-FR')} · ${FORMULES[t.formule].nom} · ${t.participants.length} participants · ${joues} rencontre${joues > 1 ? 's' : ''} jouée${joues > 1 ? 's' : ''} · ${t.termine ? '🏁 terminé' : '🟢 en cours'}</small></div>
          <button class="btn" data-action="tn-ouvrir" data-id="${esc(t.id)}">Ouvrir</button>
          <button class="btn-rond supprimer" aria-label="Supprimer ${esc(t.nom)}" data-action="tn-supprimer" data-id="${esc(t.id)}">🗑</button>
        </div>`;
      })
      .join('')}</div></div>`;
}

/* ---------- Affichage : tournoi en cours ---------- */
/* Joueurs d'un participant (les tournois créés avant la v41 n'avaient que les identifiants). */
function joueursDe(p) {
  if (!p.joueurs) p.joueurs = (p.noms || p.membres.map((m) => etat.eleves.find((e) => e.id === m)?.nom).filter(Boolean)).map((nom) => ({ id: etat.eleves.find((e) => e.nom === nom && p.membres.includes(e.id))?.id || null, nom }));
  return p.joueurs;
}

/* Couleur propre à chaque lieu (table, terrain, tapis). */
const COULEURS_LIEUX = ['#2563eb', '#ea580c', '#16a34a', '#9333ea', '#db2777', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#0d9488', '#65a30d', '#c026d3'];
export const couleurLieu = (i) => COULEURS_LIEUX[i % COULEURS_LIEUX.length];

const noms = (t, id) => {
  const p = participant(t, id);
  if (!p) return '<b>?</b>';
  const membres = joueursDe(p).map((j) => j.nom);
  const detail = membres.length > 1 && t.mode === 'equipes' ? `<small>${esc(membres.join(', '))}</small>` : '';
  return `<span class="tn-nom ${p.absent ? 'absent' : ''}"><b>${esc(p.nom)}</b>${detail}</span>`;
};

function panneauScore(t, a, b, phase, cible) {
  const pr = profil(t.apsa);
  const nul = t.reglages.nul && phase !== 'tableau' && t.formule !== 'qpr';
  const m = cible.match ? t.matchs.find((x) => x.id === cible.match) : null;
  return `<div class="tn-saisie" ${cible.match ? `data-match="${esc(cible.match)}"` : `data-lieu="${cible.lieu}"`}>
    <div class="tn-score">
      <label><span>${esc(nomParticipant(t, a))}</span><input class="tn-sa" type="number" min="0" inputmode="numeric" value="${m?.sa ?? ''}" aria-label="Score de ${esc(nomParticipant(t, a))}"></label>
      <b>–</b>
      <label><span>${esc(nomParticipant(t, b))}</span><input class="tn-sb" type="number" min="0" inputmode="numeric" value="${m?.sb ?? ''}" aria-label="Score de ${esc(nomParticipant(t, b))}"></label>
    </div>
    <button class="btn bouton-large" data-action="tn-valider">✔ Valider le score (${esc(pr.unite)})</button>
    <p class="aide">Ou, sans score, touche le vainqueur :</p>
    <div class="tn-vainqueur">
      <button class="btn secondaire" data-action="tn-valider" data-gagnant="a">🏆 ${esc(nomParticipant(t, a))}</button>
      ${nul ? `<button class="btn secondaire" data-action="tn-valider" data-gagnant="nul">🤝 Nul</button>` : ''}
      <button class="btn secondaire" data-action="tn-valider" data-gagnant="b">🏆 ${esc(nomParticipant(t, b))}</button>
    </div>
    <button class="btn-mini" data-action="tn-annuler">Annuler</button>
  </div>`;
}

const STATUTS = { libre: '🟢 Libre', manque: '🟠 Manque un joueur', enjeu: '🔵 En jeu' };

/* Arbitre du lieu : joueurs du tournoi d'abord, puis les autres élèves de leurs classes. */
function choixArbitre(t, table, i) {
  const enJeu = new Set();
  t.tables.forEach((x) => {
    const m = x.matchId && t.matchs.find((y) => y.id === x.matchId);
    [x.a, x.b, m?.a, m?.b].filter(Boolean).forEach((id) => (participant(t, id)?.membres || []).forEach((e) => enJeu.add(e)));
  });
  const joueurs = t.participants.flatMap((p) => p.membres).map((id) => etat.eleves.find((e) => e.id === id)).filter(Boolean);
  const horsListe = t.participants.filter((p) => !p.membres.length);
  const idsJoueurs = new Set(joueurs.map((e) => e.id));
  const classes = new Set(joueurs.map((e) => e.classe));
  const actuel = table.arbitre;
  /* Les élèves en train de jouer ne peuvent pas arbitrer (sauf l'arbitre déjà choisi, gardé affiché). */
  const libre = (id) => !enJeu.has(id) || id === actuel?.id;
  const autres = etat.eleves.filter((e) => !idsJoueurs.has(e.id) && (!classes.size || classes.has(e.classe)) && libre(e.id));
  const valeurActuelle = actuel ? actuel.id || `p:${horsListe.find((p) => p.nom === actuel.nom)?.id || ''}` : '';
  const option = (valeur, nom, note = '') => `<option value="${esc(valeur)}" ${valeur === valeurActuelle ? 'selected' : ''}>${esc(nom)}${note}</option>`;
  const parNom = (x, y) => x.nom.localeCompare(y.nom);
  const groupesAutres = [...new Set(autres.map((e) => e.classe))].sort().map((classe) =>
    `<optgroup label="${esc(classe)}">${autres.filter((e) => e.classe === classe).sort(parNom).map((e) => option(e.id, e.nom)).join('')}</optgroup>`);
  return `<label class="tn-arbitre">🧑‍⚖️ Arbitre
    <select data-choix="tn-arbitre" data-lieu="${i}" aria-label="Arbitre de ${esc(profil(t.apsa).lieu)} ${i + 1}">
      <option value="">— aucun —</option>
      <optgroup label="Joueurs du tournoi">${[...joueurs].filter((e) => libre(e.id)).sort(parNom).map((e) => option(e.id, e.nom)).join('')}${horsListe.map((p) => option(`p:${p.id}`, p.nom)).join('')}</optgroup>
      ${groupesAutres.join('')}
    </select></label>`;
}

/* Choisir qui joue sur ce lieu. */
function panneauChoix(t, table, i) {
  const pr = profil(t.apsa);
  const lieu = `${pr.lieu.toLowerCase()} ${i + 1}`;
  if (t.formule === 'qpr') {
    const ici = [table.a, table.b].filter(Boolean);
    const options = [...ici, ...t.file];
    if (options.length < 2) {
      return `<div class="tn-choix"><p class="aide">Pas assez de joueurs disponibles : il faut des joueurs dans la file d'attente.</p><button class="btn-mini" data-action="tn-annuler">Fermer</button></div>`;
    }
    const prop = proposition(t, i);
    const defA = table.a || prop?.a || options[0];
    const defB = table.a && table.b ? table.b : [prop?.b, ...options].find((x) => x && x !== defA);
    const note = (id) => (id === table.reste ? ' (a perdu, reste ici)' : ici.includes(id) ? ' (sur ce lieu)' : ` (file n° ${t.file.indexOf(id) + 1})`);
    const liste = (id, defaut) =>
      `<select id="${id}" aria-label="Joueur">${options.map((o) => `<option value="${esc(o)}" ${o === defaut ? 'selected' : ''}>${esc(nomParticipant(t, o))}${note(o)}</option>`).join('')}</select>`;
    return `<div class="tn-choix"><p class="aide">Qui joue sur ${lieu} ?</p>
      <div class="tn-score">${liste('tn-choix-a', defA)}<b>–</b>${liste('tn-choix-b', defB)}</div>
      <div class="rangee"><button class="btn" data-action="tn-prendre-joueurs" data-lieu="${i}">▶ Faire jouer</button><button class="btn-mini" data-action="tn-annuler">Annuler</button></div></div>`;
  }
  const possibles = rencontresPossibles(t, i);
  const phase = (m) => (m.phase === 'tableau' ? nomTour(t, m.tour) : m.phase === 'poule' ? `Poule ${String.fromCharCode(65 + m.poule)}` : '');
  return `<div class="tn-choix"><p class="aide">Quelle rencontre sur ${lieu} ?</p>
    ${possibles.length
      ? `<div class="tn-choix-liste">${possibles.map((m) => `<button class="btn secondaire" data-action="tn-prendre" data-lieu="${i}" data-id="${esc(m.id)}"><b>${esc(nomParticipant(t, m.a))}</b> – <b>${esc(nomParticipant(t, m.b))}</b> <small>${phase(m)}</small></button>`).join('')}</div>`
      : '<p class="tn-vide">Aucune rencontre possible : les joueurs restants sont occupés ou absents.</p>'}
    <button class="btn-mini" data-action="tn-annuler">Annuler</button></div>`;
}

/* Proposition et boutons d'un lieu qui attend des joueurs. */
function boutonsAppel(t, i, texteChoisir) {
  const prop = proposition(t, i);
  const quoi = prop ? (t.formule === 'qpr' && (t.tables[i].a || t.tables[i].b) ? `Faire venir ${esc(nomParticipant(t, [prop.a, prop.b].find((x) => x !== t.tables[i].a && x !== t.tables[i].b)))}` : `Lancer ${esc(nomParticipant(t, prop.a))} – ${esc(nomParticipant(t, prop.b))}`) : '';
  return `<div class="rangee">${prop ? `<button class="btn" data-action="tn-appeler" data-lieu="${i}">▶ ${quoi}</button>` : ''}
    <button class="btn secondaire" data-action="tn-choisir" data-lieu="${i}">✋ ${texteChoisir}</button></div>`;
}

function carteLieu(t, table, i) {
  const pr = profil(t.apsa);
  const statut = etatLieu(t, table);
  const m = table.matchId ? t.matchs.find((x) => x.id === table.matchId) : null;
  const a = m ? m.a : table.a;
  const b = m ? m.b : table.b;
  /* Qui perd reste : le perdant reste affiché sur son lieu, avec un repère. */
  const nom = (id) => `<span class="tn-nom-bloc">${noms(t, id)}${id && id === table.reste ? '<small class="tn-reste">🔁 a perdu, reste ici</small>' : ''}</span>`;
  let corps;
  if (local.choix === i) {
    corps = panneauChoix(t, table, i);
  } else if (statut === 'libre') {
    const prop = proposition(t, i);
    corps = `${prop ? '' : `<p class="tn-vide">${t.formule === 'qpr' ? 'Personne dans la file d’attente' : 'Aucune rencontre ne peut être appelée ici pour l’instant'}</p>`}
      ${boutonsAppel(t, i, 'Choisir qui joue')}`;
  } else if (statut === 'manque') {
    if (m) {
      const absents = [a, b].filter((id) => participant(t, id)?.absent);
      corps = `<div class="tn-face">${nom(a)}<span class="tn-contre">contre</span>${nom(b)}</div>
        <p class="tn-alerte">⛔ ${absents.map((id) => esc(nomParticipant(t, id))).join(' et ')} absent${absents.length > 1 ? 's' : ''}</p>
        <div class="rangee"><button class="btn secondaire" data-action="tn-reporter" data-lieu="${i}">↩ Reporter</button>
        <button class="btn secondaire" data-action="tn-choisir" data-lieu="${i}">✋ Autre rencontre</button></div>`;
    } else {
      corps = `<div class="tn-face">${nom(a || b)}<span class="tn-contre">attend</span><span class="tn-place-vide">?</span></div>
        ${boutonsAppel(t, i, 'Choisir l’adversaire')}`;
    }
  } else {
    const phase = m?.phase === 'tableau' ? `<small class="tn-phase">${nomTour(t, m.tour)}</small>` : m?.phase === 'poule' ? `<small class="tn-phase">Poule ${String.fromCharCode(65 + m.poule)}</small>` : '';
    corps =
      local.saisie === i
        ? panneauScore(t, a, b, m?.phase || 'qpr', { lieu: i })
        : `${phase}<div class="tn-face">${nom(a)}<span class="tn-contre">contre</span>${nom(b)}</div>
          <div class="rangee"><button class="btn" data-action="tn-score" data-lieu="${i}">✅ Résultat</button>
          <button class="btn-mini" data-action="tn-choisir" data-lieu="${i}">🔄 Changer</button>
          ${m ? `<button class="btn-mini" data-action="tn-reporter" data-lieu="${i}">↩ Reporter</button>` : ''}</div>`;
  }
  return `<div class="tn-lieu ${statut}" style="--lieu: ${couleurLieu(i)}">
    <div class="tn-lieu-tete"><b class="tn-lieu-nom">${pr.lieu} ${i + 1}</b><span class="tn-statut">${STATUTS[statut]}</span></div>
    ${corps}
    ${choixArbitre(t, table, i)}
  </div>`;
}
/* Ce qui attend : file (qui perd reste) ou prochaines rencontres (autres formules). */
function blocAttente(t) {
  if (t.formule === 'qpr') {
    const absents = t.participants.filter((p) => p.absent);
    return `<div class="carte"><h2 class="carte-titre">⏳ File d'attente <small>${t.file.length}</small></h2>
      ${t.file.length ? `<ol class="tn-file">${t.file.map((id) => `<li>${esc(nomParticipant(t, id))}</li>`).join('')}</ol>` : '<p class="aide">Personne n’attend : tout le monde joue.</p>'}
      <p class="aide">Le gagnant sort et se place au bout de la file ; le premier de la file va là où il manque un joueur.</p>
      ${absents.length ? `<p class="aide">En pause : ${absents.map((p) => esc(p.nom)).join(', ')}</p>` : ''}
    </div>`;
  }
  const pr = profil(t.apsa);
  const occupe = new Map();
  t.matchs.filter((m) => m.etat === 'enjeu').forEach((m) => [m.a, m.b].forEach((id) => occupe.set(id, m.table)));
  const prochaines = t.matchs.filter((m) => m.etat === 'attente' && m.a && m.b);
  const enAttenteVainqueurs = t.matchs.filter((m) => m.etat === 'attente' && (!m.a || !m.b)).length;
  const ligne = (m) => {
    const raisons = [m.a, m.b]
      .map((id) => {
        if (participant(t, id)?.absent) return `⛔ ${esc(nomParticipant(t, id))} absent`;
        if (occupe.has(id)) return `⏳ ${esc(nomParticipant(t, id))} joue (${pr.lieu.toLowerCase()} ${occupe.get(id) + 1})`;
        return '';
      })
      .filter(Boolean);
    return `<li><b>${esc(nomParticipant(t, m.a))}</b> – <b>${esc(nomParticipant(t, m.b))}</b>
      ${m.phase === 'poule' ? `<small>Poule ${String.fromCharCode(65 + m.poule)}</small>` : m.phase === 'tableau' ? `<small>${nomTour(t, m.tour)}</small>` : ''}
      <span class="tn-raison">${raisons.length ? raisons.join(' · ') : `✔ prête : attend ${pr.lieu === 'Table' ? 'une table libre' : `un ${pr.lieu.toLowerCase()} libre`}`}</span></li>`;
  };
  return `<div class="carte"><h2 class="carte-titre">⏳ Prochaines rencontres <small>${prochaines.length} à jouer</small></h2>
    ${prochaines.length ? `<ol class="tn-prochaines">${prochaines.slice(0, 10).map(ligne).join('')}</ol>${prochaines.length > 10 ? `<p class="aide">… et ${prochaines.length - 10} autres (onglet Rencontres).</p>` : ''}` : '<p class="aide">Aucune rencontre prête.</p>'}
    ${enAttenteVainqueurs ? `<p class="aide">${enAttenteVainqueurs} rencontre${enAttenteVainqueurs > 1 ? 's' : ''} du tableau attend${enAttenteVainqueurs > 1 ? 'ent' : ''} des vainqueurs.</p>` : ''}
  </div>`;
}

function podium(t) {
  const c = classementGeneral(t).filter((x) => x.rang && x.rang <= 3);
  if (!c.length) return '';
  const medaille = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return `<div class="tn-podium">${c.map((x) => `<div class="tn-marche rang-${x.rang}"><span>${medaille[x.rang]}</span><b>${esc(x.nom)}</b></div>`).join('')}</div>`;
}

function ongletLieux(t) {
  const pr = profil(t.apsa);
  if (t.termine) {
    return `<div class="carte centre"><h2 class="carte-titre">🏁 Tournoi terminé</h2>${podium(t)}
      <div class="rangee" style="justify-content:center"><button class="btn secondaire" data-action="tn-rouvrir">↺ Reprendre le tournoi</button></div></div>`;
  }
  const statuts = t.tables.map((x) => etatLieu(t, x));
  const compte = (s) => statuts.filter((x) => x === s).length;
  const attente = t.formule === 'qpr' ? t.file.length : t.matchs.filter((m) => m.etat === 'attente' && m.a && m.b).length;
  const resteAJouer = t.matchs.some((m) => m.etat !== 'fini');
  const tableauAPreparer = poulesFinies(t) && !tableauLance(t);
  const toutJoue = t.formule !== 'qpr' && !resteAJouer && !tableauAPreparer;
  return `
    <div class="tn-resume">
      <span class="tn-badge enjeu">🔵 ${compte('enjeu')} en jeu</span>
      <span class="tn-badge manque">🟠 ${compte('manque')} manque un joueur</span>
      <span class="tn-badge libre">🟢 ${compte('libre')} libre${compte('libre') > 1 ? 's' : ''}</span>
      <span class="tn-badge">⏳ ${attente} en attente</span>
      <button class="btn-mini" data-action="tn-auto" aria-pressed="${t.auto !== false}">${t.auto !== false ? '🤖 Appel automatique' : '✋ Appel au choix'}</button>
      <span class="tn-compteur petit">${pr.lieux} : <button class="btn-rond" aria-label="Un de moins" data-action="tn-lieux" data-pas="-1" ${t.lieux <= 1 ? 'disabled' : ''}>−</button><b>${t.lieux}</b><button class="btn-rond" aria-label="Un de plus" data-action="tn-lieux" data-pas="1">+</button></span>
    </div>
    ${!t.matchs.some((m) => m.etat !== 'attente' && !m.exempt) && !t.tables.some((x) => x.a || x.b) ? `<div class="carte tn-annonce"><b>▶ Le tournoi est prêt, aucune rencontre n'a commencé.</b> ${t.formule === 'poules' || t.mode !== 'simple' || t.formule === 'elimination' ? 'Vérifie la composition dans l’onglet Joueurs, puis lance' : 'Lance'} chaque ${pr.lieu.toLowerCase()} avec « ▶ Lancer » ou « ✋ Choisir qui joue ».</div>` : ''}
    ${tableauAPreparer ? `<div class="carte tn-annonce"><b>🧩 Toutes les rencontres de poule sont jouées.</b> Les ${t.reglages.qualifies} premiers de chaque poule passent dans le tableau final.<button class="btn" data-action="tn-tableau">🏆 Lancer le tableau final</button></div>` : ''}
    ${toutJoue ? `<div class="carte tn-annonce"><b>✔ Toutes les rencontres sont jouées.</b>${podium(t)}<button class="btn" data-action="tn-terminer">🏁 Terminer le tournoi</button></div>` : ''}
    <div class="tn-lieux">${t.tables.map((table, i) => carteLieu(t, table, i)).join('')}</div>
    ${blocAttente(t)}
    ${toutJoue ? '' : `<div class="rangee fin"><button class="btn secondaire" data-action="tn-terminer">🏁 Terminer le tournoi</button></div>`}`;
}

function ligneRencontre(t, m) {
  const pr = profil(t.apsa);
  const phase = m.phase === 'tableau' ? nomTour(t, m.tour) : m.phase === 'poule' ? `Poule ${String.fromCharCode(65 + m.poule)}` : '';
  if (local.correction === m.id) return `<li class="tn-rencontre">${panneauScore(t, m.a, m.b, m.phase, { match: m.id })}</li>`;
  const nomCote = (cote) => (m[cote] ? esc(nomParticipant(t, m[cote])) : '<i>à venir</i>');
  const gras = (cote, texte) => (m.gagnant === cote ? `<b>${texte}</b>` : texte);
  const score = m.etat === 'fini' && (m.sa != null || m.sb != null) ? `${m.sa ?? '–'} – ${m.sb ?? '–'}` : m.gagnant === 'nul' ? 'nul' : '–';
  const etatTexte = m.etat === 'enjeu' ? `🔵 ${pr.lieu} ${m.table + 1}` : m.etat === 'fini' ? '' : '⏳';
  return `<li class="tn-rencontre ${m.etat}">
    <span class="tn-r-phase">${phase}${m.arbitre ? `<small class="tn-r-arbitre">🧑‍⚖️ ${esc(m.arbitre)}</small>` : ''}</span>
    <span class="tn-r-a">${gras('a', nomCote('a'))}</span><span class="tn-r-score">${m.etat === 'fini' ? score : etatTexte}</span><span class="tn-r-b">${gras('b', nomCote('b'))}</span>
    ${m.etat === 'fini' && !t.termine ? `<button class="btn-mini" data-action="tn-corriger" data-id="${esc(m.id)}" aria-label="Corriger">✏️</button>` : '<span></span>'}
  </li>`;
}

function ongletRencontres(t) {
  const reelles = t.matchs.filter((m) => !m.exempt);
  const groupes = [
    ['🔵 En cours', reelles.filter((m) => m.etat === 'enjeu')],
    ['⏳ À jouer', reelles.filter((m) => m.etat === 'attente')],
    ['✔ Jouées', reelles.filter((m) => m.etat === 'fini').sort((a, b) => b.fin - a.fin)],
  ].filter(([, liste]) => liste.length);
  if (!groupes.length) return '<div class="carte centre"><p class="aide">Aucune rencontre pour l’instant.</p></div>';
  return groupes.map(([titre, liste]) => `<div class="carte"><h2 class="carte-titre">${titre} <small>${liste.length}</small></h2><ul class="tn-rencontres">${liste.map((m) => ligneRencontre(t, m)).join('')}</ul></div>`).join('');
}

function tableClassement(t, lignes, avecPoints) {
  const pct = (x) => (x.joues ? `${Math.round((100 * x.v) / x.joues)} %` : '–');
  return `<div class="defile"><table class="tn-classement">
    <tr><th>Rang</th><th>Nom</th>${avecPoints ? '<th>Pts</th>' : ''}<th>J</th><th>V</th>${t.reglages.nul ? '<th>N</th>' : ''}<th>D</th><th>${avecPoints ? '+/−' : '% V'}</th></tr>
    ${lignes
      .map(
        (x, i) => `<tr class="${participant(t, x.id)?.absent ? 'absent' : ''}"><td>${x.rang ?? (avecPoints ? i + 1 : '–')}</td><td><b>${esc(x.nom)}</b></td>${avecPoints ? `<td><b>${x.points}</b></td>` : ''}<td>${x.joues}</td><td>${x.v}</td>${t.reglages.nul ? `<td>${x.n}</td>` : ''}<td>${x.d}</td><td>${avecPoints ? `${x.pour - x.contre > 0 ? '+' : ''}${x.pour - x.contre}` : pct(x)}</td></tr>`,
      )
      .join('')}
  </table></div>`;
}

/* Tableau final : chaque rencontre est reliée par un trait fin à celle du tour suivant. */
function arbre(t) {
  const tableau = t.matchs.filter((m) => m.phase === 'tableau');
  if (!tableau.length) return '';
  const tours = Math.max(...tableau.map((m) => m.tour)) + 1;
  const taille = 2 ** tours;
  const S = 74; // hauteur réservée à une rencontre du premier tour
  const L = 180; // largeur d'une case
  const E = 40; // espace entre deux tours
  const H = 58; // hauteur d'une case
  const y = (tour, rang) => S * (2 ** tour * rang + (2 ** tour - 1) / 2) + S / 2;
  const x = (tour) => tour * (L + E);
  const largeur = tours * (L + E) - E;
  const hauteur = (S * taille) / 2;
  const traits = tableau
    .filter((m) => m.tour < tours - 1)
    .map((m) => {
      const x1 = x(m.tour) + L;
      const y1 = y(m.tour, m.rang);
      const y2 = y(m.tour + 1, Math.floor(m.rang / 2));
      return `<path class="${m.etat === 'fini' ? 'joue' : ''} ${m.exempt ? 'exempt' : ''}" d="M${x1} ${y1} H${x1 + E / 2} V${y2} H${x(m.tour + 1)}"/>`;
    })
    .join('');
  const cases = tableau
    .map((m) => {
      const cote = (c) => {
        const s = m[`s${c}`];
        const nom = m[c] ? esc(nomParticipant(t, m[c])) : m.exempt ? '<i>exempt</i>' : '<i>…</i>';
        return `<div class="${m.gagnant === c && !m.exempt ? 'gagne' : ''}"><span>${nom}</span><b>${s ?? ''}</b></div>`;
      };
      const lieu = m.etat === 'enjeu' ? `;--lieu:${couleurLieu(m.table)}` : '';
      return `<div class="tn-case-arbre ${m.etat} ${m.exempt ? 'exempt' : ''}" style="left:${x(m.tour)}px;top:${y(m.tour, m.rang) - H / 2}px;width:${L}px;height:${H}px${lieu}">${cote('a')}${cote('b')}</div>`;
    })
    .join('');
  const titres = Array.from({ length: tours }, (_, tour) => `<h4 style="left:${x(tour)}px;width:${L}px">${nomTour(t, tour)}</h4>`).join('');
  return `<div class="carte"><h2 class="carte-titre">🏆 Tableau final</h2>
    <div class="tn-arbre"><div class="tn-arbre-dessin" style="width:${largeur}px;height:${hauteur + 34}px">
      <div class="tn-arbre-titres">${titres}</div>
      <div class="tn-arbre-corps" style="height:${hauteur}px">
        <svg class="tn-arbre-traits" width="${largeur}" height="${hauteur}" aria-hidden="true">${traits}</svg>
        ${cases}
      </div>
    </div></div></div>`;
}
function ongletClassement(t) {
  const general = classementGeneral(t);
  const qpr = t.formule === 'qpr';
  const tete = t.termine ? `<div class="carte centre"><h2 class="carte-titre">🏁 Classement final</h2>${podium(t)}</div>` : '';
  if (t.formule === 'poules') {
    const poules = t.poules
      .map((_, numero) => `<div class="carte"><h2 class="carte-titre">🧩 Poule ${String.fromCharCode(65 + numero)}</h2>${tableClassement(t, classementPoule(t, numero), true)}</div>`)
      .join('');
    return `${tete}${arbre(t)}<div class="grille-reglages">${poules}</div>
      ${tableauLance(t) ? `<div class="carte"><h2 class="carte-titre">📊 Classement général</h2>${tableClassement(t, general, false)}</div>` : ''}`;
  }
  if (t.formule === 'elimination') {
    return `${tete}${arbre(t)}<div class="carte"><h2 class="carte-titre">📊 Classement</h2><p class="aide">Les participants encore en course n'ont pas encore de rang.</p>${tableClassement(t, general, false)}</div>`;
  }
  return `${tete}<div class="carte"><h2 class="carte-titre">📊 Classement ${t.termine ? 'final' : 'provisoire'}</h2>
    <p class="aide">${qpr ? 'Classés au nombre de victoires, puis au pourcentage de victoires.' : `Victoire ${t.reglages.pts.v} pts${t.reglages.nul ? ` · nul ${t.reglages.pts.n}` : ''} · défaite ${t.reglages.pts.d}. À égalité : différence de points.`}</p>
    ${tableClassement(t, general, !qpr)}</div>`;
}

const lettre = (numero) => String.fromCharCode(65 + numero);

/* Composition des poules : un participant change de poule, les rencontres de poule sont refaites. */
function blocPoules(t) {
  if (t.formule !== 'poules') return '';
  const modif = poulesModifiables(t);
  const choixPoule = (id, numero) =>
    modif
      ? `<select data-choix="tn-poule" data-id="${esc(id)}" aria-label="Poule de ${esc(nomParticipant(t, id))}">${t.poules.map((_, n) => `<option value="${n}" ${n === numero ? 'selected' : ''}>Poule ${lettre(n)}</option>`).join('')}</select>`
      : '';
  const cartes = t.poules
    .map(
      (poule, numero) => `<div class="tn-poule" style="--lieu: ${couleurLieu(numero)}">
        <h3>Poule ${lettre(numero)} <small>${poule.length}</small>${modif && !poule.length ? `<button class="btn-mini" data-action="tn-poule-retirer" data-numero="${numero}">✖ Retirer</button>` : ''}</h3>
        <ul>${poule.map((id) => `<li><b>${esc(nomParticipant(t, id))}</b>${choixPoule(id, numero)}</li>`).join('') || '<li class="aide">Vide : déplace des participants ici.</li>'}</ul>
      </div>`,
    )
    .join('');
  return `<div class="carte"><h2 class="carte-titre">🧩 Composition des poules</h2>
    <p class="aide">${modif ? 'Change un participant de poule avec son menu : les rencontres de poule sont refaites. Possible tant qu’aucune rencontre de poule n’a commencé.' : 'Des rencontres de poule ont commencé : les poules ne se modifient plus.'}</p>
    <div class="tn-poules">${cartes}</div>
    ${modif ? '<button class="btn secondaire" data-action="tn-poule-ajouter">＋ Ajouter une poule</button>' : ''}
  </div>`;
}

/* Élimination directe : qui joue contre qui au premier tour. */
function blocTirage(t) {
  if (t.formule !== 'elimination') return '';
  const modif = tirageModifiable(t);
  const premiers = t.matchs.filter((m) => m.phase === 'tableau' && m.tour === 0).sort((a, b) => a.rang - b.rang);
  const place = (m, cote) => {
    const id = m[cote];
    if (!id) return '<span class="tn-exempt">— exempt —</span>';
    if (!modif) return `<b>${esc(nomParticipant(t, id))}</b>`;
    return `<select data-choix="tn-tirage" data-place="${2 * m.rang + (cote === 'b' ? 1 : 0)}" aria-label="Place du tableau">${t.participants
      .map((p) => `<option value="${esc(p.id)}" ${p.id === id ? 'selected' : ''}>${esc(p.nom)}</option>`)
      .join('')}</select>`;
  };
  return `<div class="carte"><h2 class="carte-titre">⚔️ Premier tour : qui joue contre qui</h2>
    <p class="aide">${modif ? 'Choisis un participant dans une case : il échange sa place avec celui qui y était. Possible tant qu’aucune rencontre n’a commencé.' : 'Le tableau a commencé : le premier tour ne se modifie plus.'}</p>
    <ol class="tn-tirage">${premiers.map((m) => `<li>${place(m, 'a')}<span class="tn-contre">contre</span>${place(m, 'b')}</li>`).join('')}</ol>
  </div>`;
}

/* Équipes et doubles : déplacer, ajouter ou retirer un joueur. */
function blocEquipes(t) {
  if (t.mode === 'simple') return '';
  const pris = new Set(t.participants.flatMap((p) => joueursDe(p).map((j) => j.id).filter(Boolean)));
  const disponibles = etat.eleves.filter((e) => !pris.has(e.id)).sort((a, b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom));
  const cartes = t.participants
    .map((p, n) => {
      const joueurs = joueursDe(p);
      const lignes = joueurs
        .map(
          (j, rang) => `<li><b>${esc(j.nom)}</b>
          <select data-choix="tn-equipe-deplacer" data-de="${esc(p.id)}" data-rang="${rang}" aria-label="Changer ${esc(j.nom)} d'équipe">
            <option value="">→ autre équipe…</option>${t.participants.filter((x) => x !== p).map((x) => `<option value="${esc(x.id)}">${esc(x.nom)}</option>`).join('')}
          </select>
          <button class="btn-rond supprimer" aria-label="Retirer ${esc(j.nom)}" data-action="tn-equipe-retirer" data-id="${esc(p.id)}" data-rang="${rang}">✖</button></li>`,
        )
        .join('');
      const ajout = disponibles.length
        ? `<select data-choix="tn-equipe-ajouter" data-id="${esc(p.id)}" aria-label="Ajouter un élève à ${esc(p.nom)}"><option value="">＋ ajouter un élève…</option>${disponibles.map((e) => `<option value="${esc(e.id)}">${esc(e.nom)} (${esc(e.classe)})</option>`).join('')}</select>`
        : '';
      return `<div class="tn-poule" style="--lieu: ${couleurLieu(n)}"><h3>${esc(p.nom)} <small>${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''}</small></h3><ul>${lignes || '<li class="aide">Aucun joueur.</li>'}</ul>${ajout}</div>`;
    })
    .join('');
  return `<div class="carte"><h2 class="carte-titre">👥 Composition des ${t.mode === 'double' ? 'doubles' : 'équipes'}</h2>
    <p class="aide">Change un joueur d'équipe avec son menu, retire-le avec ✖ ou ajoute un élève de la liste. La Progression suit la composition.</p>
    <div class="tn-poules">${cartes}</div></div>`;
}

function ongletJoueurs(t) {
  const lignes = t.participants
    .map((p) => {
      const membres = joueursDe(p).map((j) => j.nom);
      return `<li class="tn-joueur ${p.absent ? 'absent' : ''}">
        <div class="etire"><b>${esc(p.nom)}</b>${membres.length > 1 || (membres[0] && membres[0] !== p.nom) ? `<small>${esc(membres.join(', '))}</small>` : ''}${p.membres.length ? '' : '<small>hors liste (pas de Progression)</small>'}</div>
        <button class="btn-mini" data-action="tn-absent" data-id="${esc(p.id)}" aria-pressed="${p.absent}">${p.absent ? '⛔ Absent · le remettre' : '✔ Présent'}</button>
      </li>`;
    })
    .join('');
  const deja = new Set(t.participants.flatMap((p) => p.membres));
  const libres = etat.eleves.filter((e) => !deja.has(e.id)).sort((a, b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom));
  const ajout =
    ['qpr', 'championnat'].includes(t.formule) && !t.termine
      ? `<div class="carte"><h2 class="carte-titre">➕ Ajouter un participant en retard</h2>
        <div class="rangee">
          ${t.mode === 'simple' && libres.length ? `<select id="tn-ajout-eleve" aria-label="Élève à ajouter"><option value="">Élève de la liste…</option>${libres.map((e) => `<option value="${esc(e.id)}">${esc(e.nom)} (${esc(e.classe)})</option>`).join('')}</select>` : ''}
          <input id="tn-ajout-nom" class="etire" maxlength="30" placeholder="${t.mode === 'simple' ? 'ou un autre nom' : 'Nom de l’équipe'}" aria-label="Nom du participant">
          <button class="btn" data-action="tn-ajouter">Ajouter</button>
        </div>
        <p class="aide">${t.formule === 'qpr' ? 'Il se place au bout de la file d’attente.' : 'Ses rencontres contre tous les autres sont ajoutées.'}</p></div>`
      : '';
  return `${blocPoules(t)}${blocTirage(t)}${blocEquipes(t)}
    <div class="carte"><h2 class="carte-titre">✔ Présents <small>${t.participants.length}</small></h2>
    <p class="aide">Un participant absent n'est plus appelé ; ${t.formule === 'qpr' ? 'il quitte sa place et revient au bout de la file quand on le remet.' : 'ses rencontres attendent son retour.'}</p>
    <ul class="tn-joueurs">${lignes}</ul></div>${ajout}`;
}
function vueTournoi(t) {
  const pr = profil(t.apsa);
  const r = t.reglages;
  const regles = [r.points ? `rencontre en ${r.points} ${pr.unite}` : '', t.progression ? '📈 Progression' : ''].filter(Boolean).join(' · ');
  const onglets = [
    ['lieux', `${iconeApsa(t.apsa)} ${pr.lieux}`],
    ['rencontres', '📋 Rencontres'],
    ['classement', '🏆 Classement'],
    ['joueurs', '👥 Joueurs'],
  ];
  const contenu = { lieux: ongletLieux, rencontres: ongletRencontres, classement: ongletClassement, joueurs: ongletJoueurs }[local.onglet] || ongletLieux;
  return `
    <div class="carte tn-entete">
      <div class="etire"><h2 class="carte-titre">${iconeApsa(t.apsa)} ${esc(t.nom)}</h2>
        <small>${FORMULES[t.formule].icone} ${FORMULES[t.formule].nom} · ${MODES[t.mode]} · ${t.participants.length} participants${regles ? ` · ${regles}` : ''}</small></div>
      <button class="btn-mini" data-action="tn-liste">← Tous les tournois</button>
    </div>
    <div class="onglets tn-onglets" role="tablist">${onglets.map(([id, libelle]) => `<button role="tab" class="onglet ${local.onglet === id ? 'actif' : ''}" aria-selected="${local.onglet === id}" data-action="tn-onglet" data-onglet="${id}">${libelle}</button>`).join('')}</div>
    ${contenu(t)}`;
}

export function vueTournois() {
  const t = tournoiCourant();
  if (t) return vueTournoi(t);
  return `${vueListe()}${vueCreation()}`;
}
