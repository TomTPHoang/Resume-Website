/* =====================================================================
   Game Feel Lab: a single-room platformer with live-tunable physics.
   Fixed 120 Hz simulation, tile collision, coyote time, jump buffering,
   variable jump height, wall slide/jump, dash, squash & stretch,
   particles, screen shake and a debug overlay.
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, $$, esc, store, on, cssVar, reduceMotion } = TH;

    const PARAMS = [
        { id: "gravity",    label: "Gravity",         min: 600, max: 3600, step: 50,   unit: "px/s²", def: 2000, tip: "How quickly you're pulled down." },
        { id: "jumpHeight", label: "Jump height",     min: 24,  max: 150,  step: 2,    unit: "px",    def: 76,   tip: "Peak height of a full jump." },
        { id: "fallMult",   label: "Fall multiplier", min: 1,   max: 3,    step: 0.1,  unit: "×",     def: 1.7,  tip: "Extra gravity on the way down. Higher feels snappier." },
        { id: "runSpeed",   label: "Run speed",       min: 80,  max: 340,  step: 5,    unit: "px/s",  def: 200,  tip: "Top horizontal speed." },
        { id: "accel",      label: "Acceleration",    min: 300, max: 6000, step: 100,  unit: "px/s²", def: 2400, tip: "How fast you reach top speed and stop." },
        { id: "airControl", label: "Air control",     min: 0,   max: 1,    step: 0.05, unit: "%",     def: 0.7,  tip: "How much you can steer mid-air." },
        { id: "coyote",     label: "Coyote time",     min: 0,   max: 250,  step: 5,    unit: "ms",    def: 100,  tip: "Grace period to jump after walking off a ledge." },
        { id: "buffer",     label: "Jump buffer",     min: 0,   max: 250,  step: 5,    unit: "ms",    def: 110,  tip: "Jump pressed slightly before landing still counts." }
    ];
    const TOGGLES = [
        { id: "varJump",   label: "Variable jump height", def: true,  tip: "Let go of jump early for a short hop." },
        { id: "dash",      label: "Dash",                 def: true,  tip: "One air dash, refreshed on landing." },
        { id: "wallJump",  label: "Wall slide & jump",    def: true,  tip: "Slide down walls and kick off them." },
        { id: "squash",    label: "Squash & stretch",     def: true,  tip: "Deform on jumps and landings." },
        { id: "particles", label: "Particles",            def: true,  tip: "Dust, trails and sparkles." },
        { id: "shake",     label: "Screen shake",         def: true,  tip: "Small kick on hard landings and dashes." },
        { id: "debug",     label: "Debug view",           def: false, tip: "Hitbox, velocity, coyote and buffer timers." }
    ];
    const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.id, p.def]));
    const DEFAULT_TOGGLES = Object.fromEntries(TOGGLES.map((t) => [t.id, t.def]));
    const PRESETS = {
        tight:       { name: "Tight",       values: { ...DEFAULTS }, toggles: { varJump: true } },
        floaty:      { name: "Floaty",      values: { ...DEFAULTS, gravity: 900, jumpHeight: 92, fallMult: 1, runSpeed: 170, accel: 800, airControl: 0.5 }, toggles: { varJump: false } },
        heavy:       { name: "Heavy",       values: { ...DEFAULTS, gravity: 3400, jumpHeight: 60, fallMult: 2.4, runSpeed: 230, accel: 5200, airControl: 0.9 }, toggles: { varJump: true } },
        unforgiving: { name: "Unforgiving", values: { ...DEFAULTS, coyote: 0, buffer: 0 }, toggles: { varJump: false } }
    };

    // World: 32 x 18 tiles of 20px = 640 x 360 internal resolution.
    const T = 20, COLS = 32, ROWS = 18, VW = COLS * T, VH = ROWS * T;
    const SHARDS = [[6, 13], [2, 10], [7, 7], [3, 4], [15, 8], [23, 13], [29, 10], [28, 4]];
    const SPAWN = { x: 3 * T + 4, y: 16 * T + 2 };
    const PW = 12, PH = 18;
    const DT = 1 / 120;
    const DASH_SPEED = 430, DASH_TIME = 0.14, WALL_SLIDE_MAX = 90, MAX_FALL = 620;

    function buildLevel() {
        const g = Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) ? 1 : 0));
        const fill = (c0, c1, r0, r1) => {
            for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = 1;
        };
        fill(5, 8, 14, 14); fill(1, 4, 11, 11); fill(5, 8, 8, 8); fill(1, 5, 5, 5);   // left climb
        fill(13, 14, 4, 13); fill(17, 18, 4, 13);                                       // wall-jump shaft
        fill(22, 25, 14, 14); fill(27, 30, 11, 11); fill(22, 25, 8, 8); fill(26, 30, 5, 5); // right climb
        return g;
    }

    function init() {
        const shell = $("#labShell");
        const canvas = $("#labCanvas");
        if (!shell || !canvas) return;
        const ctx = canvas.getContext("2d");
        const overlay = $("#labOverlay");
        const overlayCard = $("#labOverlayCard");
        const hud = { shards: $("#labShards"), time: $("#labTime"), best: $("#labBest") };

        const level = buildLevel();
        const solid = (c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || level[r][c] === 1;

        /* ---------- settings ---------- */
        const saved = store.get("lab-settings", {});
        const P = Object.assign({}, DEFAULTS, saved.values || {});
        const TG = Object.assign({}, DEFAULT_TOGGLES, saved.toggles || {});
        const persist = () => store.set("lab-settings", { values: P, toggles: TG });

        /* ---------- colours ---------- */
        let C = {};
        function readColors() {
            C = {
                bg1: cssVar("--lab-bg1") || "#0f1923",
                bg2: cssVar("--lab-bg2") || "#0a0f15",
                tile: cssVar("--lab-tile") || "#24384f",
                edge: cssVar("--lab-edge") || "#66c0f4",
                player: cssVar("--lab-player") || "#a3cf06",
                shard: cssVar("--lab-shard") || "#7fe3ff",
                accent: cssVar("--accent") || "#66c0f4",
                text: cssVar("--text") || "#c6d4df",
                font: cssVar("--font-head") || "sans-serif"
            };
        }
        readColors();
        on("themechange", () => { readColors(); draw(); });

        /* ---------- game state ---------- */
        const input = { left: false, right: false, jump: false, jumpPressed: false, dashPressed: false };
        let pl, shards, particles, shake, runTime, running, finished, labels, active = false;
        let bufferTimer = 0, bufferAge = 0, coyoteTimer = 0;

        function reset() {
            pl = {
                x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0,
                onGround: true, wall: 0, facing: 1,
                dashT: 0, dashDir: 1, canDash: true, wallLock: 0,
                sx: 1, sy: 1, sliding: false
            };
            shards = SHARDS.map(([c, r], i) => ({ x: c * T + T / 2, y: r * T + T / 2, got: false, phase: i * 0.7 }));
            particles = [];
            shake = 0;
            runTime = 0;
            running = false;
            finished = false;
            labels = [];
            bufferTimer = 0; coyoteTimer = 0;
            updateHUD();
        }

        const bestTime = () => store.get("lab-best", null);
        function updateHUD() {
            const got = shards.filter((s) => s.got).length;
            hud.shards.textContent = `${got}/${shards.length}`;
            hud.time.textContent = runTime.toFixed(2);
            const b = bestTime();
            hud.best.textContent = b ? b.toFixed(2) : "-";
        }

        /* ---------- helpers ---------- */
        const approach = (v, target, amt) => v < target ? Math.min(v + amt, target) : Math.max(v - amt, target);
        function overlapsSolid(x, y, w, h) {
            const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.001) / T);
            const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.001) / T);
            for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) return true;
            return false;
        }
        function puff(x, y, n, spread, color, up = 1) {
            if (!TG.particles) return;
            for (let i = 0; i < n; i++) {
                particles.push({
                    x, y,
                    vx: (Math.random() - 0.5) * spread,
                    vy: -Math.random() * 60 * up,
                    life: 0.35 + Math.random() * 0.25, age: 0,
                    size: 2 + Math.random() * 2, color
                });
            }
        }
        function squash(sx, sy) { if (TG.squash) { pl.sx = sx; pl.sy = sy; } }
        function kick(amount) { if (TG.shake && !reduceMotion) shake = Math.max(shake, amount); }
        function label(text) { labels.push({ text, age: 0 }); if (labels.length > 3) labels.shift(); }

        /* ---------- simulation ---------- */
        function step() {
            const moon = TH.cheats.state.moon;
            const g = P.gravity * (moon ? 0.35 : 1);
            const jumpV = Math.sqrt(2 * g * P.jumpHeight);
            const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
            if (dir) pl.facing = dir;

            if (!running && !finished && (dir || input.jumpPressed || input.dashPressed)) running = true;
            if (running) runTime += DT;

            // Jump buffer + coyote timers
            if (input.jumpPressed) { bufferTimer = Math.max(P.buffer / 1000, DT * 0.5); bufferAge = 0; }
            else { bufferTimer -= DT; bufferAge += DT; }
            if (pl.onGround) coyoteTimer = P.coyote / 1000;
            else coyoteTimer -= DT;
            pl.wallLock -= DT;

            // Dash
            if (input.dashPressed && TG.dash && pl.canDash && pl.dashT <= 0) {
                pl.dashT = DASH_TIME;
                pl.canDash = false;
                pl.dashDir = dir || pl.facing;
                squash(1.4, 0.7);
                kick(3);
                puff(pl.x + PW / 2, pl.y + PH / 2, 10, 160, C.accent, 0.5);
                label("DASH");
            }

            if (pl.dashT > 0) {
                pl.dashT -= DT;
                pl.vx = pl.dashDir * DASH_SPEED;
                pl.vy = 0;
                if (TG.particles && Math.random() < 0.6) {
                    particles.push({ x: pl.x + PW / 2, y: pl.y + PH / 2 + (Math.random() - 0.5) * PH, vx: 0, vy: 0, life: 0.2, age: 0, size: 3, color: C.accent });
                }
            } else {
                // Horizontal movement
                let control = pl.onGround ? 1 : P.airControl;
                if (pl.wallLock > 0) control *= 0.15;
                pl.vx = approach(pl.vx, dir * P.runSpeed, P.accel * Math.max(control, 0.05) * DT);

                // Gravity (heavier when falling, or when jump is released early)
                let grav = g;
                if (pl.vy > 0) grav *= P.fallMult;
                else if (pl.vy < 0 && TG.varJump && !input.jump) grav *= Math.max(2.2, P.fallMult * 1.5);
                pl.vy = Math.min(pl.vy + grav * DT, MAX_FALL);

                // Wall slide
                pl.sliding = TG.wallJump && !pl.onGround && pl.wall !== 0 && dir === pl.wall && pl.vy > 0;
                if (pl.sliding) {
                    pl.vy = Math.min(pl.vy, WALL_SLIDE_MAX);
                    if (TG.particles && Math.random() < 0.25) {
                        particles.push({ x: pl.wall > 0 ? pl.x + PW : pl.x, y: pl.y + PH * 0.3, vx: -pl.wall * 20, vy: -10, life: 0.3, age: 0, size: 2, color: C.edge });
                    }
                }
            }

            // Jump (ground / coyote, then wall)
            if (bufferTimer > 0 && pl.dashT <= 0) {
                if (coyoteTimer > 0) {
                    const coyoteJump = !pl.onGround;
                    const buffered = bufferAge > DT * 1.5;
                    pl.vy = -jumpV;
                    pl.onGround = false;
                    coyoteTimer = 0;
                    bufferTimer = 0;
                    squash(0.7, 1.3);
                    puff(pl.x + PW / 2, pl.y + PH, 6, 120, C.text);
                    if (coyoteJump) label("COYOTE JUMP");
                    else if (buffered) label("BUFFERED JUMP");
                } else if (TG.wallJump && pl.wall !== 0) {
                    pl.vy = -jumpV * 0.92;
                    pl.vx = -pl.wall * P.runSpeed * 1.15;
                    pl.facing = -pl.wall;
                    pl.wallLock = 0.14;
                    bufferTimer = 0;
                    squash(0.75, 1.25);
                    puff(pl.wall > 0 ? pl.x + PW : pl.x, pl.y + PH / 2, 6, 120, C.edge);
                    label("WALL JUMP");
                }
            }

            // Move X
            pl.x += pl.vx * DT;
            if (overlapsSolid(pl.x, pl.y, PW, PH)) {
                if (pl.vx > 0) pl.x = Math.floor((pl.x + PW) / T) * T - PW;
                else if (pl.vx < 0) pl.x = Math.floor(pl.x / T + 1) * T;
                if (pl.dashT > 0) pl.dashT = 0;
                pl.vx = 0;
            }

            // Move Y
            const wasGround = pl.onGround;
            const fallSpeed = pl.vy;
            pl.y += pl.vy * DT;
            if (overlapsSolid(pl.x, pl.y, PW, PH)) {
                if (pl.vy > 0) {
                    pl.y = Math.floor((pl.y + PH) / T) * T - PH;
                } else if (pl.vy < 0) {
                    pl.y = Math.floor(pl.y / T + 1) * T;
                }
                pl.vy = 0;
            }
            pl.onGround = overlapsSolid(pl.x, pl.y + 1, PW, PH) && pl.vy >= 0;
            if (pl.onGround) {
                pl.canDash = true;
                if (!wasGround && fallSpeed > 200) {
                    squash(1.3, 0.72);
                    puff(pl.x + PW / 2, pl.y + PH, Math.min(12, Math.round(fallSpeed / 60)), 160, C.text);
                    if (fallSpeed > 520) kick(4);
                }
            }
            pl.wall = overlapsSolid(pl.x - 1, pl.y, PW, PH) ? -1 : overlapsSolid(pl.x + 1, pl.y, PW, PH) ? 1 : 0;
            if (pl.onGround) pl.wall = 0;

            // Squash recovery
            pl.sx += (1 - pl.sx) * 0.18;
            pl.sy += (1 - pl.sy) * 0.18;

            // Shards
            for (const s of shards) {
                if (s.got) continue;
                const cx = pl.x + PW / 2, cy = pl.y + PH / 2;
                if (Math.abs(cx - s.x) < 12 && Math.abs(cy - s.y) < 14) {
                    s.got = true;
                    puff(s.x, s.y, 14, 220, C.shard, 1.5);
                    kick(2);
                    if (shards.every((x) => x.got)) complete();
                    updateHUD();
                }
            }

            // Safety net
            if (pl.y > VH + 40) { pl.x = SPAWN.x; pl.y = SPAWN.y; pl.vx = pl.vy = 0; }

            // Particles + labels
            for (const p of particles) {
                p.age += DT;
                p.x += p.vx * DT;
                p.y += p.vy * DT;
                p.vy += 200 * DT;
            }
            particles = particles.filter((p) => p.age < p.life);
            labels.forEach((l) => { l.age += DT; });
            labels = labels.filter((l) => l.age < 1.1);
            shake = Math.max(0, shake - DT * 25);

            input.jumpPressed = false;
            input.dashPressed = false;
        }

        function complete() {
            running = false;
            finished = true;
            const cheated = TH.cheats.state.moon;
            const prev = bestTime();
            const isBest = !cheated && (!prev || runTime < prev);
            if (isBest) store.set("lab-best", Number(runTime.toFixed(2)));
            if (!cheated) {
                TH.Ach.unlock("shard-collector");
                if (runTime < 20) TH.Ach.unlock("speedrunner");
            }
            label(isBest ? "NEW BEST!" : "ALL SHARDS!");
            updateHUD();
            setTimeout(() => {
                if (!finished) return;
                overlayCard.innerHTML = `
                    <p class="overlay-kicker">${cheated ? "Moon gravity (not saved)" : isBest ? "New best time" : "Room clear"}</p>
                    <div class="overlay-grade">${runTime.toFixed(2)}s</div>
                    <p class="overlay-text">Try another preset, or tweak a slider and see if it feels faster.</p>
                    <div class="overlay-actions">
                        <button class="btn btn-green" type="button" data-lab="restart"><span class="btn-icon" aria-hidden="true">↻</span> Run it again</button>
                    </div>`;
                overlay.classList.remove("hidden");
            }, 900);
        }

        /* ---------- rendering ---------- */
        let W = 0, H = 0, scale = 1, ox = 0, oy = 0;
        function resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            W = shell.clientWidth;
            H = shell.clientHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            scale = Math.min(W / VW, H / VH);
            ox = (W - VW * scale) / 2;
            oy = (H - VH * scale) / 2;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            draw();
        }

        function draw() {
            if (!pl) return;
            ctx.setTransform(canvas.width / W || 1, 0, 0, canvas.height / H || 1, 0, 0);
            ctx.fillStyle = C.bg2;
            ctx.fillRect(0, 0, W, H);

            ctx.save();
            const sx = shake ? (Math.random() - 0.5) * shake : 0;
            const sy = shake ? (Math.random() - 0.5) * shake : 0;
            ctx.translate(ox + sx * scale, oy + sy * scale);
            ctx.scale(scale, scale);

            // Background
            const bg = ctx.createLinearGradient(0, 0, 0, VH);
            bg.addColorStop(0, C.bg1);
            bg.addColorStop(1, C.bg2);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, VW, VH);
            ctx.strokeStyle = "rgba(255,255,255,0.03)";
            ctx.lineWidth = 1;
            for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * T + 0.5, 0); ctx.lineTo(c * T + 0.5, VH); ctx.stroke(); }
            for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * T + 0.5); ctx.lineTo(VW, r * T + 0.5); ctx.stroke(); }

            // Tiles
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (!level[r][c]) continue;
                    ctx.fillStyle = C.tile;
                    ctx.fillRect(c * T, r * T, T, T);
                    if (!solid(c, r - 1)) {
                        ctx.fillStyle = C.edge;
                        ctx.fillRect(c * T, r * T, T, 2);
                    }
                }
            }

            // Shards
            const now = performance.now() / 1000;
            for (const s of shards) {
                if (s.got) continue;
                const bob = Math.sin(now * 3 + s.phase) * 2.5;
                ctx.save();
                ctx.translate(s.x, s.y + bob);
                ctx.rotate(Math.PI / 4 + Math.sin(now * 2 + s.phase) * 0.2);
                ctx.shadowColor = C.shard;
                ctx.shadowBlur = 12;
                ctx.fillStyle = C.shard;
                ctx.fillRect(-4.5, -4.5, 9, 9);
                ctx.fillStyle = "rgba(255,255,255,0.8)";
                ctx.fillRect(-1.5, -1.5, 3, 3);
                ctx.restore();
            }

            // Particles
            for (const p of particles) {
                ctx.globalAlpha = 1 - p.age / p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.globalAlpha = 1;

            // Player (scaled around the feet)
            const big = TH.cheats.state.bighead;
            ctx.save();
            ctx.translate(pl.x + PW / 2, pl.y + PH);
            ctx.scale(pl.sx, pl.sy);
            ctx.fillStyle = pl.dashT > 0 ? C.accent : C.player;
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = pl.dashT > 0 ? 14 : 6;
            if (big) {
                ctx.fillRect(-PW / 2 + 2, -PH * 0.55, PW - 4, PH * 0.55);
                ctx.fillRect(-PW, -PH * 0.55 - PW * 1.6, PW * 2, PW * 1.6);
            } else {
                ctx.fillRect(-PW / 2, -PH, PW, PH);
            }
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            const eyeY = big ? -PH * 0.55 - PW * 1.0 : -PH * 0.75;
            const eyeX = pl.facing * (big ? 5 : 2.5);
            ctx.fillRect(eyeX - 1, eyeY, 2.5, big ? 4 : 3);
            ctx.restore();

            // Debug overlay
            if (TG.debug) {
                ctx.strokeStyle = "#ff5370";
                ctx.lineWidth = 1;
                ctx.strokeRect(pl.x + 0.5, pl.y + 0.5, PW - 1, PH - 1);
                ctx.strokeStyle = "#ffcb6b";
                ctx.beginPath();
                ctx.moveTo(pl.x + PW / 2, pl.y + PH / 2);
                ctx.lineTo(pl.x + PW / 2 + pl.vx * 0.08, pl.y + PH / 2 + pl.vy * 0.08);
                ctx.stroke();
                if (pl.wall) {
                    ctx.fillStyle = "rgba(255,83,112,0.6)";
                    ctx.fillRect(pl.wall > 0 ? pl.x + PW : pl.x - 2, pl.y, 2, PH);
                }
            }

            // Floating labels (coyote / buffered / wall jump)
            ctx.textAlign = "center";
            ctx.font = `700 11px ${C.font}`;
            labels.forEach((l, i) => {
                ctx.globalAlpha = Math.max(0, 1 - l.age / 1.1);
                ctx.fillStyle = C.accent;
                ctx.fillText(l.text, pl.x + PW / 2, pl.y - 10 - l.age * 18 - i * 11);
            });
            ctx.globalAlpha = 1;
            ctx.restore();

            if (TG.debug) drawDebugPanel();
        }

        function drawDebugPanel() {
            const lines = [
                ["vx", pl.vx.toFixed(0)],
                ["vy", pl.vy.toFixed(0)],
                ["ground", pl.onGround ? "yes" : "no"],
                ["wall", pl.wall === 0 ? "-" : pl.wall < 0 ? "left" : "right"],
                ["dash", pl.canDash ? "ready" : "used"]
            ];
            const x = W - 156, y = 54;
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillRect(x, y, 146, 128);
            ctx.font = "11px ui-monospace, Consolas, monospace";
            ctx.textAlign = "left";
            lines.forEach(([k, v], i) => {
                ctx.fillStyle = "rgba(255,255,255,0.55)";
                ctx.fillText(k, x + 8, y + 16 + i * 14);
                ctx.fillStyle = "#fff";
                ctx.fillText(v, x + 64, y + 16 + i * 14);
            });
            const bar = (label, value, max, row, color) => {
                const by = y + 16 + row * 14;
                ctx.fillStyle = "rgba(255,255,255,0.55)";
                ctx.fillText(label, x + 8, by);
                ctx.fillStyle = "rgba(255,255,255,0.12)";
                ctx.fillRect(x + 64, by - 8, 72, 8);
                ctx.fillStyle = color;
                ctx.fillRect(x + 64, by - 8, 72 * Math.max(0, Math.min(1, max ? value / max : 0)), 8);
            };
            bar("coyote", Math.max(0, coyoteTimer), P.coyote / 1000, 5.3, "#c3e88d");
            bar("buffer", Math.max(0, bufferTimer), P.buffer / 1000, 6.5, "#82aaff");
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillText("120 Hz fixed step", x + 8, y + 122);
        }

        /* ---------- loop ---------- */
        let acc = 0, last = 0, looping = false;
        function frame(now) {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            acc += dt;
            while (acc >= DT) { step(); acc -= DT; }
            if (running) updateHUD();
            draw();
            if (active) requestAnimationFrame(frame);
            else looping = false;
        }
        function startLoop() {
            if (looping) return;
            looping = true;
            last = performance.now();
            acc = 0;
            requestAnimationFrame(frame);
        }

        function activate() {
            active = true;
            overlay.classList.add("hidden");
            if (document.activeElement !== shell) shell.focus({ preventScroll: true });
            startLoop();
        }
        function deactivate() {
            if (!active) return;
            active = false;
            Object.assign(input, { left: false, right: false, jump: false });
            if (!finished) {
                overlayCard.innerHTML = `
                    <p class="overlay-kicker">Paused</p>
                    <h3 class="overlay-title">Click to resume</h3>
                    <p class="overlay-text">The lab pauses when it loses focus so it doesn't steal your keys.</p>
                    <div class="overlay-actions">
                        <button class="btn btn-green" type="button" data-lab="resume"><span class="btn-icon" aria-hidden="true">▶</span> Resume</button>
                        <button class="btn btn-ghost" type="button" data-lab="restart">Restart</button>
                    </div>`;
                overlay.classList.remove("hidden");
            }
        }

        overlay.addEventListener("click", (e) => {
            const b = e.target.closest("[data-lab], #labStart");
            if (!b) return;
            if (b.dataset.lab === "restart") reset();
            activate();
        });
        shell.addEventListener("focusout", (e) => {
            if (!shell.contains(e.relatedTarget)) deactivate();
        });
        shell.addEventListener("pointerdown", (e) => {
            if (!active && !e.target.closest("button")) activate();
        });

        /* ---------- input ---------- */
        const KEYMAP = {
            ArrowLeft: "left", a: "left", A: "left",
            ArrowRight: "right", d: "right", D: "right",
            " ": "jump", ArrowUp: "jump", w: "jump", W: "jump", z: "jump", Z: "jump",
            Shift: "dash", x: "dash", X: "dash", c: "dash", C: "dash"
        };
        function setKey(action, down) {
            if (action === "jump") {
                if (down && !input.jump) input.jumpPressed = true;
                input.jump = down;
            } else if (action === "dash") {
                if (down) input.dashPressed = true;
            } else {
                input[action] = down;
            }
        }
        shell.addEventListener("keydown", (e) => {
            if (!active) {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
                return;
            }
            if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); overlay.classList.add("hidden"); return; }
            if (e.key === "Escape") { shell.blur(); return; }
            const action = KEYMAP[e.key];
            if (!action) return;
            e.preventDefault();
            if (e.repeat && action !== "left" && action !== "right") return;
            setKey(action, true);
        });
        shell.addEventListener("keyup", (e) => {
            const action = KEYMAP[e.key];
            if (action) setKey(action, false);
        });

        // Touch pad
        $$("#labTouch button").forEach((b) => {
            b.tabIndex = -1;
            const down = (e) => {
                e.preventDefault();
                if (!active) activate();
                try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                b.classList.add("pressed");
                setKey(b.dataset.k, true);
            };
            const up = () => { b.classList.remove("pressed"); setKey(b.dataset.k, false); };
            b.addEventListener("pointerdown", down);
            b.addEventListener("pointerup", up);
            b.addEventListener("pointercancel", up);
            b.addEventListener("contextmenu", (e) => e.preventDefault());
        });

        /* ---------- settings panel ---------- */
        const fmt = (p, v) => p.unit === "%" ? Math.round(v * 100) + "%" : (p.step < 1 ? Number(v).toFixed(1) : Math.round(v)) + (p.unit === "×" ? "×" : " " + p.unit);

        function renderPanel() {
            $("#labPresets").innerHTML = Object.entries(PRESETS).map(([id, pr]) =>
                `<button type="button" class="chip" data-preset="${id}" aria-pressed="false">${esc(pr.name)}</button>`).join("");
            $("#labSliders").innerHTML = PARAMS.map((p) => `
                <label class="slider" title="${esc(p.tip)}">
                    <span class="slider-top"><span>${esc(p.label)}</span><output data-out="${p.id}">${fmt(p, P[p.id])}</output></span>
                    <input type="range" data-param="${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.id]}">
                    <small>${esc(p.tip)}</small>
                </label>`).join("");
            $("#labToggles").innerHTML = TOGGLES.map((t) => `
                <label class="toggle">
                    <input type="checkbox" data-toggle="${t.id}" ${TG[t.id] ? "checked" : ""}>
                    <span class="toggle-ui" aria-hidden="true"></span>
                    <span class="toggle-text"><b>${esc(t.label)}</b><small>${esc(t.tip)}</small></span>
                </label>`).join("");
            markPreset();
        }

        function markPreset() {
            const match = Object.entries(PRESETS).find(([, pr]) =>
                PARAMS.every((p) => Math.abs(pr.values[p.id] - P[p.id]) < 1e-6) &&
                Object.entries(pr.toggles).every(([k, v]) => TG[k] === v));
            $$("#labPresets [data-preset]").forEach((b) => {
                const on = !!match && match[0] === b.dataset.preset;
                b.classList.toggle("active", on);
                b.setAttribute("aria-pressed", String(on));
            });
        }

        function syncInputs() {
            PARAMS.forEach((p) => {
                const input = $(`[data-param="${p.id}"]`);
                if (input) input.value = P[p.id];
                const out = $(`[data-out="${p.id}"]`);
                if (out) out.textContent = fmt(p, P[p.id]);
            });
            TOGGLES.forEach((t) => {
                const box = $(`[data-toggle="${t.id}"]`);
                if (box) box.checked = TG[t.id];
            });
            markPreset();
        }

        $("#labSliders").addEventListener("input", (e) => {
            const id = e.target.dataset.param;
            if (!id) return;
            P[id] = Number(e.target.value);
            const p = PARAMS.find((x) => x.id === id);
            $(`[data-out="${id}"]`).textContent = fmt(p, P[id]);
            markPreset();
            persist();
            TH.Ach.unlock("feel-engineer");
        });
        $("#labToggles").addEventListener("change", (e) => {
            const id = e.target.dataset.toggle;
            if (!id) return;
            TG[id] = e.target.checked;
            markPreset();
            persist();
            if (!active) draw();
        });
        $("#labPresets").addEventListener("click", (e) => {
            const b = e.target.closest("[data-preset]");
            if (!b) return;
            const pr = PRESETS[b.dataset.preset];
            Object.assign(P, pr.values);
            Object.assign(TG, pr.toggles);
            syncInputs();
            persist();
        });

        on("cheat", () => { if (!active) draw(); });

        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(shell);
        else window.addEventListener("resize", resize);

        reset();
        renderPanel();
        resize();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    }

    TH.modules.push(["feel-lab", init]);
})();
