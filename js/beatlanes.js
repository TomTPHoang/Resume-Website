/* =====================================================================
   Beat Lanes: canvas rhythm mini-game
   - 3 songs x 3 difficulties, charts generated from seeded patterns
   - Backing track synthesized live with Web Audio (no audio files)
   - Results screen with a hit-timing graph
   - Audio/input offset with a tap-along calibration
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, esc, store, on, cssVar } = TH;

    const SONGS = [
        { id: "pulse",     name: "Pulse",     bpm: 124, seed: 124, beats: 56, kit: "four",  swing: false },
        { id: "overdrive", name: "Overdrive", bpm: 150, seed: 150, beats: 64, kit: "drive", swing: false },
        { id: "drift",     name: "Drift",     bpm: 96,  seed: 96,  beats: 44, kit: "half",  swing: true }
    ];
    const DIFFS = {
        easy:   { name: "Easy",   travel: 1.6,  onBeat: 0.7,  off: [0.0, 0.12], sixteenths: 0,    chord: 0 },
        normal: { name: "Normal", travel: 1.3,  onBeat: 0.85, off: [0.08, 0.5], sixteenths: 0,    chord: 0.6 },
        hard:   { name: "Hard",   travel: 1.0,  onBeat: 0.95, off: [0.3, 0.75], sixteenths: 0.14, chord: 0.8 }
    };
    const DIFF_KEYS = Object.keys(DIFFS);
    const KEYS = ["d", "f", "j", "k"];
    const WIN = { perfect: 0.045, great: 0.09, good: 0.14 };
    const PTS = { perfect: 300, great: 200, good: 100 };

    function init() {
        const shell = $("#gameShell");
        const canvas = $("#rhythmCanvas");
        if (!shell || !canvas) return;
        const ctx = canvas.getContext("2d");
        const overlay = $("#gameOverlay");
        const card = $("#overlayCard");
        const hud = { score: $("#hudScore"), combo: $("#hudCombo"), acc: $("#hudAcc") };
        const muteBtn = $("#gameMute");
        const offsetRange = $("#offsetRange");
        const offsetOut = $("#offsetOut");

        /* ---------- persistent settings ---------- */
        const sel = Object.assign({ song: "pulse", diff: "normal" }, store.get("beatlanes-sel", {}));
        if (!SONGS.some((s) => s.id === sel.song)) sel.song = "pulse";
        if (!DIFFS[sel.diff]) sel.diff = "normal";
        let offsetMs = Number(store.get("beatlanes-offset", 0)) || 0;
        let muted = store.get("beatlanes-muted", false);

        const song = () => SONGS.find((s) => s.id === sel.song);
        const diff = () => DIFFS[sel.diff];
        const beatLen = () => 60 / song().bpm;

        /* ---------- theme colours ---------- */
        let C = {};
        function readColors() {
            C = {
                lanes: [1, 2, 3, 4].map((i) => cssVar("--lane-" + i) || "#66c0f4"),
                accent: cssVar("--accent") || "#66c0f4",
                text: cssVar("--text") || "#c6d4df",
                grid: cssVar("--game-grid") || "rgba(102,192,244,0.05)",
                laneA: cssVar("--game-lane-a") || "rgba(255,255,255,0.045)",
                laneB: cssVar("--game-lane-b") || "rgba(255,255,255,0.025)",
                perfect: cssVar("--j-perfect") || "#7fe3ff",
                great: cssVar("--j-great") || "#a3cf06",
                good: cssVar("--j-good") || "#e8c060",
                miss: cssVar("--danger") || "#ff7b7b",
                font: cssVar("--font-head") || "sans-serif"
            };
        }
        readColors();
        on("themechange", () => { readColors(); draw(); });

        /* ---------- state ---------- */
        let W = 0, H = 0;
        let state = "idle";   // idle | playing | done | calibrate
        let notes = [], lastNoteT = 0, startAt = 0, nextHalf = 0;
        let score = 0, combo = 0, maxCombo = 0, judged = 0, autoRun = false;
        let counts = { perfect: 0, great: 0, good: 0, miss: 0 };
        let hits = [];        // { t, d (ms), kind }
        const held = [false, false, false, false];
        const flash = [0, 0, 0, 0];
        let bursts = [], popup = null;
        let looping = false, inView = false;
        const pointers = new Map();
        let calib = null;

        /* ---------- audio ---------- */
        let actx = null, master = null, noise = null;
        function audio() {
            if (!actx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                actx = new AC();
                master = actx.createGain();
                master.gain.value = muted ? 0 : 0.45;
                master.connect(actx.destination);
                noise = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.2), actx.sampleRate);
                const d = noise.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (actx.state === "suspended") actx.resume();
            return actx;
        }
        function kick(at, vol = 0.9) {
            const o = actx.createOscillator(), g = actx.createGain();
            o.frequency.setValueAtTime(150, at);
            o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
            g.gain.setValueAtTime(vol, at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
            o.connect(g).connect(master);
            o.start(at); o.stop(at + 0.22);
        }
        function hat(at, vol = 0.2) {
            const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
            s.buffer = noise;
            f.type = "highpass"; f.frequency.value = 7000;
            g.gain.setValueAtTime(vol, at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
            s.connect(f).connect(g).connect(master);
            s.start(at, 0, 0.06);
        }
        function snare(at) {
            const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
            s.buffer = noise;
            f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
            g.gain.setValueAtTime(0.5, at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
            s.connect(f).connect(g).connect(master);
            s.start(at, 0, 0.18);
            const o = actx.createOscillator(), og = actx.createGain();
            o.frequency.setValueAtTime(220, at);
            og.gain.setValueAtTime(0.25, at);
            og.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
            o.connect(og).connect(master);
            o.start(at); o.stop(at + 0.1);
        }
        const BASS = [55, 43.65, 65.41, 49.0]; // A1 F1 C2 G1
        function bass(at, bar, len) {
            const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
            o.type = "sawtooth";
            o.frequency.value = BASS[bar % 4] * 2;
            f.type = "lowpass"; f.frequency.value = 500;
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(0.16, at + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, at + len);
            o.connect(f).connect(g).connect(master);
            o.start(at); o.stop(at + len + 0.02);
        }
        const LANE_FREQ = [392.0, 466.16, 587.33, 698.46];
        function blip(lane, strength) {
            if (!actx) return;
            const at = actx.currentTime;
            const o = actx.createOscillator(), g = actx.createGain();
            o.type = "triangle";
            o.frequency.value = LANE_FREQ[lane];
            g.gain.setValueAtTime(0.2 * strength, at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
            o.connect(g).connect(master);
            o.start(at); o.stop(at + 0.18);
        }
        function playHalfBeat(i, at) {
            const s = song(), B = beatLen();
            const beat = i >> 1, off = i & 1, bar = beat >> 2;
            if (s.kit === "four") {
                if (off) hat(at); else kick(at);
                if (!off && beat % 4 === 0) bass(at, bar, B * 1.8);
            } else if (s.kit === "drive") {
                if (off) hat(at, 0.16);
                else {
                    kick(at, 0.8);
                    if (beat % 2 === 1) snare(at);
                    bass(at, bar, B * 0.8);
                }
            } else {
                if (off) hat(at, 0.1);
                else if (beat % 4 === 0) { kick(at); bass(at, bar, B * 3.5); }
                else if (beat % 4 === 2) snare(at);
                else hat(at, 0.14);
            }
        }
        function setMuted(m) {
            muted = m;
            store.set("beatlanes-muted", m);
            muteBtn.setAttribute("aria-pressed", String(m));
            muteBtn.setAttribute("aria-label", m ? "Unmute game audio" : "Mute game audio");
            if (master) master.gain.value = m ? 0 : 0.45;
        }
        setMuted(muted);
        muteBtn.addEventListener("click", () => setMuted(!muted));

        /* ---------- charts ---------- */
        function mulberry32(seed) {
            return () => {
                seed = (seed + 0x6D2B79F5) | 0;
                let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }
        const halfFrac = () => (song().swing ? 0.66 : 0.5);

        function buildChart() {
            const s = song(), D = diff(), B = beatLen();
            const rand = mulberry32(s.seed * 31 + DIFF_KEYS.indexOf(sel.diff) * 7919);
            const sub = D.sixteenths && !s.swing ? 4 : 2;
            const out = [];
            let last = -1;
            for (let step = 0; step < s.beats * sub; step++) {
                const beatNo = 4 + Math.floor(step / sub);
                const pos = step % sub;
                const p = step / (s.beats * sub);
                let chance, frac;
                if (pos === 0) { chance = D.onBeat; frac = 0; }
                else if (sub === 2 || pos === 2) { chance = D.off[0] + p * (D.off[1] - D.off[0]); frac = sub === 2 ? halfFrac() : 0.5; }
                else { chance = D.sixteenths * (0.5 + p); frac = pos / 4; }
                if (rand() > chance) continue;
                let lane = Math.floor(rand() * 4);
                if (lane === last && rand() < 0.7) lane = (lane + 1 + Math.floor(rand() * 3)) % 4;
                last = lane;
                const t = (beatNo + frac) * B;
                out.push({ t, lane, done: false });
                if (pos === 0 && beatNo % 4 === 0 && p > 0.25 && rand() < D.chord) {
                    out.push({ t, lane: (lane + 2) % 4, done: false });
                }
            }
            return out;
        }

        /* ---------- helpers ---------- */
        const songTime = () => performance.now() / 1000 - startAt;
        const judgeTime = () => songTime() - offsetMs / 1000;
        const accuracy = () => judged ? (counts.perfect + counts.great * 0.7 + counts.good * 0.4) / judged : 1;
        const bestKey = () => `${sel.song}:${sel.diff}`;
        const bests = () => store.get("beatlanes-best-v2", {});

        function updateHUD() {
            hud.score.textContent = score.toLocaleString();
            hud.combo.textContent = combo;
            hud.acc.textContent = (accuracy() * 100).toFixed(1) + "%";
        }

        function renderBest() {
            const b = bests()[bestKey()];
            $("#bestLabel").textContent = `${song().name} / ${diff().name}`;
            $("#bestScore").textContent = b ? Number(b.score).toLocaleString() : "-";
            $("#bestGrade").textContent = b ? b.grade : "";
        }

        function renderOffset() {
            offsetRange.value = offsetMs;
            offsetOut.textContent = (offsetMs > 0 ? "+" : "") + offsetMs + " ms";
        }
        offsetRange.addEventListener("input", () => {
            offsetMs = Number(offsetRange.value);
            store.set("beatlanes-offset", offsetMs);
            renderOffset();
        });

        /* ---------- overlay screens ---------- */
        function segHTML(name, items, current) {
            return `<div class="seg" role="radiogroup" aria-label="${name}">${items.map((it) =>
                `<button type="button" role="radio" aria-checked="${it.id === current}" data-${name.toLowerCase()}="${it.id}">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</button>`
            ).join("")}</div>`;
        }

        function showSetup() {
            state = "idle";
            card.innerHTML = `
                <p class="overlay-kicker">Beat Lanes</p>
                <h3 class="overlay-title">Pick a song</h3>
                ${segHTML("Song", SONGS.map((s) => ({ id: s.id, label: s.name, sub: s.bpm + " BPM" })), sel.song)}
                ${segHTML("Difficulty", DIFF_KEYS.map((k) => ({ id: k, label: DIFFS[k].name })), sel.diff)}
                <p class="overlay-text">Keys <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>, or tap the lanes.</p>
                <button class="btn btn-green" data-action="start"><span class="btn-icon" aria-hidden="true">▶</span> Play</button>`;
            overlay.classList.remove("hidden");
            renderBest();
        }

        function gradeFor(acc) {
            if (acc >= 0.95) return "S";
            if (acc >= 0.88) return "A";
            if (acc >= 0.78) return "B";
            if (acc >= 0.65) return "C";
            return "D";
        }

        overlay.addEventListener("click", (e) => {
            const songBtn = e.target.closest("[data-song]");
            const diffBtn = e.target.closest("[data-difficulty]");
            const action = e.target.closest("[data-action]");
            if (songBtn || diffBtn) {
                if (songBtn) sel.song = songBtn.dataset.song;
                if (diffBtn) sel.diff = diffBtn.dataset.difficulty;
                store.set("beatlanes-sel", sel);
                const focusAttr = songBtn ? `[data-song="${sel.song}"]` : `[data-difficulty="${sel.diff}"]`;
                showSetup();
                const f = card.querySelector(focusAttr);
                if (f) f.focus({ preventScroll: true });
                return;
            }
            if (!action) return;
            if (action.dataset.action === "start") start();
            if (action.dataset.action === "setup") showSetup();
        });
        // Arrow keys move between options inside a radio group.
        overlay.addEventListener("keydown", (e) => {
            const btn = e.target.closest(".seg button");
            if (!btn || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
            e.preventDefault();
            const list = Array.from(btn.parentElement.children);
            const next = list[(list.indexOf(btn) + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
            next.click();
        });

        /* ---------- game flow ---------- */
        function start() {
            audio();
            notes = buildChart();
            lastNoteT = notes[notes.length - 1].t;
            score = combo = maxCombo = judged = 0;
            counts = { perfect: 0, great: 0, good: 0, miss: 0 };
            hits = []; bursts = []; popup = null; nextHalf = 0;
            autoRun = !!TH.cheats.state.autoplay;
            startAt = performance.now() / 1000 + 0.25;
            state = "playing";
            overlay.classList.add("hidden");
            updateHUD();
            canvas.focus({ preventScroll: true });
            ensureLoop();
        }

        function judge(kind, lane, note, d) {
            counts[kind]++;
            judged++;
            if (kind === "miss") combo = 0;
            else {
                combo++;
                maxCombo = Math.max(maxCombo, combo);
                score += Math.round(PTS[kind] * (1 + Math.min(combo, 100) / 100));
            }
            hits.push({ t: note.t, d, kind });
            popup = { text: kind === "miss" ? "Miss" : kind[0].toUpperCase() + kind.slice(1), color: C[kind], born: performance.now(), lane };
            updateHUD();
        }

        function hitLane(lane) {
            const t = judgeTime();
            let best = null, bestD = Infinity;
            for (const n of notes) {
                if (n.t - t > WIN.good) break;
                if (n.done || n.lane !== lane) continue;
                const d = Math.abs(n.t - t);
                if (d < bestD) { bestD = d; best = n; }
            }
            if (best && bestD <= WIN.good) {
                best.done = true;
                const kind = bestD <= WIN.perfect ? "perfect" : bestD <= WIN.great ? "great" : "good";
                judge(kind, lane, best, Math.round((t - best.t) * 1000));
                blip(lane, kind === "good" ? 0.6 : 1);
                bursts.push({ lane, born: performance.now() });
            }
        }

        function press(lane) {
            held[lane] = true;
            flash[lane] = 1;
            if (state === "playing" && !autoRun) hitLane(lane);
            else if (state === "calibrate") calibTap();
        }
        const release = (lane) => { held[lane] = false; };

        function finish() {
            state = "done";
            const acc = accuracy();
            const grade = gradeFor(acc);
            let isBest = false;
            if (!autoRun) {
                const all = bests();
                const prev = all[bestKey()];
                isBest = !prev || score > prev.score;
                if (isBest) { all[bestKey()] = { score, grade }; store.set("beatlanes-best-v2", all); }
                TH.Ach.unlock("beat-initiate");
                if (acc >= 0.9) TH.Ach.unlock("on-beat");
                if (counts.miss === 0) TH.Ach.unlock("full-combo");
                if (sel.diff === "hard") TH.Ach.unlock("hard-mode");
            }
            renderBest();

            const timed = hits.filter((h) => h.kind !== "miss");
            const mean = timed.length ? Math.round(timed.reduce((a, h) => a + h.d, 0) / timed.length) : 0;
            const tendency = Math.abs(mean) < 8 ? "right on time" : mean > 0 ? `${mean} ms late` : `${-mean} ms early`;

            card.innerHTML = `
                <p class="overlay-kicker">${autoRun ? "Auto-play (not saved)" : isBest ? "New personal best" : "Run complete"} · ${esc(song().name)} / ${esc(diff().name)}</p>
                <div class="result-top">
                    <div class="overlay-grade">${grade}</div>
                    <div class="result-stats">
                        <div><b>${score.toLocaleString()}</b>Score</div>
                        <div><b>${(acc * 100).toFixed(1)}%</b>Accuracy</div>
                        <div><b>${maxCombo}</b>Max combo</div>
                    </div>
                </div>
                <canvas class="timing-graph" width="320" height="86" aria-label="Hit timing graph: on average you were ${tendency}."></canvas>
                <p class="overlay-text small">${counts.perfect} perfect · ${counts.great} great · ${counts.good} good · ${counts.miss} miss · on average ${tendency}</p>
                <div class="overlay-actions">
                    <button class="btn btn-green" data-action="start"><span class="btn-icon" aria-hidden="true">↻</span> Play again</button>
                    <button class="btn btn-ghost" data-action="setup">Change song</button>
                </div>`;
            overlay.classList.remove("hidden");
            drawTimingGraph(card.querySelector(".timing-graph"));
            const again = card.querySelector('[data-action="start"]');
            if (again) again.focus({ preventScroll: true });
        }

        function drawTimingGraph(cv) {
            if (!cv) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = cv.clientWidth || 320, h = cv.clientHeight || 86;
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            const g = cv.getContext("2d");
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            const span = lastNoteT || 1;
            const t0 = notes.length ? notes[0].t : 0;
            const yOf = (ms) => h / 2 + (ms / 140) * (h / 2 - 6);
            const xOf = (t) => 6 + ((t - t0) / Math.max(0.001, span - t0)) * (w - 12);
            g.fillStyle = "rgba(255,255,255,0.04)";
            g.fillRect(0, yOf(-90), w, yOf(90) - yOf(-90));
            g.fillStyle = "rgba(255,255,255,0.05)";
            g.fillRect(0, yOf(-45), w, yOf(45) - yOf(-45));
            g.strokeStyle = "rgba(255,255,255,0.25)";
            g.beginPath(); g.moveTo(0, h / 2 + 0.5); g.lineTo(w, h / 2 + 0.5); g.stroke();
            g.font = "10px sans-serif";
            g.fillStyle = "rgba(255,255,255,0.45)";
            g.fillText("late", 4, h - 4);
            g.fillText("early", 4, 11);
            for (const hit of hits) {
                const x = xOf(hit.t);
                if (hit.kind === "miss") {
                    g.fillStyle = C.miss;
                    g.fillRect(x - 0.5, h - 6, 1.5, 6);
                    continue;
                }
                g.fillStyle = C[hit.kind];
                g.beginPath(); g.arc(x, yOf(hit.d), 2.2, 0, Math.PI * 2); g.fill();
            }
        }

        function abort(reason) {
            state = "idle";
            calib = null;
            card.innerHTML = `
                <p class="overlay-kicker">Paused</p>
                <h3 class="overlay-title">Run stopped</h3>
                <p class="overlay-text">${esc(reason)}</p>
                <div class="overlay-actions">
                    <button class="btn btn-green" data-action="start"><span class="btn-icon" aria-hidden="true">▶</span> Try again</button>
                    <button class="btn btn-ghost" data-action="setup">Change song</button>
                </div>`;
            overlay.classList.remove("hidden");
        }
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && (state === "playing" || state === "calibrate")) {
                abort("You switched tabs, so the run was stopped to keep timing fair.");
            }
        });

        /* ---------- calibration ---------- */
        const CAL_BEATS = 10, CAL_BEAT = 0.6;
        function startCalibration() {
            audio();
            shell.scrollIntoView({ behavior: TH.reduceMotion ? "auto" : "smooth", block: "center" });
            calib = { taps: [], next: 0 };
            startAt = performance.now() / 1000 + 0.8;
            state = "calibrate";
            overlay.classList.add("hidden");
            canvas.focus({ preventScroll: true });
            ensureLoop();
        }
        function calibTap() {
            const t = songTime();
            const k = Math.round(t / CAL_BEAT);
            if (k < 2 || k >= CAL_BEATS) return;
            calib.taps.push((t - k * CAL_BEAT) * 1000);
        }
        function finishCalibration() {
            const taps = calib.taps.slice().sort((a, b) => a - b);
            calib = null;
            if (taps.length < 4) {
                abort("Not enough taps to measure. Tap along with each click, then try again.");
                card.querySelector('[data-action="start"]').outerHTML = "";
                return;
            }
            const median = taps[Math.floor(taps.length / 2)];
            offsetMs = Math.max(-150, Math.min(150, Math.round(median / 5) * 5));
            store.set("beatlanes-offset", offsetMs);
            renderOffset();
            TH.Ach.unlock("in-sync");
            state = "idle";
            card.innerHTML = `
                <p class="overlay-kicker">Calibration</p>
                <h3 class="overlay-title">Offset set to ${offsetMs > 0 ? "+" : ""}${offsetMs} ms</h3>
                <p class="overlay-text">${Math.abs(offsetMs) < 10 ? "You're right on the beat." : offsetMs > 0 ? "You tend to tap a little late, so hits will be judged later to match." : "You tend to tap a little early, so hits will be judged earlier to match."}</p>
                <div class="overlay-actions"><button class="btn btn-green" data-action="setup">Done</button></div>`;
            overlay.classList.remove("hidden");
        }
        $("#calibrateBtn").addEventListener("click", startCalibration);

        /* ---------- input ---------- */
        window.addEventListener("keydown", (e) => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || TH.isModalOpen()) return;
            if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable], #labShell")) return;
            const active = state === "playing" || state === "calibrate";
            if (active && e.key === " ") {
                e.preventDefault();
                if (state === "calibrate") press(0);
                return;
            }
            const lane = KEYS.indexOf(e.key.toLowerCase());
            if (lane < 0 || (!active && !inView)) return;
            if (active) e.preventDefault();
            press(lane);
            ensureLoop();
        });
        window.addEventListener("keyup", (e) => {
            const lane = KEYS.indexOf(e.key.toLowerCase());
            if (lane >= 0) release(lane);
            if (e.key === " ") release(0);
        });

        function geo() {
            const lw = Math.min(100, (W - 32) / 4);
            return { lw, x0: (W - lw * 4) / 2, hitY: H - 80 };
        }
        function laneAt(x) {
            const { lw, x0 } = geo();
            const i = Math.floor((x - x0) / lw);
            return i >= 0 && i < 4 ? i : -1;
        }
        canvas.tabIndex = -1;
        canvas.addEventListener("pointerdown", (e) => {
            const r = canvas.getBoundingClientRect();
            let lane = laneAt(e.clientX - r.left);
            if (state === "calibrate" && lane < 0) lane = 0;
            if (lane < 0) return;
            e.preventDefault();
            try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            pointers.set(e.pointerId, lane);
            press(lane);
        });
        const endPointer = (e) => {
            if (!pointers.has(e.pointerId)) return;
            release(pointers.get(e.pointerId));
            pointers.delete(e.pointerId);
        };
        canvas.addEventListener("pointerup", endPointer);
        canvas.addEventListener("pointercancel", endPointer);

        /* ---------- update ---------- */
        function scheduleBacking(t, until) {
            if (!actx) return;
            const B = beatLen();
            for (;;) {
                const i = nextHalf;
                const bt = (i >> 1) * B + (i & 1 ? halfFrac() * B : 0);
                if (bt >= t + 0.12) break;
                if (bt >= t - 0.03 && bt <= until) playHalfBeat(i, actx.currentTime + Math.max(0, bt - t));
                nextHalf++;
            }
        }

        function update() {
            const t = songTime();
            scheduleBacking(t, lastNoteT + beatLen());

            if (autoRun) {
                for (const n of notes) {
                    if (n.t > t) break;
                    if (!n.done) {
                        held[n.lane] = true; flash[n.lane] = 1;
                        const lane = n.lane;
                        setTimeout(() => release(lane), 70);
                        n.done = true;
                        judge("perfect", n.lane, n, 0);
                        blip(n.lane, 1);
                        bursts.push({ lane: n.lane, born: performance.now() });
                    }
                }
            }

            const jt = judgeTime();
            for (const n of notes) {
                if (n.t - jt > 0) break;
                if (!n.done && jt - n.t > WIN.good) { n.done = true; judge("miss", n.lane, n, 0); }
            }
            if (t > lastNoteT + 1.2) finish();
        }

        function updateCalibration() {
            const t = songTime();
            if (actx) {
                while (calib.next < CAL_BEATS && calib.next * CAL_BEAT < t + 0.12) {
                    const bt = calib.next * CAL_BEAT;
                    if (bt >= t - 0.03) kick(actx.currentTime + Math.max(0, bt - t), calib.next < 2 ? 0.5 : 0.9);
                    calib.next++;
                }
            }
            if (t > CAL_BEATS * CAL_BEAT + 0.3) finishCalibration();
        }

        /* ---------- draw ---------- */
        function hexA(color, a) {
            if (color[0] !== "#") return color;
            const n = parseInt(color.slice(1), 16);
            return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
        }
        function rrect(x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }

        function drawCalibration() {
            const t = songTime();
            const k = Math.max(0, t / CAL_BEAT);
            const phase = k - Math.floor(k + 0.5);
            const pulse = Math.max(0, 1 - Math.abs(phase) * 5);
            const r = 40 + pulse * 22;
            ctx.save();
            ctx.shadowColor = C.accent; ctx.shadowBlur = 20 * pulse;
            ctx.strokeStyle = hexA(C.accent, 0.4 + pulse * 0.6);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(W / 2, H / 2 - 10, r, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            ctx.textAlign = "center";
            ctx.fillStyle = C.text;
            ctx.font = `600 22px ${C.font}`;
            const beatsLeft = Math.max(0, CAL_BEATS - Math.floor(k));
            ctx.fillText(t < 0 ? "Get ready…" : k < 2 ? "Listen…" : "Tap on every click", W / 2, H / 2 + 80);
            ctx.font = `700 34px ${C.font}`;
            ctx.fillText(String(beatsLeft), W / 2, H / 2 + 2);
            ctx.font = "14px sans-serif";
            ctx.fillStyle = hexA(C.accent, 0.8);
            ctx.fillText("Space, any lane key, or tap", W / 2, H / 2 + 106);
        }

        function draw() {
            const now = performance.now();
            ctx.clearRect(0, 0, W, H);
            if (state === "calibrate") { drawCalibration(); return; }

            const t = state === "idle" ? 0 : songTime();
            const B = beatLen();
            const travel = diff().travel;
            const { lw, x0, hitY } = geo();

            // Scrolling grid
            const spacing = 44;
            const off = state === "playing" ? ((t / B) * spacing) % spacing : 0;
            ctx.strokeStyle = C.grid;
            ctx.lineWidth = 1;
            for (let y = (off % spacing) - spacing; y < H; y += spacing) {
                ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
            }

            // Lanes
            for (let i = 0; i < 4; i++) {
                const x = x0 + i * lw;
                ctx.fillStyle = i % 2 ? C.laneB : C.laneA;
                ctx.fillRect(x, 0, lw, H);
                const a = held[i] ? 0.26 : flash[i] * 0.26;
                if (a > 0.01) {
                    const gr = ctx.createLinearGradient(0, hitY, 0, hitY - 280);
                    gr.addColorStop(0, hexA(C.lanes[i], a));
                    gr.addColorStop(1, hexA(C.lanes[i], 0));
                    ctx.fillStyle = gr;
                    ctx.fillRect(x, hitY - 280, lw, 280);
                }
                if (!held[i]) flash[i] = Math.max(0, flash[i] - 0.06);
            }
            ctx.strokeStyle = hexA(C.accent, 0.14);
            for (let i = 0; i <= 4; i++) {
                const x = Math.round(x0 + i * lw) + 0.5;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
            }

            if (state === "playing" && combo >= 5) {
                ctx.fillStyle = "rgba(255,255,255,0.07)";
                ctx.font = `700 88px ${C.font}`;
                ctx.textAlign = "center";
                ctx.fillText(String(combo), W / 2, H * 0.38);
            }
            if (state === "playing" && autoRun) {
                ctx.fillStyle = hexA(C.accent, 0.7);
                ctx.font = `700 14px ${C.font}`;
                ctx.textAlign = "center";
                ctx.fillText("AUTO-PLAY", W / 2, 24);
            }

            // Hit line
            ctx.save();
            ctx.shadowColor = C.accent;
            ctx.shadowBlur = 12;
            ctx.fillStyle = hexA(C.accent, 0.75);
            ctx.fillRect(x0, hitY - 1, lw * 4, 2);
            ctx.restore();

            // Notes
            if (state !== "idle") {
                for (const n of notes) {
                    const dy = (n.t - t) / travel;
                    if (dy > 1.05) break;
                    if (n.done) continue;
                    const y = hitY - dy * (hitY + 30);
                    if (y > H + 20) continue;
                    const x = x0 + n.lane * lw;
                    const col = C.lanes[n.lane];
                    ctx.save();
                    ctx.shadowColor = col;
                    ctx.shadowBlur = 14;
                    const gr = ctx.createLinearGradient(0, y - 10, 0, y + 10);
                    gr.addColorStop(0, "#ffffff");
                    gr.addColorStop(0.35, col);
                    gr.addColorStop(1, hexA(col, 0.75));
                    ctx.fillStyle = gr;
                    rrect(x + 7, y - 10, lw - 14, 20, 6);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Receptors
            ctx.textAlign = "center";
            ctx.font = "600 14px sans-serif";
            for (let i = 0; i < 4; i++) {
                const x = x0 + i * lw;
                rrect(x + 7, hitY - 13, lw - 14, 26, 7);
                ctx.lineWidth = 2;
                ctx.strokeStyle = hexA(C.lanes[i], held[i] ? 1 : 0.45);
                ctx.stroke();
                if (held[i]) { ctx.fillStyle = hexA(C.lanes[i], 0.3); ctx.fill(); }
                ctx.fillStyle = held[i] ? "#ffffff" : hexA(C.text.startsWith("#") ? C.text : "#c6d4df", 0.6);
                ctx.fillText(KEYS[i].toUpperCase(), x + lw / 2, hitY + 42);
            }

            // Bursts
            bursts = bursts.filter((b) => now - b.born < 320);
            for (const b of bursts) {
                const k = (now - b.born) / 320;
                ctx.beginPath();
                ctx.arc(x0 + b.lane * lw + lw / 2, hitY, lw * 0.25 + k * lw * 0.45, 0, Math.PI * 2);
                ctx.lineWidth = 3 * (1 - k) + 0.5;
                ctx.strokeStyle = hexA(C.lanes[b.lane], 1 - k);
                ctx.stroke();
            }

            // Judgement popup
            if (popup) {
                const age = now - popup.born;
                if (age > 550) popup = null;
                else {
                    const k = age / 550;
                    ctx.globalAlpha = 1 - k * k;
                    ctx.fillStyle = popup.color;
                    ctx.font = `700 ${Math.round(30 + (1 - k) * 6)}px ${C.font}`;
                    ctx.fillText(popup.text.toUpperCase(), W / 2, hitY - 120 - k * 14);
                    ctx.globalAlpha = 1;
                }
            }
        }

        /* ---------- loop ---------- */
        function loop() {
            if (state === "playing") update();
            else if (state === "calibrate") updateCalibration();
            draw();
            const active = state === "playing" || state === "calibrate";
            const calm = !active && !held.some(Boolean) && flash.every((f) => f === 0) && !bursts.length && !popup;
            if ((active || inView) && !calm) requestAnimationFrame(loop);
            else looping = false;
        }
        function ensureLoop() {
            if (looping) return;
            looping = true;
            requestAnimationFrame(loop);
        }

        function resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            W = shell.clientWidth;
            H = shell.clientHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            draw();
        }
        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(shell);
        else window.addEventListener("resize", resize);
        resize();

        if ("IntersectionObserver" in window) {
            new IntersectionObserver((entries) => {
                inView = entries[0].isIntersecting;
                if (inView) ensureLoop();
            }, { threshold: 0.4 }).observe(shell);
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

        renderOffset();
        showSetup();
    }

    TH.modules.push(["beatlanes", init]);
})();
