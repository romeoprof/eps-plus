/*
 * Arts du cirque : données et calculs (sans affichage), vérifiés par les tests.
 *
 * etat.cirque = {
 *   troupes: [{ id, classe, nom, titre, membres: [{ id, nom, eleveId }], perso: { emotions, espace, temps },
 *               etapes: [{ choregraphes, emotions, espace, temps, evaluation, conseil,
 *                          tableaux: [{ note, positions: { idMembre: { x, y } }, coulisses: [idMembre] }] }],
 *               majLe, observePar }],
 *   carnets: { idMembre: { manipulation: [{ titre, criteres, perso, desc }], equilibre: [...],
 *                          acrobatie: [{ titre, niveau, desc }], evaluation, conseil, majLe, observePar } },
 *   troupeCourante,
 * }
 * Un membre de la liste d'élèves a pour identifiant celui de l'élève : son carnet va dans sa Progression.
 */
import { ETAPES, FAMILLES_CIRQUE, REGLAGES_CIRQUE } from './contenu.js';

export const cirqueVide = () => ({ troupes: [], carnets: {}, troupeCourante: null });

/* Niveau par cumul : 1 difficulté = niveau 1, 2 = niveau 2, 3 ou plus = niveau 3. */
export const niveauCumul = (nombre) => Math.max(0, Math.min(3, nombre));

export const niveauElement = (famille, element) =>
  famille === 'acrobatie' ? Number(element.niveau) || 0 : niveauCumul((element.criteres || []).length);

export const meilleurNiveau = (carnet, famille) =>
  Math.max(0, ...((carnet?.[famille] || []).map((e) => niveauElement(famille, e))));

export function elementVide(famille) {
  const modele = FAMILLES_CIRQUE.find((f) => f.id === famille);
  return famille === 'acrobatie' ? { titre: modele.objet, niveau: 0, desc: '' } : { titre: modele.objet, criteres: [], perso: [], desc: '' };
}

export const carnetVide = () => ({
  manipulation: [elementVide('manipulation')],
  equilibre: [elementVide('equilibre')],
  acrobatie: [elementVide('acrobatie')],
  evaluation: '',
  conseil: '',
  majLe: 0,
  observePar: null,
});

/* Un carnet est « rempli » dès qu'une difficulté, un niveau, une évaluation ou un conseil y figure. */
export const carnetRempli = (carnet) =>
  !!carnet &&
  (!!carnet.evaluation ||
    !!carnet.conseil ||
    FAMILLES_CIRQUE.some(({ id }) => (carnet[id] || []).some((e) => niveauElement(id, e) > 0 || e.desc)));

/* Placement de départ : les artistes en deux rangées face au public. */
export function positionsDepart(membres) {
  const positions = {};
  membres.forEach((m, i) => {
    positions[m.id] = { x: Math.round(15 + (i % 5) * 17.5), y: Math.round(30 + Math.floor(i / 5) * 30) };
  });
  return positions;
}

export const tableauVide = (membres) => ({ note: '', positions: positionsDepart(membres), coulisses: [] });

/* Un nouveau tableau part des placements du précédent. */
export const tableauSuivant = (precedent) => ({
  note: '',
  positions: JSON.parse(JSON.stringify(precedent.positions || {})),
  coulisses: [...(precedent.coulisses || [])],
});

export function nouvelleTroupe({ classe = '', nom = '' }, maintenant = Date.now()) {
  return {
    id: `tr${maintenant.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    classe,
    nom,
    titre: '',
    membres: [],
    perso: { emotions: [], espace: [], temps: [] },
    etapes: ETAPES.map(() => ({ choregraphes: [], emotions: [], espace: [], temps: [], evaluation: '', conseil: '', tableaux: [tableauVide([])] })),
    majLe: maintenant,
    observePar: null,
  };
}

/* Un artiste ajouté reçoit une place libre dans chaque tableau ; un artiste retiré disparaît partout. */
export function ajouterMembre(troupe, membre) {
  if (troupe.membres.some((m) => m.id === membre.id)) return false;
  const rang = troupe.membres.length;
  troupe.membres.push(membre);
  troupe.etapes.forEach((etape) =>
    etape.tableaux.forEach((t) => {
      if (!t.positions[membre.id]) t.positions[membre.id] = { x: Math.round(15 + (rang % 5) * 17.5), y: Math.round(30 + Math.floor(rang / 5) * 30) };
    }),
  );
  return true;
}

export function retirerMembre(troupe, idMembre) {
  troupe.membres = troupe.membres.filter((m) => m.id !== idMembre);
  troupe.etapes.forEach((etape) => {
    etape.choregraphes = etape.choregraphes.filter((id) => id !== idMembre);
    etape.tableaux.forEach((t) => {
      delete t.positions[idMembre];
      t.coulisses = t.coulisses.filter((id) => id !== idMembre);
    });
  });
}

/* Listes réglées par l'enseignant, sinon celles d'origine. */
export const listeCirque = (reglages, cle) => {
  const liste = reglages?.cirque?.[cle];
  return Array.isArray(liste) && liste.length ? liste : REGLAGES_CIRQUE[cle];
};

/* Ce que la Progression montre d'un élève : son carnet d'artiste et les étapes qu'il a chorégraphiées. */
export function suiviCirque(etat, idEleve) {
  const cirque = etat.cirque || cirqueVide();
  const carnet = carnetRempli(cirque.carnets?.[idEleve]) ? cirque.carnets[idEleve] : null;
  const troupes = (cirque.troupes || [])
    .filter((t) => t.membres.some((m) => m.id === idEleve))
    .map((troupe) => ({
      troupe,
      etapes: troupe.etapes
        .map((etape, rang) => ({ rang, etape }))
        .filter(({ etape }) => etape.choregraphes.includes(idEleve)),
    }));
  if (!carnet && !troupes.some((t) => t.etapes.length)) return null;
  return { carnet, troupes };
}

export const elevesCirque = (etat) => {
  const ids = new Set(Object.keys(etat.cirque?.carnets || {}).filter((id) => carnetRempli(etat.cirque.carnets[id])));
  (etat.cirque?.troupes || []).forEach((t) => t.membres.forEach((m) => m.eleveId && ids.add(m.eleveId)));
  return ids;
};

/* Envoi vers une autre tablette : les troupes et les carnets remplis. */
export function paquetCirque(etat) {
  const cirque = etat.cirque || cirqueVide();
  const carnets = Object.fromEntries(Object.entries(cirque.carnets || {}).filter(([, c]) => carnetRempli(c)));
  return { troupes: cirque.troupes || [], carnets };
}

/* Réception : pour chaque troupe et chaque carnet, la version la plus récente l'emporte. */
export function fusionnerCirque(etat, recu, bilan) {
  if (!recu) return;
  etat.cirque = { ...cirqueVide(), ...(etat.cirque || {}) };
  (recu.troupes || []).forEach((troupe) => {
    const rang = etat.cirque.troupes.findIndex((t) => t.id === troupe.id);
    if (rang < 0) {
      etat.cirque.troupes.push(troupe);
      bilan.ajoutes += 1;
    } else if ((troupe.majLe || 0) > (etat.cirque.troupes[rang].majLe || 0)) {
      etat.cirque.troupes[rang] = troupe;
      bilan.misAJour += 1;
    } else {
      bilan.dejaPresents += 1;
    }
  });
  Object.entries(recu.carnets || {}).forEach(([id, carnet]) => {
    const local = etat.cirque.carnets[id];
    if (!local) {
      etat.cirque.carnets[id] = carnet;
      bilan.ajoutes += 1;
    } else if ((carnet.majLe || 0) > (local.majLe || 0)) {
      etat.cirque.carnets[id] = carnet;
      bilan.misAJour += 1;
    } else {
      bilan.dejaPresents += 1;
    }
  });
}
