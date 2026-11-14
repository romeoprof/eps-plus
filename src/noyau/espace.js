/*
 * Espaces de l'application : enseignant (code) ou élève (sans code).
 * Dans l'espace élève, un élève peut s'identifier avec son code à 4 chiffres :
 * il voit alors sa progression, et ses observations portent son nom (« observé par »).
 * Les codes lisibles ne restent que sur la tablette enseignant ; les autres tablettes
 * n'en reçoivent qu'une empreinte, dans la liste protégée par mot de passe.
 */
import { etat } from './etat.js';
import { vue } from './interface.js';
import { cleCode } from './cle-code.js';

export const estEnseignant = () => vue.espace === 'enseignant';
export const estEleve = () => vue.espace === 'eleve';

export const eleveConnecte = () =>
  estEleve() && etat.eleveConnecte ? etat.eleves.find((e) => e.id === etat.eleveConnecte) || null : null;

/* Auteur d'une observation : l'enseignant, l'élève identifié, ou personne (élève non identifié).
   La performance, elle, va toujours à l'élève observé. */
export function observateur() {
  if (estEnseignant()) return { id: 'enseignant', nom: 'Enseignant' };
  const eleve = eleveConnecte();
  return eleve ? { id: eleve.id, nom: eleve.nom } : null;
}

export { cleCode };
export const codeValide = (eleve, code) => !!eleve?.cle && /^\d{4}$/.test(code) && cleCode(eleve.id, code) === eleve.cle;

export function nouveauCode() {
  const hasard = new Uint32Array(1);
  crypto.getRandomValues(hasard);
  return String(hasard[0] % 10000).padStart(4, '0');
}

/* Chaque élève sans code en reçoit un. Renvoie le nombre de nouveaux codes. */
export function attribuerCodes(etatCible) {
  etatCible.codesEleves = etatCible.codesEleves || {};
  let nouveaux = 0;
  etatCible.eleves.forEach((eleve) => {
    if (!/^\d{4}$/.test(etatCible.codesEleves[eleve.id] || '')) {
      etatCible.codesEleves[eleve.id] = nouveauCode();
      nouveaux += 1;
    }
    const cle = cleCode(eleve.id, etatCible.codesEleves[eleve.id]);
    if (eleve.cle !== cle) eleve.cle = cle;
  });
  return nouveaux;
}

export function changerCode(etatCible, idEleve) {
  const eleve = etatCible.eleves.find((e) => e.id === idEleve);
  if (!eleve) return null;
  etatCible.codesEleves = etatCible.codesEleves || {};
  let code = nouveauCode();
  while (code === etatCible.codesEleves[idEleve]) code = nouveauCode();
  etatCible.codesEleves[idEleve] = code;
  eleve.cle = cleCode(idEleve, code);
  return code;
}
