/* Point d'entrée : en-tête, onglets, choix de l'écran affiché. */
import { etat, sauvegardeOk, sauver } from './noyau/etat.js';
import { brancherEvenements, declarerActions, definirDessin, notifier, rafraichir, vue } from './noyau/interface.js';
import { esc } from './noyau/outils.js';
import { vueAccueil } from './ecrans/accueil.js';
import { APSA } from './champ4/contenu/apsa.js';
import { matchCourant } from './champ4/reglages.js';
import { vueBilan } from './champ4/ecrans/bilan.js';
import { vueEnseignant } from './champ4/ecrans/enseignant.js';
import { vueEquipes } from './champ4/ecrans/equipes.js';
import { vueMatch } from './champ4/ecrans/match.js';
import { vuePoules } from './champ4/ecrans/poules.js';
import { ONGLETS_DF, vueDemifond } from './demifond/ecrans/module.js';
import { oublierChoixCourse } from './demifond/ecrans/reglages.js';
import { vueTestVma } from './testvma/ecran.js';
import { cooperEnCours } from './testvma/ecran-cooper.js';

const testVmaEnCours = () => !!etat.testVma.depart && !etat.testVma.arret;

const ONGLETS = [
  { id: 'equipes', libelle: '👥 Équipes', vue: vueEquipes },
  { id: 'poules', libelle: '🏆 Poules', vue: vuePoules },
  { id: 'match', libelle: '⏱️ Match', vue: vueMatch },
  { id: 'bilan', libelle: '📊 Bilan', vue: vueBilan },
];

/* Récupère la configuration déposée sur le site, puis recharge l'application. */
async function mettreAJour() {
  if (!navigator.onLine) return notifier('Pas de connexion internet');
  try {
    const reponse = await fetch('config.json', { cache: 'no-store' });
    if (reponse.ok) {
      const config = await reponse.json();
      if (config.version && config.version !== etat.configVersion) {
        Object.assign(etat.reglages, config.reglages);
        if (config.reglages?.demifond) oublierChoixCourse();
        etat.configVersion = config.version;
        sauver();
        notifier('Configuration mise à jour ✔');
      } else {
        notifier('Déjà à jour ✔');
      }
    } else {
      notifier('Aucune configuration publiée');
    }
    setTimeout(() => window.location.reload(), 1300);
  } catch {
    notifier('Mise à jour impossible');
  }
}

declarerActions({
  'aller-enseignant': () => {
    vue.ecran = 'enseignant';
    rafraichir();
  },
  accueil: () => {
    vue.ecran = 'accueil';
    rafraichir();
  },
  'menu-principal': () => {
    etat.apsa = null;
    etat.matchCourant = null;
    vue.ecran = 'accueil';
    vue.onglet = 'match';
    sauver();
    rafraichir();
  },
  'ouvrir-module': ({ module }) => {
    vue.ecran = module;
    rafraichir();
  },
  'choisir-apsa': ({ apsa }) => {
    etat.apsa = apsa;
    etat.matchCourant = null;
    vue.ecran = 'champ4';
    vue.onglet = 'match';
    sauver();
    rafraichir();
  },
  onglet: ({ onglet }) => {
    vue.onglet = onglet;
    rafraichir();
  },
  'basculer-affichage': ({ reglage }) => {
    etat.affichage[reglage] = !etat.affichage[reglage];
    sauver();
    rafraichir();
  },
  'mettre-a-jour': mettreAJour,
});

function indicateurSauvegarde() {
  return sauvegardeOk
    ? `<span class="pastille-etat ok">✓ Enregistré</span>`
    : `<span class="pastille-etat erreur" role="alert">⚠ Non enregistré : fais une sauvegarde</span>`;
}

function dessinerEnTete() {
  const champ4 = vue.ecran === 'champ4';
  const demifond = vue.ecran === 'demifond';
  const testVma = vue.ecran === 'testvma';
  const sousTitre = champ4
    ? esc(etat.apsa)
    : demifond
      ? 'Demi-fond'
      : testVma
        ? 'Test VMA'
        : vue.ecran === 'enseignant'
          ? 'Espace enseignant'
          : 'Saint-Joseph Auneau';
  const icone = champ4 ? APSA[etat.apsa].icone : demifond ? '🏃' : testVma ? '📈' : '🏅';
  document.querySelector('#entete').innerHTML = `
    <div class="marque"><span class="marque-icone">${icone}</span><div><h1>EPS +</h1><small>${sousTitre}</small></div></div>
    <div class="commandes">
      <span id="etat-sauvegarde">${indicateurSauvegarde()}</span>
      <button class="btn-mini" data-action="aller-enseignant">🔒 Enseignant</button>
      <button class="btn-mini" data-action="mettre-a-jour">⟳ Mise à jour</button>
      <button class="btn-mini" data-action="basculer-affichage" data-reglage="sombre" aria-label="Thème sombre" aria-pressed="${etat.affichage.sombre}">🌓</button>
      <button class="btn-mini" data-action="basculer-affichage" data-reglage="grandsBoutons" aria-label="Grands boutons" aria-pressed="${etat.affichage.grandsBoutons}">Aa</button>
    </div>`;
}

function dessinerNavigation() {
  const barre = document.querySelector('#navigation');
  if (vue.ecran === 'enseignant' || vue.ecran === 'testvma') {
    barre.innerHTML = `<button class="btn-retour" data-action="accueil">← Menu principal</button>`;
  } else if (vue.ecran === 'champ4') {
    barre.innerHTML = `<button class="btn-retour" data-action="menu-principal">← Menu principal</button>
      <div class="onglets" role="tablist">${ONGLETS.map(
        (o) => `<button role="tab" aria-selected="${o.id === vue.onglet}" class="onglet ${o.id === vue.onglet ? 'actif' : ''}" data-action="onglet" data-onglet="${o.id}">${o.libelle}</button>`,
      ).join('')}</div>`;
  } else if (vue.ecran === 'demifond') {
    barre.innerHTML = `<button class="btn-retour" data-action="accueil">← Menu principal</button>
      <div class="onglets" role="tablist">${ONGLETS_DF.map(
        (o) => `<button role="tab" aria-selected="${o.id === vue.ongletDF}" class="onglet ${o.id === vue.ongletDF ? 'actif' : ''}" data-action="df-onglet" data-onglet="${o.id}">${o.libelle}</button>`,
      ).join('')}</div>`;
  } else {
    barre.innerHTML = '';
  }
}

function contenu() {
  if (vue.ecran === 'enseignant') return vueEnseignant();
  if (vue.ecran === 'accueil') return vueAccueil();
  if (vue.ecran === 'demifond') return vueDemifond();
  if (vue.ecran === 'testvma') return vueTestVma();
  return ONGLETS.find((o) => o.id === vue.onglet).vue();
}

definirDessin(() => {
  if (vue.ecran === 'champ4' && !etat.apsa) vue.ecran = 'accueil';
  document.body.classList.toggle('sombre', etat.affichage.sombre);
  document.body.classList.toggle('grands', etat.affichage.grandsBoutons);
  /* La zone autour de l'application (barre d'état de l'iPad) suit le fond, clair ou sombre. */
  const couleurFond = etat.affichage.sombre ? '#0f172a' : '#e8f4fd';
  document.documentElement.style.background = couleurFond;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', couleurFond);
  /* Pendant une course, on masque l'en-tête pour laisser la place aux coureurs. */
  const testEnCours = vue.ecran === 'testvma' && (testVmaEnCours() || cooperEnCours());
  const match = vue.ecran === 'champ4' && vue.onglet === 'match' ? matchCourant() : null;
  const raquetteEnCours = !!match && !match.termine && !!APSA[match.apsa]?.terrain;
  document.body.classList.toggle('en-course', testEnCours || raquetteEnCours || (vue.ecran === 'demifond' && vue.ongletDF === 'course' && !!etat.courseEnCours));
  dessinerEnTete();
  dessinerNavigation();
  document.querySelector('#contenu').innerHTML = contenu();
});

brancherEvenements();
['input', 'change'].forEach((evenement) =>
  document.addEventListener(evenement, () => {
    document.querySelector('#etat-sauvegarde').innerHTML = indicateurSauvegarde();
  }),
);

if (etat.apsa) vue.ecran = 'champ4';
/* Une course en cours reprend après un rechargement : le chrono part de l'heure de départ. */
if (etat.courseEnCours) {
  vue.ecran = 'demifond';
  vue.ongletDF = 'course';
}
/* Un test VMA en cours reprend de même. */
if (testVmaEnCours() || cooperEnCours() || (etat.testVma.cooper?.test && etat.testVma.cooper.test.coureurs[0].distanceFinale == null)) {
  vue.ecran = 'testvma';
}
rafraichir();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
