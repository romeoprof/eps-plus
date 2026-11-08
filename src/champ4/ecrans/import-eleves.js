/* Import de la liste d'élèves publiée sur le site, protégé par mot de passe. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, notifier, rafraichir } from '../../noyau/interface.js';
import { FICHIER_ELEVES, lireElevesProteges } from '../donnees/export.js';

async function importer() {
  const champ = document.querySelector('#mot-de-passe-eleves');
  if (!champ.value) return notifier('Saisis le mot de passe.');
  let paquet;
  try {
    const reponse = await fetch(FICHIER_ELEVES, { cache: 'no-store' });
    if (!reponse.ok) return notifier("Aucune liste d'élèves n'est publiée sur le site.");
    paquet = await reponse.json();
  } catch {
    return notifier('Liste inaccessible : vérifie la connexion internet.');
  }
  try {
    etat.eleves = await lireElevesProteges(paquet, champ.value);
  } catch {
    return notifier('Mot de passe incorrect.');
  }
  sauver();
  rafraichir();
  notifier(`${etat.eleves.length} élève${etat.eleves.length > 1 ? 's' : ''} importé${etat.eleves.length > 1 ? 's' : ''} ✔`);
}

declarerActions({ 'eleves-importer': importer });

export const blocImportEleves = () => `
  <div class="rangee">
    <input id="mot-de-passe-eleves" class="etire" type="password" autocomplete="off" placeholder="Mot de passe de la liste" aria-label="Mot de passe de la liste d'élèves">
    <button class="btn" data-action="eleves-importer">⬇ Importer les élèves</button>
  </div>`;
