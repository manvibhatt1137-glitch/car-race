/**
 * Core Game Engine & Physics Simulation
 * Acts as both an Event Handler (for inputs/lifecycle) and Event Producer (for collisions/stunts/laps).
 */
export class GameEngine {
  constructor(canvas, eventQueue) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.eventQueue = eventQueue;

    this.state = 'LOBBY'; // 'LOBBY' | 'RACING' | 'FINISHED'
    this.totalLaps = 3;
    this.raceStartTime = 0;

    // Closed-loop waypoints defining the circuit curves
    this.waypoints = [
      { x: 450, y: 105 }, // Start/Finish straight
      { x: 740, y: 105 }, // Top-right entry
      { x: 800, y: 210 }, // Hairpin top
      { x: 760, y: 470 }, // Bottom-right sweep
      { x: 540, y: 500 }, // Chicane 1
      { x: 440, y: 360 }, // Inner curve apex
      { x: 310, y: 495 }, // Bottom-left sweep
      { x: 120, y: 465 }, // Left straight entry
      { x: 110, y: 190 }, // Top-left curve
      { x: 220, y: 105 }  // Final corner onto straight
    ];

    this.trackWidth = 96;

    // Interactive Track Features
    this.boostPads = [
      { x: 320, y: 105, angle: 0, radius: 22 },
      { x: 640, y: 485, angle: Math.PI, radius: 22 },
      { x: 112, y: 330, angle: -Math.PI / 2, radius: 22 }
    ];

    this.jumpRamps = [
      { x: 580, y: 105, angle: 0, radius: 24 },
      { x: 115, y: 250, angle: -Math.PI / 2, radius: 24 }
    ];

    this.oilSlicks = [
      { x: 785, y: 330, radius: 18 },
      { x: 435, y: 365, radius: 18 }
    ];

    this.initialCones = [
      { x: 710, y: 135 },
      { x: 500, y: 470 },
      { x: 260, y: 475 },
      { x: 145, y: 160 }
    ];

    this.cones = [];
    this.racers = [];
    this.popups = [];

    this._registerHandlers();
    this.resetCones();
  }

  _registerHandlers() {
    this.eventQueue.subscribe('INPUT_STEER', ({ value }) => {
      const human = this.racers.find((r) => r.isHuman);
      if (human) human.controls.steer = value;
    });

    this.eventQueue.subscribe('INPUT_THROTTLE', ({ active }) => {
      const human = this.racers.find((r) => r.isHuman);
      if (human) human.controls.throttle = active;
    });

    this.eventQueue.subscribe('INPUT_BRAKE', ({ active }) => {
      const human = this.racers.find((r) => r.isHuman);
      if (human) human.controls.brake = active;
    });

    this.eventQueue.subscribe('INPUT_DRIFT', ({ active }) => {
      const human = this.racers.find((r) => r.isHuman);
      if (human) human.controls.drift = active;
    });

    this.eventQueue.subscribe('RACE_STARTED', ({ totalLaps, roster }) => {
      this.totalLaps = totalLaps;
      this.resetCones();
      this.popups = [];
      this.racers = roster.map((entry, idx) => this._createRacer(entry, idx));
      this.raceStartTime = performance.now();
      this.state = 'RACING';
    });

    this.eventQueue.subscribe('GAME_RESET', () => {
      this.state = 'LOBBY';
      this.popups = [];
    });

    this.eventQueue.subscribe('BOOST_TRIGGERED', ({ racerId }) => {
      const racer = this.racers.find((r) => r.id === racerId);
      if (racer) {
        racer.boostTimer = 1.4;
      }
    });

    this.eventQueue.subscribe('OBSTACLE_HIT', ({ racerId, type }) => {
      const racer = this.racers.find((r) => r.id === racerId);
      if (!racer) return;
      if (type === 'OIL' && racer.spinTimer <= 0) {
        racer.spinTimer = 0.85;
        racer.speed *= 0.55;
      }
    });

    this.eventQueue.subscribe('RAMP_LAUNCHED', ({ racerId }) => {
      const racer = this.racers.find((r) => r.id === racerId);
      if (racer && racer.airTimer <= 0) {
        racer.airTimer = 0.75;
        racer.launchAngle = racer.angle;
      }
    });

    this.eventQueue.subscribe('STUNT_COMPLETED', ({ racerId, points, praise }) => {
      const racer = this.racers.find((r) => r.id === racerId);
      if (!racer) return;
      racer.stuntScore += points;
      racer.praiseCount += 1;
      racer.boostTimer = Math.max(racer.boostTimer, 0.8);

      if (racer.isHuman) {
        this.popups.push({
          text: `${praise} +${points}`,
          x: racer.x,
          y: racer.y - 25,
          life: 1.5
        });
      }
    });
  }

  _createRacer(entry, gridIndex) {
    const row = Math.floor(gridIndex / 2);
    const col = gridIndex % 2;
    return {
      id: entry.id,
      name: entry.name,
      color: entry.color,
      isHuman: entry.isHuman,
      x: 420 - row * 38,
      y: 88 + col * 34,
      angle: 0,
      speed: 0,
      lap: 1,
      nextWaypoint: 1,
      checkpointsHit: new Set(),
      finished: false,
      finishTimeMs: 0,
      stuntScore: 0,
      praiseCount: 0,
      boostTimer: 0,
      spinTimer: 0,
      airTimer: 0,
      launchAngle: 0,
      driftDuration: 0,
      featureCooldown: 0,
      controls: { steer: 0, throttle: false, brake: false, drift: false },
      aiMaxSpeed: 215 + (gridIndex % 3) * 14
    };
  }

  resetCones() {
    this.cones = this.initialCones.map((c) => ({ x: c.x, y: c.y, vx: 0, vy: 0 }));
  }

  update(dt) {
    if (this.state !== 'RACING') return;

    const now = performance.now();

    // Update cones
    for (const cone of this.cones) {
      cone.x += cone.vx * dt;
      cone.y += cone.vy * dt;
      cone.vx *= 0.9;
      cone.vy *= 0.9;
    }

    // Update floating stunt popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].y -= 28 * dt;
      this.popups[i].life -= dt;
      if (this.popups[i].life <= 0) this.popups.splice(i, 1);
    }

    for (const racer of this.racers) {
      if (racer.featureCooldown > 0) racer.featureCooldown -= dt;

      // AI bot control producer
      if (!racer.isHuman || racer.finished) {
        this._updateBotControls(racer);
      }

      this._updateRacerPhysics(racer, dt, now);
      this._checkTrackTriggers(racer, now);
    }
  }

  _updateBotControls(racer) {
    const target = this.waypoints[racer.nextWaypoint];
    const desiredAngle = Math.atan2(target.y - racer.y, target.x - racer.x);
    let diff = desiredAngle - racer.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    racer.controls.steer = Math.max(-1, Math.min(1, diff * 2.4));
    racer.controls.throttle = true;
    racer.controls.brake = Math.abs(diff) > 1.2 && racer.speed > 140;
    racer.controls.drift = Math.abs(diff) > 0.75 && racer.speed > 160;
  }

  _updateRacerPhysics(racer, dt) {
    const maxBaseSpeed = racer.isHuman ? 255 : racer.aiMaxSpeed;
    const boostBonus = racer.boostTimer > 0 ? 115 : 0;
    const onRoad = this._isPointOnTrack(racer.x, racer.y);
    const surfaceMultiplier = onRoad || racer.airTimer > 0 ? 1.0 : 0.62;

    if (racer.boostTimer > 0) racer.boostTimer -= dt;

    // Handle oil spin-out state
    if (racer.spinTimer > 0) {
      racer.spinTimer -= dt;
      racer.angle += 9.5 * dt;
      racer.x += Math.cos(racer.angle) * racer.speed * dt;
      racer.y += Math.sin(racer.angle) * racer.speed * dt;
      return;
    }

    // Acceleration & Braking
    if (racer.controls.throttle) {
      racer.speed += 290 * dt;
    } else if (racer.controls.brake) {
      racer.speed -= 340 * dt;
    } else {
      racer.speed *= 0.96;
    }

    const effectiveTopSpeed = (maxBaseSpeed + boostBonus) * surfaceMultiplier;
    racer.speed = Math.max(-90, Math.min(effectiveTopSpeed, racer.speed));

    // Steering & Drifting
    const turnRate = racer.controls.drift ? 3.8 : 2.7;
    if (Math.abs(racer.speed) > 15) {
      const dir = racer.speed >= 0 ? 1 : -1;
      racer.angle += racer.controls.steer * turnRate * dir * dt;
    }

    // Track continuous drift for stunt praise
    if (racer.controls.drift && Math.abs(racer.controls.steer) > 0.4 && racer.speed > 150 && racer.airTimer <= 0) {
      racer.driftDuration += dt;
    } else {
      if (racer.driftDuration >= 1.1) {
        this.eventQueue.publish(
          'STUNT_COMPLETED',
          {
            racerId: racer.id,
            stuntType: 'LONG_DRIFT',
            points: Math.round(racer.driftDuration * 100),
            praise: 'INSANE DRIFT!'
          },
          'GameEngine'
        );
      }
      racer.driftDuration = 0;
    }

    // Handle Jump Ramp Airtime & Smooth Landing Evaluation
    if (racer.airTimer > 0) {
      racer.airTimer -= dt;
      if (racer.airTimer <= 0) {
        // Evaluate landing alignment against track direction
        const target = this.waypoints[racer.nextWaypoint];
        const trackAngle = Math.atan2(target.y - racer.y, target.x - racer.x);
        let angleDiff = Math.abs(trackAngle - racer.angle);
        while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

        if (angleDiff < 0.45) {
          this.eventQueue.publish(
            'STUNT_COMPLETED',
            {
              racerId: racer.id,
              stuntType: 'SMOOTH_LANDING',
              points: 150,
              praise: 'SMOOTH LANDING!'
            },
            'GameEngine'
          );
        }
      }
    }

    // Integrate position & keep within arena bounds
    racer.x = Math.max(30, Math.min(this.canvas.width - 30, racer.x + Math.cos(racer.angle) * racer.speed * dt));
    racer.y = Math.max(30, Math.min(this.canvas.height - 30, racer.y + Math.sin(racer.angle) * racer.speed * dt));
  }

  _checkTrackTriggers(racer, now) {
    // 1. Waypoint & Lap progression
    const wp = this.waypoints[racer.nextWaypoint];
    if (Math.hypot(wp.x - racer.x, wp.y - racer.y) < 62) {
      racer.checkpointsHit.add(racer.nextWaypoint);
      this.eventQueue.publish(
        'CHECKPOINT_PASSED',
        { racerId: racer.id, checkpointIndex: racer.nextWaypoint },
        'GameEngine'
      );

      racer.nextWaypoint = (racer.nextWaypoint + 1) % this.waypoints.length;

      // Completed full lap when returning to waypoint 1 after hitting majority of checkpoints
      if (racer.nextWaypoint === 1 && racer.checkpointsHit.size >= this.waypoints.length - 2) 
racer.checkpointsHit.clear();
const elapsed = now - this.raceStartTime;
this.eventQueue.publish(
'LAP_COMPLETED',
{ racerId: racer.id, lap: racer.lap, lapTimeMs: elapsed },
'GameEngine'
);
if (racer.lap >= this.totalLaps && !racer.finished) {
racer.finished = true;
racer.finishTimeMs = elapsed;
// End race immediately when human finishes OR all racers finish
if (racer.isHuman || this.racers.every((r) => r.finished)) {
this._finalizeRace(now);
}
} else {
racer.lap += 1;
}
}
}
if (racer.airTimer > 0 || racer.featureCooldown > 0) return;
// 2. Boost Pads
for (const pad of this.boostPads) {
if (Math.hypot(pad.x - racer.x, pad.y - racer.y) < pad.radius) {
racer.featureCooldown = 0.5;
this.eventQueue.publish('BOOST_TRIGGERED', { racerId: racer.id, source: 'PAD' }, 'GameEngine');
}
}
// 3. Jump Ramps
for (const ramp of this.jumpRamps) {
if (Math.hypot(ramp.x - racer.x, ramp.y - racer.y) < ramp.radius) {
racer.featureCooldown = 0.9;
this.eventQueue.publish('RAMP_LAUNCHED', { racerId: racer.id, launchAngle: racer.angle }, 'GameEngine');
}
}
// 4. Oil Slicks
for (const oil of this.oilSlicks) {
if (Math.hypot(oil.x - racer.x, oil.y - racer.y) < oil.radius) {
racer.featureCooldown = 1.2;
this.eventQueue.publish('OBSTACLE_HIT', { racerId: racer.id, type: 'OIL' }, 'GameEngine');
}
}
// 5. Traffic Cones
for (const cone of this.cones) {
const dist = Math.hypot(cone.x - racer.x, cone.y - racer.y);
if (dist < 18) {
const pushAngle = Math.atan2(cone.y - racer.y, cone.x - racer.x);
cone.vx = Math.cos(pushAngle) * 260;
cone.vy = Math.sin(pushAngle) * 260;
racer.featureCooldown = 0.35;
this.eventQueue.publish('OBSTACLE_HIT', { racerId: racer.id, type: 'CONE' }, 'GameEngine');
}
}
}
_finalizeRace(now) {
if (this.state === 'FINISHED') return;
this.state = 'FINISHED';
// Estimate finish times for bots still on track based on progress
const standings = [...this.racers]
.sort((a, b) => {
if (a.finished && b.finished) return a.finishTimeMs - b.finishTimeMs;
if (a.finished) return -1;
if (b.finished) return 1;
if (b.lap !== a.lap) return b.lap - a.lap;
return b.nextWaypoint - a.nextWaypoint;
})
.map((r, index) => ({
rank: index + 1,
name: r.name,
color: r.color,
isHuman: r.isHuman,
timeFormatted: r.finished
? ${(r.finishTimeMs / 1000).toFixed(2)}s
: +${((now - this.raceStartTime) / 1000 + index * 1.4).toFixed(2)}s,
stuntScore: r.stuntScore,
praiseCount: r.praiseCount
}));
this.eventQueue.publish('RACE_FINISHED', { standings }, 'GameEngine');
}
_isPointOnTrack(x, y) {
for (let i = 0; i < this.waypoints.length; i++) {
const a = this.waypoints[i];
const b = this.waypoints[(i + 1) % this.waypoints.length];
const abx = b.x - a.x;
const aby = b.y - a.y;
const lenSq = abx * abx + aby * aby;
const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / lenSq));
const projX = a.x + t * abx;
const projY = a.y + t * aby;
if (Math.hypot(x - projX, y - projY) <= this.trackWidth * 0.62) {
return true;
}
}
return false;
}
getSortedRacers() {
return [...this.racers].sort((a, b) => {
if (b.lap !== a.lap) return b.lap - a.lap;
return b.nextWaypoint - a.nextWaypoint;
});
}
render() {
const ctx = this.ctx;
ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
// Grass background
ctx.fillStyle = '#14532d';
ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
// Draw Rumble Border
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.beginPath();
this.waypoints.forEach((wp, i) => (i === 0 ? ctx.moveTo(wp.x, wp.y) : ctx.lineTo(wp.x, wp.y)));
ctx.closePath();
ctx.strokeStyle = '#ef4444';
ctx.lineWidth = this.trackWidth + 14;
ctx.stroke();
ctx.setLineDash([18, 18]);
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = this.trackWidth + 14;
ctx.stroke();
ctx.setLineDash([]);
// Draw Asphalt
ctx.strokeStyle = '#1e293b';
ctx.lineWidth = this.trackWidth;
ctx.stroke();
// Center dashed line
ctx.setLineDash([14, 18]);
ctx.strokeStyle = 'rgba(255,255,255,0.22)';
ctx.lineWidth = 2;
ctx.stroke();
ctx.setLineDash([]);
// Start/Finish Line
ctx.fillStyle = '#ffffff';
ctx.fillRect(446, 57, 8, this.trackWidth);
// Boost Pads
for (const pad of this.boostPads) {
ctx.save();
ctx.translate(pad.x, pad.y);
ctx.rotate(pad.angle);
ctx.fillStyle = '#06b6d4';
ctx.fillRect(-16, -12, 32, 24);
ctx.fillStyle = '#fef08a';
ctx.beginPath();
ctx.moveTo(-6, -8);
ctx.lineTo(10, 0);
ctx.lineTo(-6, 8);
ctx.fill();
ctx.restore();
}
// Jump Ramps
for (const ramp of this.jumpRamps) {
ctx.save();
ctx.translate(ramp.x, ramp.y);
ctx.rotate(ramp.angle);
ctx.fillStyle = '#f59e0b';
ctx.fillRect(-18, -15, 36, 30);
ctx.fillStyle = '#78350f';
ctx.fillRect(-18, -15, 8, 30);
ctx.restore();
}
// Oil Slicks
for (const oil of this.oilSlicks) {
ctx.fillStyle = '#090d16';
ctx.beginPath();
ctx.arc(oil.x, oil.y, oil.radius, 0, Math.PI * 2);
ctx.fill();
}
// Cones
for (const cone of this.cones) {
ctx.fillStyle = '#f97316';
ctx.beginPath();
ctx.arc(cone.x, cone.y, 6, 0, Math.PI * 2);
ctx.fill();
}
// Racers
for (const racer of this.racers) {
const airScale = racer.airTimer > 0 ? 1 + Math.sin((racer.airTimer / 0.75) * Math.PI) * 0.42 : 1;
ctx.save();
ctx.translate(racer.x, racer.y);
// Drop shadow when airborne
if (racer.airTimer > 0) {
ctx.fillStyle = 'rgba(0,0,0,0.45)';
ctx.fillRect(-12, 6, 28, 16);
}
ctx.rotate(racer.angle);
ctx.scale(airScale, airScale);
// Boost flame
if (racer.boostTimer > 0) {
ctx.fillStyle = '#fb923c';
ctx.beginPath();
ctx.moveTo(-16, -5);
ctx.lineTo(-28 - Math.random() * 8, 0);
ctx.lineTo(-16, 5);
ctx.fill();
}
// Car chassis
ctx.fillStyle = racer.color;
ctx.beginPath();
ctx.roundRect(-16, -9, 32, 18, 4);
ctx.fill();
// Windshield
ctx.fillStyle = '#0f172a';
ctx.fillRect(2, -6, 7, 12);
ctx.restore();
// Name tag
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 11px sans-serif';
ctx.textAlign = 'center';
ctx.fillText(racer.name, racer.x, racer.y - 18);
}
// Floating Stunt Praise Popups
for (const p of this.popups) {
ctx.save();
ctx.fillStyle = '#fde047';
ctx.strokeStyle = '#000';
ctx.lineWidth = 3;
ctx.font = '900 16px sans-serif';
ctx.textAlign = 'center';
ctx.strokeText(p.text, p.x, p.y);
ctx.fillText(p.text, p.x, p.y);
ctx.restore();
}
}
}

---


requestAnimationFrame(loop);
