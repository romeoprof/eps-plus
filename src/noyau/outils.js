export const uid = () => Math.random().toString(36).slice(2, 8);

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (valeur) => String(valeur ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/* Écriture française : virgule décimale et espace insécable devant « % ». */
export const decimal = (nombre) => String(nombre).replace('.', ',');
export const pourcent = (a, b) => (b ? `${decimal(Math.round((1000 * a) / b) / 10)} %` : '–');
export const lireNombre = (texte) => parseFloat(String(texte).replace(',', '.'));

export const formatChrono = (secondes) =>
  `${String(Math.floor(secondes / 60)).padStart(2, '0')}:${String(Math.floor(secondes % 60)).padStart(2, '0')}`;

/* Le code enseignant n'est pas écrit en clair. Une application sans serveur ne
   peut pas le protéger vraiment : cela évite seulement qu'il soit lu directement. */
export function empreinte(code) {
  const texte = `eps-auneau:${code}`;
  let h = 2166136261;
  for (let n = 0; n < 5000; n += 1) {
    for (const c of texte) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    h ^= n;
  }
  return (h >>> 0).toString(36);
}

/* Ouvre le partage de l'appareil (Drive, Quick Share, e-mail) ; sinon, télécharge le fichier. */
export async function partagerFichier(nomFichier, contenu, type = 'text/plain') {
  const fichier = new File([contenu], nomFichier, { type });
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nomFichier });
      return 'partage';
    } catch (erreur) {
      if (erreur.name === 'AbortError') return 'annule';
    }
  }
  telecharger(nomFichier, contenu, type);
  return 'telecharge';
}

export function telecharger(nomFichier, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
