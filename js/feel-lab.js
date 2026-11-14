/* =====================================================================
   Game Feel Lab
   - Single-screen platformer, fixed 120 Hz simulation, tile collision
   - Coyote time, jump buffer, variable jump, wall slide/jump, dash
   - Rooms: test, 4 story rooms (#39), boss (#41), daily (#27), custom (#19)
   - Enemies with a visible finite state machine (#33)
   - Input-recorded ghost replays with share links (#21), splits (#22)
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, $$, esc, store, on, cssVar, reduceMotion, b64 } = TH;

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
        { id: "ghost",     label: "Race ghost",           def: true,  tip: "Replay your best run (or a shared one) alongside you." },
        { id: "squash",    label: "Squash & stretch",     def: true,  tip: "Deform on jumps and landings." },
        { id: "particles", label: "Particles",            def: true,  tip: "Dust, trails and sparkles." },
        { id: "shake",     label: "Screen shake",         def: true,  tip: "Small kick on hard landings, dashes and boss hits." },
        { id: "debug",     label: "Debug view",           def: false, tip: "Hitboxes, timers, enemy AI states and sight lines." }
    ];
    const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.id, p.def]));
    const DEFAULT_TOGGLES = Object.fromEntries(TOGGLES.map((t) => [t.id, t.def]));
    const PRESETS = {
        tight:       { name: "Tight",       values: { ...DEFAULTS }, toggles: { varJump: true } },
        floaty:      { name: "Floaty",      values: { ...DEFAULTS, gravity: 900, jumpHeight: 92, fallMult: 1, runSpeed: 170, accel: 800, airControl: 0.5 }, toggles: { varJump: false } },
        heavy:       { name: "Heavy",       values: { ...DEFAULTS, gravity: 3400, jumpHeight: 60, fallMult: 2.4, runSpeed: 230, accel: 5200, airControl: 0.9 }, toggles: { varJump: true } },
        unforgiving: { name: "Unforgiving", values: { ...DEFAULTS, coyote: 0, buffer: 0 }, toggles: { varJump: false } }
    };

    const T = 20, COLS = 32, ROWS = 18, VW = COLS * T, VH = ROWS * T;
    const PW = 12, PH = 18, EW = 14, EH = 14;
    const DT = 1 / 120;
    const DASH_SPEED = 430, DASH_TIME = 0.14, WALL_SLIDE_MAX = 90, MAX_FALL = 620;

    /* ================================================================
       Rooms
       ================================================================ */
    const ROOMS = {
        test: {
            name: "Test Room", tab: "Test", kind: "shards",
            desc: "The original room. Grab all 8 shards. Walls can be slid down and jumped off.",
            def: () => ({
                solids: [[5, 8, 14, 14], [1, 4, 11, 11], [5, 8, 8, 8], [1, 5, 5, 5], [13, 14, 4, 13], [17, 18, 4, 13], [22, 25, 14, 14], [27, 30, 11, 11], [22, 25, 8, 8], [26, 30, 5, 5]],
                shards: [[6, 13], [2, 10], [7, 7], [3, 4], [15, 8], [23, 13], [29, 10], [28, 4]],
                spawn: [3, 16]
            })
        },
        story1: {
            name: "1 · First Steps", tab: "1", kind: "shards", story: 1,
            desc: "Learn the jump. Short hops, long jumps, and a little forgiveness built in.",
            def: () => ({
                solids: [[6, 10, 14, 14], [12, 16, 11, 11], [18, 22, 8, 8], [24, 28, 5, 5], [2, 4, 8, 8]],
                shards: [[8, 13], [14, 10], [20, 7], [26, 4], [29, 16], [3, 7]],
                spawn: [3, 16]
            })
        },
        story2: {
            name: "2 · The Chimney", tab: "2", kind: "shards", story: 2,
            desc: "Slide down walls and kick off them to climb the shaft, then drop over the far wall.",
            def: () => ({
                solids: [[9, 10, 4, 14], [13, 14, 4, 16], [17, 21, 13, 13], [23, 26, 10, 10], [18, 21, 7, 7]],
                shards: [[11, 9], [12, 5], [9, 3], [19, 12], [24, 9], [19, 6]],
                spawn: [3, 16]
            })
        },
        story3: {
            name: "3 · Dash Gap", tab: "3", kind: "shards", story: 3,
            desc: "Spikes below. Jump, then dash (Shift) mid-air to clear the long gaps.",
            def: () => ({
                solids: [[7, 8, 14, 14], [11, 12, 12, 16], [19, 20, 12, 16], [27, 28, 12, 16], [22, 25, 9, 9]],
                spikes: [[9, 10, 16], [13, 18, 16], [21, 26, 16], [29, 30, 16]],
                shards: [[12, 11], [16, 10], [20, 11], [23, 8], [28, 11]],
                spawn: [2, 16]
            })
        },
        story4: {
            name: "4 · Patrol Yard", tab: "4", kind: "shards", story: 4,
            desc: "Guards run a state machine: patrol, notice, chase, search, return. Stomp them or dash through them. Turn on Debug view to watch them think.",
            def: () => ({
                solids: [[5, 12, 14, 14], [18, 26, 14, 14], [10, 20, 11, 11], [3, 7, 8, 8], [23, 28, 8, 8]],
                shards: [[6, 13], [24, 13], [12, 10], [18, 10], [4, 7], [27, 7]],
                enemies: [[15, 16], [8, 13], [22, 13], [15, 10], [26, 7]],
                spawn: [2, 16]
            })
        },
        boss: {
            name: "Boss · The Warden", tab: "Boss", kind: "boss",
            desc: "Dodge the charge, jump the shockwaves, and outrun the volley. It can only be hurt while stunned: stomp it or dash into it.",
            def: () => ({
                solids: [[3, 7, 14, 14], [24, 28, 14, 14], [13, 18, 11, 11]],
                shards: [],
                spawn: [3, 16],
                boss: [24, 16]
            })
        },
        daily: {
            name: "Daily Room", tab: "Daily", kind: "shards",
            desc: "A remixed room with shard positions picked from today's date. Same room for everyone, new one tomorrow.",
            def: () => dailyDef()
        },
        custom: {
            name: "Your Room", tab: "Editor", kind: "shards",
            desc: "Build your own room, play it, and share it as a link.",
            def: () => charsToDef(customChars())
        }
    };
    const ROOM_ORDER = ["test", "story1", "story2", "story3", "story4", "boss", "daily", "custom"];

    function blankGrid() {
        return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) ? 1 : 0));
    }
    function fillG(g, c0, c1, r0, r1, v) {
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) g[r][c] = v;
    }
    function mulberry32(seed) {
        return () => {
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hashStr(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; }

    function dailyDef() {
        const key = TH.dateKey();
        const h = hashStr(key);
        const rand = mulberry32(h);
        const bases = ["test", "story1", "story2", "story4"];
        const base = ROOMS[bases[h % bases.length]].def();
        const g = blankGrid();
        base.solids.forEach((s) => fillG(g, s[0], s[1], s[2], s[3], 1));
        (base.spikes || []).forEach(([c0, c1, r]) => fillG(g, c0, c1, r, r, 2));
        const cands = [];
        for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
            if (g[r][c] === 0 && g[r + 1][c] === 1 && Math.abs(c - base.spawn[0]) + Math.abs(r - base.spawn[1]) > 4) cands.push([c, r]);
        }
        for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
        const picks = [];
        for (const p of cands) {
            if (picks.every((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) >= 4)) picks.push(p);
            if (picks.length === 8) break;
        }
        return Object.assign({}, base, { shards: picks });
    }

    /* ---------- custom rooms (editor) ----------
       Inner 30x16 cells as characters: . empty  # wall  ^ spike  * shard  E enemy  S spawn */
    const IC = COLS - 2, IR = ROWS - 2;
    function defToChars(def) {
        const cells = Array.from({ length: IR }, () => Array(IC).fill("."));
        const put = (c, r, ch) => { if (c >= 1 && c <= IC && r >= 1 && r <= IR) cells[r - 1][c - 1] = ch; };
        def.solids.forEach(([c0, c1, r0, r1]) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) put(c, r, "#"); });
        (def.spikes || []).forEach(([c0, c1, r]) => { for (let c = c0; c <= c1; c++) put(c, r, "^"); });
        def.shards.forEach(([c, r]) => put(c, r, "*"));
        (def.enemies || []).forEach(([c, r]) => put(c, r, "E"));
        put(def.spawn[0], def.spawn[1], "S");
        return cells.map((row) => row.join("")).join("");
    }
    function charsToDef(str) {
        const def = { solids: [], spikes: [], shards: [], enemies: [], spawn: [2, 16] };
        for (let i = 0; i < IC * IR; i++) {
            const ch = str[i] || ".";
            const c = (i % IC) + 1, r = Math.floor(i / IC) + 1;
            if (ch === "#") def.solids.push([c, c, r, r]);
            else if (ch === "^") def.spikes.push([c, c, r]);
            else if (ch === "*") def.shards.push([c, r]);
            else if (ch === "E") def.enemies.push([c, r]);
            else if (ch === "S") def.spawn = [c, r];
        }
        return def;
    }
    function rleEnc(str) {
        let out = "", i = 0;
        while (i < str.length) {
            let n = 1;
            while (i + n < str.length && str[i + n] === str[i] && n < 35) n++;
            out += str[i] + n.toString(36);
            i += n;
        }
        return out;
    }
    function rleDec(s) {
        let out = "";
        for (let i = 0; i + 1 < s.length; i += 2) {
            const ch = s[i], n = parseInt(s[i + 1], 36);
            if (!".#^*ES".includes(ch) || !n) throw new Error("bad level");
            out += ch.repeat(n);
        }
        if (out.length !== IC * IR) throw new Error("bad size");
        return out;
    }
    function customChars() {
        const saved = store.get("lab-custom", null);
        if (typeof saved === "string" && saved.length === IC * IR) return saved;
        return defToChars(ROOMS.test.def());
    }

    /* ================================================================
       Module
       ================================================================ */
    function init() {
        const shell = $("#labShell");
        const canvas = $("#labCanvas");
        if (!shell || !canvas) return;
        const ctx = canvas.getContext("2d");
        const overlay = $("#labOverlay");
        const overlayCard = $("#labOverlayCard");
        const hud = { goal: $("#labGoalLabel"), shards: $("#labShards"), time: $("#labTime"), best: $("#labBest"), deaths: $("#labDeaths") };
        const roomsBar = $("#labRooms");
        const editorBar = $("#labEditor");
        const splitsBox = $("#labSplits");
        const ghostBox = $("#labGhost");

        /* ---------- settings ---------- */
        const saved = store.get("lab-settings", {});
        const P = Object.assign({}, DEFAULTS, saved.values || {});
        const TG = Object.assign({}, DEFAULT_TOGGLES, saved.toggles || {});
        const persist = () => store.set("lab-settings", { values: P, toggles: TG });

        /* ---------- colours ---------- */
        let C = {};
        function readColors() {
            C = {
                bg1: cssVar("--lab-bg1") || "#0f1923", bg2: cssVar("--lab-bg2") || "#0a0f15",
                tile: cssVar("--lab-tile") || "#24384f", edge: cssVar("--lab-edge") || "#66c0f4",
                player: cssVar("--lab-player") || "#a3cf06", shard: cssVar("--lab-shard") || "#7fe3ff",
                accent: cssVar("--accent") || "#66c0f4", text: cssVar("--text") || "#c6d4df",
                danger: cssVar("--danger") || "#ff7b7b", font: cssVar("--font-head") || "sans-serif"
            };
        }
        readColors();
        on("themechange", () => { readColors(); draw(); });

        /* ---------- world ---------- */
        let roomId = "test";
        let world = null;           // { grid, shards[], spawn, enemyDefs[], bossDef }
        let roomKey = "test";
        function loadRoom(id) {
            roomId = id;
            const def = ROOMS[id].def();
            const g = blankGrid();
            def.solids.forEach((s) => fillG(g, s[0], s[1], s[2], s[3], 1));
            (def.spikes || []).forEach(([c0, c1, r]) => fillG(g, c0, c1, r, r, 2));
            world = {
                grid: g,
                shardDefs: def.shards.map(([c, r]) => ({ x: c * T + T / 2, y: r * T + T / 2 })),
                spawn: { x: def.spawn[0] * T + 4, y: (def.spawn[1] + 1) * T - PH },
                enemyDefs: (def.enemies || []).map(([c, r]) => ({ x: c * T + (T - EW) / 2, y: (r + 1) * T - EH })),
                bossDef: def.boss ? { x: def.boss[0] * T, y: (def.boss[1] + 1) * T - 36 } : null
            };
            roomKey = id === "daily" ? "daily:" + TH.dateKey() : id === "custom" ? "custom:" + hashStr(customChars()).toString(36) : id;
        }
        const tileAt = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? 1 : world.grid[r][c];
        const solid = (c, r) => tileAt(c, r) === 1;
        function overlapsSolid(x, y, w, h) {
            const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.001) / T);
            const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.001) / T);
            for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) return true;
            return false;
        }
        function touchesSpike(x, y, w, h) {
            const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.001) / T);
            const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.001) / T);
            for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
                if (tileAt(c, r) !== 2) continue;
                const sx = c * T + 3, sy = r * T + T * 0.45, sw = T - 6, sh = T * 0.55;
                if (x < sx + sw && x + w > sx && y < sy + sh && y + h > sy) return true;
            }
            return false;
        }
        // Generic AABB mover used by enemies, the boss and projectiles.
        function moveBox(o, w, h) {
            const res = { hitX: false, landed: false, hitHead: false };
            o.x += o.vx * DT;
            if (overlapsSolid(o.x, o.y, w, h)) {
                if (o.vx > 0) o.x = Math.floor((o.x + w) / T) * T - w;
                else if (o.vx < 0) o.x = Math.floor(o.x / T + 1) * T;
                o.vx = 0; res.hitX = true;
            }
            o.y += o.vy * DT;
            if (overlapsSolid(o.x, o.y, w, h)) {
                if (o.vy > 0) { o.y = Math.floor((o.y + h) / T) * T - h; res.landed = true; }
                else if (o.vy < 0) { o.y = Math.floor(o.y / T + 1) * T; res.hitHead = true; }
                o.vy = 0;
            }
            o.onGround = overlapsSolid(o.x, o.y + 1, w, h) && o.vy >= 0;
            return res;
        }

        /* ---------- bodies (player + ghost share the same physics) ---------- */
        function newBody(sp) {
            return { x: sp.x, y: sp.y, vx: 0, vy: 0, onGround: true, wall: 0, facing: 1, dashT: 0, dashDir: 1, canDash: true, wallLock: 0, sx: 1, sy: 1, sliding: false, coyote: 0, buffer: 0, bufferAge: 0 };
        }
        const approach = (v, target, amt) => v < target ? Math.min(v + amt, target) : Math.max(v - amt, target);

        function stepBody(b, inp, PP, TT, moon, fx) {
            const g = PP.gravity * (moon ? 0.35 : 1);
            const jumpV = Math.sqrt(2 * g * PP.jumpHeight);
            const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
            if (dir) b.facing = dir;
            if (inp.jumpPressed) { b.buffer = Math.max(PP.buffer / 1000, DT * 0.5); b.bufferAge = 0; }
            else { b.buffer -= DT; b.bufferAge += DT; }
            if (b.onGround) b.coyote = PP.coyote / 1000; else b.coyote -= DT;
            b.wallLock -= DT;

            if (inp.dashPressed && TT.dash && b.canDash && b.dashT <= 0) {
                b.dashT = DASH_TIME; b.canDash = false; b.dashDir = dir || b.facing;
                if (fx) fx.dash(b);
            }
            if (b.dashT > 0) {
                b.dashT -= DT; b.vx = b.dashDir * DASH_SPEED; b.vy = 0;
                if (fx) fx.trail(b);
            } else {
                let control = b.onGround ? 1 : PP.airControl;
                if (b.wallLock > 0) control *= 0.15;
                b.vx = approach(b.vx, dir * PP.runSpeed, PP.accel * Math.max(control, 0.05) * DT);
                let grav = g;
                if (b.vy > 0) grav *= PP.fallMult;
                else if (b.vy < 0 && TT.varJump && !inp.jump) grav *= Math.max(2.2, PP.fallMult * 1.5);
                b.vy = Math.min(b.vy + grav * DT, MAX_FALL);
                b.sliding = TT.wallJump && !b.onGround && b.wall !== 0 && dir === b.wall && b.vy > 0;
                if (b.sliding) { b.vy = Math.min(b.vy, WALL_SLIDE_MAX); if (fx) fx.slide(b); }
            }
            if (b.buffer > 0 && b.dashT <= 0) {
                if (b.coyote > 0) {
                    const coyoteJump = !b.onGround, buffered = b.bufferAge > DT * 1.5;
                    b.vy = -jumpV; b.onGround = false; b.coyote = 0; b.buffer = 0;
                    if (fx) fx.jump(b, coyoteJump, buffered);
                } else if (TT.wallJump && b.wall !== 0) {
                    b.vy = -jumpV * 0.92; b.vx = -b.wall * PP.runSpeed * 1.15; b.facing = -b.wall; b.wallLock = 0.14; b.buffer = 0;
                    if (fx) fx.wallJump(b);
                }
            }
            b.x += b.vx * DT;
            if (overlapsSolid(b.x, b.y, PW, PH)) {
                if (b.vx > 0) b.x = Math.floor((b.x + PW) / T) * T - PW;
                else if (b.vx < 0) b.x = Math.floor(b.x / T + 1) * T;
                if (b.dashT > 0) b.dashT = 0;
                b.vx = 0;
            }
            const wasGround = b.onGround, fallSpeed = b.vy;
            b.y += b.vy * DT;
            if (overlapsSolid(b.x, b.y, PW, PH)) {
                if (b.vy > 0) b.y = Math.floor((b.y + PH) / T) * T - PH;
                else if (b.vy < 0) b.y = Math.floor(b.y / T + 1) * T;
                b.vy = 0;
            }
            b.onGround = overlapsSolid(b.x, b.y + 1, PW, PH) && b.vy >= 0;
            if (b.onGround) { b.canDash = true; if (!wasGround && fx) fx.land(b, fallSpeed); }
            b.wall = b.onGround ? 0 : overlapsSolid(b.x - 1, b.y, PW, PH) ? -1 : overlapsSolid(b.x + 1, b.y, PW, PH) ? 1 : 0;
            b.sx += (1 - b.sx) * 0.18; b.sy += (1 - b.sy) * 0.18;
            return jumpV;
        }

        /* ---------- run state ---------- */
        const input = { left: false, right: false, jump: false, jumpPressed: false, dashPressed: false };
        let pl, shards, enemies, boss, orbs, waves, particles, shake, runTime, running, finished, labels, deaths, inv;
        let rec, ghost, splits, active = false, editing = false;

        const bitsOf = (i) => (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.jump ? 4 : 0) | (i.jumpPressed ? 8 : 0) | (i.dashPressed ? 16 : 0);
        const inpOf = (b) => ({ left: !!(b & 1), right: !!(b & 2), jump: !!(b & 4), jumpPressed: !!(b & 8), dashPressed: !!(b & 16) });

        function reset() {
            pl = newBody(world.spawn);
            shards = world.shardDefs.map((s, i) => ({ x: s.x, y: s.y, got: false, phase: i * 0.7 }));
            enemies = world.enemyDefs.map((e) => ({ x: e.x, y: e.y, vx: 0, vy: 0, dir: -1, homeX: e.x, state: "patrol", t: 0, lost: 0, alive: true, onGround: false, flip: 0 }));
            boss = world.bossDef ? { x: world.bossDef.x, y: world.bossDef.y, vx: 0, vy: 0, w: 40, h: 36, hp: 6, maxHp: 6, state: "intro", t: 1.2, dir: -1, inv: 0, flash: 0, step: 0, onGround: true } : null;
            orbs = []; waves = []; particles = []; labels = [];
            shake = 0; runTime = 0; running = false; finished = false; deaths = 0; inv = 0;
            rec = { bits: [], ev: [] };
            splits = [];
            setupGhost();
            updateHUD();
            renderSplits();
        }

        /* ---------- ghosts ---------- */
        const ghostStore = () => store.get("lab-ghosts", {});
        function bestGhost() { return ghostStore()[roomKey] || null; }
        function rivalGhost() { const r = store.get("lab-rival", null); return r && r.room === roomKey ? r : null; }
        function decodeInputs(rle) {
            const out = [];
            rle.split(".").forEach((tok) => {
                if (!tok) return;
                const [b, n] = tok.split(":");
                const bits = parseInt(b, 36), count = parseInt(n, 36);
                for (let i = 0; i < count && out.length < 120 * 600; i++) out.push(bits);
            });
            return out;
        }
        function encodeInputs(bits) {
            const parts = [];
            for (let i = 0; i < bits.length;) {
                let n = 1;
                while (i + n < bits.length && bits[i + n] === bits[i]) n++;
                parts.push(bits[i].toString(36) + ":" + n.toString(36));
                i += n;
            }
            return parts.join(".");
        }
        function setupGhost() {
            ghost = null;
            if (!TG.ghost) return;
            const rep = rivalGhost() || bestGhost();
            if (!rep) return;
            try {
                ghost = {
                    rep, rival: !!rivalGhost(),
                    inputs: decodeInputs(rep.inputs),
                    ev: rep.ev || [],
                    body: newBody(world.spawn),
                    tick: 0, done: false,
                    P: Object.assign({}, DEFAULTS, rep.P || {}),
                    TG: Object.assign({}, DEFAULT_TOGGLES, rep.TG || {})
                };
            } catch { ghost = null; }
        }
        function stepGhost() {
            if (!ghost || ghost.done || !running) return;
            const i = ghost.tick;
            if (i >= ghost.inputs.length) { ghost.done = true; return; }
            stepBody(ghost.body, inpOf(ghost.inputs[i]), ghost.P, ghost.TG, false, null);
            for (const [tick, type, val] of ghost.ev) {
                if (tick !== i) continue;
                if (type === "D") Object.assign(ghost.body, newBody(world.spawn));
                if (type === "B") ghost.body.vy = val;
            }
            ghost.tick++;
        }
        function renderGhostBox() {
            const best = bestGhost(), rival = rivalGhost();
            ghostBox.innerHTML = `
                <h3 class="side-title">Ghost</h3>
                <p class="ghost-line">${rival ? `Racing a <b>shared ghost</b>: ${rival.t.toFixed(2)}s` : best ? `Racing your best: <b>${best.t.toFixed(2)}s</b>` : "Finish this room to record a ghost."}</p>
                <div class="overlay-actions ghost-actions">
                    ${best ? '<button type="button" class="chip" data-ghost="share">Share my ghost</button>' : ""}
                    ${rival ? '<button type="button" class="chip" data-ghost="clear">Drop shared ghost</button>' : ""}
                </div>`;
        }
        ghostBox.addEventListener("click", async (e) => {
            const b = e.target.closest("[data-ghost]");
            if (!b) return;
            if (b.dataset.ghost === "clear") { store.remove("lab-rival"); setupGhost(); renderGhostBox(); draw(); }
            if (b.dataset.ghost === "share") {
                const best = bestGhost();
                if (!best || roomId === "custom") { b.textContent = "Custom rooms can't share ghosts"; return; }
                const url = location.origin + location.pathname + "#ghost=" + b64.enc(JSON.stringify(Object.assign({ room: roomKey }, best)));
                const ok = await TH.copyText(url);
                b.textContent = ok ? "Link copied!" : "Copy failed";
            }
        });

        /* ---------- splits ---------- */
        const splitStore = () => store.get("lab-splits", {});
        function renderSplits() {
            const goal = boss ? "Hit" : "Shard";
            const best = splitStore()[roomKey] || { splits: [], segs: [] };
            const total = boss ? boss.maxHp : shards.length;
            let rows = "";
            for (let i = 0; i < total; i++) {
                const s = splits[i];
                const b = best.splits[i];
                let delta = "", cls = "";
                if (s && b != null) {
                    const d = s.t - b;
                    delta = (d > 0 ? "+" : "") + d.toFixed(2);
                    cls = d <= 0 ? "ahead" : "behind";
                }
                if (s && s.gold) cls += " gold";
                rows += `<li class="${cls}"><span>${goal} ${i + 1}</span><span>${s ? s.t.toFixed(2) : b != null ? `<i>${b.toFixed(2)}</i>` : "-"}</span><span>${delta}</span></li>`;
            }
            splitsBox.innerHTML = `<h3 class="side-title">Splits</h3><ol class="split-list">${rows || "<li><span>No goals in this room</span></li>"}</ol>`;
        }
        function recordSplit() {
            const best = splitStore()[roomKey] || { splits: [], segs: [] };
            const i = splits.length;
            const prevT = i ? splits[i - 1].t : 0;
            const seg = runTime - prevT;
            const gold = best.segs[i] != null && seg < best.segs[i] - 0.001;
            splits.push({ t: runTime, seg, gold });
            if (gold) { label("GOLD SPLIT"); TH.Ach.unlock("gold-split"); }
            renderSplits();
        }
        function saveSplits(isBest) {
            const all = splitStore();
            const prev = all[roomKey] || { splits: [], segs: [] };
            const segs = splits.map((s, i) => prev.segs[i] == null ? s.seg : Math.min(prev.segs[i], s.seg));
            all[roomKey] = { splits: isBest ? splits.map((s) => s.t) : prev.splits, segs };
            store.set("lab-splits", all);
        }

        /* ---------- HUD ---------- */
        const bests = () => store.get("lab-best", {});
        function updateHUD() {
            if (boss) { hud.goal.textContent = "Boss HP"; hud.shards.textContent = `${boss.hp}/${boss.maxHp}`; }
            else { hud.goal.textContent = "Shards"; hud.shards.textContent = `${shards.filter((s) => s.got).length}/${shards.length}`; }
            hud.time.textContent = runTime.toFixed(2);
            const b = bests()[roomKey];
            hud.best.textContent = b ? b.toFixed(2) : "-";
            hud.deaths.textContent = deaths;
        }

        /* ---------- fx ---------- */
        function puff(x, y, n, spread, color, up = 1) {
            if (!TG.particles) return;
            for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * spread, vy: -Math.random() * 60 * up, life: 0.35 + Math.random() * 0.25, age: 0, size: 2 + Math.random() * 2, color });
        }
        function kick(a) { if (TG.shake && !reduceMotion) shake = Math.max(shake, a); }
        function label(text) { labels.push({ text, age: 0 }); if (labels.length > 3) labels.shift(); }
        const fx = {
            dash(b) { if (TG.squash) { b.sx = 1.4; b.sy = 0.7; } kick(3); puff(b.x + PW / 2, b.y + PH / 2, 10, 160, C.accent, 0.5); label("DASH"); },
            trail(b) { if (TG.particles && Math.random() < 0.6) particles.push({ x: b.x + PW / 2, y: b.y + PH / 2 + (Math.random() - 0.5) * PH, vx: 0, vy: 0, life: 0.2, age: 0, size: 3, color: C.accent }); },
            slide(b) { if (TG.particles && Math.random() < 0.25) particles.push({ x: b.wall > 0 ? b.x + PW : b.x, y: b.y + PH * 0.3, vx: -b.wall * 20, vy: -10, life: 0.3, age: 0, size: 2, color: C.edge }); },
            jump(b, coyote, buffered) { if (TG.squash) { b.sx = 0.7; b.sy = 1.3; } puff(b.x + PW / 2, b.y + PH, 6, 120, C.text); if (coyote) label("COYOTE JUMP"); else if (buffered) label("BUFFERED JUMP"); },
            wallJump(b) { if (TG.squash) { b.sx = 0.75; b.sy = 1.25; } puff(b.wall > 0 ? b.x + PW : b.x, b.y + PH / 2, 6, 120, C.edge); label("WALL JUMP"); },
            land(b, speed) {
                if (speed <= 200) return;
                if (TG.squash) { b.sx = 1.3; b.sy = 0.72; }
                puff(b.x + PW / 2, b.y + PH, Math.min(12, Math.round(speed / 60)), 160, C.text);
                if (speed > 520) kick(4);
            }
        };

        /* ---------- death ---------- */
        function die() {
            if (inv > 0 || finished) return;
            puff(pl.x + PW / 2, pl.y + PH / 2, 20, 260, C.danger, 1.5);
            kick(5);
            deaths++;
            rec.ev.push([rec.bits.length - 1, "D", 0]);
            Object.assign(pl, newBody(world.spawn));
            inv = 1;
            label("OUCH");
            updateHUD();
        }
        function bounce(jumpV) {
            pl.vy = -jumpV * 0.75;
            pl.canDash = true;
            rec.ev.push([rec.bits.length - 1, "B", pl.vy]);
        }
        const overlap = (a, aw, ah, b, bw, bh) => a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;

        /* ---------- enemies: finite state machine ---------- */
        function canSee(e) {
            if (inv > 0) return false;
            const ex = e.x + EW / 2, ey = e.y + EH / 2, px = pl.x + PW / 2, py = pl.y + PH / 2;
            const dx = px - ex;
            if (Math.abs(py - ey) > 26 || Math.abs(dx) > 150) return false;
            if (e.state !== "chase" && Math.sign(dx) !== e.dir) return false;
            const r = Math.floor(ey / T), step = Math.sign(dx);
            for (let c = Math.floor(ex / T); c !== Math.floor(px / T); c += step) if (solid(c, r)) return false;
            return true;
        }
        function ledgeAhead(e) {
            const fx2 = e.dir > 0 ? e.x + EW + 2 : e.x - 2;
            return !solid(Math.floor(fx2 / T), Math.floor((e.y + EH + 2) / T));
        }
        function updateEnemy(e, jumpV) {
            if (!e.alive) return;
            const sees = canSee(e);
            e.t -= DT;
            switch (e.state) {
                case "patrol":
                    e.vx = e.dir * 40;
                    if (sees) { e.state = "notice"; e.t = 0.35; }
                    break;
                case "notice":
                    e.vx = 0;
                    if (e.t <= 0) { e.state = "chase"; e.lost = 1.2; }
                    break;
                case "chase":
                    e.dir = Math.sign(pl.x - e.x) || e.dir;
                    e.vx = e.dir * 95;
                    if (ledgeAhead(e)) e.vx = 0;
                    e.lost = sees ? 1.2 : e.lost - DT;
                    if (e.lost <= 0) { e.state = "search"; e.t = 1.6; e.flip = 0.5; }
                    break;
                case "search":
                    e.vx = 0;
                    e.flip -= DT;
                    if (e.flip <= 0) { e.dir *= -1; e.flip = 0.5; }
                    if (sees) { e.state = "notice"; e.t = 0.25; }
                    else if (e.t <= 0) e.state = "return";
                    break;
                case "return":
                    e.dir = Math.sign(e.homeX - e.x) || e.dir;
                    e.vx = e.dir * 40;
                    if (Math.abs(e.homeX - e.x) < 3) e.state = "patrol";
                    if (sees) { e.state = "notice"; e.t = 0.25; }
                    break;
            }
            if (e.state === "patrol" && e.onGround && ledgeAhead(e)) { e.dir *= -1; e.vx = e.dir * 40; }
            e.vy = Math.min(e.vy + 1800 * DT, MAX_FALL);
            const res = moveBox(e, EW, EH);
            if (res.hitX && (e.state === "patrol" || e.state === "return")) e.dir *= -1;

            // Player interaction
            if (!overlap(pl, PW, PH, e, EW, EH) || inv > 0) return;
            const stomp = pl.vy > 40 && pl.y + PH - e.y < 10;
            if (pl.dashT > 0 || stomp) {
                e.alive = false;
                puff(e.x + EW / 2, e.y + EH / 2, 14, 220, C.danger, 1.2);
                kick(3);
                if (stomp) { bounce(jumpV); TH.Ach.unlock("stomp"); }
                label(stomp ? "STOMP" : "DASH KILL");
            } else die();
        }

        /* ---------- boss: The Warden ---------- */
        const PATTERNS = [["charge", "volley"], ["charge", "slam", "volley"], ["slam", "charge", "volley", "charge"]];
        function bossPhase() { return boss.hp > 4 ? 0 : boss.hp > 2 ? 1 : 2; }
        function bossSpeed() { return [1, 1.15, 1.3][bossPhase()]; }
        function updateBoss(jumpV) {
            const b = boss;
            if (!b) return;
            b.inv = Math.max(0, b.inv - DT);
            b.flash = Math.max(0, b.flash - DT);
            b.t -= DT;
            const px = pl.x + PW / 2, bx = b.x + b.w / 2;
            switch (b.state) {
                case "intro": b.vx = 0; if (b.t <= 0) { b.state = "idle"; b.t = 0.6; } break;
                case "idle":
                    b.vx = 0;
                    b.dir = Math.sign(px - bx) || b.dir;
                    if (b.t <= 0) {
                        const pat = PATTERNS[bossPhase()];
                        const next = pat[b.step % pat.length];
                        b.step++;
                        b.state = "tele-" + next;
                        b.t = next === "charge" ? 0.6 : next === "slam" ? 0.45 : 0.5;
                        b.t /= bossSpeed();
                    }
                    break;
                case "tele-charge": b.vx = 0; if (b.t <= 0) { b.state = "charge"; b.dir = Math.sign(px - bx) || b.dir; } break;
                case "charge": b.vx = b.dir * 300 * bossSpeed(); break;
                case "tele-slam": b.vx = 0; if (b.t <= 0 && b.onGround) { b.state = "slam"; b.vy = -560; b.vx = Math.max(-260, Math.min(260, (px - bx) / 0.95)); } break;
                case "slam": break;
                case "tele-volley":
                    b.vx = 0;
                    if (b.t <= 0) {
                        const n = bossPhase() === 2 ? 5 : 3;
                        for (let i = 0; i < n; i++) {
                            const spread = (i - (n - 1) / 2) * 60;
                            const dxv = (px - bx);
                            orbs.push({ x: bx, y: b.y + 8, vx: Math.max(-320, Math.min(320, dxv * 0.9)) + spread, vy: -380 - Math.random() * 60, r: 5 });
                        }
                        kick(2);
                        b.state = "idle"; b.t = 0.9 / bossSpeed();
                    }
                    break;
                case "stunned": b.vx = 0; if (b.t <= 0) { b.state = "idle"; b.t = 0.5; } break;
                case "recover": b.vx = 0; if (b.t <= 0) { b.state = "idle"; b.t = 0.4; } break;
                case "dead": b.vx = 0; return;
            }
            b.vy = Math.min(b.vy + 1600 * DT, MAX_FALL);
            const res = moveBox(b, b.w, b.h);
            if (b.state === "charge" && res.hitX) {
                b.state = "stunned"; b.t = 1.6; kick(6);
                puff(b.dir > 0 ? b.x + b.w : b.x, b.y + b.h / 2, 18, 260, C.text);
                label("STUNNED!");
            }
            if (b.state === "slam" && res.landed) {
                kick(6);
                waves.push({ x: bx, dir: -1, y: b.y + b.h, life: 1.8 }, { x: bx, dir: 1, y: b.y + b.h, life: 1.8 });
                puff(bx, b.y + b.h, 20, 300, C.text);
                b.state = "recover"; b.t = 0.6;
            }

            // Contact with the player
            if (inv > 0 || !overlap(pl, PW, PH, b, b.w, b.h)) return;
            const stomp = pl.vy > 40 && pl.y + PH - b.y < 12;
            if (b.state === "stunned" && (pl.dashT > 0 || stomp) && b.inv <= 0) {
                b.hp--; b.inv = 0.45; b.flash = 0.3;
                kick(7);
                puff(bx, b.y + b.h / 2, 24, 320, C.danger, 1.5);
                if (stomp) bounce(jumpV); else { pl.vx = -pl.dashDir * 200; pl.dashT = 0; }
                recordSplit();
                label(b.hp > 0 ? "HIT!" : "DOWN!");
                if (b.hp <= 0) { b.state = "dead"; complete(); }
                updateHUD();
            } else if (stomp) {
                bounce(jumpV);
            } else if (b.state !== "dead") die();
        }
        function updateHazards() {
            for (const o of orbs) {
                o.vy += 500 * DT; o.x += o.vx * DT; o.y += o.vy * DT;
                if (overlapsSolid(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2)) { o.dead = true; puff(o.x, o.y, 5, 120, C.danger); }
                if (!o.dead && inv <= 0 && overlap(pl, PW, PH, { x: o.x - o.r, y: o.y - o.r }, o.r * 2, o.r * 2)) { o.dead = true; die(); }
            }
            orbs = orbs.filter((o) => !o.dead && o.y < VH + 20);
            for (const w of waves) {
                w.x += w.dir * 230 * DT; w.life -= DT;
                if (inv <= 0 && pl.y + PH > w.y - 12 && pl.x < w.x + 6 && pl.x + PW > w.x - 6 && pl.y + PH <= w.y + 1) die();
                if (overlapsSolid(w.x + w.dir * 6, w.y - 6, 1, 4)) w.life = 0;
            }
            waves = waves.filter((w) => w.life > 0);
        }

        /* ---------- simulation step ---------- */
        function step() {
            const moon = TH.cheats.state.moon;
            const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
            if (!running && !finished && (dir || input.jumpPressed || input.dashPressed)) running = true;
            if (running) { runTime += DT; rec.bits.push(bitsOf(input)); }
            inv = Math.max(0, inv - DT);

            const jumpV = stepBody(pl, input, P, TG, moon, fx);
            if (touchesSpike(pl.x, pl.y, PW, PH)) die();
            if (pl.y > VH + 40) die();

            if (running && !finished) {
                for (const e of enemies) updateEnemy(e, jumpV);
                updateBoss(jumpV);
                updateHazards();
            }

            for (const s of shards) {
                if (s.got || finished) continue;
                const cx = pl.x + PW / 2, cy = pl.y + PH / 2;
                if (Math.abs(cx - s.x) < 12 && Math.abs(cy - s.y) < 14) {
                    s.got = true;
                    puff(s.x, s.y, 14, 220, C.shard, 1.5);
                    kick(2);
                    recordSplit();
                    if (shards.every((x) => x.got)) complete();
                    updateHUD();
                }
            }
            stepGhost();

            for (const p of particles) { p.age += DT; p.x += p.vx * DT; p.y += p.vy * DT; p.vy += 200 * DT; }
            particles = particles.filter((p) => p.age < p.life);
            labels.forEach((l) => { l.age += DT; });
            labels = labels.filter((l) => l.age < 1.1);
            shake = Math.max(0, shake - DT * 25);
            input.jumpPressed = false;
            input.dashPressed = false;
        }

        /* ---------- completion ---------- */
        function complete() {
            if (finished) return;
            running = false;
            finished = true;
            const cheated = TH.cheats.state.moon;
            const prev = bests()[roomKey];
            const isBest = !cheated && (prev == null || runTime < prev);
            const beatGhost = !cheated && ghost && !ghost.done && runTime < ghost.rep.t;
            if (!cheated) {
                if (isBest) {
                    const all = bests(); all[roomKey] = Number(runTime.toFixed(2)); store.set("lab-best", all);
                    const gs = ghostStore();
                    gs[roomKey] = { t: Number(runTime.toFixed(2)), inputs: encodeInputs(rec.bits), ev: rec.ev, P: Object.assign({}, P), TG: { varJump: TG.varJump, dash: TG.dash, wallJump: TG.wallJump } };
                    try { store.set("lab-ghosts", gs); } catch { /* storage full */ }
                }
                saveSplits(isBest);
                if (beatGhost && ghost) TH.Ach.unlock("ghost-buster");
                if (roomId === "test") { TH.Ach.unlock("shard-collector"); if (runTime < 20) TH.Ach.unlock("speedrunner"); }
                if (ROOMS[roomId].story) {
                    const cleared = new Set(store.get("lab-story", []));
                    cleared.add(roomId);
                    store.set("lab-story", [...cleared]);
                    if (["story1", "story2", "story3", "story4"].every((r) => cleared.has(r))) TH.Ach.unlock("story-clear");
                }
                if (roomId === "boss") TH.Ach.unlock("boss-down");
                if (roomId === "daily") TH.Ach.unlock("daily-lab");
                if (roomId === "custom") TH.Ach.unlock("architect");
                TH.emit("progress", "demo");
            }
            TH.track("lab/clear/" + roomId);
            label(isBest ? "NEW BEST!" : "CLEAR!");
            updateHUD();
            renderRoomTabs();
            renderGhostBox();
            const story = ROOMS[roomId].story;
            const nextRoom = story && story < 4 ? "story" + (story + 1) : story === 4 ? "boss" : null;
            const board = roomId === "custom" ? null : roomId === "daily" ? "lab:daily" : "lab:" + roomId;
            setTimeout(() => {
                if (!finished) return;
                overlayCard.innerHTML = `
                    <p class="overlay-kicker">${cheated ? "Moon gravity (not saved)" : isBest ? "New best time" : "Room clear"} · ${esc(ROOMS[roomId].name)}</p>
                    <div class="overlay-grade">${runTime.toFixed(2)}s</div>
                    <p class="overlay-text">${deaths} death${deaths === 1 ? "" : "s"}${beatGhost ? " · you beat the ghost!" : ""}</p>
                    ${!cheated && board ? TH.leaderboard.formHTML() : ""}
                    <div class="overlay-actions">
                        ${nextRoom ? `<button class="btn btn-green" type="button" data-lab="room" data-room="${nextRoom}">Next: ${esc(ROOMS[nextRoom].name)}</button>` : ""}
                        <button class="btn ${nextRoom ? "btn-ghost" : "btn-green"}" type="button" data-lab="restart"><span class="btn-icon" aria-hidden="true">↻</span> Race again</button>
                        ${roomId === "custom" ? '<button class="btn btn-ghost" type="button" data-lab="edit">Back to editor</button>' : ""}
                    </div>`;
                overlay.classList.remove("hidden");
                if (!cheated && board) TH.leaderboard.bindForm(overlayCard, board, Number(runTime.toFixed(2)));
            }, 900);
        }

        /* ================================================================
           Rendering
           ================================================================ */
        let W = 0, H = 0, scale = 1, ox = 0, oy = 0;
        function resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            W = shell.clientWidth; H = shell.clientHeight;
            canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
            scale = Math.min(W / VW, H / VH);
            ox = (W - VW * scale) / 2; oy = (H - VH * scale) / 2;
            draw();
        }

        function drawBody(b, color, alpha, big) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(b.x + PW / 2, b.y + PH);
            ctx.scale(b.sx, b.sy);
            ctx.fillStyle = color;
            if (alpha > 0.9) { ctx.shadowColor = color; ctx.shadowBlur = b.dashT > 0 ? 14 : 6; }
            if (big) {
                ctx.fillRect(-PW / 2 + 2, -PH * 0.55, PW - 4, PH * 0.55);
                ctx.fillRect(-PW, -PH * 0.55 - PW * 1.6, PW * 2, PW * 1.6);
            } else ctx.fillRect(-PW / 2, -PH, PW, PH);
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            const eyeY = big ? -PH * 0.55 - PW : -PH * 0.75;
            ctx.fillRect(b.facing * (big ? 5 : 2.5) - 1, eyeY, 2.5, big ? 4 : 3);
            ctx.restore();
        }

        const STATE_COL = { patrol: "#8bc34a", notice: "#ffcb6b", chase: "#ff5370", search: "#82aaff", return: "#c792ea" };

        function draw() {
            if (!pl || !W) return;
            const dpr = canvas.width / W || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = C.bg2;
            ctx.fillRect(0, 0, W, H);
            ctx.save();
            const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
            ctx.translate(ox + sx * scale, oy + sy * scale);
            ctx.scale(scale, scale);

            const bg = ctx.createLinearGradient(0, 0, 0, VH);
            bg.addColorStop(0, C.bg1); bg.addColorStop(1, C.bg2);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, VW, VH);
            ctx.strokeStyle = editing ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.03)";
            ctx.lineWidth = 1;
            for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * T + 0.5, 0); ctx.lineTo(c * T + 0.5, VH); ctx.stroke(); }
            for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * T + 0.5); ctx.lineTo(VW, r * T + 0.5); ctx.stroke(); }

            // Tiles
            for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
                const v = world.grid[r][c];
                if (v === 1) {
                    ctx.fillStyle = C.tile; ctx.fillRect(c * T, r * T, T, T);
                    if (!solid(c, r - 1)) { ctx.fillStyle = C.edge; ctx.fillRect(c * T, r * T, T, 2); }
                } else if (v === 2) {
                    ctx.fillStyle = C.danger;
                    for (let k = 0; k < 3; k++) {
                        const x = c * T + 2 + k * 5.5;
                        ctx.beginPath(); ctx.moveTo(x, (r + 1) * T); ctx.lineTo(x + 2.75, r * T + T * 0.45); ctx.lineTo(x + 5.5, (r + 1) * T); ctx.fill();
                    }
                }
            }

            if (editing) { Editor.drawOverlay(); ctx.restore(); return; }

            const now = performance.now() / 1000;
            for (const s of shards) {
                if (s.got) continue;
                ctx.save();
                ctx.translate(s.x, s.y + Math.sin(now * 3 + s.phase) * 2.5);
                ctx.rotate(Math.PI / 4 + Math.sin(now * 2 + s.phase) * 0.2);
                ctx.shadowColor = C.shard; ctx.shadowBlur = 12;
                ctx.fillStyle = C.shard; ctx.fillRect(-4.5, -4.5, 9, 9);
                ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillRect(-1.5, -1.5, 3, 3);
                ctx.restore();
            }

            // Enemies
            for (const e of enemies) {
                if (!e.alive) continue;
                ctx.fillStyle = e.state === "chase" ? C.danger : e.state === "notice" ? "#ffcb6b" : C.text;
                ctx.globalAlpha = 0.9;
                ctx.fillRect(e.x, e.y, EW, EH);
                ctx.globalAlpha = 1;
                ctx.fillStyle = "#000";
                ctx.fillRect(e.x + EW / 2 + e.dir * 3 - 1.5, e.y + 4, 3, 3);
                if (e.state === "notice") { ctx.fillStyle = "#ffcb6b"; ctx.font = "700 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", e.x + EW / 2, e.y - 6); }
                if (e.state === "search") { ctx.fillStyle = "#82aaff"; ctx.font = "700 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("?", e.x + EW / 2, e.y - 6); }
                if (TG.debug) {
                    ctx.fillStyle = STATE_COL[e.state];
                    ctx.font = "9px ui-monospace, Consolas, monospace";
                    ctx.textAlign = "center";
                    ctx.fillText(e.state.toUpperCase(), e.x + EW / 2, e.y - 16);
                    ctx.strokeStyle = STATE_COL[e.state];
                    ctx.globalAlpha = 0.35;
                    ctx.beginPath();
                    const ey = e.y + EH / 2;
                    ctx.moveTo(e.x + EW / 2, ey);
                    ctx.lineTo(e.x + EW / 2 + e.dir * 150, ey - 26);
                    ctx.lineTo(e.x + EW / 2 + e.dir * 150, ey + 26);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }

            // Boss
            if (boss && boss.state !== "dead") {
                const b = boss;
                const tele = b.state.startsWith("tele");
                const wob = tele && !reduceMotion ? (Math.random() - 0.5) * 3 : 0;
                ctx.save();
                ctx.translate(b.x + wob, b.y);
                ctx.fillStyle = b.flash > 0 ? "#ffffff" : b.state === "stunned" ? "#6d6a63" : tele ? C.danger : C.tile;
                ctx.shadowColor = tele ? C.danger : "transparent";
                ctx.shadowBlur = tele ? 20 : 0;
                ctx.fillRect(0, 0, b.w, b.h);
                ctx.shadowBlur = 0;
                ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.strokeRect(1, 1, b.w - 2, b.h - 2);
                ctx.fillStyle = b.state === "stunned" ? "#ffcb6b" : C.danger;
                const ex = b.dir > 0 ? 26 : 8;
                ctx.fillRect(ex, 12, 10, 5);
                if (b.state === "stunned") { ctx.fillStyle = "#ffcb6b"; ctx.font = "700 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("✶ ✶", b.w / 2, -6 + Math.sin(now * 8) * 2); }
                ctx.restore();
                if (TG.debug) {
                    ctx.fillStyle = "#ffcb6b"; ctx.font = "9px ui-monospace, Consolas, monospace"; ctx.textAlign = "center";
                    ctx.fillText(`${b.state.toUpperCase()} · phase ${bossPhase() + 1}`, b.x + b.w / 2, b.y - 18);
                }
                // HP bar, drawn on the floor border so it never collides with the HUD
                ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(VW / 2 - 120, VH - 13, 240, 7);
                ctx.fillStyle = C.danger; ctx.fillRect(VW / 2 - 120, VH - 13, 240 * (b.hp / b.maxHp), 7);
                ctx.fillStyle = C.text; ctx.font = `700 9px ${C.font}`; ctx.textAlign = "right"; ctx.fillText("THE WARDEN", VW / 2 - 128, VH - 6);
            }
            for (const o of orbs) {
                ctx.save(); ctx.shadowColor = C.danger; ctx.shadowBlur = 10; ctx.fillStyle = C.danger;
                ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
            for (const w of waves) {
                ctx.globalAlpha = Math.min(1, w.life);
                ctx.fillStyle = C.danger;
                ctx.beginPath(); ctx.moveTo(w.x - 7, w.y); ctx.lineTo(w.x, w.y - 13); ctx.lineTo(w.x + 7, w.y); ctx.fill();
                ctx.globalAlpha = 1;
            }

            for (const p of particles) { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
            ctx.globalAlpha = 1;

            if (ghost && TG.ghost) {
                drawBody(ghost.body, ghost.rival ? "#c792ea" : C.text, 0.35, false);
                ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "8px sans-serif"; ctx.textAlign = "center";
                ctx.fillText(ghost.rival ? "RIVAL" : "GHOST", ghost.body.x + PW / 2, ghost.body.y - 4);
            }
            if (!(inv > 0 && Math.floor(now * 15) % 2)) drawBody(pl, pl.dashT > 0 ? C.accent : C.player, 1, TH.cheats.state.bighead);

            if (TG.debug) {
                ctx.strokeStyle = "#ff5370"; ctx.lineWidth = 1; ctx.strokeRect(pl.x + 0.5, pl.y + 0.5, PW - 1, PH - 1);
                ctx.strokeStyle = "#ffcb6b";
                ctx.beginPath(); ctx.moveTo(pl.x + PW / 2, pl.y + PH / 2); ctx.lineTo(pl.x + PW / 2 + pl.vx * 0.08, pl.y + PH / 2 + pl.vy * 0.08); ctx.stroke();
                if (pl.wall) { ctx.fillStyle = "rgba(255,83,112,0.6)"; ctx.fillRect(pl.wall > 0 ? pl.x + PW : pl.x - 2, pl.y, 2, PH); }
            }
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
            const lines = [["vx", pl.vx.toFixed(0)], ["vy", pl.vy.toFixed(0)], ["ground", pl.onGround ? "yes" : "no"], ["wall", pl.wall === 0 ? "-" : pl.wall < 0 ? "left" : "right"], ["dash", pl.canDash ? "ready" : "used"]];
            const k = Math.min(1, W / 760);
            ctx.save();
            ctx.translate(W - 156 * k, 60 * k);
            ctx.scale(k, k);
            const x = 0, y = 0;
            ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(x, y, 146, 128);
            ctx.font = "11px ui-monospace, Consolas, monospace"; ctx.textAlign = "left";
            lines.forEach(([k, v], i) => {
                ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText(k, x + 8, y + 16 + i * 14);
                ctx.fillStyle = "#fff"; ctx.fillText(v, x + 64, y + 16 + i * 14);
            });
            const bar = (lbl, value, max, row, color) => {
                const by = y + 16 + row * 14;
                ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText(lbl, x + 8, by);
                ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x + 64, by - 8, 72, 8);
                ctx.fillStyle = color; ctx.fillRect(x + 64, by - 8, 72 * Math.max(0, Math.min(1, max ? value / max : 0)), 8);
            };
            bar("coyote", Math.max(0, pl.coyote), P.coyote / 1000, 5.3, "#c3e88d");
            bar("buffer", Math.max(0, pl.buffer), P.buffer / 1000, 6.5, "#82aaff");
            ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillText("120 Hz fixed step", x + 8, y + 122);
            ctx.restore();
        }

        /* ================================================================
           Level editor (#19)
           ================================================================ */
        const Editor = (() => {
            const TOOLS = [["#", "Wall"], ["^", "Spike"], ["*", "Shard"], ["E", "Enemy"], ["S", "Spawn"], [".", "Erase"]];
            let tool = "#", cells = null, hover = null, painting = false;

            function open() {
                cells = customChars().split("");
                editing = true;
                active = false;
                overlay.classList.add("hidden");
                renderBar();
                rebuild();
            }
            function rebuild() {
                store.set("lab-custom", cells.join(""));
                loadRoom("custom");
                reset();
                draw();
            }
            function renderBar() {
                editorBar.hidden = roomId !== "custom";
                if (roomId !== "custom") return;
                const count = (ch) => cells ? cells.filter((x) => x === ch).length : 0;
                editorBar.innerHTML = editing ? `
                    <div class="chips" role="group" aria-label="Editor tool">
                        ${TOOLS.map(([ch, name]) => `<button type="button" class="chip ${tool === ch ? "active" : ""}" data-tool="${ch}" aria-pressed="${tool === ch}">${name}</button>`).join("")}
                    </div>
                    <div class="chips">
                        <button type="button" class="chip" data-edit="play">▶ Play test</button>
                        <button type="button" class="chip" data-edit="share">Share link</button>
                        <button type="button" class="chip" data-edit="template">Load test room</button>
                        <button type="button" class="chip" data-edit="clear">Clear</button>
                        <span class="ed-count">${count("*")} shards · ${count("E")} enemies</span>
                    </div>
                    <p class="ed-status" role="status"></p>` : `
                    <div class="chips"><button type="button" class="chip" data-edit="edit">✎ Edit this room</button><button type="button" class="chip" data-edit="share">Share link</button></div>
                    <p class="ed-status" role="status"></p>`;
            }
            function status(text) { const s = editorBar.querySelector(".ed-status"); if (s) s.textContent = text; }
            function cellAt(e) {
                const r = canvas.getBoundingClientRect();
                const vx = (e.clientX - r.left - ox) / scale, vy = (e.clientY - r.top - oy) / scale;
                const c = Math.floor(vx / T), rr = Math.floor(vy / T);
                if (c < 1 || c > IC || rr < 1 || rr > IR) return null;
                return { c, r: rr, i: (rr - 1) * IC + (c - 1) };
            }
            function paint(cell) {
                if (!cell) return;
                if (tool === "S") cells = cells.map((ch) => (ch === "S" ? "." : ch));
                if (tool === "*" && cells.filter((x) => x === "*").length >= 20 && cells[cell.i] !== "*") { status("Max 20 shards."); return; }
                if (tool === "E" && cells.filter((x) => x === "E").length >= 10 && cells[cell.i] !== "E") { status("Max 10 enemies."); return; }
                if (cells[cell.i] === tool) return;
                cells[cell.i] = tool;
                rebuild();
                renderBar();
            }
            canvas.addEventListener("pointerdown", (e) => {
                if (!editing) return;
                e.preventDefault();
                painting = true;
                try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                paint(cellAt(e));
            });
            canvas.addEventListener("pointermove", (e) => {
                if (!editing) return;
                hover = cellAt(e);
                if (painting && tool !== "S") paint(hover);
                else draw();
            });
            canvas.addEventListener("pointerup", () => { painting = false; });
            canvas.addEventListener("pointerleave", () => { hover = null; if (editing) draw(); });

            editorBar.addEventListener("click", async (e) => {
                const t = e.target.closest("[data-tool]");
                if (t) { tool = t.dataset.tool; renderBar(); return; }
                const a = e.target.closest("[data-edit]");
                if (!a) return;
                const act = a.dataset.edit;
                if (act === "edit") open();
                if (act === "clear" && confirm("Clear the whole room?")) { cells = Array(IC * IR).fill("."); cells[(IR - 1) * IC + 1] = "S"; rebuild(); renderBar(); }
                if (act === "template") { cells = defToChars(ROOMS.test.def()).split(""); rebuild(); renderBar(); }
                if (act === "play") {
                    if (!cells.includes("*")) { status("Add at least one shard first."); return; }
                    editing = false;
                    renderBar();
                    reset();
                    activate();
                }
                if (act === "share") {
                    const url = location.origin + location.pathname + "#lab=" + b64.enc(rleEnc((cells || customChars().split("")).join("")));
                    const ok = await TH.copyText(url);
                    status(ok ? "Link copied to clipboard." : url);
                }
            });

            function drawOverlay() {
                // Entities as icons
                cells.forEach((ch, i) => {
                    if (!"*ES".includes(ch)) return;
                    const c = (i % IC) + 1, r = Math.floor(i / IC) + 1, x = c * T, y = r * T;
                    if (ch === "*") { ctx.fillStyle = C.shard; ctx.save(); ctx.translate(x + T / 2, y + T / 2); ctx.rotate(Math.PI / 4); ctx.fillRect(-4.5, -4.5, 9, 9); ctx.restore(); }
                    if (ch === "E") { ctx.fillStyle = C.danger; ctx.fillRect(x + 3, y + 6, EW, EH); }
                    if (ch === "S") { ctx.fillStyle = C.player; ctx.fillRect(x + 4, y + 2, PW, PH); ctx.fillStyle = "#000"; ctx.font = "700 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText("S", x + 10, y + 15); }
                });
                if (hover) {
                    ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
                    ctx.strokeRect(hover.c * T + 1, hover.r * T + 1, T - 2, T - 2);
                }
                ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(VW / 2 - 110, VH - 34, 220, 20);
                ctx.fillStyle = C.text; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
                ctx.fillText("EDIT MODE · click or drag to paint", VW / 2, VH - 20);
            }

            function loadFromHash() {
                const m = location.hash.match(/^#lab=([\w-]+)/);
                if (!m) return false;
                try {
                    const chars = rleDec(b64.dec(m[1]));
                    store.set("lab-custom", chars);
                    return true;
                } catch { return false; }
            }

            return { open, renderBar, drawOverlay, loadFromHash, close: () => { editing = false; } };
        })();

        /* ================================================================
           Loop, focus and overlays
           ================================================================ */
        let acc = 0, last = 0, looping = false;
        function frame(now) {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            acc += dt;
            while (acc >= DT) { step(); acc -= DT; }
            if (running) updateHUD();
            draw();
            if (active) requestAnimationFrame(frame); else looping = false;
        }
        function startLoop() {
            if (looping) return;
            looping = true; last = performance.now(); acc = 0;
            requestAnimationFrame(frame);
        }
        function activate() {
            if (editing) return;
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
                    <p class="overlay-kicker">Paused · ${esc(ROOMS[roomId].name)}</p>
                    <h3 class="overlay-title">Click to resume</h3>
                    <p class="overlay-text">The lab pauses when it loses focus so it doesn't steal your keys.</p>
                    <div class="overlay-actions">
                        <button class="btn btn-green" type="button" data-lab="resume"><span class="btn-icon" aria-hidden="true">▶</span> Resume</button>
                        <button class="btn btn-ghost" type="button" data-lab="restart">Restart room</button>
                    </div>`;
                overlay.classList.remove("hidden");
            }
        }
        function showIntro() {
            const R = ROOMS[roomId];
            const best = bests()[roomKey];
            overlayCard.innerHTML = `
                <p class="overlay-kicker">Game Feel Lab · ${esc(R.name)}${roomId === "daily" ? " · " + TH.dateKey() : ""}</p>
                <h3 class="overlay-title">${R.kind === "boss" ? "Defeat the Warden" : `Collect all ${world.shardDefs.length} shards`}</h3>
                <p class="overlay-text">${esc(R.desc)}</p>
                <p class="overlay-text small">Move <kbd>A</kbd><kbd>D</kbd> · Jump <kbd>Space</kbd> · Dash <kbd>Shift</kbd> · Restart <kbd>R</kbd>${best != null ? ` · Best ${best.toFixed(2)}s` : ""}</p>
                <div class="overlay-actions">
                    <button class="btn btn-green" type="button" data-lab="play"><span class="btn-icon" aria-hidden="true">▶</span> Play</button>
                    ${roomId === "custom" ? '<button class="btn btn-ghost" type="button" data-lab="edit">Edit room</button>' : ""}
                </div>`;
            overlay.classList.remove("hidden");
        }

        function selectRoom(id) {
            if (!ROOMS[id]) return;
            Editor.close();
            active = false;
            loadRoom(id);
            reset();
            renderRoomTabs();
            Editor.renderBar();
            renderGhostBox();
            showIntro();
            draw();
            store.set("lab-room", id);
        }
        function renderRoomTabs() {
            const cleared = new Set(store.get("lab-story", []));
            const b = bests();
            roomsBar.innerHTML = ROOM_ORDER.map((id) => {
                const R = ROOMS[id];
                const done = R.story ? cleared.has(id) : id === "daily" ? b["daily:" + TH.dateKey()] != null : b[id] != null;
                return `<button type="button" role="tab" class="room-tab ${id === roomId ? "active" : ""}" aria-selected="${id === roomId}" data-room="${id}" title="${esc(R.name)}">
                            ${esc(R.tab)}${done ? '<span class="room-done" aria-label="cleared">✓</span>' : ""}
                        </button>`;
            }).join("");
        }
        roomsBar.addEventListener("click", (e) => { const b = e.target.closest("[data-room]"); if (b) selectRoom(b.dataset.room); });

        overlay.addEventListener("click", (e) => {
            const b = e.target.closest("[data-lab]");
            if (!b) return;
            const a = b.dataset.lab;
            if (a === "restart") { reset(); activate(); }
            if (a === "resume" || a === "play") activate();
            if (a === "room") { selectRoom(b.dataset.room); activate(); }
            if (a === "edit") Editor.open();
        });
        shell.addEventListener("focusout", (e) => { if (!shell.contains(e.relatedTarget)) deactivate(); });
        shell.addEventListener("pointerdown", (e) => {
            if (!active && !editing && !e.target.closest("button, input, form") && overlay.classList.contains("hidden")) activate();
        });

        /* ---------- input ---------- */
        const KEYMAP = {
            ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
            " ": "jump", ArrowUp: "jump", w: "jump", W: "jump", z: "jump", Z: "jump",
            Shift: "dash", x: "dash", X: "dash", c: "dash", C: "dash"
        };
        function setKey(action, down) {
            if (action === "jump") { if (down && !input.jump) input.jumpPressed = true; input.jump = down; }
            else if (action === "dash") { if (down) input.dashPressed = true; }
            else input[action] = down;
        }
        shell.addEventListener("keydown", (e) => {
            if (e.target.closest("form, input")) return;
            if (editing) return;
            if (!active) {
                if ((e.key === "Enter" || e.key === " ") && e.target === shell) { e.preventDefault(); activate(); }
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
        shell.addEventListener("keyup", (e) => { const action = KEYMAP[e.key]; if (action) setKey(action, false); });

        $$("#labTouch button").forEach((b) => {
            b.tabIndex = -1;
            b.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                if (!active) activate();
                try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                b.classList.add("pressed");
                setKey(b.dataset.k, true);
            });
            const up = () => { b.classList.remove("pressed"); setKey(b.dataset.k, false); };
            b.addEventListener("pointerup", up);
            b.addEventListener("pointercancel", up);
            b.addEventListener("contextmenu", (e) => e.preventDefault());
        });

        // Gamepad-free touch & keyboard are enough; expose a small API for other modules.
        TH.lab = { setInput: setKey, activate, selectRoom };

        /* ---------- settings panel ---------- */
        const fmt = (p, v) => p.unit === "%" ? Math.round(v * 100) + "%" : (p.step < 1 ? Number(v).toFixed(1) : Math.round(v)) + (p.unit === "×" ? "×" : " " + p.unit);
        function renderPanel() {
            $("#labPresets").innerHTML = Object.entries(PRESETS).map(([id, pr]) => `<button type="button" class="chip" data-preset="${id}" aria-pressed="false">${esc(pr.name)}</button>`).join("");
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
            const match = Object.entries(PRESETS).find(([, pr]) => PARAMS.every((p) => Math.abs(pr.values[p.id] - P[p.id]) < 1e-6) && Object.entries(pr.toggles).every(([k, v]) => TG[k] === v));
            $$("#labPresets [data-preset]").forEach((b) => { const m = !!match && match[0] === b.dataset.preset; b.classList.toggle("active", m); b.setAttribute("aria-pressed", String(m)); });
        }
        function syncInputs() {
            PARAMS.forEach((p) => { const i = $(`[data-param="${p.id}"]`); if (i) i.value = P[p.id]; const o = $(`[data-out="${p.id}"]`); if (o) o.textContent = fmt(p, P[p.id]); });
            TOGGLES.forEach((t) => { const box = $(`[data-toggle="${t.id}"]`); if (box) box.checked = TG[t.id]; });
            markPreset();
        }
        $("#labSliders").addEventListener("input", (e) => {
            const id = e.target.dataset.param;
            if (!id) return;
            P[id] = Number(e.target.value);
            $(`[data-out="${id}"]`).textContent = fmt(PARAMS.find((x) => x.id === id), P[id]);
            markPreset(); persist();
            TH.Ach.unlock("feel-engineer");
        });
        $("#labToggles").addEventListener("change", (e) => {
            const id = e.target.dataset.toggle;
            if (!id) return;
            TG[id] = e.target.checked;
            markPreset(); persist();
            if (id === "ghost") { setupGhost(); renderGhostBox(); }
            if (!active) draw();
        });
        $("#labPresets").addEventListener("click", (e) => {
            const b = e.target.closest("[data-preset]");
            if (!b) return;
            const pr = PRESETS[b.dataset.preset];
            Object.assign(P, pr.values); Object.assign(TG, pr.toggles);
            syncInputs(); persist();
        });
        on("cheat", () => { if (!active) draw(); });

        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(shell);
        else window.addEventListener("resize", resize);

        // Shared links: #lab=<level> opens the editor room, #ghost=<replay> loads a rival ghost.
        let startRoom = store.get("lab-room", "test");
        if (!ROOMS[startRoom]) startRoom = "test";
        let scrollTo = false;
        if (Editor.loadFromHash()) { startRoom = "custom"; scrollTo = true; }
        const gm = location.hash.match(/^#ghost=([\w-]+)/);
        if (gm) {
            try {
                const rep = JSON.parse(b64.dec(gm[1]));
                const base = String(rep.room || "").split(":")[0];
                if (ROOMS[base] && typeof rep.inputs === "string" && typeof rep.t === "number") {
                    store.set("lab-rival", rep);
                    startRoom = base;
                    scrollTo = true;
                }
            } catch { /* ignore bad links */ }
        }

        renderPanel();
        selectRoom(startRoom);
        resize();
        if (scrollTo) setTimeout(() => $("#lab").scrollIntoView({ behavior: "auto" }), 300);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    }

    TH.modules.push(["feel-lab", init]);
})();
