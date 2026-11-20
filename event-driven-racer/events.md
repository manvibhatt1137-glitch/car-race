# Event Catalog (`events.md`)

All state transitions, player inputs, hardware signals, and gameplay triggers in this application communicate strictly through the central `EventQueue` (`src/eventQueue.js`).

## 1. UI & Lifecycle Events

| Event Name | Producer | Payload Schema | Handler(s) | Description |
| :--- | :--- | :--- | :--- | :--- |
| `LOBBY_JOINED` | `UIProducer` | `{ nickname: string, color: string, laps: number }` | `GameEngine.onLobbyJoined` | Registers the human player's settings and desired lap count. |
| `BOT_ADDED` | `UIProducer` | `{ count: number }` | `GameEngine.onBotAdded` | Fills remaining lobby slots (up to 6 total racers) with AI bots. |
| `RACE_STARTED` | `UIProducer` | `{ totalLaps: number, racerCount: number }` | `GameEngine.onRaceStarted`, `HUDRenderer.onRaceStarted` | Transitions game state from `LOBBY` to `RACING` and resets timers. |
| `RACE_FINISHED` | `GameEngine` | `{ standings: Array<RacerResult> }` | `HUDRenderer.onRaceFinished` | Halts racing physics and renders the final podium scoreboard. |
| `GAME_RESET` | `UIProducer` | `{}` | `GameEngine.onGameReset`, `HUDRenderer.onGameReset` | Returns the application back to the `LOBBY` state. |

## 2. Input & Hardware Events

| Event Name | Producer | Payload Schema | Handler(s) | Description |
| :--- | :--- | :--- | :--- | :--- |
| `INPUT_STEER` | `KeyboardProducer` / `SerialESP32Producer` | `{ value: number }` (`-1.0` to `1.0`) | `GameEngine.onInputSteer` | Sets continuous steering angle for the human player's car. |
| `INPUT_THROTTLE` | `KeyboardProducer` / `SerialESP32Producer` | `{ active: boolean }` | `GameEngine.onInputThrottle` | Engages or releases forward acceleration. |
| `INPUT_BRAKE` | `KeyboardProducer` / `SerialESP32Producer` | `{ active: boolean }` | `GameEngine.onInputBrake` | Engages braking or reverse gear. |
| `INPUT_DRIFT` | `KeyboardProducer` / `SerialESP32Producer` | `{ active: boolean }` | `GameEngine.onInputDrift` | Engages handbrake drift mode (tighter turn radius, builds drift charge). |
| `ESP32_CONNECTED` | `SerialESP32Producer` | `{ portInfo: string }` | `HUDRenderer.onHardwareStatus` | Notifies the UI that a Wokwi/ESP32 serial stream is active. |

## 3. Physics, Track & Stunt Events

| Event Name | Producer | Payload Schema | Handler(s) | Description |
| :--- | :--- | :--- | :--- | :--- |
| `BOOST_TRIGGERED` | `GameEngine` (Collision Detector) | `{ racerId: string, source: 'PAD' \| 'STUNT' }` | `GameEngine.onBoostTriggered`, `HUDRenderer.onVisualEffect` | Grants a temporary top-speed burst and flame particles. |
| `OBSTACLE_HIT` | `GameEngine` (Collision Detector) | `{ racerId: string, type: 'CONE' \| 'OIL' }` | `GameEngine.onObstacleHit`, `HUDRenderer.onVisualEffect` | Knocks away cones or triggers a spin-out penalty on oil slicks. |
| `RAMP_LAUNCHED` | `GameEngine` (Collision Detector) | `{ racerId: string, launchAngle: number }` | `GameEngine.onRampLaunched` | Launches the car airborne, scaling sprite size and shadow offset. |
| `STUNT_COMPLETED` | `GameEngine` (Stunt Evaluator) | `{ racerId: string, stuntType: 'SMOOTH_LANDING' \| 'LONG_DRIFT', points: number, praise: string }` | `GameEngine.onStuntCompleted`, `HUDRenderer.onPraisePopup` | Awards stunt points, triggers praise popup text, and grants mini-boost. |
| `CHECKPOINT_PASSED` | `GameEngine` (Track Monitor) | `{ racerId: string, checkpointIndex: number }` | `GameEngine.onCheckpointPassed` | Validates track progress to prevent lap cheating. |
| `LAP_COMPLETED` | `GameEngine` (Track Monitor) | `{ racerId: string, lap: number, lapTimeMs: number }` | `GameEngine.onLapCompleted`, `HUDRenderer.onLapUpdate` | Increments lap counter and checks if `lap >= totalLaps` to emit `RACE_FINISHED`. |
