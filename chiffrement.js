/*
 * Chiffrement d'un texte par mot de passe (AES-GCM, clé dérivée par PBKDF2).
 * Le fichier produit peut être public : il reste illisible sans le mot de passe,
 * qui n'est enregistré nulle part. La solidité dépend de la longueur du mot de passe.
 */
const ITERATIONS = 250000;

const versBase64 = (octets) => btoa(String.fromCharCode(...octets));
const depuisBase64 = (texte) => Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));

async function deriverCle(motDePasse, sel, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function chiffrer(texte, motDePasse) {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cle = await deriverCle(motDePasse, sel, ITERATIONS);
  const donnees = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, new TextEncoder().encode(texte));
  return {
    iterations: ITERATIONS,
    sel: versBase64(sel),
    iv: versBase64(iv),
    donnees: versBase64(new Uint8Array(donnees)),
  };
}

/* Lève une erreur si le mot de passe est faux ou si le fichier a été modifié. */
export async function dechiffrer(paquet, motDePasse) {
  const cle = await deriverCle(motDePasse, depuisBase64(paquet.sel), paquet.iterations);
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: depuisBase64(paquet.iv) },
    cle,
    depuisBase64(paquet.donnees),
  );
  return new TextDecoder().decode(clair);
}
