/* =====================================================================
   Playground: four small tools in tabs
   #34 Pathfinding visualizer · #35 Particle editor
   #36 Shader playground (WebGL) · #37 Input-lag tester
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, $$, esc, store, on, cssVar, reduceMotion } = TH;

    const theme = () => ({
        accent: cssVar("--accent") || "#66c0f4",
        text: cssVar("--text") || "#c6d4df",
        muted: cssVar("--muted") || "#8f98a0",
        danger: cssVar("--danger") || "#ff7b7b",
        bg: cssVar("--game-bg") || "#0b0f15",
        lane2: cssVar("--lane-2") || "#a3cf06",
        lane3: cssVar("--lane-3") || "#c58af9",
        tile: cssVar("--lab-tile") || "#22374d"
    });
    const hexA = (c, a) => {
        if (!c || c[0] !== "#") return c;
        const n = parseInt(c.slice(1), 16);
        return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    function fitCanvas(cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = cv.clientWidth, h = cv.clientHeight;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, w, h };
    }

    /* ================================================================
       Tabs
       ================================================================ */
    const tools = {};
    function initTabs() {
        const tabs = $$(".pg-tabs [role=tab]");
        function select(tab, focus) {
            tabs.forEach((t) => {
                const on = t === tab;
                t.setAttribute("aria-selected", String(on));
                t.tabIndex = on ? 0 : -1;
                const panel = document.getElementById(t.getAttribute("aria-controls"));
                panel.hidden = !on;
                if (on) panel.classList.add("visible");
                const key = t.id.replace("pgTab-", "");
                if (tools[key]) tools[key][on ? "show" : "hide"]();
            });
            if (focus) tab.focus();
        }
        tabs.forEach((t) => t.addEventListener("click", () => select(t)));
        $(".pg-tabs").addEventListener("keydown", (e) => {
            const i = tabs.indexOf(document.activeElement);
            if (i < 0) return;
            if (e.key === "ArrowRight") { e.preventDefault(); select(tabs[(i + 1) % tabs.length], true); }
            if (e.key === "ArrowLeft") { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length], true); }
        });
        select(tabs[0]);
    }

    /* ================================================================
       #34 Pathfinding
       ================================================================ */
    function initPath() {
        const panel = $("#pg-path");
        panel.innerHTML = `
            <div class="pg-toolbar">
                <label class="mini-select"><span>Algorithm</span>
                    <select id="pfAlgo"><option value="astar">A*</option><option value="dijkstra">Dijkstra</option><option value="bfs">Breadth-first</option><option value="greedy">Greedy best-first</option></select></label>
                <label class="mini-select"><span>Speed</span>
                    <select id="pfSpeed"><option value="1">Slow</option><option value="4" selected>Normal</option><option value="20">Fast</option><option value="0">Instant</option></select></label>
                <button type="button" class="btn btn-green btn-sm" id="pfRun">▶ Find path</button>
                <button type="button" class="chip" id="pfMaze">Random walls</button>
                <button type="button" class="chip" id="pfClearPath">Clear path</button>
                <button type="button" class="chip" id="pfClear">Clear all</button>
            </div>
            <canvas class="pg-canvas" id="pfCanvas" aria-label="Pathfinding grid. Drag to draw walls; drag the green start or red goal to move them."></canvas>
            <p class="pg-stats" id="pfStats">Draw walls by dragging. Drag the start (green) and goal (red) to move them.</p>`;
        const cv = $("#pfCanvas");
        const COLS = 40, ROWS = 22;
        let walls = new Uint8Array(COLS * ROWS);
        let start = 2 + 11 * COLS, goal = 37 + 11 * COLS;
        let visited = new Uint8Array(COLS * ROWS), frontier = new Uint8Array(COLS * ROWS), path = [];
        let gen = null, raf = 0, ctx, w, h, cell = 16, offX = 0, offY = 0, C = theme();

        function resize() {
            ({ ctx, w, h } = fitCanvas(cv));
            cell = Math.floor(Math.min(w / COLS, h / ROWS));
            offX = Math.floor((w - cell * COLS) / 2); offY = Math.floor((h - cell * ROWS) / 2);
            draw();
        }
        function draw() {
            if (!ctx) return;
            ctx.fillStyle = C.bg;
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < COLS * ROWS; i++) {
                const x = offX + (i % COLS) * cell, y = offY + Math.floor(i / COLS) * cell;
                let col = null;
                if (walls[i]) col = hexA(C.text, 0.42);
                else if (frontier[i]) col = hexA(C.lane3, 0.55);
                else if (visited[i]) col = hexA(C.accent, 0.25);
                if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, cell, cell); }
            }
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.lineWidth = 1;
            for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(offX + c * cell + 0.5, offY); ctx.lineTo(offX + c * cell + 0.5, offY + ROWS * cell); ctx.stroke(); }
            for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(offX, offY + r * cell + 0.5); ctx.lineTo(offX + COLS * cell, offY + r * cell + 0.5); ctx.stroke(); }
            if (path.length) {
                ctx.strokeStyle = "#ffcb6b"; ctx.lineWidth = Math.max(2, cell / 4); ctx.lineJoin = "round";
                ctx.beginPath();
                path.forEach((i, k) => { const x = offX + (i % COLS) * cell + cell / 2, y = offY + Math.floor(i / COLS) * cell + cell / 2; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
                ctx.stroke();
            }
            const dot = (i, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(offX + (i % COLS) * cell + cell / 2, offY + Math.floor(i / COLS) * cell + cell / 2, cell * 0.38, 0, Math.PI * 2); ctx.fill(); };
            dot(start, "#5bd16b"); dot(goal, "#ff5370");
        }
        const nbrs = (i) => {
            const c = i % COLS, r = Math.floor(i / COLS), out = [];
            if (c > 0) out.push(i - 1); if (c < COLS - 1) out.push(i + 1);
            if (r > 0) out.push(i - COLS); if (r < ROWS - 1) out.push(i + COLS);
            return out.filter((n) => !walls[n]);
        };
        const hDist = (a, b) => Math.abs((a % COLS) - (b % COLS)) + Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS));
        // Binary heap keyed by priority
        function Heap() {
            const a = [];
            return {
                get size() { return a.length; },
                push(item, pr) {
                    a.push([pr, item]);
                    let i = a.length - 1;
                    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
                },
                pop() {
                    const top = a[0], last = a.pop();
                    if (a.length) {
                        a[0] = last;
                        let i = 0;
                        for (;;) {
                            const l = i * 2 + 1, r = l + 1;
                            let m = i;
                            if (l < a.length && a[l][0] < a[m][0]) m = l;
                            if (r < a.length && a[r][0] < a[m][0]) m = r;
                            if (m === i) break;
                            [a[m], a[i]] = [a[i], a[m]]; i = m;
                        }
                    }
                    return top[1];
                }
            };
        }
        function* search(algo) {
            const came = new Int32Array(COLS * ROWS).fill(-1);
            const g = new Float64Array(COLS * ROWS).fill(Infinity);
            g[start] = 0;
            const open = algo === "bfs" ? null : Heap();
            const queue = algo === "bfs" ? [start] : null;
            let qi = 0;
            if (open) open.push(start, 0);
            frontier[start] = 1;
            let count = 0;
            while (open ? open.size : qi < queue.length) {
                const cur = open ? open.pop() : queue[qi++];
                if (visited[cur]) continue;
                visited[cur] = 1; frontier[cur] = 0; count++;
                if (cur === goal) {
                    const p = [];
                    for (let at = goal; at !== -1; at = came[at]) p.push(at);
                    path = p.reverse();
                    return { found: true, count };
                }
                for (const n of nbrs(cur)) {
                    if (visited[n]) continue;
                    const ng = g[cur] + 1;
                    if (algo === "bfs") {
                        if (came[n] === -1 && n !== start) { came[n] = cur; frontier[n] = 1; queue.push(n); }
                    } else if (ng < g[n] || algo === "greedy" && came[n] === -1 && n !== start) {
                        g[n] = ng; came[n] = cur; frontier[n] = 1;
                        const pr = algo === "astar" ? ng + hDist(n, goal) : algo === "greedy" ? hDist(n, goal) : ng;
                        open.push(n, pr);
                    }
                }
                yield count;
            }
            return { found: false, count };
        }
        function clearPath() {
            cancelAnimationFrame(raf); gen = null;
            visited = new Uint8Array(COLS * ROWS); frontier = new Uint8Array(COLS * ROWS); path = [];
        }
        function run() {
            clearPath();
            const algo = $("#pfAlgo").value, speed = Number($("#pfSpeed").value);
            gen = search(algo);
            const t0 = performance.now();
            const finish = (res) => {
                const ms = (performance.now() - t0).toFixed(0);
                $("#pfStats").textContent = res.found
                    ? `${$("#pfAlgo").selectedOptions[0].text}: visited ${res.count} cells, path length ${path.length - 1}${speed === 0 ? ` (${ms} ms)` : ""}.`
                    : `${$("#pfAlgo").selectedOptions[0].text}: no path, visited ${res.count} cells.`;
                TH.Ach.unlock("pathfinder");
                draw();
            };
            if (speed === 0 || reduceMotion) {
                let r; do { r = gen.next(); } while (!r.done);
                finish(r.value);
                return;
            }
            const tick = () => {
                for (let k = 0; k < speed; k++) {
                    const r = gen.next();
                    if (r.done) { finish(r.value); return; }
                }
                draw();
                raf = requestAnimationFrame(tick);
            };
            tick();
        }
        // Pointer: paint walls or drag endpoints
        let drag = null;
        const cellAt = (e) => {
            const r = cv.getBoundingClientRect();
            const c = Math.floor((e.clientX - r.left - offX) / cell), rr = Math.floor((e.clientY - r.top - offY) / cell);
            return c >= 0 && c < COLS && rr >= 0 && rr < ROWS ? rr * COLS + c : -1;
        };
        cv.addEventListener("pointerdown", (e) => {
            const i = cellAt(e);
            if (i < 0) return;
            e.preventDefault();
            try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            if (i === start) drag = { kind: "start" };
            else if (i === goal) drag = { kind: "goal" };
            else { drag = { kind: "paint", value: walls[i] ? 0 : 1 }; walls[i] = drag.value; clearPath(); }
            draw();
        });
        cv.addEventListener("pointermove", (e) => {
            if (!drag) return;
            const i = cellAt(e);
            if (i < 0) return;
            if (drag.kind === "paint" && i !== start && i !== goal) walls[i] = drag.value;
            if (drag.kind === "start" && !walls[i] && i !== goal) start = i;
            if (drag.kind === "goal" && !walls[i] && i !== start) goal = i;
            clearPath();
            draw();
        });
        cv.addEventListener("pointerup", () => { drag = null; });
        $("#pfRun").addEventListener("click", run);
        $("#pfClearPath").addEventListener("click", () => { clearPath(); draw(); });
        $("#pfClear").addEventListener("click", () => { walls = new Uint8Array(COLS * ROWS); clearPath(); draw(); });
        // Random walls, retried until the goal is reachable (quick BFS check).
        function reachable() {
            const seen = new Uint8Array(COLS * ROWS), q = [start];
            seen[start] = 1;
            for (let k = 0; k < q.length; k++) {
                if (q[k] === goal) return true;
                for (const n of nbrs(q[k])) if (!seen[n]) { seen[n] = 1; q.push(n); }
            }
            return false;
        }
        $("#pfMaze").addEventListener("click", () => {
            for (let tries = 0; tries < 20; tries++) {
                walls = new Uint8Array(COLS * ROWS);
                for (let i = 0; i < walls.length; i++) if (Math.random() < 0.28 && i !== start && i !== goal) walls[i] = 1;
                if (reachable()) break;
            }
            clearPath(); draw();
        });
        on("themechange", () => { C = theme(); draw(); });
        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(cv);
        tools.path = { show: resize, hide: () => {} };
        resize();
    }

    /* ================================================================
       #35 Particle editor
       ================================================================ */
    function initParticles() {
        const panel = $("#pg-particles");
        const PARAMS = [
            ["rate", "Emission rate", 0, 600, 5, "/s"], ["life", "Lifetime", 0.1, 4, 0.05, "s"], ["speed", "Speed", 0, 500, 5, "px/s"],
            ["spread", "Spread", 0, 360, 1, "°"], ["angle", "Direction", -180, 180, 1, "°"], ["gravity", "Gravity", -800, 800, 10, "px/s²"],
            ["drag", "Drag", 0, 5, 0.05, ""], ["size0", "Start size", 1, 40, 0.5, "px"], ["size1", "End size", 0, 40, 0.5, "px"]
        ];
        const PRESETS = {
            fire:   { rate: 220, life: 0.9, speed: 90, spread: 40, angle: -90, gravity: -180, drag: 0.6, size0: 14, size1: 2, color0: "#ffd27a", color1: "#c2271d", additive: true, shape: "circle" },
            sparks: { rate: 120, life: 0.7, speed: 360, spread: 70, angle: -90, gravity: 700, drag: 0.3, size0: 3, size1: 1, color0: "#fff2b0", color1: "#ff7a1a", additive: true, shape: "spark" },
            snow:   { rate: 60, life: 4, speed: 40, spread: 360, angle: 90, gravity: 30, drag: 0.4, size0: 4, size1: 3, color0: "#ffffff", color1: "#a9c7e8", additive: false, shape: "circle" },
            magic:  { rate: 300, life: 1.4, speed: 140, spread: 360, angle: 0, gravity: 0, drag: 1.6, size0: 6, size1: 0, color0: "#9ef7ff", color1: "#b04dff", additive: true, shape: "square" },
            smoke:  { rate: 50, life: 3, speed: 50, spread: 30, angle: -90, gravity: -40, drag: 0.2, size0: 10, size1: 40, color0: "#8a8a8a", color1: "#1a1a1a", additive: false, shape: "circle" }
        };
        const cfg = Object.assign({}, PRESETS.fire, store.get("particles-cfg", {}));
        panel.innerHTML = `
            <div class="pg-split">
                <div>
                    <canvas class="pg-canvas" id="ptCanvas" aria-label="Particle preview. Drag to move the emitter."></canvas>
                    <p class="pg-stats" id="ptStats">Drag on the preview to move the emitter.</p>
                </div>
                <div class="pg-controls side-card">
                    <div class="preset-row">${Object.keys(PRESETS).map((k) => `<button type="button" class="chip" data-pt-preset="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>
                    <div class="slider-list compact" id="ptSliders"></div>
                    <div class="pt-row">
                        <label>Start colour <input type="color" data-pt="color0"></label>
                        <label>End colour <input type="color" data-pt="color1"></label>
                    </div>
                    <div class="pt-row">
                        <label class="mini-select"><span>Shape</span><select data-pt="shape"><option value="circle">Circle</option><option value="square">Square</option><option value="spark">Spark</option></select></label>
                        <label class="pt-check"><input type="checkbox" data-pt="additive"> Additive glow</label>
                    </div>
                    <div class="overlay-actions">
                        <button type="button" class="btn btn-green btn-sm" id="ptExport">Export JSON</button>
                        <button type="button" class="btn btn-ghost btn-sm" id="ptImport">Import</button>
                    </div>
                    <p class="pg-stats" id="ptMsg" role="status"></p>
                </div>
            </div>`;
        const cv = $("#ptCanvas");
        const fmt = (p, v) => (p[4] < 1 ? Number(v).toFixed(2) : Math.round(v)) + p[5];
        function renderControls() {
            $("#ptSliders").innerHTML = PARAMS.map((p) => `
                <label class="slider"><span class="slider-top"><span>${p[1]}</span><output data-pt-out="${p[0]}">${fmt(p, cfg[p[0]])}</output></span>
                <input type="range" data-pt="${p[0]}" min="${p[2]}" max="${p[3]}" step="${p[4]}" value="${cfg[p[0]]}"></label>`).join("");
            $$("[data-pt]", panel).forEach((el) => {
                const k = el.dataset.pt;
                if (el.type === "checkbox") el.checked = !!cfg[k];
                else if (el.type !== "range") el.value = cfg[k];
            });
        }
        renderControls();
        panel.addEventListener("input", (e) => {
            const k = e.target.dataset.pt;
            if (!k) return;
            cfg[k] = e.target.type === "checkbox" ? e.target.checked : e.target.type === "range" ? Number(e.target.value) : e.target.value;
            const p = PARAMS.find((x) => x[0] === k);
            if (p) $(`[data-pt-out="${k}"]`).textContent = fmt(p, cfg[k]);
            store.set("particles-cfg", cfg);
        });
        panel.addEventListener("click", (e) => {
            const b = e.target.closest("[data-pt-preset]");
            if (b) { Object.assign(cfg, PRESETS[b.dataset.ptPreset]); renderControls(); store.set("particles-cfg", cfg); }
        });
        $("#ptExport").addEventListener("click", async () => {
            const json = JSON.stringify(cfg, null, 2);
            const ok = await TH.copyText(json);
            TH.download("particles.json", json, "application/json");
            $("#ptMsg").textContent = ok ? "Copied to clipboard and downloaded particles.json." : "Downloaded particles.json.";
            TH.Ach.unlock("particle-artist");
        });
        $("#ptImport").addEventListener("click", () => {
            const text = prompt("Paste particle JSON:");
            if (!text) return;
            try {
                const obj = JSON.parse(text);
                PARAMS.forEach((p) => { if (typeof obj[p[0]] === "number") cfg[p[0]] = Math.max(p[2], Math.min(p[3], obj[p[0]])); });
                ["color0", "color1"].forEach((k) => { if (/^#[0-9a-f]{6}$/i.test(obj[k])) cfg[k] = obj[k]; });
                if (["circle", "square", "spark"].includes(obj.shape)) cfg.shape = obj.shape;
                cfg.additive = !!obj.additive;
                renderControls();
                $("#ptMsg").textContent = "Imported.";
            } catch { $("#ptMsg").textContent = "That isn't valid JSON."; }
        });

        let ctx, w, h, parts = [], em = { x: 0.5, y: 0.7 }, acc = 0, last = 0, raf = 0, visible = false, inView = false;
        const mix = (a, b, t) => {
            const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
            const r = ((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
            const g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
            const bl = (pa & 255) + (((pb & 255) - (pa & 255)) * t);
            return `rgb(${r | 0},${g | 0},${bl | 0})`;
        };
        function resize() { ({ ctx, w, h } = fitCanvas(cv)); }
        function frame(now) {
            const dt = Math.min(0.05, (now - last) / 1000 || 0);
            last = now;
            acc += cfg.rate * dt;
            while (acc >= 1 && parts.length < 3000) {
                acc -= 1;
                const a = (cfg.angle + (Math.random() - 0.5) * cfg.spread) * Math.PI / 180;
                const s = cfg.speed * (0.6 + Math.random() * 0.4);
                parts.push({ x: em.x * w, y: em.y * h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: cfg.life * (0.7 + Math.random() * 0.3) });
            }
            if (acc > 1) acc = 0;
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "#07090c";
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = cfg.additive ? "lighter" : "source-over";
            const damp = Math.exp(-cfg.drag * dt);
            for (const p of parts) {
                p.age += dt;
                p.vx *= damp; p.vy = p.vy * damp + cfg.gravity * dt;
                p.x += p.vx * dt; p.y += p.vy * dt;
                const k = p.age / p.life;
                if (k >= 1) continue;
                const size = cfg.size0 + (cfg.size1 - cfg.size0) * k;
                ctx.globalAlpha = 1 - k;
                ctx.fillStyle = mix(cfg.color0, cfg.color1, k);
                ctx.strokeStyle = ctx.fillStyle;
                if (cfg.shape === "circle") { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, size / 2), 0, Math.PI * 2); ctx.fill(); }
                else if (cfg.shape === "square") ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
                else { ctx.lineWidth = Math.max(1, size / 2); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
            }
            parts = parts.filter((p) => p.age < p.life);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = "rgba(255,255,255,0.35)";
            ctx.beginPath(); ctx.arc(em.x * w, em.y * h, 6, 0, Math.PI * 2); ctx.stroke();
            $("#ptStats").textContent = `${parts.length} particles · drag to move the emitter`;
            if (visible && inView) raf = requestAnimationFrame(frame); else raf = 0;
        }
        function start() { if (!raf && visible && inView) { last = performance.now(); raf = requestAnimationFrame(frame); } }
        let dragging = false;
        cv.addEventListener("pointerdown", (e) => { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ } move(e); });
        cv.addEventListener("pointermove", (e) => { if (dragging) move(e); });
        cv.addEventListener("pointerup", () => { dragging = false; });
        function move(e) { const r = cv.getBoundingClientRect(); em.x = (e.clientX - r.left) / r.width; em.y = (e.clientY - r.top) / r.height; }
        if ("IntersectionObserver" in window) new IntersectionObserver((en) => { inView = en[0].isIntersecting; start(); }).observe(cv);
        tools.particles = { show() { visible = true; resize(); start(); }, hide() { visible = false; } };
    }

    /* ================================================================
       #36 Shader playground
       ================================================================ */
    function initShaders() {
        const panel = $("#pg-shaders");
        const SCENE = `
precision mediump float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_a; uniform float u_b;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.0; a *= 0.5; } return v; }
vec3 scene(vec2 uv){
  vec2 p = uv - 0.5; p.x *= u_res.x / u_res.y;
  vec3 sky = mix(vec3(0.05,0.07,0.16), vec3(0.55,0.25,0.45), uv.y);
  float sun = smoothstep(0.16, 0.15, length(p - vec2(0.22, 0.12)));
  vec3 col = mix(sky, vec3(1.0, 0.78, 0.4), sun);
  float hills = step(uv.y, 0.36 + 0.05*sin(uv.x*11.0 + 1.0) + 0.025*sin(uv.x*29.0));
  col = mix(col, vec3(0.07, 0.11, 0.09) + 0.12*uv.y, hills);
  float grid = step(0.96, fract(uv.x*24.0)) + step(0.96, fract(uv.y*24.0));
  return col + grid * 0.025;
}`;
        const SHADERS = {
            dissolve: {
                name: "Dissolve", a: ["Amount", 0.45], b: ["Edge width", 0.3],
                body: `void main(){ vec2 uv = gl_FragCoord.xy / u_res;
  float n = fbm(uv * 6.0);
  float edge = u_b * 0.12 + 0.01;
  if (n < u_a) discard;
  vec3 col = scene(uv);
  float glow = 1.0 - smoothstep(u_a, u_a + edge, n);
  col = mix(col, vec3(1.0, 0.45, 0.1), glow);
  gl_FragColor = vec4(col, 1.0); }`
            },
            water: {
                name: "Water ripple", a: ["Strength", 0.5], b: ["Ripple count", 0.5],
                body: `void main(){ vec2 uv = gl_FragCoord.xy / u_res;
  vec2 m = u_mouse; vec2 d = uv - m; d.x *= u_res.x / u_res.y;
  float dist = length(d);
  float waves = sin(dist * (40.0 + u_b * 80.0) - u_time * 5.0) * exp(-dist * 4.0);
  vec2 off = normalize(d + 1e-5) * waves * 0.02 * u_a;
  off += vec2(sin(uv.y * 30.0 + u_time * 2.0), cos(uv.x * 25.0 + u_time * 1.7)) * 0.002 * u_a;
  vec3 col = scene(uv + off) + waves * 0.08 * u_a;
  gl_FragColor = vec4(col, 1.0); }`
            },
            crt: {
                name: "CRT", a: ["Curvature", 0.5], b: ["Scanlines", 0.6],
                body: `void main(){ vec2 uv = gl_FragCoord.xy / u_res;
  vec2 c = uv * 2.0 - 1.0; c *= 1.0 + u_a * 0.25 * dot(c, c) * 0.5; uv = c * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0,0,0,1); return; }
  float ab = 0.003 + u_a * 0.004;
  vec3 col = vec3(scene(uv + vec2(ab,0)).r, scene(uv).g, scene(uv - vec2(ab,0)).b);
  col *= 1.0 - u_b * 0.5 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  col *= 1.0 - 0.6 * dot(c, c) * 0.25;
  col += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.04;
  gl_FragColor = vec4(col, 1.0); }`
            },
            fog: {
                name: "Fog & flashlight", a: ["Fog density", 0.7], b: ["Beam size", 0.4],
                body: `void main(){ vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col = scene(uv) * 0.5;
  float f = fbm(uv * 3.0 + vec2(u_time * 0.05, 0.0)) * 0.6 + fbm(uv * 7.0 - vec2(u_time * 0.08, 0.0)) * 0.4;
  col = mix(col, vec3(0.72, 0.71, 0.68), clamp(f * u_a * 1.3, 0.0, 1.0));
  vec2 d = uv - u_mouse; d.x *= u_res.x / u_res.y;
  float beam = smoothstep(0.08 + u_b * 0.3, 0.0, length(d));
  float dark = 1.0 - 0.75 * u_a;
  col *= dark + beam * (1.0 - dark) * 1.6;
  col += (hash(gl_FragCoord.xy * 0.5 + floor(u_time * 24.0)) - 0.5) * 0.08;
  gl_FragColor = vec4(col, 1.0); }`
            },
            toon: {
                name: "Toon + outline", a: ["Colour steps", 0.4], b: ["Outline", 0.7],
                body: `float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){ vec2 uv = gl_FragCoord.xy / u_res; vec2 px = 1.5 / u_res;
  vec3 col = scene(uv);
  float steps = 2.0 + floor(u_a * 8.0);
  col = floor(col * steps + 0.5) / steps;
  float gx = lum(scene(uv + vec2(px.x,0))) - lum(scene(uv - vec2(px.x,0)));
  float gy = lum(scene(uv + vec2(0,px.y))) - lum(scene(uv - vec2(0,px.y)));
  float e = smoothstep(0.02, 0.08, length(vec2(gx, gy)) * u_b);
  gl_FragColor = vec4(mix(col, vec3(0.02), e), 1.0); }`
            }
        };
        panel.innerHTML = `
            <div class="pg-split">
                <div>
                    <canvas class="pg-canvas" id="shCanvas" aria-label="WebGL shader preview. Move the pointer over it to interact."></canvas>
                    <p class="pg-stats" id="shStats">Move your pointer over the preview.</p>
                </div>
                <div class="pg-controls side-card">
                    <div class="preset-row" id="shList">${Object.entries(SHADERS).map(([k, s]) => `<button type="button" class="chip" data-shader="${k}">${s.name}</button>`).join("")}</div>
                    <label class="slider"><span class="slider-top"><span id="shALabel"></span><output id="shAOut"></output></span><input type="range" id="shA" min="0" max="1" step="0.01"></label>
                    <label class="slider"><span class="slider-top"><span id="shBLabel"></span><output id="shBOut"></output></span><input type="range" id="shB" min="0" max="1" step="0.01"></label>
                    <details class="sh-source"><summary>View shader source</summary><pre><code id="shCode"></code></pre></details>
                </div>
            </div>`;
        const cv = $("#shCanvas");
        const gl = cv.getContext("webgl", { antialias: false, preserveDrawingBuffer: false });
        if (!gl) { $("#shStats").textContent = "WebGL isn't available in this browser."; tools.shaders = { show() {}, hide() {} }; return; }
        const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const programs = {};
        function compile(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        }
        function program(key) {
            if (programs[key]) return programs[key];
            const p = gl.createProgram();
            gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
            gl.attachShader(p, compile(gl.FRAGMENT_SHADER, SCENE + "\n" + SHADERS[key].body));
            gl.linkProgram(p);
            const u = (n) => gl.getUniformLocation(p, n);
            programs[key] = { p, loc: gl.getAttribLocation(p, "p"), res: u("u_res"), time: u("u_time"), mouse: u("u_mouse"), a: u("u_a"), b: u("u_b") };
            return programs[key];
        }
        let cur = "dissolve", A = 0.45, B = 0.3, mouse = [0.5, 0.5], raf = 0, visible = false, inView = false, t0 = performance.now();
        const seen = new Set(store.get("shaders-seen", []));
        function select(key) {
            cur = key;
            A = SHADERS[key].a[1]; B = SHADERS[key].b[1];
            $("#shALabel").textContent = SHADERS[key].a[0];
            $("#shBLabel").textContent = SHADERS[key].b[0];
            $("#shA").value = A; $("#shB").value = B;
            $("#shAOut").textContent = A.toFixed(2); $("#shBOut").textContent = B.toFixed(2);
            $("#shCode").textContent = SHADERS[key].body;
            $$("[data-shader]", panel).forEach((b) => { const on = b.dataset.shader === key; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
            seen.add(key);
            store.set("shaders-seen", [...seen]);
            if (Object.keys(SHADERS).every((k) => seen.has(k))) TH.Ach.unlock("shader-hopper");
            try { program(key); $("#shStats").textContent = "Move your pointer over the preview."; }
            catch (err) { $("#shStats").textContent = "Shader failed to compile: " + err.message; }
            if (!raf) frame();
        }
        $("#shList").addEventListener("click", (e) => { const b = e.target.closest("[data-shader]"); if (b) select(b.dataset.shader); });
        $("#shA").addEventListener("input", (e) => { A = Number(e.target.value); $("#shAOut").textContent = A.toFixed(2); if (!raf) frame(); });
        $("#shB").addEventListener("input", (e) => { B = Number(e.target.value); $("#shBOut").textContent = B.toFixed(2); if (!raf) frame(); });
        cv.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); mouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; });
        function resize() {
            const dpr = Math.min(1.5, window.devicePixelRatio || 1);
            cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
            gl.viewport(0, 0, cv.width, cv.height);
        }
        function frame() {
            let pr;
            try { pr = program(cur); } catch { raf = 0; return; }
            gl.useProgram(pr.p);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(pr.loc);
            gl.vertexAttribPointer(pr.loc, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(pr.res, cv.width, cv.height);
            gl.uniform1f(pr.time, (performance.now() - t0) / 1000);
            gl.uniform2f(pr.mouse, mouse[0], mouse[1]);
            gl.uniform1f(pr.a, A);
            gl.uniform1f(pr.b, B);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            raf = visible && inView && !reduceMotion ? requestAnimationFrame(frame) : 0;
        }
        if ("IntersectionObserver" in window) new IntersectionObserver((en) => { inView = en[0].isIntersecting; if (inView && visible && !raf) frame(); }).observe(cv);
        tools.shaders = {
            show() { visible = true; resize(); if (!programs[cur]) select(cur); else if (!raf) frame(); },
            hide() { visible = false; }
        };
        select("dissolve");
        visible = false;
    }

    /* ================================================================
       #37 Input-lag tester
       ================================================================ */
    function initLag() {
        const panel = $("#pg-lag");
        panel.innerHTML = `
            <div class="pg-split">
                <div>
                    <div class="lag-area" id="lagArea" tabindex="0" aria-label="Test area. Tap, click or press Space in time with each beat.">
                        <div class="lag-flash" id="lagFlash"></div>
                        <p class="lag-text" id="lagText">Pick a test. Tap, click or press Space on every beat.</p>
                    </div>
                    <canvas class="pg-canvas lag-chart" id="lagChart" aria-label="Distribution of your tap offsets"></canvas>
                </div>
                <div class="pg-controls side-card">
                    <h3 class="side-title">How it works</h3>
                    <p class="side-note">Each test plays 12 beats at 100 BPM. The visual test flashes; the audio test clicks. Comparing the two shows how much later your device plays sound than it shows pictures.</p>
                    <div class="overlay-actions">
                        <button type="button" class="btn btn-green btn-sm" data-lag="visual">Visual test</button>
                        <button type="button" class="btn btn-blue btn-sm" data-lag="audio">Audio test</button>
                    </div>
                    <div class="lag-results" id="lagResults"></div>
                </div>
            </div>`;
        const area = $("#lagArea"), flash = $("#lagFlash"), text = $("#lagText"), chart = $("#lagChart"), results = $("#lagResults");
        const BEATS = 12, INTERVAL = 0.6;
        const data = store.get("lag-results", { visual: null, audio: null });
        let run = null, actx = null, raf = 0;

        const stats = (arr) => {
            const m = arr.reduce((a, b) => a + b, 0) / arr.length;
            const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
            return { mean: Math.round(m), sd: Math.round(sd), taps: arr };
        };
        function renderResults() {
            const row = (k, label) => data[k] ? `<li><b>${label}</b> avg ${data[k].mean > 0 ? "+" : ""}${data[k].mean} ms · spread ±${data[k].sd} ms</li>` : `<li><b>${label}</b> not run yet</li>`;
            let verdict = "";
            if (data.visual && data.audio) {
                const diff = data.audio.mean - data.visual.mean;
                verdict = `<p class="side-note">Audio taps were ${Math.abs(diff)} ms ${diff >= 0 ? "later" : "earlier"} than visual taps, so your audio output adds roughly ${Math.max(0, diff)} ms of delay.</p>
                    <button type="button" class="btn btn-ghost btn-sm" id="lagApply">Use for Beat Lanes offset</button>`;
            }
            results.innerHTML = `<ul class="plain-list">${row("visual", "Visual")}${row("audio", "Audio")}</ul>${verdict}`;
            const apply = $("#lagApply");
            if (apply) apply.addEventListener("click", () => { TH.emit("set-audio-offset", data.audio.mean); apply.textContent = "Applied!"; });
            drawChart();
        }
        function drawChart() {
            const { ctx, w, h } = fitCanvas(chart);
            const C = theme();
            ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, 0, w, h);
            const x = (ms) => w / 2 + (ms / 200) * (w / 2 - 10);
            ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.moveTo(w / 2 + 0.5, 0); ctx.lineTo(w / 2 + 0.5, h); ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "10px sans-serif";
            ctx.textAlign = "left"; ctx.fillText("early −200ms", 4, h - 4);
            ctx.textAlign = "right"; ctx.fillText("+200ms late", w - 4, h - 4);
            [["visual", C.accent, h * 0.33], ["audio", C.lane2 || "#a3cf06", h * 0.66]].forEach(([k, col, y]) => {
                const d = data[k];
                if (!d) return;
                ctx.fillStyle = col;
                d.taps.forEach((ms) => { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x(Math.max(-200, Math.min(200, ms))), y, 4, 0, Math.PI * 2); ctx.fill(); });
                ctx.globalAlpha = 1;
                ctx.fillRect(x(d.mean) - 1, y - 12, 2, 24);
                ctx.textAlign = "left";
                ctx.fillText(k, 6, y - 10);
            });
        }
        function click(at) {
            const o = actx.createOscillator(), g = actx.createGain();
            o.frequency.value = 1000;
            g.gain.setValueAtTime(0.4 * (Number(TH.settings.get("volume")) || 0.8), at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
            o.connect(g).connect(actx.destination);
            o.start(at); o.stop(at + 0.06);
        }
        function start(mode) {
            if (mode === "audio") {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) { text.textContent = "Web Audio isn't available here."; return; }
                actx = actx || new AC();
                if (actx.state === "suspended") actx.resume();
            }
            const t0 = performance.now() / 1000 + 1;
            run = { mode, t0, taps: [], next: 0 };
            if (mode === "audio") for (let i = 0; i < BEATS; i++) click(actx.currentTime + 1 + i * INTERVAL);
            area.focus({ preventScroll: true });
            text.textContent = mode === "visual" ? "Tap when the box flashes…" : "Tap on each click…";
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(tick);
        }
        function tick() {
            if (!run) return;
            const t = performance.now() / 1000 - run.t0;
            const k = Math.round(t / INTERVAL);
            if (run.mode === "visual") {
                const phase = t - Math.floor(t / INTERVAL) * INTERVAL;
                flash.style.opacity = t >= 0 && t < BEATS * INTERVAL && phase < 0.08 ? "1" : "0";
            }
            if (t > BEATS * INTERVAL + 0.4) return finish();
            text.textContent = t < 0 ? "Get ready…" : `Beat ${Math.min(BEATS, Math.max(1, k + 1))} of ${BEATS}`;
            raf = requestAnimationFrame(tick);
        }
        function tap() {
            if (!run) return;
            const t = performance.now() / 1000 - run.t0;
            const k = Math.round(t / INTERVAL);
            if (k < 2 || k >= BEATS) return;
            run.taps.push((t - k * INTERVAL) * 1000);
            area.classList.add("tapped");
            setTimeout(() => area.classList.remove("tapped"), 80);
        }
        function finish() {
            flash.style.opacity = "0";
            const r = run;
            run = null;
            if (r.taps.length < 5) { text.textContent = "Not enough taps. Try again and tap on every beat."; return; }
            data[r.mode] = stats(r.taps);
            store.set("lag-results", data);
            text.textContent = `Done: ${r.mode} average ${data[r.mode].mean > 0 ? "+" : ""}${data[r.mode].mean} ms.`;
            if (data.visual && data.audio) TH.Ach.unlock("latency-lab");
            renderResults();
        }
        panel.addEventListener("click", (e) => { const b = e.target.closest("[data-lag]"); if (b) start(b.dataset.lag); });
        area.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(); });
        area.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) tap(); } });
        tools.lag = { show: renderResults, hide() {} };
    }

    function init() {
        if (!$("#playground")) return;
        initPath();
        initParticles();
        initShaders();
        initLag();
        initTabs();
    }
    TH.modules.push(["playground", init]);
})();
