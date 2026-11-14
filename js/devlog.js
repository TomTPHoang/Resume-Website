/* =====================================================================
   Devlog (#24): short write-ups with live, interactive demos
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, $$, store, cssVar, reduceMotion } = TH;

    const color = (v, f) => cssVar(v) || f;
    function fit(cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, w: cv.clientWidth, h: cv.clientHeight };
    }
    // Run a demo's animation only while its post is open and on screen.
    function animate(cv, frameFn) {
        let raf = 0, inView = false, last = 0;
        const loop = (now) => {
            const dt = Math.min(0.25, (now - last) / 1000 || 0.016);
            last = now;
            frameFn(dt);
            raf = inView && cv.offsetParent !== null ? requestAnimationFrame(loop) : 0;
        };
        const start = () => { if (!raf && inView && cv.offsetParent !== null) { last = performance.now(); raf = requestAnimationFrame(loop); } };
        if ("IntersectionObserver" in window) new IntersectionObserver((e) => { inView = e[0].isIntersecting; start(); }).observe(cv);
        return start;
    }

    const POSTS = [
        {
            id: "timestep",
            title: "Fixed timestep: why the same jump should always go the same height",
            date: "Nov 2026",
            tags: ["Physics", "Game loops"],
            body: `
                <p>Browsers call your game loop whenever they can: usually 60 times a second, sometimes 144, and occasionally after a 100 ms hitch. If you integrate physics with whatever frame time you get (<code>pos += vel * dt</code>), a hitch makes one big step and the jump arc changes. Players feel that as "sometimes I jump higher".</p>
                <p>The fix is a <b>fixed timestep with an accumulator</b>: add the real frame time to a bucket, then run the simulation in exact 1/120 s slices until the bucket is empty. Rendering still happens once per frame, but physics always sees the same <code>dt</code>. The Feel Lab on this site works this way, which is also what makes its ghost replays possible: the same inputs always produce the same run.</p>
                <p>Below, both balls get the <i>same</i> stream of frame times. Turn up the hitching and watch the left ball's peaks scatter while the right one stays put.</p>`,
            demo: `
                <canvas class="devlog-canvas" data-demo="timestep" aria-label="Two bouncing balls: variable timestep on the left, fixed timestep on the right"></canvas>
                <label class="slider"><span class="slider-top"><span>Frame hitching</span><output data-out="hitch">30%</output></span>
                    <input type="range" data-ctl="hitch" min="0" max="1" step="0.05" value="0.3"></label>
                <p class="pg-stats" data-out="ts-stats"></p>`,
            init(root) {
                const cv = root.querySelector("[data-demo]");
                let hitch = 0.3;
                root.querySelector("[data-ctl=hitch]").addEventListener("input", (e) => { hitch = Number(e.target.value); root.querySelector("[data-out=hitch]").textContent = Math.round(hitch * 100) + "%"; });
                const G = 1800, V = 620, STEP = 1 / 120;
                const mk = () => ({ y: 0, vy: V, peaks: [], peak: 0 });
                const a = mk(), b = mk();
                let accum = 0;
                const integrate = (s, dt) => {
                    s.vy -= G * dt; s.y += s.vy * dt;
                    s.peak = Math.max(s.peak, s.y);
                    if (s.y <= 0) { s.y = 0; s.vy = V; s.peaks.push(s.peak); if (s.peaks.length > 12) s.peaks.shift(); s.peak = 0; }
                };
                const spread = (p) => p.length ? (Math.max(...p) - Math.min(...p)).toFixed(1) : "0";
                const start = animate(cv, (realDt) => {
                    let dt = realDt;
                    if (Math.random() < hitch * 0.15) dt += 0.04 + Math.random() * 0.08;
                    integrate(a, dt);
                    accum += dt;
                    while (accum >= STEP) { integrate(b, STEP); accum -= STEP; }
                    const { ctx, w, h } = fit(cv);
                    ctx.fillStyle = color("--game-bg", "#0b0f15"); ctx.fillRect(0, 0, w, h);
                    const floor = h - 24, scale = (h - 60) / 120;
                    const drawSide = (s, x0, label, col) => {
                        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x0 + 20, floor, w / 2 - 40, 2);
                        s.peaks.forEach((p) => { ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.fillRect(x0 + 30, floor - p * scale, w / 2 - 60, 1); });
                        ctx.globalAlpha = 1;
                        ctx.fillStyle = col;
                        ctx.beginPath(); ctx.arc(x0 + w / 4, floor - 10 - s.y * scale, 10, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = color("--text", "#c6d4df"); ctx.font = "12px sans-serif"; ctx.textAlign = "center";
                        ctx.fillText(label, x0 + w / 4, 18);
                    };
                    drawSide(a, 0, "Variable timestep", color("--danger", "#ff7b7b"));
                    drawSide(b, w / 2, "Fixed 120 Hz", color("--accent", "#66c0f4"));
                    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(w / 2, 0, 1, h);
                    root.querySelector("[data-out=ts-stats]").textContent = `Peak height spread over the last 12 jumps: variable ${spread(a.peaks)} px · fixed ${spread(b.peaks)} px`;
                });
                return start;
            }
        },
        {
            id: "coyote",
            title: "Coyote time: forgiving the player without them noticing",
            date: "Nov 2026",
            tags: ["Game feel", "Platformers"],
            body: `
                <p>Humans press jump a little late when running off a ledge. The character has technically left the ground, so a strict platformer says "no jump". It feels like the game ate your input.</p>
                <p><b>Coyote time</b> keeps the jump available for a short window (around 80 to 120 ms) after you leave the ground, like a cartoon coyote running off a cliff before gravity notices. Its sibling, the <b>jump buffer</b>, remembers a jump pressed just <i>before</i> landing and fires it on touchdown. Neither is visible, but together they turn "that was unfair" into "I nailed that".</p>
                <p>Try it: the runner sprints toward a gap. Press <kbd>Space</kbd> or tap the demo to jump. Turn coyote time off and see how many "late but fair" jumps fail. In the Feel Lab, Debug view shows both timers live.</p>`,
            demo: `
                <canvas class="devlog-canvas" data-demo="coyote" tabindex="0" aria-label="Runner demo. Press Space or tap to jump the gap."></canvas>
                <label class="toggle"><input type="checkbox" data-ctl="coyote" checked><span class="toggle-ui" aria-hidden="true"></span><span class="toggle-text"><b>Coyote time (120 ms)</b><small>Allow a jump shortly after leaving the ledge</small></span></label>
                <ul class="plain-list coyote-log" data-out="log"></ul>`,
            init(root) {
                const cv = root.querySelector("[data-demo]");
                const log = root.querySelector("[data-out=log]");
                let coyote = true;
                root.querySelector("[data-ctl=coyote]").addEventListener("change", (e) => { coyote = e.target.checked; });
                const SPEED = 170, G = 1500, JV = 520, LEDGE = 0.5, GAP = 0.18;
                let x = 0.05, y = 0, vy = 0, onGround = true, leftAt = null, t = 0, state = "run", msg = "", msgT = 0;
                const add = (text, ok) => {
                    const li = document.createElement("li");
                    li.innerHTML = `<b style="color:${ok ? color("--accent", "#66c0f4") : color("--danger", "#ff7b7b")}">${ok ? "Made it" : "Fell"}</b> ${text}`;
                    log.prepend(li);
                    while (log.children.length > 5) log.lastChild.remove();
                };
                function jump() {
                    if (state !== "run") return;
                    const late = leftAt != null ? (t - leftAt) * 1000 : 0;
                    if (onGround) { vy = JV; onGround = false; msg = "Jump!"; msgT = 0.6; add("on the ledge.", true); state = "air"; }
                    else if (leftAt != null && late <= 120 && coyote) { vy = JV; msg = `Coyote jump (+${late.toFixed(0)} ms)`; msgT = 1; add(`${late.toFixed(0)} ms after the edge, saved by coyote time.`, true); state = "air"; }
                    else if (leftAt != null && late <= 120) { msg = `Too late by ${late.toFixed(0)} ms`; msgT = 1; add(`${late.toFixed(0)} ms after the edge. Coyote time would have saved this.`, false); }
                }
                cv.addEventListener("pointerdown", (e) => { e.preventDefault(); jump(); });
                cv.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); jump(); } });
                return animate(cv, (dt) => {
                    const { ctx, w, h } = fit(cv);
                    t += dt;
                    x += (SPEED / w) * dt;
                    const ground = h - 40;
                    const overGap = x > LEDGE && x < LEDGE + GAP;
                    if (onGround && overGap) { onGround = false; leftAt = t; }
                    if (!onGround) {
                        vy -= G * dt; y += vy * dt;
                        if (y <= 0 && !overGap) { y = 0; vy = 0; onGround = true; leftAt = null; state = "run"; }
                        if (y < -120) { if (state === "run") add("never jumped.", false); x = 0.05; y = 0; vy = 0; onGround = true; leftAt = null; state = "run"; }
                    }
                    if (x > 1.02) { x = 0.05; state = "run"; leftAt = null; }
                    ctx.fillStyle = color("--game-bg", "#0b0f15"); ctx.fillRect(0, 0, w, h);
                    ctx.fillStyle = color("--lab-tile", "#22374d");
                    ctx.fillRect(0, ground, w * LEDGE, 40);
                    ctx.fillRect(w * (LEDGE + GAP), ground, w, 40);
                    ctx.fillStyle = color("--lab-edge", "#66c0f4");
                    ctx.fillRect(0, ground, w * LEDGE, 2); ctx.fillRect(w * (LEDGE + GAP), ground, w, 2);
                    if (coyote) {
                        ctx.fillStyle = "rgba(195,232,141,0.18)";
                        ctx.fillRect(w * LEDGE, ground - 60, (SPEED * 0.12), 60);
                        ctx.fillStyle = "rgba(195,232,141,0.7)"; ctx.font = "10px sans-serif"; ctx.textAlign = "left";
                        ctx.fillText("coyote window", w * LEDGE + 2, ground - 64);
                    }
                    ctx.fillStyle = color("--lab-player", "#a3cf06");
                    ctx.fillRect(x * w - 7, ground - 22 - y * 0.5, 14, 22);
                    if (msgT > 0) { msgT -= dt; ctx.fillStyle = color("--accent", "#66c0f4"); ctx.font = "600 14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(msg, w / 2, 24); }
                });
            }
        },
        {
            id: "easing",
            title: "Easing: the difference between moving and feeling alive",
            date: "Nov 2026",
            tags: ["Animation", "UI"],
            body: `
                <p>Linear motion starts and stops instantly, which reads as robotic. Real objects accelerate and settle. An <b>easing function</b> remaps time from 0→1 into progress, so the same 400 ms animation can feel snappy, heavy, playful or springy.</p>
                <p>Common rules of thumb: <i>ease-out</i> for things entering or responding to input (fast start, soft landing), <i>ease-in</i> for things leaving, <i>ease-in-out</i> for moves between two resting states, and <i>back/elastic</i> sparingly for personality. This site uses them on card tilts, the journey marker and the achievement toasts.</p>`,
            demo: `
                <canvas class="devlog-canvas" data-demo="easing" aria-label="Easing curve and animated comparison"></canvas>
                <div class="pg-toolbar">
                    <label class="mini-select"><span>Easing</span><select data-ctl="ease">
                        <option value="easeOutCubic">easeOutCubic</option><option value="easeInOutCubic">easeInOutCubic</option><option value="easeInCubic">easeInCubic</option>
                        <option value="easeOutBack">easeOutBack</option><option value="easeOutElastic">easeOutElastic</option><option value="easeOutBounce">easeOutBounce</option></select></label>
                    <label class="slider inline-slider"><span class="slider-top"><span>Duration</span><output data-out="dur">800 ms</output></span><input type="range" data-ctl="dur" min="200" max="2000" step="50" value="800"></label>
                </div>`,
            init(root) {
                const cv = root.querySelector("[data-demo]");
                const E = {
                    easeInCubic: (t) => t * t * t,
                    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
                    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
                    easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
                    easeOutElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
                    easeOutBounce: (t) => {
                        const n1 = 7.5625, d1 = 2.75;
                        if (t < 1 / d1) return n1 * t * t;
                        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
                        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
                        return n1 * (t -= 2.625 / d1) * t + 0.984375;
                    }
                };
                let ease = "easeOutCubic", dur = 0.8, clock = 0;
                root.querySelector("[data-ctl=ease]").addEventListener("change", (e) => { ease = e.target.value; clock = 0; });
                root.querySelector("[data-ctl=dur]").addEventListener("input", (e) => { dur = Number(e.target.value) / 1000; root.querySelector("[data-out=dur]").textContent = e.target.value + " ms"; });
                return animate(cv, (dt) => {
                    clock = (clock + dt) % (dur + 0.8);
                    const t = Math.min(1, clock / dur);
                    const { ctx, w, h } = fit(cv);
                    ctx.fillStyle = color("--game-bg", "#0b0f15"); ctx.fillRect(0, 0, w, h);
                    const gw = Math.min(200, w * 0.35), gx = 16, gy = 16, gh = h - 40;
                    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.strokeRect(gx, gy, gw, gh);
                    ctx.strokeStyle = "rgba(255,255,255,0.2)";
                    ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy); ctx.stroke();
                    ctx.strokeStyle = color("--accent", "#66c0f4"); ctx.lineWidth = 2; ctx.beginPath();
                    for (let i = 0; i <= 60; i++) { const k = i / 60, v = E[ease](k); const px = gx + k * gw, py = gy + gh - v * gh * 0.8 - gh * 0.1; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
                    ctx.stroke(); ctx.lineWidth = 1;
                    const v = E[ease](t);
                    ctx.fillStyle = "#ffcb6b";
                    ctx.beginPath(); ctx.arc(gx + t * gw, gy + gh - v * gh * 0.8 - gh * 0.1, 4, 0, Math.PI * 2); ctx.fill();
                    const lx = gx + gw + 30, lw = w - lx - 30;
                    const row = (y, val, label, col) => {
                        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(lx, y + 10, lw, 2);
                        ctx.fillStyle = col; ctx.fillRect(lx + val * (lw - 24), y, 24, 24);
                        ctx.fillStyle = color("--muted", "#8f98a0"); ctx.font = "11px sans-serif"; ctx.textAlign = "left"; ctx.fillText(label, lx, y - 6);
                    };
                    row(h * 0.3, t, "linear", "rgba(255,255,255,0.4)");
                    row(h * 0.65, v, ease, color("--accent", "#66c0f4"));
                });
            }
        }
    ];

    function init() {
        const list = $("#devlogList");
        if (!list) return;
        const read = new Set(store.get("devlog-read", []));
        list.innerHTML = POSTS.map((p, i) => `
            <details class="devlog-post reveal" data-post="${p.id}" ${i === 0 ? "open" : ""}>
                <summary>
                    <span class="devlog-meta">${p.date} · ${p.tags.join(" · ")}</span>
                    <span class="devlog-title">${p.title}</span>
                </summary>
                <div class="devlog-body">${p.body}</div>
                <div class="devlog-demo">${p.demo}</div>
            </details>`).join("");
        POSTS.forEach((p) => {
            const el = list.querySelector(`[data-post="${p.id}"]`);
            const start = p.init(el);
            const mark = () => {
                if (!el.open) return;
                read.add(p.id);
                store.set("devlog-read", [...read]);
                if (POSTS.every((x) => read.has(x.id))) TH.Ach.unlock("reader");
                if (!reduceMotion) setTimeout(start, 50); else start();
            };
            el.addEventListener("toggle", mark);
            if (el.open) setTimeout(mark, 100);
        });
    }
    TH.modules.push(["devlog", init]);
})();
