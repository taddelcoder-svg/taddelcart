'use strict';
// Löwen-Kart – das ganze Spiel läuft im Browser (three.js r128, ohne Build-Schritt).
// Koordinaten: y zeigt nach oben, ein Kart schaut im Modell nach +z.
// Gierwinkel yaw: Vorwärts = (sin yaw, cos yaw), größerer yaw = Linkskurve.
(() => {

/* =========================================================
   Hilfen
   ========================================================= */
const $ = id => document.getElementById(id);
const klemm = (v, a, b) => (v < a ? a : v > b ? b : v);
const zufall = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
function winkelDiff(a, b){ let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const cssFarbe = hex => '#' + hex.toString(16).padStart(6, '0');
function zeitText(t){
  if (!isFinite(t)) return '–';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}
function lesen(k, s){ try { const v = localStorage.getItem('loewenkart:' + k); return v == null ? s : JSON.parse(v); } catch (e) { return s; } }
function schreiben(k, v){ try { localStorage.setItem('loewenkart:' + k, JSON.stringify(v)); } catch (e) { /* egal */ } }
function zufallsGen(saat){
  let a = saat >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const esc = t => String(t).replace(/[&<>"']/g, z => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[z]));
const zahlOk = v => typeof v === 'number' && isFinite(v);
function mischen(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* =========================================================
   Spieldaten
   ========================================================= */
const FAHRER = [
  { id:'leo',   name:'Leo',   tier:'loewe',   gesicht:'🦁', farbe:0xf2a531, tempo:3, beschl:3, lenk:3 },
  { id:'fina',  name:'Fina',  tier:'fuchs',   gesicht:'🦊', farbe:0xe2461f, tempo:3, beschl:2, lenk:4 },
  { id:'pando', name:'Pando', tier:'panda',   gesicht:'🐼', farbe:0x2f3a4a, tempo:4, beschl:3, lenk:2 },
  { id:'quaki', name:'Quaki', tier:'frosch',  gesicht:'🐸', farbe:0x3fae49, tempo:2, beschl:4, lenk:3 },
  { id:'hops',  name:'Hops',  tier:'hase',    gesicht:'🐰', farbe:0xef6fa8, tempo:2, beschl:3, lenk:4 },
  { id:'pingo', name:'Pingo', tier:'pinguin', gesicht:'🐧', farbe:0x2c6fd8, tempo:3, beschl:4, lenk:2 },
  { id:'bruno', name:'Bruno', tier:'baer',    gesicht:'🐻', farbe:0x8a4f2a, tempo:5, beschl:2, lenk:2 },
  { id:'mimi',  name:'Mimi',  tier:'katze',   gesicht:'🐱', farbe:0x9357d4, tempo:2, beschl:5, lenk:2 },
  { id:'koko',  name:'Koko',  tier:'affe',    gesicht:'🐵', farbe:0x17a89a, tempo:2, beschl:2, lenk:5 }
];
const STUFEN = [
  { name:'50 ccm',  info:'Gemütlich', tempo:0.88, ki:0.86, startTrick:0.25, kurve:0.9 },
  { name:'100 ccm', info:'Flott',     tempo:1.0,  ki:0.94, startTrick:0.45, kurve:0.97 },
  { name:'150 ccm', info:'Rasant',    tempo:1.12, ki:1.0,  startTrick:0.7,  kurve:1.03 }
];
const THEMEN = {
  wiese: {
    himmel:['#2f7fd8', '#cfe9ff'], nebel:'#cfe6fb', nebelWeit:[260, 1150], sonne:'#fff1d8', sonnenKraft:2.2,
    hemi:['#dcefff', '#6d8a45'], hemiKraft:0.95, gras:['#5ea944', '#4f9838', '#6bbb50'], auslauf:'#b79b64',
    strasse:'#595d64', wand:[0xe8322a, 0xf5f5f5], berge:0x5d8b52, staub:[0.55, 0.45, 0.3], deko:'baeume', wolken:true
  },
  wueste: {
    himmel:['#d9683a', '#ffd6a0'], nebel:'#f5c793', nebelWeit:[220, 1000], sonne:'#ffd9a8', sonnenKraft:2.4,
    hemi:['#ffe2bd', '#a0643a'], hemiKraft:0.85, gras:['#e2bb78', '#d6aa63', '#ebc98a'], auslauf:'#c4935a',
    strasse:'#65605c', wand:[0xff8a1a, 0xfff1dc], berge:0xc0683a, staub:[0.85, 0.66, 0.4], deko:'kakteen', wolken:false
  },
  frost: {
    himmel:['#7aa5d8', '#eef4fb'], nebel:'#e4edf6', nebelWeit:[130, 820], sonne:'#f4f8ff', sonnenKraft:1.7,
    hemi:['#eef5ff', '#9aa9ba'], hemiKraft:1.15, gras:['#f1f5fa', '#e3eaf2', '#fbfdff'], auslauf:'#c3d2e2',
    strasse:'#4a4f57', wand:[0x2f7fd8, 0xf4f8ff], berge:0xdbe5f0, staub:[0.95, 0.97, 1], deko:'tannen', wolken:true, schnee:true
  }
};
const STRECKEN = [
  { id:'wiese', name:'Löwenwiese', info:'Sonnig, breit, ideal zum Üben', thema:'wiese', skala:1.3, breite:17, saat:11,
    punkte:[[0,0],[80,0],[140,10],[175,50],[170,100],[130,125],[90,110],[60,130],[55,175],[20,200],[-40,195],[-90,170],[-110,120],[-90,70],[-60,30]] },
  { id:'wueste', name:'Kaktus-Canyon', info:'Heiße Haarnadelkurve', thema:'wueste', skala:1.3, breite:16, saat:22,
    punkte:[[0,0],[100,0],[160,-20],[200,-70],[190,-130],[140,-150],[100,-120],[110,-80],[80,-55],[30,-70],[-10,-120],[-60,-140],[-110,-110],[-120,-50],[-80,-10]] },
  { id:'frost', name:'Frostgipfel', info:'Schnee und enge Schikanen', thema:'frost', skala:1.3, breite:16, saat:33,
    punkte:[[0,0],[90,0],[130,30],[120,80],[70,90],[40,130],[60,180],[20,220],[-50,215],[-70,170],[-40,130],[-80,90],[-130,80],[-140,30],[-90,0]] }
];
const ITEM_ICON = { turbo:'⚡', turbo3:'⚡', banane:'🍌', rakete:'🚀', stern:'⭐' };
const RUNDEN = 3;
const PUNKTE = [15, 12, 10, 8, 6, 4, 2, 1];
const SPIELER_STARTPLATZ = 5;

const wahl = Object.assign({ fahrer:0, strecke:0, stufe:1, modus:'einzel' }, lesen('wahl', {}));
if (!FAHRER[wahl.fahrer]) wahl.fahrer = 0;
if (!STRECKEN[wahl.strecke]) wahl.strecke = 0;
if (!STUFEN[wahl.stufe]) wahl.stufe = 1;
const rekorde = lesen('rekorde', {});
let rennStufe = wahl.stufe;

/* =========================================================
   Renderer, Szene, Licht
   ========================================================= */
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Gespeicherte Qualitaet: auf Touch-Geraeten standardmaessig ausgewogen.
const grafik = { modus:lesen('grafik', matchMedia('(pointer: coarse)').matches ? 'mittel' : 'hoch') };
if (!['hoch', 'mittel', 'leicht'].includes(grafik.modus)) grafik.modus = 'hoch';
function grafikAnwenden(){
  const hoch = grafik.modus === 'hoch', leicht = grafik.modus === 'leicht';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, hoch ? 2 : leicht ? 1 : 1.5));
  renderer.shadowMap.enabled = !leicht;
  const groesse = hoch ? 2048 : 1024;
  if (sonne.shadow.mapSize.x !== groesse){
    sonne.shadow.mapSize.set(groesse, groesse);
    if (sonne.shadow.map){ sonne.shadow.map.dispose(); sonne.shadow.map = null; }
  }
  scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  groesseAnpassen();
  for (const id of ['grafikWahl', 'pauseGrafik']) $(id).value = grafik.modus;
}
$('szene').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.3, 3000);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sonne = new THREE.DirectionalLight(0xffffff, 2);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left:-70, right:70, top:70, bottom:-70, near:1, far:400 });
sonne.shadow.bias = -0.0004;
sonne.shadow.normalBias = 0.03;
scene.add(sonne, sonne.target);
const SONNE_VERSATZ = new THREE.Vector3(70, 130, 45);

// Himmel als Kugel mit Farbverlauf
const himmelUni = { oben:{ value:new THREE.Color() }, horizont:{ value:new THREE.Color() } };
const himmel = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({
  uniforms:himmelUni, side:THREE.BackSide, depthWrite:false, fog:false,
  vertexShader:'varying vec3 vP;\nvoid main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader:'uniform vec3 oben;\nuniform vec3 horizont;\nvarying vec3 vP;\nvoid main(){\n float h = clamp(vP.y * 1.7, 0.0, 1.0);\n gl_FragColor = vec4(mix(horizont, oben, pow(h, 0.65)), 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'
}));
// Weicher Sonnenhof statt einer gleichmaessig leeren Himmelskugel.
himmel.material.fragmentShader = himmel.material.fragmentShader.replace(
  'gl_FragColor = vec4(mix(horizont, oben, pow(h, 0.65)), 1.0);',
  'vec3 col = mix(horizont, oben, pow(h, 0.65)); float sun = max(0.0, dot(normalize(vP), normalize(vec3(70.0,130.0,45.0)))); col += vec3(1.0,0.78,0.42) * (pow(sun, 28.0)*0.18 + pow(sun, 650.0)*1.3); gl_FragColor = vec4(col, 1.0);');
himmel.renderOrder = -1;

// Kleine, pro Strecke erzeugte Umgebungsreflexion fuer Lack und Metall.
const pmrem = new THREE.PMREMGenerator(renderer);
let umgebung = null;
function umgebungBauen(th){
  const welt = new THREE.Scene();
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), new THREE.ShaderMaterial({
    side:THREE.BackSide,
    uniforms:{ oben:{value:lin(th.himmel[0])}, unten:{value:lin(th.gras[0])} },
    vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 oben;uniform vec3 unten;varying vec3 p;void main(){float h=normalize(p).y;vec3 c=mix(unten,oben,smoothstep(-0.2,0.5,h));c+=vec3(0.8)*pow(max(0.0,dot(normalize(p),normalize(vec3(1.0,2.0,1.0)))),40.0);gl_FragColor=vec4(c,1.0);\n#include <encodings_fragment>\n}'
  }));
  welt.add(kugel);
  if (umgebung) umgebung.dispose();
  umgebung = pmrem.fromScene(welt, 0.02, 0.1, 100);
  scene.environment = umgebung.texture;
  kugel.geometry.dispose(); kugel.material.dispose();
}
scene.add(himmel);

function groesseAnpassen(){
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', groesseAnpassen);
groesseAnpassen();

/* =========================================================
   Texturen (alle im Canvas gemalt, keine Downloads)
   ========================================================= */
function canvasTex(w, h, malen, wiederholen){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  malen(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (wiederholen) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function koernung(c, w, h, anzahl, staerke){
  for (let n = 0; n < anzahl; n++){
    const hell = Math.random() < 0.5 ? 255 : 0;
    c.fillStyle = `rgba(${hell},${hell},${hell},${Math.random() * staerke})`;
    c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
const partikelTex = canvasTex(64, 64, (c, w) => {
  const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, w);
});
const boxTex = canvasTex(128, 128, (c, w) => {
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 0, w, w);
  c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, w - 10);
  c.font = '900 92px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.45)'; c.strokeText('?', w / 2, w / 2 + 6);
  c.fillStyle = '#fff'; c.fillText('?', w / 2, w / 2 + 6);
});
const pfeilTex = canvasTex(128, 128, (c, w) => {
  c.fillStyle = 'rgba(40,20,0,.55)'; c.fillRect(0, 0, w, w);
  c.fillStyle = '#ffcf2e';
  for (const y of [8, 72]){
    c.beginPath(); c.moveTo(14, y + 44); c.lineTo(64, y); c.lineTo(114, y + 44); c.lineTo(114, y + 60); c.lineTo(64, y + 18); c.lineTo(14, y + 60); c.closePath(); c.fill();
  }
}, true);

/* =========================================================
   Geteilte Geometrien und Materialien
   ========================================================= */
const GEO = {
  box:new THREE.BoxGeometry(1, 1, 1),
  kugel:new THREE.SphereGeometry(1, 20, 14),
  kugelGrob:new THREE.SphereGeometry(1, 8, 6),
  zyl:new THREE.CylinderGeometry(1, 1, 1, 16),
  zylGrob:new THREE.CylinderGeometry(1, 1, 1, 8),
  kegel:new THREE.ConeGeometry(1, 1, 14),
  kegelGrob:new THREE.ConeGeometry(1, 1, 8),
  rad:new THREE.CylinderGeometry(0.46, 0.46, 0.42, 18),
  radHinten:new THREE.CylinderGeometry(0.52, 0.52, 0.5, 18),
  schatten:new THREE.PlaneGeometry(3.8, 4.8),
  lenkrad:new THREE.TorusGeometry(0.22, 0.05, 8, 16),
  banane:new THREE.TorusGeometry(0.42, 0.15, 8, 14, Math.PI * 0.95),
  box16:new THREE.BoxGeometry(1.7, 1.7, 1.7)
};
const std = (farbe, rau = 0.6, metall = 0) => new THREE.MeshStandardMaterial({ color:lin(farbe), roughness:rau, metalness:metall });
const MAT = {
  kontakt:new THREE.MeshBasicMaterial({ map:partikelTex, color:0x080c12, transparent:true, opacity:0.36, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5 }),
  licht:new THREE.MeshBasicMaterial({ color:0xffe8bd }),
  ruecklicht:new THREE.MeshBasicMaterial({ color:0xff3427 }),
  dunkel:std(0x2a2d33, 0.6), metall:std(0xc4cad3, 0.3, 0.8), reifen:std(0x1a1a1e, 0.9), auge:std(0x111111, 0.25),
  weiss:std(0xf6f6f6, 0.6), banane:std(0xffd83a, 0.5), braun:std(0x5a3a1a, 0.8), rot:std(0xe8322a, 0.4),
  laub:new THREE.MeshPhongMaterial({ color:0xffffff, flatShading:true, shininess:0, specular:0x000000 }),
  stamm:new THREE.MeshLambertMaterial({ color:lin(0x6b4424) }),
  weissL:new THREE.MeshLambertMaterial({ color:lin(0xfafcff) }),
  bunt:new THREE.MeshLambertMaterial({ color:0xffffff }),
  itemBox:new THREE.MeshStandardMaterial({ map:boxTex, transparent:true, opacity:0.92, roughness:0.2, metalness:0.1, emissive:new THREE.Color(0x000000), side:THREE.DoubleSide, depthWrite:false }),
  flamme:new THREE.MeshBasicMaterial({ color:0xffa020, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false }),
  pad:new THREE.MeshBasicMaterial({ map:pfeilTex, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4 })
};
function teil(geo, mat, eltern, x, y, z, sx = 1, sy = 1, sz = 1){
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;
  eltern.add(m);
  return m;
}

/* =========================================================
   Kart-Modell mit Tierfahrer
   ========================================================= */
function kopfBauen(tier){
  const k = new THREE.Group();
  const M = c => std(c, 0.75);
  const augen = (y, abstand, z, r = 0.075) => { teil(GEO.kugel, MAT.auge, k, -abstand, y, z, r, r, r); teil(GEO.kugel, MAT.auge, k, abstand, y, z, r, r, r); };
  switch (tier){
    case 'loewe': {
      const fell = M(0xf2b845);
      teil(GEO.kugel, M(0xb4561c), k, 0, 0.02, -0.12, 0.82, 0.82, 0.55);
      teil(GEO.kugel, fell, k, 0, 0, 0, 0.55, 0.52, 0.52);
      teil(GEO.kugel, fell, k, -0.36, 0.42, -0.05, 0.15, 0.15, 0.1);
      teil(GEO.kugel, fell, k, 0.36, 0.42, -0.05, 0.15, 0.15, 0.1);
      teil(GEO.kugel, M(0xfff0c8), k, 0, -0.14, 0.4, 0.27, 0.19, 0.2);
      teil(GEO.kugel, M(0x5a2e1a), k, 0, -0.05, 0.58, 0.09, 0.06, 0.06);
      augen(0.13, 0.2, 0.45);
      break;
    }
    case 'fuchs': {
      const fell = M(0xe8692a);
      teil(GEO.kugel, fell, k, 0, 0, 0, 0.52, 0.5, 0.5);
      teil(GEO.kegel, fell, k, -0.28, 0.55, -0.02, 0.17, 0.4, 0.12).rotation.z = 0.3;
      teil(GEO.kegel, fell, k, 0.28, 0.55, -0.02, 0.17, 0.4, 0.12).rotation.z = -0.3;
      teil(GEO.kugel, MAT.weiss, k, 0, -0.17, 0.28, 0.42, 0.26, 0.3);
      teil(GEO.kegel, fell, k, 0, -0.08, 0.6, 0.16, 0.36, 0.14).rotation.x = Math.PI / 2;
      teil(GEO.kugel, MAT.auge, k, 0, -0.08, 0.79, 0.06, 0.06, 0.06);
      augen(0.1, 0.19, 0.43);
      break;
    }
    case 'panda': {
      const schwarz = M(0x1a1a1a);
      teil(GEO.kugel, MAT.weiss, k, 0, 0, 0, 0.55, 0.52, 0.52);
      teil(GEO.kugel, schwarz, k, -0.38, 0.42, 0, 0.18, 0.18, 0.14);
      teil(GEO.kugel, schwarz, k, 0.38, 0.42, 0, 0.18, 0.18, 0.14);
      teil(GEO.kugel, schwarz, k, -0.2, 0.06, 0.44, 0.14, 0.18, 0.08).rotation.z = -0.5;
      teil(GEO.kugel, schwarz, k, 0.2, 0.06, 0.44, 0.14, 0.18, 0.08).rotation.z = 0.5;
      teil(GEO.kugel, MAT.weiss, k, -0.2, 0.09, 0.51, 0.05, 0.05, 0.03);
      teil(GEO.kugel, MAT.weiss, k, 0.2, 0.09, 0.51, 0.05, 0.05, 0.03);
      teil(GEO.kugel, MAT.weiss, k, 0, -0.16, 0.42, 0.2, 0.15, 0.14);
      teil(GEO.kugel, schwarz, k, 0, -0.09, 0.55, 0.09, 0.06, 0.06);
      break;
    }
    case 'frosch': {
      const gruen = M(0x4cbf4a);
      teil(GEO.kugel, gruen, k, 0, 0, 0, 0.62, 0.46, 0.55);
      teil(GEO.kugel, gruen, k, -0.27, 0.36, 0.18, 0.22, 0.22, 0.22);
      teil(GEO.kugel, gruen, k, 0.27, 0.36, 0.18, 0.22, 0.22, 0.22);
      teil(GEO.kugel, MAT.weiss, k, -0.27, 0.4, 0.28, 0.16, 0.16, 0.14);
      teil(GEO.kugel, MAT.weiss, k, 0.27, 0.4, 0.28, 0.16, 0.16, 0.14);
      augen(0.41, 0.27, 0.41, 0.08);
      const rosa = M(0xff9aa8);
      teil(GEO.kugel, rosa, k, -0.42, -0.08, 0.33, 0.08, 0.06, 0.04);
      teil(GEO.kugel, rosa, k, 0.42, -0.08, 0.33, 0.08, 0.06, 0.04);
      break;
    }
    case 'hase': {
      const fell = M(0xf4eef2), rosa = M(0xf7a8c4);
      teil(GEO.kugel, fell, k, 0, 0, 0, 0.52, 0.5, 0.5);
      teil(GEO.kugel, fell, k, -0.18, 0.85, -0.05, 0.13, 0.5, 0.08).rotation.z = 0.12;
      teil(GEO.kugel, fell, k, 0.18, 0.85, -0.05, 0.13, 0.5, 0.08).rotation.z = -0.12;
      teil(GEO.kugel, rosa, k, -0.18, 0.85, 0.01, 0.08, 0.38, 0.05).rotation.z = 0.12;
      teil(GEO.kugel, rosa, k, 0.18, 0.85, 0.01, 0.08, 0.38, 0.05).rotation.z = -0.12;
      teil(GEO.kugel, MAT.weiss, k, -0.12, -0.16, 0.4, 0.15, 0.13, 0.12);
      teil(GEO.kugel, MAT.weiss, k, 0.12, -0.16, 0.4, 0.15, 0.13, 0.12);
      teil(GEO.kugel, rosa, k, 0, -0.06, 0.5, 0.07, 0.05, 0.05);
      teil(GEO.box, MAT.weiss, k, 0, -0.29, 0.44, 0.12, 0.1, 0.04);
      augen(0.12, 0.19, 0.44);
      break;
    }
    case 'pinguin': {
      teil(GEO.kugel, M(0x1d2230), k, 0, 0, 0, 0.55, 0.53, 0.52);
      teil(GEO.kugel, MAT.weiss, k, 0, -0.04, 0.18, 0.45, 0.42, 0.4);
      teil(GEO.kegel, M(0xff9a1a), k, 0, -0.1, 0.66, 0.1, 0.26, 0.07).rotation.x = Math.PI / 2;
      augen(0.1, 0.16, 0.54, 0.065);
      break;
    }
    case 'baer': {
      const braun = M(0x8a5a36), hell = M(0xd9b38c);
      teil(GEO.kugel, braun, k, 0, 0, 0, 0.55, 0.52, 0.52);
      teil(GEO.kugel, braun, k, -0.38, 0.42, 0, 0.17, 0.17, 0.12);
      teil(GEO.kugel, braun, k, 0.38, 0.42, 0, 0.17, 0.17, 0.12);
      teil(GEO.kugel, hell, k, -0.38, 0.42, 0.06, 0.1, 0.1, 0.07);
      teil(GEO.kugel, hell, k, 0.38, 0.42, 0.06, 0.1, 0.1, 0.07);
      teil(GEO.kugel, hell, k, 0, -0.14, 0.42, 0.25, 0.18, 0.18);
      teil(GEO.kugel, MAT.auge, k, 0, -0.07, 0.58, 0.09, 0.06, 0.06);
      augen(0.13, 0.19, 0.45);
      break;
    }
    case 'katze': {
      const fell = M(0x9aa0aa), rosa = M(0xf7a8c4);
      teil(GEO.kugel, fell, k, 0, 0, 0, 0.55, 0.5, 0.5);
      teil(GEO.kegel, fell, k, -0.3, 0.5, 0, 0.18, 0.32, 0.12).rotation.z = 0.35;
      teil(GEO.kegel, fell, k, 0.3, 0.5, 0, 0.18, 0.32, 0.12).rotation.z = -0.35;
      teil(GEO.kegel, rosa, k, -0.29, 0.49, 0.05, 0.1, 0.2, 0.05).rotation.z = 0.35;
      teil(GEO.kegel, rosa, k, 0.29, 0.49, 0.05, 0.1, 0.2, 0.05).rotation.z = -0.35;
      teil(GEO.kugel, MAT.weiss, k, 0, -0.15, 0.4, 0.23, 0.14, 0.15);
      teil(GEO.kugel, rosa, k, 0, -0.07, 0.52, 0.06, 0.045, 0.045);
      augen(0.12, 0.2, 0.44);
      break;
    }
    case 'affe': {
      const fell = M(0x6b4226), haut = M(0xe8c39e);
      teil(GEO.kugel, fell, k, 0, 0, 0, 0.54, 0.52, 0.5);
      teil(GEO.kugel, fell, k, 0, 0.5, -0.05, 0.12, 0.14, 0.1);
      // grosse Ohren seitlich
      teil(GEO.kugel, fell, k, -0.55, 0.05, -0.02, 0.2, 0.22, 0.1);
      teil(GEO.kugel, fell, k, 0.55, 0.05, -0.02, 0.2, 0.22, 0.1);
      teil(GEO.kugel, haut, k, -0.57, 0.05, 0.04, 0.12, 0.14, 0.06);
      teil(GEO.kugel, haut, k, 0.57, 0.05, 0.04, 0.12, 0.14, 0.06);
      // Gesicht: Herzform aus zwei Augenfeldern und Schnauze
      teil(GEO.kugel, haut, k, -0.17, 0.1, 0.34, 0.2, 0.22, 0.16);
      teil(GEO.kugel, haut, k, 0.17, 0.1, 0.34, 0.2, 0.22, 0.16);
      teil(GEO.kugel, haut, k, 0, -0.17, 0.36, 0.3, 0.21, 0.2);
      teil(GEO.kugel, MAT.auge, k, -0.06, -0.08, 0.55, 0.03, 0.03, 0.03);
      teil(GEO.kugel, MAT.auge, k, 0.06, -0.08, 0.55, 0.03, 0.03, 0.03);
      teil(GEO.box, M(0x7a3b2a), k, 0, -0.24, 0.54, 0.16, 0.035, 0.04);
      augen(0.13, 0.17, 0.47);
      break;
    }
  }
  return k;
}

function kartModell(f){
  const g = new THREE.Group();
  const koerper = new THREE.Group();
  g.add(koerper);
  const lack = new THREE.MeshPhysicalMaterial({ color:lin(f.farbe), roughness:0.28, metalness:0.3, clearcoat:0.85, clearcoatRoughness:0.22, envMapIntensity:0.8 });
  const anzug = new THREE.MeshStandardMaterial({ color:new THREE.Color(f.farbe).lerp(new THREE.Color(0xffffff), 0.5).convertSRGBToLinear(), roughness:0.7 });
  teil(GEO.box, MAT.dunkel, koerper, 0, 0.42, 0, 1.7, 0.18, 3.1);
  teil(GEO.box, lack, koerper, 0, 0.68, -0.15, 1.5, 0.42, 2.1);
  teil(GEO.box, lack, koerper, 0, 0.6, 1.25, 1.2, 0.3, 1.0);
  teil(GEO.box, MAT.dunkel, koerper, 0, 0.38, 1.85, 2.0, 0.14, 0.4);
  teil(GEO.box, lack, koerper, -0.95, 0.58, -0.1, 0.45, 0.36, 1.5);
  teil(GEO.box, lack, koerper, 0.95, 0.58, -0.1, 0.45, 0.36, 1.5);
  teil(GEO.box, MAT.dunkel, koerper, 0, 1.15, -0.75, 1.0, 0.75, 0.22);
  teil(GEO.box, MAT.metall, koerper, 0, 0.95, -1.3, 0.9, 0.45, 0.55);
  teil(GEO.zyl, MAT.metall, koerper, -0.3, 0.95, -1.65, 0.1, 0.5, 0.1).rotation.x = Math.PI / 2;
  teil(GEO.zyl, MAT.metall, koerper, 0.3, 0.95, -1.65, 0.1, 0.5, 0.1).rotation.x = Math.PI / 2;
  teil(GEO.box, lack, koerper, 0, 1.45, -1.55, 2.0, 0.1, 0.5);
  teil(GEO.box, MAT.dunkel, koerper, -0.6, 1.2, -1.5, 0.1, 0.45, 0.12);
  teil(GEO.box, MAT.dunkel, koerper, 0.6, 1.2, -1.5, 0.1, 0.45, 0.12);
  teil(GEO.lenkrad, MAT.dunkel, koerper, 0, 1.12, 0.45).rotation.x = -0.6;
  // Runde Kotfluegel, Zierstreifen und Leuchten geben dem Kart mehr Tiefe.
  for (const x of [-0.96, 0.96]){
    teil(GEO.kugel, lack, koerper, x, 0.77, -1.02, 0.4, 0.2, 0.64);
    teil(GEO.box, MAT.licht, koerper, x * 0.58, 0.69, 1.74, 0.3, 0.11, 0.07).castShadow = false;
    teil(GEO.box, MAT.ruecklicht, koerper, x * 0.62, 0.7, -1.24, 0.25, 0.1, 0.08).castShadow = false;
  }
  for (const x of [-0.16, 0.16]) teil(GEO.box, MAT.weiss, koerper, x, 0.757, 1.35, 0.09, 0.015, 0.73).castShadow = false;
  const kontakt = new THREE.Mesh(GEO.schatten, MAT.kontakt);
  kontakt.rotation.x = -Math.PI / 2; kontakt.position.y = 0.09;
  g.add(kontakt);
  // Fahrer
  teil(GEO.kugel, anzug, koerper, 0, 1.25, -0.35, 0.5, 0.55, 0.42);
  teil(GEO.zyl, anzug, koerper, -0.33, 1.22, 0.08, 0.1, 0.55, 0.1).rotation.x = 1.2;
  teil(GEO.zyl, anzug, koerper, 0.33, 1.22, 0.08, 0.1, 0.55, 0.1).rotation.x = 1.2;
  const kopf = kopfBauen(f.tier);
  kopf.position.set(0, 1.95, -0.3);
  koerper.add(kopf);
  // Räder
  const raeder = [], vorne = [];
  [[-1.0, 0.46, 1.05, GEO.rad, true], [1.0, 0.46, 1.05, GEO.rad, true], [-1.0, 0.52, -1.05, GEO.radHinten, false], [1.0, 0.52, -1.05, GEO.radHinten, false]]
    .forEach(([x, y, z, geo, istVorne]) => {
      const halter = new THREE.Group();
      halter.position.set(x, y, z);
      g.add(halter);
      const r = new THREE.Mesh(geo, MAT.reifen);
      r.rotation.z = Math.PI / 2; r.castShadow = true;
      halter.add(r);
      const felge = new THREE.Mesh(GEO.zyl, lack);
      felge.scale.set(0.24, istVorne ? 0.44 : 0.52, 0.24);
      r.add(felge);
      const speiche = new THREE.Mesh(GEO.box, MAT.metall);
      speiche.scale.set(0.42, istVorne ? 0.45 : 0.53, 0.08);
      r.add(speiche);
      raeder.push(r);
      if (istVorne) vorne.push(halter);
    });
  // Turbo-Flammen
  const flammen = [-0.3, 0.3].map(x => {
    const fl = new THREE.Mesh(GEO.kegel, MAT.flamme);
    fl.position.set(x, 0.95, -2.1); fl.rotation.x = -Math.PI / 2; fl.scale.set(0.16, 0.7, 0.16); fl.visible = false;
    koerper.add(fl);
    return fl;
  });
  g.scale.setScalar(0.95);
  return { gruppe:g, koerper, raeder, vorne, kopf, flammen, lack, anzug, kontakt };
}

/* =========================================================
   Partikel (Funken, Staub, Explosionen)
   ========================================================= */
class Partikel {
  constructor(max, additiv){
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.farbe = new Float32Array(max * 4); this.gr = new Float32Array(max);
    this.v = new Float32Array(max * 3); this.leben = new Float32Array(max); this.maxLeben = new Float32Array(max);
    this.grav = new Float32Array(max); this.wachs = new Float32Array(max); this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aFarbe = new THREE.BufferAttribute(this.farbe, 4).setUsage(THREE.DynamicDrawUsage);
    this.aGr = new THREE.BufferAttribute(this.gr, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('farbe', this.aFarbe); g.setAttribute('groesse', this.aGr);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms:{ tex:{ value:partikelTex }, skala:{ value:400 } },
      vertexShader:'attribute vec4 farbe;\nattribute float groesse;\nuniform float skala;\nvarying vec4 vF;\nvoid main(){ vF = farbe; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = groesse * skala / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader:'uniform sampler2D tex;\nvarying vec4 vF;\nvoid main(){ float a = texture2D(tex, gl_PointCoord).a * vF.a; if (a < 0.01) discard; gl_FragColor = vec4(vF.rgb, a); }',
      transparent:true, depthWrite:false, blending:additiv ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.punkte = new THREE.Points(g, this.mat);
    this.punkte.frustumCulled = false;
    this.punkte.renderOrder = 5;
    scene.add(this.punkte);
  }
  neu(x, y, z, vx, vy, vz, leben, r, gg, b, groesse, grav = 0, wachs = 0, alpha = 1){
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3); this.farbe.set([r, gg, b, alpha], i * 4);
    this.gr[i] = groesse; this.leben[i] = this.maxLeben[i] = leben; this.grav[i] = grav; this.wachs[i] = wachs; this.a0[i] = alpha;
  }
  kopieren(von, nach){
    this.pos.copyWithin(nach * 3, von * 3, von * 3 + 3); this.v.copyWithin(nach * 3, von * 3, von * 3 + 3);
    this.farbe.copyWithin(nach * 4, von * 4, von * 4 + 4);
    this.gr[nach] = this.gr[von]; this.leben[nach] = this.leben[von]; this.maxLeben[nach] = this.maxLeben[von];
    this.grav[nach] = this.grav[von]; this.wachs[nach] = this.wachs[von]; this.a0[nach] = this.a0[von];
  }
  update(dt){
    let i = 0;
    while (i < this.n){
      this.leben[i] -= dt;
      if (this.leben[i] <= 0){ this.n--; if (i < this.n) this.kopieren(this.n, i); continue; }
      const p = i * 3;
      this.v[p + 1] -= this.grav[i] * dt;
      this.pos[p] += this.v[p] * dt; this.pos[p + 1] += this.v[p + 1] * dt; this.pos[p + 2] += this.v[p + 2] * dt;
      if (this.pos[p + 1] < 0.05){ this.pos[p + 1] = 0.05; this.v[p + 1] *= -0.3; }
      this.gr[i] += this.wachs[i] * dt;
      this.farbe[i * 4 + 3] = this.a0[i] * Math.min(1, this.leben[i] / this.maxLeben[i] * 1.5);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aFarbe.needsUpdate = this.aGr.needsUpdate = true;
  }
  leeren(){ this.n = 0; this.geo.setDrawRange(0, 0); }
}
const funken = new Partikel(1400, true);
const staub = new Partikel(900, false);
function explosion(x, y, z, anzahl = 40){
  for (let n = 0; n < anzahl; n++){
    const w = Math.random() * TAU, s = zufall(4, 14);
    funken.neu(x, y, z, Math.cos(w) * s, zufall(2, 10), Math.sin(w) * s, zufall(0.4, 0.8), 1, zufall(0.4, 0.8), 0.15, zufall(0.5, 1.1), 14);
  }
  for (let n = 0; n < anzahl / 2; n++){
    staub.neu(x + zufall(-1, 1), y, z + zufall(-1, 1), zufall(-2, 2), zufall(1, 4), zufall(-2, 2), zufall(0.8, 1.4), 0.35, 0.33, 0.32, 1.2, -1, 2.5, 0.7);
  }
}
function buntStoss(x, y, z){
  for (let n = 0; n < 30; n++){
    const w = Math.random() * TAU, s = zufall(3, 9), c = new THREE.Color().setHSL(Math.random(), 1, 0.6);
    funken.neu(x, y, z, Math.cos(w) * s, zufall(2, 8), Math.sin(w) * s, zufall(0.4, 0.7), c.r, c.g, c.b, zufall(0.4, 0.8), 12);
  }
}

/* =========================================================
   Ton: alles mit WebAudio synthetisiert
   ========================================================= */
const Ton = (() => {
  let ctx = null, master, sfx, musikBus, rauschen, motorOsc1, motorOsc2, motorFilter, motorGain, driftGain, driftFilter;
  let an = lesen('ton', true), lied = null, schritt = 0, naechste = 0;
  const note = m => 440 * Math.pow(2, (m - 69) / 12);
  const LIEDER = {
    menue:  { bpm:112, akkorde:[[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]] },
    wiese:  { bpm:140, akkorde:[[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]] },
    wueste: { bpm:128, akkorde:[[62, 65, 69], [60, 64, 67], [58, 62, 65], [57, 61, 64]] },
    frost:  { bpm:134, akkorde:[[53, 57, 60], [62, 65, 69], [58, 62, 65], [60, 64, 67]] }
  };
  const MELODIE = [0, -1, 2, -1, 1, -1, 2, 3, -1, 2, -1, 1, 0, -1, -1, -1];

  function start(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = an ? 0.8 : 0; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    musikBus = ctx.createGain(); musikBus.gain.value = 0.28; musikBus.connect(master);
    rauschen = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = rauschen.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Motor
    motorGain = ctx.createGain(); motorGain.gain.value = 0;
    motorFilter = ctx.createBiquadFilter(); motorFilter.type = 'lowpass'; motorFilter.frequency.value = 600;
    motorOsc1 = ctx.createOscillator(); motorOsc1.type = 'sawtooth'; motorOsc1.frequency.value = 50;
    motorOsc2 = ctx.createOscillator(); motorOsc2.type = 'square'; motorOsc2.frequency.value = 25;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    motorOsc1.connect(motorFilter); motorOsc2.connect(g2); g2.connect(motorFilter);
    motorFilter.connect(motorGain); motorGain.connect(sfx);
    motorOsc1.start(); motorOsc2.start();
    // Drift-Quietschen
    const dq = ctx.createBufferSource(); dq.buffer = rauschen; dq.loop = true;
    driftFilter = ctx.createBiquadFilter(); driftFilter.type = 'bandpass'; driftFilter.frequency.value = 1800; driftFilter.Q.value = 5;
    driftGain = ctx.createGain(); driftGain.gain.value = 0;
    dq.connect(driftFilter); driftFilter.connect(driftGain); driftGain.connect(sfx); dq.start();
    naechste = ctx.currentTime + 0.1;
    setInterval(planen, 30);
  }
  function ton(freq, dauer, typ = 'square', laut = 0.2, zu = null, wann = 0, ziel = sfx){
    if (!ctx) return;
    const t = ctx.currentTime + wann;
    const o = ctx.createOscillator(); o.type = typ; o.frequency.setValueAtTime(freq, t);
    if (zu) o.frequency.exponentialRampToValueAtTime(zu, t + dauer);
    const g = ctx.createGain(); g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    o.connect(g); g.connect(ziel); o.start(t); o.stop(t + dauer + 0.02);
  }
  function geraeusch(dauer, freq, laut, wann = 0, typ = 'bandpass', ziel = sfx, q = 1){
    if (!ctx) return;
    const t = ctx.currentTime + wann;
    const s = ctx.createBufferSource(); s.buffer = rauschen;
    const f = ctx.createBiquadFilter(); f.type = typ; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    s.connect(f); f.connect(g); g.connect(ziel); s.start(t, Math.random() * 0.5); s.stop(t + dauer + 0.02);
  }
  const effekte = {
    piep:() => ton(440, 0.28, 'square', 0.16),
    los:() => { ton(880, 0.7, 'square', 0.17); ton(1320, 0.7, 'triangle', 0.1); },
    box:() => [700, 1000].forEach((f, i) => ton(f, 0.08, 'triangle', 0.14, null, i * 0.04)),
    tick:() => ton(1400, 0.03, 'square', 0.04),
    item:() => [660, 880, 1175].forEach((f, i) => ton(f, 0.12, 'triangle', 0.16, null, i * 0.06)),
    boost:() => { geraeusch(0.55, 1100, 0.3, 0, 'bandpass', sfx, 0.8); ton(180, 0.5, 'sawtooth', 0.09, 520); },
    treffer:() => { ton(620, 0.7, 'square', 0.14, 80); geraeusch(0.35, 500, 0.3); },
    wand:() => geraeusch(0.18, 300, 0.4, 0, 'lowpass'),
    stoss:() => { geraeusch(0.12, 700, 0.25); ton(160, 0.1, 'square', 0.08, 90); },
    banane:() => ton(320, 0.16, 'triangle', 0.16, 160),
    rakete:() => { geraeusch(0.6, 1600, 0.22); ton(300, 0.5, 'sawtooth', 0.06, 900); },
    explosion:() => { geraeusch(0.7, 260, 0.5, 0, 'lowpass'); ton(90, 0.5, 'sine', 0.3, 40); },
    stern:() => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => ton(f, 0.1, 'square', 0.1, null, i * 0.07)),
    runde:() => [523, 659, 784].forEach((f, i) => ton(f, 0.16, 'square', 0.12, null, i * 0.1)),
    letzte:() => [784, 784, 784, 1047].forEach((f, i) => ton(f, i === 3 ? 0.4 : 0.12, 'square', 0.13, null, i * 0.13)),
    ziel:() => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => ton(f, i === 5 ? 0.8 : 0.16, 'square', 0.14, null, [0, .12, .24, .36, .6, .72][i])),
    klick:() => ton(900, 0.05, 'triangle', 0.08)
  };
  function planen(){
    if (!ctx || !lied || ctx.state !== 'running') return;
    const achtel = 60 / lied.bpm / 2 / 2;
    while (naechste < ctx.currentTime + 0.15){
      schrittSpielen(schritt, naechste, achtel);
      naechste += achtel;
      schritt = (schritt + 1) % 64;
    }
  }
  function schrittSpielen(s, t, l){
    const akk = lied.akkorde[Math.floor(s / 16)], b = s % 16, w = t - ctx.currentTime;
    if (b % 4 === 0) ton(note(akk[0] - 24), l * 3, 'triangle', 0.5, null, w, musikBus);
    if (b === 6 || b === 14) ton(note(akk[0] - 12), l * 1.5, 'triangle', 0.35, null, w, musikBus);
    if (b % 2 === 0) ton(note(akk[(b / 2) % 3] + 12), l * 1.6, 'square', 0.05, null, w, musikBus);
    const m = MELODIE[b];
    if (m >= 0 && lied !== LIEDER.menue) ton(note(akk[m % 3] + 24 + (m === 3 ? 2 : 0)), l * 1.8, 'triangle', 0.12, null, w, musikBus);
    if (b % 4 === 2) geraeusch(0.05, 8000, 0.12, w, 'highpass', musikBus);
    if (b % 8 === 0) ton(130, 0.18, 'sine', 0.55, 40, w, musikBus);
    if (b === 4 || b === 12) geraeusch(0.12, 1800, 0.18, w, 'bandpass', musikBus);
  }
  return {
    start,
    effekt(n){ if (ctx && effekte[n]) effekte[n](); },
    musik(name){ const neu = LIEDER[name] || null; if (neu !== lied){ lied = neu; schritt = 0; if (ctx) naechste = ctx.currentTime + 0.1; } },
    motor(v, boost, aktiv){
      if (!ctx) return;
      const t = ctx.currentTime, f = 42 + Math.abs(v) * 3.3 + (boost ? 30 : 0);
      motorOsc1.frequency.setTargetAtTime(f, t, 0.06); motorOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      motorFilter.frequency.setTargetAtTime(420 + Math.abs(v) * 38, t, 0.1);
      motorGain.gain.setTargetAtTime(aktiv ? 0.055 : 0, t, 0.12);
    },
    drift(stufe){
      if (!ctx) return;
      const t = ctx.currentTime;
      driftGain.gain.setTargetAtTime(stufe >= 0 ? 0.03 : 0, t, 0.05);
      driftFilter.frequency.setTargetAtTime(1500 + Math.max(0, stufe) * 350, t, 0.1);
    },
    pause(p){ if (ctx){ if (p) ctx.suspend(); else ctx.resume(); } },
    umschalten(){ an = !an; schreiben('ton', an); if (master) master.gain.value = an ? 0.8 : 0; return an; },
    istAn:() => an
  };
})();

/* =========================================================
   Eingabe: Tastatur, Gamepad, Touch
   ========================================================= */
const tasten = new Set();
const touch = { lenk:0, drift:false, bremse:false };
const touchModus = matchMedia('(pointer: coarse)').matches;
let tastaturBenutzt = !touchModus, itemGedrueckt = false, padItemVorher = false, padPauseVorher = false;
const TASTE = {
  gas:['ArrowUp', 'KeyW'], bremse:['ArrowDown', 'KeyS'], links:['ArrowLeft', 'KeyA'], rechts:['ArrowRight', 'KeyD'],
  drift:['Space', 'ShiftLeft', 'ShiftRight'], item:['KeyE', 'ControlLeft', 'ControlRight', 'KeyX']
};
const gedrueckt = art => TASTE[art].some(t => tasten.has(t));
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  Ton.start();
  if (zustand.phase !== 'menue' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  tasten.add(e.code);
  if (zustand.phase !== 'menue') tastaturBenutzt = true;
  if (TASTE.item.includes(e.code)) itemGedrueckt = true;
  if (e.code === 'Escape' || e.code === 'KeyP') pauseUmschalten();
  if (e.code === 'KeyM') tonUmschalten();
});
addEventListener('keyup', e => tasten.delete(e.code));
function eingabenLeeren(){
  tasten.clear(); itemGedrueckt = false; padItemVorher = false; padPauseVorher = false;
  zeiger.clear(); touchAuswerten();
}
addEventListener('blur', () => { eingabenLeeren(); if (!online.aktiv && ['countdown', 'rennen'].includes(zustand.phase) && !zustand.pause) pauseUmschalten(); });
addEventListener('pointerdown', () => Ton.start(), { once:false });
addEventListener('gamepaddisconnected', eingabenLeeren);
document.addEventListener('visibilitychange', () => { if (document.hidden){ eingabenLeeren(); if (!online.aktiv && ['countdown','rennen'].includes(zustand.phase) && !zustand.pause) pauseUmschalten(); } });

// Touch: Die ganze Fläche nimmt die Finger an. Jeder Finger links ist Lenken (analog, je weiter
// von der Mitte des Lenkbalkens, desto stärker), rechts gilt der nächstgelegene Knopf. So kann der
// Daumen zwischen DRIFT und BREMSE rutschen, ohne dass ein Knopf „hängen“ bleibt.
const touchFlaeche = $('touch');
const zeiger = new Map();
const KNOEPFE = ['tDrift', 'tBremse', 'tItem'];
function knopfBei(x, y){
  let best = null, bestAbstand = 1.35;
  for (const id of KNOEPFE){
    const r = $(id).getBoundingClientRect(), rad = r.width / 2;
    if (!rad) continue;
    const d = Math.hypot(x - r.left - rad, y - r.top - r.height / 2) / rad;
    if (d < bestAbstand){ bestAbstand = d; best = id; }
  }
  return best;
}
function touchAuswerten(){
  const lenkEl = $('tLenk'), r = lenkEl.getBoundingClientRect();
  const weg = Math.max(40, r.width * 0.34), knopfWeg = Math.max(0, r.width / 2 - 40);
  let lenk = 0, lenkFinger = false, knopfX = 0;
  touch.drift = touch.bremse = false;
  for (const z of zeiger.values()){
    if (z.art === 'lenk'){
      const dx = z.x - (r.left + r.width / 2);
      lenk = -Math.sign(dx) * klemm((Math.abs(dx) - 10) / weg, 0, 1) ** 1.25;
      lenkFinger = true; knopfX = klemm(dx, -knopfWeg, knopfWeg);
    }
    else if (z.knopf === 'tDrift') touch.drift = true;
    else if (z.knopf === 'tBremse') touch.bremse = true;
  }
  touch.lenk = lenk;
  lenkEl.classList.toggle('an', lenkFinger);
  lenkEl.style.setProperty('--x', knopfX + 'px');
  $('tDrift').classList.toggle('an', touch.drift);
  $('tBremse').classList.toggle('an', touch.bremse);
  $('tItem').classList.toggle('an', [...zeiger.values()].some(z => z.knopf === 'tItem'));
}
touchFlaeche.addEventListener('pointerdown', e => {
  e.preventDefault(); Ton.start(); tastaturBenutzt = false;
  try { touchFlaeche.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
  const lr = $('tLenk').getBoundingClientRect();
  const z = { x:e.clientX, y:e.clientY, art:e.clientX < lr.right + 24 ? 'lenk' : 'knopf', knopf:null };
  if (z.art === 'knopf'){ z.knopf = knopfBei(z.x, z.y); if (z.knopf === 'tItem') itemGedrueckt = true; }
  zeiger.set(e.pointerId, z);
  touchAuswerten();
});
touchFlaeche.addEventListener('pointermove', e => {
  const z = zeiger.get(e.pointerId);
  if (!z) return;
  z.x = e.clientX; z.y = e.clientY;
  // Beim Rutschen wechseln nur DRIFT und BREMSE, Items gibt es nur per Antippen
  if (z.art === 'knopf'){ const neu = knopfBei(z.x, z.y); z.knopf = neu === 'tItem' && z.knopf !== 'tItem' ? null : neu; }
  touchAuswerten();
});
const zeigerWeg = e => { if (zeiger.delete(e.pointerId)) touchAuswerten(); };
for (const typ of ['pointerup', 'pointercancel', 'lostpointercapture']) touchFlaeche.addEventListener(typ, zeigerWeg);
touchFlaeche.addEventListener('contextmenu', e => e.preventDefault());
// iOS ignoriert user-scalable=no: Zoom-Gesten selbst abfangen
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
if (touchModus) document.body.classList.add('touch');
const vibrieren = ms => { if (touchModus && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(ms); } catch (e) { /* egal */ } };
// Auf Handys beim Rennstart Vollbild und Querformat versuchen (klappt nur nach einem Tipp, nicht auf dem iPhone)
function vollbild(){
  const el = document.documentElement;
  if (!touchModus || document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI:'hide' })
    .then(() => screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null)
    .catch(() => {});
}

function spielerEingabe(){
  const e = { gas:false, bremse:false, lenk:0, drift:false, item:false };
  e.gas = gedrueckt('gas');
  e.bremse = gedrueckt('bremse');
  e.lenk = (gedrueckt('links') ? 1 : 0) - (gedrueckt('rechts') ? 1 : 0);
  e.drift = gedrueckt('drift');
  // Touch: Gas geht automatisch, im Countdown gibt DRIFT Gas (für den Starttrick)
  if (touchModus && !tastaturBenutzt){
    if (zustand.phase === 'countdown') e.gas = touch.drift;
    else { e.gas = !touch.bremse; e.bremse = touch.bremse; }
  }
  if (touch.lenk) e.lenk = touch.lenk;
  if (touch.drift) e.drift = true;
  // Gamepad
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads){
    if (!p) continue;
    const knopf = i => p.buttons[i] && p.buttons[i].pressed;
    const achse = p.axes[0] || 0;
    if (Math.abs(achse) > 0.15) e.lenk = -Math.sign(achse) * Math.min(1, (Math.abs(achse) - 0.15) / 0.85);
    if (knopf(14)) e.lenk = 1; if (knopf(15)) e.lenk = -1;
    if (knopf(0) || knopf(7)) e.gas = true;
    if (knopf(1) || knopf(2)) e.bremse = true;
    if (knopf(5) || knopf(6)) e.drift = true;
    const it = knopf(4) || knopf(3);
    if (it && !padItemVorher) itemGedrueckt = true;
    padItemVorher = it;
    const pz = knopf(9);
    if (pz && !padPauseVorher && zustand.phase !== 'menue') pauseUmschalten();
    padPauseVorher = pz;
    break;
  }
  e.item = itemGedrueckt;
  itemGedrueckt = false;
  return e;
}

/* =========================================================
   Strecke: Mittellinie, Straße, Deko
   ========================================================= */
let strecke = null;

function streckeRechnen(def){
  const pts = def.punkte.map(([x, z]) => new THREE.Vector3(x * def.skala, 0, z * def.skala));
  const kurve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const L = kurve.getLength();
  const N = Math.round(L);
  const sp = kurve.getSpacedPoints(N);
  const S = {
    def, N, L, ds:L / N, hw:def.breite / 2, auslauf:7,
    px:new Float32Array(N), pz:new Float32Array(N), tx:new Float32Array(N), tz:new Float32Array(N), kurv:new Float32Array(N),
    minX:Infinity, maxX:-Infinity, minZ:Infinity, maxZ:-Infinity
  };
  for (let i = 0; i < N; i++){
    S.px[i] = sp[i].x; S.pz[i] = sp[i].z;
    S.minX = Math.min(S.minX, sp[i].x); S.maxX = Math.max(S.maxX, sp[i].x);
    S.minZ = Math.min(S.minZ, sp[i].z); S.maxZ = Math.max(S.maxZ, sp[i].z);
  }
  for (let i = 0; i < N; i++){
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    const dx = S.px[b] - S.px[a], dz = S.pz[b] - S.pz[a], l = Math.hypot(dx, dz) || 1;
    S.tx[i] = dx / l; S.tz[i] = dz / l;
  }
  const k = Math.max(1, Math.round(8 / S.ds));
  for (let i = 0; i < N; i++){
    const j = (i + k) % N;
    S.kurv[i] = winkelDiff(Math.atan2(S.tx[j], S.tz[j]), Math.atan2(S.tx[i], S.tz[i])) / (k * S.ds);
  }
  return S;
}
function naechster(S, x, z, start){
  let best = start, bd = Infinity;
  for (let k = -25; k <= 45; k++){
    const i = (start + k + S.N) % S.N;
    const dx = x - S.px[i], dz = z - S.pz[i], d = dx * dx + dz * dz;
    if (d < bd){ bd = d; best = i; }
  }
  return best;
}
function naechsterGlobal(S, x, z){
  let best = 0, bd = Infinity;
  for (let i = 0; i < S.N; i++){ const dx = x - S.px[i], dz = z - S.pz[i], d = dx * dx + dz * dz; if (d < bd){ bd = d; best = i; } }
  return best;
}
const idxBei = (S, s) => ((Math.round(s / S.ds) % S.N) + S.N) % S.N;
const punktBei = (S, i, seite) => [S.px[i] + S.tz[i] * seite, S.pz[i] - S.tx[i] * seite];
const yawBei = (S, i) => Math.atan2(S.tx[i], S.tz[i]);

// Ein Band entlang der Strecke zwischen zwei seitlichen Abständen (links > rechts)
function band(S, links, rechts, y, vLaenge, mat){
  const n = S.N + 1;
  const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), nor = new Float32Array(n * 6);
  for (let j = 0; j < n; j++){
    const i = j % S.N, lx = S.tz[i], lz = -S.tx[i];
    pos.set([S.px[i] + lx * links, y, S.pz[i] + lz * links, S.px[i] + lx * rechts, y, S.pz[i] + lz * rechts], j * 6);
    const v = j * S.ds / vLaenge;
    uv.set([0, v, 1, v], j * 4);
    nor.set([0, 1, 0, 0, 1, 0], j * 6);
  }
  const index = [];
  for (let j = 0; j < S.N; j++){ const a = 2 * j, b = a + 1, c = a + 2, d = a + 3; index.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(index);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// Sammelt viele gleiche Teile und baut daraus InstancedMeshes
class Instanzen {
  constructor(){ this.teile = new Map(); }
  add(schluessel, geo, mat, p, s, r = [0, 0, 0], c = null){
    let t = this.teile.get(schluessel);
    if (!t){ t = { geo, mat, liste:[] }; this.teile.set(schluessel, t); }
    t.liste.push({ p, s, r, c });
  }
  bauen(gruppe, schatten = true){
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), weiss = new THREE.Color(1, 1, 1);
    for (const t of this.teile.values()){
      const im = new THREE.InstancedMesh(t.geo, t.mat, t.liste.length);
      const mitFarbe = t.liste.some(d => d.c);
      t.liste.forEach((d, i) => {
        p.set(...d.p); s.set(...d.s); e.set(...d.r); q.setFromEuler(e); m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
        if (mitFarbe) im.setColorAt(i, d.c || weiss);
      });
      im.castShadow = schatten; im.receiveShadow = false; im.frustumCulled = false;
      gruppe.add(im);
    }
  }
}

function entsorgen(obj){
  obj.traverse(o => {
    if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose();
    if (o.material){
      for (const m of [].concat(o.material)){
        if (Object.values(MAT).includes(m)) continue;
        if (m.map && m.map !== boxTex && m.map !== pfeilTex) m.map.dispose();
        m.dispose();
      }
    }
  });
}

function streckeLaden(nr){
  if (strecke && strecke.nr === nr) return strecke;
  if (strecke){ scene.remove(strecke.gruppe); entsorgen(strecke.gruppe); if (strecke.schnee){ scene.remove(strecke.schnee); strecke.schnee.geometry.dispose(); } }
  const def = STRECKEN[nr], th = THEMEN[def.thema];
  const S = streckeRechnen(def);
  S.nr = nr; S.th = th;
  const gruppe = new THREE.Group();
  S.gruppe = gruppe;
  scene.add(gruppe);
  const rnd = zufallsGen(def.saat);

  // Himmel, Licht, Nebel
  umgebungBauen(th);
  himmelUni.oben.value = lin(th.himmel[0]); himmelUni.horizont.value = lin(th.himmel[1]);
  scene.fog = new THREE.Fog(lin(th.nebel), th.nebelWeit[0], th.nebelWeit[1]);
  hemi.color = lin(th.hemi[0]); hemi.groundColor = lin(th.hemi[1]); hemi.intensity = th.hemiKraft;
  sonne.color = lin(th.sonne); sonne.intensity = th.sonnenKraft;

  // Boden
  const grasTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = th.gras[0]; c.fillRect(0, 0, w, h);
    for (let n = 0; n < 90; n++){
      c.fillStyle = th.gras[1 + (n % 2)]; c.globalAlpha = 0.35;
      c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 22, 0, TAU); c.fill();
    }
    c.globalAlpha = 1; koernung(c, w, h, 2500, 0.08);
  }, true);
  grasTex.repeat.set(160, 160);
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map:grasTex }));
  boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true;
  gruppe.add(boden);

  // Auslaufzone, Randsteine, Straße
  const auslaufTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = th.auslauf; c.fillRect(0, 0, w, h); koernung(c, w, h, 3000, 0.18); }, true);
  const auslaufMat = new THREE.MeshLambertMaterial({ map:auslaufTex, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  gruppe.add(band(S, S.hw + S.auslauf + 0.8, S.hw + 1.2, 0.02, 10, auslaufMat));
  gruppe.add(band(S, -S.hw - 1.2, -S.hw - S.auslauf - 0.8, 0.02, 10, auslaufMat));
  const [wandA, wandB] = th.wand;
  const randTex = canvasTex(16, 64, (c, w, h) => { c.fillStyle = cssFarbe(wandA); c.fillRect(0, 0, w, h / 2); c.fillStyle = cssFarbe(wandB); c.fillRect(0, h / 2, w, h / 2); }, true);
  const randMat = new THREE.MeshLambertMaterial({ map:randTex, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3 });
  gruppe.add(band(S, S.hw + 1.4, S.hw - 0.1, 0.05, 4, randMat));
  gruppe.add(band(S, -S.hw + 0.1, -S.hw - 1.4, 0.05, 4, randMat));
  const strasseTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = th.strasse; c.fillRect(0, 0, w, h);
    koernung(c, w, h, 9000, 0.09);
    c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(w * 0.25, 0, w * 0.12, h); c.fillRect(w * 0.63, 0, w * 0.12, h);
    c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(12, 0, 7, h); c.fillRect(w - 19, 0, 7, h);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(w / 2 - 3, 0, 6, h * 0.42);
  }, true);
  const strasseMat = new THREE.MeshStandardMaterial({ map:strasseTex, roughness:th.schnee ? 0.58 : 0.92, metalness:0.02, envMapIntensity:0.25, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
  gruppe.add(band(S, S.hw, -S.hw, 0.04, 22, strasseMat));

  // Startlinie
  const karoTex = canvasTex(128, 32, (c, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++){ c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 8, y * 8, 8, 8); } });
  const linie = new THREE.Mesh(new THREE.PlaneGeometry(S.hw * 2, 2.4), new THREE.MeshLambertMaterial({ map:karoTex, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4 }));
  linie.position.set(S.px[0], 0.07, S.pz[0]); linie.receiveShadow = true;
  linie.rotation.order = 'YXZ'; linie.rotation.set(-Math.PI / 2, yawBei(S, 0), 0);
  gruppe.add(linie);

  // Starttor mit Banner
  const tor = new THREE.Group();
  tor.position.set(S.px[0], 0, S.pz[0]); tor.rotation.y = yawBei(S, 0);
  const bannerTex = canvasTex(1024, 160, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffd23f'); g.addColorStop(1, '#ff8a1a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let x = 0; x < 6; x++) for (let y = 0; y < 5; y++){ c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 32, y * 32, 32, 32); c.fillRect(w - 192 + x * 32, y * 32, 32, 32); }
    c.font = '900 110px "Barlow SC", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#2a1405'; c.fillText('LÖWEN-KART', w / 2, h / 2 + 6);
  });
  const torMat = std(0x2a2d33, 0.5, 0.3);
  const torBreite = S.hw * 2 + 4;
  teil(GEO.box, torMat, tor, -torBreite / 2, 3.6, 0, 1.0, 7.2, 1.0);
  teil(GEO.box, torMat, tor, torBreite / 2, 3.6, 0, 1.0, 7.2, 1.0);
  const balken = teil(GEO.box, new THREE.MeshLambertMaterial({ map:bannerTex }), tor, 0, 7.4, 0, torBreite + 1, 1.8, 0.6);
  balken.material.map.wrapS = THREE.ClampToEdgeWrapping;
  gruppe.add(tor);

  // Tribüne rechts neben der Startgeraden
  const trib = new THREE.Group();
  const ti = idxBei(S, -14);
  const [tx, tz] = punktBei(S, ti, -(S.hw + S.auslauf + 2.5));
  trib.position.set(tx, 0, tz); trib.rotation.y = yawBei(S, ti);
  const leute = new Instanzen();
  for (let r = 0; r < 4; r++){
    teil(GEO.box, std(0x8e99a6, 0.8), trib, -r * 1.7 - 0.85, (r + 1) * 0.55, 0, 1.7, (r + 1) * 1.1, 26).receiveShadow = true;
    for (let z = -12; z <= 12; z += 1.15){
      if (rnd() < 0.15) continue;
      leute.add('kopf', GEO.kugelGrob, MAT.bunt, [-r * 1.7 - 0.85 + zufall(-0.2, 0.2), (r + 1) * 1.1 + 0.9, z], [0.28, 0.3, 0.28], [0, 0, 0], lin(0xf1c9a5).lerp(lin(0x6b4226), rnd()));
      leute.add('koerper', GEO.box, MAT.bunt, [-r * 1.7 - 0.85, (r + 1) * 1.1 + 0.35, z], [0.55, 0.7, 0.5], [0, 0, 0], new THREE.Color().setHSL(rnd(), 0.7, 0.45).convertSRGBToLinear());
    }
  }
  teil(GEO.box, std(0xe8322a, 0.5), trib, -3.4, 7.6, 0, 7.6, 0.25, 27);
  teil(GEO.zyl, torMat, trib, -7.0, 3.8, -13, 0.15, 7.6, 0.15);
  teil(GEO.zyl, torMat, trib, -7.0, 3.8, 13, 0.15, 7.6, 0.15);
  leute.bauen(trib);
  gruppe.add(trib);

  // Absperrung (Blöcke in Streifenfarben), nur wo sie keine andere Strecke berührt
  const frei = (x, z, abstand, schritt = 3) => {
    const a2 = abstand * abstand;
    for (let i = 0; i < S.N; i += schritt){ const dx = x - S.px[i], dz = z - S.pz[i]; if (dx * dx + dz * dz < a2) return false; }
    return true;
  };
  const wand = new Instanzen();
  const wandAbstand = S.hw + S.auslauf + 1.0;
  let farbe = 0;
  for (let i = 0; i < S.N; i += Math.max(1, Math.round(2.2 / S.ds))){
    farbe++;
    for (const sg of [1, -1]){
      const [x, z] = punktBei(S, i, sg * wandAbstand);
      if (!frei(x, z, wandAbstand - 0.4, 2)) continue;
      wand.add('wand', GEO.box, MAT.bunt, [x, 0.55, z], [0.8, 1.1, 2.3], [0, yawBei(S, i), 0], lin(farbe % 2 ? wandA : wandB));
    }
  }
  wand.bauen(gruppe);

  // Item-Boxen
  S.boxen = [];
  for (const anteil of [0.2, 0.5, 0.79]){
    const i = Math.round(S.N * anteil);
    for (const q of [-0.6, -0.2, 0.2, 0.6]){
      const [x, z] = punktBei(S, i, q * S.hw);
      const m = new THREE.Mesh(GEO.box16, MAT.itemBox);
      m.position.set(x, 1.3, z); m.castShadow = true;
      gruppe.add(m);
      S.boxen.push({ x, z, mesh:m, aus:0, wachs:1, phase:rnd() * TAU });
    }
  }
  // Turbo-Felder
  S.pads = [];
  [[0.36, 0.42], [0.64, -0.42], [0.92, 0.3]].forEach(([anteil, q]) => {
    const i = Math.round(S.N * anteil), seite = q * S.hw;
    const [x, z] = punktBei(S, i, seite);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 6), MAT.pad);
    m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, yawBei(S, i), 0);
    m.position.set(x, 0.08, z);
    gruppe.add(m);
    S.pads.push({ i, seite });
  });

  dekoBauen(S, th, gruppe, rnd, frei);
  // Streckenrand mit Grasbuescheln, Steinen oder Eiskristallen, gebuendelt gezeichnet.
  const details = new Instanzen();
  for (let n = 0; n < 260; n++){
    const i = Math.floor(rnd() * S.N), sg = rnd() < 0.5 ? -1 : 1;
    const [x, z] = punktBei(S, i, sg * (S.hw + S.auslauf + 2.5 + rnd() * 15));
    if (!frei(x, z, S.hw + S.auslauf + 1.7)) continue;
    const h = 0.2 + rnd() * 0.65;
    if (th.deko === 'baeume'){
      details.add('gras', GEO.kegelGrob, MAT.laub, [x,h/2,z], [0.22,h,0.22], [0,rnd()*TAU,0.1], lin(0x62963e));
      if (n % 4 === 0) details.add('bluete', GEO.kugelGrob, MAT.bunt, [x,h,z], [0.15,0.1,0.15], [0,0,0], lin(n % 8 ? 0xffdb62 : 0xf8d3ef));
    } else {
      details.add('stein', th.schnee ? GEO.kegelGrob : GEO.kugelGrob, MAT.bunt, [x,h/2,z], [h,h,h*0.7], [0,rnd()*TAU,0.18], lin(th.schnee ? 0xafdcea : 0xb98354));
    }
  }
  details.bauen(gruppe, false);

  // Minikarte vorberechnen
  S.karte = document.createElement('canvas');
  S.karte.width = S.karte.height = 380;
  const kc = S.karte.getContext('2d');
  const breite = Math.max(S.maxX - S.minX, S.maxZ - S.minZ);
  S.kSkala = 330 / breite;
  S.kOx = 190 - (S.minX + S.maxX) / 2 * S.kSkala; S.kOz = 190 - (S.minZ + S.maxZ) / 2 * S.kSkala;
  kc.lineJoin = kc.lineCap = 'round';
  const pfad = () => { kc.beginPath(); for (let i = 0; i <= S.N; i += 4){ const j = i % S.N; kc.lineTo(S.px[j] * S.kSkala + S.kOx, S.pz[j] * S.kSkala + S.kOz); } kc.closePath(); };
  pfad(); kc.strokeStyle = 'rgba(0,0,0,.55)'; kc.lineWidth = 22; kc.stroke();
  pfad(); kc.strokeStyle = 'rgba(255,255,255,.92)'; kc.lineWidth = 12; kc.stroke();
  const [sx1, sz1] = punktBei(S, 0, S.hw), [sx2, sz2] = punktBei(S, 0, -S.hw);
  kc.strokeStyle = '#111'; kc.lineWidth = 5; kc.lineCap = 'butt';
  kc.beginPath(); kc.moveTo(sx1 * S.kSkala + S.kOx, sz1 * S.kSkala + S.kOz); kc.lineTo(sx2 * S.kSkala + S.kOx, sz2 * S.kSkala + S.kOz); kc.stroke();

  // Schneefall
  if (th.schnee){
    const n = 1500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([zufall(-70, 70), zufall(0, 45), zufall(-70, 70)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    S.schnee = new THREE.Points(g, new THREE.PointsMaterial({ color:0xffffff, size:0.35, map:partikelTex, transparent:true, depthWrite:false, opacity:0.9 }));
    S.schnee.frustumCulled = false;
    scene.add(S.schnee);
  }
  strecke = S;
  return S;
}

function dekoBauen(S, th, gruppe, rnd, frei){
  const inst = new Instanzen();
  const rand = 150;
  const ziel = th.deko === 'kakteen' ? 170 : 280;
  const farbe = (h, s, l) => new THREE.Color().setHSL(h, s, l).convertSRGBToLinear();
  let gesetzt = 0;
  for (let versuch = 0; versuch < ziel * 6 && gesetzt < ziel; versuch++){
    const x = S.minX - rand + rnd() * (S.maxX - S.minX + 2 * rand);
    const z = S.minZ - rand + rnd() * (S.maxZ - S.minZ + 2 * rand);
    if (!frei(x, z, S.hw + S.auslauf + 4)) continue;
    gesetzt++;
    const s = 0.7 + rnd() * 0.9, dreh = rnd() * TAU;
    if (th.deko === 'baeume'){
      if (rnd() < 0.3){
        inst.add('busch', GEO.kugelGrob, MAT.laub, [x, 0.5 * s, z], [1.5 * s, 1.1 * s, 1.5 * s], [0, dreh, 0], farbe(0.28 + rnd() * 0.06, 0.55, 0.3 + rnd() * 0.1));
      } else {
        inst.add('stamm', GEO.zylGrob, MAT.stamm, [x, 1.5 * s, z], [0.3 * s, 3 * s, 0.3 * s]);
        const c = farbe(0.25 + rnd() * 0.1, 0.55, 0.28 + rnd() * 0.12);
        inst.add('krone', GEO.kugelGrob, MAT.laub, [x, 3.9 * s, z], [2.0 * s, 2.2 * s, 2.0 * s], [0, dreh, 0], c);
        if (rnd() < 0.5) inst.add('krone', GEO.kugelGrob, MAT.laub, [x + 0.8 * s, 3.2 * s, z + 0.5 * s], [1.3 * s, 1.3 * s, 1.3 * s], [0, dreh, 0], c.clone().multiplyScalar(0.85));
        if (rnd() < 0.15) inst.add('blume', GEO.kugelGrob, MAT.laub, [x + 2, 0.25, z + 1], [0.25, 0.25, 0.25], [0, 0, 0], farbe(rnd(), 0.8, 0.6));
      }
    } else if (th.deko === 'kakteen'){
      if (rnd() < 0.4){
        inst.add('fels', GEO.kugelGrob, MAT.laub, [x, 0.4 * s, z], [1.8 * s, 1.2 * s, 1.5 * s], [rnd(), dreh, rnd()], farbe(0.06 + rnd() * 0.03, 0.45, 0.4 + rnd() * 0.12));
      } else {
        const h = 3 + rnd() * 3.5, c = farbe(0.33 + rnd() * 0.04, 0.45, 0.3 + rnd() * 0.08);
        inst.add('kaktus', GEO.zylGrob, MAT.laub, [x, h / 2 * s, z], [0.45 * s, h * s, 0.45 * s], [0, dreh, 0], c);
        inst.add('kappe', GEO.kugelGrob, MAT.laub, [x, h * s, z], [0.45 * s, 0.35 * s, 0.45 * s], [0, 0, 0], c);
        for (const sg of [1, -1]){
          if (rnd() < 0.3) continue;
          const ah = h * (0.35 + rnd() * 0.25) * s, ax = Math.cos(dreh) * sg, az = Math.sin(dreh) * sg;
          inst.add('kaktus', GEO.zylGrob, MAT.laub, [x + ax * 0.6 * s, ah, z + az * 0.6 * s], [0.25 * s, 1.2 * s, 0.25 * s], [0, 0, Math.PI / 2], c);
          inst.add('kaktus', GEO.zylGrob, MAT.laub, [x + ax * 1.1 * s, ah + 0.7 * s, z + az * 1.1 * s], [0.28 * s, 1.5 * s, 0.28 * s], [0, 0, 0], c);
        }
      }
    } else {
      const c = farbe(0.38 + rnd() * 0.05, 0.4, 0.18 + rnd() * 0.08);
      inst.add('stamm', GEO.zylGrob, MAT.stamm, [x, 0.6 * s, z], [0.3 * s, 1.2 * s, 0.3 * s]);
      [[2.2, 2.4, 2.2], [1.7, 2.1, 3.7], [1.15, 1.8, 5.0]].forEach(([r, h, y]) => inst.add('tanne', GEO.kegelGrob, MAT.laub, [x, y * s, z], [r * s, h * s, r * s], [0, dreh, 0], c));
      inst.add('schneekappe', GEO.kegelGrob, MAT.weissL, [x, 5.55 * s, z], [0.6 * s, 0.8 * s, 0.6 * s], [0, dreh, 0]);
    }
  }
  // Schneemänner am Rand
  if (th.deko === 'tannen'){
    for (let n = 0, gebaut = 0; n < 60 && gebaut < 7; n++){
      const i = Math.floor(rnd() * S.N), sg = rnd() < 0.5 ? 1 : -1;
      const [x, z] = punktBei(S, i, sg * (S.hw + S.auslauf + 4 + rnd() * 4));
      if (!frei(x, z, S.hw + S.auslauf + 3)) continue;
      gebaut++;
      const g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = yawBei(S, i) + (sg > 0 ? -Math.PI / 2 : Math.PI / 2);
      teil(GEO.kugel, MAT.weiss, g, 0, 0.9, 0, 1.0, 0.95, 1.0);
      teil(GEO.kugel, MAT.weiss, g, 0, 2.2, 0, 0.72, 0.7, 0.72);
      teil(GEO.kugel, MAT.weiss, g, 0, 3.2, 0, 0.5, 0.5, 0.5);
      teil(GEO.kegel, std(0xff7a1a), g, 0, 3.2, 0.6, 0.09, 0.5, 0.09).rotation.x = Math.PI / 2;
      teil(GEO.kugel, MAT.auge, g, -0.17, 3.35, 0.42, 0.06, 0.06, 0.06);
      teil(GEO.kugel, MAT.auge, g, 0.17, 3.35, 0.42, 0.06, 0.06, 0.06);
      teil(GEO.zyl, MAT.auge, g, 0, 3.75, 0, 0.35, 0.5, 0.35);
      teil(GEO.zyl, MAT.auge, g, 0, 3.52, 0, 0.55, 0.06, 0.55);
      gruppe.add(g);
    }
  }
  inst.bauen(gruppe);

  // Berge ringsum
  const berge = new Instanzen();
  const cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2;
  const R = Math.max(S.maxX - S.minX, S.maxZ - S.minZ) / 2 + 300;
  const bergMat = new THREE.MeshPhongMaterial({ color:0xffffff, flatShading:true, shininess:0, specular:0x000000 });
  for (let n = 0; n < 22; n++){
    const w = n / 22 * TAU + rnd() * 0.2, r = R + rnd() * 260;
    const x = cx + Math.cos(w) * r, z = cz + Math.sin(w) * r;
    const h = 90 + rnd() * 150, b = h * (0.9 + rnd() * 0.5);
    const c = new THREE.Color(th.berge).offsetHSL(rnd() * 0.03, 0, (rnd() - 0.5) * 0.1).convertSRGBToLinear();
    if (th.deko === 'kakteen'){
      berge.add('mesa', GEO.zylGrob, bergMat, [x, h * 0.25, z], [b * 0.7, h * 0.5, b * 0.7], [0, rnd(), 0], c);
      berge.add('mesa', GEO.zylGrob, bergMat, [x, h * 0.53, z], [b * 0.55, h * 0.06, b * 0.55], [0, rnd(), 0], c.clone().multiplyScalar(0.8));
    } else {
      berge.add('berg', GEO.kegelGrob, bergMat, [x, h / 2, z], [b, h, b], [0, rnd(), 0], c);
      if (th.deko === 'tannen' || h > 190) berge.add('gipfel', GEO.kegelGrob, bergMat, [x, h - h * 0.16, z], [b * 0.32, h * 0.32, b * 0.32], [0, 0, 0], lin(0xffffff));
    }
  }
  berge.bauen(gruppe, false);

  // Wolken
  if (th.wolken){
    const wolken = new Instanzen();
    const wMat = new THREE.MeshPhongMaterial({ color:0xffffff, emissive:lin(0x8a96a8), flatShading:true, shininess:0, specular:0x000000, fog:false });
    for (let n = 0; n < 16; n++){
      const w = rnd() * TAU, r = 250 + rnd() * 600, x = cx + Math.cos(w) * r, z = cz + Math.sin(w) * r, y = 90 + rnd() * 60;
      for (let k = 0; k < 4; k++){
        const s = 12 + rnd() * 14;
        wolken.add('wolke', GEO.kugelGrob, wMat, [x + (k - 1.5) * 14 + rnd() * 6, y + rnd() * 6, z + rnd() * 10], [s * 1.4, s * 0.7, s], [0, rnd(), 0]);
      }
    }
    const wg = new THREE.Group();
    wolken.bauen(wg, false);
    S.wolken = wg;
    gruppe.add(wg);
  }
}

/* =========================================================
   Karts
   ========================================================= */
let karts = [], spieler = null, vorschau = null;
const bananen = [], raketen = [];

function werteVon(f, istKi){
  const st = STUFEN[rennStufe];
  let maxV = (28 + (f.tempo - 3) * 0.9) * st.tempo;
  if (istKi) maxV *= st.ki * zufall(0.985, 1.015);
  return {
    maxV,
    beschl:(15 + (f.beschl - 3) * 2.4) * Math.sqrt(st.tempo),
    lenk:(1.9 + (f.lenk - 3) * 0.1) * Math.pow(st.tempo, 0.7),
    masse:1 + (f.tempo - 3) * 0.18
  };
}

function namensSchild(text){
  const tex = canvasTex(256, 64, (c, w) => {
    c.font = '800 34px "Barlow SC", system-ui, sans-serif';
    const b = Math.min(w - 8, c.measureText(text).width + 30);
    c.fillStyle = 'rgba(20,12,4,.72)';
    c.beginPath();
    if (c.roundRect) c.roundRect((w - b) / 2, 8, b, 48, 16); else c.rect((w - b) / 2, 8, b, 48);
    c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, 34);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, depthWrite:false, transparent:true }));
  s.scale.set(3.2, 0.8, 1); s.position.set(0, 3.5, 0); s.renderOrder = 6;
  return s;
}

class Kart {
  constructor(fahrer, istSpieler, extra = {}){
    this.f = fahrer; this.spieler = istSpieler;
    this.name = extra.name || fahrer.name;
    this.mensch = istSpieler || !!extra.mensch;
    this.fern = !!extra.fern;
    this.slot = extra.slot == null ? -1 : extra.slot;
    this.netz = null;
    this.m = kartModell(fahrer);
    if (extra.schild){ this.schild = namensSchild(this.name); this.m.gruppe.add(this.schild); }
    scene.add(this.m.gruppe);
    this.werte = werteVon(fahrer, !istSpieler);
    this.eingabe = { gas:false, bremse:false, lenk:0, drift:false, item:false };
    this.phase = Math.random() * TAU;
    this.zuruecksetzen();
  }
  zuruecksetzen(){
    Object.assign(this, {
      x:0, z:0, y:0, vy:0, yaw:0, v:0, kx:0, kz:0, idx:0, idxAlt:0, runde:0, maxRunde:0, fortschritt:0, seite:0,
      drift:0, driftZeit:0, driftStufe:0, driftTaste:false, driftVisuell:0, boost:0, stern:0, dreh:0, drehDauer:1, drehWinkel:0,
      item:null, itemNeu:null, itemAnzahl:0, roulette:0, itemTimer:0, fertig:false, zielzeit:Infinity, rundeStart:0, rundenzeiten:[],
      platz:1, lenkAnzeige:0, lenkSanft:0, stand:0, offroad:false, falsch:0, steckt:0, wandZeit:0, padZeit:0, hatteStern:false,
      spur:zufall(-0.5, 0.5), spurZiel:zufall(-0.5, 0.5), spurTimer:zufall(1, 3), gummi:1, camYaw:0, autopilot:false
    });
  }
  entfernen(){
    scene.remove(this.m.gruppe); entsorgen(this.m.gruppe);
  }
}

function aufStartplatz(k, slot){
  const S = strecke, reihe = Math.floor(slot / 2), seite = slot % 2 ? -1 : 1;
  const i = idxBei(S, -(7 + reihe * 6.5 + (slot % 2) * 3));
  const [x, z] = punktBei(S, i, seite * S.hw * 0.42);
  k.x = x; k.z = z; k.yaw = k.camYaw = yawBei(S, i); k.idx = k.idxAlt = i;
  k.fortschritt = i * S.ds;
}

function boost(k, dauer){
  k.boost = Math.max(k.boost, dauer);
  k.v = Math.max(k.v, k.werte.maxV * 1.15);
  if (k.spieler) Ton.effekt('boost');
}

function treffer(k, art){
  if (k.stern > 0 || k.dreh > 0) return;
  k.dreh = k.drehDauer = art === 'rakete' ? 1.4 : art === 'stoss' ? 0.8 : 1.1;
  if (art === 'rakete') k.vy = 7;
  k.drift = 0; k.boost = 0; k.driftStufe = 0;
  for (let n = 0; n < 14; n++){
    const w = Math.random() * TAU;
    funken.neu(k.x, 1.5, k.z, Math.cos(w) * 5, zufall(3, 7), Math.sin(w) * 5, 0.6, 1, 0.95, 0.5, 0.7, 10);
  }
  if (k.spieler){ Ton.effekt('treffer'); vibrieren(120); zustand.wackeln = 0.5; }
}

function streckeFolgen(k){
  const S = strecke;
  k.idxAlt = k.idx;
  k.idx = naechster(S, k.x, k.z, k.idx);
  const i = k.idx, dx = k.x - S.px[i], dz = k.z - S.pz[i];
  k.seite = dx * S.tz[i] - dz * S.tx[i];
  const vor = dx * S.tx[i] + dz * S.tz[i];
  if (k.idxAlt > S.N * 0.75 && k.idx < S.N * 0.25) rundeUeber(k, 1);
  else if (k.idxAlt < S.N * 0.25 && k.idx > S.N * 0.75) rundeUeber(k, -1);
  k.fortschritt = k.runde * S.L + i * S.ds + vor;
}

function rundeUeber(k, r){
  k.runde += r;
  if (r < 0 || k.runde <= k.maxRunde) return;
  k.maxRunde = k.runde;
  if (zustand.phase === 'menue') return;
  if (k.runde >= 2 && !k.fertig){ k.rundenzeiten.push(zustand.rt - k.rundeStart); k.rundeStart = zustand.rt; }
  if (k.runde > RUNDEN && !k.fertig){
    k.fertig = true; k.zielzeit = zustand.rt;
    if (online.aktiv) Netz.senden({ t:'ziel', slot:k.slot, zeit:rund(k.zielzeit) });
    zielErreicht(k);
    return;
  }
  if (k.spieler && k.runde >= 2){
    meldung(k.runde === RUNDEN ? 'Letzte Runde!' : `Runde ${k.runde}`, 1.6, true);
    Ton.effekt(k.runde === RUNDEN ? 'letzte' : 'runde');
  }
}

function kartBewegen(k, dt){
  const S = strecke, e = k.eingabe, w = k.werte;
  const aktiv = zustand.phase !== 'countdown' && zustand.phase !== 'menue';
  k.boost = Math.max(0, k.boost - dt);
  k.stern = Math.max(0, k.stern - dt);
  k.padZeit -= dt; k.wandZeit -= dt;
  let lenk = e.lenk, gas = e.gas && !e.bremse && aktiv, bremse = e.bremse && aktiv;
  if (k.spieler && !k.autopilot && !zustand.autopilot){
    k.lenkSanft += (lenk - k.lenkSanft) * (1 - Math.exp(-18 * dt));
    lenk = k.lenkSanft;
  }
  if (k.dreh > 0){
    k.dreh -= dt;
    k.drehWinkel = (1 - Math.max(0, k.dreh) / k.drehDauer) * 2 * TAU;
    if (k.dreh <= 0) k.drehWinkel = 0;
    lenk = 0; gas = bremse = false;
    k.v *= Math.exp(-2.5 * dt);
  }
  const amBoden = k.y <= 0.001;
  k.offroad = Math.abs(k.seite) > S.hw + 1.3;
  let maxV = w.maxV * k.gummi;
  if (k.offroad && k.boost <= 0 && k.stern <= 0) maxV *= 0.48;
  if (k.stern > 0) maxV = w.maxV * 1.2;
  if (k.boost > 0) maxV = w.maxV * 1.4;
  // Gas und Bremse
  if (gas){
    if (k.v < 0) k.v += w.beschl * 2.2 * dt;
    else if (k.v < maxV) k.v = Math.min(maxV, k.v + w.beschl * (1 - 0.55 * (k.v / maxV) ** 2) * dt * (k.boost > 0 ? 3 : 1));
  } else if (bremse){
    // Erst bis zum Stillstand bremsen, rückwärts geht es erst nach einer kurzen Pause
    if (k.v > 0.5){ k.v -= 38 * dt; k.stand = 0; }
    else { k.stand += dt; k.v = k.stand > 0.35 ? Math.max(-9, k.v - 12 * dt) : Math.min(k.v, 0); }
  } else {
    const r = 7 * dt;
    k.v = Math.abs(k.v) <= r ? 0 : k.v - Math.sign(k.v) * r;
  }
  if (k.v > maxV) k.v = Math.max(maxV, k.v - (k.offroad ? 40 : 18) * dt);
  // Driften: Hüpfer beim Drücken, Drift sobald gelenkt wird
  if (aktiv && e.drift && !k.driftTaste && amBoden && k.v > 6 && k.dreh <= 0) k.vy = 4.2;
  k.driftTaste = e.drift;
  if (aktiv && !k.drift && e.drift && Math.abs(lenk) > 0.35 && k.v > 11 && k.dreh <= 0){ k.drift = Math.sign(lenk); k.driftZeit = 0; k.driftStufe = 0; }
  if (k.drift && (!e.drift || k.v < 8 || k.dreh > 0)){
    if (k.driftStufe > 0 && k.dreh <= 0) boost(k, [0, 0.55, 1.0, 1.5][k.driftStufe]);
    k.drift = 0; k.driftStufe = 0;
  }
  // Lenken
  let rate;
  if (k.drift){
    const t = (lenk * k.drift + 1) / 2;
    rate = k.drift * w.lenk * (0.25 + 0.6 * t);
    k.driftZeit += dt * (0.55 + 0.9 * t) * (k.offroad ? 0.4 : 1);
    k.driftStufe = k.driftZeit > 3.0 ? 3 : k.driftZeit > 1.9 ? 2 : k.driftZeit > 0.9 ? 1 : 0;
  } else {
    rate = lenk * w.lenk * klemm(Math.abs(k.v) / 8, 0, 1) * (1 - 0.12 * klemm(k.v / w.maxV, 0, 1));
    if (k.v < 0) rate = -rate;
  }
  if (!amBoden) rate *= 0.6;
  k.yaw += rate * dt;
  k.lenkAnzeige += (lenk - k.lenkAnzeige) * Math.min(1, dt * 10);
  // Bewegung (beim Driften rutscht das Kart leicht nach außen)
  const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
  let vx = fx * k.v, vz = fz * k.v;
  if (k.drift){ const r = -k.drift * k.v * 0.1; vx += fz * r; vz -= fx * r; }
  k.x += (vx + k.kx) * dt; k.z += (vz + k.kz) * dt;
  const daempf = Math.exp(-5 * dt);
  k.kx *= daempf; k.kz *= daempf;
  k.vy -= 28 * dt; k.y += k.vy * dt;
  if (k.y < 0){ k.y = 0; k.vy = 0; }
  streckeFolgen(k);
  // Absperrung
  const wand = S.hw + S.auslauf;
  if (Math.abs(k.seite) > wand){
    const sg = Math.sign(k.seite), i = k.idx, lx = S.tz[i], lz = -S.tx[i], ueber = Math.abs(k.seite) - wand;
    k.x -= lx * sg * ueber; k.z -= lz * sg * ueber; k.seite = sg * wand;
    const hinein = (fx * lx + fz * lz) * sg * (k.v < 0 ? -1 : 1);
    if (hinein > 0.1 && Math.abs(k.v) > 4){
      if (k.wandZeit <= 0){
        if (k.spieler){ Ton.effekt('wand'); vibrieren(25); zustand.wackeln = Math.max(zustand.wackeln, 0.25 * hinein); }
        for (let n = 0; n < 8; n++) funken.neu(k.x + lx * sg, 0.7, k.z + lz * sg, zufall(-3, 3), zufall(1, 4), zufall(-3, 3), 0.4, 1, 0.85, 0.4, 0.45, 12);
      }
      k.v *= 1 - 0.45 * hinein;
      k.kx -= lx * sg * 5 * hinein; k.kz -= lz * sg * 5 * hinein;
      k.wandZeit = 0.25;
      if (k.v > 0) k.yaw += winkelDiff(yawBei(S, i), k.yaw) * 0.2;
    }
  }
}

function kartStoesse(){
  for (let a = 0; a < karts.length; a++){
    for (let b = a + 1; b < karts.length; b++){
      const A = karts[a], B = karts[b];
      const dx = B.x - A.x, dz = B.z - A.z, d2 = dx * dx + dz * dz;
      if (A.fern && B.fern) continue;
      if (d2 > 6.25 || d2 < 1e-6 || Math.abs(A.y - B.y) > 1.5) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ueber = 2.5 - d;
      if (A.stern > 0 && B.stern <= 0 && !B.fern) treffer(B, 'stoss');
      else if (B.stern > 0 && A.stern <= 0 && !A.fern) treffer(A, 'stoss');
      const ma = A.werte.masse, mb = B.werte.masse;
      let wa = mb / (ma + mb), wb = ma / (ma + mb);
      if (A.fern){ wa = 0; wb = 1; } else if (B.fern){ wa = 1; wb = 0; }
      A.x -= nx * ueber * wa; A.z -= nz * ueber * wa;
      B.x += nx * ueber * wb; B.z += nz * ueber * wb;
      const rel = (Math.sin(B.yaw) * B.v - Math.sin(A.yaw) * A.v) * nx + (Math.cos(B.yaw) * B.v - Math.cos(A.yaw) * A.v) * nz;
      if (rel < 0){
        const imp = -rel * 0.6 + 2;
        A.kx -= nx * imp * wa; A.kz -= nz * imp * wa;
        B.kx += nx * imp * wb; B.kz += nz * imp * wb;
        if ((A.spieler || B.spieler) && -rel > 3) Ton.effekt('stoss');
      }
    }
  }
}

/* ---------- Items ---------- */
function itemZiehen(k){
  const f = karts.length > 1 ? (k.platz - 1) / (karts.length - 1) : 0;
  const tabelle = [
    ['banane', 0.55 - 0.45 * f], ['rakete', 0.3], ['turbo', 0.15 + 0.15 * f],
    ['turbo3', Math.max(0, f - 0.3) * 0.6], ['stern', Math.max(0, f - 0.45) * 0.5]
  ];
  let summe = tabelle.reduce((s, [, w]) => s + w, 0), r = Math.random() * summe;
  for (const [n, w] of tabelle){ r -= w; if (r <= 0) return n; }
  return 'banane';
}

function itemBenutzen(k){
  if (!k.item || k.roulette > 0 || k.dreh > 0) return;
  const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
  switch (k.item){
    case 'turbo': boost(k, 1.2); break;
    case 'turbo3': boost(k, 1.2); if (--k.itemAnzahl > 0) return; break;
    case 'banane': bananeLegen(k.x - fx * 2.8, k.z - fz * 2.8, k.idx); if (k.spieler) Ton.effekt('banane'); break;
    case 'rakete': raketeStarten(k); break;
    case 'stern': k.stern = 7; if (k.spieler) Ton.effekt('stern'); break;
  }
  k.item = null; k.itemAnzahl = 0; k.itemTimer = 0;
}

let ereignisNr = 0;
const neueId = () => `${online.ich || 'x'}-${++ereignisNr}`;
const rund = (v, f = 100) => Math.round(v * f) / f;
function ereignis(m){ if (online.aktiv && online.imRennen) Netz.senden({ t:'e', ...m }); }

function bananeLegen(x, z, idx, id = null){
  const g = new THREE.Group();
  const frucht = new THREE.Mesh(GEO.banane, MAT.banane);
  frucht.rotation.set(0, 0, Math.PI * 0.52); frucht.castShadow = true;
  g.add(frucht);
  teil(GEO.kugelGrob, MAT.braun, g, -0.05, 0.42, 0, 0.1, 0.1, 0.1);
  g.position.set(x, 0.55, z); g.rotation.y = Math.random() * TAU;
  scene.add(g);
  const b = { id:id || neueId(), x, z, idx:naechster(strecke, x, z, idx), mesh:g };
  bananen.push(b);
  if (!id) ereignis({ a:'b', id:b.id, x:rund(x), z:rund(z), idx:b.idx });
}
function bananeWeg(n, senden = false){
  if (senden) ereignis({ a:'bw', id:bananen[n].id });
  scene.remove(bananen[n].mesh); bananen.splice(n, 1);
}

function raketeStarten(k){
  const rang = rangliste(), pos = rang.indexOf(k);
  const ziel = pos > 0 ? rang[pos - 1] : null;
  const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
  const r = { id:neueId(), x:k.x + fx * 2.8, z:k.z + fz * 2.8, yaw:k.yaw, idx:k.idx, seite:k.seite, besitzer:k, ziel, t:0 };
  raketeBauen(r);
  ereignis({ a:'r', id:r.id, von:k.slot, ziel:ziel ? ziel.slot : -1, x:rund(r.x), z:rund(r.z), yaw:rund(r.yaw, 1000), idx:r.idx, seite:rund(r.seite) });
}
function raketeBauen(r){
  const g = new THREE.Group();
  teil(GEO.zyl, MAT.rot, g, 0, 0, 0, 0.24, 1.2, 0.24).rotation.x = Math.PI / 2;
  teil(GEO.kegel, MAT.weiss, g, 0, 0, 0.85, 0.24, 0.5, 0.24).rotation.x = Math.PI / 2;
  for (let n = 0; n < 4; n++){ const f = teil(GEO.box, MAT.weiss, g, 0, 0, -0.45, 0.06, 0.7, 0.35); f.rotation.z = n * Math.PI / 4 * 2; }
  r.mesh = g;
  g.position.set(r.x, 0.8, r.z);
  scene.add(g);
  raketen.push(r);
  if (nahAmSpieler(r.x, r.z, 50)) Ton.effekt('rakete');
}
function raketeWeg(n){
  const r = raketen[n];
  explosion(r.x, 0.8, r.z);
  if (nahAmSpieler(r.x, r.z, 60)) Ton.effekt('explosion');
  scene.remove(r.mesh); raketen.splice(n, 1);
}

function raketenUpdate(dt){
  const S = strecke;
  for (let n = raketen.length - 1; n >= 0; n--){
    const r = raketen[n];
    r.t += dt;
    let zx, zz, zielAbstand = Infinity;
    const z = r.ziel;
    if (z){ zielAbstand = Math.hypot(z.x - r.x, z.z - r.z); }
    if (z && zielAbstand < 45){ zx = z.x; zz = z.z; }
    else {
      const j = (r.idx + Math.round(14 / S.ds)) % S.N;
      r.seite *= Math.exp(-dt * 1.2);
      [zx, zz] = punktBei(S, j, r.seite);
    }
    const drehMax = (zielAbstand < 45 ? 6 : 3.5) * dt;
    r.yaw += klemm(winkelDiff(Math.atan2(zx - r.x, zz - r.z), r.yaw), -drehMax, drehMax);
    r.x += Math.sin(r.yaw) * 58 * dt; r.z += Math.cos(r.yaw) * 58 * dt;
    r.idx = naechster(S, r.x, r.z, r.idx);
    const i = r.idx, seite = (r.x - S.px[i]) * S.tz[i] - (r.z - S.pz[i]) * S.tx[i];
    let weg = r.t > 6 || Math.abs(seite) > S.hw + S.auslauf, melden = false;
    // Treffer prüft jeder nur für die Karts, die er selbst steuert
    for (const k of karts){
      if (k.fern || (k === r.besitzer && r.t < 0.5)) continue;
      const dx = k.x - r.x, dz = k.z - r.z;
      if (dx * dx + dz * dz < 4.4 && k.y < 2){ treffer(k, 'rakete'); weg = melden = true; break; }
    }
    const eigene = !r.besitzer || !r.besitzer.fern;
    for (let b = bananen.length - 1; b >= 0 && !weg; b--){
      const dx = bananen[b].x - r.x, dz = bananen[b].z - r.z;
      if (dx * dx + dz * dz < 3){ bananeWeg(b, eigene); weg = true; melden = eigene; }
    }
    if (weg){
      if (melden) ereignis({ a:'rw', id:r.id });
      raketeWeg(n);
      continue;
    }
    r.mesh.position.set(r.x, 0.8 + Math.sin(r.t * 20) * 0.05, r.z);
    r.mesh.rotation.y = r.yaw;
    const bx = r.x - Math.sin(r.yaw) * 0.9, bz = r.z - Math.cos(r.yaw) * 0.9;
    funken.neu(bx, 0.8, bz, zufall(-1, 1), zufall(0, 1), zufall(-1, 1), 0.3, 1, 0.6, 0.15, 0.7, 0, -1.5);
    staub.neu(bx, 0.8, bz, zufall(-0.5, 0.5), zufall(0.5, 1.5), zufall(-0.5, 0.5), 0.7, 0.8, 0.8, 0.8, 0.5, -0.5, 1.5, 0.5);
  }
}

function itemsLeeren(){
  while (bananen.length) bananeWeg(0);
  while (raketen.length){ scene.remove(raketen[0].mesh); raketen.shift(); }
}

function boxenUpdate(dt){
  const S = strecke;
  const hue = (zeit * 0.25) % 1;
  MAT.itemBox.emissive.setHSL(hue, 0.9, 0.35);
  MAT.itemBox.color.setHSL((hue + 0.5) % 1, 0.7, 0.75);
  S.boxen.forEach((b, bi) => {
    if (b.aus > 0){
      b.aus -= dt;
      if (b.aus <= 0){ b.mesh.visible = true; b.wachs = 0; }
      return;
    }
    b.wachs = Math.min(1, b.wachs + dt * 3);
    b.mesh.scale.setScalar(b.wachs);
    b.mesh.rotation.set(0.5, zeit * 1.3 + b.phase, 0.3);
    b.mesh.position.y = 1.4 + Math.sin(zeit * 2.2 + b.phase) * 0.18;
    if (!['rennen', 'auslauf'].includes(zustand.phase)) return;
    for (const k of karts){
      if (k.fern) continue;
      const dx = k.x - b.x, dz = k.z - b.z;
      if (dx * dx + dz * dz > 5.5) continue;
      boxWeg(b);
      ereignis({ a:'x', i:bi });
      if (!k.item && k.roulette <= 0){ k.roulette = 1.1; k.itemNeu = itemZiehen(k); }
      if (k.spieler) Ton.effekt('box');
      break;
    }
  });
  MAT.pad.map.offset.y = -(zeit * 1.5 % 1);
}

function boxWeg(b){
  b.aus = 2.5; b.mesh.visible = false;
  buntStoss(b.x, 1.4, b.z);
}

function padsPruefen(k){
  if (k.padZeit > 0) return;
  const S = strecke;
  for (const p of S.pads){
    let d = Math.abs(k.idx - p.i);
    d = Math.min(d, S.N - d) * S.ds;
    if (d < 3.2 && Math.abs(k.seite - p.seite) < 2.4){ boost(k, 1.0); k.padZeit = 0.6; return; }
  }
}

function bananenPruefen(k){
  for (let n = bananen.length - 1; n >= 0; n--){
    const b = bananen[n], dx = k.x - b.x, dz = k.z - b.z;
    if (dx * dx + dz * dz < 3.4 && k.y < 1){
      bananeWeg(n, true);
      treffer(k, 'banane');
      if (k.spieler || nahAmSpieler(k.x, k.z, 30)) Ton.effekt('banane');
    }
  }
}

/* ---------- Computergegner ---------- */
function kiSteuern(k, dt){
  const S = strecke, e = k.eingabe, st = STUFEN[rennStufe];
  e.gas = true; e.bremse = false; e.drift = false; e.item = false;
  k.spurTimer -= dt;
  if (k.spurTimer < 0){ k.spurTimer = zufall(1.5, 4); k.spurZiel = zufall(-0.55, 0.55); }
  k.spur += (k.spurZiel - k.spur) * Math.min(1, dt * 1.5);
  const vorraus = Math.max(3, Math.round((7 + Math.max(0, k.v) * 0.42) / S.ds));
  const j = (k.idx + vorraus) % S.N;
  let seite = k.spur * S.hw + klemm(S.kurv[j] * 25, -0.45, 0.45) * S.hw;
  // Bananen ausweichen
  for (const b of bananen){
    let d = b.idx - k.idx; if (d < -S.N / 2) d += S.N; if (d > S.N / 2) d -= S.N;
    if (d <= 0 || d * S.ds > 28) continue;
    const bs = (b.x - S.px[b.idx]) * S.tz[b.idx] - (b.z - S.pz[b.idx]) * S.tx[b.idx];
    if (Math.abs(bs - seite) < 3) seite = bs + (bs > 0 ? -4.5 : 4.5);
  }
  seite = klemm(seite, -S.hw * 0.85, S.hw * 0.85);
  const [zx, zz] = punktBei(S, j, seite);
  const diff = winkelDiff(Math.atan2(zx - k.x, zz - k.z), k.yaw);
  e.lenk = klemm(diff * 2.6, -1, 1);
  // Tempo vor Kurven anpassen
  let maxKr = 0;
  for (let m = 6; m <= 42; m += 6) maxKr = Math.max(maxKr, Math.abs(S.kurv[(k.idx + Math.round(m / S.ds)) % S.N]));
  const zielV = st.kurve * k.werte.lenk * 0.9 / Math.max(maxKr, 0.001);
  if (k.v > zielV + 1.5){ e.gas = false; if (k.v > zielV + 6) e.bremse = true; }
  // Gummiband: nicht zu weit weg vom Spieler
  const [mn, mx] = zustand.menschen || [Infinity, -Infinity];
  if (!k.mensch && isFinite(mn)){
    const vor = k.fortschritt - mx, hinter = mn - k.fortschritt;
    k.gummi = vor > 80 ? 0.92 : vor > 40 ? 0.96 : hinter > 120 ? 1.08 : hinter > 50 ? 1.04 : 1;
  } else k.gummi = 1;
  // Festgefahren? Kurz zurück, sonst auf die Strecke setzen
  if (zustand.rt > 3 && Math.abs(k.v) < 2.5 && k.dreh <= 0) k.steckt += dt; else k.steckt = Math.max(0, k.steckt - dt);
  if (k.steckt > 1){ e.gas = false; e.bremse = true; e.lenk = -e.lenk; }
  if (k.steckt > 3){
    const [x, z] = punktBei(S, k.idx, 0);
    k.x = x; k.z = z; k.yaw = yawBei(S, k.idx); k.v = 0; k.steckt = 0;
  }
  // Items
  if (k.item && k.roulette <= 0){
    k.itemTimer += dt;
    const rang = rangliste(), p = rang.indexOf(k), vor = rang[p - 1], hinter = rang[p + 1];
    switch (k.item){
      case 'turbo': case 'turbo3': if (k.itemTimer > 0.7 && maxKr < 0.02) e.item = true; break;
      case 'stern': if (k.itemTimer > 0.5) e.item = true; break;
      case 'rakete': if ((vor && vor.fortschritt - k.fortschritt < 45 && k.itemTimer > 0.8) || k.itemTimer > 7) e.item = true; break;
      case 'banane': if ((hinter && k.fortschritt - hinter.fortschritt < 16 && k.itemTimer > 0.6) || k.itemTimer > 6) e.item = true; break;
    }
  }
}

function rangliste(){
  return karts.slice().sort((a, b) => {
    if (a.fertig && b.fertig) return a.zielzeit - b.zielzeit;
    if (a.fertig !== b.fertig) return a.fertig ? -1 : 1;
    return b.fortschritt - a.fortschritt;
  });
}
const nahAmSpieler = (x, z, r) => { const f = spieler || vorschau; if (!f) return false; const dx = f.x - x, dz = f.z - z; return dx * dx + dz * dz < r * r; };

/* ---------- Darstellung eines Karts ---------- */
function kartDarstellen(k, dt){
  const m = k.m, g = m.gruppe;
  g.position.set(k.x, k.y, k.z);
  k.driftVisuell += (k.drift * 0.4 - k.driftVisuell) * Math.min(1, dt * 8);
  g.rotation.y = k.yaw + k.driftVisuell + k.drehWinkel;
  const tempo = klemm(Math.abs(k.v) / 20, 0, 1);
  m.koerper.rotation.z = -k.lenkAnzeige * 0.09 * tempo;
  m.koerper.rotation.x += (((k.boost > 0 ? -0.035 : k.eingabe.bremse && k.v > 1 ? 0.045 : 0)) - m.koerper.rotation.x) * (1 - Math.exp(-8 * dt));
  m.kontakt.position.y = 0.09 - k.y;
  m.kontakt.scale.setScalar(1 + Math.max(0, k.y) * 0.12);
  m.kontakt.visible = k.y < 3;
  m.koerper.position.y = Math.sin(zeit * 30 + k.phase) * 0.015 * tempo + (k.offroad ? Math.sin(zeit * 47 + k.phase) * 0.05 * tempo : 0);
  const radDreh = k.v * dt / 0.48;
  for (const r of m.raeder) r.rotation.x += radDreh;
  for (const h of m.vorne) h.rotation.y = k.lenkAnzeige * 0.45;
  m.kopf.rotation.y = k.lenkAnzeige * 0.3;
  m.kopf.rotation.z = -k.lenkAnzeige * 0.12;
  // Namensschild aus der Nähe ausblenden, damit es nicht die Sicht versperrt
  if (k.schild) k.schild.material.opacity = klemm((camera.position.distanceTo(g.position) - 7) / 6, 0, 1);
  const flamme = k.boost > 0;
  for (const f of m.flammen){ f.visible = flamme; if (flamme) f.scale.set(0.17, 0.7 + Math.random() * 0.6, 0.17); }
  if (k.stern > 0){
    const c = new THREE.Color().setHSL((zeit * 2 + k.phase) % 1, 1, 0.45);
    m.lack.emissive.copy(c); m.anzug.emissive.copy(c).multiplyScalar(0.6);
    k.hatteStern = true;
  } else if (k.hatteStern){ m.lack.emissive.setRGB(0, 0, 0); m.anzug.emissive.setRGB(0, 0, 0); k.hatteStern = false; }
}

const SPUR_ANZAHL = 900;
const spurGeo = new THREE.PlaneGeometry(0.22, 1);
spurGeo.rotateX(-Math.PI / 2);
const spurMat = new THREE.MeshBasicMaterial({ color:0x171b23, transparent:true, opacity:0.28, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6 });
const spuren = new THREE.InstancedMesh(spurGeo, spurMat, SPUR_ANZAHL);
spuren.instanceMatrix.setUsage(THREE.DynamicDrawUsage); spuren.frustumCulled = false;
scene.add(spuren);
let spurNr = 0, spurTimer = 0;
const spurObj = new THREE.Object3D();
function spurenLeeren(){ spurNr = 0; spuren.count = 0; spurTimer = 0; }
spurenLeeren();
function spurenUpdate(dt){
  if (!['rennen','auslauf'].includes(zustand.phase) || grafik.modus === 'leicht') return;
  spurTimer += dt;
  if (spurTimer < 0.045) return;
  const intervall = spurTimer; spurTimer = 0;
  for (const k of karts){
    if (k.y > 0.1 || k.offroad || Math.abs(k.v) < 7 || !(k.drift || k.eingabe.bremse) || !nahAmSpieler(k.x,k.z,85)) continue;
    const w = k.yaw + k.driftVisuell, fx = Math.sin(w), fz = Math.cos(w);
    for (const seite of [-1,1]){
      spurObj.position.set(k.x - fx + fz * seite, 0.065, k.z - fz - fx * seite);
      spurObj.rotation.set(0,w,0); spurObj.scale.set(1,1,Math.min(2.8,Math.abs(k.v)*intervall+0.1)); spurObj.updateMatrix();
      spuren.setMatrixAt(spurNr,spurObj.matrix); spurNr = (spurNr+1) % SPUR_ANZAHL;
      spuren.count = Math.min(SPUR_ANZAHL,spuren.count+1);
    }
  }
  spuren.instanceMatrix.needsUpdate = true;
}

function kartEffekte(k){
  if (!nahAmSpieler(k.x, k.z, 110)) return;
  const yaw = k.m.gruppe.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = fz, lz = -fx;
  const hinten = (s) => [k.x - fx * 1.1 + lx * s, k.z - fz * 1.1 + lz * s];
  if (k.drift && k.y < 0.05){
    const FARBEN = [[1, 0.9, 0.6], [0.35, 0.65, 1], [1, 0.55, 0.12], [0.85, 0.35, 1]];
    const [r, g, b] = FARBEN[k.driftStufe];
    for (const s of [-0.95, 0.95]){
      const [x, z] = hinten(s);
      funken.neu(x, 0.25, z, -fx * 3 + zufall(-2, 2) + lx * k.drift * -3, zufall(1, 4), -fz * 3 + zufall(-2, 2) + lz * k.drift * -3, zufall(0.15, 0.35), r, g, b, k.driftStufe ? 0.55 : 0.3, 14);
    }
  }
  if (k.boost > 0){
    for (const s of [-0.3, 0.3]){
      const [x, z] = hinten(s);
      funken.neu(x - fx, 0.95, z - fz, -fx * 6 + zufall(-1, 1), zufall(0, 1.5), -fz * 6 + zufall(-1, 1), 0.2, 1, zufall(0.45, 0.75), 0.1, 0.55, 0, -1.5);
    }
  }
  if (k.stern > 0 && Math.random() < 0.7){
    const c = new THREE.Color().setHSL(Math.random(), 1, 0.65);
    funken.neu(k.x + zufall(-1.5, 1.5), zufall(0.5, 2.5), k.z + zufall(-1.5, 1.5), 0, 1.5, 0, 0.5, c.r, c.g, c.b, 0.6);
  }
  if (k.offroad && Math.abs(k.v) > 5 && Math.random() < 0.8){
    const [r, g, b] = strecke.th.staub, [x, z] = hinten(zufall(-1, 1));
    staub.neu(x, 0.3, z, -fx * 2 + zufall(-1, 1), zufall(0.8, 2.2), -fz * 2 + zufall(-1, 1), zufall(0.5, 0.9), r, g, b, 0.9, 1, 2.2, 0.75);
  }
}

/* =========================================================
   Rennablauf
   ========================================================= */
const zustand = { phase:'menue', t:0, rt:0, pause:false, wackeln:0, meldungBis:0, ergebnisIn:0, orbit:0, gasSeit:null, fov:68 };
const cup = { aktiv:false, nr:0, punkte:{}, gegner:null };
const online = { aktiv:false, imRennen:false, raum:null, ich:null, host:false, sendTimer:0, wegNamen:{} };
let zeit = 0;

function vorschauZeigen(){
  karts.forEach(k => k.entfernen()); karts = []; spieler = null;
  itemsLeeren();
  if (vorschau) vorschau.entfernen();
  vorschau = new Kart(FAHRER[wahl.fahrer], true);
  const S = strecke, i = idxBei(S, 24);
  vorschau.x = S.px[i]; vorschau.z = S.pz[i]; vorschau.yaw = yawBei(S, i); vorschau.idx = i;
}

// opts (nur online): { strecke, stufe, slots:[{ fahrer, name, mensch, ich, fern }] }
function rennenStarten(opts = null){
  eingabenLeeren();
  spurenLeeren();
  rennStufe = opts ? opts.stufe : wahl.stufe;
  const S = streckeLaden(opts ? opts.strecke : wahl.strecke);
  if (vorschau){ vorschau.entfernen(); vorschau = null; }
  karts.forEach(k => k.entfernen());
  karts = []; spieler = null;
  itemsLeeren(); funken.leeren(); staub.leeren();
  for (const b of S.boxen){ b.aus = 0; b.mesh.visible = true; }
  let slots = opts && opts.slots;
  if (!slots){
    // Im Cup fahren in allen 3 Rennen dieselben Gegner
    if (!cup.aktiv || !cup.gegner) cup.gegner = mischen(FAHRER.map((f, i) => i).filter(i => i !== wahl.fahrer)).slice(0, 7);
    const andere = cup.gegner.slice();
    slots = Array.from({ length:8 }, (x, slot) => slot === SPIELER_STARTPLATZ ? { fahrer:wahl.fahrer, ich:true } : { fahrer:andere.pop() });
  }
  slots.forEach((sl, slot) => {
    const k = new Kart(FAHRER[sl.fahrer] || FAHRER[0], !!sl.ich, { name:sl.name, mensch:sl.mensch, fern:sl.fern, slot, schild:sl.mensch && !sl.ich });
    aufStartplatz(k, slot);
    karts.push(k);
    if (sl.ich) spieler = k;
  });
  Object.assign(zustand, { phase:'countdown', t:0, rt:0, pause:false, wackeln:0, meldungBis:0, ergebnisIn:0, orbit:0, gasSeit:null, fov:68, cdSchritt:0 });
  $('menue').hidden = true; $('ergebnis').hidden = true; $('pause').hidden = true;
  $('hud').hidden = false; $('oben').hidden = false; $('touch').hidden = !touchModus;
  eingabenLeeren(); vollbild();
  $('mitte').textContent = '';
  $('lobby').hidden = true;
  $('neuKnopf').hidden = online.aktiv;
  $('menueKnopf').textContent = online.aktiv ? 'Raum verlassen' : 'Menü';
  $('weiterKnopf').textContent = online.aktiv ? 'Weiterfahren' : 'Weiter';
  hudCache = {};
  Ton.musik(S.def.thema);
}

function zielErreicht(k){
  if (!k.spieler) return;
  k.autopilot = true;
  zustand.phase = 'auslauf';
  zustand.ergebnisIn = online.aktiv ? Infinity : 4;
  zustand.warteAb = zeit + 2.6;
  zustand.zielMoment = zeit;
  meldung('ZIEL!', 2.2);
  Ton.effekt('ziel');
  Ton.drift(-1);
}

function meldung(text, dauer, klein = false){
  const el = $('mitte');
  el.textContent = text;
  el.className = 'schild' + (klein ? ' klein' : '');
  void el.offsetWidth;
  el.classList.add('pop');
  zustand.meldungBis = zeit + dauer;
}

function countdown(dt){
  const t0 = zustand.t;
  zustand.t += dt;
  const t = zustand.t;
  const marken = [[0.5, '3'], [1.5, '2'], [2.5, '1'], [3.5, 'LOS!']];
  for (const [m, text] of marken){
    if (t0 < m && t >= m){ meldung(text, text === 'LOS!' ? 1 : 0.95); Ton.effekt(text === 'LOS!' ? 'los' : 'piep'); }
  }
  rangliste().forEach((k, i) => { k.platz = i + 1; });
  const e = spielerEingabe();
  spieler.eingabe = e;
  if (e.gas && zustand.gasSeit === null) zustand.gasSeit = t;
  if (!e.gas) zustand.gasSeit = null;
  Ton.motor(e.gas ? 14 + Math.sin(zeit * 20) * 3 : 0, false, true);
  if (t >= 3.5){
    zustand.phase = 'rennen';
    zustand.rt = 0;
    if (e.gas && zustand.gasSeit !== null && zustand.gasSeit >= 1.5 && zustand.gasSeit < 2.5){ boost(spieler, 1.0); meldung('Super Start!', 1, true); }
    const chance = STUFEN[rennStufe].startTrick;
    for (const k of karts) if (!k.spieler && !k.fern && Math.random() < chance) boost(k, 0.8);
  }
}

function rennenUpdate(dt){
  zustand.rt += dt;
  const rang = rangliste();
  rang.forEach((k, i) => { k.platz = i + 1; });
  zustand.menschen = menschenBereich();
  for (const k of karts){
    if (k.fern){ fernBewegen(k, dt); continue; }
    if (k.spieler && !k.autopilot && !zustand.autopilot) k.eingabe = spielerEingabe();
    else kiSteuern(k, dt);
    if (k.roulette > 0){
      const vorher = k.roulette;
      k.roulette -= dt;
      if (k.spieler && Math.floor(vorher * 12) !== Math.floor(k.roulette * 12)) Ton.effekt('tick');
      if (k.roulette <= 0){
        k.item = k.itemNeu; k.itemAnzahl = k.item === 'turbo3' ? 3 : 1; k.itemTimer = 0;
        if (k.spieler) Ton.effekt('item');
      }
    }
    if (k.eingabe.item) itemBenutzen(k);
    kartBewegen(k, dt);
    padsPruefen(k);
    bananenPruefen(k);
  }
  kartStoesse();
  raketenUpdate(dt);
  // Falsche Richtung
  const S = strecke, k = spieler;
  if (!k.fertig && k.v > 3 && Math.sin(k.yaw) * S.tx[k.idx] + Math.cos(k.yaw) * S.tz[k.idx] < -0.3) k.falsch += dt; else k.falsch = 0;
  if (zustand.phase === 'auslauf'){
    zustand.ergebnisIn -= dt;
    if (zustand.ergebnisIn <= 0) ergebnisZeigen();
  }
}

function ergebnisZeigen(){
  zustand.phase = 'ergebnis';
  // Wer noch fährt, bekommt eine geschätzte Zeit
  for (const k of karts){
    if (k.fertig) continue;
    const rest = (RUNDEN + 1) * strecke.L - k.fortschritt;
    k.zielzeit = zustand.rt + Math.max(0, rest) / (k.werte.maxV * 0.85);
    k.fertig = true;
  }
  const rang = rangliste();
  const S = strecke, schluessel = `${S.def.id}|${wahl.stufe}`;
  const rek = rekorde[schluessel] || {};
  const beste = Math.min(...spieler.rundenzeiten);
  let neu = '';
  if (!(rek.zeit <= spieler.zielzeit)){ rek.zeit = spieler.zielzeit; neu += '<p class="neu">Neuer Streckenrekord!</p>'; }
  if (isFinite(beste) && !(rek.runde <= beste)){ rek.runde = beste; if (!neu) neu += '<p class="neu">Neue schnellste Runde!</p>'; }
  rekorde[schluessel] = rek; schreiben('rekorde', rekorde);
  const platz = rang.indexOf(spieler) + 1;
  if (cup.aktiv) rang.forEach((k, i) => { cup.punkte[k.f.id] = (cup.punkte[k.f.id] || 0) + PUNKTE[i]; });
  const titel = platz === 1 ? '🏆 Sieg!' : platz <= 3 ? `${platz}. Platz – Podium!` : `${platz}. Platz`;
  $('ergebnisTitel').textContent = cup.aktiv ? `Rennen ${cup.nr + 1}/3 · ${titel}` : titel;
  let html = '<table>' + rang.map((k, i) =>
    `<tr class="${k.spieler ? 'ich' : ''}"><td>${i + 1}.</td><td>${k.f.gesicht} ${k.f.name}</td><td class="r">${zeitText(k.zielzeit)}</td>${cup.aktiv ? `<td class="r">+${PUNKTE[i]}</td>` : ''}</tr>`).join('') + '</table>';
  html += `<p class="rekord" style="margin-top:10px">Beste Runde: ${zeitText(beste)} · Rekord: ${zeitText(rek.zeit)}</p>` + neu;
  if (cup.aktiv){
    const stand = karts.map(k => k.f).sort((a, b) => (cup.punkte[b.id] || 0) - (cup.punkte[a.id] || 0));
    html += '<h2 style="font-size:1.1rem;margin:16px 0 6px">Cup-Wertung</h2><table>' + stand.map((f, i) =>
      `<tr class="${f === spieler.f ? 'ich' : ''}"><td>${i + 1}.</td><td>${f.gesicht} ${f.name}</td><td class="r">${cup.punkte[f.id] || 0} P</td></tr>`).join('') + '</table>';
    if (cup.nr >= 2){
      const cupPlatz = stand.indexOf(spieler.f) + 1;
      $('ergebnisTitel').textContent = cupPlatz === 1 ? '🏆 Cup gewonnen!' : cupPlatz === 2 ? '🥈 Cup: 2. Platz' : cupPlatz === 3 ? '🥉 Cup: 3. Platz' : `Cup: ${cupPlatz}. Platz`;
    }
  }
  $('ergebnisText').innerHTML = html;
  const knoepfe = $('ergebnisKnoepfe');
  knoepfe.innerHTML = '';
  const knopf = (text, haupt, fn) => { const b = document.createElement('button'); b.className = 'knopf' + (haupt ? ' haupt' : ''); b.textContent = text; b.onclick = () => { Ton.effekt('klick'); fn(); }; knoepfe.appendChild(b); };
  if (cup.aktiv && cup.nr < 2) knopf('Nächstes Rennen', true, () => { cup.nr++; wahl.strecke = cup.nr; rennenStarten(); });
  else if (cup.aktiv) knopf('Cup nochmal', true, cupStarten);
  else {
    knopf('Nochmal', true, rennenStarten);
    knopf('Nächste Strecke', false, () => { wahl.strecke = (wahl.strecke + 1) % STRECKEN.length; schreiben('wahl', wahl); rennenStarten(); });
  }
  knopf('Menü', false, menueZeigen);
  $('ergebnis').hidden = false;
  $('touch').hidden = true;
  knoepfe.querySelector('button').focus();
}

function cupStarten(){
  cup.aktiv = true; cup.nr = 0; cup.punkte = {}; cup.gegner = null;
  wahl.strecke = 0;
  rennenStarten();
}

function pauseUmschalten(){
  if (!['countdown', 'rennen', 'auslauf'].includes(zustand.phase)) return;
  if (online.aktiv){
    $('pause').hidden = !$('pause').hidden;
    if (!$('pause').hidden) $('weiterKnopf').focus();
    return;
  }
  eingabenLeeren();
  zustand.pause = !zustand.pause;
  $('pause').hidden = !zustand.pause;
  Ton.pause(zustand.pause);
  if (zustand.pause) $('weiterKnopf').focus();
}
function tonUmschalten(){
  const an = Ton.umschalten();
  $('tonKnopf').textContent = an ? '🔊' : '🔇';
}

/* =========================================================
   HUD
   ========================================================= */
let hudCache = {};
function setzen(id, wert, html = false){
  if (hudCache[id] === wert) return;
  hudCache[id] = wert;
  if (html) $(id).innerHTML = wert; else $(id).textContent = wert;
}
function hudUpdate(){
  const k = spieler;
  if (!k) return;
  const platz = k.platz;
  setzen('platz', `${platz}<small>.</small>`, true);
  const kl = 'schild ' + (platz === 1 ? 'p1' : platz === 2 ? 'p2' : platz === 3 ? 'p3' : platz >= 6 ? 'hinten' : '');
  if ($('platz').className !== kl) $('platz').className = kl;
  setzen('rundeZahl', `${klemm(k.runde, 1, RUNDEN)}/${RUNDEN}`);
  setzen('zeitGesamt', zeitText(k.fertig ? k.zielzeit : zustand.rt));
  setzen('rundenzeiten', k.rundenzeiten.map((t, i) => `R${i + 1} ${zeitText(t)}`).join('<br>'), true);
  setzen('tempo', `${Math.round(Math.abs(k.v) * 4)} km/h`);
  // Item
  let icon = '', anzahl = '';
  if (k.roulette > 0){ const alle = Object.values(ITEM_ICON); icon = alle[Math.floor(zeit * 14) % alle.length]; }
  else if (k.item){ icon = ITEM_ICON[k.item]; if (k.item === 'turbo3') anzahl = '×' + k.itemAnzahl; }
  setzen('itemIcon', icon); setzen('itemAnzahl', anzahl);
  if (touchModus){
    setzen('tItemIcon', (icon || '🎁') + (anzahl ? `<small>${anzahl}</small>` : ''), true);
    $('tItem').classList.toggle('leer', !icon);
  }
  $('itemSlot').classList.toggle('dreh', k.roulette > 0);
  // Rangliste
  const rang = rangliste();
  setzen('liste', rang.map((r, i) => `<div class="${r.spieler ? 'ich' : ''}"><b>${i + 1}</b>${r.f.gesicht} ${esc(r.name)}</div>`).join(''), true);
  // Drift-Anzeige
  const da = $('driftAnzeige');
  const dFarben = ['#fff3c4', '#5aa8ff', '#ff9a1a', '#d85aff'];
  da.style.opacity = k.drift ? 1 : 0;
  if (k.drift) da.style.color = dFarben[k.driftStufe];
  setzen('driftAnzeige', k.drift ? '<span>' + (['DRIFT LADEN', 'MINI-TURBO', 'SUPER-TURBO', 'ULTRA-TURBO'][k.driftStufe]) + '</span><i style="--ladung:' + Math.min(100,k.driftZeit/3*100) + '%"></i>' : '', true);
  // Mitte: Meldungen und Falschfahrer-Warnung
  if (zeit > zustand.meldungBis){
    const text = k.falsch > 1.2 ? '↺ Falsche Richtung!' : online.aktiv && zustand.phase === 'auslauf' && zeit > zustand.warteAb ? 'Warte auf die anderen …' : '';
    if ($('mitte').textContent !== text){ $('mitte').textContent = text; $('mitte').className = 'schild klein'; }
  }
  miniKarte();
}
function miniKarte(){
  const S = strecke, c = $('minikarte').getContext('2d');
  c.clearRect(0, 0, 380, 380);
  c.drawImage(S.karte, 0, 0);
  const pt = (x, z) => [x * S.kSkala + S.kOx, z * S.kSkala + S.kOz];
  c.fillStyle = '#ffd83a';
  for (const b of bananen){ const [x, y] = pt(b.x, b.z); c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); }
  c.fillStyle = '#ff3b30';
  for (const r of raketen){ const [x, y] = pt(r.x, r.z); c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); }
  for (const k of karts){
    if (k === spieler) continue;
    const [x, y] = pt(k.x, k.z);
    c.fillStyle = cssFarbe(k.f.farbe); c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); c.stroke();
  }
  if (spieler){
    const [x, y] = pt(spieler.x, spieler.z);
    c.fillStyle = cssFarbe(spieler.f.farbe); c.strokeStyle = '#fff'; c.lineWidth = 5;
    c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fill(); c.stroke();
  }
}

/* =========================================================
   Kamera
   ========================================================= */
const blick = new THREE.Vector3(), ziel = new THREE.Vector3(), rechtsV = new THREE.Vector3();
function kameraUpdate(dt){
  const k = spieler || vorschau;
  if (!k) return;
  if (zustand.phase === 'menue'){
    zustand.orbit += dt * 0.25;
    const w = k.yaw + 0.9 + Math.sin(zustand.orbit) * 0.9;
    camera.position.set(k.x + Math.sin(w) * 7.8, 2.8, k.z + Math.cos(w) * 7.8);
    blick.set(k.x, 1.1, k.z);
    camera.lookAt(blick);
    if (innerWidth > 700){
      rechtsV.set(1, 0, 0).applyQuaternion(camera.quaternion);
      blick.addScaledVector(rechtsV, -2.6);
      camera.lookAt(blick);
    }
    zustand.fov = 55;
  } else if (zustand.phase === 'countdown'){
    const t = klemm(zustand.t / 3.2, 0, 1), e = t * t * (3 - 2 * t);
    const w = k.yaw + Math.PI * (1 - e) * 0.85;
    const r = 9.5 - 2.1 * e;
    camera.position.set(k.x - Math.sin(w) * r, 2.4 + 0.6 * e, k.z - Math.cos(w) * r);
    camera.lookAt(k.x + Math.sin(k.yaw) * 6 * e, 1.2, k.z + Math.cos(k.yaw) * 6 * e);
    k.camYaw = k.yaw;
    zustand.fov = 68;
  } else if (zustand.phase === 'auslauf' || zustand.phase === 'ergebnis'){
    zustand.orbit += dt * 0.3;
    const w = k.yaw + Math.PI * 0.75 + Math.sin(zustand.orbit) * 0.5;
    ziel.set(k.x + Math.sin(w) * 8.5, 3.2, k.z + Math.cos(w) * 8.5);
    camera.position.lerp(ziel, 1 - Math.exp(-3 * dt));
    camera.lookAt(k.x, 1.2, k.z);
    zustand.fov = 60;
  } else {
    k.camYaw += winkelDiff(k.yaw, k.camYaw) * (1 - Math.exp(-7 * dt));
    const s = Math.sin(k.camYaw), c = Math.cos(k.camYaw);
    const abstand = 7.4 + klemm(k.v / k.werte.maxV, 0, 1.4) * 0.65;
    ziel.set(k.x - s * abstand, 3.25 + k.y * 0.5, k.z - c * abstand);
    camera.position.lerp(ziel, 1 - Math.exp(-12 * dt));
    blick.set(k.x + s * 6, 1.3 + k.y * 0.3, k.z + c * 6);
    if (zustand.wackeln > 0){
      const a = zustand.wackeln * 0.6;
      camera.position.x += zufall(-a, a); camera.position.y += zufall(-a, a) * 0.5;
      zustand.wackeln = Math.max(0, zustand.wackeln - dt * 1.5);
    }
    camera.lookAt(blick);
    zustand.fov = 68 + (k.boost > 0 ? 12 : 0) + klemm(k.v / k.werte.maxV, 0, 1.3) * 4;
  }
  // Im Hochformat etwas mehr Überblick
  const zielFov = zustand.fov * (camera.aspect < 1 ? 1.18 : 1);
  camera.fov += (zielFov - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();
  // Sonne und Himmel folgen
  sonne.position.set(k.x + SONNE_VERSATZ.x, SONNE_VERSATZ.y, k.z + SONNE_VERSATZ.z);
  sonne.target.position.set(k.x, 0, k.z);
  himmel.position.copy(camera.position);
  const skala = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  funken.mat.uniforms.skala.value = staub.mat.uniforms.skala.value = skala;
}

/* =========================================================
   Menü
   ========================================================= */
function wahlKnopf(inhalt, aktiv, fn, danach = menueBauen){
  const b = document.createElement('button');
  b.className = 'wahl' + (aktiv ? ' aktiv' : '');
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', aktiv ? 'true' : 'false');
  b.innerHTML = inhalt;
  b.onclick = () => { Ton.start(); Ton.effekt('klick'); fn(); danach(); };
  return b;
}
function menueBauen(){
  const fw = $('fahrerwahl'); fw.innerHTML = '';
  FAHRER.forEach((f, i) => fw.appendChild(wahlKnopf(`<span class="gesicht">${f.gesicht}</span>${f.name}`, i === wahl.fahrer, () => {
    if (wahl.fahrer === i) return;
    wahl.fahrer = i; schreiben('wahl', wahl); vorschauZeigen();
  })));
  const f = FAHRER[wahl.fahrer];
  const balken = w => `<div class="balken"><i style="width:${w * 20}%"></i></div>`;
  $('fahrerinfo').innerHTML = `<span>Tempo</span>${balken(f.tempo)}<span>Beschleunigung</span>${balken(f.beschl)}<span>Kurven</span>${balken(f.lenk)}`;
  const mw = $('moduswahl'); mw.innerHTML = '';
  [['einzel', 'Einzelrennen', 'Gegen den Computer'], ['cup', 'Löwen-Cup', 'Alle 3 Strecken, Punkte'], ['online', 'Online', 'Mit Freunden fahren']].forEach(([id, name, info]) =>
    mw.appendChild(wahlKnopf(`<b>${name}</b><small>${info}</small>`, wahl.modus === id, () => { wahl.modus = id; schreiben('wahl', wahl); })));
  $('streckenBlock').hidden = wahl.modus !== 'einzel';
  $('stufenBlock').hidden = wahl.modus === 'online';
  $('onlineBlock').hidden = wahl.modus !== 'online';
  const sw = $('streckenwahl'); sw.innerHTML = '';
  STRECKEN.forEach((s, i) => {
    const rek = rekorde[`${s.id}|${wahl.stufe}`];
    sw.appendChild(wahlKnopf(`<b>${s.name}</b><small>${s.info}</small><small class="rekord">${rek && rek.zeit ? 'Rekord ' + zeitText(rek.zeit) : 'Noch kein Rekord'}</small>`, i === wahl.strecke, () => {
      if (wahl.strecke === i) return;
      wahl.strecke = i; schreiben('wahl', wahl); streckeLaden(i); vorschauZeigen(); Ton.musik('menue');
    }));
  });
  const stw = $('stufenwahl'); stw.innerHTML = '';
  STUFEN.forEach((s, i) => stw.appendChild(wahlKnopf(`<b>${s.name}</b><small>${s.info}</small>`, i === wahl.stufe, () => { wahl.stufe = i; schreiben('wahl', wahl); })));
}
function menueZeigen(ansicht = 'menue'){
  eingabenLeeren(); spurenLeeren();
  cup.aktiv = false;
  if (ansicht !== 'lobby') online.imRennen = false;
  zustand.phase = 'menue'; zustand.pause = false; Ton.pause(false);
  $('menue').hidden = ansicht === 'lobby'; $('lobby').hidden = ansicht !== 'lobby';
  $('hud').hidden = true; $('oben').hidden = true; $('touch').hidden = true;
  $('ergebnis').hidden = true; $('pause').hidden = true;
  wahl.strecke = klemm(wahl.strecke, 0, STRECKEN.length - 1);
  streckeLaden(ansicht === 'lobby' && online.raum ? online.raum.strecke : wahl.strecke);
  vorschauZeigen();
  menueBauen();
  if (ansicht === 'lobby') lobbyBauen();
  Ton.musik('menue');
  Ton.motor(0, false, false); Ton.drift(-1);
}
$('losknopf').onclick = () => {
  Ton.start(); Ton.effekt('klick');
  if (wahl.modus === 'cup') cupStarten(); else { cup.aktiv = false; rennenStarten(); }
};
$('weiterKnopf').onclick = pauseUmschalten;
$('neuKnopf').onclick = () => { pauseUmschalten(); if (cup.aktiv) wahl.strecke = cup.nr; rennenStarten(); };
$('menueKnopf').onclick = () => { if (online.aktiv){ raumVerlassen(); return; } pauseUmschalten(); menueZeigen(); };
$('tonKnopf').onclick = tonUmschalten;
$('pauseKnopf').onclick = pauseUmschalten;
$('tonKnopf').textContent = Ton.istAn() ? '🔊' : '🔇';

/* =========================================================
   Online: Verbindung, Lobby, Abgleich der Karts
   Jeder rechnet nur sein eigenes Kart (der Host zusätzlich die
   Computerfahrer) und schickt dessen Zustand 15-mal pro Sekunde.
   ========================================================= */
const Netz = (() => {
  let ws = null;
  const handler = {};
  function verbinden(){
    return new Promise((ok, nein) => {
      if (ws && ws.readyState === 1) return ok();
      if (ws){ ws.onclose = null; ws.close(); }
      const neu = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      ws = neu;
      neu.onopen = () => ok();
      neu.onerror = () => nein(new Error('Keine Verbindung'));
      neu.onclose = () => { if (ws === neu){ ws = null; if (handler.getrennt) handler.getrennt(); } };
      neu.onmessage = e => {
        let m;
        try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m && typeof m.t === 'string' && handler[m.t]) handler[m.t](m);
      };
    });
  }
  return {
    verbinden,
    senden(m){ if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    on(t, f){ handler[t] = f; },
    trennen(){ if (ws){ const alt = ws; ws = null; alt.onclose = null; alt.close(); } }
  };
})();

function menschenBereich(){
  let mn = Infinity, mx = -Infinity;
  for (const k of karts) if (k.mensch && !k.fertig){ mn = Math.min(mn, k.fortschritt); mx = Math.max(mx, k.fortschritt); }
  return [mn, mx];
}

function netzSenden(dt){
  if (!online.aktiv || !online.imRennen) return;
  online.sendTimer -= dt;
  if (online.sendTimer > 0) return;
  online.sendTimer = 1 / 15;
  const k = karts.filter(k => !k.fern).map(k => [
    k.slot, rund(k.x), rund(k.z), rund(k.y), rund(k.yaw, 1000), rund(k.v, 10), k.drift, k.driftStufe,
    k.dreh > 0 ? rund(k.dreh) : 0, k.boost > 0 ? 1 : 0, k.stern > 0 ? 1 : 0, rund(k.lenkAnzeige), k.runde,
    rund(k.fortschritt, 10), k.offroad ? 1 : 0, rund(k.drehDauer)
  ]);
  if (k.length) Netz.senden({ t:'z', k });
}

// Ferngesteuertes Kart: zur zuletzt gemeldeten Position gleiten und dazwischen weiterrechnen
function fernBewegen(k, dt){
  const n = k.netz;
  if (!n) return;
  // Nur kurz weiterrechnen – bei Aussetzern bleibt das Kart stehen statt durch die Bande zu fahren
  n.alter = (n.alter || 0) + dt;
  if (n.alter < 0.35){
    n.x += Math.sin(n.yaw) * n.v * dt; n.z += Math.cos(n.yaw) * n.v * dt;
    n.fortschritt += n.v * dt;
  }
  const a = 1 - Math.exp(-12 * dt);
  k.x += (n.x - k.x) * a; k.z += (n.z - k.z) * a; k.y += (n.y - k.y) * a;
  k.yaw += winkelDiff(n.yaw, k.yaw) * a;
  k.v = n.v;
  k.drift = Math.sign(n.drift); k.driftStufe = klemm(Math.round(n.driftStufe), 0, 3);
  k.boost = n.boost ? 0.2 : 0; k.stern = n.stern ? 0.2 : 0; k.offroad = !!n.off;
  k.lenkAnzeige += (klemm(n.lenk, -1, 1) - k.lenkAnzeige) * a;
  if (n.dreh > 0.3 && k.dreh <= 0){
    k.dreh = n.dreh; k.drehDauer = n.drehDauer; n.dreh = 0;
    for (let i = 0; i < 12; i++){ const w = Math.random() * TAU; funken.neu(k.x, 1.5, k.z, Math.cos(w) * 5, zufall(3, 7), Math.sin(w) * 5, 0.6, 1, 0.95, 0.5, 0.7, 10); }
  }
  if (k.dreh > 0){
    k.dreh -= dt;
    k.drehWinkel = (1 - Math.max(0, k.dreh) / k.drehDauer) * 2 * TAU;
    if (k.dreh <= 0) k.drehWinkel = 0;
  }
  k.runde = n.runde; k.fortschritt = n.fortschritt;
  const S = strecke;
  k.idx = naechster(S, k.x, k.z, k.idx);
  const i = k.idx;
  k.seite = (k.x - S.px[i]) * S.tz[i] - (k.z - S.pz[i]) * S.tx[i];
}

// Wird man während des Rennens Host, übernimmt man die Computerfahrer
function botsUebernehmen(){
  for (const k of karts){
    if (!k.fern || k.mensch) continue;
    k.fern = false;
    k.werte = werteVon(k.f, true);
    k.idx = k.idxAlt = naechsterGlobal(strecke, k.x, k.z);
    k.maxRunde = k.runde; k.dreh = 0; k.drehWinkel = 0;
  }
}

function onlineZuruecksetzen(){
  Object.assign(online, { aktiv:false, imRennen:false, raum:null, ich:null, host:false });
}
function raumVerlassen(){
  Netz.senden({ t:'verlassen' });
  Netz.trennen();
  onlineZuruecksetzen();
  menueZeigen();
}

Netz.on('raum', m => {
  const warHost = online.host;
  Object.assign(online, { aktiv:true, raum:m, ich:m.du, host:m.host === m.du });
  $('onlineFehler').textContent = '';
  if (online.imRennen){
    if (m.phase === 'lobby'){ menueZeigen('lobby'); return; }
    if (!warHost && online.host) botsUebernehmen();
    if (zustand.phase === 'ergebnis') ergebnisKnoepfeOnline();
    return;
  }
  if ($('lobby').hidden || zustand.phase !== 'menue') menueZeigen('lobby'); else lobbyBauen();
});

Netz.on('fehler', m => {
  const text = String(m.text || 'Das hat nicht geklappt.');
  if (!$('lobby').hidden) $('lobbyInfo').textContent = text; else $('onlineFehler').textContent = text;
});

Netz.on('getrennt', () => {
  if (!online.aktiv) return;
  onlineZuruecksetzen();
  menueZeigen();
  $('onlineFehler').textContent = 'Die Verbindung zum Server ist abgebrochen.';
});

Netz.on('start', m => {
  if (!online.aktiv || !Array.isArray(m.slots)) return;
  const slots = m.slots.map(sl => {
    const ich = sl.id === online.ich;
    return {
      fahrer:klemm(sl.fahrer | 0, 0, FAHRER.length - 1), name:sl.bot ? null : String(sl.name || 'Fahrer').slice(0, 16),
      mensch:!sl.bot, ich, fern:!ich && !(sl.bot && online.host)
    };
  });
  if (!slots.some(sl => sl.ich)) return;
  online.imRennen = true;
  online.wegNamen = {};
  online.rennenNr = (online.rennenNr || 0) + 1;
  $('menue').hidden = true;
  rennenStarten({ strecke:klemm(m.strecke | 0, 0, STRECKEN.length - 1), stufe:klemm(m.stufe | 0, 0, STUFEN.length - 1), slots });
});

Netz.on('z', m => {
  if (!online.imRennen || !Array.isArray(m.k)) return;
  for (const e of m.k){
    if (!Array.isArray(e) || e.length < 16 || !e.every(zahlOk)) continue;
    const k = karts.find(x => x.slot === e[0]);
    if (!k || !k.fern) continue;
    const n = {
      x:e[1], z:e[2], y:klemm(e[3], 0, 20), yaw:e[4], v:klemm(e[5], -20, 80), drift:e[6], driftStufe:e[7], dreh:e[8],
      boost:e[9], stern:e[10], lenk:e[11], runde:e[12], fortschritt:e[13], off:e[14], drehDauer:klemm(e[15], 0.2, 3)
    };
    if (!k.netz || Math.hypot(n.x - k.x, n.z - k.z) > 20){ k.x = n.x; k.z = n.z; k.yaw = n.yaw; k.idx = naechsterGlobal(strecke, k.x, k.z); }
    k.netz = n;
  }
});

Netz.on('e', m => {
  if (!online.imRennen || !strecke) return;
  const S = strecke;
  switch (m.a){
    case 'b':
      if ([m.x, m.z].every(zahlOk) && Number.isInteger(m.idx) && typeof m.id === 'string' && !bananen.some(b => b.id === m.id))
        bananeLegen(m.x, m.z, klemm(m.idx, 0, S.N - 1), m.id);
      break;
    case 'bw': { const i = bananen.findIndex(b => b.id === m.id); if (i >= 0) bananeWeg(i); break; }
    case 'r': {
      if (![m.x, m.z, m.yaw, m.seite].every(zahlOk) || !Number.isInteger(m.idx) || typeof m.id !== 'string') break;
      const von = karts.find(k => k.slot === m.von) || null, ziel = karts.find(k => k.slot === m.ziel) || null;
      raketeBauen({ id:m.id, x:m.x, z:m.z, yaw:m.yaw, idx:klemm(m.idx, 0, S.N - 1), seite:m.seite, besitzer:von, ziel, t:0 });
      break;
    }
    case 'rw': { const i = raketen.findIndex(r => r.id === m.id); if (i >= 0) raketeWeg(i); break; }
    case 'x': { const b = S.boxen[m.i]; if (b && b.aus <= 0) boxWeg(b); break; }
  }
});

Netz.on('ziel', m => {
  const k = karts.find(x => x.slot === m.slot);
  if (k && k.fern && zahlOk(m.zeit)){ k.fertig = true; k.zielzeit = m.zeit; }
});

Netz.on('weg', m => {
  const i = karts.findIndex(k => k.slot === m.slot);
  if (i >= 0 && karts[i].fern){
    online.wegNamen[m.slot] = `${karts[i].f.gesicht} ${esc(karts[i].name)}`;
    meldung(`${karts[i].name} hat das Rennen verlassen`, 2, true);
    karts[i].entfernen(); karts.splice(i, 1);
  }
});

Netz.on('ende', m => {
  if (!online.imRennen || !Array.isArray(m.rang)) return;
  // Den eigenen Zieleinlauf noch kurz genießen lassen
  const nr = online.rennenNr;
  const warten = spieler && spieler.fertig ? Math.max(0, zustand.zielMoment + 3 - zeit) : 0;
  setTimeout(() => { if (online.imRennen && online.rennenNr === nr) ergebnisOnline(m.rang); }, warten * 1000);
});

function ergebnisOnline(rang){
  zustand.phase = 'ergebnis';
  if (spieler) spieler.autopilot = true;
  $('pause').hidden = true;
  // Computerfahrer, die noch unterwegs sind, bekommen wie offline eine geschätzte Zeit
  let vorige = 0;
  const zeilen = rang.map((r, i) => {
    const k = karts.find(x => x.slot === r.slot);
    const name = k ? `${k.f.gesicht} ${esc(k.name)}` : online.wegNamen[r.slot] || '–';
    let zeit = zahlOk(r.zeit) ? r.zeit : null;
    if (zeit == null && k && !k.mensch && !r.weg){
      zeit = Math.max(vorige + 0.3, zustand.rt + Math.max(0, (RUNDEN + 1) * strecke.L - k.fortschritt) / (k.werte.maxV * 0.85));
    }
    if (zeit != null) vorige = zeit;
    const zeitTxt = zeit != null ? zeitText(zeit) : r.weg ? 'raus' : 'nicht im Ziel';
    return `<tr class="${k && k.spieler ? 'ich' : ''}"><td>${i + 1}.</td><td>${name}</td><td class="r">${zeitTxt}</td></tr>`;
  });
  const platz = rang.findIndex(r => spieler && r.slot === spieler.slot) + 1;
  $('ergebnisTitel').textContent = platz === 1 ? '🏆 Sieg!' : platz >= 2 && platz <= 3 ? `${platz}. Platz – Podium!` : platz ? `${platz}. Platz` : 'Ergebnis';
  $('ergebnisText').innerHTML = '<table>' + zeilen.join('') + '</table><p class="leise" id="ergebnisHinweis" style="margin-top:10px"></p>';
  ergebnisKnoepfeOnline();
  $('ergebnis').hidden = false;
  $('touch').hidden = true;
}
function ergebnisKnoepfeOnline(){
  const knoepfe = $('ergebnisKnoepfe');
  knoepfe.innerHTML = '';
  const knopf = (text, haupt, fn) => { const b = document.createElement('button'); b.className = 'knopf' + (haupt ? ' haupt' : ''); b.textContent = text; b.onclick = () => { Ton.effekt('klick'); fn(); }; knoepfe.appendChild(b); };
  if (online.host){
    knopf('Nochmal', true, () => Netz.senden({ t:'start' }));
    knopf('Zur Lobby', false, () => Netz.senden({ t:'lobby' }));
  }
  knopf('Raum verlassen', false, raumVerlassen);
  const hinweis = $('ergebnisHinweis');
  if (hinweis) hinweis.textContent = online.host ? 'Du bist Host: Starte das nächste Rennen oder geh zurück in die Lobby.' : 'Der Host startet gleich das nächste Rennen.';
}

function lobbyBauen(){
  const m = online.raum;
  if (!m) return;
  $('raumCode').textContent = m.code;
  $('lobbySpieler').innerHTML = m.spieler.map(sp =>
    `<div>${(FAHRER[sp.fahrer] || FAHRER[0]).gesicht} <b>${esc(sp.name)}</b>${sp.id === online.ich ? ' (du)' : ''}${sp.id === m.host ? '<small>Host</small>' : ''}</div>`).join('');
  const ich = m.spieler.find(sp => sp.id === online.ich);
  const meinFahrer = ich ? ich.fahrer : wahl.fahrer;
  const lf = $('lobbyFahrer');
  lf.innerHTML = '';
  FAHRER.forEach((f, i) => lf.appendChild(wahlKnopf(`<span class="gesicht">${f.gesicht}</span>${f.name}`, i === meinFahrer, () => {
    wahl.fahrer = i; schreiben('wahl', wahl); vorschauZeigen(); Netz.senden({ t:'fahrer', fahrer:i });
  }, () => {})));
  const ei = $('lobbyEinst');
  ei.innerHTML = '';
  if (online.host){
    const einst = aenderung => Netz.senden({ t:'einst', strecke:m.strecke, stufe:m.stufe, bots:m.bots, ...aenderung });
    const r1 = document.createElement('div'), r2 = document.createElement('div');
    r1.className = r2.className = 'reihe';
    STRECKEN.forEach((st, i) => r1.appendChild(wahlKnopf(`<b>${st.name}</b>`, i === m.strecke, () => einst({ strecke:i }), () => {})));
    STUFEN.forEach((st, i) => r2.appendChild(wahlKnopf(`<b>${st.name}</b><small>${st.info}</small>`, i === m.stufe, () => einst({ stufe:i }), () => {})));
    const sch = document.createElement('label');
    sch.className = 'schalter';
    sch.innerHTML = `<input type="checkbox" ${m.bots ? 'checked' : ''}> Freie Plätze mit Computerfahrern auffüllen`;
    sch.querySelector('input').onchange = e => einst({ bots:e.target.checked });
    ei.append(r1, r2, sch);
  } else {
    ei.innerHTML = `<p class="leise">${esc(STRECKEN[m.strecke].name)} · ${esc(STUFEN[m.stufe].name)} · Computerfahrer ${m.bots ? 'an' : 'aus'}</p>`;
  }
  $('lobbyStart').hidden = !online.host;
  $('lobbyStart').disabled = m.phase === 'rennen';
  $('lobbyInfo').textContent = m.phase === 'rennen' ? 'Gerade läuft ein Rennen. Beim nächsten bist du dabei.'
    : m.phase === 'ergebnis' ? 'Das Rennen ist gerade vorbei, gleich geht es weiter.'
    : online.host ? (m.spieler.length > 1 ? 'Starte, wenn alle da sind.' : 'Warte auf Freunde oder starte schon mal allein.')
    : 'Warte, bis der Host das Rennen startet.';
  // Hintergrund: Strecke des Raums und eigener Fahrer
  if (!strecke || strecke.nr !== m.strecke){ streckeLaden(m.strecke); vorschauZeigen(); }
  else if (vorschau && vorschau.f !== FAHRER[meinFahrer]){ wahl.fahrer = meinFahrer; vorschauZeigen(); }
}

$('nameFeld').value = lesen('name', '');
async function onlineLos(nachricht){
  const name = $('nameFeld').value.trim();
  if (!name){ $('onlineFehler').textContent = 'Gib zuerst einen Spitznamen ein.'; $('nameFeld').focus(); return; }
  schreiben('name', name);
  $('onlineFehler').textContent = 'Verbinde …';
  try { await Netz.verbinden(); } catch (e) { $('onlineFehler').textContent = 'Keine Verbindung zum Server. Bist du online?'; return; }
  Netz.senden({ ...nachricht, name, fahrer:wahl.fahrer });
}
$('raumNeu').onclick = () => { Ton.start(); Ton.effekt('klick'); onlineLos({ t:'erstellen' }); };
$('raumRein').onclick = () => {
  Ton.start(); Ton.effekt('klick');
  const code = $('codeFeld').value.trim().toUpperCase();
  if (code.length !== 4){ $('onlineFehler').textContent = 'Der Code hat 4 Zeichen.'; $('codeFeld').focus(); return; }
  onlineLos({ t:'beitreten', code });
};
$('codeFeld').addEventListener('keydown', e => { if (e.key === 'Enter') $('raumRein').click(); });
$('lobbyStart').onclick = () => { Ton.effekt('klick'); Netz.senden({ t:'start' }); };
$('lobbyRaus').onclick = () => { Ton.effekt('klick'); raumVerlassen(); };

/* =========================================================
   Hauptschleife
   ========================================================= */
function schritt(dt){
  zeit += dt;
  const S = strecke;
  if (zustand.phase === 'menue'){
    if (vorschau){ vorschau.eingabe = { gas:false, bremse:false, lenk:Math.sin(zeit * 0.8) * 0.6, drift:false, item:false }; vorschau.lenkAnzeige = vorschau.eingabe.lenk; kartDarstellen(vorschau, dt); }
  } else if (zustand.phase === 'countdown'){
    countdown(dt);
    for (const k of karts){
      if (k.fern){ fernBewegen(k, dt); continue; }
      if (!k.spieler) k.eingabe = { gas:false, bremse:false, lenk:0, drift:false, item:false };
      kartBewegen(k, dt);
    }
  } else if (zustand.phase === 'rennen' || zustand.phase === 'auslauf'){
    rennenUpdate(dt);
  }
  for (const k of karts){ kartDarstellen(k, dt); kartEffekte(k); }
  boxenUpdate(dt);
  spurenUpdate(dt);
  for (const b of bananen) b.mesh.rotation.y += dt * 0.5;
  funken.update(dt); staub.update(dt);
  if (S.wolken) S.wolken.rotation.y += dt * 0.004;
  if (S.schnee){
    const p = S.schnee.geometry.attributes.position, a = p.array, cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < a.length; i += 3){
      a[i + 1] -= dt * (4 + (i % 7) * 0.4); a[i] += Math.sin(zeit + i) * dt * 0.6;
      if (a[i + 1] < 0 || Math.abs(a[i] - cx) > 70 || Math.abs(a[i + 2] - cz) > 70){ a[i] = cx + zufall(-70, 70); a[i + 1] = zufall(20, 45); a[i + 2] = cz + zufall(-70, 70); }
    }
    p.needsUpdate = true;
  }
  if (zustand.phase !== 'menue'){
    const k = spieler;
    Ton.motor(k.v, k.boost > 0, zustand.phase !== 'ergebnis');
    Ton.drift(k.drift && k.y < 0.05 ? k.driftStufe : -1);
    hudUpdate();
    netzSenden(dt);
  }
  kameraUpdate(dt);
}

let letzte = performance.now();
function schleife(jetzt){
  requestAnimationFrame(schleife);
  let dt = Math.min(0.05, (jetzt - letzte) / 1000);
  letzte = jetzt;
  if (zustand.pause){ renderer.render(scene, camera); return; }
  // Bei ruckelnden Geräten in kleineren Schritten rechnen
  const teile = dt > 0.026 ? 2 : 1;
  for (let i = 0; i < teile; i++) schritt(dt / teile);
  renderer.render(scene, camera);
}

// Zum Testen in der Konsole
window.loewenkart = {
  zustand, wahl, online, get karts(){ return karts; }, get strecke(){ return strecke; },
  get bananen(){ return bananen; }, get raketen(){ return raketen; },
  sim(sekunden, dt = 1 / 60){ for (let t = 0; t < sekunden; t += dt) schritt(dt); renderer.render(scene, camera); }
};

for (const id of ['grafikWahl','pauseGrafik']) $(id).onchange = e => {
  grafik.modus = e.target.value; schreiben('grafik',grafik.modus); grafikAnwenden();
};
menueZeigen();
grafikAnwenden();
requestAnimationFrame(schleife);
})();
