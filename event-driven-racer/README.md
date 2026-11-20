# Event-Driven 6-Player Arcade Racer (Keyboard + Wokwi ESP32)

A local, browser-based 2D arcade racing game built specifically to demonstrate **Event-Driven Programming** using an explicit FIFO **Event Queue**, decoupled **Event Producers**, and **Event Handlers**.

## Features
- **Local Multiplayer Lobby (Up to 6 Racers):** Configure your nickname, car color, and lap count (1, 3, 5, or 7 laps), and fill remaining slots with AI bots.
- **Track Hazards & Stunts:** Winding circuit with rumble strips, speed boost pads, destructible cones, spin-out oil slicks, and jump ramps.
- **Stunt & Praise System:** Perform long drifts or land straight off jump ramps to trigger floating arcade praises (*"SMOOTH LANDING!"*, *"INSANE DRIFT!"*), bonus points, and mini-boosts.
- **Dual Input Producers:** Control your car via **Computer Keyboard** (`WASD` / `Arrows` + `Space` to drift) or an **ESP32 Controller** (via Web Serial / Wokwi).
- **Live Event Queue Inspector:** Built-in UI panel showing real-time events flowing through the local `EventQueue`.

---

## How to Start the Application

Because the app uses standard ES Modules (`type="module"`), serve the repository folder using any lightweight local static server (no `npm install` or external dependencies required):

### Option A: Using Python (Pre-installed on macOS/Linux & most Windows setups)
1. Open a terminal in the repository root folder (`event-driven-racer/`).
2. Run:
   ```bash
   python3 -m http.server 8080
   ```
   *(On Windows, use `python -m http.server 8080` if `python3` is not recognized.)*
3. Open your browser (Chrome or Edge recommended for Web Serial support) and go to:
   ```text
   http://localhost:8080
   ```

### Option B: Using VS Code Live Server
1. Open the repository folder in **Visual Studio Code**.
2. Right-click `index.html` and select **"Open with Live Server"**.

### Option C: Using Node.js (`npx`)
```bash
npx serve .
```

---

## How to Play
1. **Lobby Setup:** Enter your nickname, pick a car color, and select the number of laps (`1`, `3`, `5`, or `7`).
2. **Add Bots:** Click **"Fill Lobby with Bots (6 Racers)"** (or add bots individually).
3. **Start Race:** Click **"Start Race"**.
4. **Controls:**
   - **Accelerate:** `W` or `Up Arrow`
   - **Brake / Reverse:** `S` or `Down Arrow`
   - **Steer Left / Right:** `A` / `D` or `Left` / `Right Arrow`
   - **Drift / Handbrake:** `Spacebar`
5. **Finish:** Complete the chosen number of laps to trigger the `RACE_FINISHED` event and view the final podium scoreboard.

---

## Connecting the Wokwi ESP32 Controller (Optional)
1. Open [Wokwi](https://wokwi.com) and create a new **ESP32** project using the files in `esp32-wokwi/diagram.json` and `esp32-wokwi/sketch.ino`.
2. Start the Wokwi simulation. (If running Wokwi in the browser, you can bridge Wokwi's virtual serial port to a local virtual COM port via Wokwi RFC2217 / `pyserial`, or connect a physical ESP32 via USB).
3. In the game lobby, click **"Connect ESP32 (Web Serial)"** and select the serial port. Incoming JSON lines (`{"steer":0.5,"throttle":1,"brake":0,"drift":0}`) will immediately publish `INPUT_*` events into the `EventQueue`.
