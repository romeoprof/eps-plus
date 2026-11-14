/* Carte « Serveur de l'établissement » : dans Échanger les données (élève et enseignant). */
import { etat, sauver } from '../noyau/etat.js';
import { attribuerCodes, estEnseignant } from '../noyau/espace.js';
import { declarerActions, notifier, rafraichir } from '../noyau/interface.js';
import { telecharger } from '../noyau/outils.js';
import { configurationActuelle } from '../champ4/donnees/export.js';
import { resumeResultats } from '../champ4/ecrans/recolte.js';
import { detecter, envoyerListe, envoyerResultats, publierConfiguration, recupererTout, resultatsEnAttente, serveur } from './serveur.js';

const heure = (t) => (t ? new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'jamais');

declarerActions({
  'srv-envoyer': async () => {
    await detecter();
    await envoyerResultats({ silencieux: false });
    rafraichir();
  },
  'srv-synchroniser': async () => {
    await detecter();
    if (!serveur.jeton) return notifier('Reconnecte-toi à l’espace enseignant pour synchroniser.');
    await recupererTout();
    rafraichir();
  },
  'srv-liste': async () => {
    if (!etat.eleves.length) return notifier("Importe d'abord une liste d'élèves.");
    attribuerCodes(etat);
    sauver();
    try {
      const r = await envoyerListe(etat.eleves);
      notifier(`Liste envoyée au serveur ✔ (${r.eleves} élèves, avec l'empreinte de leur code)`);
    } catch (e) {
      notifier(e.message);
    }
  },
  'srv-config': async () => {
    try {
      const r = await publierConfiguration(configurationActuelle(etat));
      etat.configVersion = r.version;
      sauver();
      notifier('Configuration publiée sur le serveur ✔ Les tablettes la prennent avec « Mise à jour ».');
    } catch (e) {
      notifier(e.message);
    }
  },
  'srv-sauvegarde': async () => {
    try {
      const reponse = await fetch('api/sauvegarde', { headers: { Authorization: `Bearer ${serveur.jeton}` }, cache: 'no-store' });
      if (!reponse.ok) throw new Error('Reconnecte-toi à l’espace enseignant.');
      telecharger(`sauvegarde-serveur-eps-${new Date().toISOString().slice(0, 10)}.json`, await reponse.text(), 'application/json');
    } catch (e) {
      notifier(e.message);
    }
  },
});

export function carteServeur() {
  if (!serveur.disponible) {
    return `<div class="carte carte-serveur hors-ligne"><h2 class="carte-titre">🖥️ Serveur de l'établissement</h2>
      <p><b>${serveur.verifie ? 'Serveur injoignable' : 'Recherche du serveur…'}</b></p>
      <p class="aide">Les résultats restent sur cette tablette et partiront seuls dès que le serveur sera joignable (Wi-Fi de l'établissement). Ouverte depuis internet, l'application n'a pas de serveur : utilise alors les QR codes ou les fichiers ci-dessous.</p>
      <button class="btn secondaire" data-action="srv-envoyer">🔄 Réessayer</button></div>`;
  }
  const attente = resultatsEnAttente();
  const etatEnvoi = attente
    ? `<p class="attente-envoi">⏳ Des résultats de cette tablette ne sont pas encore partis.</p>`
    : etat.synchro?.envoyeLe
      ? `<p class="enregistre">✔ Tout est envoyé au serveur (${heure(etat.synchro.envoyeLe)}).</p>`
      : `<p class="enregistre">✔ Rien à envoyer pour l'instant.</p>`;
  if (!estEnseignant()) {
    return `<div class="carte carte-serveur"><h2 class="carte-titre">🖥️ Serveur de l'établissement</h2>
      <p><b>${resumeResultats()}</b> sur cette tablette.</p>${etatEnvoi}
      <p class="aide">L'envoi est automatique, toutes les 20 secondes quand il y a du réseau. Pour voir tes résultats de toutes les tablettes : identifie-toi, puis Ma progression.</p>
      <button class="btn" data-action="srv-envoyer">📤 Envoyer maintenant</button></div>`;
  }
  return `<div class="carte carte-serveur"><h2 class="carte-titre">🖥️ Serveur de l'établissement</h2>
    ${etatEnvoi}
    <p class="aide">Dernière récupération des tablettes : ${heure(serveur.derniereReception)}. Les tablettes envoient leurs résultats seules ; « Synchroniser » ajoute ici tout ce que le serveur a reçu.</p>
    <div class="rangee">
      <button class="btn" data-action="srv-synchroniser">🔄 Synchroniser maintenant</button>
      <button class="btn secondaire" data-action="srv-liste">👥 Envoyer la liste d'élèves</button>
      <button class="btn secondaire" data-action="srv-config">⚙️ Publier la configuration</button>
      <button class="btn secondaire" data-action="srv-sauvegarde">💾 Sauvegarde du serveur</button>
    </div>
    <p class="aide">La liste envoyée contient le prénom, l'initiale, la classe et l'empreinte du code de chaque élève (jamais le code). Le serveur ne donne à un élève identifié que ses propres résultats.</p>
  </div>`;
}
