'use strict';
// Löwen-Kart – Server: liefert das Spiel aus und verbindet Online-Rennen (WebSocket unter /ws).
// Gefahren wird im Browser: Jeder schickt die Daten seines eigenen Karts, der Server
// reicht sie an die anderen im Raum weiter. Die Computerfahrer rechnet der Host.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const zugang = require('./zugang')({ titel:'Löwen-Kart' });

const PORT = Number(process.env.PORT) || 10100;
const MAX_RAEUME = 200;
const MAX_SPIELER = 8;
const ANZAHL_FAHRER = 9, ANZAHL_STRECKEN = 3, ANZAHL_STUFEN = 3;
const NACH_ERSTEM_ZIEL = 40_000;   // ms, dann ist das Rennen für alle vorbei
const MAX_RENNDAUER = 10 * 60_000;
const TYPEN = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8'
};
// Nur diese Dateien werden ausgeliefert
const DATEIEN = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/spiel.js', 'spiel.js'],
  ['/datenschutz', 'datenschutz.html'], ['/datenschutz.html', 'datenschutz.html']
]);

function senden(res, datei, cache){
  const voll = path.join(__dirname, datei);
  if (!fs.existsSync(voll)){ res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
  res.writeHead(200, { 'Content-Type':TYPEN[path.extname(voll)] || 'application/octet-stream', 'Cache-Control':cache });
  fs.createReadStream(voll).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname.startsWith('/datenschutz')) return senden(res, 'datenschutz.html', 'no-cache');
  if (req.method === 'GET' && url.pathname === '/healthz'){
    res.writeHead(200, { 'Content-Type':'application/json' }); return res.end('{"ok":true}');
  }
  if (zugang.pruefen(req, res)) return;
  // Selbst ausgelieferte Schriften und three.js (keine Verbindung zu Google oder CDNs)
  const vendor = /^\/vendor\/([\w-]+(?:\.[\w-]+)*\.(js|woff2|txt))$/.exec(url.pathname);
  if (req.method === 'GET' && vendor) return senden(res, path.join('vendor', vendor[1]), 'public, max-age=604800');
  if (req.method === 'GET' && DATEIEN.has(url.pathname)) return senden(res, DATEIEN.get(url.pathname), 'no-cache');
  res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
  res.end('Nicht gefunden');
});

/* ---------- Online-Räume ---------- */
const RAUM_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const raeume = new Map();
const wss = new WebSocketServer({ server, path:'/ws', maxPayload:4096, verifyClient:({ req }) => zugang.hatZugang(req) });

function sende(ws, m){ if (ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); }
function anAlle(raum, m, ausser){
  const text = JSON.stringify(m);
  for (const sp of raum.spieler.values()) if (sp.ws !== ausser) sende(sp.ws, text);
}
function raumSenden(raum){
  const m = {
    t:'raum', code:raum.code, host:raum.host, phase:raum.phase, strecke:raum.strecke, stufe:raum.stufe, bots:raum.bots,
    spieler:[...raum.spieler.values()].map(s => ({ id:s.id, name:s.name, fahrer:s.fahrer }))
  };
  for (const sp of raum.spieler.values()) sende(sp.ws, { ...m, du:sp.id });
}
const nameOk = n => String(n || '').replace(/[\u0000-\u001f\u007f<>&"]/g, '').trim().slice(0, 16) || 'Fahrer';
const ganz = (v, min, max, std) => (Number.isInteger(v) && v >= min && v <= max ? v : std);
function mischen(a){ for (let i = a.length - 1; i > 0; i--){ const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function neuerCode(){
  for (;;){
    let c = '';
    for (let i = 0; i < 4; i++) c += RAUM_ZEICHEN[crypto.randomInt(RAUM_ZEICHEN.length)];
    if (!raeume.has(c)) return c;
  }
}
// Darf diese Verbindung Daten für diesen Startplatz schicken? (eigenes Kart, Host auch für Computerfahrer)
function darf(ws, raum, slot){
  const s = raum.slots[slot];
  return !!s && !s.weg && (s.id === ws.id || (!s.id && raum.host === ws.id));
}

function beitreten(ws, raum, m){
  raum.spieler.set(ws.id, { id:ws.id, ws, name:nameOk(m.name), fahrer:ganz(m.fahrer, 0, ANZAHL_FAHRER - 1, 0) });
  ws.raum = raum.code;
  raumSenden(raum);
}

function raumVerlassen(ws){
  const raum = raeume.get(ws.raum);
  ws.raum = null;
  if (!raum) return;
  raum.spieler.delete(ws.id);
  if (raum.spieler.size === 0){ timerAus(raum); raeume.delete(raum.code); return; }
  if (raum.host === ws.id) raum.host = raum.spieler.keys().next().value;
  if (raum.phase === 'rennen'){
    const slot = raum.slots.findIndex(s => s.id === ws.id);
    if (slot >= 0){ raum.slots[slot].weg = true; anAlle(raum, { t:'weg', slot }); }
    endePruefen(raum);
  }
  raumSenden(raum);
}

function timerAus(raum){ clearTimeout(raum.endeTimer); clearTimeout(raum.zielTimer); raum.endeTimer = raum.zielTimer = null; }

function rennenStarten(raum){
  const menschen = mischen([...raum.spieler.values()]);
  const anzahl = raum.bots ? MAX_SPIELER : menschen.length;
  const plaetze = mischen([...Array(anzahl).keys()]);
  // Computerfahrer bekommen zuerst die Tiere, die kein Mensch fährt
  const genommen = new Set(menschen.map(s => s.fahrer));
  const botFahrer = mischen([...Array(ANZAHL_FAHRER).keys()].filter(f => !genommen.has(f)));
  raum.slots = new Array(anzahl);
  menschen.forEach((s, i) => { raum.slots[plaetze[i]] = { id:s.id, name:s.name, fahrer:s.fahrer }; });
  for (const slot of plaetze.slice(menschen.length)){
    raum.slots[slot] = { id:null, name:null, fahrer:botFahrer.length ? botFahrer.shift() : crypto.randomInt(ANZAHL_FAHRER) };
  }
  raum.phase = 'rennen';
  raum.ziele = new Map();
  raum.fort = new Array(anzahl).fill(0);
  timerAus(raum);
  raum.endeTimer = setTimeout(() => rennenEnde(raum), MAX_RENNDAUER);
  anAlle(raum, { t:'start', strecke:raum.strecke, stufe:raum.stufe, slots:raum.slots.map(s => ({ id:s.id, name:s.name, fahrer:s.fahrer, bot:!s.id })) });
  raumSenden(raum);
}

function endePruefen(raum){
  if (raum.phase !== 'rennen') return;
  const menschen = raum.slots.map((s, i) => [s, i]).filter(([s]) => s.id && !s.weg);
  if (menschen.length === 0 || menschen.every(([, i]) => raum.ziele.has(i))) return rennenEnde(raum);
  if (!raum.zielTimer && menschen.some(([, i]) => raum.ziele.has(i))) raum.zielTimer = setTimeout(() => rennenEnde(raum), NACH_ERSTEM_ZIEL);
}

function rennenEnde(raum){
  if (raum.phase !== 'rennen') return;
  timerAus(raum);
  raum.phase = 'ergebnis';
  const rang = raum.slots.map((s, i) => ({ slot:i, zeit:raum.ziele.has(i) ? raum.ziele.get(i) : null, fort:raum.fort[i] || 0, weg:!!s.weg }))
    .sort((a, b) => {
      if (a.zeit != null && b.zeit != null) return a.zeit - b.zeit;
      if ((a.zeit != null) !== (b.zeit != null)) return a.zeit != null ? -1 : 1;
      if (a.weg !== b.weg) return a.weg ? 1 : -1;
      return b.fort - a.fort;
    })
    .map(({ slot, zeit, weg }) => ({ slot, zeit, weg }));
  anAlle(raum, { t:'ende', rang });
  raumSenden(raum);
}

wss.on('connection', ws => {
  ws.id = crypto.randomBytes(6).toString('hex');
  ws.lebt = true; ws.raum = null; ws.zaehler = 0; ws.fenster = Date.now();
  ws.on('pong', () => { ws.lebt = true; });
  ws.on('message', roh => {
    // Höchstens 90 Nachrichten pro Sekunde
    const jetzt = Date.now();
    if (jetzt - ws.fenster > 1000){ ws.fenster = jetzt; ws.zaehler = 0; }
    if (++ws.zaehler > 90) return;
    let m;
    try { m = JSON.parse(roh); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const raum = raeume.get(ws.raum);
    const istHost = !!raum && raum.host === ws.id;
    switch (m.t){
      case 'erstellen': {
        if (raum) raumVerlassen(ws);
        if (raeume.size >= MAX_RAEUME) return sende(ws, { t:'fehler', text:'Gerade sind zu viele Räume offen. Versuch es gleich nochmal.' });
        const neu = { code:neuerCode(), host:ws.id, spieler:new Map(), phase:'lobby', strecke:0, stufe:1, bots:true, slots:[] };
        raeume.set(neu.code, neu);
        beitreten(ws, neu, m);
        break;
      }
      case 'beitreten': {
        const ziel = raeume.get(String(m.code || '').toUpperCase().trim());
        if (!ziel) return sende(ws, { t:'fehler', text:'Diesen Raum gibt es nicht. Prüf den Code.' });
        if (ziel === raum) return raumSenden(raum);
        if (ziel.spieler.size >= MAX_SPIELER) return sende(ws, { t:'fehler', text:'Der Raum ist voll (8 Fahrer).' });
        if (raum) raumVerlassen(ws);
        beitreten(ws, ziel, m);
        break;
      }
      case 'verlassen':
        if (raum) raumVerlassen(ws);
        break;
      case 'fahrer':
        if (raum){ raum.spieler.get(ws.id).fahrer = ganz(m.fahrer, 0, ANZAHL_FAHRER - 1, 0); raumSenden(raum); }
        break;
      case 'einst':
        if (istHost && raum.phase !== 'rennen'){
          raum.strecke = ganz(m.strecke, 0, ANZAHL_STRECKEN - 1, raum.strecke);
          raum.stufe = ganz(m.stufe, 0, ANZAHL_STUFEN - 1, raum.stufe);
          raum.bots = m.bots !== false;
          raumSenden(raum);
        }
        break;
      case 'start':
        if (istHost && raum.phase !== 'rennen') rennenStarten(raum);
        break;
      case 'lobby':
        if (istHost && raum.phase === 'ergebnis'){ raum.phase = 'lobby'; raumSenden(raum); }
        break;
      case 'z': {
        if (!raum || raum.phase !== 'rennen' || !Array.isArray(m.k)) return;
        const k = m.k.filter(e => Array.isArray(e) && e.length <= 20 && darf(ws, raum, e[0]));
        for (const e of k) if (typeof e[13] === 'number') raum.fort[e[0]] = e[13];
        if (k.length) anAlle(raum, { t:'z', k }, ws);
        break;
      }
      case 'e':
        if (raum && raum.phase === 'rennen') anAlle(raum, m, ws);
        break;
      case 'ziel':
        if (raum && raum.phase === 'rennen' && darf(ws, raum, m.slot) && !raum.ziele.has(m.slot) && typeof m.zeit === 'number' && isFinite(m.zeit)){
          raum.ziele.set(m.slot, m.zeit);
          anAlle(raum, { t:'ziel', slot:m.slot, zeit:m.zeit }, ws);
          endePruefen(raum);
        }
        break;
    }
  });
  ws.on('close', () => raumVerlassen(ws));
});
// Tote Verbindungen aufräumen
setInterval(() => {
  for (const ws of wss.clients){
    if (!ws.lebt){ ws.terminate(); continue; }
    ws.lebt = false;
    try { ws.ping(); } catch (e) { /* egal */ }
  }
}, 30_000).unref();

server.listen(PORT, () => console.log(`Löwen-Kart läuft auf Port ${PORT}`));
