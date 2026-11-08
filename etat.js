import { etatInitial } from '../champ4/donnees/modele.js';
import { lireSauvegarde } from '../champ4/donnees/migration.js';

const CLE = 'eps-app-v2';
const CLE_V3 = 'eps';

function charger() {
  const brut = localStorage.getItem(CLE);
  if (brut) {
    try {
      return lireSauvegarde(JSON.parse(brut));
    } catch {
      localStorage.setItem(`${CLE}-illisible`, brut); // on ne perd rien
    }
  }
  try {
    const ancien = localStorage.getItem(CLE_V3);
    if (ancien) return lireSauvegarde(JSON.parse(ancien));
  } catch {
    /* ancienne sauvegarde illisible : on repart de zéro, sans l'effacer */
  }
  return etatInitial();
}

function chargerSansErreur() {
  try {
    return charger();
  } catch {
    return etatInitial();
  }
}

export let etat = chargerSansErreur();
export let sauvegardeOk = true;

export function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
    sauvegardeOk = true;
  } catch {
    sauvegardeOk = false;
  }
}

export function remplacerEtat(nouveau) {
  etat = nouveau;
  sauver();
}
