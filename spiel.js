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
    himmelWolke:['#ffffff', 0.85],
    himmel:['#2f7fd8', '#cfe9ff'], nebel:'#cfe6fb', nebelWeit:[260, 1150], sonne:'#fff1d8', sonnenKraft:2.2,
    hemi:['#dcefff', '#6d8a45'], hemiKraft:0.95, gras:['#5ea944', '#4f9838', '#6bbb50'], auslauf:'#b79b64',
    strasse:'#595d64', wand:[0xe8322a, 0xf5f5f5], berge:0x5d8b52, staub:[0.55, 0.45, 0.3], deko:'baeume', wolken:true,
    neon:0xffc21f, kulisse:['ballons', 'windraeder']
  },
  wueste: {
    himmelWolke:['#ffe0bc', 0.45],
    himmel:['#d9683a', '#ffd6a0'], nebel:'#f5c793', nebelWeit:[220, 1000], sonne:'#ffd9a8', sonnenKraft:2.4,
    hemi:['#ffe2bd', '#a0643a'], hemiKraft:0.85, gras:['#e2bb78', '#d6aa63', '#ebc98a'], auslauf:'#c4935a',
    strasse:'#65605c', wand:[0xff8a1a, 0xfff1dc], berge:0xc0683a, staub:[0.85, 0.66, 0.4], deko:'kakteen', wolken:false,
    neon:0xff6a1a, gefahr:'steppe'
  },
  frost: {
    himmelWolke:['#f3f7fc', 0.9],
    himmel:['#7aa5d8', '#eef4fb'], nebel:'#e4edf6', nebelWeit:[130, 820], sonne:'#f4f8ff', sonnenKraft:1.7,
    hemi:['#eef5ff', '#9aa9ba'], hemiKraft:1.15, gras:['#f1f5fa', '#e3eaf2', '#fbfdff'], auslauf:'#c3d2e2',
    strasse:'#4a4f57', wand:[0x2f7fd8, 0xf4f8ff], berge:0xdbe5f0, staub:[0.95, 0.97, 1], deko:'tannen', wolken:true, schnee:true,
    neon:0x4fd2ff, gefahr:'eis', kulisse:['polarlicht']
  },
  strand: {
    himmelWolke:['#ffffff', 0.75],
    himmel:['#1f8fe0', '#c4ecff'], nebel:'#cdeefa', nebelWeit:[260, 1200], sonne:'#fff4dc', sonnenKraft:2.3,
    hemi:['#e2f4ff', '#c9a66b'], hemiKraft:1.0, gras:['#e9d29a', '#dfc386', '#f3e0b0'], auslauf:'#c9a46a',
    strasse:'#5c6068', wand:[0x1fb5c9, 0xfff6e0], berge:0x4f9a5a, staub:[0.92, 0.84, 0.62], deko:'palmen', wolken:true, meer:true,
    neon:0x18e0c8, kulisse:['ballons', 'delfine', 'boote']
  },
  vulkan: {
    himmelWolke:['#4a2620', 0.8],
    himmel:['#2a1416', '#c4502a'], nebel:'#6a3424', nebelWeit:[160, 950], sonne:'#ffb07a', sonnenKraft:1.7,
    hemi:['#ffa070', '#2a1a18'], hemiKraft:0.95, gras:['#2f2a2a', '#3a3232', '#262222'], auslauf:'#4f413a',
    strasse:'#3c3d42', wand:[0xff5a1a, 0x2a2a2e], berge:0x3a2a26, staub:[0.32, 0.28, 0.26], deko:'vulkan', wolken:false, glut:true,
    neon:0xff3a0a, gefahr:'meteor'
  },
  nacht: {
    himmelWolke:['#28366a', 0.4],
    himmel:['#060b24', '#2d3d72'], nebel:'#1b2550', nebelWeit:[150, 950], sonne:'#b9c8ff', sonnenKraft:1.2,
    hemi:['#8090d8', '#1d2a3a'], hemiKraft:0.9, gras:['#2c5a3a', '#264f33', '#336843'], auslauf:'#5a5a66',
    strasse:'#3d4250', wand:[0xb35cff, 0xf0f0ff], berge:0x1f2c4a, staub:[0.4, 0.42, 0.5], deko:'laternen', wolken:false, sterne:true,
    neon:0xc45aff, kulisse:['feuerwerk'], skyline:true
  },
  himmel: {
    himmelWolke:['#fff0f8', 0.55],
    himmel:['#3b2f86', '#ffb59a'], nebel:'#f3c4c8', nebelWeit:[300, 1500], sonne:'#ffd8b0', sonnenKraft:2.0,
    hemi:['#ffe9f4', '#8f7cc4'], hemiKraft:1.1, gras:['#8fdc72', '#7ccf62', '#a3e886'], auslauf:'#cfc6e8',
    strasse:'#4d4b66', wand:[0xff5fa8, 0xf6f2ff], berge:0xffffff, staub:[0.96, 0.92, 1], deko:'himmel', wolken:true,
    neon:0xff6ad5, schwebend:true, kulisse:['ballons']
  }
};
// Strecken nach F1-Vorbildern: Ecken [x, z, Kurvenradius]; Radius 0 = Punkt auf einer Geraden
const STRECKEN = [
  { id:'wiese', name:'Löwenwiese', info:'Schnelle Bögen wie in Silverstone', thema:'wiese', breite:17, saat:11,
    ecken:[[0,0,0],[200,0,30],[260,60,35],[240,130,24],[285,180,24],[235,235,22],[90,225,20],[60,160,14],[15,175,14],[-70,145,40],[-85,55,30],[-40,0,25]] },
  { id:'wueste', name:'Kaktus-Canyon', info:'Haarnadeln wie in Bahrain', thema:'wueste', breite:16, saat:22,
    ecken:[[0,0,0],[230,0,16],[250,-45,14],[195,-70,18],[235,-145,24],[150,-205,30],[60,-175,14],[95,-120,12],[15,-100,16],[-80,-195,26],[-155,-150,20],[-125,-60,28],[-45,0,25]] },
  { id:'frost', name:'Frostgipfel', info:'Lange Geraden wie in Spa', thema:'frost', breite:16, saat:33,
    ecken:[[0,0,0],[130,0,13],[135,-40,13],[60,-55,30],[40,-90,30],[-60,-240,40],[-140,-250,16],[-150,-200,16],[-100,-170,40],[-110,-60,35],[-200,-20,30],[-170,50,22],[-60,25,12],[-40,0,12]] },
  { id:'strand', name:'Palmenbucht', info:'Hafen-Schikanen wie in Monaco', thema:'strand', breite:17, saat:44,
    ecken:[[0,0,0],[150,0,14],[175,55,30],[150,110,20],[215,150,12],[235,205,11],[180,200,12],[90,170,25],[45,190,9],[20,175,9],[-10,200,30],[-110,160,14],[-90,130,10],[-130,100,14],[-160,40,20],[-120,0,14]] },
  { id:'vulkan', name:'Vulkankrater', info:'Kurvenwechsel wie in Interlagos', thema:'vulkan', breite:16, saat:55,
    ecken:[[0,0,0],[170,0,16],[185,40,16],[140,70,28],[200,140,30],[150,210,18],[70,170,22],[100,110,14],[30,90,14],[-30,170,30],[-120,140,16],[-90,80,14],[-160,40,30],[-110,0,40]] },
  { id:'nacht', name:'Sternenpark', info:'Stadtkurs bei Nacht wie in Las Vegas', thema:'nacht', breite:16, saat:66,
    ecken:[[0,0,0],[240,0,12],[240,90,12],[170,90,12],[150,120,12],[170,150,12],[170,220,14],[-40,220,12],[-40,170,12],[-100,150,12],[-100,60,12],[-60,40,12],[-60,0,12]] },
  // Achterbahn über den Wolken: kreuzt sich selbst (oben die Überführung), Kuppen zum Abheben, Regenbogenbrücke als Abkürzung
  { id:'himmel', name:'Wolkenreich', info:'Achterbahn über den Wolken mit Überführung', thema:'himmel', breite:16, saat:77,
    ecken:[[0,0,0],[200,0,35],[260,70,40],[230,140,30],[-20,320,35],[-30,420,40],[100,480,45],[230,420,40],[220,320,35],[-30,140,30],[-70,60,35],[-50,0,25]],
    profil:[[0,0],[0.08,0],[0.2,14],[0.28,22],[0.365,22],[0.39,8],[0.45,7],[0.53,24],[0.64,30],[0.665,13],[0.72,4],[0.8,2],[0.86,10],[0.92,4],[0.97,0]],
    abk:[[0.41, 0.5, 0.69, 0.78, 'bruecke']] }
];
const CUPS = [
  { id:'loewe',  name:'Löwen-Cup',  info:'Wiese, Canyon, Frost',    strecken:[0, 1, 2] },
  { id:'vulkan', name:'Vulkan-Cup', info:'Bucht, Krater, Nacht',    strecken:[3, 4, 5] },
  { id:'meister', name:'Meister-Cup', info:'Alle 7 Strecken am Stück', strecken:[0, 3, 1, 4, 2, 5, 6] },
  { id:'himmel', name:'Himmels-Cup', info:'Nacht, Frost, Wolken',      strecken:[5, 2, 6] }
];
const ITEM_ICON = { turbo:'⚡', turbo3:'⚡', banane:'🍌', rakete:'🚀', stern:'⭐', blitz:'🌩️' };
const RUNDEN = 3;
const PUNKTE = [15, 12, 10, 8, 6, 4, 2, 1];
const SPIELER_STARTPLATZ = 5;

const wahl = Object.assign({ fahrer:0, strecke:0, stufe:1, modus:'einzel', cup:0 }, lesen('wahl', {}));
if (!FAHRER[wahl.fahrer]) wahl.fahrer = 0;
if (!STRECKEN[wahl.strecke]) wahl.strecke = 0;
if (!STUFEN[wahl.stufe]) wahl.stufe = 1;
if (!CUPS[wahl.cup]) wahl.cup = 0;
const rekorde = lesen('rekorde', {});
const pokale = lesen('pokale', {});
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
const himmelUni = { oben:{ value:new THREE.Color() }, horizont:{ value:new THREE.Color() }, wolkenFarbe:{ value:new THREE.Color(1, 1, 1) }, wolkenMenge:{ value:0 }, zeit:{ value:0 } };
const himmel = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({
  uniforms:himmelUni, side:THREE.BackSide, depthWrite:false, fog:false,
  vertexShader:'varying vec3 vP;\nvoid main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader:[
    'uniform vec3 oben;', 'uniform vec3 horizont;', 'uniform vec3 wolkenFarbe;', 'uniform float wolkenMenge;', 'uniform float zeit;', 'varying vec3 vP;',
    'float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float rausch(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float fbm(vec2 p){ float a = 0.5, v = 0.0; for (int i = 0; i < 4; i++){ v += a * rausch(p); p = p * 2.03 + vec2(17.0, 3.0); a *= 0.5; } return v; }',
    'void main(){',
    '  vec3 d = normalize(vP);',
    '  float h = clamp(d.y * 1.7, 0.0, 1.0);',
    '  vec3 col = mix(horizont, oben, pow(h, 0.65));',
    // Dunstband am Horizont und Sonnenhof
    '  col = mix(col, horizont * 1.06, exp(-max(d.y, 0.0) * 7.0) * 0.4);',
    '  vec3 sd = normalize(vec3(70.0, 130.0, 45.0));',
    '  float sun = max(0.0, dot(d, sd));',
    '  col += vec3(1.0, 0.78, 0.42) * (pow(sun, 28.0) * 0.18 + pow(sun, 650.0) * 1.3);',
    // Wolkenschicht: Rauschen auf eine Ebene projiziert, driftet langsam; sonnennahe Raender leuchten
    '  if (wolkenMenge > 0.01 && d.y > 0.015){',
    '    vec2 uv = d.xz / (d.y + 0.28) * 1.7 + vec2(zeit * 0.012, zeit * 0.005);',
    '    float n = fbm(uv);',
    '    float c = smoothstep(0.66 - 0.2 * wolkenMenge, 0.9 - 0.12 * wolkenMenge, n) * smoothstep(0.015, 0.2, d.y);',
    '    float tief = smoothstep(0.45, 0.95, n);',
    '    vec3 cc = mix(wolkenFarbe * 0.72, wolkenFarbe, tief) + vec3(1.0, 0.85, 0.6) * pow(sun, 6.0) * 0.25 * (1.0 - tief);',
    '    col = mix(col, cc, c * 0.92);',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '#include <tonemapping_fragment>',
    '#include <encodings_fragment>',
    '}'
  ].join('\n')
}));
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
  // Turbo-Feld: dunkles Orange mit leuchtenden Doppelpfeilen und Randlinien
  const grund = c.createLinearGradient(0, 0, w, 0);
  grund.addColorStop(0, 'rgba(60,20,0,.72)'); grund.addColorStop(0.5, 'rgba(110,40,0,.6)'); grund.addColorStop(1, 'rgba(60,20,0,.72)');
  c.fillStyle = grund; c.fillRect(0, 0, w, w);
  c.fillStyle = '#ffe28a'; c.fillRect(0, 0, 5, w); c.fillRect(w - 5, 0, 5, w);
  for (const y of [8, 72]){
    const g = c.createLinearGradient(0, y, 0, y + 60);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ffc21f'); g.addColorStop(1, '#ff7a14');
    c.shadowColor = 'rgba(255,170,30,.9)'; c.shadowBlur = 10;
    c.fillStyle = g;
    c.beginPath(); c.moveTo(14, y + 44); c.lineTo(64, y); c.lineTo(114, y + 44); c.lineTo(114, y + 60); c.lineTo(64, y + 18); c.lineTo(14, y + 60); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.stroke();
  }
}, true);

// Geteilte Ressourcen (Modell-Vorlagen) werden beim Entfernen eines Karts nicht freigegeben.
const GETEILT = new WeakSet();
const geteilt = o => { GETEILT.add(o); return o; };
// Box mit abgerundeten Kanten: weiche Karosserie statt Klötzchen.
function rundBox(w, h, d, r, seg = 4){
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++){
    v.fromBufferAttribute(p, i);
    c.set(klemm(v.x, -ix, ix), klemm(v.y, -iy, iy), klemm(v.z, -iz, iz));
    nn.subVectors(v, c);
    if (nn.lengthSq() < 1e-9) continue;
    nn.normalize();
    v.copy(c).addScaledVector(nn, r);
    p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, nn.x, nn.y, nn.z);
  }
  return g;
}

// Grossflaechige helle/dunkle Flecken: bricht die Kachelwiederholung des Bodens auf (wird per Shader ueber die Weltkoordinaten gelegt).
const fleckTex = (() => {
  const t = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    const rnd = zufallsGen(7);
    for (let n = 0; n < 260; n++){
      const x = rnd() * w, y = rnd() * h, r = 24 + rnd() * 90, hell = rnd() < 0.5 ? 255 : 0, a = 0.05 + rnd() * 0.12;
      for (const [dx, dy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]){
        const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, `rgba(${hell},${hell},${hell},${a})`); g.addColorStop(1, `rgba(${hell},${hell},${hell},0)`);
        c.fillStyle = g; c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }, true);
  t.encoding = THREE.LinearEncoding;
  return geteilt(t);
})();
/* =========================================================
   Geteilte Geometrien und Materialien
   ========================================================= */
const GEO = {
  box:new THREE.BoxGeometry(1, 1, 1),
  kugel:new THREE.SphereGeometry(1, 20, 14),
  kugelGrob:new THREE.SphereGeometry(1, 8, 6),
  kugelMittel:new THREE.SphereGeometry(1, 12, 9),
  zyl:new THREE.CylinderGeometry(1, 1, 1, 16),
  zylGrob:new THREE.CylinderGeometry(1, 1, 1, 8),
  zyl16:new THREE.CylinderGeometry(1, 1, 1, 16),
  kegel:new THREE.ConeGeometry(1, 1, 14),
  kegelGrob:new THREE.ConeGeometry(1, 1, 8),
  rad:new THREE.CylinderGeometry(0.46, 0.46, 0.42, 18),
  radHinten:new THREE.CylinderGeometry(0.52, 0.52, 0.5, 18),
  schatten:new THREE.PlaneGeometry(3.8, 4.8),
  lenkrad:new THREE.TorusGeometry(0.22, 0.05, 8, 16),
  banane:new THREE.TorusGeometry(0.42, 0.15, 8, 14, Math.PI * 0.95),
  box16:geteilt(rundBox(1.7, 1.7, 1.7, 0.24)),
  okta:new THREE.OctahedronGeometry(1, 0),
  scheibe:(() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })()
};
const std = (farbe, rau = 0.6, metall = 0) => new THREE.MeshStandardMaterial({ color:lin(farbe), roughness:rau, metalness:metall });
const MAT = {
  kontakt:new THREE.MeshBasicMaterial({ map:partikelTex, color:0x080c12, transparent:true, opacity:0.36, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5 }),
  licht:new THREE.MeshBasicMaterial({ color:0xffe8bd }),
  ruecklicht:new THREE.MeshBasicMaterial({ color:0xff3427 }),
  dunkel:std(0x2a2d33, 0.6), metall:Object.assign(std(0xc4cad3, 0.35, 0.7), { envMapIntensity:0.55 }), reifen:std(0x1a1a1e, 0.9), auge:std(0x111111, 0.25),
  weiss:std(0xf6f6f6, 0.6), banane:std(0xffd83a, 0.5), braun:std(0x5a3a1a, 0.8), rot:std(0xe8322a, 0.4),
  laub:new THREE.MeshPhongMaterial({ color:0xffffff, flatShading:true, shininess:0, specular:0x000000 }),
  stamm:new THREE.MeshLambertMaterial({ color:lin(0x6b4424) }),
  weissL:new THREE.MeshLambertMaterial({ color:lin(0xfafcff) }),
  bunt:new THREE.MeshLambertMaterial({ color:0xffffff }),
  itemBox:new THREE.MeshStandardMaterial({ map:boxTex, transparent:true, opacity:0.92, roughness:0.2, metalness:0.1, emissive:new THREE.Color(0x000000), side:THREE.DoubleSide, depthWrite:false }),
  flamme:new THREE.MeshBasicMaterial({ color:0xff7a1a, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending, depthWrite:false }),
  flammeKern:new THREE.MeshBasicMaterial({ color:0xfff0b0, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false }),
  glutSprite:new THREE.SpriteMaterial({ map:partikelTex, color:0xff9a3a, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false }),
  pad:new THREE.MeshBasicMaterial({ map:pfeilTex, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4 }),
  itemKern:new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.95 }),
  itemHalo:new THREE.SpriteMaterial({ map:partikelTex, color:0xffffff, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false }),
  itemFleck:new THREE.MeshBasicMaterial({ map:partikelTex, color:0xffffff, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5 }),
  blitz:new THREE.MeshBasicMaterial({ color:0xf4fbff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false }),
  blitzGlow:new THREE.MeshBasicMaterial({ color:0x6aa8ff, transparent:true, opacity:0.45, blending:THREE.AdditiveBlending, depthWrite:false, fog:false }),
  blitzSprite:new THREE.SpriteMaterial({ map:partikelTex, color:0xbcd8ff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false }),
  lava:new THREE.MeshBasicMaterial({ color:lin(0xff6a10) }),
  glut:new THREE.MeshBasicMaterial({ color:lin(0xff3a08) }),
  lampe:new THREE.MeshBasicMaterial({ color:lin(0xffe6a8) }),
  lichtkegel:new THREE.MeshBasicMaterial({ map:partikelTex, color:0xffb84a, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6 })
};
function teil(geo, mat, eltern, x, y, z, sx = 1, sy = 1, sz = 1){
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;
  eltern.add(m);
  return m;
}


// Fasst alle direkten Mesh-Kinder einer Gruppe nach Material zu je einem Mesh zusammen (weniger Draw-Calls).
// Ergebnis: Liste [Material, Geometrie]; die Gruppe selbst wird dabei geleert.
function verschmelzen(gruppe){
  gruppe.updateMatrixWorld(true);
  const proMat = new Map();
  for (const ch of gruppe.children.slice()){
    if (!ch.isMesh) continue;
    ch.updateMatrix();
    const g = (ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone()).applyMatrix4(ch.matrix);
    if (!proMat.has(ch.material)) proMat.set(ch.material, []);
    proMat.get(ch.material).push(g);
    gruppe.remove(ch);
  }
  const ergebnis = [];
  for (const [mat, liste] of proMat){
    let n = 0; for (const g of liste) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of liste){
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    ergebnis.push([mat, geteilt(geo)]);
  }
  return ergebnis;
}

/* =========================================================
   Kart-Modell mit Tierfahrer
   ========================================================= */
const kopfVorlagen = {};
function kopfBauen(tier){
  if (!kopfVorlagen[tier]){
    const roh = kopfRoh(tier), vorlage = new THREE.Group();
    for (const [mat, geo] of verschmelzen(roh)){ geteilt(mat); const m = new THREE.Mesh(geo, mat); m.castShadow = true; vorlage.add(m); }
    kopfVorlagen[tier] = vorlage;
  }
  return kopfVorlagen[tier].clone();
}
const glanz = new THREE.MeshBasicMaterial({ color:0xffffff });
function kopfRoh(tier){
  const k = new THREE.Group();
  const M = c => std(c, 0.75);
  // Augen mit kleinem Glanzpunkt: wirken sofort lebendig
  const augen = (y, abstand, z, r = 0.075) => {
    for (const sg of [-1, 1]){
      teil(GEO.kugelMittel, MAT.auge, k, sg * abstand, y, z, r, r, r);
      teil(GEO.kugelGrob, glanz, k, sg * abstand + r * 0.3, y + r * 0.38, z + r * 0.72, r * 0.32, r * 0.32, r * 0.32).castShadow = false;
    }
  };
  switch (tier){
    case 'loewe': {
      const fell = M(0xf2b845), mane1 = M(0xb4561c), mane2 = M(0xd0782a);
      teil(GEO.kugel, mane1, k, 0, 0.02, -0.12, 0.82, 0.82, 0.55);
      // Maehne aus Buescheln rund um das Gesicht
      for (let n = 0; n < 11; n++){
        const w = n / 11 * TAU + 0.2, rr = 0.66;
        teil(GEO.kugelMittel, n % 2 ? mane2 : mane1, k, Math.cos(w) * rr, 0.02 + Math.sin(w) * rr * 0.95, -0.1 + (n % 3) * 0.03, 0.27, 0.27, 0.22);
      }
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
      teil(GEO.kegel, M(0x3a1a12), k, -0.28, 0.53, 0.04, 0.09, 0.26, 0.06).rotation.z = 0.3;
      teil(GEO.kegel, M(0x3a1a12), k, 0.28, 0.53, 0.04, 0.09, 0.26, 0.06).rotation.z = -0.3;
      teil(GEO.kugel, MAT.weiss, k, -0.34, -0.1, 0.2, 0.2, 0.15, 0.2);
      teil(GEO.kugel, MAT.weiss, k, 0.34, -0.1, 0.2, 0.2, 0.15, 0.2);
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
      for (const sg of [-1, 1]) for (const [dy, rz] of [[0.02, 0.18], [-0.04, 0], [-0.1, -0.18]]){
        const w = teil(GEO.box, MAT.weiss, k, sg * 0.45, -0.1 + dy, 0.42, 0.34, 0.012, 0.012); w.rotation.z = sg * rz; w.rotation.y = sg * -0.35; w.castShadow = false;
      }
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

// Vorlage fuer Karosserie und Raeder: wird einmal gebaut, zu wenigen Meshes verschmolzen und fuer alle Karts geteilt.
// Die Platzhalter LACK und ANZUG werden pro Kart durch dessen Farbmaterial ersetzt.
const LACK = new THREE.MeshBasicMaterial(), ANZUG = new THREE.MeshBasicMaterial();
const kartVorlage = {};
const nummernTex = {};
function nummernSchild(f, nr){
  if (!nummernTex[f.id]) nummernTex[f.id] = geteilt(canvasTex(128, 128, (c, w) => {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 4, 0, TAU); c.fill();
    c.lineWidth = 9; c.strokeStyle = cssFarbe(f.farbe); c.stroke();
    c.font = '900 76px "Barlow SC", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#1a1a1e'; c.fillText(String(nr), w / 2, w / 2 + 6);
  }));
  return nummernTex[f.id];
}
function reifenGeo(r, breite){
  const pf = [[0.22, -breite / 2], [r - 0.09, -breite / 2], [r - 0.03, -breite / 2 + 0.05], [r, -breite / 2 + 0.13], [r + 0.012, 0], [r, breite / 2 - 0.13], [r - 0.03, breite / 2 - 0.05], [r - 0.09, breite / 2], [0.22, breite / 2]];
  return geteilt(new THREE.LatheGeometry(pf.map(([x, y]) => new THREE.Vector2(x, y)), 20));
}
function radVorlage(r, breite){
  const g = new THREE.Group();
  const felge = r - 0.1;
  teil(GEO.zyl16, MAT.metall, g, 0, 0, 0, felge, breite * 0.84, felge).castShadow = false;
  teil(GEO.zyl16, LACK, g, 0, 0, 0, 0.13, breite + 0.05, 0.13).castShadow = false;
  for (let n = 0; n < 3; n++){
    const sp = teil(GEO.box, MAT.dunkel, g, 0, 0, 0, 0.07, breite * 0.9, felge * 1.7); sp.rotation.y = n * Math.PI / 3; sp.castShadow = false;
  }
  return [reifenGeo(r, breite), verschmelzen(g)];
}
function kartTeile(){
  if (kartVorlage.koerper) return kartVorlage;
  const k = new THREE.Group();
  const rb = (w, h, d, r) => geteilt(rundBox(w, h, d, r));
  const T = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => teil(geo, mat, k, x, y, z, sx, sy, sz);
  const kein = m => { m.castShadow = false; return m; };
  // Unterbau, Bug, Seitenkaesten
  T(rb(1.7, 0.16, 3.2, 0.06), MAT.dunkel, 0, 0.4, 0);
  T(rb(1.5, 0.46, 2.1, 0.17), LACK, 0, 0.68, -0.15);
  T(rb(1.1, 0.3, 1.1, 0.12), LACK, 0, 0.6, 1.2);
  T(GEO.kugelMittel, LACK, 0, 0.57, 1.72, 0.5, 0.2, 0.36);
  T(rb(2.0, 0.1, 0.42, 0.04), MAT.dunkel, 0, 0.36, 1.92);
  for (const x of [-1, 1]){
    T(rb(0.07, 0.3, 0.55, 0.025), LACK, x * 1.0, 0.46, 1.92);
    T(rb(0.45, 0.36, 1.5, 0.14), LACK, x * 0.95, 0.58, -0.1);
    kein(T(rb(0.3, 0.14, 0.05, 0.02), MAT.dunkel, x * 0.95, 0.6, 0.67));
    // runde Kotfluegel ueber den Hinterraedern, Scheinwerfer, Ruecklichter
    T(GEO.kugelMittel, LACK, x * 0.96, 0.77, -1.02, 0.4, 0.2, 0.64);
    kein(T(GEO.kugelMittel, MAT.licht, x * 0.42, 0.63, 1.75, 0.13, 0.1, 0.08));
    kein(T(rb(0.25, 0.1, 0.08, 0.03), MAT.ruecklicht, x * 0.6, 0.7, -1.24));
    // Auspuff (der Heckflügel ist ein Garagen-Teil, siehe fluegelTeile)
    const rohr = T(GEO.zyl16, MAT.metall, x * 0.3, 0.95, -1.7, 0.1, 0.55, 0.1); rohr.rotation.x = Math.PI / 2;
    const loch = kein(T(GEO.zyl16, MAT.auge, x * 0.3, 0.95, -1.97, 0.066, 0.03, 0.066)); loch.rotation.x = Math.PI / 2;
  }
  T(rb(1.0, 0.8, 0.25, 0.1), MAT.dunkel, 0, 1.12, -0.8).rotation.x = -0.12;
  T(rb(0.9, 0.46, 0.55, 0.1), MAT.metall, 0, 0.95, -1.3);
  for (const z of [-1.18, -1.32, -1.46]) kein(T(GEO.box, MAT.dunkel, 0, 1.2, z, 0.8, 0.05, 0.05));
  T(rb(1.4, 0.14, 0.3, 0.05), MAT.dunkel, 0, 0.45, -1.7);
  // Zierstreifen auf der Haube, Lenkrad mit Lenksaeule
  for (const x of [-0.34, 0.34]) kein(T(GEO.box, MAT.weiss, x, 0.758, 1.2, 0.09, 0.015, 0.95));
  T(GEO.lenkrad, MAT.dunkel, 0, 1.12, 0.45).rotation.x = -0.6;
  T(GEO.zyl16, MAT.dunkel, 0, 0.95, 0.4, 0.04, 0.4, 0.04).rotation.x = 0.9;
  // Fahrer: Oberkoerper, Arme, Handschuhe
  T(GEO.kugelMittel, ANZUG, 0, 1.25, -0.35, 0.5, 0.55, 0.42);
  for (const x of [-1, 1]){
    T(GEO.zyl16, ANZUG, x * 0.33, 1.22, 0.08, 0.1, 0.55, 0.1).rotation.x = 1.2;
    kein(T(GEO.kugelMittel, MAT.dunkel, x * 0.27, 1.13, 0.37, 0.11, 0.11, 0.11));
    kein(T(GEO.kugelGrob, ANZUG, x * 0.42, 1.38, -0.28, 0.2, 0.17, 0.2));
  }
  // Halstuch-Ring unter dem Kopf
  const ring = T(new THREE.TorusGeometry(0.3, 0.09, 8, 16), LACK, 0, 1.6, -0.33); ring.rotation.x = Math.PI / 2;
  const teile = verschmelzen(k);
  const [reifenV, radV] = radVorlage(0.46, 0.42), [reifenH, radH] = radVorlage(0.52, 0.5);
  Object.assign(kartVorlage, { koerper:teile, reifenV, radV, reifenH, radH, schildGeo:geteilt(new THREE.CircleGeometry(0.26, 24)) });
  kartVorlage.schildGeo.rotateX(-Math.PI / 2); kartVorlage.schildGeo.rotateY(Math.PI);
  return kartVorlage;
}

/* ---------- Garage: Teile nur für die Optik, damit Rennen fair bleiben ---------- */
const TEILE = {
  reifen:[
    { name:'Standard', preis:0 }, { name:'Slicks', preis:30 }, { name:'Monster', preis:80 }, { name:'Goldfelgen', preis:120 }
  ],
  fluegel:[
    { name:'Standard', preis:0 }, { name:'Ohne', preis:15 }, { name:'Riesenflügel', preis:60 }, { name:'Raketen', preis:110 }
  ],
  lack:[
    { name:'Fahrerfarbe', preis:0 }, { name:'Chrom', preis:50 }, { name:'Neon', preis:90 },
    { name:'Gold', preis:150, pokal:true }, { name:'Regenbogen', preis:250 }
  ]
};
const TEIL_ARTEN = ['reifen', 'fluegel', 'lack'];
const teileOk = t => TEIL_ARTEN.map((a, i) => { const v = Array.isArray(t) ? t[i] : 0; return Number.isInteger(v) && TEILE[a][v] ? v : 0; });
// Garage: gekaufte Teile und die aktuelle Auswahl [Reifen, Flügel, Lack]
const garage = Object.assign({ besitz:[], wahl:[0, 0, 0] }, lesen('garage', {}));
if (!Array.isArray(garage.besitz)) garage.besitz = [];
garage.wahl = teileOk(garage.wahl).map((v, i) => !TEILE[TEIL_ARTEN[i]][v].preis || garage.besitz.includes(`${TEIL_ARTEN[i]}:${v}`) ? v : 0);
const fluegelVorlagen = {};
function fluegelTeile(art){
  if (fluegelVorlagen[art]) return fluegelVorlagen[art];
  const k = new THREE.Group();
  const rb = (w, h, d, r) => geteilt(rundBox(w, h, d, r));
  const T = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => teil(geo, mat, k, x, y, z, sx, sy, sz);
  if (art === 0 || art === 2){
    const g = art === 2 ? 1.35 : 1, hoch = art === 2 ? 0.55 : 0;
    for (const x of [-1, 1]){
      T(rb(0.06, 0.5 + hoch, 0.62 * g, 0.02), LACK, x * 1.0 * g, 1.3 + hoch / 2, -1.55);
      T(rb(0.1, 0.5 + hoch, 0.1, 0.03), MAT.dunkel, x * 0.6, 1.2 + hoch / 2, -1.5);
    }
    T(rb(2.0 * g, 0.09, 0.5 * g, 0.04), LACK, 0, 1.47 + hoch, -1.55);
    T(GEO.box, MAT.weiss, 0, 1.52 + hoch, -1.55, 1.6 * g, 0.012, 0.1).castShadow = false;
    if (art === 2) T(rb(2.0 * g, 0.07, 0.3, 0.03), MAT.dunkel, 0, 1.47 + hoch - 0.28, -1.75);
  } else if (art === 3){
    // Zwei Raketen-Booster an den Seiten
    for (const x of [-1, 1]){
      T(GEO.zyl16, MAT.metall, x * 0.95, 1.15, -1.45, 0.24, 1.3, 0.24).rotation.x = Math.PI / 2;
      T(GEO.kegel, LACK, x * 0.95, 1.15, -0.62, 0.24, 0.4, 0.24).rotation.x = Math.PI / 2;
      T(GEO.zyl16, MAT.auge, x * 0.95, 1.15, -2.11, 0.17, 0.04, 0.17).rotation.x = Math.PI / 2;
      for (const w of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]){
        const fl = T(GEO.box, MAT.rot, x * 0.95 + Math.cos(w) * 0.3, 1.15 + Math.sin(w) * 0.3, -1.95, 0.04, 0.3, 0.35);
        fl.rotation.z = w;
      }
    }
  }
  fluegelVorlagen[art] = verschmelzen(k);
  return fluegelVorlagen[art];
}
const goldMat = geteilt(Object.assign(std(0xe0b030, 0.25, 0.9), { envMapIntensity:1.1 }));

function kartModell(f, teile = [0, 0, 0]){
  const V = kartTeile();
  const [reifenArt, fluegelArt, lackArt] = teileOk(teile);
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const koerper = new THREE.Group();
  g.add(koerper);
  // Lack: weniger Metall und Spiegelung, damit die Fahrerfarbe satt statt ausgewaschen aussieht
  // Die Szene ist hell beleuchtet (Sonne 2.2): helle Fahrerfarben wuerden sonst Richtung Weiss ausbrennen.
  const abdunkeln = c => c.multiplyScalar(0.85 - 0.33 * Math.min(1, (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * 2.4));
  const lack = new THREE.MeshPhysicalMaterial({ color:abdunkeln(lin(f.farbe)), roughness:0.36, metalness:0.05, clearcoat:0.8, clearcoatRoughness:0.2, envMapIntensity:0.4 });
  if (lackArt === 1) Object.assign(lack, { metalness:1, roughness:0.12, envMapIntensity:1.3 }), lack.color.setRGB(0.75, 0.78, 0.82);
  if (lackArt === 2) lack.emissive.copy(lack.color).multiplyScalar(0.9);
  if (lackArt === 3) Object.assign(lack, { metalness:0.9, roughness:0.22, envMapIntensity:1.1 }), lack.color.copy(lin(0xe0a820));
  const anzug = new THREE.MeshStandardMaterial({ color:abdunkeln(new THREE.Color(f.farbe).lerp(new THREE.Color(0xffffff), 0.3).convertSRGBToLinear()), roughness:0.75 });
  const ersatz = m => m === LACK ? lack : m === ANZUG ? anzug : m;
  for (const [mat, geo] of V.koerper){ const m = new THREE.Mesh(geo, ersatz(mat)); m.castShadow = true; koerper.add(m); }
  for (const [mat, geo] of fluegelTeile(fluegelArt)){ const m = new THREE.Mesh(geo, ersatz(mat)); m.castShadow = true; koerper.add(m); }
  // Startnummer auf der Haube
  const nr = FAHRER.indexOf(f) + 1;
  const schild = new THREE.Mesh(V.schildGeo, new THREE.MeshBasicMaterial({ map:nummernSchild(f, nr), transparent:true, polygonOffset:true, polygonOffsetFactor:-2 }));
  schild.position.set(0, 0.765, 1.18);
  koerper.add(schild);
  const kontakt = new THREE.Mesh(GEO.schatten, MAT.kontakt);
  kontakt.rotation.x = -Math.PI / 2; kontakt.position.y = 0.09;
  g.add(kontakt);
  const kopf = kopfBauen(f.tier);
  kopf.position.set(0, 1.95, -0.3);
  koerper.add(kopf);
  // Halstuch mit wehendem Ende
  const schal = new THREE.Group();
  schal.position.set(0, 1.58, -0.55);
  const zipfel = new THREE.Mesh(GEO.box, lack); zipfel.scale.set(0.2, 0.05, 0.85); zipfel.position.z = -0.4; zipfel.castShadow = true;
  schal.add(zipfel);
  koerper.add(schal);
  // Raeder
  const raeder = [], vorne = [];
  [[-1.0, 0.46, 1.05, true], [1.0, 0.46, 1.05, true], [-1.0, 0.52, -1.05, false], [1.0, 0.52, -1.05, false]]
    .forEach(([x, y, z, istVorne]) => {
      const halter = new THREE.Group();
      halter.position.set(x, y, z);
      // Monster: große Räder, weiter außen; Slicks: breit und flach
      if (reifenArt === 2){ halter.scale.setScalar(1.45); halter.position.set(x * 1.12, y * 1.45, z); }
      if (reifenArt === 1) halter.scale.set(1.35, 0.92, 0.92);
      g.add(halter);
      const r = new THREE.Group();
      r.rotation.z = Math.PI / 2;
      const reifen = new THREE.Mesh(istVorne ? V.reifenV : V.reifenH, MAT.reifen); reifen.castShadow = true;
      r.add(reifen);
      for (const [mat, geo] of (istVorne ? V.radV : V.radH)) r.add(new THREE.Mesh(geo, reifenArt === 3 && mat === MAT.metall ? goldMat : ersatz(mat)));
      halter.add(r);
      raeder.push(r);
      if (istVorne) vorne.push(halter);
    });
  // Turbo-Flammen: heller Kern in orangem Mantel, plus Glut-Leuchten
  const flammen = [-0.3, 0.3].map(x => {
    const fl = new THREE.Group();
    fl.position.set(x, 0.95, -2.0); fl.visible = false;
    const aussen = new THREE.Mesh(GEO.kegel, MAT.flamme); aussen.rotation.x = -Math.PI / 2; aussen.position.z = -0.35; aussen.scale.set(0.2, 0.9, 0.2);
    const kern = new THREE.Mesh(GEO.kegel, MAT.flammeKern); kern.rotation.x = -Math.PI / 2; kern.position.z = -0.22; kern.scale.set(0.11, 0.55, 0.11);
    const glut = new THREE.Sprite(MAT.glutSprite); glut.scale.set(1.1, 1.1, 1);
    fl.add(aussen, kern, glut);
    fl.userData = { aussen, kern, glut };
    koerper.add(fl);
    return fl;
  });
  g.scale.setScalar(0.95);
  return { gruppe:g, koerper, raeder, vorne, kopf, flammen, lack, anzug, kontakt, schal, hoch:reifenArt === 2 ? 0.32 : 0, regenbogen:lackArt === 4, grundGlanz:lack.emissive.clone() };
}

/* =========================================================
   Partikel (Funken, Staub, Explosionen)
   ========================================================= */
class Partikel {
  constructor(max, additiv){
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.farbe = new Float32Array(max * 4); this.gr = new Float32Array(max);
    this.v = new Float32Array(max * 3); this.leben = new Float32Array(max); this.maxLeben = new Float32Array(max);
    this.grav = new Float32Array(max); this.wachs = new Float32Array(max); this.a0 = new Float32Array(max); this.boden = new Float32Array(max);
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
    const i = this.n++, hb = bodenAn(x, z);
    this.boden[i] = hb;
    this.pos.set([x, y + hb, z], i * 3); this.v.set([vx, vy, vz], i * 3); this.farbe.set([r, gg, b, alpha], i * 4);
    this.gr[i] = groesse; this.leben[i] = this.maxLeben[i] = leben; this.grav[i] = grav; this.wachs[i] = wachs; this.a0[i] = alpha;
  }
  kopieren(von, nach){
    this.pos.copyWithin(nach * 3, von * 3, von * 3 + 3); this.v.copyWithin(nach * 3, von * 3, von * 3 + 3);
    this.farbe.copyWithin(nach * 4, von * 4, von * 4 + 4);
    this.gr[nach] = this.gr[von]; this.leben[nach] = this.leben[von]; this.maxLeben[nach] = this.maxLeben[von];
    this.grav[nach] = this.grav[von]; this.wachs[nach] = this.wachs[von]; this.a0[nach] = this.a0[von]; this.boden[nach] = this.boden[von];
  }
  update(dt){
    let i = 0;
    while (i < this.n){
      this.leben[i] -= dt;
      if (this.leben[i] <= 0){ this.n--; if (i < this.n) this.kopieren(this.n, i); continue; }
      const p = i * 3;
      this.v[p + 1] -= this.grav[i] * dt;
      this.pos[p] += this.v[p] * dt; this.pos[p + 1] += this.v[p + 1] * dt; this.pos[p + 2] += this.v[p + 2] * dt;
      if (this.pos[p + 1] < this.boden[i] + 0.05){ this.pos[p + 1] = this.boden[i] + 0.05; this.v[p + 1] *= -0.3; }
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
  let ctx = null, regenGain, master, sfx, musikBus, rauschen, motorOsc1, motorOsc2, motorFilter, motorGain, driftGain, driftFilter;
  let an = lesen('ton', true), lied = null, schritt = 0, naechste = 0, regenWunsch = 0;
  const note = m => 440 * Math.pow(2, (m - 69) / 12);
  const LIEDER = {
    menue:  { bpm:112, akkorde:[[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]] },
    wiese:  { bpm:140, akkorde:[[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]] },
    wueste: { bpm:128, akkorde:[[62, 65, 69], [60, 64, 67], [58, 62, 65], [57, 61, 64]] },
    frost:  { bpm:134, akkorde:[[53, 57, 60], [62, 65, 69], [58, 62, 65], [60, 64, 67]] },
    strand: { bpm:126, akkorde:[[65, 69, 72], [62, 65, 69], [58, 62, 65], [60, 64, 67]] },
    vulkan: { bpm:150, akkorde:[[57, 60, 64], [53, 57, 60], [55, 58, 62], [52, 56, 59]] },
    nacht:  { bpm:118, akkorde:[[57, 60, 64], [60, 64, 67], [55, 59, 62], [53, 57, 60]] },
    himmel: { bpm:136, akkorde:[[64, 67, 71], [60, 64, 67], [62, 65, 69], [59, 62, 67]] }
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
    // Regenrauschen
    const rq = ctx.createBufferSource(); rq.buffer = rauschen; rq.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1400;
    regenGain = ctx.createGain(); regenGain.gain.value = regenWunsch * 0.05;
    rq.connect(rf); rf.connect(regenGain); regenGain.connect(sfx); rq.start();
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
    klick:() => ton(900, 0.05, 'triangle', 0.08),
    blitz:() => { geraeusch(0.9, 2400, 0.4, 0, 'highpass'); ton(1800, 0.5, 'sawtooth', 0.08, 120); geraeusch(1.2, 120, 0.5, 0.15, 'lowpass'); },
    donner:() => { geraeusch(2.2, 70, 0.7, 0, 'lowpass'); geraeusch(0.5, 300, 0.35, 0.05, 'lowpass'); },
    muenze:() => { ton(988, 0.07, 'square', 0.09); ton(1319, 0.18, 'square', 0.09, null, 0.06); },
    sprung:() => { geraeusch(0.45, 900, 0.2, 0, 'bandpass', sfx, 0.7); ton(260, 0.35, 'triangle', 0.08, 640); },
    trick:() => [784, 988, 1175, 1568].forEach((f, i) => ton(f, 0.12, 'square', 0.1, null, i * 0.05)),
    windschatten:() => { geraeusch(0.5, 2600, 0.18, 0, 'bandpass', sfx, 2); ton(520, 0.35, 'triangle', 0.08, 1040); }
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
    regen(st){ regenWunsch = st; if (ctx) regenGain.gain.setTargetAtTime(st * 0.05, ctx.currentTime, 0.5); },
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

// Ecken mit Radius -> Mittellinie aus Geraden und Kreisbögen
function eckenZuPunkten(ecken){
  const n = ecken.length, roh = [];
  for (let i = 0; i < n; i++){
    const [x, z, r] = ecken[i], [px, pz] = ecken[(i - 1 + n) % n], [nx, nz] = ecken[(i + 1) % n];
    if (!(r > 0)){ roh.push([x, z]); continue; }
    let ax = x - px, az = z - pz; const la = Math.hypot(ax, az); ax /= la; az /= la;
    let bx = nx - x, bz = nz - z; const lb = Math.hypot(bx, bz); bx /= lb; bz /= lb;
    const th = Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz)));
    if (th < 1e-3){ roh.push([x, z]); continue; }
    const t = Math.min(r * Math.tan(th / 2), 0.45 * la, 0.45 * lb), rr = t / Math.tan(th / 2);
    const sx = x - ax * t, sz = z - az * t, ex = x + bx * t, ez = z + bz * t;
    const sg = ax * bz - az * bx > 0 ? 1 : -1;
    const cx = sx - az * rr * sg, cz = sz + ax * rr * sg;
    const a0 = Math.atan2(sz - cz, sx - cx);
    let d = Math.atan2(ez - cz, ex - cx) - a0;
    if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    const m = Math.max(2, Math.round(Math.abs(d) * rr / 5));
    for (let k = 0; k <= m; k++){ const a = a0 + d * k / m; roh.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
  }
  // Geraden mit Zwischenpunkten füllen, doppelte Punkte weglassen
  const aus = [];
  roh.forEach(([x0, z0], i) => {
    const [x1, z1] = roh[(i + 1) % roh.length], k = Math.max(1, Math.floor(Math.hypot(x1 - x0, z1 - z0) / 10));
    for (let j = 0; j < k; j++){
      const p = [x0 + (x1 - x0) * j / k, z0 + (z1 - z0) * j / k], q = aus[aus.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.5) aus.push(p);
    }
  });
  if (Math.hypot(aus[0][0] - aus[aus.length - 1][0], aus[0][1] - aus[aus.length - 1][1]) < 1.5) aus.pop();
  return aus;
}

function streckeRechnen(def){
  const pts = eckenZuPunkten(def.ecken).map(([x, z]) => new THREE.Vector3(x, 0, z));
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
  // Höhenprofil (nur Strecken mit profil:[[Anteil, Höhe], …]); weiche Übergänge zwischen den Stützpunkten
  S.hy = new Float32Array(N); S.steig = new Float32Array(N); S.hoch = !!def.profil;
  if (S.hoch){
    const pr = def.profil;
    for (let i = 0; i < N; i++){
      const u = i / N;
      let a = pr[pr.length - 1], b = pr[0], ua = a[0] - 1, ub = b[0];
      for (let n = 0; n < pr.length; n++){ if (pr[n][0] <= u){ a = pr[n]; ua = a[0]; b = pr[(n + 1) % pr.length]; ub = n + 1 < pr.length ? b[0] : b[0] + 1; } }
      const f = klemm((u - ua) / Math.max(1e-6, ub - ua), 0, 1), e = f * f * (3 - 2 * f);
      S.hy[i] = a[1] + (b[1] - a[1]) * e;
    }
    for (let i = 0; i < N; i++) S.steig[i] = (S.hy[(i + 1) % N] - S.hy[(i - 1 + N) % N]) / (2 * S.ds);
  }
  S.gitter = new Map();
  if (S.hoch) for (let i = 0; i < N; i++) gitterEintragen(S, S.px[i], S.pz[i], S.hy[i]);
  // Kurvenbereiche: dort liegen Curbs, Kiesbett und Reifenstapel
  S.ecke = new Uint8Array(N); S.kies = new Uint8Array(N);
  const vor = Math.round(10 / S.ds), nach = Math.round(3 / S.ds), kiesNach = Math.round(14 / S.ds);
  for (let i = 0; i < N; i++){
    if (Math.abs(S.kurv[i]) < 0.022) continue;
    for (let d = -nach; d <= vor; d++) S.ecke[(i + d + N) % N] = 1;
    for (let d = -nach; d <= vor + kiesNach; d++) S.kies[(i + d + N) % N] = 1;
  }
  return S;
}
// Zusammenhängende Abschnitte, in denen feld[i] gesetzt ist: [[start, länge], …]
function abschnitte(S, feld){
  const N = S.N, liste = [];
  const start = feld.indexOf(0);
  if (start < 0) return [[0, N]];
  let an = -1;
  for (let j = 0; j <= N; j++){
    const i = (start + j) % N, gesetzt = j < N && feld[i];
    if (gesetzt && an < 0) an = j;
    if (!gesetzt && an >= 0){ liste.push([(start + an) % N, j - an]); an = -1; }
  }
  return liste;
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
// Boden unter einem Kart, das nicht selbst gerechnet wird (Fernfahrer, Geist)
function bodenUnter(S, k){
  if (!S.hoch) return 0;
  if (Math.abs(k.seite) > S.hw + 1) for (const c of S.abk){ const [d, t] = abkLage(c, k.x, k.z); if (d < c.hb + 0.6) return abkPunktH(c, t); }
  return bodenHoehe(S, k.x, k.z, k.idx);
}
// Liegt (x, z) auf einer Abkürzung (mit Rand)?
function abkuerzungDa(S, x, z, rand){
  for (const c of S.abk || []){ const [d] = abkLage(c, x, z); if (d < c.hb + rand) return true; }
  return false;
}
// Straßenhöhe am Punkt (x, z) in der Nähe von Index i
function bodenHoehe(S, x, z, i){
  if (!S.hoch) return 0;
  const vor = (x - S.px[i]) * S.tx[i] + (z - S.pz[i]) * S.tz[i], j = vor >= 0 ? (i + 1) % S.N : (i - 1 + S.N) % S.N;
  return S.hy[i] + (S.hy[j] - S.hy[i]) * Math.min(1, Math.abs(vor) / S.ds);
}
// Straßenhöhe irgendwo in der Welt (für Partikel, Bananen): nächster Punkt aus einem groben Raster
function bodenAn(x, z){
  const S = strecke;
  if (!S || !S.hoch) return 0;
  // An Kreuzungen liegen zwei Ebenen übereinander: die auf Höhe des eigenen Karts gewinnt
  const f = spieler || vorschau, hint = f ? f.boden : 0;
  let best = 0, bd = Infinity;
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++){
    const liste = S.gitter.get((cx + a) * 100003 + cz + b);
    if (liste) for (const [px, pz, h] of liste){ const d = (px - x) ** 2 + (pz - z) ** 2 + (h - hint) ** 2 * 0.5; if (d < bd){ bd = d; best = h; } }
  }
  return best;
}
function gitterEintragen(S, x, z, h){
  const key = Math.floor(x / 16) * 100003 + Math.floor(z / 16);
  if (!S.gitter.has(key)) S.gitter.set(key, []);
  S.gitter.get(key).push([x, z, h]);
}
const idxBei = (S, s) => ((Math.round(s / S.ds) % S.N) + S.N) % S.N;
const punktBei = (S, i, seite) => [S.px[i] + S.tz[i] * seite, S.pz[i] - S.tx[i] * seite];
const yawBei = (S, i) => Math.atan2(S.tx[i], S.tz[i]);

// Ein Band entlang der Strecke zwischen zwei seitlichen Abständen (links > rechts)
function band(S, links, rechts, y, vLaenge, mat, von = 0, laenge = S.N){
  const n = laenge + 1;
  const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), nor = new Float32Array(n * 6);
  for (let j = 0; j < n; j++){
    const i = (von + j) % S.N, lx = S.tz[i], lz = -S.tx[i];
    const h = y + S.hy[i];
    pos.set([S.px[i] + lx * links, h, S.pz[i] + lz * links, S.px[i] + lx * rechts, h, S.pz[i] + lz * rechts], j * 6);
    const v = j * S.ds / vLaenge;
    uv.set([0, v, 1, v], j * 4);
    nor.set([0, 1, 0, 0, 1, 0], j * 6);
  }
  const index = [];
  for (let j = 0; j < laenge; j++){ const a = 2 * j, b = a + 1, c = a + 2, d = a + 3; index.push(a, b, c, b, d, c); }
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
        p.set(...d.p); s.set(...d.s); e.set(d.r[0], d.r[1], d.r[2], d.r[3] || 'XYZ'); q.setFromEuler(e); m4.compose(p, q, s);
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
    if (o.geometry && !GETEILT.has(o.geometry) && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose();
    if (o.material){
      for (const m of [].concat(o.material)){
        if (GETEILT.has(m) || Object.values(MAT).includes(m)) continue;
        if (m.map && !GETEILT.has(m.map) && m.map !== boxTex && m.map !== pfeilTex) m.map.dispose();
        m.dispose();
      }
    }
  });
}

const ASPHALT_AUSLAUF = 4.5;
const AMPEL_AUS = 0x2a0606, AMPEL_AN = 0xff2412;
function startPlatz(S, slot){
  const reihe = Math.floor(slot / 2), seite = slot % 2 ? -1 : 1;
  return [idxBei(S, -(7 + reihe * 6.5 + (slot % 2) * 3)), seite * S.hw * 0.42];
}
function ampelSetzen(n){
  if (strecke && strecke.ampel) strecke.ampel.forEach((m, i) => m.color.setHex(i < n ? AMPEL_AN : AMPEL_AUS));
}
// Boxengebäude mit Garagen auf der Seite gegenüber der Tribüne
function boxenGebaeude(S, gruppe){
  const i = idxBei(S, -22), abstand = S.hw + S.auslauf + 9;
  const [x, z] = punktBei(S, i, abstand);
  // Nicht bauen, wenn dort ein anderer Teil der Strecke liegt
  for (let j = 0; j < S.N; j += 2){
    let d = Math.abs(j - i); d = Math.min(d, S.N - d) * S.ds;
    if (d > 60 && Math.hypot(S.px[j] - x, S.pz[j] - z) < 48) return;
  }
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = yawBei(S, i);
  const tex = canvasTex(1024, 128, (c, w, h) => {
    c.fillStyle = '#e9ecef'; c.fillRect(0, 0, w, h);
    const farben = ['#e1251b', '#1d5fd8', '#11a36a', '#f4b400', '#7a3fd1', '#ff7a1a', '#20232a', '#16a6c9'];
    for (let n = 0; n < 8; n++){
      c.fillStyle = '#2a2d33'; c.fillRect(n * 128 + 10, 22, 108, 106);
      c.fillStyle = farben[n]; c.fillRect(n * 128 + 14, 26, 100, 14);
      c.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 46; y < h; y += 9) c.fillRect(n * 128 + 14, y, 100, 3);
    }
  });
  const wandMat = std(0xe3e6ea, 0.7);
  teil(GEO.box, wandMat, g, 0, 3, 0, 8, 6, 64);
  teil(GEO.box, std(0x2a2d33, 0.5, 0.3), g, -0.4, 6.25, 0, 9.2, 0.5, 65);
  const front = teil(GEO.box, new THREE.MeshLambertMaterial({ map:tex }), g, -4.04, 2.4, 0, 0.08, 4.8, 62);
  front.material.map.wrapS = THREE.ClampToEdgeWrapping;
  teil(GEO.box, std(0x17191d, 0.3, 0.2), g, -3.6, 5.4, 0, 0.9, 1.0, 64);
  gruppe.add(g);
  S.sperre = { x, z, r:40 };
}

function streckeLaden(nr){
  if (strecke && strecke.nr === nr) return strecke;
  if (strecke){ scene.remove(strecke.gruppe); entsorgen(strecke.gruppe); if (strecke.schnee){ scene.remove(strecke.schnee); strecke.schnee.geometry.dispose(); strecke.schnee.material.dispose(); } }
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
  himmelUni.wolkenFarbe.value = lin(th.himmelWolke[0]); himmelUni.wolkenMenge.value = th.himmelWolke[1];
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
  const bodenMat = new THREE.MeshLambertMaterial({ map:grasTex });
  bodenMat.onBeforeCompile = sh => {
    sh.uniforms.fleck = { value:fleckTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;\nuniform sampler2D fleck;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n float fl1 = texture2D(fleck, vWxz / 610.0).r; float fl2 = texture2D(fleck, vWxz / 143.0 + 0.37).r;\n diffuseColor.rgb *= (1.0 + (fl1 - 0.5) * 2.4) * (1.0 + (fl2 - 0.5) * 1.1);');
  };
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), bodenMat);
  boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true;
  if (!th.schwebend) gruppe.add(boden);
  if (th.meer) meerBauen(S, gruppe);

  // Rennstrecke wie in der F1: Asphalt-Auslauf, Kiesbett und Curbs in den Kurven, kein Mittelstreifen
  const [wandA, wandB] = th.wand;
  const auslaufTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#74787f'; c.fillRect(0, 0, w, h); koernung(c, w, h, 4000, 0.12); }, true);
  const auslaufMat = new THREE.MeshLambertMaterial({ map:auslaufTex, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  gruppe.add(band(S, S.hw + ASPHALT_AUSLAUF, S.hw + 0.5, 0.02, 10, auslaufMat));
  gruppe.add(band(S, -S.hw - 0.5, -S.hw - ASPHALT_AUSLAUF, 0.02, 10, auslaufMat));
  const kiesTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = th.auslauf; c.fillRect(0, 0, w, h);
    koernung(c, w, h, 6000, 0.3);
    for (let n = 0; n < 500; n++){ c.fillStyle = `rgba(${n % 2 ? '255,255,255' : '0,0,0'},.18)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, true);
  const kiesMat = new THREE.MeshLambertMaterial({ map:kiesTex, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  if (th.schwebend){
    gruppe.add(band(S, S.hw + S.auslauf + 1.4, S.hw + ASPHALT_AUSLAUF - 0.1, 0.02, 10, auslaufMat));
    gruppe.add(band(S, -S.hw - ASPHALT_AUSLAUF + 0.1, -S.hw - S.auslauf - 1.4, 0.02, 10, auslaufMat));
  } else for (const [von, laenge] of abschnitte(S, S.kies)){
    gruppe.add(band(S, S.hw + S.auslauf + 0.8, S.hw + ASPHALT_AUSLAUF, 0.025, 6, kiesMat, von, laenge));
    gruppe.add(band(S, -S.hw - ASPHALT_AUSLAUF, -S.hw - S.auslauf - 0.8, 0.025, 6, kiesMat, von, laenge));
  }
  const curbTex = canvasTex(32, 128, (c, w, h) => {
    c.fillStyle = '#e1251b'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#f7f7f2'; c.fillRect(0, h / 2, w, h / 2);
    // Rundung (hell zur Mitte), Abrieb und dunkle Kanten geben dem Curb Volumen
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.3, 'rgba(255,255,255,.2)'); g.addColorStop(0.7, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, 0, w, 3); c.fillRect(0, h / 2 - 1, w, 3);
    koernung(c, w, h, 500, 0.16);
  }, true);
  const curbMat = new THREE.MeshLambertMaterial({ map:curbTex, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3 });
  for (const [von, laenge] of abschnitte(S, S.ecke)){
    gruppe.add(band(S, S.hw + 1.3, S.hw - 0.6, 0.06, 2.2, curbMat, von, laenge));
    gruppe.add(band(S, -S.hw + 0.6, -S.hw - 1.3, 0.06, 2.2, curbMat, von, laenge));
  }
  const strasseTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = th.strasse; c.fillRect(0, 0, w, h);
    // Etwas dunklere, gummierte Ideallinie in der Mitte
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,.16)'); g.addColorStop(0.85, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    koernung(c, w, h, 12000, 0.07);
    c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(4, 0, 6, h); c.fillRect(w - 10, 0, 6, h);
  }, true);
  const strasseMat = new THREE.MeshStandardMaterial({ map:strasseTex, roughness:th.schnee ? 0.58 : 0.88, metalness:0.02, envMapIntensity:0.25, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
  gruppe.add(band(S, S.hw + 0.5, -S.hw - 0.5, 0.04, 22, strasseMat));
  S.strasseMat = strasseMat;

  // Startlinie und Startaufstellung (weiße Grid-Markierungen)
  const karoTex = canvasTex(128, 32, (c, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++){ c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 8, y * 8, 8, 8); } });
  const linie = new THREE.Mesh(new THREE.PlaneGeometry(S.hw * 2, 2.4), new THREE.MeshLambertMaterial({ map:karoTex, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4 }));
  linie.position.set(S.px[0], 0.07 + S.hy[0], S.pz[0]); linie.receiveShadow = true;
  linie.rotation.order = 'YXZ'; linie.rotation.set(-Math.PI / 2, yawBei(S, 0), 0);
  gruppe.add(linie);
  const gridGeo = new THREE.PlaneGeometry(1, 1); gridGeo.rotateX(-Math.PI / 2);
  const gridMat = new THREE.MeshBasicMaterial({ color:0xf4f4f0, polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-5 });
  const grid = new Instanzen();
  for (let slot = 0; slot < 8; slot++){
    const [i, seite] = startPlatz(S, slot), yaw = yawBei(S, i), fx = Math.sin(yaw), fz = Math.cos(yaw);
    const [x, z] = punktBei(S, i, seite);
    const h = S.hy[i] + 0.08;
    grid.add('grid', gridGeo, gridMat, [x + fx * 1.9, h, z + fz * 1.9], [3.2, 1, 0.25], [0, yaw, 0]);
    for (const q of [-1, 1]) grid.add('grid', gridGeo, gridMat, [x + fx * 1.4 + fz * q * 1.5, h, z + fz * 1.4 - fx * q * 1.5], [0.25, 1, 1.2], [0, yaw, 0]);
  }
  grid.bauen(gruppe, false);

  // Startbrücke mit Banner und fünf Ampelpaaren, die im Countdown angehen
  const tor = new THREE.Group();
  tor.position.set(S.px[0], S.hy[0], S.pz[0]); tor.rotation.y = yawBei(S, 0);
  const bannerTex = canvasTex(1024, 160, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffd23f'); g.addColorStop(1, '#ff8a1a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let x = 0; x < 6; x++) for (let y = 0; y < 5; y++){ c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 32, y * 32, 32, 32); c.fillRect(w - 192 + x * 32, y * 32, 32, 32); }
    c.font = '900 110px "Barlow SC", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#2a1405'; c.fillText('LÖWEN-KART', w / 2, h / 2 + 6);
  });
  const torMat = std(0x2a2d33, 0.5, 0.3);
  const torBreite = S.hw * 2 + 4;
  teil(GEO.box, torMat, tor, -torBreite / 2, 3.9, 0, 1.0, 7.8, 1.0);
  teil(GEO.box, torMat, tor, torBreite / 2, 3.9, 0, 1.0, 7.8, 1.0);
  const balken = teil(GEO.box, new THREE.MeshLambertMaterial({ map:bannerTex }), tor, 0, 8.0, 0, torBreite + 1, 1.6, 0.6);
  balken.material.map.wrapS = THREE.ClampToEdgeWrapping;
  S.ampel = [];
  for (let n = 0; n < 5; n++){
    const x = (n - 2) * 1.5, mat = new THREE.MeshBasicMaterial({ color:AMPEL_AUS });
    teil(GEO.box, torMat, tor, x, 6.3, -0.1, 1.1, 1.9, 0.45);
    for (const y of [6.75, 5.85]) teil(GEO.kugelGrob, mat, tor, x, y, -0.36, 0.32, 0.32, 0.12);
    S.ampel.push(mat);
  }
  gruppe.add(tor);

  // Boxengebäude gegenüber der Tribüne
  boxenGebaeude(S, gruppe);
  abkuerzungenFinden(S);

  // Tribüne rechts neben der Startgeraden: Sitzreihen in Streifen, Dach mit Blende, Wimpel und jubelnde Zuschauer
  const trib = new THREE.Group();
  const ti = idxBei(S, -14);
  const [tx, tz] = punktBei(S, ti, -(S.hw + S.auslauf + 2.5));
  trib.position.set(tx, 0, tz); trib.rotation.y = yawBei(S, ti);
  const leute = new Instanzen();
  const stufeMat = std(0x8e99a6, 0.8);
  const sitzTex = canvasTex(256, 32, (c, w, h) => {
    c.fillStyle = '#' + wandA.toString(16).padStart(6, '0'); c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16){ c.fillStyle = (x / 16) % 2 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.18)'; c.fillRect(x, 4, 12, h - 8); }
  });
  const sitzMat = new THREE.MeshLambertMaterial({ map:sitzTex });
  const haut = [0xf1c9a5, 0xd9a577, 0xa9724a, 0x6b4226, 0xf4d6b8];
  for (let r = 0; r < 4; r++){
    teil(GEO.box, stufeMat, trib, -r * 1.7 - 0.85, (r + 1) * 0.55, 0, 1.7, (r + 1) * 1.1, 26).receiveShadow = true;
    const sitz = teil(GEO.box, sitzMat, trib, -r * 1.7 + 0.01, (r + 1) * 1.1 - 0.35, 0, 0.04, 0.7, 26); sitz.castShadow = false;
    sitz.material.map.wrapS = THREE.RepeatWrapping; sitz.material.map.repeat.set(3, 1);
    for (let z = -12; z <= 12; z += 1.15){
      if (rnd() < 0.15) continue;
      const hx = -r * 1.7 - 0.85 + zufall(-0.2, 0.2), hy = (r + 1) * 1.1, hz = z + zufall(-0.1, 0.1);
      const skin = lin(haut[Math.floor(rnd() * haut.length)]), shirt = new THREE.Color().setHSL(rnd(), 0.7, 0.45).convertSRGBToLinear();
      leute.add('kopf', GEO.kugelGrob, MAT.bunt, [hx, hy + 0.9, hz], [0.28, 0.3, 0.28], [0, 0, 0], skin);
      leute.add('koerper', GEO.box, MAT.bunt, [hx + 0.02, hy + 0.35, hz], [0.55, 0.7, 0.5], [0, 0, 0], shirt);
      const jubel = rnd();
      if (jubel < 0.45){
        // Arme nach oben (ein oder beide), im Takt der Menge verstreut
        for (const sg of jubel < 0.2 ? [-1, 1] : [rnd() < 0.5 ? -1 : 1]) leute.add('arm', GEO.box, MAT.bunt, [hx + 0.02, hy + 0.95, hz + sg * 0.36], [0.12, 0.55, 0.12], [sg * 0.35, 0, 0], skin);
      }
      const hut = rnd();
      if (hut < 0.22) leute.add('muetze', GEO.kegelGrob, MAT.bunt, [hx, hy + 1.28, hz], [0.3, 0.34, 0.3], [0, 0, 0], shirt.clone().multiplyScalar(0.8));
      else if (hut < 0.34) leute.add('haar', GEO.kugelGrob, MAT.bunt, [hx - 0.04, hy + 1.04, hz], [0.3, 0.2, 0.3], [0, 0, 0], lin([0x2a1a10, 0xd8a838, 0x8a4a22][Math.floor(rnd() * 3)]));
    }
  }
  const dachMat = std(0xe8322a, 0.5);
  teil(GEO.box, dachMat, trib, -3.4, 7.6, 0, 7.6, 0.25, 27);
  teil(GEO.box, std(0xf7f7f2, 0.6), trib, -3.4, 7.42, 0, 7.4, 0.12, 26.6).castShadow = false;
  for (const z of [-13, -4.4, 4.4, 13]) teil(GEO.zyl, torMat, trib, -7.0, 3.8, z, 0.15, 7.6, 0.15);
  // Blende mit Schriftzug an der Dachkante
  const blendeTex = canvasTex(1024, 64, (c, w, h) => {
    c.fillStyle = '#' + wandA.toString(16).padStart(6, '0'); c.fillRect(0, 0, w, h);
    c.fillStyle = '#f7f7f2'; for (let x = 0; x < w; x += 64){ c.fillRect(x, 0, 32, 8); c.fillRect(x + 32, h - 8, 32, 8); }
    c.font = '900 40px "Barlow SC", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; c.fillText('LÖWEN-KART  ·  HAUPTTRIBÜNE  ·  LÖWEN-KART', w / 2, h / 2 + 2);
  });
  const blende = teil(GEO.box, new THREE.MeshLambertMaterial({ map:blendeTex }), trib, 0.45, 7.2, 0, 0.1, 0.9, 27); blende.castShadow = false;
  // Wimpel an Masten auf dem Dach
  const fahne = new Instanzen();
  for (let z = -12; z <= 12; z += 6){
    fahne.add('mast', GEO.zylGrob, MAT.bunt, [-0.4, 8.7, z], [0.06, 1.8, 0.06], [0, 0, 0], lin(0xdadde2));
    fahne.add('wimpel', GEO.kegelGrob, MAT.bunt, [-0.4, 9.2, z + 0.55], [0.38, 1.0, 0.38], [Math.PI / 2, 0, 0], lin([wandA, 0xffd23f, 0xf5f5f5][(z + 12) / 6 % 3]));
  }
  fahne.bauen(trib);
  leute.bauen(trib);
  gruppe.add(trib);

  // Absperrung nur dort, wo sie keine andere Strecke berührt: Reifenstapel in den Kurven, sonst Betonmauer mit Werbebanden
  const frei = (x, z, abstand, schritt = 3) => {
    const a2 = abstand * abstand;
    for (let i = 0; i < S.N; i += schritt){ const dx = x - S.px[i], dz = z - S.pz[i]; if (dx * dx + dz * dz < a2) return false; }
    return true;
  };
  const freiDeko = (x, z, abstand, schritt) => frei(x, z, abstand, schritt) && !(S.sperre && Math.hypot(x - S.sperre.x, z - S.sperre.z) < S.sperre.r) && !abkuerzungDa(S, x, z, 5);
  // Auf Strecken mit Höhen zählt ein anderer Streckenteil nur, wenn er auf ähnlicher Höhe liegt (Brücken)
  const wandFrei = (x, z, abstand, h) => {
    const a2 = abstand * abstand;
    for (let i = 0; i < S.N; i += 2){ const dx = x - S.px[i], dz = z - S.pz[i]; if (dx * dx + dz * dz < a2 && Math.abs(S.hy[i] - h) < 5) return false; }
    return !abkuerzungDa(S, x, z, 2.5);
  };
  const wand = new Instanzen();
  const wandAbstand = S.hw + S.auslauf + 1.0;
  let farbe = 0;
  for (let i = 0; i < S.N; i += Math.max(1, Math.round(1.1 / S.ds))){
    const reifen = S.kies[i], yaw = yawBei(S, i), lx = S.tz[i], lz = -S.tx[i];
    if (!reifen && i % Math.max(1, Math.round(2.2 / S.ds))) continue;
    farbe++;
    const h = S.hy[i], neig = -Math.atan(S.steig[i]);
    for (const sg of [1, -1]){
      const [x, z] = punktBei(S, i, sg * wandAbstand);
      if (!wandFrei(x, z, wandAbstand - 0.4, h)) continue;
      const vx = -lx * sg, vz = -lz * sg;
      if (reifen && !S.hoch){
        for (const y of [0.17, 0.5, 0.83]) wand.add('reifen', GEO.zylGrob, MAT.bunt, [x, y, z], [0.5, 0.32, 0.5], [0, 0, 0], lin(0x1d1d20));
        wand.add('gurt', GEO.box, MAT.bunt, [x + vx * 0.52, 0.5, z + vz * 0.52], [0.05, 0.9, 1.08], [0, yaw, 0], lin(Math.floor(farbe / 2) % 2 ? wandA : wandB));
      } else {
        wand.add('mauer', GEO.box, MAT.bunt, [x, 0.55 + h, z], [0.6, 1.1, 2.3], [neig, yaw, 0, 'YXZ'], lin(0xd9dce1));
        wand.add('bande', GEO.box, MAT.bunt, [x + vx * 0.32, 0.6 + h, z + vz * 0.32], [0.05, 0.75, 2.2], [neig, yaw, 0, 'YXZ'], lin(farbe % 2 ? wandA : wandB));
      }
    }
  }
  wand.bauen(gruppe);

  // Item-Boxen
  S.boxen = [];
  for (const anteil of [0.2, 0.5, 0.79]){
    const i = Math.round(S.N * anteil);
    for (const q of [-0.6, -0.2, 0.2, 0.6]){
      const [x, z] = punktBei(S, i, q * S.hw);
      // Glaswuerfel mit drehendem Kristallkern, Leuchthof und Lichtfleck auf dem Boden
      const m = new THREE.Group();
      m.position.set(x, 1.3 + S.hy[i], z);
      const wuerfel = new THREE.Mesh(GEO.box16, MAT.itemBox); wuerfel.castShadow = true;
      const kern = new THREE.Mesh(GEO.okta, MAT.itemKern); kern.scale.set(0.42, 0.62, 0.42);
      const halo = new THREE.Sprite(MAT.itemHalo); halo.scale.set(3.6, 3.6, 1);
      const fleck = new THREE.Mesh(GEO.scheibe, MAT.itemFleck); fleck.scale.set(3.4, 1, 3.4);
      m.add(wuerfel, kern, halo, fleck);
      gruppe.add(m);
      S.boxen.push({ x, z, h:S.hy[i], mesh:m, wuerfel, kern, fleck, aus:0, wachs:1, phase:rnd() * TAU });
    }
  }
  // Turbo-Felder
  S.pads = [];
  [[0.36, 0.42], [0.64, -0.42], [0.92, 0.3]].forEach(([anteil, q]) => {
    const i = Math.round(S.N * anteil), seite = q * S.hw;
    const [x, z] = punktBei(S, i, seite);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 6), MAT.pad);
    m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2 - Math.atan(S.steig[i]), yawBei(S, i), 0);
    m.position.set(x, 0.08 + S.hy[i], z);
    gruppe.add(m);
    S.pads.push({ i, seite });
  });

  dekoBauen(S, th, gruppe, rnd, freiDeko);
  // Streckenrand mit Grasbuescheln, Steinen oder Eiskristallen, gebuendelt gezeichnet.
  const details = new Instanzen();
  for (let n = 0; n < (th.schwebend ? 0 : 520); n++){
    const i = Math.floor(rnd() * S.N), sg = rnd() < 0.5 ? -1 : 1;
    const [x, z] = punktBei(S, i, sg * (S.hw + S.auslauf + 2.5 + rnd() * 15));
    if (!freiDeko(x, z, S.hw + S.auslauf + 1.7) || imMeer(S, x, z)) continue;
    const h = 0.2 + rnd() * 0.65;
    if (th.deko === 'baeume' || th.deko === 'laternen'){
      const gc = lin(n % 3 ? 0x62963e : 0x7bb04c);
      for (const [dx, dz, f] of [[0, 0, 1], [0.18, 0.1, 0.7], [-0.15, 0.14, 0.8]]) details.add('gras', GEO.kegelGrob, MAT.laub, [x + dx, h * f / 2, z + dz], [0.2, h * f, 0.2], [0, rnd() * TAU, 0.12 * (dx ? Math.sign(dx) : 1)], gc);
      if (n % 3 === 0) details.add('bluete', GEO.kugelGrob, MAT.bunt, [x, h + 0.05, z], [0.16, 0.11, 0.16], [0, 0, 0], lin([0xffdb62, 0xf8d3ef, 0xffffff, 0xff7a8a, 0xb89cff][n % 5]));
    } else {
      const steinFarbe = th.schnee ? 0xafdcea : th.deko === 'vulkan' ? 0x1e1a1a : th.deko === 'palmen' ? 0xf4e6cf : 0xb98354;
      details.add('stein', th.schnee ? GEO.kegelGrob : GEO.kugelGrob, MAT.bunt, [x,h/2,z], [h,h,h*0.7], [0,rnd()*TAU,0.18], lin(steinFarbe));
    }
  }
  details.bauen(gruppe, false);
  streckenExtras(S, gruppe, th);

  // Minikarte vorberechnen
  S.karte = document.createElement('canvas');
  S.karte.width = S.karte.height = 380;
  const kc = S.karte.getContext('2d');
  const breite = Math.max(S.maxX - S.minX, S.maxZ - S.minZ);
  S.kSkala = 330 / breite;
  S.kOx = 190 - (S.minX + S.maxX) / 2 * S.kSkala; S.kOz = 190 - (S.minZ + S.maxZ) / 2 * S.kSkala;
  kc.lineJoin = kc.lineCap = 'round';
  const pfad = () => { kc.beginPath(); for (let i = 0; i <= S.N; i += 4){ const j = i % S.N; kc.lineTo(S.px[j] * S.kSkala + S.kOx, S.pz[j] * S.kSkala + S.kOz); } kc.closePath(); };
  // Abkürzungen gestrichelt unter der Strecke
  kc.setLineDash([10, 8]); kc.strokeStyle = 'rgba(255,214,90,.9)'; kc.lineWidth = 7;
  for (const c of S.abk){ kc.beginPath(); for (let m = 0; m <= c.n; m += 2) kc.lineTo(c.px[m] * S.kSkala + S.kOx, c.pz[m] * S.kSkala + S.kOz); kc.stroke(); }
  kc.setLineDash([]);
  pfad(); kc.strokeStyle = 'rgba(0,0,0,.55)'; kc.lineWidth = 22; kc.stroke();
  pfad(); kc.strokeStyle = 'rgba(255,255,255,.92)'; kc.lineWidth = 12; kc.stroke();
  const [sx1, sz1] = punktBei(S, 0, S.hw), [sx2, sz2] = punktBei(S, 0, -S.hw);
  kc.strokeStyle = '#111'; kc.lineWidth = 5; kc.lineCap = 'butt';
  kc.beginPath(); kc.moveTo(sx1 * S.kSkala + S.kOx, sz1 * S.kSkala + S.kOz); kc.lineTo(sx2 * S.kSkala + S.kOx, sz2 * S.kSkala + S.kOz); kc.stroke();
  // Eisflächen hellblau, Schanzen als Pfeil in Streckenrichtung
  kc.fillStyle = 'rgba(150,220,255,.95)';
  for (const e of S.eis){ kc.beginPath(); kc.arc(e.x * S.kSkala + S.kOx, e.z * S.kSkala + S.kOz, 8, 0, TAU); kc.fill(); }
  kc.fillStyle = cssFarbe(th.neon); kc.strokeStyle = '#111'; kc.lineWidth = 2;
  for (const r of S.rampen){
    const x = r.x * S.kSkala + S.kOx, y = r.z * S.kSkala + S.kOz, fx = r.fx * 11, fy = r.fz * 11;
    kc.beginPath(); kc.moveTo(x + fx, y + fy); kc.lineTo(x - fx - fy * 0.7, y - fy + fx * 0.7); kc.lineTo(x - fx + fy * 0.7, y - fy - fx * 0.7); kc.closePath(); kc.fill(); kc.stroke();
  }

  // Schneefall, im Vulkan aufsteigende Glut
  if (th.schnee || th.glut){
    const n = th.glut ? 700 : 1500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([zufall(-70, 70), zufall(0, 45), zufall(-70, 70)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = th.glut
      ? new THREE.PointsMaterial({ color:0xff7a22, size:0.3, map:partikelTex, transparent:true, depthWrite:false, opacity:0.95, blending:THREE.AdditiveBlending })
      : new THREE.PointsMaterial({ color:0xffffff, size:0.35, map:partikelTex, transparent:true, depthWrite:false, opacity:0.9 });
    S.schnee = new THREE.Points(g, mat);
    S.schnee.frustumCulled = false;
    S.glut = !!th.glut;
    scene.add(S.schnee);
  }
  if (th.sterne) himmelNacht(S, gruppe, rnd);
  wetterGrundMerken(S);
  strecke = S;
  return S;
}

// Palmenbucht: das Meer liegt hinter der Start-Zielgeraden
const imMeer = (S, x, z) => !!S.th.meer && z < S.minZ - 36;
function meerBauen(S, gruppe){
  const tex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#1f93c8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3;
    for (let y = 8; y < h; y += 24){ c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x / w * TAU * 2 + y) * 5); c.stroke(); }
  }, true);
  tex.repeat.set(60, 30);
  const wasserMat = new THREE.MeshStandardMaterial({ map:tex, roughness:0.18, metalness:0.15, envMapIntensity:0.9 });
  // Farbverlauf: helles Tuerkis im flachen Wasser an der Kueste, tiefes Blau weiter draussen
  const kuesteZ = S.minZ - 40;
  wasserMat.onBeforeCompile = sh => {
    sh.uniforms.kuesteZ = { value:kuesteZ };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWz = (modelMatrix * vec4(transformed, 1.0)).z;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWz;\nuniform float kuesteZ;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n float tiefe = smoothstep(0.0, 190.0, kuesteZ - vWz);\n diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.55, 1.55, 1.25) + vec3(0.02, 0.1, 0.08), diffuseColor.rgb * vec3(0.5, 0.72, 1.0), tiefe);');
  };
  const wasser = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2000), wasserMat);
  wasser.rotation.x = -Math.PI / 2;
  wasser.position.set((S.minX + S.maxX) / 2, 0.35, S.minZ - 40 - 1000);
  gruppe.add(wasser);
  const gischt = new THREE.Mesh(new THREE.PlaneGeometry(4000, 3), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.75 }));
  gischt.rotation.x = -Math.PI / 2;
  gischt.position.set(wasser.position.x, 0.4, S.minZ - 40);
  gruppe.add(gischt);
  S.meer = { tex, gischt };
}
function palmeSetzen(inst, x, z, s, dreh, rnd, farbe){
  const neig = 0.12 + rnd() * 0.12, dx = Math.sin(dreh), dz = Math.cos(dreh);
  let px = x, py = 0, pz = z;
  for (let i = 0; i < 5; i++){
    const w = neig * (i + 1), l = 1.35 * s;
    px += dx * Math.sin(w) * l / 2; py += Math.cos(w) * l / 2; pz += dz * Math.sin(w) * l / 2;
    inst.add('palmstamm', GEO.zylGrob, MAT.bunt, [px, py, pz], [(0.3 - i * 0.03) * s, l * 1.05, (0.3 - i * 0.03) * s], [w, dreh, 0, 'YXZ'], lin(i % 2 ? 0x8a6a44 : 0x9b7a50));
    px += dx * Math.sin(w) * l / 2; py += Math.cos(w) * l / 2; pz += dz * Math.sin(w) * l / 2;
  }
  const gruen = farbe(0.28 + rnd() * 0.05, 0.6, 0.3);
  for (let n = 0; n < 7; n++){
    const a = n / 7 * TAU + rnd() * 0.3, p = 0.35 + rnd() * 0.3, l = 1.6 * s;
    inst.add('wedel', GEO.kugelGrob, MAT.laub, [px + Math.sin(a) * Math.cos(p) * l, py - Math.sin(p) * l + 0.1, pz + Math.cos(a) * Math.cos(p) * l], [0.45 * s, 0.07 * s, 1.8 * s], [p, a, 0, 'YXZ'], gruen);
  }
  for (let n = 0; n < 3; n++) inst.add('nuss', GEO.kugelGrob, MAT.bunt, [px + Math.sin(n * 2.1) * 0.3 * s, py - 0.25 * s, pz + Math.cos(n * 2.1) * 0.3 * s], [0.2 * s, 0.2 * s, 0.2 * s], [0, 0, 0], lin(0x5a3a1a));
}
// Sternenpark: Laternen an der Absperrung mit Lichtkegel auf der Straße
function laternenBauen(S, gruppe, frei){
  const inst = new Instanzen(), kegel = new Instanzen();
  const kegelGeo = new THREE.PlaneGeometry(1, 1); kegelGeo.rotateX(-Math.PI / 2);
  const abstand = S.hw + S.auslauf + 2.2;
  let n = 0;
  for (let i = 0; i < S.N; i += Math.max(1, Math.round(26 / S.ds))){
    const sg = n++ % 2 ? 1 : -1;
    const [x, z] = punktBei(S, i, sg * abstand);
    if (!frei(x, z, abstand - 0.5, 2)) continue;
    const [lx, lz] = punktBei(S, i, sg * (abstand - 2.4));
    const [kx, kz] = punktBei(S, i, sg * (S.hw - 1));
    const yaw = yawBei(S, i);
    inst.add('mast', GEO.zylGrob, MAT.dunkel, [x, 2.6, z], [0.14, 5.2, 0.14]);
    inst.add('arm', GEO.box, MAT.dunkel, [(x + lx) / 2, 5.2, (z + lz) / 2], [2.6, 0.12, 0.12], [0, yaw + Math.PI / 2, 0]);
    inst.add('lampe', GEO.kugelGrob, MAT.lampe, [lx, 4.95, lz], [0.6, 0.42, 0.6]);
    kegel.add('kegel', kegelGeo, MAT.lichtkegel, [kx, 0.1, kz], [15, 1, 15]);
  }
  inst.bauen(gruppe);
  kegel.bauen(gruppe, false);
}
function himmelNacht(S, gruppe, rnd){
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){
    const w = rnd() * TAU, h = 0.08 + rnd() * 0.92, r = 1500, q = Math.sqrt(1 - h * h);
    pos.set([Math.cos(w) * q * r, h * r, Math.sin(w) * q * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sterne = new THREE.Points(g, new THREE.PointsMaterial({ color:0xffffff, size:2.2, sizeAttenuation:false, fog:false, transparent:true, opacity:0.9, depthWrite:false }));
  sterne.position.set((S.minX + S.maxX) / 2, 0, (S.minZ + S.maxZ) / 2);
  sterne.frustumCulled = false;
  gruppe.add(sterne);
  const mond = new THREE.Mesh(new THREE.SphereGeometry(45, 24, 16), new THREE.MeshBasicMaterial({ color:0xf4f1dc, fog:false }));
  mond.position.copy(SONNE_VERSATZ).normalize().multiplyScalar(1300).add(sterne.position);
  gruppe.add(mond);
}
function grosserVulkan(S, gruppe, cx, cz, R){
  const w = 2.3, x = cx + Math.cos(w) * (R + 520), z = cz + Math.sin(w) * (R + 520);
  const hangMat = new THREE.MeshPhongMaterial({ color:lin(0x2a1c1a), flatShading:true, fog:false, shininess:0, specular:0x000000 });
  const berg = new THREE.Mesh(new THREE.CylinderGeometry(120, 620, 340, 12, 1, true), hangMat);
  berg.position.set(x, 170, z);
  gruppe.add(berg);
  const krater = new THREE.Mesh(new THREE.CylinderGeometry(118, 118, 4, 12), new THREE.MeshBasicMaterial({ color:lin(0xff7a1a), fog:false }));
  krater.position.set(x, 340, z);
  gruppe.add(krater);
  // Lavaströme auf der Seite, die zur Strecke zeigt
  const zurStrecke = Math.atan2(cz - z, cx - x), neigung = Math.atan2(340, 500);
  for (let n = 0; n < 5; n++){
    const a = zurStrecke + (n - 2) * 0.32;
    const strom = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color:lin(n % 2 ? 0xff5a10 : 0xff8a20), fog:false }));
    strom.position.set(x + Math.cos(a) * 372, 176, z + Math.sin(a) * 372);
    strom.scale.set(14, 3, 600);
    strom.rotation.order = 'YXZ'; strom.rotation.set(neigung, Math.PI / 2 - a, 0);
    gruppe.add(strom);
  }
  S.vulkanRauch = [];
  for (let n = 0; n < 6; n++){
    const r = new THREE.Mesh(GEO.kugelGrob, new THREE.MeshLambertMaterial({ color:0x3a3030, transparent:true, opacity:0.55, fog:false, depthWrite:false }));
    r.position.set(x, 360 + n * 45, z); r.scale.setScalar(70 + n * 18);
    gruppe.add(r); S.vulkanRauch.push(r);
  }
}

// Sternenpark: Hochhäuser mit erleuchteten Fenstern statt Bergen, oben rote Warnlichter
function skylineBauen(S, gruppe, cx, cz, R, rnd){
  const fenster = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#0c1024'; c.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 4; y += 12) for (let x = 6; x < w - 4; x += 12){
      const r = Math.random();
      c.fillStyle = r < 0.45 ? '#141a36' : r < 0.75 ? '#ffd890' : r < 0.9 ? '#9fd4ff' : '#ff9ad8';
      c.fillRect(x, y, 7, 8);
    }
  });
  const mat = new THREE.MeshBasicMaterial({ map:fenster });
  const haeuser = new Instanzen(), lichter = new Instanzen();
  for (let n = 0; n < 70; n++){
    const w = n / 70 * TAU + rnd() * 0.08, r = R + 40 + rnd() * 300;
    const x = cx + Math.cos(w) * r, z = cz + Math.sin(w) * r;
    const h = 40 + rnd() * rnd() * 180, b = 24 + rnd() * 30;
    haeuser.add('haus', GEO.box, mat, [x, h / 2, z], [b, h, b * (0.7 + rnd() * 0.6)], [0, rnd(), 0], new THREE.Color().setHSL(0.6 + rnd() * 0.2, 0.4, 0.75 + rnd() * 0.25));
    if (h > 140) lichter.add('licht', GEO.kugelGrob, MAT.ruecklicht, [x, h + 2, z], [1.6, 1.6, 1.6]);
  }
  haeuser.bauen(gruppe, false);
  lichter.bauen(gruppe, false);
}

// Wolkenreich: Wolkenmeer tief unten, Startinsel, Stützpfeiler, Unterseite der Fahrbahn, schwebende Inseln und Regenbögen
function schwebendBauen(S, gruppe, cx, cz, R, rnd){
  const wolkenTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#f6e6f2'; c.fillRect(0, 0, w, h);
    for (let n = 0; n < 160; n++){
      const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 40;
      for (const [dx, dy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]){
        const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,255,255,.7)' : 'rgba(225,200,235,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }, true);
  wolkenTex.repeat.set(30, 30);
  const meer = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ map:wolkenTex, emissive:lin(0x40303c) }));
  meer.rotation.x = -Math.PI / 2; meer.position.set(cx, -55, cz);
  gruppe.add(meer);
  S.wolkenMeer = wolkenTex;
  // Dicke Wolkenballen knapp über dem Meer
  const ballen = new Instanzen(), wMat = new THREE.MeshLambertMaterial({ color:0xffffff, emissive:lin(0x6a5a70) });
  for (let n = 0; n < 90; n++){
    const w = rnd() * TAU, r = rnd() * (R + 500), x = cx + Math.cos(w) * r, z = cz + Math.sin(w) * r, s = 14 + rnd() * 26;
    ballen.add('ballen', GEO.kugelGrob, wMat, [x, -52 + rnd() * 6, z], [s * 1.6, s * 0.55, s], [0, rnd() * TAU, 0]);
  }
  ballen.bauen(gruppe, false);
  // Startinsel: trägt Startgerade, Tribüne und Boxengebäude
  const insel = new Instanzen(), grasMat = new THREE.MeshLambertMaterial({ color:lin(0x7ccf62) }), felsMat = new THREE.MeshLambertMaterial({ color:lin(0x8a6f7e), flatShading:true });
  for (let d = -110; d <= 70; d += 18){
    const i = idxBei(S, d), [x, z] = punktBei(S, i, 0);
    insel.add('oben', GEO.zyl16, grasMat, [x, -0.3, z], [48, 0.5, 48]);
    insel.add('unten', GEO.kegelGrob, felsMat, [x, -18.5, z], [46, 36, 46], [Math.PI, rnd() * TAU, 0]);
  }
  insel.bauen(gruppe, false);
  // Fahrbahn: Unterseite, Seitenblenden und Pfeiler bis in die Wolken
  const unterMat = new THREE.MeshLambertMaterial({ color:lin(0xe9e4f6), side:THREE.DoubleSide });
  const breit = S.hw + S.auslauf + 1.4;
  gruppe.add(band(S, breit, -breit, -0.7, 10, unterMat));
  for (const sg of [1, -1]){
    const n = S.N + 1, pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), uv = new Float32Array(n * 4);
    for (let j = 0; j < n; j++){
      const i = j % S.N, x = S.px[i] + S.tz[i] * sg * breit, z = S.pz[i] - S.tx[i] * sg * breit, h = S.hy[i];
      pos.set([x, h + 0.03, z, x, h - 0.7, z], j * 6); nor.set([S.tz[i] * sg, 0, -S.tx[i] * sg, S.tz[i] * sg, 0, -S.tx[i] * sg], j * 6); uv.set([0, j, 1, j], j * 4);
    }
    const index = [];
    for (let j = 0; j < S.N; j++){ const a = 2 * j; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    gruppe.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:lin(S.th.neon), side:THREE.DoubleSide })));
  }
  const pfeiler = new Instanzen(), pfeilerMat = new THREE.MeshLambertMaterial({ color:lin(0xf4f0ff) });
  const schritt = Math.round(32 / S.ds);
  for (let i = 0; i < S.N; i += schritt){
    if (S.hy[i] < 2 && ringAbstand(S, i, 0) < 120) continue;
    // Nicht durch eine tiefer liegende Fahrbahn hindurch
    let frei = true;
    for (let j = 0; j < S.N && frei; j += 2){
      if (S.hy[j] < S.hy[i] - 3 && Math.hypot(S.px[j] - S.px[i], S.pz[j] - S.pz[i]) < breit + 4) frei = false;
    }
    if (!frei) continue;
    const h = S.hy[i] + 55;
    pfeiler.add('pfeiler', GEO.zyl16, pfeilerMat, [S.px[i], S.hy[i] - 0.7 - h / 2, S.pz[i]], [1.6, h, 1.6]);
    pfeiler.add('kopf', GEO.box, pfeilerMat, [S.px[i], S.hy[i] - 1.1, S.pz[i]], [breit * 1.2, 0.8, 2.4], [0, yawBei(S, i), 0]);
  }
  pfeiler.bauen(gruppe);
  // Regenbögen weit draußen
  const farben = [0xff4d6d, 0xff9f1c, 0xffd23f, 0x3fd17a, 0x3aa0ff, 0x8a5cff];
  for (const [w, r] of [[0.9, R + 380], [3.6, R + 460]]){
    const g = new THREE.Group();
    g.position.set(cx + Math.cos(w) * r, -40, cz + Math.sin(w) * r);
    g.lookAt(cx, -40, cz);
    farben.forEach((f, n) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(260 - n * 9, 4.5, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color:lin(f), transparent:true, opacity:0.55, fog:false, depthWrite:false }));
      g.add(m);
    });
    gruppe.add(g);
  }
}
// Schwebende Inseln mit Bäumchen und Fels darunter
function inselSetzen(inst, x, y, z, s, rnd, farbe){
  inst.add('inselGras', GEO.kugelGrob, MAT.laub, [x, y, z], [6 * s, 1.4 * s, 6 * s], [0, rnd() * TAU, 0], farbe(0.28 + rnd() * 0.05, 0.5, 0.45));
  inst.add('inselFels', GEO.kegelGrob, MAT.laub, [x, y - 5 * s, z], [5.6 * s, 10 * s, 5.6 * s], [Math.PI, rnd() * TAU, 0], farbe(0.85 + rnd() * 0.08, 0.15, 0.45));
  for (let n = 0; n < 3; n++){
    const a = rnd() * TAU, r = rnd() * 3.5 * s, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
    inst.add('stamm', GEO.zylGrob, MAT.stamm, [tx, y + 1.6 * s, tz], [0.25 * s, 2.4 * s, 0.25 * s]);
    inst.add('krone', GEO.kugelGrob, MAT.laub, [tx, y + 3.4 * s, tz], [1.5 * s, 1.5 * s, 1.5 * s], [0, rnd() * TAU, 0], farbe(rnd() < 0.5 ? 0.92 : 0.3, 0.6, 0.72));
  }
}

function dekoBauen(S, th, gruppe, rnd, frei){
  const inst = new Instanzen();
  const rand = 150;
  const ziel = th.deko === 'kakteen' ? 170 : th.deko === 'palmen' ? 150 : th.deko === 'vulkan' ? 190 : th.deko === 'himmel' ? 45 : 280;
  const lava = new Instanzen();
  const farbe = (h, s, l) => new THREE.Color().setHSL(h, s, l).convertSRGBToLinear();
  let gesetzt = 0;
  for (let versuch = 0; versuch < ziel * 6 && gesetzt < ziel; versuch++){
    const x = S.minX - rand + rnd() * (S.maxX - S.minX + 2 * rand);
    const z = S.minZ - rand + rnd() * (S.maxZ - S.minZ + 2 * rand);
    if (!frei(x, z, S.hw + S.auslauf + (th.deko === 'himmel' ? 30 : 4)) || imMeer(S, x, z)) continue;
    gesetzt++;
    const s = 0.7 + rnd() * 0.9, dreh = rnd() * TAU;
    if (th.deko === 'himmel'){
      // Unter oder neben der Strecke, nie im Weg
      inselSetzen(inst, x, -12 - rnd() * 30 + (rnd() < 0.3 ? 40 : 0), z, 0.8 + rnd() * 1.2, rnd, farbe);
    } else if (th.deko === 'palmen'){
      if (rnd() < 0.25){
        inst.add('busch', GEO.kugelGrob, MAT.laub, [x, 0.45 * s, z], [1.3 * s, 0.9 * s, 1.3 * s], [0, dreh, 0], farbe(0.27 + rnd() * 0.05, 0.5, 0.32));
      } else palmeSetzen(inst, x, z, s, dreh, rnd, farbe);
    } else if (th.deko === 'vulkan'){
      const r = rnd();
      if (r < 0.22){
        // Lavasee mit dunklem Rand
        const w = (2 + rnd() * 4) * s;
        lava.add('lavarand', GEO.zylGrob, MAT.bunt, [x, 0.05, z], [w + 1.2, 0.1, w * 0.8 + 1.2], [0, dreh, 0], lin(0x1a1414));
        lava.add('lava', GEO.zylGrob, MAT.lava, [x, 0.09, z], [w, 0.1, w * 0.8], [0, dreh, 0]);
      } else if (r < 0.75){
        inst.add('fels', GEO.kugelGrob, MAT.laub, [x, 0.5 * s, z], [2 * s, 1.5 * s, 1.7 * s], [rnd(), dreh, rnd()], farbe(0.02, 0.1, 0.08 + rnd() * 0.07));
        if (rnd() < 0.4) inst.add('glutfels', GEO.kugelGrob, MAT.glut, [x, 0.25 * s, z], [1.1 * s, 0.5 * s, 1 * s], [0, dreh, 0]);
      } else {
        // Verkohlter Baum
        inst.add('stamm', GEO.zylGrob, MAT.bunt, [x, 1.8 * s, z], [0.25 * s, 3.6 * s, 0.25 * s], [0, 0, (rnd() - 0.5) * 0.3], lin(0x231a16));
        inst.add('stamm', GEO.zylGrob, MAT.bunt, [x + 0.5 * s, 3 * s, z], [0.12 * s, 1.6 * s, 0.12 * s], [0, 0, -0.8], lin(0x231a16));
        inst.add('stamm', GEO.zylGrob, MAT.bunt, [x - 0.4 * s, 2.6 * s, z], [0.1 * s, 1.3 * s, 0.1 * s], [0, 0, 0.9], lin(0x231a16));
      }
    } else if (th.deko === 'baeume' || th.deko === 'laternen'){
      const art = rnd();
      if (art < 0.26){
        // Busch mit hellerer Oberseite, manchmal mit Beeren/Bluetentupfern
        const c = farbe(0.28 + rnd() * 0.06, 0.55, 0.3 + rnd() * 0.1);
        inst.add('busch', GEO.kugelGrob, MAT.laub, [x, 0.5 * s, z], [1.5 * s, 1.1 * s, 1.5 * s], [0, dreh, 0], c);
        inst.add('busch', GEO.kugelGrob, MAT.laub, [x - 0.3 * s, 0.95 * s, z + 0.2 * s], [0.9 * s, 0.7 * s, 0.9 * s], [0, dreh, 0], c.clone().multiplyScalar(1.2));
        if (rnd() < 0.4) for (let q = 0; q < 4; q++) inst.add('beere', GEO.kugelGrob, MAT.bunt, [x + zufall(-0.9, 0.9) * s, 0.7 * s + rnd() * 0.5 * s, z + 1.1 * s * (rnd() < 0.5 ? 1 : -1) * rnd()], [0.12, 0.12, 0.12], [0, 0, 0], lin(rnd() < 0.5 ? 0xe8322a : 0xffd23f));
      } else {
        // Baeume in drei Wuchsformen und Herbst-/Bluetenfarben, Stamm mit Wurzelansatz
        const form = rnd(), herbst = rnd();
        const hoehe = form < 0.25 ? 1.45 : 1;
        inst.add('stamm', GEO.zylGrob, MAT.stamm, [x, 1.5 * s * hoehe, z], [0.3 * s, 3 * s * hoehe, 0.3 * s]);
        inst.add('wurzel', GEO.kegelGrob, MAT.stamm, [x, 0.35 * s, z], [0.62 * s, 0.7 * s, 0.62 * s]);
        let c = farbe(0.25 + rnd() * 0.1, 0.55, 0.28 + rnd() * 0.12);
        if (herbst < 0.1) c = farbe(0.07 + rnd() * 0.05, 0.75, 0.42);
        else if (herbst < 0.2) c = farbe(0.93 + rnd() * 0.05, 0.55, 0.72);
        if (form < 0.25){
          // schlanke Pappel
          inst.add('krone', GEO.kugelGrob, MAT.laub, [x, 4.6 * s, z], [1.3 * s, 3.2 * s, 1.3 * s], [0, dreh, 0], c);
          inst.add('krone', GEO.kugelGrob, MAT.laub, [x, 5.6 * s, z], [0.8 * s, 1.6 * s, 0.8 * s], [0, dreh, 0], c.clone().multiplyScalar(1.2));
        } else {
          inst.add('krone', GEO.kugelGrob, MAT.laub, [x, 3.9 * s, z], [2.0 * s, 2.2 * s, 2.0 * s], [0, dreh, 0], c);
          inst.add('krone', GEO.kugelGrob, MAT.laub, [x + 0.8 * s, 3.2 * s, z + 0.5 * s], [1.3 * s, 1.3 * s, 1.3 * s], [0, dreh, 0], c.clone().multiplyScalar(0.85));
          inst.add('krone', GEO.kugelGrob, MAT.laub, [x - 0.4 * s, 4.9 * s, z - 0.2 * s], [1.2 * s, 1.0 * s, 1.2 * s], [0, dreh, 0], c.clone().multiplyScalar(1.22));
        }
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
  lava.bauen(gruppe, false);
  if (th.deko === 'laternen') laternenBauen(S, gruppe, frei);

  // Berge ringsum
  const berge = new Instanzen();
  const cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2;
  const R = Math.max(S.maxX - S.minX, S.maxZ - S.minZ) / 2 + 300;
  const bergMat = new THREE.MeshPhongMaterial({ color:0xffffff, flatShading:true, shininess:0, specular:0x000000 });
  if (th.skyline) skylineBauen(S, gruppe, cx, cz, R, rnd);
  if (th.schwebend) schwebendBauen(S, gruppe, cx, cz, R, rnd);
  for (let n = 0; n < (th.skyline || th.schwebend ? 0 : 22); n++){
    const w = n / 22 * TAU + rnd() * 0.2, r = R + rnd() * 260;
    const x = cx + Math.cos(w) * r, z = cz + Math.sin(w) * r;
    const h = 90 + rnd() * 150, b = h * (0.9 + rnd() * 0.5);
    const c = new THREE.Color(th.berge).offsetHSL(rnd() * 0.03, 0, (rnd() - 0.5) * 0.1).convertSRGBToLinear();
    if (th.meer && z < S.minZ){
      // Auf der Meerseite kleine Inseln statt Berge
      if (n % 3) continue;
      berge.add('insel', GEO.kugelGrob, bergMat, [x, -h * 0.05, z], [b * 0.6, h * 0.25, b * 0.5], [0, rnd(), 0], c);
      continue;
    }
    if (th.deko === 'kakteen'){
      berge.add('mesa', GEO.zylGrob, bergMat, [x, h * 0.25, z], [b * 0.7, h * 0.5, b * 0.7], [0, rnd(), 0], c);
      berge.add('mesa', GEO.zylGrob, bergMat, [x, h * 0.53, z], [b * 0.55, h * 0.06, b * 0.55], [0, rnd(), 0], c.clone().multiplyScalar(0.8));
    } else {
      berge.add('berg', GEO.kegelGrob, bergMat, [x, h / 2, z], [b, h, b], [0, rnd(), 0], c);
      if (th.deko === 'tannen' || (h > 190 && th.deko !== 'vulkan')) berge.add('gipfel', GEO.kegelGrob, bergMat, [x, h - h * 0.16, z], [b * 0.32, h * 0.32, b * 0.32], [0, 0, 0], lin(0xffffff));
    }
  }
  berge.bauen(gruppe, false);
  if (th.deko === 'vulkan') grosserVulkan(S, gruppe, cx, cz, R);

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
   Strecken-Extras: Sprungschanzen, Leuchtbögen, Glatteis,
   Meteore, Steppenläufer und lebendige Kulisse
   ========================================================= */
const RAMPE_LAENGE = 8, RAMPE_HOEHE = 1.7, TRICK_DAUER = 0.55;
// Abstand zweier Streckenindizes entlang der Strecke in Metern
const ringAbstand = (S, a, b) => { const d = Math.abs(a - b) % S.N; return Math.min(d, S.N - d) * S.ds; };
// Frei, wenn kein anderer Teil der Strecke (weiter als 45 m von Index i entfernt) näher als abstand liegt
function fremdFrei(S, x, z, i, abstand){
  const a2 = abstand * abstand;
  for (let j = 0; j < S.N; j += 2){
    if (ringAbstand(S, i, j) < 45) continue;
    const dx = x - S.px[j], dz = z - S.pz[j];
    if (dx * dx + dz * dz < a2) return false;
  }
  return true;
}
// Ort auf der Strecke mit lokaler Richtung: daran hängen Schanzen und Eisflächen
function streckenOrt(S, i, seite){
  const [x, z] = punktBei(S, i, seite);
  return { i, x, z, h:S.hy[i], fx:S.tx[i], fz:S.tz[i] };
}
// Flaches Teil (Eis, Pfütze) an einem Ort auf die Straße legen, bergauf/bergab mitgeneigt
function aufStrasse(m, S, ort, y){
  m.position.set(ort.x, ort.h + y, ort.z);
  m.rotation.order = 'YXZ'; m.rotation.set(-Math.atan(S.steig[ort.i]), yawBei(S, ort.i), 0);
}
// Lage eines Punkts relativ zu einem Ort: [entlang, quer]
function ortLage(o, x, z){
  const dx = x - o.x, dz = z - o.z;
  return [dx * o.fx + dz * o.fz, dx * o.fz - dz * o.fx];
}

function streckenExtras(S, gruppe, th){
  const rnd = zufallsGen(S.def.saat * 7 + 3);
  rampenBauen(S, gruppe, th);
  boegenBauen(S, gruppe, th);
  S.muenzen = [];
  abkuerzungenBauen(S, gruppe, th);
  muenzenBauen(S, gruppe);
  S.eis = [];
  if (th.gefahr === 'eis') eisBauen(S, gruppe, rnd);
  S.gefahren = []; S.gefahrTimer = 4;
  S.kulisse = { ballons:[], rotoren:[], delfine:[], boote:[], polarlicht:null, feuerwerk:0 };
  const k = th.kulisse || [];
  if (k.includes('ballons')) ballonsBauen(S, gruppe, rnd);
  if (k.includes('windraeder')) windraederBauen(S, gruppe, rnd);
  if (k.includes('delfine')) delfineBauen(S, gruppe, rnd);
  if (k.includes('boote')) booteBauen(S, gruppe, rnd);
  if (k.includes('polarlicht')) polarlichtBauen(S, gruppe);
}

/* ---------- Sprungschanzen ---------- */
function chevronTex(neon){
  return canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#23262c'; c.fillRect(0, 0, w, h);
    for (let y = -40; y < h; y += 64){
      c.fillStyle = y / 64 % 2 ? cssFarbe(neon) : '#ffd23f';
      c.beginPath(); c.moveTo(10, y + 46); c.lineTo(w / 2, y + 6); c.lineTo(w - 10, y + 46); c.lineTo(w - 10, y + 66); c.lineTo(w / 2, y + 26); c.lineTo(10, y + 66); c.closePath(); c.fill();
    }
    c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 7, h); c.fillRect(w - 7, 0, 7, h);
    koernung(c, w, h, 1500, 0.12);
  }, true);
}
function rampenBauen(S, gruppe, th){
  S.rampen = [];
  // Nur auf langen Geraden, mit Platz zum Landen, weg von Start, Item-Boxen und Turbo-Feldern
  const belegt = [0, 0.2, 0.36, 0.5, 0.64, 0.79, 0.92].map(a => Math.round(S.N * a) % S.N);
  for (const c of S.abk) belegt.push(c.i, c.j);
  const vor = Math.round(20 / S.ds), nach = Math.round(50 / S.ds), landung = Math.round(32 / S.ds);
  const kandidaten = [];
  for (let i = 0; i < S.N; i += 2){
    if (i * S.ds < 70 || i * S.ds > S.L - 50) continue;
    let gerade = true;
    for (let d = -vor; d <= nach && gerade; d++){ const j = (i + d + S.N) % S.N; if (Math.abs(S.kurv[j]) > 0.012 || Math.abs(S.steig[j]) > 0.02) gerade = false; }
    if (!gerade || belegt.some(b => ringAbstand(S, i, b) < 22 || ringAbstand(S, (i + landung) % S.N, b) < 14)) continue;
    kandidaten.push(i);
  }
  if (!kandidaten.length) return;
  const erste = kandidaten[Math.floor(kandidaten.length / 2)];
  let zweite = -1, weit = 150;
  for (const i of kandidaten){ const d = ringAbstand(S, i, erste); if (d > weit){ weit = d; zweite = i; } }
  const L = RAMPE_LAENGE, H = RAMPE_HOEHE, w = S.hw * 0.42;
  const tex = chevronTex(th.neon);
  tex.repeat.set(1, 1.5);
  const bahnMat = new THREE.MeshStandardMaterial({ map:tex, roughness:0.7, metalness:0.05, envMapIntensity:0.3 });
  const bahnGeo = new THREE.PlaneGeometry(w * 2, Math.hypot(L, H));
  bahnGeo.rotateX(-Math.PI / 2); bahnGeo.rotateY(Math.PI); bahnGeo.rotateX(-Math.atan2(H, L)); bahnGeo.translate(0, H / 2 + 0.03, L / 2);
  // Keil: Seitenwände und Rückwand
  const keil = new THREE.BufferGeometry();
  keil.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 0, 0, -w, 0, L, -w, H, L,   w, 0, 0, w, H, L, w, 0, L,
    -w, 0, L, w, 0, L, w, H, L,   -w, 0, L, w, H, L, -w, H, L
  ], 3));
  keil.computeVertexNormals();
  const keilMat = new THREE.MeshStandardMaterial({ color:lin(0x2c3038), roughness:0.6, metalness:0.3, side:THREE.DoubleSide });
  for (const i of zweite >= 0 ? [erste, zweite] : [erste]){
    const ort = streckenOrt(S, i, 0);
    const g = new THREE.Group();
    g.position.set(ort.x, ort.h, ort.z); g.rotation.y = yawBei(S, i);
    const bahn = new THREE.Mesh(bahnGeo, bahnMat); bahn.receiveShadow = true; bahn.castShadow = true;
    const k = new THREE.Mesh(keil, keilMat); k.castShadow = true;
    // Leuchtkante an der Absprungkante, dazu Pfosten mit Lampen
    const kanteMat = new THREE.MeshBasicMaterial({ color:lin(th.neon) });
    teil(GEO.box, kanteMat, g, 0, H + 0.02, L - 0.12, w * 2 + 0.3, 0.14, 0.3).castShadow = false;
    for (const sg of [-1, 1]){
      teil(GEO.box, keilMat, g, sg * (w + 0.25), 1.6, L - 0.2, 0.25, 3.2, 0.25);
      teil(GEO.kugelGrob, kanteMat, g, sg * (w + 0.25), 3.35, L - 0.2, 0.32, 0.32, 0.32).castShadow = false;
    }
    g.add(bahn, k);
    gruppe.add(g);
    S.rampen.push(Object.assign(ort, { halb:w, kante:kanteMat, basis:lin(th.neon) }));
  }
}
// Höhe der Schanze unter dem Kart, -1 wenn keine da ist
function rampeHoehe(S, k){
  for (const r of S.rampen){
    const [a, q] = ortLage(r, k.x, k.z);
    if (a >= 0 && a <= RAMPE_LAENGE && Math.abs(q) < r.halb + 0.3) return RAMPE_HOEHE * a / RAMPE_LAENGE;
  }
  return -1;
}
function abheben(k){
  k.vy = 4 + k.v * 0.32 + k.vb; k.sprung = true; k.trick = 0; k.trickOk = false;
  if (k.spieler) Ton.effekt('sprung');
  // Computerfahrer machen meistens auch einen Trick
  if (!k.mensch && Math.random() < 0.6){ k.trick = TRICK_DAUER; k.trickOk = true; }
}
function landen(k){
  if (nahAmSpieler(k.x, k.z, 70)){
    const [r, g, b] = strecke.th.staub;
    for (let n = 0; n < 12; n++){ const w = Math.random() * TAU; staub.neu(k.x + Math.cos(w) * 1.2, 0.3, k.z + Math.sin(w) * 1.2, Math.cos(w) * 3, zufall(0.5, 1.5), Math.sin(w) * 3, zufall(0.5, 0.9), r, g, b, 0.9, 1, 2.4, 0.7); }
  }
  if (k.spieler) zustand.wackeln = Math.max(zustand.wackeln, 0.15);
  if (!k.trickOk || k.dreh > 0) return;
  k.trickOk = false;
  boost(k, 0.9);
  buntStoss(k.x, 1.5, k.z);
  if (k.spieler){ meldung('Trick!', 0.9, true); Ton.effekt('trick'); vibrieren(40); }
}

/* ---------- Münzen: jede macht ein bisschen schneller (höchstens 10) ---------- */
const MAX_MUENZEN = 10;
const muenzGeo = geteilt((() => { const g = new THREE.CylinderGeometry(0.55, 0.55, 0.13, 22); g.rotateX(Math.PI / 2); return g; })());
const muenzMat = geteilt(new THREE.MeshStandardMaterial({ color:lin(0xffd22a), metalness:0.7, roughness:0.3, emissive:lin(0xb07000), envMapIntensity:1.2 }));
function muenzenBauen(S, gruppe){
  // Ein Bogen über jeder Schanze, genau auf der Flugbahn
  for (const r of S.rampen){
    [[14, 3.9], [20, 4.9], [26, 4.8], [32, 3.6]].forEach(([d, h]) => S.muenzen.push({ x:r.x + r.fx * d, z:r.z + r.fz * d, y:h + 0.8 + r.h }));
  }
  // Reihen auf der Straße, abwechselnd links und rechts
  [0.12, 0.42, 0.71].forEach((anteil, n) => {
    const seite = (n % 2 ? -0.45 : 0.45) * S.hw;
    for (let m = 0; m < 5; m++){
      const i = (Math.round(S.N * anteil) + Math.round(m * 3.5 / S.ds)) % S.N;
      if (S.rampen.some(r => ringAbstand(S, i, r.i) < 12)) continue;
      const [x, z] = punktBei(S, i, seite);
      S.muenzen.push({ x, z, y:1.0 + S.hy[i] });
    }
  });
  for (const m of S.muenzen) m.aus = 0;
  S.muenzMesh = new THREE.InstancedMesh(muenzGeo, muenzMat, Math.max(1, S.muenzen.length));
  S.muenzMesh.castShadow = true; S.muenzMesh.frustumCulled = false;
  gruppe.add(S.muenzMesh);
}
const muenzObj = new THREE.Object3D();
function muenzenUpdate(dt){
  const S = strecke;
  S.muenzen.forEach((m, i) => {
    if (m.aus > 0) m.aus -= dt;
    muenzObj.position.set(m.x, m.y + Math.sin(zeit * 3 + i) * 0.12, m.z);
    muenzObj.rotation.set(0, zeit * 3 + i * 0.4, 0);
    muenzObj.scale.setScalar(m.aus > 0 ? 0.0001 : 1);
    muenzObj.updateMatrix();
    S.muenzMesh.setMatrixAt(i, muenzObj.matrix);
    if (m.aus > 0 || !['rennen', 'auslauf'].includes(zustand.phase)) return;
    for (const k of karts){
      if (k.fern) continue;
      const dx = k.x - m.x, dz = k.z - m.z;
      if (dx * dx + dz * dz > 3.4 || Math.abs(k.boden + k.y + 0.8 - m.y) > 1.6) continue;
      muenzeWeg(m);
      ereignis({ a:'m', i });
      k.muenzen = Math.min(MAX_MUENZEN, k.muenzen + 1);
      if (k.spieler){ zustand.muenzRennen++; Ton.effekt('muenze'); }
      break;
    }
  });
  S.muenzMesh.instanceMatrix.needsUpdate = true;
}
function muenzeWeg(m){
  m.aus = 10;
  if (nahAmSpieler(m.x, m.z, 80)) for (let n = 0; n < 8; n++){ const w = Math.random() * TAU; funken.neu(m.x, m.y, m.z, Math.cos(w) * 3, zufall(1, 4), Math.sin(w) * 3, zufall(0.3, 0.5), 1, 0.85, 0.2, 0.45, 8); }
}
function muenzenVerlieren(k, anzahl){
  const weg = Math.min(k.muenzen, anzahl);
  k.muenzen -= weg;
  if (weg && nahAmSpieler(k.x, k.z, 80)) for (let n = 0; n < weg * 4; n++){ const w = Math.random() * TAU; funken.neu(k.x, k.y + 1.2, k.z, Math.cos(w) * 4, zufall(4, 8), Math.sin(w) * 4, zufall(0.5, 0.8), 1, 0.82, 0.15, 0.6, 16); }
}

/* ---------- Abkürzungen ----------
   Schotterwege quer durchs Gelände (langsamer Untergrund, aber viel kürzer – mit Turbo lohnt es sich),
   auf dem Wolkenreich eine Regenbogenbrücke ohne Geländer. Sie werden automatisch gesucht:
   ein Weg zwischen zwei Streckenpunkten, der kürzer ist und keinen anderen Streckenteil berührt. */
const ABK_BREITE = 4.2;
function abkuerzungenFinden(S){
  S.abk = [];
  const vorgabe = S.def.abk;
  const kand = [];
  const st = Math.max(1, Math.round(5 / S.ds));
  if (vorgabe){
    // Vorgabe: Bereiche für Anfang und Ende, darin der Weg mit dem größten Gewinn
    for (const [i0, i1, j0, j1, art] of vorgabe){
      for (let i = Math.round(i0 * S.N); i <= i1 * S.N; i += st) for (let j = Math.round(j0 * S.N); j <= j1 * S.N; j += st)
        for (const sg of [1, -1]){ const c = abkKandidat(S, i, j, sg, art); if (c.d / c.D <= 0.8 && c.d / c.D >= 0.42 && c.d > 50) kand.push(c); }
    }
    kand.sort((a, b) => (b.D - b.d) - (a.D - a.d));
  } else {
    const lo = Math.round(0.1 * S.N), hi = Math.round(0.88 * S.N);
    for (let i = lo; i < hi; i += st){
      for (let j = i + Math.round(80 / S.ds); j < Math.min(hi, i + Math.round(330 / S.ds)); j += st){
        for (const sg of [1, -1]){
          const c = abkKandidat(S, i, j, sg, 'erde');
          if (c.d / c.D >= 0.38 && c.d / c.D <= 0.72 && c.d > 50) kand.push(c);
        }
      }
    }
    kand.sort((a, b) => (b.D - b.d) - (a.D - a.d));
  }
  for (const c of kand){
    if (S.abk.length >= 2) break;
    if (S.abk.some(o => !(c.j * S.ds + 60 < o.i * S.ds || c.i * S.ds > o.j * S.ds + 60))) continue;
    if (!abkPruefen(S, c)) continue;
    S.abk.push(abkFertig(S, c));
  }
}
// Geschwungener Weg (Bézier), der tangential aus der Strecke heraus- und wieder hineinläuft
function abkKandidat(S, i, j, sg, art){
  const [ax, az] = punktBei(S, i, sg * S.hw * 0.6), [bx, bz] = punktBei(S, j, sg * S.hw * 0.6);
  const sehne = Math.hypot(bx - ax, bz - az), l = sehne * 0.38;
  const c = { i, j, sg, art, ax, az, bx, bz, D:(j - i) * S.ds,
    k1x:ax + S.tx[i] * l, k1z:az + S.tz[i] * l, k2x:bx - S.tx[j] * l, k2z:bz - S.tz[j] * l };
  let d = 0, [px, pz] = abkPunkt(c, 0);
  for (let m = 1; m <= 12; m++){ const [x, z] = abkPunkt(c, m / 12); d += Math.hypot(x - px, z - pz); px = x; pz = z; }
  c.d = d;
  return c;
}
function abkPunkt(c, t){
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, e = 3 * u * t * t, f = t * t * t;
  return [a * c.ax + b * c.k1x + e * c.k2x + f * c.bx, a * c.az + b * c.k1z + e * c.k2z + f * c.bz];
}
const abkHoehe = (S, c, t) => S.hy[c.i] + (S.hy[c.j] - S.hy[c.i]) * t + (c.art === 'bruecke' ? Math.sin(t * Math.PI) * 6 : 0);
// Der Weg muss die Strecke schnell verlassen und darf sonst nirgends in ihre Nähe kommen
function abkPruefen(S, c){
  const n = Math.ceil(c.d / 3), rand = S.hw + S.auslauf + 4;
  for (let m = 1; m < n; m++){
    const t = m / n, s = t * c.d, [x, z] = abkPunkt(c, t), h = abkHoehe(S, c, t);
    if (Math.hypot(x - S.px[0], z - S.pz[0]) < 60) return false;
    if (S.sperre && Math.hypot(x - S.sperre.x, z - S.sperre.z) < S.sperre.r + 6) return false;
    const ende = Math.min(60, c.d * 0.3), amEnde = s < ende || c.d - s < ende;
    for (let k = 0; k < S.N; k += 2){
      const dx = x - S.px[k], dz = z - S.pz[k];
      if (dx * dx + dz * dz > rand * rand || Math.abs(S.hy[k] - h) > 7) continue;
      if (amEnde && (ringAbstand(S, k, c.i) < s + 20 || ringAbstand(S, k, c.j) < c.d - s + 20)) continue;
      return false;
    }
  }
  return true;
}
function abkFertig(S, c){
  const n = Math.max(2, Math.ceil(c.d / 2));
  c.px = new Float32Array(n + 1); c.pz = new Float32Array(n + 1); c.ph = new Float32Array(n + 1);
  for (let m = 0; m <= n; m++){
    const t = m / n;
    [c.px[m], c.pz[m]] = abkPunkt(c, t); c.ph[m] = abkHoehe(S, c, t);
    gitterEintragen(S, c.px[m], c.pz[m], c.ph[m]);
  }
  c.n = n; c.hb = ABK_BREITE;
  // Richtung quer zum Weg an jedem Punkt
  c.lx = new Float32Array(n + 1); c.lz = new Float32Array(n + 1);
  for (let m = 0; m <= n; m++){
    const a = Math.max(0, m - 1), b = Math.min(n, m + 1), dx = c.px[b] - c.px[a], dz = c.pz[b] - c.pz[a], l = Math.hypot(dx, dz) || 1;
    c.lx[m] = dz / l; c.lz[m] = -dx / l;
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let m = 0; m <= n; m++){ x0 = Math.min(x0, c.px[m]); x1 = Math.max(x1, c.px[m]); z0 = Math.min(z0, c.pz[m]); z1 = Math.max(z1, c.pz[m]); }
  c.box = [x0 - 12, x1 + 12, z0 - 12, z1 + 12];
  c.nr = S.abk.length;
  return c;
}
// Abstand zum Weg, Anteil t (0 = Anfang, 1 = Ende) und nächster Punkt auf dem Weg
function abkLage(c, x, z){
  if (x < c.box[0] || x > c.box[1] || z < c.box[2] || z > c.box[3]) return [Infinity, 0, 0, 0];
  let best = Infinity, bt = 0, bx = 0, bz = 0;
  for (let m = 0; m < c.n; m++){
    const ax = c.px[m], az = c.pz[m], sx = c.px[m + 1] - ax, sz = c.pz[m + 1] - az, l2 = sx * sx + sz * sz || 1;
    const u = klemm(((x - ax) * sx + (z - az) * sz) / l2, 0, 1), nx = ax + sx * u, nz = az + sz * u, d2 = (x - nx) ** 2 + (z - nz) ** 2;
    if (d2 < best){ best = d2; bt = (m + u) / c.n; bx = nx; bz = nz; }
  }
  return [Math.sqrt(best), bt, bx, bz];
}
const abkPunktH = (c, t) => { const f = t * c.n, m = Math.min(c.n - 1, Math.floor(f)); return c.ph[m] + (c.ph[m + 1] - c.ph[m]) * (f - m); };
// Ist das Kart auf einer Abkürzung? Dann folgen Index, Fortschritt und Boden dem Weg.
function abkFolgen(S, k){
  const war = k.aufAbk;
  k.aufAbk = null;
  if (k.faellt) return;
  for (const c of S.abk){
    const [d, t] = abkLage(c, k.x, k.z);
    if (d > c.hb + (t < 0.25 || t > 0.75 ? 2.5 : 0.6)) continue;
    // An den Enden gilt die normale Strecke, solange man noch auf der Straße ist
    if (Math.abs(k.seite) < S.hw + 1 && (t < 0.2 || t > 0.8) && war !== c) continue;
    if ((t > 0.97 || (d > c.hb && (t < 0.2 || t > 0.8))) && Math.abs(k.seite) < S.hw + S.auslauf) continue;
    k.aufAbk = c; k.abkT = t;
    const idx = (c.i + Math.round(t * (c.j - c.i))) % S.N;
    k.idx = idx;
    k.fortschritt = k.runde * S.L + idx * S.ds;
    break;
  }
}
// Pfad als Band auf dem Boden (oder als Brücke in der Luft)
function abkBand(c, breite, y, mat){
  const n = c.n, pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), nor = new Float32Array((n + 1) * 6);
  for (let m = 0; m <= n; m++){
    const x = c.px[m], z = c.pz[m], h = c.ph[m] + y, lx = c.lx[m], lz = c.lz[m];
    pos.set([x + lx * breite, h, z + lz * breite, x - lx * breite, h, z - lz * breite], m * 6);
    uv.set([0, m * 2 / 6, 1, m * 2 / 6], m * 4); nor.set([0, 1, 0, 0, 1, 0], m * 6);
  }
  const index = [];
  for (let m = 0; m < n; m++){ const a = 2 * m; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(index);
  const me = new THREE.Mesh(g, mat); me.receiveShadow = true;
  return me;
}
function abkuerzungenBauen(S, gruppe, th){
  if (!S.abk.length) return;
  const erdeTex = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = th.deko === 'vulkan' ? '#3a2c26' : th.schnee ? '#c9d6e2' : th.deko === 'kakteen' ? '#b07a45' : th.deko === 'palmen' ? '#d9bd84' : '#8a6238';
    c.fillRect(0, 0, w, h);
    koernung(c, w, h, 5000, 0.25);
    // Fahrspuren
    c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(w * 0.22, 0, 14, h); c.fillRect(w * 0.7, 0, 14, h);
    for (let n = 0; n < 40; n++){ c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, TAU); c.fill(); }
  }, true);
  const brueckeTex = canvasTex(128, 64, (c, w, h) => {
    const farben = ['#ff4d6d', '#ff9f1c', '#ffd23f', '#3fd17a', '#3aa0ff', '#8a5cff'];
    farben.forEach((f, n) => { c.fillStyle = f; c.fillRect(n * w / 6, 0, w / 6, h); });
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, h - 4, w, 4);
  }, true);
  const pfostenMat = std(0x6b4a2a, 0.9), lampeMat = new THREE.MeshBasicMaterial({ color:lin(th.neon) });
  const inst = new Instanzen();
  for (const c of S.abk){
    const bruecke = c.art === 'bruecke';
    const mat = bruecke
      ? new THREE.MeshStandardMaterial({ map:brueckeTex, roughness:0.4, emissive:lin(0x222222), side:THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ map:erdeTex, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
    gruppe.add(abkBand(c, c.hb, bruecke ? 0 : 0.03, mat));
    for (let m = 2; m < c.n - 1; m += bruecke ? 4 : 3){
      const x = c.px[m], z = c.pz[m], h = c.ph[m], lx = c.lx[m], lz = c.lz[m];
      if (bruecke){
        // Stützen hinunter in die Wolken, Leuchtpunkte am Rand
        if (m % 12 === 2) inst.add('stuetze', GEO.zylGrob, MAT.weiss, [x, h - 40, z], [0.5, 80, 0.5]);
        for (const sg of [-1, 1]) inst.add('licht', GEO.kugelGrob, lampeMat, [x + lx * sg * (c.hb + 0.1), h + 0.15, z + lz * sg * (c.hb + 0.1)], [0.22, 0.22, 0.22]);
      } else {
        for (const sg of [-1, 1]) inst.add('pfosten', GEO.zylGrob, pfostenMat, [x + lx * sg * (c.hb + 0.5), h + 0.5, z + lz * sg * (c.hb + 0.5)], [0.14, 1, 0.14]);
      }
    }
    if (bruecke){
      const unter = abkBand(c, c.hb, -0.4, new THREE.MeshStandardMaterial({ color:lin(0xf4f4ff), roughness:0.6 }));
      gruppe.add(unter);
    }
    // Schild an der Einfahrt
    const schildTex = canvasTex(256, 96, (cx, w, h) => {
      cx.fillStyle = '#20232a'; cx.fillRect(0, 0, w, h);
      cx.strokeStyle = cssFarbe(th.neon); cx.lineWidth = 8; cx.strokeRect(4, 4, w - 8, h - 8);
      cx.font = '900 40px "Barlow SC", system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillStyle = '#ffd23f'; cx.fillText(bruecke ? '🌈 BRÜCKE ➜' : 'ABKÜRZUNG ➜', w / 2, h / 2 + 2);
    });
    const schild = new THREE.Group();
    const m0 = Math.min(c.n, 8), sx = c.px[m0] + c.lx[m0] * (c.hb + 1.6), sz = c.pz[m0] + c.lz[m0] * (c.hb + 1.6);
    schild.position.set(sx, c.ph[m0], sz); schild.rotation.y = Math.atan2(c.px[m0 + 1] - c.px[m0], c.pz[m0 + 1] - c.pz[m0]) + Math.PI / 2;
    teil(GEO.box, pfostenMat, schild, 0, 1.4, 0, 0.18, 2.8, 0.18);
    const brett = teil(GEO.box, new THREE.MeshBasicMaterial({ map:schildTex }), schild, 0, 3.0, 0, 3.2, 1.2, 0.12);
    brett.material.map.wrapS = THREE.ClampToEdgeWrapping;
    gruppe.add(schild);
    // Ein paar Münzen als Belohnung
    for (const t of [0.35, 0.5, 0.65]){
      const f = t * c.n, m = Math.floor(f);
      S.muenzen.push({ x:c.px[m], z:c.pz[m], y:c.ph[m] + 1, aus:0 });
    }
  }
  inst.bauen(gruppe);
}
// Computerfahrer: vor der Einfahrt entscheiden, ob sie die Abkürzung nehmen
function abkZiel(S, k){
  if (!S.abk.length) return null;
  if (k.aufAbk){
    const c = k.aufAbk, t = Math.min(1, k.abkT + 12 / c.d);
    return abkPunkt(c, t);
  }
  for (const c of S.abk){
    // Schon auf dem Anfang des Wegs (der läuft erst neben der Strecke her): dem Weg folgen
    if (k.abkJa && k.abkPlan === `${c.nr}:${k.runde}`){
      const [d, t] = abkLage(c, k.x, k.z);
      if (d < c.hb + 3 && t < 0.6) return abkPunkt(c, Math.min(1, t + 12 / c.d));
    }
    let vor = c.i - k.idx; if (vor < -S.N / 2) vor += S.N;
    vor *= S.ds;
    if (vor < -6 || vor > 55) continue;
    const plan = `${c.nr}:${k.runde}`;
    if (k.abkPlan !== plan){
      k.abkPlan = plan;
      const turbo = k.item === 'turbo' || k.item === 'turbo3' || k.item === 'stern' || k.boost > 0;
      k.abkJa = Math.random() < (c.art === 'bruecke' ? 0.55 : turbo ? 0.85 : 0.3);
    }
    if (!k.abkJa) return null;
    if (c.art === 'bruecke' && vor < 45) k.abkLangsam = true;
    return abkPunkt(c, vor > 8 ? 0.02 : 0.15);
  }
  return null;
}

/* ---------- Leuchtbögen über der Strecke ---------- */
function boegenBauen(S, gruppe, th){
  S.boegen = [];
  const R = S.hw + 2.2, anzahl = 7;
  const bogenGeo = new THREE.TorusGeometry(R, 0.32, 8, 40, Math.PI);
  const hofGeo = new THREE.TorusGeometry(R, 0.95, 8, 40, Math.PI);
  const fussMat = std(0x2a2d33, 0.5, 0.4);
  for (let n = 0; n < anzahl; n++){
    const i = Math.round(S.N * (0.07 + n / anzahl * 0.86));
    if (S.rampen.some(r => ringAbstand(S, i, r.i) < 18)) continue;
    const ort = streckenOrt(S, i, 0);
    const fuesse = [punktBei(S, i, R), punktBei(S, i, -R)];
    if (!fuesse.every(([x, z]) => fremdFrei(S, x, z, i, S.hw + S.auslauf + 2))) continue;
    if (S.sperre && fuesse.some(([x, z]) => Math.hypot(x - S.sperre.x, z - S.sperre.z) < S.sperre.r)) continue;
    const g = new THREE.Group();
    g.position.set(ort.x, ort.h, ort.z); g.rotation.order = 'YXZ'; g.rotation.set(-Math.atan(S.steig[i]), yawBei(S, i), 0);
    const mat = new THREE.MeshBasicMaterial({ color:lin(th.neon) });
    const hofMat = new THREE.MeshBasicMaterial({ color:lin(th.neon), transparent:true, opacity:0.2, blending:THREE.AdditiveBlending, depthWrite:false });
    const bogen = new THREE.Mesh(bogenGeo, mat); bogen.scale.y = 0.72;
    const hof = new THREE.Mesh(hofGeo, hofMat); hof.scale.y = 0.72;
    g.add(bogen, hof);
    for (const sg of [-1, 1]) teil(GEO.box, fussMat, g, sg * R, 0.4, 0, 1.4, 0.8, 1.4);
    gruppe.add(g);
    S.boegen.push({ mat, hofMat, basis:lin(th.neon) });
  }
}

/* ---------- Glatteis (Frostgipfel) ---------- */
function eisBauen(S, gruppe, rnd){
  const tex = canvasTex(256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(225,245,255,.92)'); g.addColorStop(0.75, 'rgba(200,232,250,.85)'); g.addColorStop(1, 'rgba(200,232,250,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5;
    for (let n = 0; n < 16; n++){
      let x = w / 2 + (Math.random() - 0.5) * w * 0.6, y = h / 2 + (Math.random() - 0.5) * h * 0.6;
      c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < 5; s++){ x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; c.lineTo(x, y); }
      c.stroke();
    }
  });
  const mat = new THREE.MeshStandardMaterial({ map:tex, transparent:true, roughness:0.05, metalness:0.2, envMapIntensity:1.4, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-5 });
  for (let versuch = 0; versuch < 60 && S.eis.length < 5; versuch++){
    const i = Math.floor(rnd() * S.N);
    if (ringAbstand(S, i, 0) < 70 || S.rampen.some(r => ringAbstand(S, i, r.i) < 30) || S.eis.some(e => ringAbstand(S, i, e.i) < 90)) continue;
    const lq = S.hw * (0.35 + rnd() * 0.25), la = 9 + rnd() * 6, seite = (rnd() * 2 - 1) * (S.hw - lq);
    const ort = streckenOrt(S, i, seite);
    const m = new THREE.Mesh(GEO.scheibe, mat);
    aufStrasse(m, S, ort, 0.075); m.scale.set(lq * 2, 1, la * 2);
    m.receiveShadow = true;
    gruppe.add(m);
    S.eis.push(Object.assign(ort, { la, lq }));
  }
}
function aufEis(S, k){
  if (k.y > 0.05) return false;
  for (const e of S.eis){
    const [a, q] = ortLage(e, k.x, k.z), fa = a / e.la, fq = q / e.lq;
    if (fa * fa + fq * fq < 0.85) return true;
  }
  return false;
}

/* ---------- Meteore (Vulkankrater) und Steppenläufer (Kaktus-Canyon) ----------
   Jeder Rechner lässt sie vor seinem eigenen Kart erscheinen und prüft nur Karts, die er selbst steuert. */
const GEFAHR = {
  ring:geteilt((() => { const g = new THREE.RingGeometry(2.4, 3.3, 40); g.rotateX(-Math.PI / 2); return g; })()),
  fels:geteilt(new THREE.IcosahedronGeometry(1.15, 0)),
  ball:geteilt(new THREE.IcosahedronGeometry(1.1, 1)),
  warnMat:geteilt(new THREE.MeshBasicMaterial({ color:0xff3a1a, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6 })),
  warnFleck:geteilt(new THREE.MeshBasicMaterial({ map:partikelTex, color:0xff2a0a, transparent:true, opacity:0.45, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6 })),
  felsMat:geteilt(new THREE.MeshBasicMaterial({ color:lin(0xffb050) })),
  felsHof:geteilt(new THREE.SpriteMaterial({ map:partikelTex, color:0xff6a1a, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false })),
  kraterMat:geteilt(new THREE.MeshBasicMaterial({ map:partikelTex, color:0x140806, transparent:true, opacity:0.8, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5 })),
  zweigMat:geteilt(new THREE.MeshLambertMaterial({ color:lin(0x9a6a36), wireframe:true })),
  zweigInnen:geteilt(new THREE.MeshLambertMaterial({ color:lin(0x6e4a22), wireframe:true }))
};
function gefahrenLeeren(){
  if (!strecke || !strecke.gefahren) return;
  for (const g of strecke.gefahren) strecke.gruppe.remove(g.mesh);
  strecke.gefahren.length = 0;
  strecke.gefahrTimer = 4;
}
function gefahrZiel(){
  // Meistens vor dem eigenen Kart, manchmal vor einem eigenen Computerfahrer
  const eigene = karts.filter(k => !k.fern && !k.fertig);
  if (!eigene.length) return null;
  return spieler && !spieler.fertig && Math.random() < 0.6 ? spieler : eigene[Math.floor(Math.random() * eigene.length)];
}
function gefahrenUpdate(dt){
  const S = strecke;
  if (!S.th.gefahr || S.th.gefahr === 'eis' || zustand.zeitfahren) return;
  if (zustand.phase === 'rennen'){
    S.gefahrTimer -= dt;
    if (S.gefahrTimer <= 0){
      const k = gefahrZiel();
      if (S.th.gefahr === 'meteor'){ S.gefahrTimer = zufall(1.4, 2.8); if (k) meteorStarten(k); }
      else { S.gefahrTimer = zufall(1.8, 3.4); if (k) steppenlaeuferStarten(k); }
    }
  }
  for (let n = S.gefahren.length - 1; n >= 0; n--){
    const g = S.gefahren[n];
    g.t += dt;
    if (g.art === 'meteor' ? meteorSchritt(g, dt) : laeuferSchritt(g, dt)){ S.gruppe.remove(g.mesh); S.gefahren.splice(n, 1); }
  }
}
function meteorStarten(k){
  const S = strecke, i = (k.idx + Math.round((Math.max(10, k.v) * 1.7 + zufall(4, 18)) / S.ds)) % S.N;
  const [x, z] = punktBei(S, i, klemm(k.seite + zufall(-5, 5), -S.hw * 0.8, S.hw * 0.8));
  const mesh = new THREE.Group();
  mesh.position.set(x, 0, z);
  const ring = new THREE.Mesh(GEFAHR.ring, GEFAHR.warnMat); ring.position.y = 0.09;
  const fleck = new THREE.Mesh(GEO.scheibe, GEFAHR.warnFleck); fleck.position.y = 0.08; fleck.scale.set(6, 1, 6);
  const fels = new THREE.Mesh(GEFAHR.fels, GEFAHR.felsMat);
  const hof = new THREE.Sprite(GEFAHR.felsHof); hof.scale.set(5, 5, 1);
  const stein = new THREE.Group(); stein.add(fels, hof);
  mesh.add(ring, fleck, stein);
  S.gruppe.add(mesh);
  S.gefahren.push({ art:'meteor', mesh, ring, fleck, stein, fels, x, z, t:0, fall:1.7, dx:zufall(-1, 1), knall:false });
}
function meteorSchritt(g, dt){
  const f = g.t / g.fall;
  if (!g.knall){
    const puls = 0.5 + 0.5 * Math.sin(g.t * 18);
    g.ring.scale.setScalar(1.25 - 0.25 * f); g.fleck.material.opacity = 0.3 + 0.3 * puls;
    // Fällt schräg aus dem Himmel, immer schneller
    const e = f * f, h = 75 * (1 - e);
    g.stein.position.set(g.dx * 30 * (1 - e), h + 0.8, 18 * (1 - e));
    g.fels.rotation.set(g.t * 5, g.t * 3, 0);
    if (nahAmSpieler(g.x, g.z, 120)) for (let n = 0; n < 2; n++){
      funken.neu(g.x + g.stein.position.x + zufall(-0.6, 0.6), h + 1, g.z + g.stein.position.z + zufall(-0.6, 0.6), zufall(-1, 1), zufall(1, 3), zufall(-1, 1), zufall(0.3, 0.6), 1, zufall(0.35, 0.65), 0.1, zufall(0.6, 1.1), -2);
      staub.neu(g.x + g.stein.position.x, h + 1.5, g.z + g.stein.position.z, 0, 1, 0, zufall(0.8, 1.3), 0.22, 0.2, 0.2, 1.4, -0.5, 3, 0.55);
    }
    if (f < 1) return false;
    // Einschlag
    g.knall = true; g.t = 0;
    g.stein.visible = false; g.ring.visible = false;
    g.fleck.material = GEFAHR.kraterMat; g.fleck.scale.set(7, 1, 7);
    explosion(g.x, 0.8, g.z, 46);
    for (let n = 0; n < 30; n++){ const w = Math.random() * TAU, s = zufall(6, 16); funken.neu(g.x, 0.6, g.z, Math.cos(w) * s, zufall(4, 12), Math.sin(w) * s, zufall(0.5, 1), 1, zufall(0.3, 0.55), 0.05, zufall(0.5, 1), 18); }
    if (nahAmSpieler(g.x, g.z, 70)) Ton.effekt('explosion');
    if (spieler && Math.hypot(spieler.x - g.x, spieler.z - g.z) < 30) zustand.wackeln = Math.max(zustand.wackeln, 0.45);
    for (const k of karts) if (!k.fern && Math.hypot(k.x - g.x, k.z - g.z) < 3.6) treffer(k, 'rakete');
    return false;
  }
  return g.t > 3.5;
}
function steppenlaeuferStarten(k){
  const S = strecke, i = (k.idx + Math.round((Math.max(10, k.v) * 1.6 + zufall(10, 25)) / S.ds)) % S.N;
  const sg = Math.random() < 0.5 ? 1 : -1, weg = S.hw + 9;
  const [x, z] = punktBei(S, i, sg * weg);
  const mesh = new THREE.Group();
  const aussen = new THREE.Mesh(GEFAHR.ball, GEFAHR.zweigMat), innen = new THREE.Mesh(GEFAHR.ball, GEFAHR.zweigInnen);
  innen.scale.setScalar(0.65); innen.rotation.set(1, 2, 0.5);
  const ball = new THREE.Group(); ball.add(aussen, innen);
  const schatten = new THREE.Mesh(GEO.scheibe, MAT.kontakt); schatten.scale.set(2.2, 1, 2.2); schatten.position.y = 0.08;
  mesh.add(ball, schatten);
  mesh.position.set(x, 0, z);
  S.gruppe.add(mesh);
  // Rollt quer über die Strecke auf die andere Seite
  const tempo = zufall(7, 10);
  S.gefahren.push({ art:'steppe', mesh, ball, x, z, vx:-S.tz[i] * sg * tempo, vz:S.tx[i] * sg * tempo, t:0, dauer:weg * 2 / tempo, phase:Math.random() * TAU });
}
function laeuferSchritt(g, dt){
  g.x += g.vx * dt; g.z += g.vz * dt;
  g.mesh.position.set(g.x, 0, g.z);
  g.ball.position.y = 1.1 + Math.abs(Math.sin(g.t * 4.5 + g.phase)) * 1.3;
  g.ball.rotation.x += dt * 6; g.ball.rotation.z += dt * 2;
  for (const k of karts){
    if (k.fern || k.y > 1.6 || Math.hypot(k.x - g.x, k.z - g.z) > 2.2) continue;
    treffer(k, 'stoss');
    const [r, gg, b] = strecke.th.staub;
    for (let n = 0; n < 24; n++){ const w = Math.random() * TAU; staub.neu(g.x, g.ball.position.y, g.z, Math.cos(w) * zufall(2, 6), zufall(1, 5), Math.sin(w) * zufall(2, 6), zufall(0.5, 1), 0.55, 0.38, 0.2, 0.45, 9, 0.2, 1); }
    for (let n = 0; n < 6; n++) staub.neu(g.x, 0.5, g.z, zufall(-2, 2), zufall(0.5, 1.5), zufall(-2, 2), zufall(0.6, 1), r, gg, b, 1.2, -0.3, 2.5, 0.6);
    if (k.spieler || nahAmSpieler(g.x, g.z, 30)) Ton.effekt('stoss');
    return true;
  }
  return g.t > g.dauer;
}

/* ---------- Kulisse ---------- */
// Platz außerhalb der Strecke, zwischen innen und außen Metern vom Streckenrand weg
function kulissenPlatz(S, rnd, innen, aussen){
  for (let versuch = 0; versuch < 40; versuch++){
    const i = Math.floor(rnd() * S.N), sg = rnd() < 0.5 ? 1 : -1;
    const [x, z] = punktBei(S, i, sg * (S.hw + innen + rnd() * (aussen - innen)));
    let ok = true;
    for (let j = 0; j < S.N && ok; j += 3){ const dx = x - S.px[j], dz = z - S.pz[j]; if (dx * dx + dz * dz < (S.hw + innen) ** 2) ok = false; }
    if (ok && !imMeer(S, x, z) && !abkuerzungDa(S, x, z, 12) && !(S.sperre && Math.hypot(x - S.sperre.x, z - S.sperre.z) < S.sperre.r + 10)) return [x, z];
  }
  return null;
}
function ballonsBauen(S, gruppe, rnd){
  const farben = [['#e8322a', '#ffd23f'], ['#2c6fd8', '#f5f5f5'], ['#3fae49', '#ffd23f'], ['#9357d4', '#ff8ac0'], ['#ff7a1a', '#20232a']];
  const cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2, R = Math.max(S.maxX - S.minX, S.maxZ - S.minZ) / 2;
  const korbMat = std(0x8a5a2a, 0.9), seilMat = std(0x3a3030, 0.9);
  for (let n = 0; n < 5; n++){
    const [a, b] = farben[n];
    const tex = canvasTex(256, 64, (c, w, h) => { for (let x = 0; x < 8; x++){ c.fillStyle = x % 2 ? b : a; c.fillRect(x * w / 8, 0, w / 8, h); } c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(0, h * 0.62, w, 6); });
    const g = new THREE.Group();
    const huelle = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshLambertMaterial({ map:tex }));
    huelle.scale.set(1, 1.18, 1); huelle.position.y = 12;
    const spitze = new THREE.Mesh(new THREE.ConeGeometry(4.6, 6, 20, 1, true), huelle.material);
    spitze.rotation.x = Math.PI; spitze.position.y = 4.6;
    g.add(huelle, spitze);
    teil(GEO.box, korbMat, g, 0, 0, 0, 2, 1.6, 2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const s = teil(GEO.zylGrob, seilMat, g, sx * 1.6, 1.8, sz * 1.6, 0.06, 2.8, 0.06); s.rotation.set(sz * -0.4, 0, sx * 0.4); }
    gruppe.add(g);
    S.kulisse.ballons.push({ g, w:rnd() * TAU, r:R * (0.4 + rnd() * 0.9), cx, cz, y:45 + rnd() * 50, tempo:(rnd() < 0.5 ? -1 : 1) * (0.006 + rnd() * 0.008), phase:rnd() * TAU });
  }
}
function windraederBauen(S, gruppe, rnd){
  const weiss = std(0xf2f4f6, 0.5), dunkel = std(0xd0d4da, 0.5);
  for (let n = 0; n < 5; n++){
    const p = kulissenPlatz(S, rnd, 45, 130);
    if (!p) continue;
    const g = new THREE.Group(), s = 0.8 + rnd() * 0.4;
    g.position.set(p[0], 0, p[1]); g.scale.setScalar(s); g.rotation.y = rnd() * TAU;
    const turm = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.1, 34, 12), weiss); turm.position.y = 17; turm.castShadow = true;
    g.add(turm);
    teil(rundBox(1.4, 1.4, 3.6, 0.5), dunkel, g, 0, 34.4, 0.6);
    const rotor = new THREE.Group(); rotor.position.set(0, 34.4, 2.6);
    teil(GEO.kugelGrob, weiss, rotor, 0, 0, 0, 0.7, 0.7, 0.9);
    for (let f = 0; f < 3; f++){
      const fluegel = new THREE.Group(); fluegel.rotation.z = f * TAU / 3;
      teil(GEO.box, weiss, fluegel, 0, 7, 0, 0.9, 14, 0.2);
      rotor.add(fluegel);
    }
    g.add(rotor);
    gruppe.add(g);
    S.kulisse.rotoren.push({ rotor, tempo:0.8 + rnd() * 0.6 });
  }
}
function delfineBauen(S, gruppe, rnd){
  const haut = std(0x6f8fa8, 0.35, 0.1), bauch = std(0xdfe8ee, 0.5);
  for (let n = 0; n < 4; n++){
    const g = new THREE.Group();
    const koerper = new THREE.Group(); g.add(koerper);
    teil(GEO.kugelMittel, haut, koerper, 0, 0, 0, 0.7, 0.75, 2.4);
    teil(GEO.kugelMittel, bauch, koerper, 0, -0.25, 0.2, 0.55, 0.45, 1.9);
    teil(GEO.kegelGrob, haut, koerper, 0, 0.75, -0.2, 0.25, 0.8, 0.5).rotation.x = -0.4;
    teil(GEO.kegelGrob, haut, koerper, 0, 0, 2.6, 0.18, 0.7, 0.18).rotation.x = Math.PI / 2;
    teil(GEO.box, haut, koerper, 0, 0, -2.4, 1.6, 0.12, 0.5);
    g.visible = false;
    gruppe.add(g);
    S.kulisse.delfine.push({ g, koerper, x:S.minX + rnd() * (S.maxX - S.minX), z:S.minZ - 70 - rnd() * 120, dreh:rnd() * TAU, phase:rnd() * 6, takt:5 + rnd() * 3 });
  }
}
function booteBauen(S, gruppe, rnd){
  const rumpfMat = std(0xf4f4f0, 0.5), deckMat = std(0x8a5a2a, 0.8);
  const segelGeo = new THREE.BufferGeometry();
  segelGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 9, 0, 0, 0, 5], 3)); segelGeo.computeVertexNormals();
  for (let n = 0; n < 5; n++){
    const g = new THREE.Group();
    teil(rundBox(3, 1.4, 9, 0.6), rumpfMat, g, 0, 0.3, 0);
    teil(GEO.box, deckMat, g, 0, 1.05, 0, 2.6, 0.1, 7.5);
    teil(GEO.zylGrob, deckMat, g, 0, 6, 0.5, 0.12, 10, 0.12);
    const segel = new THREE.Mesh(segelGeo, new THREE.MeshLambertMaterial({ color:lin([0xffffff, 0xe8322a, 0xffd23f, 0x2c6fd8, 0x18e0c8][n]), side:THREE.DoubleSide }));
    segel.position.set(0, 1.4, 0.7); g.add(segel);
    g.position.set(S.minX - 100 + rnd() * (S.maxX - S.minX + 200), 0.2, S.minZ - 110 - rnd() * 260);
    g.rotation.y = Math.PI / 2 + (rnd() - 0.5) * 0.6;
    g.scale.setScalar(1.3);
    gruppe.add(g);
    S.kulisse.boote.push({ g, tempo:(rnd() < 0.5 ? -1 : 1) * (1.5 + rnd() * 2), phase:rnd() * TAU, x0:g.position.x });
  }
}
function polarlichtBauen(S, gruppe){
  // Leuchtende Vorhänge hoch am Himmel, die sich langsam wellen
  const uni = { zeit:{ value:0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms:uni, transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, fog:false,
    vertexShader:'uniform float zeit; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * 0.006 + zeit * 0.4) * 60.0 + sin(p.x * 0.017 - zeit * 0.7) * 18.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader:'uniform float zeit; varying vec2 vUv; void main(){ float band = sin(vUv.x * 40.0 + zeit * 0.9) * 0.5 + 0.5; band = 0.45 + 0.55 * band * band; float a = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y)) * smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x)); vec3 c = mix(vec3(0.1, 1.0, 0.55), vec3(0.55, 0.3, 1.0), vUv.y); gl_FragColor = vec4(c * band * a * 0.55, 1.0); }'
  });
  const cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2;
  const g = new THREE.Group();
  for (const [w, r, y] of [[0.4, 900, 260], [2.2, 1000, 300], [4.1, 950, 240]]){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1600, 260, 64, 1), mat);
    m.position.set(cx + Math.cos(w) * r, y, cz + Math.sin(w) * r);
    m.lookAt(cx, y, cz);
    m.frustumCulled = false;
    g.add(m);
  }
  gruppe.add(g);
  S.kulisse.polarlicht = uni;
}
function feuerwerk(S){
  const cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2, w = Math.random() * TAU, r = zufall(200, 420);
  const x = cx + Math.cos(w) * r, z = cz + Math.sin(w) * r, y = zufall(70, 130);
  const c = new THREE.Color().setHSL(Math.random(), 1, 0.6), c2 = new THREE.Color().setHSL(Math.random(), 1, 0.7);
  for (let n = 0; n < 60; n++){
    const a = Math.random() * TAU, b = Math.acos(zufall(-1, 1)), s = zufall(16, 22), f = n % 3 ? c : c2;
    funken.neu(x, y, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, zufall(1.2, 1.8), f.r, f.g, f.b, zufall(3, 4.5), 6, -0.8);
  }
}
function kulisseUpdate(dt){
  const S = strecke, K = S.kulisse;
  for (const b of S.boegen){
    // Lauflicht: die Bögen leuchten nacheinander auf
    const p = 0.5 + 0.5 * Math.sin(zeit * 4 - S.boegen.indexOf(b) * 0.9);
    b.mat.color.copy(b.basis).multiplyScalar(0.55 + 0.8 * p);
    b.hofMat.opacity = 0.08 + 0.22 * p;
  }
  for (const r of S.rampen) r.kante.color.copy(r.basis).multiplyScalar(0.7 + 0.5 * Math.sin(zeit * 6));
  if (!K) return;
  for (const b of K.ballons){
    b.w += b.tempo * dt;
    b.g.position.set(b.cx + Math.cos(b.w) * b.r, b.y + Math.sin(zeit * 0.4 + b.phase) * 3, b.cz + Math.sin(b.w) * b.r);
    b.g.rotation.y += dt * 0.05;
  }
  for (const r of K.rotoren) r.rotor.rotation.z += dt * r.tempo;
  for (const d of K.delfine){
    // Alle paar Sekunden ein Sprung im Bogen aus dem Wasser
    const t = (zeit + d.phase) % d.takt, f = t / 1.4;
    d.g.visible = f < 1;
    if (!d.g.visible) continue;
    const fx = Math.sin(d.dreh), fz = Math.cos(d.dreh);
    d.g.position.set(d.x + fx * (f - 0.5) * 14, 0.35 - 1.6 + Math.sin(f * Math.PI) * 6.5, d.z + fz * (f - 0.5) * 14);
    d.g.rotation.set(0, d.dreh, 0);
    d.koerper.rotation.x = -Math.cos(f * Math.PI) * 0.9;
    if (Math.abs(f - 0.06) < dt / 1.4 || Math.abs(f - 0.94) < dt / 1.4)
      for (let n = 0; n < 14; n++) funken.neu(d.g.position.x, 0.5, d.g.position.z, zufall(-3, 3), zufall(3, 7), zufall(-3, 3), zufall(0.4, 0.8), 0.85, 0.95, 1, zufall(0.5, 0.9), 14);
  }
  for (const b of K.boote){
    b.g.position.x = b.x0 + Math.sin(zeit * 0.02 * b.tempo + b.phase) * 120;
    b.g.position.y = 0.2 + Math.sin(zeit * 1.3 + b.phase) * 0.25;
    b.g.rotation.z = Math.sin(zeit * 1.1 + b.phase) * 0.06;
  }
  if (K.polarlicht) K.polarlicht.zeit.value = zeit;
  if ((S.th.kulisse || []).includes('feuerwerk') && grafik.modus !== 'leicht'){
    K.feuerwerk -= dt;
    if (K.feuerwerk <= 0){ K.feuerwerk = zufall(0.5, 1.6); feuerwerk(S); }
  }
}

/* =========================================================
   Wetter: Sonne, Regen mit Pfützen, Gewitter mit Blitzen,
   Sturm mit Seitenwind (je nach Strecke Sand, Schnee oder Asche)
   ========================================================= */
const WETTER = {
  klar:    { name:'Sonne',    icon:'☀️' },
  regen:   { name:'Regen',    icon:'🌧️' },
  gewitter:{ name:'Gewitter', icon:'⛈️' },
  sturm:   { name:'Sturm',    icon:'🌪️' }
};
const WETTER_ARTEN = Object.keys(WETTER);
const sturmName = th => th.deko === 'kakteen' ? 'Sandsturm' : th.schnee ? 'Schneesturm' : th.glut ? 'Aschesturm' : 'Sturm';
// Grundwerte der Strecke merken, damit jedes Wetter vom selben Stand aus rechnet
function wetterGrundMerken(S){
  S.basis = {
    nebel:scene.fog.color.clone(), nah:scene.fog.near, weit:scene.fog.far,
    hemi:hemi.intensity, sonne:sonne.intensity, oben:himmelUni.oben.value.clone(), horizont:himmelUni.horizont.value.clone(),
    wolkenFarbe:himmelUni.wolkenFarbe.value.clone(), wolken:himmelUni.wolkenMenge.value,
    rau:S.strasseMat.roughness, glanz:S.strasseMat.envMapIntensity
  };
  S.wetter = 'klar'; S.pfuetzen = []; S.wetterFx = null; S.wind = 0;
}
function wetterSetzen(S, art){
  if (!WETTER[art]) art = 'klar';
  const B = S.basis, th = S.th;
  scene.fog.color.copy(B.nebel); scene.fog.near = B.nah; scene.fog.far = B.weit;
  hemi.intensity = B.hemi; sonne.intensity = B.sonne;
  himmelUni.oben.value.copy(B.oben); himmelUni.horizont.value.copy(B.horizont);
  himmelUni.wolkenFarbe.value.copy(B.wolkenFarbe); himmelUni.wolkenMenge.value = B.wolken;
  S.strasseMat.roughness = B.rau; S.strasseMat.envMapIntensity = B.glanz;
  if (S.wetterFx){ scene.remove(S.wetterFx); S.wetterFx.geometry.dispose(); S.wetterFx.material.dispose(); S.wetterFx = null; }
  for (const p of S.pfuetzen) S.gruppe.remove(p.mesh);
  S.pfuetzen = []; S.wind = 0; S.blitzIn = 5;
  S.wetter = art;
  if (art === 'klar'){ Ton.regen(0); return; }
  const grau = lin(0x5d6672);
  if (art === 'regen' || art === 'gewitter'){
    const d = art === 'gewitter' ? 0.75 : 0.55;
    himmelUni.oben.value.lerp(grau.clone().multiplyScalar(art === 'gewitter' ? 0.45 : 0.8), d);
    himmelUni.horizont.value.lerp(grau, d);
    himmelUni.wolkenFarbe.value.copy(lin(art === 'gewitter' ? 0x4a5058 : 0x8a929c)); himmelUni.wolkenMenge.value = 1;
    scene.fog.color.lerp(grau, d); scene.fog.near *= 0.45; scene.fog.far *= art === 'gewitter' ? 0.4 : 0.55;
    sonne.intensity *= art === 'gewitter' ? 0.3 : 0.45; hemi.intensity *= 0.8;
    // Nasse Straße glänzt
    S.strasseMat.roughness = 0.28; S.strasseMat.envMapIntensity = 0.9;
    pfuetzenBauen(S);
    S.wetterFx = regenBauen(grafik.modus === 'leicht' ? 700 : 2200);
    Ton.regen(art === 'gewitter' ? 1 : 0.7);
  } else {
    // Sturm: Böen drücken die Karts zur Seite, dazu fliegender Sand, Schnee, Asche oder Regen
    S.wind = 1;
    const farbe = th.deko === 'kakteen' ? lin(0xd8a868) : th.schnee ? lin(0xf2f6fb) : th.glut ? lin(0x4a3a36) : grau;
    scene.fog.color.lerp(farbe, 0.8); const dicht = th.deko === 'kakteen' || th.schnee;
    scene.fog.near = 4; scene.fog.far = dicht ? 130 : B.weit * 0.45;
    if (dicht){ hemi.intensity *= 0.85; himmelUni.horizont.value.copy(scene.fog.color); himmelUni.oben.value.lerp(scene.fog.color, 0.75); himmelUni.wolkenMenge.value = 0; }
    himmelUni.horizont.value.lerp(farbe, 0.85); himmelUni.oben.value.lerp(farbe, 0.5); himmelUni.wolkenMenge.value = 1;
    sonne.intensity *= 0.55;
    S.wetterFx = th.deko === 'kakteen' || th.schnee || th.glut
      ? flockenBauen(grafik.modus === 'leicht' ? 700 : 2600, th.deko === 'kakteen' ? 0xe0b070 : th.schnee ? 0xffffff : 0x8a7a70)
      : regenBauen(grafik.modus === 'leicht' ? 700 : 2000);
    Ton.regen(0.5);
  }
  if (S.wetterFx){ S.wetterFx.frustumCulled = false; scene.add(S.wetterFx); }
}
function regenBauen(n){
  const pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++){ const x = zufall(-45, 45), y = zufall(0, 35), z = zufall(-45, 45); pos.set([x, y, z, x, y + 0.9, z], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fx = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color:0xc4d4e6, transparent:true, opacity:0.45, depthWrite:false }));
  fx.userData.art = 'regen';
  return fx;
}
function flockenBauen(n, farbe){
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([zufall(-40, 40), zufall(0, 14), zufall(-40, 40)], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fx = new THREE.Points(g, new THREE.PointsMaterial({ color:farbe, size:0.45, map:partikelTex, transparent:true, opacity:0.85, depthWrite:false }));
  fx.userData.art = 'flocken';
  return fx;
}
function pfuetzenBauen(S){
  const mat = new THREE.MeshStandardMaterial({ color:lin(0x2a3644), roughness:0.04, metalness:0.5, envMapIntensity:1.6, transparent:true, opacity:0.82, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-5 });
  const rnd = zufallsGen(S.def.saat * 13 + 5);
  for (let versuch = 0; versuch < 80 && S.pfuetzen.length < 9; versuch++){
    const i = Math.floor(rnd() * S.N);
    if (ringAbstand(S, i, 0) < 40 || S.rampen.some(r => ringAbstand(S, i, r.i) < 25) || S.pfuetzen.some(p => ringAbstand(S, i, p.i) < 50)) continue;
    const lq = 2.2 + rnd() * 2, la = 3 + rnd() * 3, seite = (rnd() * 2 - 1) * (S.hw - lq);
    const ort = streckenOrt(S, i, seite);
    const m = new THREE.Mesh(GEO.scheibe, mat);
    aufStrasse(m, S, ort, 0.08); m.scale.set(lq * 2, 1, la * 2);
    S.gruppe.add(m);
    S.pfuetzen.push(Object.assign(ort, { la, lq, mesh:m }));
  }
}
function inPfuetze(S, k){
  if (k.y > 0.05) return false;
  for (const p of S.pfuetzen){
    const [a, q] = ortLage(p, k.x, k.z), fa = a / p.la, fq = q / p.lq;
    if (fa * fa + fq * fq < 1) return true;
  }
  return false;
}
// Wind: langsame Böen quer zur Fahrtrichtung der Strecke, für alle gleich
const windRichtung = () => [Math.cos(0.7), Math.sin(0.7)];
function windStaerke(){ return strecke.wind ? 2.6 + 2.4 * Math.sin(zeit * 0.5) * Math.sin(zeit * 0.23 + 1) : 0; }
function wetterUpdate(dt){
  const S = strecke, fx = S.wetterFx;
  if (fx){
    const a = fx.geometry.attributes.position.array, cx = camera.position.x, cz = camera.position.z, cy = camera.position.y;
    const [wx, wz] = windRichtung(), w = windStaerke() * (S.wind ? 3 : 0.4);
    if (fx.userData.art === 'regen'){
      for (let i = 0; i < a.length; i += 6){
        const dy = 36 * dt;
        for (const o of [0, 3]){ a[i + o] += wx * w * dt; a[i + o + 1] -= dy; a[i + o + 2] += wz * w * dt; }
        if (a[i + 1] < cy - 6 || Math.abs(a[i] - cx) > 45 || Math.abs(a[i + 2] - cz) > 45){
          const x = cx + zufall(-45, 45), y = cy + zufall(5, 30), z = cz + zufall(-45, 45);
          a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = x - wx * w * 0.03; a[i + 4] = y + 0.9; a[i + 5] = z - wz * w * 0.03;
        }
      }
    } else {
      for (let i = 0; i < a.length; i += 3){
        a[i] += wx * w * 4 * dt + Math.sin(zeit * 3 + i) * dt; a[i + 1] -= dt * 1.2; a[i + 2] += wz * w * 4 * dt;
        if (a[i + 1] < 0 || Math.abs(a[i] - cx) > 40 || Math.abs(a[i + 2] - cz) > 40){ a[i] = cx + zufall(-40, 40); a[i + 1] = zufall(0, 14); a[i + 2] = cz + zufall(-40, 40); }
      }
    }
    fx.geometry.attributes.position.needsUpdate = true;
  }
  if (S.wetter === 'gewitter' && zustand.phase !== 'menue'){
    S.blitzIn -= dt;
    if (S.blitzIn <= 0){
      S.blitzIn = zufall(4, 9);
      $('blitzFlash').classList.remove('an'); void $('blitzFlash').offsetWidth; $('blitzFlash').classList.add('an');
      S.blitzHell = 1;
      setTimeout(() => Ton.effekt('donner'), 300 + Math.random() * 900);
    }
    S.blitzHell = Math.max(0, (S.blitzHell || 0) - dt * 3);
    hemi.intensity = S.basis.hemi * 0.8 + S.blitzHell * 2.5;
  }
}
// Pfützen bremsen und spritzen, der Wind drückt das Kart zur Seite
function wetterAufKart(k, dt){
  const S = strecke;
  if (S.pfuetzen.length && inPfuetze(S, k)){
    k.pfuetze = true;
    if (k.boost <= 0 && k.stern <= 0) k.v *= Math.exp(-0.9 * dt);
    if (Math.abs(k.v) > 6 && nahAmSpieler(k.x, k.z, 70) && Math.random() < 0.9){
      const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
      for (const sg of [-1, 1]) funken.neu(k.x + fz * sg, 0.3, k.z - fx * sg, fz * sg * zufall(2, 5) - fx * 2, zufall(2, 5), -fx * sg * zufall(2, 5) - fz * 2, zufall(0.3, 0.6), 0.75, 0.85, 1, zufall(0.35, 0.6), 14);
    }
  } else k.pfuetze = false;
  if (S.wind && k.y < 0.5){
    const [wx, wz] = windRichtung(), w = windStaerke();
    k.kx += wx * w * dt * 2.2; k.kz += wz * w * dt * 2.2;
  }
}
// Online: der Server würfelt eine Zahl, daraus wird für alle dasselbe Wetter
const wetterAusZahl = n => n < 5 ? 'klar' : n < 7 ? 'regen' : n < 8 ? 'gewitter' : 'sturm';
function wetterWuerfeln(){
  const r = Math.random();
  return r < 0.45 ? 'klar' : r < 0.7 ? 'regen' : r < 0.85 ? 'gewitter' : 'sturm';
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
    this.teile = teileOk(extra.teile);
    this.m = kartModell(fahrer, this.teile);
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
      spur:zufall(-0.5, 0.5), spurZiel:zufall(-0.5, 0.5), spurTimer:zufall(1, 3), gummi:1, camYaw:0, autopilot:false,
      klein:0, kleinSkala:1, windschatten:0, aufAbk:null, abkT:0, faellt:0, abkPlan:'', abkJa:false, rampe:0, sprung:false, trick:0, trickOk:false, netzTrick:0, eis:false, bewegYaw:0, muenzen:0, boden:0, vb:0, neig:0
    });
  }
  entfernen(){
    scene.remove(this.m.gruppe); entsorgen(this.m.gruppe);
  }
}

function aufStartplatz(k, slot){
  const S = strecke, [i, seite] = startPlatz(S, slot);
  const [x, z] = punktBei(S, i, seite);
  k.x = x; k.z = z; k.yaw = k.camYaw = yawBei(S, i); k.idx = k.idxAlt = i;
  k.fortschritt = i * S.ds;
  k.boden = bodenHoehe(S, x, z, i);
}

// Nach einem Absturz: zurück auf die Strecke vor der Abkürzung
function zurueckSetzen(k){
  const S = strecke, c = k.abkFall || S.abk[0];
  const i = c ? c.i : k.idx;
  const [x, z] = punktBei(S, i, 0);
  Object.assign(k, { x, z, yaw:yawBei(S, i), bewegYaw:yawBei(S, i), idx:i, v:0, y:0, vy:0, faellt:0, aufAbk:null, drift:0, boost:0, kx:0, kz:0 });
  k.boden = bodenHoehe(S, x, z, i);
  muenzenVerlieren(k, 3);
  if (k.spieler) Ton.effekt('treffer');
}
function boost(k, dauer){
  k.boost = Math.max(k.boost, dauer);
  k.v = Math.max(k.v, k.werte.maxV * 1.15);
  if (k.spieler) Ton.effekt('boost');
}

function treffer(k, art){
  if (k.stern > 0 || k.dreh > 0) return;
  k.dreh = k.drehDauer = art === 'rakete' ? 1.4 : art === 'stoss' ? 0.8 : art === 'blitz' ? 0.7 : 1.1;
  if (art === 'rakete') k.vy = 7 + (k.y > 0.001 ? 0 : k.vb);
  k.drift = 0; k.boost = 0; k.driftStufe = 0;
  muenzenVerlieren(k, 3);
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
  if (k.runde >= 2 && !k.fertig){
    k.rundenzeiten.push(zustand.rt - k.rundeStart); k.rundeStart = zustand.rt;
    if (k.spieler && zustand.zeitfahren) geist.marken.push(rund(zustand.rt, 1000));
  }
  if (k.runde > RUNDEN && !k.fertig){
    k.fertig = true; k.zielzeit = zustand.rt;
    if (online.aktiv) Netz.senden({ t:'ziel', slot:k.slot, zeit:rund(k.zielzeit) });
    zielErreicht(k);
    return;
  }
  if (k.spieler && k.runde >= 2){
    const vergleich = zustand.zeitfahren ? geistVergleich(k.runde - 2, zustand.rt) : '';
    meldung((k.runde === RUNDEN ? 'Letzte Runde!' : `Runde ${k.runde}`) + (vergleich ? ` · ${vergleich}` : ''), 1.6, true);
    Ton.effekt(k.runde === RUNDEN ? 'letzte' : 'runde');
  }
}

function kartBewegen(k, dt){
  const S = strecke, e = k.eingabe, w = k.werte;
  const aktiv = zustand.phase !== 'countdown' && zustand.phase !== 'menue';
  k.boost = Math.max(0, k.boost - dt);
  k.stern = Math.max(0, k.stern - dt);
  k.klein = Math.max(0, k.klein - dt);
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
  const amBoden = k.y <= 0.001 || k.rampe > 0;
  k.trick = Math.max(0, k.trick - dt);
  k.eis = aufEis(S, k);
  const neben = Math.abs(k.seite) - S.hw;
  k.offroad = neben > ASPHALT_AUSLAUF;
  let maxV = w.maxV * k.gummi * (1 + 0.012 * k.muenzen);
  if (k.aufAbk) k.offroad = k.aufAbk.art !== 'bruecke';
  if (k.boost <= 0 && k.stern <= 0){
    if (k.aufAbk) maxV *= k.aufAbk.art === 'bruecke' ? 1 : 0.62;
    else if (k.offroad) maxV *= S.kies[k.idx] ? 0.42 : 0.52;
    else if (neben > 1.3) maxV *= 0.86;
  }
  if (k.klein > 0) maxV *= 0.72;
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
  // Trick in der Luft nach einer Schanze: bei der Landung gibt es einen Turbo
  if (k.sprung && e.drift && !k.driftTaste && !k.trickOk && k.dreh <= 0){ k.trick = TRICK_DAUER; k.trickOk = true; if (k.spieler) Ton.effekt('sprung'); }
  // Driften: Hüpfer beim Drücken, Drift sobald gelenkt wird
  if (aktiv && e.drift && !k.driftTaste && amBoden && k.v > 6 && k.dreh <= 0){ k.vy = 4.2 + (k.rampe > 0 ? 0 : k.vb); k.rampe = 0; }
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
  if (k.eis) rate *= 0.6;
  k.yaw += rate * dt;
  // Auf Glatteis rutscht das Kart weiter in die alte Richtung
  if (k.eis) k.bewegYaw += winkelDiff(k.yaw, k.bewegYaw) * (1 - Math.exp(-1.6 * dt));
  else k.bewegYaw = k.yaw;
  k.lenkAnzeige += (lenk - k.lenkAnzeige) * Math.min(1, dt * 10);
  wetterAufKart(k, dt);
  // Bewegung (beim Driften rutscht das Kart leicht nach außen)
  const fx = Math.sin(k.bewegYaw), fz = Math.cos(k.bewegYaw);
  let vx = fx * k.v, vz = fz * k.v;
  if (k.drift){ const r = -k.drift * k.v * 0.1; vx += fz * r; vz -= fx * r; }
  k.x += (vx + k.kx) * dt; k.z += (vz + k.kz) * dt;
  const daempf = Math.exp(-5 * dt);
  k.kx *= daempf; k.kz *= daempf;
  const bewegt = Math.hypot(vx + k.kx, vz + k.kz) * dt;
  // Von der Brücke gefallen: in die Tiefe, dann zurück auf die Strecke (ohne Streckenrechnung, damit keine Runde falsch zählt)
  if (k.faellt){
    k.faellt += dt; k.vy -= 28 * dt; k.y += k.vy * dt;
    if (k.faellt > 1.6) zurueckSetzen(k);
    return;
  }
  streckeFolgen(k);
  abkFolgen(S, k);
  // Höhe: k.y ist die Höhe über der Straße, k.boden die Straßenhöhe darunter, k.vy die echte Steiggeschwindigkeit
  const bAlt = k.boden, b = k.aufAbk ? abkPunktH(k.aufAbk, k.abkT) : bodenHoehe(S, k.x, k.z, k.idx), vb = klemm((b - bAlt) / Math.max(dt, 1e-4), -40, 40);
  k.boden = b;
  if (k.y > 0.001 || k.vy > 0){ k.vy -= 28 * dt; k.y += k.vy * dt - (b - bAlt); }
  else if (S.hoch && vb < k.vb - 28 * dt * 1.4 && k.v > 12){
    // Kuppe: die Straße fällt schneller weg, als die Schwerkraft zieht – das Kart hebt ab
    k.vy = k.vb; k.y = (k.vb - vb) * dt; k.sprung = true; k.trick = 0; k.trickOk = false;
    if (!k.mensch && Math.random() < 0.4){ k.trick = TRICK_DAUER; k.trickOk = true; }
  } else {
    k.vy = 0;
    // Bergauf bremst, bergab schiebt
    if (S.hoch && bewegt > 0.01) k.v -= 11 * klemm((b - bAlt) / bewegt, -0.5, 0.5) * dt * Math.sign(k.v);
  }
  k.vb = vb;
  // Sprungschanze: auf der Rampe hochfahren, an der Kante abheben
  const rh = rampeHoehe(S, k);
  if (rh >= 0 && k.y <= rh + 0.25 && k.vy <= 1){ k.y = rh; k.vy = 0; k.rampe = Math.max(rh, 0.001); }
  else if (k.rampe > 0){
    if (k.rampe > RAMPE_HOEHE * 0.8 && k.v > 8) abheben(k);
    k.rampe = 0;
  }
  if (k.y < 0){
    k.y = 0; k.vy = 0;
    if (k.sprung){ k.sprung = false; landen(k); }
  }
  // Absperrung; auf einer Abkürzung zählt deren Rand
  const wand = S.hw + S.auslauf;
  if (k.aufAbk){
    const c = k.aufAbk, [d, , nx, nz] = abkLage(c, k.x, k.z);
    if (c.art === 'bruecke'){
      if (d > c.hb + 0.3 && k.y < 0.6 && Math.abs(k.seite) > wand + 1){ k.faellt = 0.001; k.abkFall = c; k.vy = Math.min(k.vy, 0); if (k.spieler) meldung('Abgestürzt!', 1.4, true); }
    } else if (d > c.hb){
      const f = (d - c.hb) / d;
      k.x -= (k.x - nx) * f; k.z -= (k.z - nz) * f;
      k.v *= 1 - 0.6 * dt * 10 * Math.min(1, d - c.hb);
    }
  } else if (Math.abs(k.seite) > wand){
    const sg = Math.sign(k.seite), i = k.idx, lx = S.tz[i], lz = -S.tx[i], ueber = Math.abs(k.seite) - wand;
    k.x -= lx * sg * ueber; k.z -= lz * sg * ueber; k.seite = sg * wand;
    const hinein = (fx * lx + fz * lz) * sg * (k.v < 0 ? -1 : 1);
    if (hinein > 0.1 && Math.abs(k.v) > 4){
      if (k.wandZeit <= 0){
        if (k.spieler){ Ton.effekt('wand'); vibrieren(25); zustand.wackeln = Math.max(zustand.wackeln, 0.25 * hinein); }
        for (let n = 0; n < 14; n++) funken.neu(k.x + lx * sg, 0.7, k.z + lz * sg, zufall(-3, 3) - lx * sg * 2, zufall(1, 5), zufall(-3, 3) - lz * sg * 2, zufall(0.3, 0.55), 1, zufall(0.7, 0.95), 0.4, zufall(0.3, 0.55), 12);
        for (let n = 0; n < 3; n++) staub.neu(k.x + lx * sg, 0.5, k.z + lz * sg, zufall(-1, 1), zufall(0.4, 1.2), zufall(-1, 1), zufall(0.5, 0.9), 0.7, 0.68, 0.64, 0.7, -0.3, 2, 0.45);
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
      if (d2 > 6.25 || d2 < 1e-6 || Math.abs(A.boden + A.y - B.boden - B.y) > 1.5) continue;
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
    ['turbo3', Math.max(0, f - 0.3) * 0.6], ['stern', Math.max(0, f - 0.45) * 0.5],
    ['blitz', karts.length > 2 ? Math.max(0, f - 0.6) * 0.35 : 0]
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
    case 'rakete': raketeStarten(k, !!k.eingabe.rueck || (k.mensch && k.eingabe.bremse)); break;
    case 'stern': k.stern = 7; if (k.spieler) Ton.effekt('stern'); break;
    case 'blitz': blitzAusloesen(k); break;
  }
  k.item = null; k.itemAnzahl = 0; k.itemTimer = 0;
}

let ereignisNr = 0;
const neueId = () => `${online.ich || 'x'}-${++ereignisNr}`;
const rund = (v, f = 100) => Math.round(v * f) / f;
function ereignis(m){ if (online.aktiv && online.imRennen) Netz.senden({ t:'e', ...m }); }

let bananeVorlage = null;
function bananeTeile(){
  if (bananeVorlage) return bananeVorlage;
  const g = new THREE.Group(), schale = geteilt(std(0xe6b21a, 0.55));
  // Gebogene Frucht aus ueberlappenden Kugeln, dazu aufgeklappte Schalenstuecke am Boden
  for (let n = 0; n <= 10; n++){
    const t = n / 5 - 1, a = t * 1.05;
    teil(GEO.kugelMittel, MAT.banane, g, Math.sin(a) * 0.62, 0.12 + 0.62 * (1 - Math.cos(a)) + 0.12, 0, 0.17 * (1 - 0.35 * t * t) + 0.03, 0.15 * (1 - 0.3 * t * t) + 0.03, 0.15 * (1 - 0.3 * t * t) + 0.03);
  }
  teil(GEO.kugelGrob, MAT.braun, g, -0.64, 0.5, 0, 0.07, 0.07, 0.07);
  teil(GEO.zylGrob, MAT.braun, g, 0.64, 0.58, 0, 0.05, 0.2, 0.05).rotation.z = -0.55;
  for (let n = 0; n < 3; n++){
    const w = n / 3 * TAU + 0.4;
    const f = teil(GEO.kugelMittel, schale, g, Math.cos(w) * 0.42, -0.2, Math.sin(w) * 0.42, 0.34, 0.035, 0.12);
    f.rotation.y = -w; f.rotation.z = 0.12;
  }
  const rb = verschmelzen(g);
  rb.forEach(([m]) => geteilt(m));
  bananeVorlage = rb;
  return rb;
}
function bananeLegen(x, z, idx, id = null){
  const g = new THREE.Group();
  for (const [mat, geo] of bananeTeile()){ const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  const fleck = new THREE.Mesh(GEO.scheibe, MAT.kontakt); fleck.scale.set(1.6, 1, 1.6); fleck.position.y = -0.16;
  g.add(fleck);
  const h = bodenAn(x, z);
  g.position.set(x, 0.25 + h, z); g.rotation.y = Math.random() * TAU;
  scene.add(g);
  const b = { id:id || neueId(), x, z, h, idx:naechster(strecke, x, z, idx), mesh:g };
  bananen.push(b);
  if (!id) ereignis({ a:'b', id:b.id, x:rund(x), z:rund(z), idx:b.idx });
}
function bananeWeg(n, senden = false){
  if (senden) ereignis({ a:'bw', id:bananen[n].id });
  scene.remove(bananen[n].mesh); bananen.splice(n, 1);
}

// rueck: nach hinten auf den Verfolger schießen
function raketeStarten(k, rueck = false){
  const rang = rangliste(), pos = rang.indexOf(k);
  const ziel = rueck ? rang[pos + 1] || null : pos > 0 ? rang[pos - 1] : null;
  const yaw = k.yaw + (rueck ? Math.PI : 0), fx = Math.sin(yaw), fz = Math.cos(yaw);
  const r = { id:neueId(), x:k.x + fx * 2.8, z:k.z + fz * 2.8, yaw, idx:k.idx, seite:k.seite, besitzer:k, ziel, t:0, rueck };
  raketeBauen(r);
  ereignis({ a:'r', id:r.id, von:k.slot, ziel:ziel ? ziel.slot : -1, x:rund(r.x), z:rund(r.z), yaw:rund(r.yaw, 1000), idx:r.idx, seite:rund(r.seite), rueck:rueck ? 1 : 0 });
}

// Blitz: alle vor dem Werfer schrumpfen kurz. Jeder trifft nur die Karts, die er selbst steuert.
function blitzAusloesen(k){
  blitzTreffen(k);
  ereignis({ a:'l', von:k.slot });
}
// Sichtbarer Blitz aus dem Himmel auf jedes getroffene Kart (zackiger Strahl mit Leuchthof, flackert kurz)
const blitzStrahlen = [];
function blitzStrahl(k){
  if (blitzStrahlen.length > 9) return;
  const g = new THREE.Group(), kern = new THREE.Group(), hof = new THREE.Group();
  const hoehe = 60, n = 9, pts = [];
  let px = 0, pz = 0;
  for (let i = 0; i <= n; i++){
    const f = i / n;
    if (i > 0 && i < n){ px += zufall(-3.2, 3.2) * (1 - f * 0.5); pz += zufall(-3.2, 3.2) * (1 - f * 0.5); }
    else if (i === n){ px *= 0.0; pz *= 0.0; }
    pts.push(new THREE.Vector3(px, hoehe * (1 - f), pz));
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++){
    const a = pts[i], b = pts[i + 1], d = new THREE.Vector3().subVectors(b, a), len = d.length();
    for (const [teilG, dicke] of [[kern, 0.32], [hof, 1.0]]){
      const m = new THREE.Mesh(GEO.box, MAT.blitz);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, d.clone().normalize());
      m.scale.set(dicke, len, dicke);
      teilG.add(m);
    }
  }
  const mk = verschmelzen(kern), mh = verschmelzen(hof);
  for (const [mat, geo] of mk){ const m = new THREE.Mesh(geo, MAT.blitz); m.frustumCulled = false; g.add(m); }
  for (const [mat, geo] of mh){ const m = new THREE.Mesh(geo, MAT.blitzGlow); m.frustumCulled = false; g.add(m); }
  const blitz = new THREE.Sprite(MAT.blitzSprite); blitz.scale.set(9, 9, 1); blitz.position.y = 2;
  g.add(blitz);
  g.position.set(k.x, k.boden, k.z);
  scene.add(g);
  blitzStrahlen.push({ g, k, t:0 });
  for (let i = 0; i < 18; i++){
    const w = Math.random() * TAU, v = zufall(3, 9);
    funken.neu(k.x, 0.6, k.z, Math.cos(w) * v, zufall(2, 8), Math.sin(w) * v, zufall(0.3, 0.6), 0.75, 0.88, 1, zufall(0.3, 0.6), 14);
  }
}
function blitzUpdate(dt){
  for (let i = blitzStrahlen.length - 1; i >= 0; i--){
    const b = blitzStrahlen[i];
    b.t += dt;
    if (b.t > 0.55){
      scene.remove(b.g);
      b.g.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); });
      blitzStrahlen.splice(i, 1);
      continue;
    }
    b.g.position.set(b.k.x, b.k.boden, b.k.z);
    b.g.visible = (Math.floor(b.t * 36) % 3) !== 2;
  }
  MAT.blitz.opacity = 1; MAT.blitzSprite.opacity = 0.9;
}
function blitzTreffen(werfer){
  for (const k of karts){
    if (k === werfer || k.fertig || k.fortschritt <= werfer.fortschritt || k.stern > 0) continue;
    k.klein = 4;
    blitzStrahl(k);
    if (!k.fern) treffer(k, 'blitz');
  }
  $('blitzFlash').classList.remove('an'); void $('blitzFlash').offsetWidth; $('blitzFlash').classList.add('an');
  Ton.effekt('blitz');
  if (werfer.spieler) meldung('🌩️ Blitz!', 1, true);
  else if (spieler && spieler.klein > 0) vibrieren(160);
}

// Windschatten: dicht hinter einem anderen Kart gibt es nach kurzer Zeit einen kleinen Turbo
function windschattenPruefen(k, dt){
  if (k.v < 16 || k.dreh > 0 || k.boost > 0){ k.windschatten = Math.max(0, k.windschatten - dt * 2); return; }
  const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
  let drin = false;
  for (const o of karts){
    if (o === k || o.v < 12) continue;
    const dx = o.x - k.x, dz = o.z - k.z, vor = dx * fx + dz * fz, quer = Math.abs(dx * fz - dz * fx);
    if (vor > 2.5 && vor < 14 && quer < 2.2){ drin = true; break; }
  }
  if (!drin){ k.windschatten = Math.max(0, k.windschatten - dt * 2); return; }
  k.windschatten += dt;
  if (k.spieler && Math.random() < 0.6)
    staub.neu(k.x + fx * 3 + zufall(-1.2, 1.2), zufall(0.6, 1.6), k.z + fz * 3 + zufall(-1.2, 1.2), -fx * 14, 0, -fz * 14, 0.25, 0.9, 0.95, 1, 0.25, 0, 0.5, 0.4);
  if (k.windschatten > 1.4){
    k.windschatten = 0;
    boost(k, 0.8);
    if (k.spieler){ meldung('Windschatten!', 0.9, true); Ton.effekt('windschatten'); }
  }
}
let raketeVorlage = null;
function raketeTeile(){
  if (raketeVorlage) return raketeVorlage;
  const g = new THREE.Group(), rot = geteilt(std(0xe8322a, 0.35)), gelb = geteilt(std(0xffc928, 0.4));
  const quer = (geo, mat, z, sx, sy, sz) => { const m = teil(geo, mat, g, 0, 0, z, sx, sy, sz); m.rotation.x = Math.PI / 2; return m; };
  quer(GEO.zyl16, MAT.weiss, 0, 0.27, 1.25, 0.27);
  quer(GEO.kegel, rot, 0.95, 0.27, 0.6, 0.27);
  quer(GEO.zyl16, rot, 0.45, 0.285, 0.14, 0.285);
  quer(GEO.zyl16, gelb, 0.18, 0.285, 0.07, 0.285);
  quer(GEO.zyl16, MAT.dunkel, -0.66, 0.2, 0.14, 0.2);
  teil(GEO.kugelMittel, MAT.auge, g, 0, 0.14, 0.38, 0.08, 0.08, 0.08);
  for (let n = 0; n < 4; n++){
    const f = teil(geteilt(rundBox(0.05, 0.42, 0.5, 0.02)), rot, g, 0, 0, -0.45, 1, 1, 1);
    f.rotation.z = n * Math.PI / 2;
    f.position.set(Math.sin(n * Math.PI / 2) * -0.3, Math.cos(n * Math.PI / 2) * 0.3, -0.45);
  }
  raketeVorlage = verschmelzen(g);
  raketeVorlage.forEach(([m]) => geteilt(m));
  return raketeVorlage;
}
function raketeBauen(r){
  const g = new THREE.Group();
  for (const [mat, geo] of raketeTeile()){ const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  // Triebwerksflamme und Leuchten, flackern im Update
  const fl = new THREE.Group(); fl.position.z = -0.75;
  const aussen = new THREE.Mesh(GEO.kegel, MAT.flamme); aussen.rotation.x = -Math.PI / 2; aussen.scale.set(0.2, 0.95, 0.2); aussen.position.z = -0.45;
  const kern = new THREE.Mesh(GEO.kegel, MAT.flammeKern); kern.rotation.x = -Math.PI / 2; kern.scale.set(0.11, 0.55, 0.11); kern.position.z = -0.27;
  const glut = new THREE.Sprite(MAT.glutSprite); glut.scale.set(1.6, 1.6, 1);
  fl.add(aussen, kern, glut);
  g.add(fl);
  g.userData.flamme = { aussen, kern, glut };
  r.mesh = g;
  r.h = bodenHoehe(strecke, r.x, r.z, r.idx);
  g.position.set(r.x, 0.8 + r.h, r.z);
  scene.add(g);
  raketen.push(r);
  if (nahAmSpieler(r.x, r.z, 50)) Ton.effekt('rakete');
}
function raketeWeg(n){
  const r = raketen[n];
  explosion(r.x, 0.8 + r.h - bodenAn(r.x, r.z), r.z);
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
      const j = (r.idx + (r.rueck ? -1 : 1) * Math.round(14 / S.ds) + S.N) % S.N;
      r.seite *= Math.exp(-dt * 1.2);
      [zx, zz] = punktBei(S, j, r.seite);
    }
    const drehMax = (zielAbstand < 45 ? 6 : 3.5) * dt;
    r.yaw += klemm(winkelDiff(Math.atan2(zx - r.x, zz - r.z), r.yaw), -drehMax, drehMax);
    r.x += Math.sin(r.yaw) * 58 * dt; r.z += Math.cos(r.yaw) * 58 * dt;
    r.idx = naechster(S, r.x, r.z, r.idx);
    r.h += (bodenHoehe(S, r.x, r.z, r.idx) - r.h) * Math.min(1, dt * 12);
    const i = r.idx, seite = (r.x - S.px[i]) * S.tz[i] - (r.z - S.pz[i]) * S.tx[i];
    let weg = r.t > 6 || Math.abs(seite) > S.hw + S.auslauf, melden = false;
    // Treffer prüft jeder nur für die Karts, die er selbst steuert
    for (const k of karts){
      if (k.fern || (k === r.besitzer && r.t < 0.5)) continue;
      const dx = k.x - r.x, dz = k.z - r.z;
      if (dx * dx + dz * dz < 4.4 && Math.abs(k.boden + k.y - r.h) < 2){ treffer(k, 'rakete'); weg = melden = true; break; }
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
    r.mesh.position.set(r.x, 0.8 + r.h + Math.sin(r.t * 20) * 0.05, r.z);
    r.mesh.rotation.y = r.yaw;
    r.mesh.rotation.z = Math.sin(r.t * 17) * 0.06;
    const u = r.mesh.userData.flamme, fk = 0.8 + Math.random() * 0.5;
    u.aussen.scale.y = 0.95 * fk; u.aussen.position.z = -0.47 * fk; u.kern.scale.y = 0.55 * fk; u.kern.position.z = -0.27 * fk; u.glut.scale.setScalar(1.4 + Math.random() * 0.4);
    const bx = r.x - Math.sin(r.yaw) * 1.5, bz = r.z - Math.cos(r.yaw) * 1.5;
    const rh = 0.8 + r.h - bodenAn(bx, bz);
    funken.neu(bx, rh, bz, zufall(-1, 1), zufall(0, 1), zufall(-1, 1), 0.3, 1, 0.6, 0.15, 0.5, 0, -1.5);
    if (grafik.modus !== 'leicht' || Math.random() < 0.5) staub.neu(bx, rh + 0.05, bz, zufall(-0.5, 0.5), zufall(0.5, 1.5), zufall(-0.5, 0.5), 1.0, 0.86, 0.86, 0.88, 0.55, -0.5, 2.0, 0.55);
  }
}

function itemsLeeren(){
  while (blitzStrahlen.length){ const b = blitzStrahlen.pop(); scene.remove(b.g); b.g.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); }); }
  while (bananen.length) bananeWeg(0);
  while (raketen.length){ scene.remove(raketen[0].mesh); raketen.shift(); }
  gefahrenLeeren();
}

function boxenUpdate(dt){
  const S = strecke;
  const hue = (zeit * 0.25) % 1;
  MAT.itemBox.emissive.setHSL(hue, 0.9, 0.35);
  MAT.itemBox.color.setHSL((hue + 0.5) % 1, 0.7, 0.75);
  MAT.itemKern.color.setHSL((hue + 0.15) % 1, 0.95, 0.72);
  MAT.itemHalo.color.setHSL(hue, 0.85, 0.55);
  MAT.itemFleck.color.setHSL(hue, 0.85, 0.5);
  const funkeln = grafik.modus !== 'leicht';
  S.boxen.forEach((b, bi) => {
    if (b.aus > 0){
      b.aus -= dt;
      if (b.aus <= 0){ b.mesh.visible = true; b.wachs = 0; }
      return;
    }
    b.wachs = Math.min(1, b.wachs + dt * 3);
    b.mesh.scale.setScalar(b.wachs);
    b.wuerfel.rotation.set(0.5, zeit * 1.3 + b.phase, 0.3);
    b.kern.rotation.set(zeit * 1.9, -zeit * 2.6 + b.phase, 0);
    b.mesh.position.y = 1.4 + b.h + Math.sin(zeit * 2.2 + b.phase) * 0.18;
    b.fleck.position.y = 0.1 + b.h - b.mesh.position.y;
    b.fleck.scale.set(3.2 + Math.sin(zeit * 3 + b.phase) * 0.35, 1, 3.2 + Math.sin(zeit * 3 + b.phase) * 0.35);
    if (funkeln && Math.random() < dt * 3 && nahAmSpieler(b.x, b.z, 70)){
      const w = Math.random() * TAU, c = new THREE.Color().setHSL((hue + Math.random() * 0.3) % 1, 1, 0.7);
      funken.neu(b.x + Math.cos(w) * 1.1, b.mesh.position.y - b.h - 0.6, b.z + Math.sin(w) * 1.1, 0, zufall(0.8, 1.8), 0, zufall(0.7, 1.2), c.r, c.g, c.b, zufall(0.18, 0.32), -0.4);
    }
    if (!['rennen', 'auslauf'].includes(zustand.phase)) return;
    for (const k of karts){
      if (k.fern) continue;
      const dx = k.x - b.x, dz = k.z - b.z;
      if (dx * dx + dz * dz > 5.5 || Math.abs(k.boden + k.y - b.h) > 3) continue;
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
    if (dx * dx + dz * dz < 3.4 && Math.abs(k.boden + k.y - b.h) < 1){
      bananeWeg(n, true);
      treffer(k, 'banane');
      if (k.spieler || nahAmSpieler(k.x, k.z, 30)) Ton.effekt('banane');
    }
  }
}

/* ---------- Computergegner ---------- */
function kiSteuern(k, dt){
  const S = strecke, e = k.eingabe, st = STUFEN[rennStufe];
  e.gas = true; e.bremse = false; e.drift = false; e.item = false; e.rueck = false;
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
  let [zx, zz] = punktBei(S, j, seite);
  k.abkLangsam = false;
  const abkZ = abkZiel(S, k);
  // Vor und auf der Brücke vorsichtig
  if ((k.abkLangsam || (k.aufAbk && k.aufAbk.art === 'bruecke')) && k.v > 24) e.gas = false;
  if (abkZ) [zx, zz] = abkZ;
  const diff = winkelDiff(Math.atan2(zx - k.x, zz - k.z), k.yaw);
  e.lenk = klemm(diff * 2.6, -1, 1);
  // Tempo vor Kurven anpassen
  let maxKr = 0;
  for (let m = 6; m <= 42; m += 6) maxKr = Math.max(maxKr, Math.abs(S.kurv[(k.idx + Math.round(m / S.ds)) % S.N]));
  const zielV = st.kurve * k.werte.lenk * 0.9 / Math.max(maxKr, 0.001);
  if (k.v > zielV + 1.5 && !k.aufAbk){ e.gas = false; if (k.v > zielV + 6) e.bremse = true; }
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
    k.x = x; k.z = z; k.yaw = yawBei(S, k.idx); k.v = 0; k.steckt = 0; k.y = 0; k.vy = 0; k.boden = bodenHoehe(S, x, z, k.idx);
  }
  // Items
  if (k.item && k.roulette <= 0){
    k.itemTimer += dt;
    const rang = rangliste(), p = rang.indexOf(k), vor = rang[p - 1], hinter = rang[p + 1];
    switch (k.item){
      case 'turbo': case 'turbo3': if ((k.itemTimer > 0.7 && maxKr < 0.02) || (k.aufAbk && k.aufAbk.art !== 'bruecke')) e.item = true; break;
      case 'stern': if (k.itemTimer > 0.5) e.item = true; break;
      case 'blitz': if (k.itemTimer > 1.2) e.item = true; break;
      case 'rakete': {
        const nahHinten = hinter && k.fortschritt - hinter.fortschritt < 25;
        if (!vor && nahHinten && k.itemTimer > 0.8){ e.item = true; e.rueck = true; }
        else if ((vor && vor.fortschritt - k.fortschritt < 45 && k.itemTimer > 0.8) || k.itemTimer > 7) e.item = true;
        break;
      }
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
  g.position.set(k.x, k.boden + k.y, k.z);
  // Neigung bergauf/bergab, in der Luft nach der Flugbahn
  const S = strecke;
  const neigZiel = k.y > 0.05 ? -Math.atan(klemm(k.vy / Math.max(8, Math.abs(k.v)), -0.6, 0.6)) * 0.7
    : S.hoch ? -Math.atan(S.steig[k.idx] * Math.cos(k.yaw - yawBei(S, k.idx))) : 0;
  k.neig += (neigZiel - k.neig) * Math.min(1, dt * 10);
  g.rotation.x = k.neig;
  k.kleinSkala += ((k.klein > 0 ? 0.55 : 1) - k.kleinSkala) * Math.min(1, dt * 6);
  g.scale.setScalar(k.kleinSkala);
  k.driftVisuell += (k.drift * 0.4 - k.driftVisuell) * Math.min(1, dt * 8);
  const trick = k.trick > 0 ? 1 - k.trick / TRICK_DAUER : 0;
  g.rotation.y = k.yaw + k.driftVisuell + k.drehWinkel + trick * TAU;
  g.rotation.z = Math.sin(trick * Math.PI) * 0.45;
  const tempo = klemm(Math.abs(k.v) / 20, 0, 1);
  m.koerper.rotation.z = -k.lenkAnzeige * 0.09 * tempo;
  m.koerper.rotation.x += (((k.boost > 0 ? -0.035 : k.eingabe.bremse && k.v > 1 ? 0.045 : 0)) - m.koerper.rotation.x) * (1 - Math.exp(-8 * dt));
  m.kontakt.position.y = 0.09 - k.y;
  m.kontakt.scale.setScalar(1 + Math.max(0, k.y) * 0.12);
  m.kontakt.visible = k.y < 3;
  m.koerper.position.y = m.hoch + Math.sin(zeit * 30 + k.phase) * 0.015 * tempo + (k.offroad ? Math.sin(zeit * 47 + k.phase) * 0.05 * tempo : 0);
  const radDreh = k.v * dt / 0.48;
  for (const r of m.raeder) r.rotation.x += radDreh;
  for (const h of m.vorne) h.rotation.y = k.lenkAnzeige * 0.45;
  m.kopf.rotation.y = k.lenkAnzeige * 0.3;
  m.kopf.rotation.z = -k.lenkAnzeige * 0.12;
  // Namensschild aus der Nähe ausblenden, damit es nicht die Sicht versperrt
  if (k.schild) k.schild.material.opacity = klemm((camera.position.distanceTo(g.position) - 7) / 6, 0, 1);
  const flamme = k.boost > 0;
  for (const f of m.flammen){
    f.visible = flamme;
    if (!flamme) continue;
    const fl = 0.8 + Math.random() * 0.5, u = f.userData;
    u.aussen.scale.set(0.2 * (0.9 + Math.random() * 0.2), 0.9 * fl, 0.2); u.aussen.position.z = -0.45 * fl;
    u.kern.scale.set(0.11, 0.55 * fl, 0.11); u.kern.position.z = -0.27 * fl;
    u.glut.scale.setScalar(1.0 + Math.random() * 0.35);
  }
  // Halstuch weht nach hinten, je schneller, desto flacher
  m.schal.rotation.x = -0.35 + tempo * 0.4 - (k.boost > 0 ? 0.15 : 0) + Math.sin(zeit * 14 + k.phase) * 0.06 * (0.3 + tempo);
  m.schal.rotation.y = Math.sin(zeit * 9 + k.phase) * 0.12 * tempo - k.lenkAnzeige * 0.25;
  if (k.stern > 0){
    const c = new THREE.Color().setHSL((zeit * 2 + k.phase) % 1, 1, 0.45);
    m.lack.emissive.copy(c); m.anzug.emissive.copy(c).multiplyScalar(0.6);
    k.hatteStern = true;
  } else if (k.hatteStern){ m.lack.emissive.copy(m.grundGlanz); m.anzug.emissive.setRGB(0, 0, 0); k.hatteStern = false; }
  else if (m.regenbogen) m.lack.color.setHSL((zeit * 0.15 + k.phase) % 1, 0.85, 0.42).convertSRGBToLinear();
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
      spurObj.position.set(k.x - fx + fz * seite, 0.065 + k.boden, k.z - fz - fx * seite);
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
  // Reifenqualm: beim Driften, scharfen Bremsen und im Wirbel nach einem Treffer
  const qualmRate = grafik.modus === 'leicht' ? 0 : grafik.modus === 'mittel' ? 0.45 : 0.8;
  const rauchen = (k.drift && k.y < 0.05 && Math.abs(k.v) > 8) ? 1 : (k.eingabe.bremse && k.v > 12 && k.y < 0.05) ? 0.6 : k.dreh > 0 ? 0.5 : 0;
  if (rauchen && Math.random() < qualmRate * rauchen){
    for (const s of [-0.95, 0.95]){
      const [x, z] = hinten(s);
      const g = zufall(0.82, 0.96);
      staub.neu(x + zufall(-0.15, 0.15), 0.2, z + zufall(-0.15, 0.15), -fx * 1.5 + zufall(-0.6, 0.6), zufall(0.5, 1.4), -fz * 1.5 + zufall(-0.6, 0.6), zufall(0.7, 1.2), g, g, g * 1.02, zufall(0.5, 0.8), -0.3, 2.4, 0.5);
    }
  }
  if (k.boost > 0){
    for (const s of [-0.3, 0.3]){
      const [x, z] = hinten(s);
      funken.neu(x - fx, 0.95, z - fz, -fx * 6 + zufall(-1, 1), zufall(0, 1.5), -fz * 6 + zufall(-1, 1), 0.2, 1, zufall(0.45, 0.75), 0.1, 0.55, 0, -1.5);
      if (Math.random() < 0.5) funken.neu(x - fx * 1.6, 0.95 + zufall(-0.1, 0.1), z - fz * 1.6, -fx * 9 + zufall(-1.5, 1.5), zufall(-0.5, 1.2), -fz * 9 + zufall(-1.5, 1.5), 0.45, 0.35, 0.65, 1, 0.38, 0, -0.5, 0.8);
    }
  }
  if (k.stern > 0 && Math.random() < 0.7){
    const c = new THREE.Color().setHSL(Math.random(), 1, 0.65);
    funken.neu(k.x + zufall(-1.5, 1.5), zufall(0.5, 2.5), k.z + zufall(-1.5, 1.5), 0, 1.5, 0, 0.5, c.r, c.g, c.b, 0.6);
  }
  if (k.eis && Math.abs(k.v) > 8 && Math.random() < 0.6){
    const [x, z] = hinten(zufall(-1, 1));
    funken.neu(x, 0.15, z, -fx * 2 + zufall(-1.5, 1.5), zufall(0.5, 2), -fz * 2 + zufall(-1.5, 1.5), zufall(0.3, 0.6), 0.8, 0.93, 1, zufall(0.25, 0.45), 6);
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
const cup = { aktiv:false, nr:0, punkte:{}, gegner:null, def:CUPS[0] };
const online = { aktiv:false, imRennen:false, raum:null, ich:null, host:false, sendTimer:0, wegNamen:{} };
// Olympiade: Mit ?olymp=… im Link geht es direkt in den Raum der Disziplin (Ticket prüft der Server)
const olympia = (() => {
  let ticket = new URLSearchParams(location.search).get('olymp');
  try {
    if (ticket) sessionStorage.setItem('loewenkart:olymp', ticket);
    else ticket = sessionStorage.getItem('loewenkart:olymp');
  } catch (e) { /* egal */ }
  if (!ticket) return null;
  if (location.search) history.replaceState(null, '', location.pathname);
  return { ticket, info:null, startBis:0 };
})();
function olympiaBeenden(){ try { sessionStorage.removeItem('loewenkart:olymp'); } catch (e) { /* egal */ } }
function zurOlympiade(){
  const ziel = olympia && olympia.info && olympia.info.zurueck;
  olympiaBeenden();
  if (ziel) location.href = ziel; else location.reload();
}
let zeit = 0;

function vorschauZeigen(){
  karts.forEach(k => k.entfernen()); karts = []; spieler = null;
  itemsLeeren(); geistEntfernen(); zustand.zeitfahren = false;
  wetterSetzen(strecke, 'klar');
  for (const b of strecke.boxen){ b.aus = 0; b.mesh.visible = true; }
  if (vorschau) vorschau.entfernen();
  vorschau = new Kart(FAHRER[wahl.fahrer], true, { teile:garage.wahl });
  const S = strecke, i = idxBei(S, 24);
  vorschau.x = S.px[i]; vorschau.z = S.pz[i]; vorschau.yaw = yawBei(S, i); vorschau.idx = i; vorschau.boden = S.hy[i];
}

// opts (nur online): { strecke, stufe, slots:[{ fahrer, name, mensch, ich, fern }] }
function rennenStarten(opts = null){
  eingabenLeeren();
  spurenLeeren();
  rennStufe = opts ? opts.stufe : wahl.stufe;
  const S = streckeLaden(opts ? opts.strecke : wahl.strecke);
  ampelSetzen(0);
  if (vorschau){ vorschau.entfernen(); vorschau = null; }
  karts.forEach(k => k.entfernen());
  karts = []; spieler = null;
  itemsLeeren(); funken.leeren(); staub.leeren();
  zustand.zeitfahren = !opts && !cup.aktiv && wahl.modus === 'zeit';
  // Im Zeitfahren gibt es keine Item-Boxen, dafür drei Turbos zum Start
  for (const b of S.boxen){ b.aus = zustand.zeitfahren ? Infinity : 0; b.mesh.visible = !zustand.zeitfahren; }
  for (const m of S.muenzen) m.aus = 0;
  zustand.muenzRennen = 0;
  const wetter = opts ? (olympia ? 'klar' : wetterAusZahl(opts.wetter | 0)) : WETTER[wahl.wetter] ? wahl.wetter : wetterWuerfeln();
  wetterSetzen(S, wetter);
  let slots = opts && opts.slots;
  if (!slots && zustand.zeitfahren) slots = [{ fahrer:wahl.fahrer, ich:true, teile:garage.wahl }];
  if (!slots){
    // Im Cup fahren in allen Rennen dieselben Gegner
    if (!cup.aktiv || !cup.gegner) cup.gegner = mischen(FAHRER.map((f, i) => i).filter(i => i !== wahl.fahrer)).slice(0, 7);
    const andere = cup.gegner.slice();
    // Computerfahrer bekommen ab und zu auch schicke Teile
    const botTeile = () => TEIL_ARTEN.map(a => Math.random() < 0.3 ? Math.floor(Math.random() * TEILE[a].length) : 0);
    slots = Array.from({ length:8 }, (x, slot) => slot === SPIELER_STARTPLATZ ? { fahrer:wahl.fahrer, ich:true, teile:garage.wahl } : { fahrer:andere.pop(), teile:botTeile() });
  }
  slots.forEach((sl, slot) => {
    const k = new Kart(FAHRER[sl.fahrer] || FAHRER[0], !!sl.ich, { name:sl.name, mensch:sl.mensch, fern:sl.fern, slot, schild:sl.mensch && !sl.ich, teile:sl.teile });
    aufStartplatz(k, slot);
    karts.push(k);
    if (sl.ich) spieler = k;
  });
  if (zustand.zeitfahren){ spieler.item = 'turbo3'; spieler.itemAnzahl = 3; geistStarten(); }
  else geistEntfernen();
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
  if (wetter !== 'klar') meldung(`${WETTER[wetter].icon} ${wetter === 'sturm' ? sturmName(S.th) : WETTER[wetter].name}`, 0.48, true);
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
  // Startampel: alle 0,5 s ein Paar mehr, bei LOS gehen alle aus
  ampelSetzen(t < 0.5 || t >= 3.5 ? 0 : Math.min(5, Math.floor((t - 0.5) / 0.5) + 1));
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
    windschattenPruefen(k, dt);
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
  if (zustand.zeitfahren){ zeitfahrErgebnis(); return; }
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
  const cupLetztes = cup.aktiv && cup.nr >= cup.def.strecken.length - 1;
  $('ergebnisTitel').textContent = cup.aktiv ? `${cup.def.name} · Rennen ${cup.nr + 1}/${cup.def.strecken.length} · ${titel}` : titel;
  let html = '<table>' + rang.map((k, i) =>
    `<tr class="${k.spieler ? 'ich' : ''}"><td>${i + 1}.</td><td>${k.f.gesicht} ${k.f.name}</td><td class="r">${zeitText(k.zielzeit)}</td>${cup.aktiv ? `<td class="r">+${PUNKTE[i]}</td>` : ''}</tr>`).join('') + '</table>';
  html += `<p class="rekord" style="margin-top:10px">Beste Runde: ${zeitText(beste)} · Rekord: ${zeitText(rek.zeit)}</p>` + neu;
  if (cup.aktiv){
    const stand = karts.map(k => k.f).sort((a, b) => (cup.punkte[b.id] || 0) - (cup.punkte[a.id] || 0));
    html += '<h2 style="font-size:1.1rem;margin:16px 0 6px">Cup-Wertung</h2><table>' + stand.map((f, i) =>
      `<tr class="${f === spieler.f ? 'ich' : ''}"><td>${i + 1}.</td><td>${f.gesicht} ${f.name}</td><td class="r">${cup.punkte[f.id] || 0} P</td></tr>`).join('') + '</table>';
    if (cupLetztes){
      const cupPlatz = stand.indexOf(spieler.f) + 1;
      $('ergebnisTitel').textContent = cupPlatz === 1 ? `🏆 ${cup.def.name} gewonnen!` : cupPlatz === 2 ? `🥈 ${cup.def.name}: 2. Platz` : cupPlatz === 3 ? `🥉 ${cup.def.name}: 3. Platz` : `${cup.def.name}: ${cupPlatz}. Platz`;
      const pk = `${cup.def.id}|${wahl.stufe}`;
      if (!(pokale[pk] <= cupPlatz)){
        pokale[pk] = cupPlatz; schreiben('pokale', pokale);
        if (cupPlatz <= 3) html += `<p class="neu">Neuer Pokal: ${POKAL[cupPlatz]} im ${esc(cup.def.name)} (${STUFEN[wahl.stufe].name})</p>`;
      }
    }
  }
  $('ergebnisText').innerHTML = html + muenzenGutschreiben(platz);
  const knoepfe = $('ergebnisKnoepfe');
  knoepfe.innerHTML = '';
  const knopf = (text, haupt, fn) => { const b = document.createElement('button'); b.className = 'knopf' + (haupt ? ' haupt' : ''); b.textContent = text; b.onclick = () => { Ton.effekt('klick'); fn(); }; knoepfe.appendChild(b); };
  if (cup.aktiv && !cupLetztes) knopf('Nächstes Rennen', true, () => { cup.nr++; wahl.strecke = cup.def.strecken[cup.nr]; rennenStarten(); });
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

const POKAL = { 1:'🏆', 2:'🥈', 3:'🥉' };
// Münzkonto für die Garage: gesammelte Münzen plus Bonus für den Platz
const konto = { muenzen:lesen('konto', 0) };
if (!zahlOk(konto.muenzen) || konto.muenzen < 0) konto.muenzen = 0;
const PLATZ_BONUS = [10, 7, 5, 3, 2, 2, 1, 1];
function muenzenGutschreiben(platz){
  const bonus = platz ? PLATZ_BONUS[platz - 1] || 0 : 0, summe = (zustand.muenzRennen || 0) + bonus;
  zustand.muenzRennen = 0;
  if (!summe) return '';
  konto.muenzen += summe; schreiben('konto', konto.muenzen);
  return `<p class="muenzGewinn">+${summe} 🪙 <small>(${summe - bonus} gesammelt${bonus ? ` + ${bonus} Platzbonus` : ''}) · Konto: ${konto.muenzen} 🪙</small></p>`;
}
function cupStarten(){
  cup.aktiv = true; cup.nr = 0; cup.punkte = {}; cup.gegner = null; cup.def = CUPS[wahl.cup];
  wahl.strecke = cup.def.strecken[0];
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
  setzen('muenzen', `🪙 ${k.muenzen}`);
  $('muenzen').classList.toggle('voll', k.muenzen >= MAX_MUENZEN);
  // Item
  let icon = '', anzahl = '';
  if (k.roulette > 0){ const alle = Object.values(ITEM_ICON); icon = alle[Math.floor(zeit * 14) % alle.length]; }
  else if (k.item){ icon = ITEM_ICON[k.item]; if (k.item === 'turbo3') anzahl = '×' + k.itemAnzahl; else if (k.item === 'rakete' && k.eingabe.bremse) anzahl = '↩'; }
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
    camera.position.set(k.x + Math.sin(w) * 7.8, 2.8 + k.boden, k.z + Math.cos(w) * 7.8);
    blick.set(k.x, 1.1 + k.boden, k.z);
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
    camera.position.set(k.x - Math.sin(w) * r, 2.4 + 0.6 * e + k.boden, k.z - Math.cos(w) * r);
    camera.lookAt(k.x + Math.sin(k.yaw) * 6 * e, 1.2 + k.boden, k.z + Math.cos(k.yaw) * 6 * e);
    k.camYaw = k.yaw;
    zustand.fov = 68;
  } else if (zustand.phase === 'auslauf' || zustand.phase === 'ergebnis'){
    zustand.orbit += dt * 0.3;
    const w = k.yaw + Math.PI * 0.75 + Math.sin(zustand.orbit) * 0.5;
    ziel.set(k.x + Math.sin(w) * 8.5, 3.2 + k.boden + k.y, k.z + Math.cos(w) * 8.5);
    camera.position.lerp(ziel, 1 - Math.exp(-3 * dt));
    camera.lookAt(k.x, 1.2 + k.boden + k.y, k.z);
    zustand.fov = 60;
  } else {
    k.camYaw += winkelDiff(k.yaw, k.camYaw) * (1 - Math.exp(-7 * dt));
    const s = Math.sin(k.camYaw), c = Math.cos(k.camYaw);
    const abstand = 7.4 + klemm(k.v / k.werte.maxV, 0, 1.4) * 0.65;
    ziel.set(k.x - s * abstand, 3.25 + k.boden + k.y * 0.5, k.z - c * abstand);
    camera.position.lerp(ziel, 1 - Math.exp(-12 * dt));
    blick.set(k.x + s * 6, 1.3 + k.boden + k.y * 0.3, k.z + c * 6);
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
  sonne.target.position.set(k.x, k.boden, k.z);
  sonne.position.y += k.boden;
  himmel.position.copy(camera.position);
  const skala = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  funken.mat.uniforms.skala.value = staub.mat.uniforms.skala.value = skala;
}


/* =========================================================
   Zeitfahren: allein gegen den eigenen Geist (bestes Rennen,
   20 Bilder pro Sekunde im Browser gespeichert)
   ========================================================= */
const GEIST_TAKT = 0.05;
const geistZeiten = lesen('geistzeiten', {});
const geist = { aufnahme:[], naechste:0, marken:[], daten:null, kart:null };
const geistSchluessel = () => `${strecke.def.id}|${wahl.stufe}`;
function geistEntfernen(){
  if (geist.kart){ geist.kart.entfernen(); geist.kart = null; }
  geist.daten = null;
}
function geistStarten(){
  geistEntfernen();
  geist.aufnahme = []; geist.naechste = 0; geist.marken = [];
  const d = lesen('geist:' + geistSchluessel(), null);
  if (!d || !Array.isArray(d.d) || d.d.length < 10 || !d.d.every(zahlOk)) return;
  geist.daten = d;
  const k = new Kart(FAHRER[d.fahrer] || FAHRER[0], false, { name:'Geist', schild:true, teile:d.teile });
  // Durchsichtig und ohne Schatten: jedes Teil bekommt eine eigene Materialkopie
  k.m.gruppe.traverse(o => {
    if (!o.isMesh && !o.isSprite) return;
    o.castShadow = false;
    if (o === k.m.kontakt){ o.visible = false; return; }
    if (o === k.schild) return;
    o.material = o.material.clone();
    Object.assign(o.material, { transparent:true, opacity:0.4, depthWrite:false });
    if (o.material.emissive) o.material.emissive.setRGB(0.1, 0.2, 0.45);
  });
  geist.kart = k;
  geistZeigen(0, 0);
}
function geistAufnehmen(){
  const k = spieler;
  while (zustand.rt >= geist.naechste && !k.fertig){
    geist.aufnahme.push(rund(k.x), rund(k.z), rund(k.y), rund(k.yaw, 1000), (k.boost > 0 ? 1 : 0) + (k.trick > 0 ? 2 : 0));
    geist.naechste += GEIST_TAKT;
  }
}
function geistZeigen(t, dt){
  const k = geist.kart, d = geist.daten.d, n = d.length / 5;
  const f = klemm(t / GEIST_TAKT, 0, n - 1.001), i = Math.floor(f), a = f - i, p = i * 5, q = p + 5;
  const x = d[p] + (d[q] - d[p]) * a, z = d[p + 1] + (d[q + 1] - d[p + 1]) * a;
  if (dt > 0){
    const yawAlt = k.yaw;
    k.v = Math.hypot(x - k.x, z - k.z) / dt;
    k.yaw = d[p + 3] + winkelDiff(d[q + 3], d[p + 3]) * a;
    k.lenkAnzeige += (klemm(winkelDiff(k.yaw, yawAlt) / dt * 0.6, -1, 1) - k.lenkAnzeige) * Math.min(1, dt * 8);
  } else k.yaw = d[p + 3];
  k.x = x; k.z = z; k.y = d[p + 2] + (d[q + 2] - d[p + 2]) * a;
  k.idx = dt > 0 ? naechster(strecke, x, z, k.idx) : naechsterGlobal(strecke, x, z);
  k.seite = (x - strecke.px[k.idx]) * strecke.tz[k.idx] - (z - strecke.pz[k.idx]) * strecke.tx[k.idx];
  k.boden = bodenUnter(strecke, k);
  k.boost = d[p + 4] & 1 ? 0.1 : 0;
  // Ein Trick des Geists dreht sich wie beim echten Kart
  const trick = (d[p + 4] & 2) > 0;
  if (trick && !k.netzTrick) k.trick = TRICK_DAUER;
  k.netzTrick = trick;
}
function geistUpdate(dt){
  if (!zustand.zeitfahren) return;
  if (zustand.phase === 'rennen' || zustand.phase === 'auslauf') geistAufnehmen();
  if (!geist.kart) return;
  geistZeigen(['rennen', 'auslauf', 'ergebnis'].includes(zustand.phase) ? zustand.rt : 0, dt);
  kartDarstellen(geist.kart, dt);
  geist.kart.trick = Math.max(0, geist.kart.trick - dt);
}
// Abstand zum Geist an einer Rundenmarke, z. B. '−0,42 s'
function geistVergleich(nr, t){
  const m = geist.daten && geist.daten.runden;
  if (!Array.isArray(m) || !zahlOk(m[nr])) return '';
  const d = t - m[nr];
  return `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2).replace('.', ',')} s`;
}
function zeitfahrErgebnis(){
  const k = spieler, schluessel = geistSchluessel(), alt = geistZeiten[schluessel];
  let html = '<table>' + k.rundenzeiten.map((t, i) => `<tr><td>Runde ${i + 1}</td><td class="r">${zeitText(t)}</td><td class="r">${geistVergleich(i, geist.marken[i])}</td></tr>`).join('')
    + `<tr class="ich"><td>Gesamt</td><td class="r">${zeitText(k.zielzeit)}</td><td class="r">${geistVergleich(RUNDEN - 1, k.zielzeit)}</td></tr></table>`;
  if (!(alt <= k.zielzeit)){
    geistZeiten[schluessel] = k.zielzeit; schreiben('geistzeiten', geistZeiten);
    schreiben('geist:' + schluessel, { zeit:k.zielzeit, fahrer:wahl.fahrer, teile:garage.wahl, runden:geist.marken, d:geist.aufnahme });
    html += `<p class="neu">${alt ? `Neue Bestzeit, ${(alt - k.zielzeit).toFixed(2).replace('.', ',')} s schneller!` : 'Erste Zeit gesetzt!'} Ab jetzt fährt dieser Geist mit.</p>`;
  } else html += `<p class="rekord" style="margin-top:10px">Dein Geist war ${(k.zielzeit - alt).toFixed(2).replace('.', ',')} s schneller · Bestzeit ${zeitText(alt)}</p>`;
  $('ergebnisTitel').textContent = `⏱️ Zeitfahren · ${zeitText(k.zielzeit)}`;
  $('ergebnisText').innerHTML = html + muenzenGutschreiben(0);
  const knoepfe = $('ergebnisKnoepfe');
  knoepfe.innerHTML = '';
  const knopf = (text, haupt, fn) => { const b = document.createElement('button'); b.className = 'knopf' + (haupt ? ' haupt' : ''); b.textContent = text; b.onclick = () => { Ton.effekt('klick'); fn(); }; knoepfe.appendChild(b); };
  knopf('Nochmal', true, rennenStarten);
  knopf('Nächste Strecke', false, () => { wahl.strecke = (wahl.strecke + 1) % STRECKEN.length; schreiben('wahl', wahl); rennenStarten(); });
  knopf('Menü', false, menueZeigen);
  $('ergebnis').hidden = false;
  $('touch').hidden = true;
  knoepfe.querySelector('button').focus();
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
const ART_NAME = { reifen:'Reifen', fluegel:'Heck', lack:'Lack' };
const hatPokal = () => Object.values(pokale).some(p => p === 1);
function garageBauen(){
  $('kontoAnzeige').textContent = `${konto.muenzen} 🪙`;
  const gw = $('garagewahl'); gw.innerHTML = '';
  TEIL_ARTEN.forEach((art, ai) => {
    const zeile = document.createElement('div'); zeile.className = 'garageZeile';
    zeile.innerHTML = `<span>${ART_NAME[art]}</span>`;
    const reihe = document.createElement('div'); reihe.className = 'reihe klein';
    TEILE[art].forEach((t, i) => {
      const besitzt = !t.preis || garage.besitz.includes(`${art}:${i}`), gesperrt = t.pokal && !hatPokal();
      const info = besitzt ? (garage.wahl[ai] === i ? 'Ausgewählt' : 'Gekauft') : gesperrt ? '🔒 Cup gewinnen' : `${t.preis} 🪙`;
      const b = wahlKnopf(`<b>${t.name}</b><small class="${!besitzt && !gesperrt && konto.muenzen < t.preis ? 'zuTeuer' : ''}">${info}</small>`, garage.wahl[ai] === i, () => {
        if (!besitzt){
          if (gesperrt || konto.muenzen < t.preis) return;
          konto.muenzen -= t.preis; schreiben('konto', konto.muenzen);
          garage.besitz.push(`${art}:${i}`);
          Ton.effekt('muenze');
        }
        garage.wahl[ai] = i; schreiben('garage', garage);
        vorschauZeigen();
        if (online.aktiv) Netz.senden({ t:'fahrer', fahrer:wahl.fahrer, teile:garage.wahl });
      });
      reihe.appendChild(b);
    });
    zeile.appendChild(reihe);
    gw.appendChild(zeile);
  });
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
  garageBauen();
  const mw = $('moduswahl'); mw.innerHTML = '';
  [['einzel', 'Einzelrennen', 'Gegen den Computer'], ['cup', 'Cups', 'Mehrere Rennen, Punkte'], ['zeit', 'Zeitfahren', 'Gegen deinen Geist'], ['online', 'Online', 'Mit Freunden fahren']].forEach(([id, name, info]) =>
    mw.appendChild(wahlKnopf(`<b>${name}</b><small>${info}</small>`, wahl.modus === id, () => { wahl.modus = id; schreiben('wahl', wahl); })));
  $('streckenBlock').hidden = wahl.modus !== 'einzel' && wahl.modus !== 'zeit';
  $('cupBlock').hidden = wahl.modus !== 'cup';
  const cw = $('cupwahl'); cw.innerHTML = '';
  CUPS.forEach((c, i) => {
    const pokal = pokale[`${c.id}|${wahl.stufe}`];
    cw.appendChild(wahlKnopf(`<b>${c.name}</b><small>${c.info} · ${c.strecken.length} Rennen</small><small class="rekord">${pokal <= 3 ? POKAL[pokal] + ' gewonnen' : pokal ? 'Bestes: ' + pokal + '. Platz' : 'Noch kein Pokal'}</small>`, i === wahl.cup, () => {
      if (wahl.cup === i) return;
      wahl.cup = i; schreiben('wahl', wahl); streckeLaden(c.strecken[0]); vorschauZeigen();
    }));
  });
  $('stufenBlock').hidden = wahl.modus === 'online';
  $('onlineBlock').hidden = wahl.modus !== 'online';
  const sw = $('streckenwahl'); sw.innerHTML = '';
  STRECKEN.forEach((s, i) => {
    const rek = rekorde[`${s.id}|${wahl.stufe}`], gz = geistZeiten[`${s.id}|${wahl.stufe}`];
    const rekText = wahl.modus === 'zeit' ? (gz ? '👻 Geist ' + zeitText(gz) : 'Noch kein Geist') : rek && rek.zeit ? 'Rekord ' + zeitText(rek.zeit) : 'Noch kein Rekord';
    sw.appendChild(wahlKnopf(`<b>${s.name}</b><small>${s.info}</small><small class="rekord">${rekText}</small>`, i === wahl.strecke, () => {
      if (wahl.strecke === i) return;
      wahl.strecke = i; schreiben('wahl', wahl); streckeLaden(i); vorschauZeigen(); Ton.musik('menue');
    }));
  });
  const ww = $('wetterwahl'); ww.innerHTML = '';
  [['zufall', '🎲', 'Zufall'], ...WETTER_ARTEN.map(a => [a, WETTER[a].icon, WETTER[a].name])].forEach(([id, icon, name]) =>
    ww.appendChild(wahlKnopf(`<b>${icon}</b><small>${name}</small>`, (wahl.wetter || 'zufall') === id, () => { wahl.wetter = id; schreiben('wahl', wahl); })));
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
$('neuKnopf').onclick = () => { pauseUmschalten(); if (cup.aktiv) wahl.strecke = cup.def.strecken[cup.nr]; rennenStarten(); };
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
    rund(k.fortschritt, 10), k.offroad ? 1 : 0, rund(k.drehDauer), k.trick > 0 ? 1 : 0
  ]);
  if (k.length) Netz.senden({ t:'z', k });
}

// Ferngesteuertes Kart: zur zuletzt gemeldeten Position gleiten und dazwischen weiterrechnen
function fernBewegen(k, dt){
  k.klein = Math.max(0, k.klein - dt);
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
  k.trick = Math.max(0, k.trick - dt);
  if (n.trick && !k.netzTrick) k.trick = TRICK_DAUER;
  k.netzTrick = n.trick;
  k.runde = n.runde; k.fortschritt = n.fortschritt;
  const S = strecke;
  k.idx = naechster(S, k.x, k.z, k.idx);
  const i = k.idx;
  k.seite = (k.x - S.px[i]) * S.tz[i] - (k.z - S.pz[i]) * S.tx[i];
  k.boden = bodenUnter(S, k);
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

// Hat ein anderer übernommen (z. B. weil dieser Tab im Hintergrund war), kommen die Computerfahrer von dort
function botsAbgeben(){
  for (const k of karts){
    if (k.mensch || k.fern) continue;
    k.fern = true; k.netz = null;
  }
}

function onlineZuruecksetzen(){
  Object.assign(online, { aktiv:false, imRennen:false, raum:null, ich:null, host:false });
}
function raumVerlassen(){
  if (olympia){ Netz.senden({ t:'verlassen' }); Netz.trennen(); zurOlympiade(); return; }
  Netz.senden({ t:'verlassen' });
  Netz.trennen();
  onlineZuruecksetzen();
  menueZeigen();
}

function sichtMelden(){ if (online.aktiv) Netz.senden({ t:'sicht', v:!document.hidden }); }
document.addEventListener('visibilitychange', sichtMelden);
Netz.on('raum', m => {
  const warHost = online.host;
  if (!online.aktiv) setTimeout(sichtMelden, 0);
  Object.assign(online, { aktiv:true, raum:m, ich:m.du, host:m.host === m.du });
  $('onlineFehler').textContent = '';
  if (olympia && m.olymp){ olympia.info = m.olymp; olympia.startBis = m.olymp.startIn != null ? Date.now() + m.olymp.startIn : 0; }
  if (online.imRennen){
    if (m.phase === 'lobby'){ menueZeigen('lobby'); return; }
    if (!warHost && online.host) botsUebernehmen();
    if (warHost && !online.host) botsAbgeben();
    if (zustand.phase === 'ergebnis') ergebnisKnoepfeOnline();
    return;
  }
  if ($('lobby').hidden || zustand.phase !== 'menue') menueZeigen('lobby'); else lobbyBauen();
});

Netz.on('fehler', m => {
  const text = String(m.text || 'Das hat nicht geklappt.');
  if (m.olymp && olympia){
    // Ticket ungültig oder Rennen vorbei: normales Menü, mit Weg zurück zur Olympiade
    olympiaBeenden();
    $('onlineFehler').textContent = text;
    menueZeigen();
    return;
  }
  if (!$('lobby').hidden) $('lobbyInfo').textContent = text; else $('onlineFehler').textContent = text;
});

Netz.on('getrennt', () => {
  if (!online.aktiv) return;
  if (olympia && !online.imRennen){ onlineZuruecksetzen(); setTimeout(olympLos, 1500); return; }
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
      mensch:!sl.bot, ich, fern:!ich && !(sl.bot && online.host), teile:teileOk(sl.teile)
    };
  });
  if (!slots.some(sl => sl.ich)) return;
  online.imRennen = true;
  online.wegNamen = {};
  online.rennenNr = (online.rennenNr || 0) + 1;
  $('menue').hidden = true;
  rennenStarten({ strecke:klemm(m.strecke | 0, 0, STRECKEN.length - 1), stufe:klemm(m.stufe | 0, 0, STUFEN.length - 1), slots, wetter:klemm(m.wetter | 0, 0, 9) });
});

Netz.on('z', m => {
  if (!online.imRennen || !Array.isArray(m.k)) return;
  for (const e of m.k){
    if (!Array.isArray(e) || e.length < 16 || !e.every(zahlOk)) continue;
    const k = karts.find(x => x.slot === e[0]);
    if (!k || !k.fern) continue;
    const n = {
      x:e[1], z:e[2], y:klemm(e[3], -60, 60), yaw:e[4], v:klemm(e[5], -20, 80), drift:e[6], driftStufe:e[7], dreh:e[8],
      boost:e[9], stern:e[10], lenk:e[11], runde:e[12], fortschritt:e[13], off:e[14], drehDauer:klemm(e[15], 0.2, 3), trick:e[16] ? 1 : 0
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
      raketeBauen({ id:m.id, x:m.x, z:m.z, yaw:m.yaw, idx:klemm(m.idx, 0, S.N - 1), seite:m.seite, besitzer:von, ziel, t:0, rueck:!!m.rueck });
      break;
    }
    case 'l': { const von = karts.find(k => k.slot === m.von); if (von) blitzTreffen(von); break; }
    case 'rw': { const i = raketen.findIndex(r => r.id === m.id); if (i >= 0) raketeWeg(i); break; }
    case 'x': { const b = S.boxen[m.i]; if (b && b.aus <= 0) boxWeg(b); break; }
    case 'm': { const mu = S.muenzen[m.i]; if (mu && mu.aus <= 0) muenzeWeg(mu); break; }
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
  online.cupStand = m.cup && Array.isArray(m.cup.stand) ? m.cup : null;
  setTimeout(() => { if (online.imRennen && online.rennenNr === nr) ergebnisOnline(m.rang); }, warten * 1000);
});

function ergebnisOnline(rang){
  zustand.phase = 'ergebnis';
  const cupDef = online.cupStand && online.raum ? CUPS[online.raum.cup] : null;
  const c = cupDef ? online.cupStand : null;
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
    const punkte = c ? `<td class="r">+${r.weg ? 0 : PUNKTE[i] || 0}</td>` : '';
    return `<tr class="${k && k.spieler ? 'ich' : ''}"><td>${i + 1}.</td><td>${name}</td><td class="r">${zeitTxt}</td>${punkte}</tr>`;
  });
  const platz = rang.findIndex(r => spieler && r.slot === spieler.slot) + 1;
  const titel = platz === 1 ? '🏆 Sieg!' : platz >= 2 && platz <= 3 ? `${platz}. Platz – Podium!` : platz ? `${platz}. Platz` : 'Ergebnis';
  let html = '<table>' + zeilen.join('') + '</table>';
  $('ergebnisTitel').textContent = c ? `${cupDef.name} · Rennen ${c.nr + 1}/${c.anzahl} · ${titel}` : titel;
  if (c){
    // Cup-Wertung über alle bisherigen Rennen
    const fahrerVon = e => FAHRER[e.fahrer] || FAHRER[0];
    html += '<h2 style="font-size:1.1rem;margin:16px 0 6px">Cup-Wertung</h2><table>' + c.stand.map((e, i) =>
      `<tr class="${e.id && e.id === online.ich ? 'ich' : ''}"><td>${i + 1}.</td><td>${fahrerVon(e).gesicht} ${esc(e.id ? e.name || 'Fahrer' : fahrerVon(e).name)}</td><td class="r">${e.punkte | 0} P</td></tr>`).join('') + '</table>';
    if (c.fertig){
      const cupPlatz = c.stand.findIndex(e => e.id && e.id === online.ich) + 1;
      $('ergebnisTitel').textContent = cupPlatz === 1 ? `🏆 ${cupDef.name} gewonnen!` : cupPlatz >= 2 && cupPlatz <= 3 ? `${POKAL[cupPlatz]} ${cupDef.name}: ${cupPlatz}. Platz` : cupPlatz ? `${cupDef.name}: ${cupPlatz}. Platz` : `${cupDef.name} vorbei`;
    }
  }
  $('ergebnisText').innerHTML = html + muenzenGutschreiben(platz) + '<p class="leise" id="ergebnisHinweis" style="margin-top:10px"></p>';
  ergebnisKnoepfeOnline();
  $('ergebnis').hidden = false;
  $('touch').hidden = true;
}
function ergebnisKnoepfeOnline(){
  const knoepfe = $('ergebnisKnoepfe');
  knoepfe.innerHTML = '';
  const knopf = (text, haupt, fn) => { const b = document.createElement('button'); b.className = 'knopf' + (haupt ? ' haupt' : ''); b.textContent = text; b.onclick = () => { Ton.effekt('klick'); fn(); }; knoepfe.appendChild(b); };
  const hinweis = $('ergebnisHinweis');
  if (olympia){
    knopf('Zurück zur Olympiade', true, raumVerlassen);
    if (hinweis) hinweis.textContent = 'Dein Platz ist bei der Olympiade eingetragen.';
    return;
  }
  const c = online.cupStand, cupWeiter = c && !c.fertig;
  if (online.host){
    knopf(cupWeiter ? 'Nächstes Rennen' : c ? 'Cup nochmal' : 'Nochmal', true, () => Netz.senden({ t:'start' }));
    knopf('Zur Lobby', false, () => Netz.senden({ t:'lobby' }));
  }
  knopf('Raum verlassen', false, raumVerlassen);
  if (hinweis) hinweis.textContent = online.host
    ? (cupWeiter ? 'Du bist Host: Starte das nächste Cup-Rennen.' : 'Du bist Host: Starte das nächste Rennen oder geh zurück in die Lobby.')
    : (cupWeiter ? 'Der Host startet gleich das nächste Cup-Rennen.' : 'Der Host startet gleich das nächste Rennen.');
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
    wahl.fahrer = i; schreiben('wahl', wahl); vorschauZeigen(); Netz.senden({ t:'fahrer', fahrer:i, teile:garage.wahl });
  }, () => {})));
  const ei = $('lobbyEinst');
  ei.innerHTML = '';
  if (online.host){
    const cupNr = Number.isInteger(m.cup) && CUPS[m.cup] ? m.cup : -1;
    const einst = aenderung => Netz.senden({ t:'einst', strecke:m.strecke, stufe:m.stufe, bots:m.bots, cup:cupNr, ...aenderung });
    const r0 = document.createElement('div'), r1 = document.createElement('div'), r2 = document.createElement('div');
    r0.className = r1.className = r2.className = 'reihe';
    r0.appendChild(wahlKnopf('<b>Einzelrennen</b><small>Eine Strecke</small>', cupNr < 0, () => einst({ cup:-1 }), () => {}));
    CUPS.forEach((c, i) => r0.appendChild(wahlKnopf(`<b>${c.name}</b><small>${c.strecken.length} Rennen, Punkte</small>`, i === cupNr, () => einst({ cup:i }), () => {})));
    if (cupNr < 0) STRECKEN.forEach((st, i) => r1.appendChild(wahlKnopf(`<b>${st.name}</b>`, i === m.strecke, () => einst({ strecke:i }), () => {})));
    else r1.innerHTML = `<p class="leise">${CUPS[cupNr].strecken.map(i => esc(STRECKEN[i].name)).join(' → ')}</p>`;
    STUFEN.forEach((st, i) => r2.appendChild(wahlKnopf(`<b>${st.name}</b><small>${st.info}</small>`, i === m.stufe, () => einst({ stufe:i }), () => {})));
    const sch = document.createElement('label');
    sch.className = 'schalter';
    sch.innerHTML = `<input type="checkbox" ${m.bots ? 'checked' : ''}> Freie Plätze mit Computerfahrern auffüllen`;
    sch.querySelector('input').onchange = e => einst({ bots:e.target.checked });
    ei.append(r0, r1, r2, sch);
  } else {
    const was = CUPS[m.cup] ? `${esc(CUPS[m.cup].name)} (${CUPS[m.cup].strecken.length} Rennen)` : esc(STRECKEN[m.strecke].name);
    ei.innerHTML = `<p class="leise">${was} · ${esc(STUFEN[m.stufe].name)} · Computerfahrer ${m.bots ? 'an' : 'aus'}</p>`;
  }
  $('lobbyStart').hidden = !online.host;
  $('lobbyStart').disabled = m.phase === 'rennen';
  if (m.olymp) return olympLobby(m);
  $('olympBanner').hidden = true; $('raumKopf').hidden = false;
  $('lobbyStart').textContent = CUPS[m.cup] ? 'Cup starten' : 'Rennen starten'; $('lobbyRaus').textContent = 'Raum verlassen';
  $('lobbyInfo').textContent = m.phase === 'rennen' ? 'Gerade läuft ein Rennen. Beim nächsten bist du dabei.'
    : m.phase === 'ergebnis' ? 'Das Rennen ist gerade vorbei, gleich geht es weiter.'
    : online.host ? (m.spieler.length > 1 ? 'Starte, wenn alle da sind.' : 'Warte auf Freunde oder starte schon mal allein.')
    : 'Warte, bis der Host das Rennen startet.';
  // Hintergrund: Strecke des Raums (im Cup die erste Cup-Strecke) und eigener Fahrer
  const bild = m.phase === 'lobby' && CUPS[m.cup] ? CUPS[m.cup].strecken[0] : m.strecke;
  if (!strecke || strecke.nr !== bild){ streckeLaden(bild); vorschauZeigen(); }
  else if (vorschau && vorschau.f !== FAHRER[meinFahrer]){ wahl.fahrer = meinFahrer; vorschauZeigen(); }
}

// Lobby im Olympia-Raum: wer fehlt noch, Start-Countdown, keine Einstellungen
function olympLobby(m){
  const o = m.olymp;
  $('raumKopf').hidden = true;
  const b = $('olympBanner');
  b.hidden = false;
  b.innerHTML = `🏅 <b>${esc(o.titel)}</b> · Disziplin ${o.nr} von ${o.von}<div class="erwartet">${o.erwartet.map(e => `<span class="${e.da ? 'da' : ''}">${e.da ? '✓' : '…'} ${esc(e.n)}</span>`).join('')}</div>`;
  $('lobbyEinst').innerHTML = `<p class="leise">${esc(STRECKEN[m.strecke].name)} · ${esc(STUFEN[m.stufe].name)} · freie Plätze fahren Computer</p>`;
  $('lobbyStart').hidden = !online.host || o.gestartet;
  $('lobbyStart').textContent = 'Ohne die anderen starten';
  $('lobbyRaus').textContent = 'Zurück zur Olympiade';
  olympInfoText();
}
function olympInfoText(){
  const m = online.raum;
  if (!olympia || !m || !m.olymp || $('lobby').hidden) return;
  const fehlt = m.olymp.erwartet.filter(e => !e.da).length;
  $('lobbyInfo').textContent = m.phase === 'rennen' ? 'Das Rennen läuft schon – du bist leider zu spät.'
    : !olympia.startBis ? `Warte auf ${fehlt} Mitspieler – es geht los, sobald alle da sind.`
    : fehlt ? `Warte auf ${fehlt} Mitspieler – spätestens in ${Math.max(0, Math.ceil((olympia.startBis - Date.now()) / 1000))} s geht es los.`
    : `Alle da! Start in ${Math.max(0, Math.ceil((olympia.startBis - Date.now()) / 1000))} …`;
}
setInterval(olympInfoText, 250);
async function olympLos(){
  $('onlineFehler').textContent = 'Verbinde mit dem Olympia-Rennen …';
  try { await Netz.verbinden(); } catch (e) { $('onlineFehler').textContent = 'Keine Verbindung zum Server – neuer Versuch …'; setTimeout(olympLos, 3000); return; }
  Netz.senden({ t:'olymp', ticket:olympia.ticket, fahrer:wahl.fahrer, teile:garage.wahl });
}

$('nameFeld').value = lesen('name', '');
async function onlineLos(nachricht){
  const name = $('nameFeld').value.trim();
  if (!name){ $('onlineFehler').textContent = 'Gib zuerst einen Spitznamen ein.'; $('nameFeld').focus(); return; }
  schreiben('name', name);
  $('onlineFehler').textContent = 'Verbinde …';
  try { await Netz.verbinden(); } catch (e) { $('onlineFehler').textContent = 'Keine Verbindung zum Server. Bist du online?'; return; }
  Netz.senden({ ...nachricht, name, fahrer:wahl.fahrer, teile:garage.wahl });
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
  geistUpdate(dt);
  boxenUpdate(dt);
  muenzenUpdate(dt);
  spurenUpdate(dt);
  for (const b of bananen){ b.mesh.rotation.y += dt * 0.5; b.mesh.position.y = 0.25 + b.h + Math.sin(zeit * 3 + b.x) * 0.05; }
  funken.update(dt); staub.update(dt);
  blitzUpdate(dt);
  gefahrenUpdate(dt);
  kulisseUpdate(dt);
  wetterUpdate(dt);
  if (S.wolken) S.wolken.rotation.y += dt * 0.004;
  if (S.wolkenMeer) S.wolkenMeer.offset.x = (zeit * 0.002) % 1;
  himmelUni.zeit.value = zeit;
  if (S.schnee){
    const p = S.schnee.geometry.attributes.position, a = p.array, cx = camera.position.x, cz = camera.position.z;
    const richtung = S.glut ? -0.6 : 1;
    for (let i = 0; i < a.length; i += 3){
      a[i + 1] -= dt * (4 + (i % 7) * 0.4) * richtung; a[i] += Math.sin(zeit + i) * dt * 0.6;
      if (a[i + 1] < 0 || a[i + 1] > 45 || Math.abs(a[i] - cx) > 70 || Math.abs(a[i + 2] - cz) > 70){ a[i] = cx + zufall(-70, 70); a[i + 1] = S.glut ? zufall(0, 6) : zufall(20, 45); a[i + 2] = cz + zufall(-70, 70); }
    }
    p.needsUpdate = true;
  }
  if (S.meer){ S.meer.tex.offset.y = (zeit * 0.02) % 1; S.meer.gischt.material.opacity = 0.55 + Math.sin(zeit * 1.4) * 0.25; }
  if (S.vulkanRauch) S.vulkanRauch.forEach((r, n) => { r.position.y = 360 + ((n * 45 + zeit * 6) % 270); r.material.opacity = 0.55 * (1 - (r.position.y - 360) / 270); });
  if (S.th.glut) MAT.lava.color.setRGB(1, 0.32 + Math.sin(zeit * 2.2) * 0.06, 0.04).convertSRGBToLinear();
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
  get bananen(){ return bananen; }, get raketen(){ return raketen; }, get geist(){ return geist; }, get szene(){ return scene; },
  test:{ bananeLegen, raketeStarten, blitzAusloesen, boost, treffer },
  // Nur zum Testen: freie Kamera (bei zustand.pause = true bleibt sie stehen)
  kamera(px, py, pz, zx, zy, zz, fov = 50){ camera.position.set(px, py, pz); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(zx, zy, zz); himmel.position.copy(camera.position); renderer.render(scene, camera); },
  get renderInfo(){ return { aufrufe:renderer.info.render.calls, dreiecke:renderer.info.render.triangles, geometrien:renderer.info.memory.geometries }; },
  sim(sekunden, dt = 1 / 60){ for (let t = 0; t < sekunden; t += dt) schritt(dt); renderer.render(scene, camera); }
};

for (const id of ['grafikWahl','pauseGrafik']) $(id).onchange = e => {
  grafik.modus = e.target.value; schreiben('grafik',grafik.modus); grafikAnwenden();
};
menueZeigen();
grafikAnwenden();
requestAnimationFrame(schleife);
if (olympia) olympLos();
})();
