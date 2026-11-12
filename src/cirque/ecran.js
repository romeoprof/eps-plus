/*
 * Arts du cirque, d'après l'application cirque-eps d'un collègue :
 * Troupe (artistes de la liste d'élèves ou noms libres), carnet de chorégraphe
 * (5 étapes, émotions, piste avec tableaux, coulisses et animation), carnet d'artiste
 * (manipulation, équilibre, acrobatie) et bilan du spectacle.
 * Le carnet d'un élève de la liste va dans sa Progression ; l'évaluation est réservée à l'enseignant.
 */
import { etat, sauver } from '../noyau/etat.js';
import { eleveConnecte, estEnseignant, observateur } from '../noyau/espace.js';
import { declarerActions, demander, notifier, rafraichir, vue } from '../noyau/interface.js';
import { esc } from '../noyau/outils.js';
import { COULEURS_ARTISTES, ETAPES, EVALUATIONS, FAMILLES_CIRQUE, MAX_ARTISTES, MAX_TABLEAUX } from './contenu.js';
import {
  ajouterMembre,
  carnetVide,
  cirqueVide,
  elementVide,
  listeCirque,
  niveauElement,
  nouvelleTroupe,
  retirerMembre,
  tableauSuivant,
} from './calculs.js';

export const ONGLETS_CIRQUE = [
  { id: 'troupe', libelle: '👥 Troupe' },
  { id: 'choregraphe', libelle: '🎬 Chorégraphe' },
  { id: 'artiste', libelle: '🤸 Artiste' },
  { id: 'bilan', libelle: '📋 Bilan' },
];

let etapeVue = 0;
let tableauVu = 0;
let artisteVu = null;
let classeAjout = '';
const animation = { minuteur: null, rang: 0 };

/* ---------- Données ---------- */
function cirque() {
  if (!etat.cirque) etat.cirque = cirqueVide();
  etat.cirque.troupes = etat.cirque.troupes || [];
  etat.cirque.carnets = etat.cirque.carnets || {};
  return etat.cirque;
}
const troupe = () => cirque().troupes.find((t) => t.id === cirque().troupeCourante) || null;
const etape = () => troupe()?.etapes[etapeVue];
const tableau = () => etape()?.tableaux[Math.min(tableauVu, etape().tableaux.length - 1)];
const couleur = (t, id) => COULEURS_ARTISTES[Math.max(0, t.membres.findIndex((m) => m.id === id)) % COULEURS_ARTISTES.length];
const nomMembre = (t, id) => t.membres.find((m) => m.id === id)?.nom || '?';

/* Chaque modification date la troupe et note qui l'a faite (pour l'échange entre tablettes). */
function noterTroupe(t = troupe()) {
  if (!t) return;
  t.majLe = Date.now();
  t.observePar = observateur();
  sauver();
}

function carnet(id) {
  const c = cirque();
  if (!c.carnets[id]) c.carnets[id] = carnetVide();
  return c.carnets[id];
}
function noterCarnet(id) {
  const c = carnet(id);
  c.majLe = Date.now();
  c.observePar = observateur();
  sauver();
}

function arreterAnimation() {
  clearInterval(animation.minuteur);
  animation.minuteur = null;
}

/* ---------- Piste : déplacer un artiste au doigt ---------- */
let glisse = null;
document.addEventListener('pointerdown', (e) => {
  const pion = e.target.closest?.('[data-pion]');
  if (!pion || animation.minuteur) return;
  const piste = pion.closest('#cq-piste');
  if (!piste) return;
  e.preventDefault();
  pion.setPointerCapture?.(e.pointerId);
  glisse = { pion, piste, id: pion.dataset.pion };
});
document.addEventListener('pointermove', (e) => {
  if (!glisse) return;
  const cadre = glisse.piste.getBoundingClientRect();
  const x = Math.max(6, Math.min(94, Math.round(((e.clientX - cadre.left) / cadre.width) * 100)));
  const y = Math.max(8, Math.min(88, Math.round(((e.clientY - cadre.top) / cadre.height) * 100)));
  tableau().positions[glisse.id] = { x, y };
  glisse.pion.style.left = `${x}%`;
  glisse.pion.style.top = `${y}%`;
  const fleches = document.querySelector('#cq-fleches-traits');
  if (fleches) fleches.innerHTML = traits(troupe(), etape(), tableauVu);
});
['pointerup', 'pointercancel'].forEach((type) =>
  document.addEventListener(type, () => {
    if (!glisse) return;
    glisse = null;
    noterTroupe();
  }),
);

/* ---------- Animation : les tableaux s'enchaînent ---------- */
function lancerAnimation() {
  const t = troupe();
  const e = etape();
  if (e.tableaux.length < 2) return notifier('Crée au moins 2 tableaux pour animer les déplacements.');
  tableauVu = 0;
  animation.rang = 0;
  rafraichir();
  document.querySelector('#cq-piste')?.classList.add('anime');
  animation.minuteur = setInterval(() => {
    const piste = document.querySelector('#cq-piste');
    if (!piste) return arreterAnimation();
    animation.rang = (animation.rang + 1) % e.tableaux.length;
    const tab = e.tableaux[animation.rang];
    t.membres.forEach((m) => {
      const pion = piste.querySelector(`[data-pion="${CSS.escape(m.id)}"]`);
      if (!pion) return;
      const pos = tab.positions[m.id];
      pion.hidden = tab.coulisses.includes(m.id) || !pos;
      if (pos) {
        pion.style.left = `${pos.x}%`;
        pion.style.top = `${pos.y}%`;
      }
    });
    document.querySelectorAll('[data-action="cq-tableau"]').forEach((b) => b.classList.toggle('actif', Number(b.dataset.rang) === animation.rang));
    const note = document.querySelector('#cq-note-anime');
    if (note) note.textContent = tab.note || '';
  }, 1800);
}

/* ---------- Actions ---------- */
const liste = (e, cle) => (e[cle] = e[cle] || []);
const basculer = (tableauValeurs, valeur) => {
  const rang = tableauValeurs.indexOf(valeur);
  if (rang >= 0) tableauValeurs.splice(rang, 1);
  else tableauValeurs.push(valeur);
};
const element = (famille, rang) => carnet(artisteVu)[famille][Number(rang)];

declarerActions({
  'cq-onglet': ({ onglet }) => {
    arreterAnimation();
    vue.ongletCirque = onglet;
    rafraichir();
  },
  'cq-troupe-choisir': (_, champ) => {
    arreterAnimation();
    cirque().troupeCourante = champ.value || null;
    etapeVue = 0;
    tableauVu = 0;
    artisteVu = null;
    sauver();
    rafraichir();
  },
  'cq-troupe-nouvelle': () => {
    const classe = document.querySelector('#cq-nouvelle-classe')?.value || '';
    const numero = cirque().troupes.filter((t) => t.classe === classe).length + 1;
    const t = nouvelleTroupe({ classe, nom: `Groupe ${numero}` });
    t.observePar = observateur();
    cirque().troupes.push(t);
    cirque().troupeCourante = t.id;
    classeAjout = classe;
    etapeVue = 0;
    tableauVu = 0;
    sauver();
    rafraichir();
  },
  'cq-troupe-nom': (_, champ) => {
    troupe().nom = champ.value.trim();
    noterTroupe();
  },
  'cq-titre': (_, champ) => {
    troupe().titre = champ.value.trim();
    noterTroupe();
  },
  'cq-troupe-suppr': async () => {
    const t = troupe();
    const ok = await demander({
      titre: `Supprimer « ${t.nom || 'cette troupe'} » ?`,
      texte: 'Le spectacle (étapes, tableaux) sera effacé de cette tablette. Les carnets d’artiste des élèves sont gardés.',
      confirmer: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    cirque().troupes = cirque().troupes.filter((x) => x.id !== t.id);
    cirque().troupeCourante = cirque().troupes[0]?.id || null;
    sauver();
    rafraichir();
  },
  'cq-classe-ajout': (_, champ) => {
    classeAjout = champ.value;
    rafraichir();
  },
  'cq-membre-eleve': ({ id }) => {
    const t = troupe();
    if (t.membres.some((m) => m.id === id)) retirerMembre(t, id);
    else {
      if (t.membres.length >= MAX_ARTISTES) return notifier(`${MAX_ARTISTES} artistes au maximum dans une troupe.`);
      const eleve = etat.eleves.find((e) => e.id === id);
      ajouterMembre(t, { id, nom: eleve.nom, eleveId: id });
    }
    noterTroupe();
    rafraichir();
  },
  'cq-membre-libre': () => {
    const champ = document.querySelector('#cq-nom-libre');
    const nom = champ.value.trim();
    if (!nom) return notifier("Écris le prénom de l'artiste.");
    const t = troupe();
    if (t.membres.length >= MAX_ARTISTES) return notifier(`${MAX_ARTISTES} artistes au maximum dans une troupe.`);
    ajouterMembre(t, { id: `libre-${Date.now().toString(36)}`, nom, eleveId: null });
    noterTroupe();
    rafraichir();
  },
  'cq-membre-retirer': ({ id }) => {
    retirerMembre(troupe(), id);
    noterTroupe();
    rafraichir();
  },
  'cq-etape': ({ rang }) => {
    arreterAnimation();
    etapeVue = Number(rang);
    tableauVu = 0;
    rafraichir();
  },
  'cq-choregraphe': ({ id }) => {
    basculer(etape().choregraphes, id);
    noterTroupe();
    rafraichir();
  },
  'cq-puce': ({ liste: cle, valeur }) => {
    basculer(liste(etape(), cle), valeur);
    noterTroupe();
    rafraichir();
  },
  'cq-puce-ajouter': ({ liste: cle }) => {
    const champ = document.querySelector(`#cq-perso-${cle}`);
    const valeur = champ?.value.trim();
    if (!valeur) return;
    const t = troupe();
    if (!liste(t.perso, cle).includes(valeur)) t.perso[cle].push(valeur);
    if (!liste(etape(), cle).includes(valeur)) etape()[cle].push(valeur);
    noterTroupe();
    rafraichir();
  },
  'cq-puce-retirer': ({ liste: cle, valeur }) => {
    const t = troupe();
    t.perso[cle] = liste(t.perso, cle).filter((v) => v !== valeur);
    t.etapes.forEach((e) => {
      e[cle] = liste(e, cle).filter((v) => v !== valeur);
    });
    noterTroupe();
    rafraichir();
  },
  'cq-tableau': ({ rang }) => {
    arreterAnimation();
    tableauVu = Number(rang);
    rafraichir();
  },
  'cq-tableau-ajouter': () => {
    arreterAnimation();
    const e = etape();
    if (e.tableaux.length >= MAX_TABLEAUX) return notifier(`${MAX_TABLEAUX} tableaux au maximum par étape.`);
    e.tableaux.push(tableauSuivant(e.tableaux[e.tableaux.length - 1]));
    tableauVu = e.tableaux.length - 1;
    noterTroupe();
    rafraichir();
  },
  'cq-tableau-suppr': () => {
    arreterAnimation();
    const e = etape();
    if (e.tableaux.length <= 1) return notifier('Il faut garder au moins un tableau.');
    e.tableaux.splice(tableauVu, 1);
    tableauVu = Math.min(tableauVu, e.tableaux.length - 1);
    noterTroupe();
    rafraichir();
  },
  'cq-tableau-note': (_, champ) => {
    tableau().note = champ.value;
    noterTroupe();
  },
  'cq-coulisses': ({ id }) => {
    basculer(tableau().coulisses, id);
    noterTroupe();
    rafraichir();
  },
  'cq-animer': () => {
    if (animation.minuteur) {
      arreterAnimation();
      rafraichir();
    } else {
      lancerAnimation();
    }
  },
  'cq-eval-etape': ({ niveau }) => {
    if (!estEnseignant()) return;
    etape().evaluation = etape().evaluation === niveau ? '' : niveau;
    noterTroupe();
    rafraichir();
  },
  'cq-conseil-etape': (_, champ) => {
    if (!estEnseignant()) return;
    etape().conseil = champ.value;
    noterTroupe();
  },
  'cq-artiste': ({ id }) => {
    artisteVu = id;
    rafraichir();
  },
  'cq-element-ajouter': ({ famille }) => {
    const c = carnet(artisteVu);
    const nouveau = elementVide(famille);
    nouveau.titre = `${FAMILLES_CIRQUE.find((f) => f.id === famille).nom} ${c[famille].length + 1}`;
    c[famille].push(nouveau);
    noterCarnet(artisteVu);
    rafraichir();
  },
  'cq-element-suppr': ({ famille, rang }) => {
    const c = carnet(artisteVu);
    if (c[famille].length <= 1) return;
    c[famille].splice(Number(rang), 1);
    noterCarnet(artisteVu);
    rafraichir();
  },
  'cq-element-titre': ({ famille, rang }, champ) => {
    element(famille, rang).titre = champ.value;
    noterCarnet(artisteVu);
  },
  'cq-element-desc': ({ famille, rang }, champ) => {
    element(famille, rang).desc = champ.value;
    noterCarnet(artisteVu);
  },
  'cq-critere': ({ famille, rang, valeur }) => {
    basculer(element(famille, rang).criteres, valeur);
    noterCarnet(artisteVu);
    rafraichir();
  },
  'cq-critere-ajouter': ({ famille, rang }) => {
    const champ = document.querySelector(`#cq-crit-${famille}-${rang}`);
    const valeur = champ?.value.trim();
    if (!valeur) return;
    const el = element(famille, rang);
    el.perso = el.perso || [];
    if (!el.perso.includes(valeur)) el.perso.push(valeur);
    if (!el.criteres.includes(valeur)) el.criteres.push(valeur);
    noterCarnet(artisteVu);
    rafraichir();
  },
  'cq-critere-retirer': ({ famille, rang, valeur }) => {
    const el = element(famille, rang);
    el.perso = (el.perso || []).filter((v) => v !== valeur);
    el.criteres = el.criteres.filter((v) => v !== valeur);
    noterCarnet(artisteVu);
    rafraichir();
  },
  'cq-acro-niveau': ({ rang, niveau }) => {
    const el = element('acrobatie', rang);
    el.niveau = el.niveau === Number(niveau) ? 0 : Number(niveau);
    noterCarnet(artisteVu);
    rafraichir();
  },
  'cq-eval-artiste': ({ niveau }) => {
    if (!estEnseignant()) return;
    const c = carnet(artisteVu);
    c.evaluation = c.evaluation === niveau ? '' : niveau;
    noterCarnet(artisteVu);
    rafraichir();
  },
  'cq-conseil-artiste': (_, champ) => {
    if (!estEnseignant()) return;
    carnet(artisteVu).conseil = champ.value;
    noterCarnet(artisteVu);
  },
  'cq-imprimer': () => window.print(),
  /* Tout est déjà enregistré à chaque geste ; ce bouton le confirme au groupe avant de rendre la tablette. */
  'cq-sauvegarder': () => {
    const t = troupe();
    if (!t) return;
    noterTroupe(t);
    rafraichir();
    notifier(`Projet « ${t.titre || t.nom} » sauvegardé sur cette tablette ✔`);
  },
});

/* Bandeau de la troupe ouverte : on la reconnaît et on sauvegarde depuis chaque onglet. */
function bandeauTroupe(t) {
  const heure = t.majLe ? new Date(t.majLe).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="carte cq-bandeau"><div><b>🎪 ${esc([t.classe, t.nom].filter(Boolean).join(' · '))}</b>${t.titre ? ` <span>« ${esc(t.titre)} »</span>` : ''}
      <small>${heure ? `Dernier enregistrement : ${heure}` : ''}</small></div>
    <button class="btn" data-action="cq-sauvegarder">💾 Sauvegarder le projet</button></div>`;
}

/* ---------- Affichage commun ---------- */
const badgeNiveau = (n) => (n ? `<span class="cq-niveau n${n}">Niveau ${n}</span>` : '<span class="cq-niveau">Non défini</span>');
const pastille = (t, id) => `<span class="cq-pastille" style="background:${couleur(t, id)}"></span>`;

function blocEvaluation(niveau, conseil, actionNiveau, actionConseil, cible) {
  if (!estEnseignant()) {
    return `<div class="cq-evaluation lecture"><b>🎯 Évaluation de l'enseignant</b>
      <p>${niveau ? EVALUATIONS[niveau] : 'Pas encore évalué'}${cible ? ` · ${cible}` : ''}</p>
      ${conseil ? `<p class="cq-conseil">💬 « ${esc(conseil)} »</p>` : ''}</div>`;
  }
  return `<div class="cq-evaluation"><b>🎯 Évaluation et conseils${cible ? ` · ${cible}` : ''}</b>
    <div class="cq-eval-boutons">${Object.entries(EVALUATIONS)
      .map(([n, libelle]) => `<button class="cq-eval e${n} ${niveau === n ? 'actif' : ''}" aria-pressed="${niveau === n}" data-action="${actionNiveau}" data-niveau="${n}">${libelle}</button>`)
      .join('')}</div>
    <textarea rows="2" placeholder="Conseils personnalisés…" data-saisie="${actionConseil}">${esc(conseil || '')}</textarea></div>`;
}

const sansTroupe = () => `<div class="carte centre"><p class="aide">Choisis ou crée d'abord une troupe (onglet Troupe).</p>
  <button class="btn" data-action="cq-onglet" data-onglet="troupe">👥 Troupe</button></div>`;

/* ---------- Onglet Troupe ---------- */
function vueTroupe() {
  const c = cirque();
  const t = troupe();
  const classes = [...new Set(etat.eleves.map((e) => e.classe))].sort();
  const choix = `<div class="rangee">
      <select data-choix="cq-troupe-choisir" aria-label="Troupe">
        <option value="">Choisis une troupe…</option>
        ${c.troupes.map((x) => `<option value="${esc(x.id)}" ${t && x.id === t.id ? 'selected' : ''}>${esc([x.classe, x.nom, x.titre && `« ${x.titre} »`].filter(Boolean).join(' · '))}</option>`).join('')}
      </select>
    </div>
    <div class="rangee">
      ${classes.length ? `<select id="cq-nouvelle-classe" aria-label="Classe de la nouvelle troupe">${classes.map((x) => `<option ${x === (t?.classe || classeAjout) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
      <button class="btn" data-action="cq-troupe-nouvelle">＋ Nouvelle troupe</button>
    </div>`;
  if (!t) {
    return `<div class="carte"><h2 class="carte-titre">🎪 Les troupes</h2>
      <p class="aide">Une troupe, c'est un groupe de 10 artistes au plus qui prépare un spectacle.</p>${choix}</div>`;
  }
  const classe = classeAjout || t.classe;
  const eleves = etat.eleves.filter((e) => e.classe === classe).sort((a, b) => a.nom.localeCompare(b.nom));
  const membres = t.membres
    .map(
      (m) => `<span class="cq-membre">${pastille(t, m.id)}${esc(m.nom)}${m.eleveId ? '' : ' <small>(nom libre)</small>'}
        <button class="btn-rond supprimer" aria-label="Retirer ${esc(m.nom)}" data-action="cq-membre-retirer" data-id="${esc(m.id)}">✕</button></span>`,
    )
    .join('');
  return `<div class="carte"><h2 class="carte-titre">🎪 Les troupes</h2>${choix}</div>
    <div class="carte"><h2 class="carte-titre">👥 Les artistes de la troupe <small>${t.membres.length} / ${MAX_ARTISTES}</small></h2>
      <div class="grille-parametres">
        <label>Nom de la troupe<input value="${esc(t.nom)}" data-saisie="cq-troupe-nom" autocomplete="off"></label>
        <label>Titre du spectacle (facultatif)<input value="${esc(t.titre)}" placeholder="ex. Le cirque sous l'orage" data-saisie="cq-titre" autocomplete="off"></label>
      </div>
      <div class="cq-membres">${membres || '<p class="aide">Aucun artiste pour l’instant.</p>'}</div>
      ${
        classes.length
          ? `<h4>Ajouter des élèves de la liste</h4>
        <select data-choix="cq-classe-ajout" aria-label="Classe">${classes.map((x) => `<option ${x === classe ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <div class="choix-sports cq-eleves">${eleves
          .map((e) => {
            const dedans = t.membres.some((m) => m.id === e.id);
            return `<button class="choix-sport ${dedans ? 'actif' : ''}" aria-pressed="${dedans}" data-action="cq-membre-eleve" data-id="${esc(e.id)}">${dedans ? '✓ ' : ''}${esc(e.nom)}</button>`;
          })
          .join('')}</div>`
          : ''
      }
      <div class="rangee marge-haut">
        <input id="cq-nom-libre" class="etire" placeholder="Prénom d'un artiste hors liste" autocomplete="off">
        <button class="btn secondaire" data-action="cq-membre-libre">＋ Ajouter</button>
      </div>
      <p class="aide">Un élève de la liste garde son carnet d'artiste dans sa Progression. Un nom libre ne va dans aucun dossier.</p>
      <button class="btn secondaire marge-haut" data-action="cq-troupe-suppr">🗑 Supprimer cette troupe</button>
    </div>`;
}

/* ---------- Onglet Chorégraphe ---------- */
function puces(e, cle, titre) {
  const t = troupe();
  const choisis = liste(e, cle);
  const base = listeCirque(etat.reglages, cle);
  const perso = liste(t.perso, cle).filter((v) => !base.includes(v));
  const puce = (valeur, retirable) => {
    const actif = choisis.includes(valeur);
    return `<span class="cq-puce-groupe"><button class="cq-puce ${actif ? 'actif' : ''}" aria-pressed="${actif}" data-action="cq-puce" data-liste="${cle}" data-valeur="${esc(valeur)}">${retirable ? '✨ ' : ''}${esc(valeur)}</button>${
      retirable ? `<button class="cq-puce-x" aria-label="Retirer ${esc(valeur)}" data-action="cq-puce-retirer" data-liste="${cle}" data-valeur="${esc(valeur)}">×</button>` : ''
    }</span>`;
  };
  return `<h4>${titre}</h4>
    <div class="cq-puces">${base.map((v) => puce(v, false)).join('')}${perso.map((v) => puce(v, true)).join('')}</div>
    <div class="rangee sans-marge"><input id="cq-perso-${cle}" class="etire" placeholder="Ajouter…" autocomplete="off">
      <button class="btn secondaire" data-action="cq-puce-ajouter" data-liste="${cle}">＋</button></div>`;
}

const traitLigne = (a, b, coul) =>
  `<line x1="${a.x}%" y1="${a.y}%" x2="${b.x}%" y2="${b.y}%" stroke="${coul}" stroke-width="3" stroke-dasharray="5 5" marker-end="url(#cq-pointe)"/>`;

/* Flèches du tableau précédent vers le tableau affiché. */
function traits(t, e, rang) {
  if (!rang) return '';
  const avant = e.tableaux[rang - 1];
  const maintenant = e.tableaux[rang];
  return t.membres
    .filter((m) => !avant.coulisses.includes(m.id) && !maintenant.coulisses.includes(m.id) && avant.positions[m.id] && maintenant.positions[m.id])
    .map((m) => traitLigne(avant.positions[m.id], maintenant.positions[m.id], couleur(t, m.id)))
    .join('');
}

function piste(t, e) {
  const rang = Math.min(tableauVu, e.tableaux.length - 1);
  const tab = e.tableaux[rang];
  const avant = rang ? e.tableaux[rang - 1] : null;
  const fantomes = avant
    ? t.membres
        .filter((m) => !avant.coulisses.includes(m.id) && avant.positions[m.id] && !tab.coulisses.includes(m.id))
        .map((m) => {
          const p = avant.positions[m.id];
          return `<div class="cq-fantome" style="left:${p.x}%;top:${p.y}%;background:${couleur(t, m.id)}">${esc(m.nom.slice(0, 3))}</div>`;
        })
        .join('')
    : '';
  const pions = t.membres
    .map((m) => {
      const p = tab.positions[m.id] || { x: 50, y: 50 };
      const choreo = e.choregraphes.includes(m.id);
      return `<div class="cq-pion ${choreo ? 'choreo' : ''}" data-pion="${esc(m.id)}" ${tab.coulisses.includes(m.id) ? 'hidden' : ''}
        style="left:${p.x}%;top:${p.y}%;background:${couleur(t, m.id)}" aria-label="${esc(m.nom)}">${esc(m.nom.slice(0, 5))}${choreo ? '<i>👑</i>' : ''}</div>`;
    })
    .join('');
  return `<div class="cq-piste" id="cq-piste">
      <div class="cq-fond">▲ FOND DE SCÈNE ▲</div>
      <div class="cq-coulisse gauche">COULISSES</div><div class="cq-coulisse droite">COULISSES</div>
      <svg class="cq-fleches" aria-hidden="true"><defs><marker id="cq-pointe" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#b45309"/></marker></defs>
        <g id="cq-fleches-traits">${traits(t, e, rang)}</g></svg>
      <div class="cq-fantomes">${fantomes}</div>
      ${pions}
      <p id="cq-note-anime" class="cq-note-anime"></p>
      <div class="cq-public">▼ LE PUBLIC EST ICI (FACE) ▼</div>
    </div>`;
}

function vueChoregraphe() {
  const t = troupe();
  if (!t) return sansTroupe();
  if (!t.membres.length) return `<div class="carte centre"><p class="aide">Ajoute d'abord les artistes de la troupe.</p></div>`;
  const e = etape();
  const rang = Math.min(tableauVu, e.tableaux.length - 1);
  const tab = e.tableaux[rang];
  const enAnimation = !!animation.minuteur;
  return `<div class="choix-sports cq-etapes" role="tablist">${ETAPES.map(
    (x, i) => `<button role="tab" class="choix-sport ${i === etapeVue ? 'actif' : ''}" aria-selected="${i === etapeVue}" data-action="cq-etape" data-rang="${i}">${x.titre}</button>`,
  ).join('')}</div>
    <div class="carte"><h2 class="carte-titre">${ETAPES[etapeVue].titre} <small>${ETAPES[etapeVue].aide}</small></h2>
      <h4>👑 Chorégraphe(s) de cette étape</h4>
      <div class="cq-puces">${t.membres
        .map((m) => {
          const actif = e.choregraphes.includes(m.id);
          return `<button class="cq-puce ${actif ? 'actif choreo' : ''}" aria-pressed="${actif}" data-action="cq-choregraphe" data-id="${esc(m.id)}">${actif ? '👑' : '👤'} ${esc(m.nom)}</button>`;
        })
        .join('')}</div>
      ${puces(e, 'emotions', '🎭 Émotion à faire ressentir au public')}
    </div>
    <div class="carte"><h2 class="carte-titre">📍 Placements et déplacements sur la piste</h2>
      <div class="rangee cq-tableaux">
        ${e.tableaux.map((_, i) => `<button class="cq-puce ${i === rang ? 'actif' : ''}" data-action="cq-tableau" data-rang="${i}">Tableau ${i + 1}</button>`).join('')}
        <button class="btn-mini" data-action="cq-tableau-ajouter">＋ Tableau</button>
        <button class="btn-mini" data-action="cq-tableau-suppr" aria-label="Supprimer ce tableau">🗑</button>
        <button class="btn cq-animer ${enAnimation ? 'danger' : ''}" data-action="cq-animer">${enAnimation ? '⏹ Arrêter' : '▶ Animer'}</button>
      </div>
      <input value="${esc(tab.note)}" placeholder="Action de ce tableau (ex. entrée en roulade, pyramide à 3, saut groupé…)" data-saisie="cq-tableau-note" autocomplete="off" ${enAnimation ? 'disabled' : ''}>
      ${piste(t, e)}
      <p class="aide">Fais glisser les artistes sur la piste. Les pointillés partent de leur place au tableau précédent.</p>
      <h4>🚪 Présence sur scène <small class="aide">(touche pour envoyer en coulisses ou faire entrer)</small></h4>
      <div class="cq-puces">${t.membres
        .map((m) => {
          const coulisse = tab.coulisses.includes(m.id);
          return `<button class="cq-puce ${coulisse ? 'coulisse' : 'actif'}" data-action="cq-coulisses" data-id="${esc(m.id)}">${coulisse ? '🚪' : '🎪'} ${esc(m.nom)} <small>${coulisse ? '(coulisses)' : '(en scène)'}</small></button>`;
        })
        .join('')}</div>
    </div>
    <div class="carte">
      ${puces(e, 'espace', "📐 Utilisation de l'espace")}
      ${puces(e, 'temps', '⏱️ Utilisation du temps')}
      ${blocEvaluation(e.evaluation, e.conseil, 'cq-eval-etape', 'cq-conseil-etape', e.choregraphes.length ? `👑 ${e.choregraphes.map((id) => esc(nomMembre(t, id))).join(', ')}` : 'aucun chorégraphe')}
    </div>`;
}

/* ---------- Onglet Artiste ---------- */
function carteElement(famille, el, rang, total) {
  const reperes = `data-famille="${famille}" data-rang="${rang}"`;
  const supprimer = total > 1 ? `<button class="btn-rond supprimer" aria-label="Supprimer cet élément" data-action="cq-element-suppr" ${reperes}>✕</button>` : '';
  const titre = `<input class="cq-element-titre" value="${esc(el.titre)}" aria-label="Objet ou figure" data-saisie="cq-element-titre" ${reperes} autocomplete="off">`;
  if (famille === 'acrobatie') {
    return `<div class="cq-element"><div class="cq-element-haut">${titre}
        <div class="cq-acro">${[1, 2, 3]
          .map((n) => `<button class="cq-niveau-bouton n${n} ${el.niveau === n ? 'actif' : ''}" aria-pressed="${el.niveau === n}" data-action="cq-acro-niveau" data-rang="${rang}" data-niveau="${n}">Niveau ${n}</button>`)
          .join('')}${supprimer}</div></div>
      <p class="aide">Reporte le niveau et la figure choisis sur ta fiche d'acrobatie.</p>
      <input value="${esc(el.desc)}" placeholder="Description de la figure (ex. roulade avant arrivée debout sans les mains)" data-saisie="cq-element-desc" ${reperes} autocomplete="off"></div>`;
  }
  const base = listeCirque(etat.reglages, famille);
  const perso = (el.perso || []).filter((v) => !base.includes(v));
  const autres = el.criteres.filter((v) => !base.includes(v) && !perso.includes(v));
  const puce = (valeur, retirable) => {
    const actif = el.criteres.includes(valeur);
    return `<span class="cq-puce-groupe"><button class="cq-puce ${actif ? 'actif' : ''}" aria-pressed="${actif}" data-action="cq-critere" ${reperes} data-valeur="${esc(valeur)}">${actif ? '✓' : '+'} ${esc(valeur)}</button>${
      retirable ? `<button class="cq-puce-x" aria-label="Retirer ${esc(valeur)}" data-action="cq-critere-retirer" ${reperes} data-valeur="${esc(valeur)}">×</button>` : ''
    }</span>`;
  };
  const niveau = niveauElement(famille, el);
  return `<div class="cq-element"><div class="cq-element-haut">${titre}${badgeNiveau(niveau)}${supprimer}</div>
    <p class="aide">Coche les difficultés combinées : 1 = niveau 1, 2 = niveau 2, 3 ou plus = niveau 3 (${el.criteres.length} cochée${el.criteres.length > 1 ? 's' : ''}).</p>
    <div class="cq-puces">${base.map((v) => puce(v, false)).join('')}${[...perso, ...autres].map((v) => puce(v, true)).join('')}</div>
    <div class="rangee sans-marge"><input id="cq-crit-${famille}-${rang}" class="etire" placeholder="Autre difficulté (ex. yeux fermés, en musique…)" autocomplete="off">
      <button class="btn secondaire" data-action="cq-critere-ajouter" ${reperes}>＋</button></div>
    <input value="${esc(el.desc)}" placeholder="Critère de réussite personnel (ex. 6 lancers de suite sans faire tomber)" data-saisie="cq-element-desc" ${reperes} autocomplete="off"></div>`;
}

function vueArtiste() {
  const t = troupe();
  if (!t) return sansTroupe();
  if (!t.membres.length) return `<div class="carte centre"><p class="aide">Ajoute d'abord les artistes de la troupe.</p></div>`;
  /* Un élève identifié ouvre son propre carnet ; il peut aussi remplir celui d'un camarade. */
  const moi = eleveConnecte();
  if (!t.membres.some((m) => m.id === artisteVu)) artisteVu = t.membres.some((m) => m.id === moi?.id) ? moi.id : t.membres[0].id;
  const membre = t.membres.find((m) => m.id === artisteVu);
  const c = carnet(artisteVu);
  return `<div class="carte"><h2 class="carte-titre">🤸 Carnet d'artiste</h2>
      <div class="choix-sports">${t.membres
        .map((m) => `<button class="choix-sport ${m.id === artisteVu ? 'actif' : ''}" aria-pressed="${m.id === artisteVu}" data-action="cq-artiste" data-id="${esc(m.id)}">${pastille(t, m.id)}${esc(m.nom)}</button>`)
        .join('')}</div>
      <p class="aide">${membre.eleveId ? `Ce carnet va dans la Progression de ${esc(membre.nom)}.` : 'Nom libre : ce carnet reste dans la troupe.'}</p>
    </div>
    ${FAMILLES_CIRQUE.map(
      (f) => `<div class="carte"><h2 class="carte-titre">${f.icone} ${f.nom} <small>${f.exemples}</small></h2>
        ${c[f.id].map((el, rang) => carteElement(f.id, el, rang, c[f.id].length)).join('')}
        <button class="btn secondaire" data-action="cq-element-ajouter" data-famille="${f.id}">＋ Ajouter un élément</button></div>`,
    ).join('')}
    <div class="carte">${blocEvaluation(c.evaluation, c.conseil, 'cq-eval-artiste', 'cq-conseil-artiste', `🤸 ${esc(membre.nom)}`)}</div>`;
}

/* ---------- Onglet Bilan ---------- */
export function resumeCarnet(c) {
  return FAMILLES_CIRQUE.map((f) => {
    const lignes = (c?.[f.id] || [])
      .filter((el) => niveauElement(f.id, el) || el.desc)
      .map((el) => {
        const detail = f.id === 'acrobatie' ? '' : el.criteres.length ? ` <small>[${el.criteres.map(esc).join(' + ')}]</small>` : '';
        return `<li>${f.icone} <b>${esc(el.titre)}</b> ${badgeNiveau(niveauElement(f.id, el))}${detail}${el.desc ? ` — <em>${esc(el.desc)}</em>` : ''}</li>`;
      })
      .join('');
    return lignes;
  }).join('');
}

function miniPiste(t, e) {
  const dernier = e.tableaux[e.tableaux.length - 1];
  const premier = e.tableaux[0];
  const lignes =
    e.tableaux.length > 1
      ? t.membres
          .filter((m) => premier.positions[m.id] && dernier.positions[m.id] && !dernier.coulisses.includes(m.id))
          .map((m) => `<line x1="${premier.positions[m.id].x}%" y1="${premier.positions[m.id].y}%" x2="${dernier.positions[m.id].x}%" y2="${dernier.positions[m.id].y}%" stroke="${couleur(t, m.id)}" stroke-width="2" stroke-dasharray="3 3"/>`)
          .join('')
      : '';
  const points = t.membres
    .filter((m) => dernier.positions[m.id] && !dernier.coulisses.includes(m.id))
    .map((m) => `<span class="cq-mini-pion" style="left:${dernier.positions[m.id].x}%;top:${dernier.positions[m.id].y}%;background:${couleur(t, m.id)}">${esc(m.nom.slice(0, 2))}</span>`)
    .join('');
  return `<div class="cq-mini-piste"><svg aria-hidden="true">${lignes}</svg>${points}</div>`;
}

function vueBilanCirque() {
  const t = troupe();
  if (!t) return sansTroupe();
  const c = cirque();
  const profils = t.membres
    .map((m) => {
      const carnetM = c.carnets[m.id];
      const resume = resumeCarnet(carnetM);
      return `<div class="cq-profil"><div class="cq-profil-haut">${pastille(t, m.id)}<b>${esc(m.nom)}</b>
          <span class="cq-eval-texte">${carnetM?.evaluation ? EVALUATIONS[carnetM.evaluation] : 'Non évalué'}</span></div>
        ${resume ? `<ul>${resume}</ul>` : '<p class="aide">Carnet vide.</p>'}
        ${carnetM?.conseil ? `<p class="cq-conseil">💬 « ${esc(carnetM.conseil)} »</p>` : ''}</div>`;
    })
    .join('');
  const etapes = t.etapes
    .map(
      (e, i) => `<div class="cq-etape-bilan"><div class="cq-etape-titre"><b>${ETAPES[i].titre}</b>
          <small>${e.choregraphes.length ? `👑 ${e.choregraphes.map((id) => esc(nomMembre(t, id))).join(', ')}` : 'Aucun chorégraphe'}</small></div>
        <p><b>🎭</b> ${e.emotions.map(esc).join(', ') || '–'} · <b>📐</b> ${e.espace.map(esc).join(', ') || '–'} · <b>⏱️</b> ${e.temps.map(esc).join(', ') || '–'}</p>
        ${miniPiste(t, e)}
        <p class="cq-eval-texte">👑 ${e.evaluation ? EVALUATIONS[e.evaluation] : 'Non évalué'}</p>
        ${e.conseil ? `<p class="cq-conseil">💬 « ${esc(e.conseil)} »</p>` : ''}</div>`,
    )
    .join('');
  return `<div class="carte"><h2 class="carte-titre">📋 ${esc(t.titre ? `« ${t.titre} »` : 'Le spectacle')} <small>${esc([t.classe, t.nom].filter(Boolean).join(' · '))}</small></h2>
      <h4>🤸 Les artistes</h4><div class="cq-profils">${profils || '<p class="aide">Aucun artiste.</p>'}</div>
      <h4>🎬 Les 5 étapes</h4><div class="cq-etapes-bilan">${etapes}</div>
    </div>
    <div class="rangee non-imprime"><button class="btn" data-action="cq-imprimer">🖨️ Imprimer la fiche spectacle</button></div>`;
}

export function vueCirque() {
  const onglet = vue.ongletCirque || 'troupe';
  const t = troupe();
  const haut = t ? bandeauTroupe(t) : '';
  if (onglet === 'choregraphe') return haut + vueChoregraphe();
  if (onglet === 'artiste') return haut + vueArtiste();
  if (onglet === 'bilan') return haut + vueBilanCirque();
  return `${haut}${vueTroupe()}
    <p class="aide centre">Le projet reste sur cette tablette : à la prochaine séance, le groupe choisit sa troupe dans la liste et reprend là où il s'était arrêté.</p>`;
}
