/*
 * Envoi des résultats par QR codes, sans réseau ni serveur.
 * Les résultats sont compressés, puis découpés en morceaux : la tablette élève
 * les affiche à tour de rôle, la tablette enseignant les lit à la caméra.
 * Morceau : « EPS+|identifiant|numéro|total|données ».
 * Plus tard, un serveur de l'établissement pourra remplacer ce transport.
 */

export const ENTETE = 'EPS+';
export const TAILLE_MORCEAU = 600; // caractères par QR code : lisible facilement à l'écran

const versBase64 = (octets) => {
  let texte = '';
  for (let i = 0; i < octets.length; i += 0x8000) texte += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(texte);
};
const depuisBase64 = (texte) => Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));

async function transformer(octets, Flux) {
  const flux = new Blob([octets]).stream().pipeThrough(new Flux('gzip'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

/* Objet → texte compact (« z » : compressé, « j » : JSON simple si la compression manque). */
export async function encoderPaquet(objet) {
  const octets = new TextEncoder().encode(JSON.stringify(objet));
  if (typeof CompressionStream === 'undefined') return `j${versBase64(octets)}`;
  return `z${versBase64(await transformer(octets, CompressionStream))}`;
}

export async function decoderPaquet(texte) {
  const octets = depuisBase64(texte.slice(1));
  const clair = texte[0] === 'z' ? await transformer(octets, DecompressionStream) : octets;
  return JSON.parse(new TextDecoder().decode(clair));
}

export function decouper(texte, id, taille = TAILLE_MORCEAU) {
  const total = Math.max(1, Math.ceil(texte.length / taille));
  return Array.from({ length: total }, (_, i) => `${ENTETE}|${id}|${i + 1}|${total}|${texte.slice(i * taille, (i + 1) * taille)}`);
}

export function lireMorceau(chaine) {
  const morceaux = String(chaine).split('|');
  if (morceaux.length < 5 || morceaux[0] !== ENTETE) return null;
  const [, id, numero, total] = morceaux;
  const rang = Number(numero);
  const nombre = Number(total);
  if (!id || !(rang >= 1 && nombre >= rang)) return null;
  return { id, rang, total: nombre, donnees: morceaux.slice(4).join('|') };
}

/* Réception : on range les morceaux par envoi ; complet quand tous les numéros sont là. */
export const nouvelleReception = () => ({ envois: new Map() });

export function recevoirMorceau(reception, chaine) {
  const morceau = lireMorceau(chaine);
  if (!morceau) return null;
  const envoi = reception.envois.get(morceau.id) || { id: morceau.id, total: morceau.total, parts: new Map() };
  envoi.parts.set(morceau.rang, morceau.donnees);
  reception.envois.set(morceau.id, envoi);
  return envoi;
}

export const envoiComplet = (envoi) => envoi.parts.size === envoi.total;
export const assembler = (envoi) => Array.from({ length: envoi.total }, (_, i) => envoi.parts.get(i + 1)).join('');

/* Bibliothèques de QR codes (rangées dans src/vendor), chargées seulement quand on en a besoin. */
const chargements = {};
export function chargerScript(chemin) {
  if (!chargements[chemin]) {
    chargements[chemin] = new Promise((resoudre, rejeter) => {
      const script = document.createElement('script');
      script.src = chemin;
      script.onload = resoudre;
      script.onerror = () => {
        delete chargements[chemin];
        rejeter(new Error(`Chargement impossible : ${chemin}`));
      };
      document.head.appendChild(script);
    });
  }
  return chargements[chemin];
}
