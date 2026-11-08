/* Espace enseignant, onglet Demi-fond : seuils, consignes et valeurs par défaut des courses. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../../noyau/interface.js';
import { decimal, esc } from '../../noyau/outils.js';
import { lireElevesCsv } from '../../champ4/donnees/operations.js';
import { blocImportEleves } from '../../champ4/ecrans/import-eleves.js';
import { PCT_MAX, PCT_MIN, PCT_PAS, REGLAGES_DEFAUT } from '../contenu.js';
import { ficheCoureur, lireVma, reglagesDemifond } from '../etat.js';

const nombre = (texte) => parseFloat(String(texte).replace(',', '.'));

/* Les CSV d'Excel sont souvent en Windows-1252 : on évite ainsi les accents abîmés. */
async function lireTexte(fichier) {
  const octets = await fichier.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder('windows-1252').decode(octets);
  }
}

function modifier(reglage, valeur) {
  etat.reglages.demifond = { ...reglagesDemifond(), [reglage]: valeur };
  sauver();
}

/* La prochaine course reprend les valeurs de l'enseignant, plutôt que les derniers choix de l'onglet Projet. */
export function oublierChoixCourse(champs = ['type', 'distance', 'duree', 'plots', 'tolerance']) {
  champs.forEach((champ) => {
    etat.prepCourse[champ] = null;
  });
}

const zones = () => reglagesDemifond().zones.map((z) => ({ ...z }));

function valeurNumerique(champ, min, message) {
  const v = nombre(champ.value);
  if (!(v >= min)) {
    notifier(message);
    rafraichir();
    return null;
  }
  return v;
}

declarerActions({
  'dfr-csv-vma': async (_, champ) => {
    const fichier = champ.files[0];
    if (!fichier) return;
    const lignes = lireElevesCsv(await lireTexte(fichier));
    let vmas = 0;
    lignes.forEach(({ eleve, colonnes }) => {
      if (!etat.eleves.some((e) => e.id === eleve.id)) etat.eleves.push(eleve);
      const vma = lireVma(colonnes[3]);
      if (vma != null) {
        ficheCoureur(eleve.id).vma = vma;
        vmas += 1;
      }
    });
    champ.value = '';
    sauver();
    rafraichir();
    notifier(`${lignes.length} élève${lignes.length > 1 ? 's' : ''} lu${lignes.length > 1 ? 's' : ''}, ${vmas} VMA enregistrée${vmas > 1 ? 's' : ''} ✔`);
  },
  'dfr-tolerance': (_, champ) => {
    const v = valeurNumerique(champ, 0, 'Tolérance invalide.');
    if (v == null) return;
    modifier('tolerance', v);
    oublierChoixCourse(['tolerance']);
    sauver();
  },
  'dfr-plots': (_, champ) => {
    const v = valeurNumerique(champ, 10, 'Distance entre plots : 10 m minimum.');
    if (v == null) return;
    modifier('distancePlots', v);
    oublierChoixCourse(['plots']);
    sauver();
  },
  'dfr-type': ({ type }) => {
    modifier('typeCourse', type);
    oublierChoixCourse(['type']);
    sauver();
    rafraichir();
  },
  'dfr-distance': (_, champ) => {
    const v = valeurNumerique(champ, 50, 'Distance : 50 m minimum.');
    if (v == null) return;
    modifier('distance', v);
    oublierChoixCourse(['distance']);
    sauver();
  },
  'dfr-duree': (_, champ) => {
    const v = valeurNumerique(champ, 0.5, 'Durée : 30 secondes minimum.');
    if (v == null) return;
    modifier('duree', Math.round(v * 60));
    oublierChoixCourse(['duree']);
    sauver();
  },
  'dfr-pct': ({ pas }) => {
    const suivant = reglagesDemifond().pctDefaut + Number(pas);
    modifier('pctDefaut', Math.min(PCT_MAX, Math.max(PCT_MIN, suivant)));
    rafraichir();
  },
  'dfr-vitesse-max': (_, champ) => {
    const v = valeurNumerique(champ, 15, 'Vitesse maximale : 15 km/h minimum.');
    if (v != null) modifier('vitesseMax', v);
  },
  'dfr-sons': (_, champ) => modifier('sons', champ.checked),
  'dfr-consigne': ({ cle }, champ) => {
    const texte = champ.value.trim();
    modifier('consignes', { ...reglagesDemifond().consignes, [cle]: texte || REGLAGES_DEFAUT.consignes[cle] });
  },
  'dfr-consignes-defaut': () => {
    modifier('consignes', { ...REGLAGES_DEFAUT.consignes });
    rafraichir();
  },
  'dfr-zone-nom': ({ rang }, champ) => {
    const liste = zones();
    liste[rang].nom = champ.value;
    modifier('zones', liste);
  },
  'dfr-zone-borne': ({ rang, borne }, champ) => {
    const v = nombre(champ.value);
    if (Number.isNaN(v)) {
      notifier('Pourcentage invalide.');
      return rafraichir();
    }
    const liste = zones();
    liste[rang][borne] = v;
    modifier('zones', liste);
    rafraichir();
  },
  'dfr-zone-ajouter': () => {
    modifier('zones', [...zones(), { nom: 'Nouveau seuil', min: PCT_MIN, max: PCT_MAX }]);
    rafraichir();
  },
  'dfr-zone-retirer': ({ rang }) => {
    const liste = zones();
    liste.splice(Number(rang), 1);
    modifier('zones', liste);
    rafraichir();
  },
  'dfr-zones-defaut': () => {
    modifier('zones', REGLAGES_DEFAUT.zones.map((z) => ({ ...z })));
    rafraichir();
  },
  'dfr-tout-defaut': async () => {
    const ok = await demander({
      titre: 'Rétablir tous les réglages du demi-fond ?',
      texte: 'Seuils, consignes et valeurs par défaut reviennent à leur état d’origine. Les courses déjà faites ne changent pas.',
      confirmer: 'Rétablir',
      danger: true,
    });
    if (!ok) return;
    etat.reglages.demifond = null;
    oublierChoixCourse();
    sauver();
    rafraichir();
    notifier('Réglages du demi-fond rétablis ✔');
  },
});

/* Pourcentages (de 5 en 5) qui ne tombent dans aucun seuil, ou dans plusieurs. */
function verifierZones(liste) {
  const sansZone = [];
  const doubles = [];
  for (let pct = PCT_MIN; pct <= PCT_MAX; pct += PCT_PAS) {
    const nb = liste.filter((z) => pct >= z.min && pct <= z.max).length;
    if (!nb) sansZone.push(pct);
    if (nb > 1) doubles.push(pct);
  }
  const lignes = [];
  if (sansZone.length) lignes.push(`Aucun seuil pour : ${sansZone.join(', ')} %.`);
  if (doubles.length) lignes.push(`Plusieurs seuils pour : ${doubles.join(', ')} % (le premier de la liste s'applique).`);
  return lignes;
}

function carteSeuils(r) {
  const alertes = verifierZones(r.zones);
  return `<div class="carte carte-large"><h2 class="carte-titre">🎚️ Seuils d'entraînement <small>en % de VMA</small></h2>
    <p class="aide">Le nom du seuil s'affiche dans le projet de chaque coureur et dans le bilan.</p>
    <div class="grille-zones">${r.zones
      .map(
        (z, rang) => `<div class="ligne-zone">
          <input class="zone-nom" value="${esc(z.nom)}" aria-label="Nom du seuil ${rang + 1}" data-saisie="dfr-zone-nom" data-rang="${rang}">
          <input class="zone-borne" inputmode="numeric" value="${z.min}" aria-label="Minimum de ${esc(z.nom)}" data-choix="dfr-zone-borne" data-rang="${rang}" data-borne="min">
          <span>à</span>
          <input class="zone-borne" inputmode="numeric" value="${z.max}" aria-label="Maximum de ${esc(z.nom)}" data-choix="dfr-zone-borne" data-rang="${rang}" data-borne="max">
          <button class="btn-rond supprimer" aria-label="Supprimer ${esc(z.nom)}" data-action="dfr-zone-retirer" data-rang="${rang}">✕</button>
        </div>`,
      )
      .join('')}</div>
    ${alertes.length ? `<p class="alerte-zones" role="status">⚠ ${alertes.join(' ')}</p>` : ''}
    <div class="rangee sans-marge marge-haut">
      <button class="btn" data-action="dfr-zone-ajouter">＋ Ajouter un seuil</button>
      <button class="btn secondaire" data-action="dfr-zones-defaut">Rétablir les seuils</button>
    </div>
  </div>`;
}

function carteCourse(r) {
  const type = (id, libelle) =>
    `<button class="choix-sport ${r.typeCourse === id ? 'actif' : ''}" aria-pressed="${r.typeCourse === id}" data-action="dfr-type" data-type="${id}">${libelle}</button>`;
  return `<div class="carte"><h2 class="carte-titre">🏁 Course par défaut</h2>
    <p class="aide">Valeurs proposées dans l'onglet Projet. Elles restent modifiables pour chaque course.</p>
    <div class="choix-sports">${type('distance', '📏 Distance')}${type('temps', '⏱️ Temps')}</div>
    <div class="grille-parametres">
      <label>Distance (m)<input inputmode="numeric" value="${r.distance}" data-choix="dfr-distance"></label>
      <label>Durée (min)<input inputmode="decimal" value="${decimal(r.duree / 60)}" data-choix="dfr-duree"></label>
      <label>Entre deux plots (m)<input inputmode="numeric" value="${r.distancePlots}" data-choix="dfr-plots"></label>
      <label>Tolérance (km/h)<input inputmode="decimal" value="${decimal(r.tolerance)}" data-choix="dfr-tolerance"></label>
    </div>
    <div class="rangee sans-marge">
      <span class="etire"><b>% de VMA proposé</b></span>
      <div class="reglage-pct">
        <button class="btn-rond" aria-label="Baisser le pourcentage proposé" ${r.pctDefaut <= PCT_MIN ? 'disabled' : ''} data-action="dfr-pct" data-pas="${-PCT_PAS}">−</button>
        <b>${r.pctDefaut} %</b>
        <button class="btn-rond" aria-label="Monter le pourcentage proposé" ${r.pctDefaut >= PCT_MAX ? 'disabled' : ''} data-action="dfr-pct" data-pas="${PCT_PAS}">+</button>
      </div>
    </div>
  </div>`;
}

function carteConsignes(r) {
  const consigne = (cle, description) =>
    `<label>${description}<input value="${esc(r.consignes[cle])}" maxlength="14" data-choix="dfr-consigne" data-cle="${cle}"></label>`;
  return `<div class="carte"><h2 class="carte-titre">💬 Consignes affichées</h2>
    <div class="grille-parametres">
      ${consigne('super', 'Dans la tolérance')}
      ${consigne('accelere', 'Trop lent')}
      ${consigne('ralentis', 'Trop rapide')}
      ${consigne('attente', 'Avant le 1er plot')}
      ${consigne('fin', 'Arrivée')}
    </div>
    <button class="btn secondaire" data-action="dfr-consignes-defaut">Rétablir les consignes</button>
  </div>`;
}

const carteDivers = (r) => `<div class="carte"><h2 class="carte-titre">🔧 Pendant la course</h2>
    <label class="case"><input type="checkbox" ${r.sons ? 'checked' : ''} data-choix="dfr-sons">Sons à chaque appui</label>
    <div class="grille-parametres marge-haut">
      <label>Double appui ignoré au-delà de (km/h)<input inputmode="decimal" value="${decimal(r.vitesseMax)}" data-choix="dfr-vitesse-max"></label>
    </div>
    <p class="aide">À augmenter seulement pour de très bons coureurs ou des plots très rapprochés.</p>
  </div>`;

export function vueReglagesDemifond() {
  const r = reglagesDemifond();
  return `
    <div class="grille-reglages">
      <div class="carte"><h2 class="carte-titre">⬇ Importer la liste d'élèves</h2>
        ${blocImportEleves()}
      </div>
      <div class="carte"><h2 class="carte-titre">📄 Importer des VMA (CSV)</h2>
        <p class="aide">Colonnes : Nom ; Prénom ; Classe ; VMA. Seuls le prénom et l'initiale du nom sont conservés.</p>
        <label class="btn">Choisir le fichier<input type="file" accept=".csv,.txt" hidden data-choix="dfr-csv-vma"></label>
      </div>
      ${carteSeuils(r)}
      ${carteCourse(r)}
      ${carteConsignes(r)}
      ${carteDivers(r)}
    </div>
    <p class="aide">Ces réglages partent vers les autres tablettes avec la configuration (Réglages → Synchronisation des réglages). Les courses déjà faites ne changent pas.</p>
    <button class="btn secondaire" data-action="dfr-tout-defaut">Rétablir tous les réglages du demi-fond</button>`;
}
