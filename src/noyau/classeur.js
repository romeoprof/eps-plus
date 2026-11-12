/*
 * Fichier Excel (.xlsx) fabriqué sur la tablette, sans bibliothèque :
 * plusieurs feuilles, titres, en-têtes colorés, bordures et largeurs de colonnes.
 * feuilles : [{ nom, largeurs: [nombre de caractères…], lignes: [[cellule…]] }]
 * cellule : texte, nombre, ou { v, style } avec style 'titre', 'entete', 'section' ou 'case'.
 */

const STYLES = { normal: 0, entete: 1, titre: 2, section: 3, case: 4 };
const encodeur = new TextEncoder();

const xml = (texte) =>
  String(texte)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const lettre = (n) => {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

function cellule(valeur, ligne, colonne) {
  if (valeur == null || valeur === '') return '';
  const { v, style } = typeof valeur === 'object' ? valeur : { v: valeur, style: 'case' };
  const ref = `${lettre(colonne)}${ligne + 1}`;
  const s = STYLES[style] ?? 0;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
}

function feuilleXml({ largeurs = [], lignes }) {
  const colonnes = largeurs.length
    ? `<cols>${largeurs.map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const corps = lignes
    .map((ligne, r) => `<row r="${r + 1}">${ligne.map((c, k) => cellule(c, r, k)).join('')}</row>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews>${colonnes}<sheetData>${corps}</sheetData></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* Nom de feuille autorisé par Excel : 31 caractères, sans : \ / ? * [ ]. */
const nomFeuille = (nom, rang) => (String(nom).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Feuille ${rang + 1}`);

export function fichiersClasseur(feuilles) {
  const noms = feuilles.map((f, i) => nomFeuille(f.nom, i));
  return {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${noms
      .map((nom, i) => `<sheet name="${xml(nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': STYLES_XML,
    ...Object.fromEntries(feuilles.map((f, i) => [`xl/worksheets/sheet${i + 1}.xml`, feuilleXml(f)])),
  };
}

/* ---------- Archive ZIP (sans compression), le format d'un .xlsx ---------- */
const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i += 1) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(fichiers) {
  const morceaux = [];
  const central = [];
  let position = 0;
  Object.entries(fichiers).forEach(([nom, contenu]) => {
    const nomOctets = encodeur.encode(nom);
    const donnees = typeof contenu === 'string' ? encodeur.encode(contenu) : contenu;
    const crc = crc32(donnees);
    const entete = new DataView(new ArrayBuffer(30));
    entete.setUint32(0, 0x04034b50, true);
    entete.setUint16(4, 20, true);
    entete.setUint16(6, 0x0800, true);
    entete.setUint16(8, 0, true);
    entete.setUint32(14, crc, true);
    entete.setUint32(18, donnees.length, true);
    entete.setUint32(22, donnees.length, true);
    entete.setUint16(26, nomOctets.length, true);
    morceaux.push(new Uint8Array(entete.buffer), nomOctets, donnees);
    const fiche = new DataView(new ArrayBuffer(46));
    fiche.setUint32(0, 0x02014b50, true);
    fiche.setUint16(4, 20, true);
    fiche.setUint16(6, 20, true);
    fiche.setUint16(8, 0x0800, true);
    fiche.setUint32(16, crc, true);
    fiche.setUint32(20, donnees.length, true);
    fiche.setUint32(24, donnees.length, true);
    fiche.setUint16(28, nomOctets.length, true);
    fiche.setUint32(42, position, true);
    central.push(new Uint8Array(fiche.buffer), nomOctets);
    position += 30 + nomOctets.length + donnees.length;
  });
  const tailleCentrale = central.reduce((s, m) => s + m.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  const nombre = Object.keys(fichiers).length;
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, nombre, true);
  fin.setUint16(10, nombre, true);
  fin.setUint32(12, tailleCentrale, true);
  fin.setUint32(16, position, true);
  const parties = [...morceaux, ...central, new Uint8Array(fin.buffer)];
  const resultat = new Uint8Array(parties.reduce((s, m) => s + m.length, 0));
  let decalage = 0;
  parties.forEach((m) => {
    resultat.set(m, decalage);
    decalage += m.length;
  });
  return resultat;
}

export const creerClasseur = (feuilles) => zip(fichiersClasseur(feuilles));
export const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
