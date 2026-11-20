import { EventQueue } from './eventQueue.js';
import { KeyboardProducer, SerialESP32Producer } from './inputProducers.js';
import { GameEngine } from './gameEngine.js';

const eventQueue = new EventQueue();
const canvas = document.getElementById('gameCanvas');
const gameEngine = new GameEngine(canvas, eventQueue);

// Initialize Input Event Producers
new KeyboardProducer(eventQueue);
const serialProducer = new SerialESP32Producer(eventQueue);

// UI Elements
const lobbyOverlay = document.getElementById('lobbyOverlay');
const resultsOverlay = document.getElementById('resultsOverlay');
const hudBar = document.getElementById('hud-bar');
const hudLap = document.getElementById('hud-lap');
const hudPos = document.getElementById('hud-pos');
const hudTime = document.getElementById('hud-time');
const hudStunts = document.getElementById('hud-stunts');

const playerNameInput = document.getElementById('playerName');
const playerColorSelect = document.getElementById('playerColor');
const lapSelect = document.getElementById('lapSelect');
const rosterList = document.getElementById('rosterList');
const racerCountSpan = document.getElementById('racerCount');
const serialStatus = document.getElementById('serialStatus');
const resultsBody = document.getElementById('resultsBody');

const eventLogList = document.getElementById('eventLogList');
const eventsProcessedCount = document.getElementById('eventsProcessedCount');

const BOT_NAMES = ['ApexBot', 'DriftKing', 'TurboAI', 'NitroBot', 'VortexAI'];
const BOT_COLORS = ['#00e5ff', '#ffcc00', '#34c759', '#af52de', '#ff9500'];

let lobbyRoster = [];

function syncHumanEntry() {
  const human = {
    id: 'human_1',
    name: playerNameInput.value.trim() || 'Player 1',
    color: playerColorSelect.value,
    isHuman: true
  };
  if (lobbyRoster.length === 0) {
    lobbyRoster.push(human);
  } else {
    lobbyRoster[0] = human;
  }
  renderRoster();
}

function renderRoster() {
  racerCountSpan.textContent = lobbyRoster.length;
  rosterList.innerHTML = '';
  for (const r of lobbyRoster) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="color-dot" style="background:${r.color}"></span>
                    <strong>${r.name}</strong> ${r.isHuman ? '(You)' : '[BOT]'}`;
    rosterList.appendChild(li);
  }
}

// UI Event Producers
playerNameInput.addEventListener('input', () => {
  syncHumanEntry();
  eventQueue.publish('LOBBY_JOINED', { nickname: lobbyRoster[0].name, color: lobbyRoster[0].color }, 'UIProducer');
});

playerColorSelect.addEventListener('change', () => {
  syncHumanEntry();
  eventQueue.publish('LOBBY_JOINED', { nickname: lobbyRoster[0].name, color: lobbyRoster[0].color }, 'UIProducer');
});

document.getElementById('addBotBtn').addEventListener('click', () => {
  if (lobbyRoster.length >= 6) return;
  const botIdx = lobbyRoster.length - 1;
  lobbyRoster.push({
    id: `bot_${botIdx + 1}`,
    name: BOT_NAMES[botIdx % BOT_NAMES.length],
    color: BOT_COLORS[botIdx % BOT_COLORS.length],
    isHuman: false
  });
  renderRoster();
  eventQueue.publish('BOT_ADDED', { count: lobbyRoster.length - 1 }, 'UIProducer');
});

document.getElementById('fillBotsBtn').addEventListener('click', () => {
  let added = 0;
  while (lobbyRoster.length < 6) {
    const botIdx = lobbyRoster.length - 1;
    lobbyRoster.push({
      id: `bot_${botIdx + 1}`,
      name: BOT_NAMES[botIdx % BOT_NAMES.length],
      color: BOT_COLORS[botIdx % BOT_COLORS.length],
      isHuman: false
    });
    added++;
  }
  renderRoster();
  if (added > 0) {
    eventQueue.publish('BOT_ADDED', { count: lobbyRoster.length - 1 }, 'UIProducer');
  }
});

document.getElementById('connectSerialBtn').addEventListener('click', async () => {
  try {
    await serialProducer.connect();
  } catch (err) {
    serialStatus.textContent = `Serial Info: ${err.message}`;
    serialStatus.style.color = '#fbbf24';
  }
});

document.getElementById('startRaceBtn').addEventListener('click', () => {
  syncHumanEntry();
  const totalLaps = parseInt(lapSelect.value, 10);
  eventQueue.publish(
    'RACE_STARTED',
    { totalLaps, racerCount: lobbyRoster.length, roster: [...lobbyRoster] },
    'UIProducer'
  );
});

document.getElementById('raceAgainBtn').addEventListener('click', () => {
  eventQueue.publish('GAME_RESET', {}, 'UIProducer');
});

document.getElementById('clearLogBtn').addEventListener('click', () => {
  eventQueue.clearHistory();
  eventLogList.innerHTML = '';
  eventsProcessedCount.textContent = '0';
});

// HUDRenderer Event Handlers (Subscribed to EventQueue)
eventQueue.subscribe('ESP32_CONNECTED', ({ portInfo }) => {
  serialStatus.textContent = `Connected: ${portInfo}`;
  serialStatus.style.color = '#34d399';
});

eventQueue.subscribe('RACE_STARTED', ({ totalLaps }) => {
  lobbyOverlay.classList.add('hidden');
  resultsOverlay.classList.add('hidden');
  hudBar.classList.remove('hidden');
  hudLap.textContent = `Lap: 1 / ${totalLaps}`;
});

eventQueue.subscribe('RACE_FINISHED', ({ standings }) => {
  hudBar.classList.add('hidden');
  resultsBody.innerHTML = '';

  for (const row of standings) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${row.rank}</strong></td>
      <td><span class="color-dot" style="background:${row.color}"></span> ${row.name} ${row.isHuman ? '(You)' : ''}</td>
      <td>${row.timeFormatted}</td>
      <td>${row.stuntScore} pts</td>
      <td>${row.praiseCount}</td>
    `;
    resultsBody.appendChild(tr);
  }

  resultsOverlay.classList.remove('hidden');
});

eventQueue.subscribe('GAME_RESET', () => {
  resultsOverlay.classList.add('hidden');
  hudBar.classList.add('hidden');
  lobbyOverlay.classList.remove('hidden');
});

// Event Inspector Log Listener
eventQueue.onLogUpdated = (event) => {
  eventsProcessedCount.textContent = eventQueue.processedCount;
  const li = document.createElement('li');
  if (event.type === 'STUNT_COMPLETED' || event.type === 'BOOST_TRIGGERED') li.classList.add('stunt');
  if (event.type === 'OBSTACLE_HIT') li.classList.add('hazard');

  const payloadPreview = JSON.stringify(event.payload);
  li.innerHTML = `<strong>[${event.type}]</strong> <em>(${event.producer})</em><br/><span>${payloadPreview}</span>`;
  eventLogList.prepend(li);
  if (eventLogList.children.length > 35) {
    eventLogList.removeChild(eventLogList.lastChild);
  }
};

// Initialize default player in lobby
syncHumanEntry();

// Main Simulation Loop: Drains Event Queue -> Updates Physics -> Renders Frame
let lastTimestamp = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
  lastTimestamp = now;

  // 1. Drain incoming events from queue
  eventQueue.drain();

  // 2. Step simulation (which may enqueue new domain events)
  gameEngine.update(dt);

  // 3. Drain domain events generated during physics step
  eventQueue.drain();

  // 4. Update HUD & Render Canvas
  if (gameEngine.state === 'RACING') {
    const sorted = gameEngine.getSortedRacers();
    const humanIdx = sorted.findIndex((r) => r.isHuman);
    const human = sorted[humanIdx];
    if (human) {
      hudLap.textContent = `Lap: ${Math.min(human.lap, gameEngine.totalLaps)} / ${gameEngine.totalLaps}`;
      hudPos.textContent = `Pos: ${humanIdx + 1} / ${sorted.length}`;
      hudTime.textContent = `Time: ${((now - gameEngine.raceStartTime) / 1000).toFixed(1)}s`;
      hudStunts.textContent = `Stunt Pts: ${human.stuntScore}`;
    }
  }

  gameEngine.render();
  requestAnimationFrame(loop);
}
