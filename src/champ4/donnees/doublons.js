/*
 * Un même élève (même prénom + initiale, même classe) peut porter deux identifiants :
 * par exemple une tablette a une ancienne liste, l'autre une liste réimportée.
 * Ces fonctions le reconnaissent par son nom et sa classe, et rattachent toutes
 * ses données (équipes, matchs, courses, tests, temps, codes) à un seul identifiant.
 * Dans une liste, deux homonymes d'une classe s'appellent déjà « Léa M. » et « Léa M. (2) ».
 */

const cleNom = (eleve) => `${String(eleve.nom).trim().toLowerCase()}|${String(eleve.classe).trim().toLowerCase()}`;

/* Remplace partout les anciens identifiants par les nouveaux (valeurs et clés d'objets). */
export function remplacerIds(valeur, table) {
  if (typeof valeur === 'string') return table.get(valeur) ?? valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => remplacerIds(v, table));
  if (valeur && typeof valeur === 'object') {
    const resultat = {};
    Object.entries(valeur).forEach(([cle, v]) => {
      resultat[table.get(cle) ?? cle] = remplacerIds(v, table);
    });
    return resultat;
  }
  return valeur;
}

/* Après un regroupement, retire les répétitions (équipes, fiches de coureurs, sélection). */
function nettoyer(etat) {
  etat.equipes.forEach((t) => {
    if (Array.isArray(t.membres)) t.membres = [...new Set(t.membres)];
  });
  if (Array.isArray(etat.coureurs)) {
    const fiches = new Map();
    etat.coureurs.forEach((c) => {
      const deja = fiches.get(c.id);
      if (!deja) fiches.set(c.id, c);
      else if (deja.vma == null && c.vma != null) deja.vma = c.vma;
    });
    etat.coureurs = [...fiches.values()];
  }
  if (Array.isArray(etat.prepCourse?.selection)) etat.prepCourse.selection = [...new Set(etat.prepCourse.selection)];
}

function appliquer(etat, table) {
  if (!table.size) return;
  /* Un code déjà donné suit l'élève, sauf si l'identifiant gardé a déjà le sien. */
  table.forEach((nouveau, ancien) => {
    if (!etat.codesEleves) return;
    if (etat.codesEleves[ancien] && !etat.codesEleves[nouveau]) etat.codesEleves[nouveau] = etat.codesEleves[ancien];
    delete etat.codesEleves[ancien];
  });
  const { eleves, codesEleves, ...reste } = etat;
  Object.assign(etat, remplacerIds(reste, table));
  nettoyer(etat);
}

/* Regroupe les élèves en double dans cet état. Garde celui qui a un code. Renvoie le nombre de doublons. */
export function reparerDoublons(etat) {
  const valeur = (e) => (etat.codesEleves?.[e.id] ? 2 : e.cle ? 1 : 0);
  const gardes = new Map();
  const table = new Map();
  (etat.eleves || []).forEach((eleve) => {
    const cle = cleNom(eleve);
    const deja = gardes.get(cle);
    if (!deja) {
      gardes.set(cle, eleve);
      return;
    }
    const garde = valeur(eleve) > valeur(deja) ? eleve : deja;
    const autre = garde === eleve ? deja : eleve;
    if (!garde.cle && autre.cle && !etat.codesEleves?.[garde.id]) garde.cle = autre.cle;
    table.set(autre.id, garde.id);
    gardes.set(cle, garde);
  });
  if (!table.size) return 0;
  /* Si A → B puis B → C, A va directement à C. */
  table.forEach((vers, de) => {
    let fin = vers;
    while (table.has(fin)) fin = table.get(fin);
    table.set(de, fin);
  });
  etat.eleves = etat.eleves.filter((e) => !table.has(e.id));
  appliquer(etat, table);
  return table.size;
}

/* Résultats reçus d'une autre tablette : leurs élèves prennent l'identifiant de cette tablette. */
export function alignerPaquet(etat, paquet) {
  const ici = new Map(etat.eleves.map((e) => [cleNom(e), e.id]));
  const ids = new Set(etat.eleves.map((e) => e.id));
  const table = new Map();
  (paquet.eleves || []).forEach((e) => {
    const local = ici.get(cleNom(e));
    if (!ids.has(e.id) && local) table.set(e.id, local);
  });
  return table.size ? remplacerIds(paquet, table) : paquet;
}

/* Nouvelle liste importée (elle fait foi) : les données déjà notées suivent les nouveaux identifiants.
   Les élèves absents de la nouvelle liste sont gardés, pour ne rien perdre. */
export function remplacerListe(etat, nouvelle) {
  const nouveaux = new Map(nouvelle.map((e) => [cleNom(e), e.id]));
  const ids = new Set(nouvelle.map((e) => e.id));
  const table = new Map();
  etat.eleves.forEach((e) => {
    const id = nouveaux.get(cleNom(e));
    if (id && id !== e.id) table.set(e.id, id);
  });
  const gardes = etat.eleves.filter((e) => !ids.has(e.id) && !nouveaux.has(cleNom(e)));
  etat.eleves = [...nouvelle, ...gardes];
  appliquer(etat, table);
}
