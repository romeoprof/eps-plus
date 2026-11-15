/*
 * Ce qu'on supprime sur une tablette (une course, les bilans d'une APSA, une poule, une troupe)
 * disparaît de la tablette, mais reste sur le serveur : seul l'ordinateur serveur gère ses données.
 * La tablette garde la liste de ce qu'elle a supprimé, pour que la synchronisation ne le lui renvoie pas.
 */

export function masquer(etat, type, ids) {
  etat.masques = etat.masques || {};
  etat.masques[type] = [...new Set([...(etat.masques[type] || []), ...ids.filter(Boolean)])];
}

export const estMasque = (etat, type, id) => (etat.masques?.[type] || []).includes(id);

/* Retire d'un paquet reçu ce que cette tablette avait supprimé. */
export function sansMasques(etat, paquet) {
  if (!etat.masques) return paquet;
  const garder = (type) => (x) => !estMasque(etat, type, x.id);
  return {
    ...paquet,
    matchs: (paquet.matchs || []).filter(garder('matchs')),
    courses: (paquet.courses || []).filter(garder('courses')),
    testsVma: (paquet.testsVma || []).filter(garder('testsVma')),
    tempsPf: (paquet.tempsPf || []).filter((t) => !estMasque(etat, 'tempsPf', t.courseId)),
    cirque: paquet.cirque && { ...paquet.cirque, troupes: (paquet.cirque.troupes || []).filter(garder('troupes')) },
  };
}
