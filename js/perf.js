/* =====================================================================
   Performance overlay (#23): FPS, frame-time graph, long frames,
   DOM size and JS heap. Toggle in Settings or with the ` key.
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, on, settings } = TH;

    function init() {
        const box = $("#perf");
        if (!box) return;
        box.innerHTML = `
            <div class="perf-row"><b id="perfFps">--</b><span>fps</span><b id="perfMs">--</b><span>ms</span></div>
            <canvas id="perfGraph" width="180" height="48"></canvas>
            <div class="perf-meta" id="perfMeta"></div>`;
        const cv = $("#perfGraph");
        const ctx = cv.getContext("2d");
        const samples = new Float32Array(180);
        let idx = 0, last = 0, raf = 0, frames = 0, acc = 0, longFrames = 0, lastMeta = 0;

        function frame(now) {
            const dt = last ? now - last : 16.7;
            last = now;
            samples[idx] = dt;
            idx = (idx + 1) % samples.length;
            frames++; acc += dt;
            if (dt > 50) longFrames++;
            if (acc >= 500) {
                $("#perfFps").textContent = Math.round((frames * 1000) / acc);
                $("#perfMs").textContent = (acc / frames).toFixed(1);
                frames = 0; acc = 0;
            }
            if (now - lastMeta > 1000) {
                lastMeta = now;
                const mem = performance.memory ? ` · heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : "";
                const canvases = document.querySelectorAll("canvas").length;
                $("#perfMeta").textContent = `${document.getElementsByTagName("*").length} nodes · ${canvases} canvases · ${longFrames} long frames${mem}`;
            }
            // Graph: green under 16.7 ms, yellow under 33 ms, red above
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            const y60 = cv.height - (16.7 / 50) * cv.height;
            ctx.fillRect(0, y60, cv.width, 1);
            for (let i = 0; i < samples.length; i++) {
                const v = samples[(idx + i) % samples.length];
                const hgt = Math.min(cv.height, (v / 50) * cv.height);
                ctx.fillStyle = v <= 17.5 ? "#5bd16b" : v <= 34 ? "#ffcb6b" : "#ff5370";
                ctx.fillRect(i, cv.height - hgt, 1, hgt);
            }
            raf = requestAnimationFrame(frame);
        }
        function show(v) {
            box.hidden = !v;
            cancelAnimationFrame(raf);
            if (v) { last = 0; raf = requestAnimationFrame(frame); }
        }
        on("settings", ({ key, value }) => { if (key === "perf") show(value); });
        window.addEventListener("keydown", (e) => {
            if (e.key !== "`" || (e.target.closest && e.target.closest("input, textarea, select"))) return;
            settings.set("perf", !settings.get("perf"));
        });
        show(!!settings.get("perf"));
    }
    TH.modules.push(["perf", init]);
})();
