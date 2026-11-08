/* Espace enseignant : tolérance, plots, sons et zones du demi-fond. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, notifier, rafraichir } from '../../noyau/interface.js';
import { decimal, esc } from '../../noyau/outils.js';
import { REGLAGES_DEFAUT } from '../contenu.js';
import { reglagesDemifond } from '../etat.js';

const nombre = (texte) => parseFloat(String(texte).replace(',', '.'));

function modifier(reglage, valeur) {
  etat.reglages.demifond = { ...reglagesDemifond(), [reglage]: valeur };
  sauver();
}

const zones = () => reglagesDemifond().zones.map((z) => ({ ...z }));

declarerActions({
  'dfr-tolerance': (_, champ) => {
    const v = nombre(champ.value);
    if (!(v >= 0)) return notifier('Tolérance invalide.');
    modifier('tolerance', v);
  },
  'dfr-plots': (_, champ) => {
    const v = nombre(champ.value);
    if (!(v >= 10)) return notifier('Distance entre plots : 10 m minimum.');
    modifier('distancePlots', v);
  },
  'dfr-sons': (_, champ) => modifier('sons', champ.checked),
  'dfr-zone-nom': ({ rang }, champ) => {
    const liste = zones();
    liste[rang].nom = champ.value;
    modifier('zones', liste);
  },
  'dfr-zone-borne': ({ rang, borne }, champ) => {
    const v = nombre(champ.value);
    if (Number.isNaN(v)) return notifier('Pourcentage invalide.');
    const liste = zones();
    liste[rang][borne] = v;
    modifier('zones', liste);
  },
  'dfr-zone-ajouter': () => {
    modifier('zones', [...zones(), { nom: 'Nouvelle zone', min: 60, max: 120 }]);
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
});

export function carteDemifond() {
  const r = reglagesDemifond();
  return `<div class="carte carte-large"><h2 class="carte-titre">🏃 Demi-fond</h2>
    <div class="grille-parametres">
      <label>Tolérance (km/h)<input inputmode="decimal" value="${decimal(r.tolerance)}" data-choix="dfr-tolerance"></label>
      <label>Entre deux plots (m)<input inputmode="numeric" value="${r.distancePlots}" data-choix="dfr-plots"></label>
    </div>
    <label class="case"><input type="checkbox" ${r.sons ? 'checked' : ''} data-choix="dfr-sons">Sons pendant la course</label>
    <h4>Zones d'entraînement (% de VMA)</h4>
    <div class="grille-zones">${r.zones
      .map(
        (z, rang) => `<div class="ligne-zone">
          <input class="zone-nom" value="${esc(z.nom)}" aria-label="Nom de la zone ${rang + 1}" data-saisie="dfr-zone-nom" data-rang="${rang}">
          <input class="zone-borne" inputmode="numeric" value="${z.min}" aria-label="Minimum de ${esc(z.nom)}" data-choix="dfr-zone-borne" data-rang="${rang}" data-borne="min">
          <span>à</span>
          <input class="zone-borne" inputmode="numeric" value="${z.max}" aria-label="Maximum de ${esc(z.nom)}" data-choix="dfr-zone-borne" data-rang="${rang}" data-borne="max">
          <button class="btn-rond supprimer" aria-label="Supprimer ${esc(z.nom)}" data-action="dfr-zone-retirer" data-rang="${rang}">✕</button>
        </div>`,
      )
      .join('')}</div>
    <div class="rangee sans-marge marge-haut">
      <button class="btn" data-action="dfr-zone-ajouter">＋ Ajouter une zone</button>
      <button class="btn secondaire" data-action="dfr-zones-defaut">Rétablir les zones</button>
    </div>
  </div>`;
}
