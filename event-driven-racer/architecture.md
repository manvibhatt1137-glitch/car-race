# System Architecture (`architecture.md`)

## Overview
This application implements an **Event-Driven Architecture (EDA)** with an explicit local FIFO **Event Queue** (`EventQueue`). Rather than tightly coupling keyboard listeners, serial hardware readers, UI buttons, physics collisions, and HUD rendering, every subsystem acts strictly as an **Event Producer**, an **Event Handler (Consumer)**, or both.

## High-Level Data Flow

```text
+-----------------------+      +-----------------------+      +-----------------------+

|   KeyboardProducer    |      |  SerialESP32Producer  |      |      UIProducer       |
| (DOM keydown/keyup)   |      |  (Web Serial / Wokwi) |      | (Lobby/Reset Buttons) |
+-----------+-----------+      +-----------+-----------+      +-----------+-----------+

            |                              |                              |
            | publish(event)               | publish(event)               | publish(event)
            +------------------------------+------------------------------+
                                           |
                                           v
                    +----------------------------------------------+

                    |              LOCAL EVENT QUEUE               |
                    |          (src/eventQueue.js - FIFO)          |
                    |  - enqueue(type, payload)                    |
                    |  - drain() -> dispatches to subscribers      |
                    |  - maintains recent event log for inspection |
                    +----------------------+-----------------------+
                                           |
                       dispatches events   |   (every tick & immediate UI)
                     +---------------------+---------------------+

                     |                                           |
                     v                                           v
      +-----------------------------+             +-----------------------------+

      |         GameEngine          |             |         HUDRenderer         |
      | (src/gameEngine.js)         |             | (src/main.js)               |
      |                             |             |                             |
      | - Consumes INPUT_* & LOBBY  |             | - Consumes STUNT_COMPLETED  |
      | - Updates car & bot physics |             | - Consumes LAP_COMPLETED    |
      | - Produces collision/stunt  |             | - Consumes RACE_FINISHED    |
      |   events back into Queue    |             | - Renders floating praises  |
      +-----------------------------+             +-----------------------------+
```

## Core Architectural Components

### 1. Event Producers
Producers detect external or internal stimuli and push structured event objects `{ type, payload, timestamp }` onto the `EventQueue` without knowing which modules will react:
* **`KeyboardProducer` (`src/inputProducers.js`):** Listens to browser `keydown` and `keyup` DOM events and translates WASD/Arrow/Spacebar presses into normalized `INPUT_*` events.
* **`SerialESP32Producer` (`src/inputProducers.js`):** Uses the browser Web Serial API (or simulated serial input) to read newline-delimited JSON packets from an ESP32 microcontroller (Wokwi) and emits `INPUT_*` events.
* **`UIProducer` (`src/main.js`):** Captures lobby configuration clicks (lap count, car color, "Fill with Bots", "Start Race") and emits lifecycle events (`LOBBY_JOINED`, `BOT_ADDED`, `RACE_STARTED`).
* **`GameEngine` (`src/gameEngine.js`):** Acts as an internal producer during physics evaluation—emitting `OBSTACLE_HIT`, `BOOST_TRIGGERED`, `RAMP_LAUNCHED`, `STUNT_COMPLETED`, `LAP_COMPLETED`, and `RACE_FINISHED` when geometric thresholds are crossed.

### 2. Local Event Queue (`src/eventQueue.js`)
The `EventQueue` decouples event creation from event processing:
* **Enqueue (`publish`):** Appends incoming events to an in-memory array (`this.queue`) with a monotonic timestamp.
* **Dispatch (`drain`):** Processes queued events in FIFO order, invoking all registered handler callbacks for each `event.type`.
* **Observability (`getHistory`):** Retains the last 25 processed events so developers/evaluators can inspect the live event stream directly in the on-screen Event Inspector panel.

### 3. Event Handlers (Consumers)
Handlers subscribe to specific event types via `eventQueue.subscribe(eventType, handlerFn)`:
* **`GameEngine` Handlers:** Mutate racer control states (`steer`, `throttle`, `brake`, `drift`), apply boost velocities, trigger spin-outs on oil hits, calculate smooth-landing alignment scores, and advance lap counters.
* **`HUDRenderer` Handlers:** React to `STUNT_COMPLETED` by spawning floating praise banners (*"SMOOTH LANDING!"*, *"INSANE DRIFT!"*), update the lap/position HUD on `LAP_COMPLETED`, and display the final podium modal on `RACE_FINISHED`.

## Execution Model (Event Loop + Fixed-Step Simulation)
1. **Asynchronous Ingestion:** Browser DOM events and Web Serial streams push events into `EventQueue` at any moment.
2. **Queue Drain:** At the start of each animation frame (`requestAnimationFrame`), `EventQueue.drain()` flushes all pending events to their subscribed handlers.
3. **Physics & AI Step:** `GameEngine.update(dt)` advances human and AI bot cars, evaluates track triggers (which may enqueue new domain events), and drains any newly generated events before rendering the frame.
