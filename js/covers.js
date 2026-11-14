/* =====================================================================
   Animated placeholder cover art.
   Every .cover-art element (rendered when a game has no `cover` image)
   gets a small canvas animation picked by its data-art type:
   rhythm | metroidvania | fps | quiz | web.
   Only covers on screen animate; reduced-motion users get a still frame.
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { reduceMotion, on } = TH;

    const items = new Set();
    let running = false;

    const io = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => entries.forEach((e) => {
            const it = e.target.__cover;
            if (it) { it.visible = e.isIntersecting; if (it.visible) start(); }
        }), { rootMargin: "80px" })
        : null;
    const ro = "ResizeObserver" in window
        ? new ResizeObserver((entries) => entries.forEach((e) => { const it = e.target.__cover; if (it) size(it); }))
        : null;

    // Deterministic pseudo-random so skylines etc. don't change between frames.
    const hash = (n) => {
        n = (n << 13) ^ n;
        return 1 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824;
    };
    const rnd01 = (i, salt) => (hash(i * 374761 + salt * 668265) + 1) / 2;

    function palette(it) {
        const theme = TH.theme && TH.theme.get();
        if (theme === "expedition") {
            return { bg1: "#16100d", bg2: "#2b0e12", a: "#d4af6a", b: "#b3242f", c: "#efe4cf", dim: "rgba(212,175,106,0.18)" };
        }
        if (theme === "horror") {
            return { bg1: "#2a2926", bg2: "#0b0b0a", a: "#c9c5bc", b: "#a3171c", c: "#e8e2d4", dim: "rgba(201,197,188,0.16)" };
        }
        if (theme === "retro") {
            return { bg1: "#03140a", bg2: "#010603", a: "#4dff88", b: "#ffd84d", c: "#c8ffd8", dim: "rgba(77,255,136,0.16)" };
        }
        const h = it.hue;
        return {
            bg1: `hsl(${h} 45% 15%)`, bg2: `hsl(${h + 25} 55% 7%)`,
            a: `hsl(${h} 85% 62%)`, b: `hsl(${h + 45} 80% 58%)`, c: "#ffffff",
            dim: `hsla(${h}, 90%, 70%, 0.14)`
        };
    }

    function size(it) {
        const r = it.el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        it.W = r.width;
        it.H = r.height;
        it.canvas.width = Math.round(r.width * dpr);
        it.canvas.height = Math.round(r.height * dpr);
        it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(it, performance.now() / 1000);
    }

    function mount(root) {
        (root || document).querySelectorAll(".cover-art").forEach((el) => {
            if (el.__cover) return;
            const canvas = el.querySelector(".cover-canvas");
            if (!canvas) return;
            const it = {
                el, canvas,
                ctx: canvas.getContext("2d"),
                art: el.dataset.art || "web",
                hue: Number(el.style.getPropertyValue("--h")) || 205,
                visible: !io,
                W: 0, H: 0
            };
            el.__cover = it;
            items.add(it);
            if (io) io.observe(el);
            if (ro) ro.observe(el);
            size(it);
        });
        start();
    }

    function start() {
        if (running || reduceMotion) return;
        running = true;
        requestAnimationFrame(loop);
    }

    function loop(now) {
        const t = now / 1000;
        let any = false;
        for (const it of items) {
            if (!it.el.isConnected) {
                items.delete(it);
                if (io) io.unobserve(it.el);
                if (ro) ro.unobserve(it.el);
                continue;
            }
            if (it.visible && it.W) { draw(it, t); any = true; }
        }
        if (any) requestAnimationFrame(loop);
        else running = false;
    }

    function draw(it, t) {
        const { ctx, W, H } = it;
        if (!W || !H) return;
        const p = palette(it);
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, p.bg1);
        bg.addColorStop(1, p.bg2);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.7);
        glow.addColorStop(0, p.dim);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        (ART[it.art] || ART.web)(ctx, W, H, t, p);
        const theme = TH.theme && TH.theme.get();
        if (theme === "horror") {
            // Drifting fog band + film grain
            const fy = H * (0.55 + 0.1 * Math.sin(t * 0.3));
            const fog = ctx.createLinearGradient(0, fy - H * 0.35, 0, fy + H * 0.35);
            fog.addColorStop(0, "rgba(200,198,190,0)");
            fog.addColorStop(0.5, "rgba(200,198,190,0.22)");
            fog.addColorStop(1, "rgba(200,198,190,0)");
            ctx.fillStyle = fog;
            ctx.fillRect(0, 0, W, H);
            for (let i = 0; i < 60; i++) {
                ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
                ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
            }
        } else if (theme === "retro") {
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
        }
    }

    /* ---------------- art types ---------------- */

    const ART = {
        rhythm(ctx, W, H, t, p) {
            const vp = { x: W * 0.68, y: H * 0.02 };
            const bl = W * 0.36, br = W * 1.0, by = H;
            const lerp = (a, b, k) => a + (b - a) * k;
            const laneX = (edge, z) => lerp(vp.x, lerp(bl, br, edge), z);

            // Highway
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.beginPath();
            ctx.moveTo(vp.x, vp.y); ctx.lineTo(br, by); ctx.lineTo(bl, by); ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = p.dim;
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(lerp(bl, br, i / 4), by); ctx.stroke();
            }
            // Beat lines rushing toward the player
            for (let k = 0; k < 6; k++) {
                const z = ((t * 0.6 + k / 6) % 1);
                const zz = z * z;
                const y = lerp(vp.y, by, zz);
                ctx.strokeStyle = `rgba(255,255,255,${0.05 + zz * 0.08})`;
                ctx.beginPath(); ctx.moveTo(laneX(0, zz), y); ctx.lineTo(laneX(1, zz), y); ctx.stroke();
            }
            // Hit line
            const hitZ = 0.86;
            const pulse = 0.5 + 0.5 * Math.cos(t * Math.PI * 4);
            const hy = lerp(vp.y, by, hitZ);
            ctx.save();
            ctx.shadowColor = p.a; ctx.shadowBlur = 10 + pulse * 10;
            ctx.strokeStyle = p.a; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(laneX(0, hitZ), hy); ctx.lineTo(laneX(1, hitZ), hy); ctx.stroke();
            ctx.restore();
            // Notes
            const cols = [p.a, p.b, p.c, p.a];
            for (let k = 0; k < 14; k++) {
                const lane = (k * 7 + (k >> 2)) % 4;
                const z = ((t * 0.45 + k / 14) % 1);
                const zz = Math.pow(z, 1.8);
                if (zz > 0.95) continue;
                const y = lerp(vp.y, by, zz);
                const x0 = laneX(lane / 4, zz), x1 = laneX((lane + 1) / 4, zz);
                const w = (x1 - x0) * 0.75, h = Math.max(2, 10 * zz);
                ctx.save();
                ctx.globalAlpha = Math.min(1, zz * 3);
                ctx.shadowColor = cols[lane]; ctx.shadowBlur = 8;
                ctx.fillStyle = cols[lane];
                ctx.fillRect((x0 + x1) / 2 - w / 2, y - h / 2, w, h);
                ctx.restore();
            }
        },

        metroidvania(ctx, W, H, t, p) {
            // Moon
            ctx.fillStyle = p.c;
            ctx.globalAlpha = 0.85;
            ctx.beginPath(); ctx.arc(W * 0.8, H * 0.25, H * 0.11, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            const layers = [
                { speed: 8, tile: H * 0.06, base: 0.55, amp: 0.25, color: "rgba(0,0,0,0.25)", salt: 1 },
                { speed: 18, tile: H * 0.08, base: 0.68, amp: 0.2, color: "rgba(0,0,0,0.45)", salt: 2 },
                { speed: 36, tile: H * 0.1, base: 0.8, amp: 0.12, color: "rgba(0,0,0,0.7)", salt: 3 }
            ];
            let groundAt = () => H;
            layers.forEach((L, li) => {
                const scroll = t * L.speed;
                const first = Math.floor(scroll / L.tile);
                const cols = Math.ceil(W / L.tile) + 2;
                const heights = [];
                for (let c = 0; c < cols; c++) {
                    const i = first + c;
                    const steps = Math.round(rnd01(i, L.salt) * 4);
                    const top = H * (L.base - steps * (L.amp / 4));
                    const x = c * L.tile - (scroll % L.tile);
                    heights.push({ x, top });
                    ctx.fillStyle = L.color;
                    ctx.fillRect(x, top, L.tile + 0.5, H - top);
                    if (li === 2) {
                        ctx.fillStyle = p.a;
                        ctx.globalAlpha = 0.6;
                        ctx.fillRect(x, top, L.tile + 0.5, 2);
                        ctx.globalAlpha = 1;
                    } else if (rnd01(i, L.salt + 9) > 0.7) {
                        ctx.fillStyle = p.dim;
                        ctx.fillRect(x + L.tile * 0.35, top + L.tile * 0.5, L.tile * 0.3, L.tile * 0.3);
                    }
                }
                if (li === 2) {
                    groundAt = (px) => {
                        const h = heights.find((c) => px >= c.x && px < c.x + L.tile);
                        return h ? h.top : H;
                    };
                }
            });
            // Little explorer hopping across rooftops
            const px = W * 0.3;
            const ground = groundAt(px);
            const hop = Math.abs(Math.sin(t * 3.2)) * H * 0.12;
            const s = H * 0.07;
            ctx.save();
            ctx.shadowColor = p.b; ctx.shadowBlur = 10;
            ctx.fillStyle = p.b;
            ctx.fillRect(px - s * 0.35, ground - s - hop, s * 0.7, s);
            ctx.fillStyle = p.c;
            ctx.fillRect(px + s * 0.05, ground - s * 0.8 - hop, s * 0.18, s * 0.14);
            ctx.restore();
        },

        fps(ctx, W, H, t, p) {
            // Ground + fog
            const horizon = H * 0.62;
            const g = ctx.createLinearGradient(0, horizon, 0, H);
            g.addColorStop(0, "rgba(0,0,0,0.1)");
            g.addColorStop(1, "rgba(0,0,0,0.6)");
            ctx.fillStyle = g;
            ctx.fillRect(0, horizon, W, H - horizon);
            // Shamblers at different depths
            const foes = [
                { x: 0.52, d: 0.45, ph: 0.0 }, { x: 0.66, d: 0.7, ph: 1.3 }, { x: 0.82, d: 0.55, ph: 2.1 },
                { x: 0.92, d: 0.9, ph: 0.7 }, { x: 0.42, d: 0.8, ph: 2.8 }
            ];
            foes.sort((a, b) => a.d - b.d).forEach((f) => {
                const sz = H * 0.28 * f.d;
                const x = W * f.x + Math.sin(t * 0.8 + f.ph) * W * 0.02;
                const base = horizon + (H - horizon) * (f.d - 0.3);
                const lean = Math.sin(t * 2 + f.ph) * 0.08;
                ctx.save();
                ctx.translate(x, base);
                ctx.rotate(lean);
                ctx.fillStyle = `rgba(0,0,0,${0.35 + f.d * 0.5})`;
                ctx.beginPath(); ctx.ellipse(0, -sz, sz * 0.18, sz * 0.2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(-sz * 0.2, -sz * 0.82, sz * 0.4, sz * 0.82);
                ctx.fillRect(-sz * 0.2, -sz * 0.7, -sz * 0.35, sz * 0.1);
                ctx.fillRect(sz * 0.2, -sz * 0.72, sz * 0.35, sz * 0.1);
                ctx.fillStyle = p.b;
                ctx.globalAlpha = 0.7;
                ctx.fillRect(-sz * 0.08, -sz * 1.04, sz * 0.05, sz * 0.03);
                ctx.fillRect(sz * 0.04, -sz * 1.04, sz * 0.05, sz * 0.03);
                ctx.restore();
            });
            // Crosshair + periodic shot
            const cx = W * 0.68, cy = H * 0.42, r = H * 0.07;
            const cycle = t % 1.6;
            const firing = cycle < 0.08;
            const marker = cycle < 0.3;
            if (firing) {
                ctx.fillStyle = "rgba(255,240,200,0.12)";
                ctx.fillRect(0, 0, W, H);
            }
            ctx.strokeStyle = p.c;
            ctx.lineWidth = 2;
            const gap = r * (firing ? 0.7 : 0.4);
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                ctx.beginPath();
                ctx.moveTo(cx + dx * gap, cy + dy * gap);
                ctx.lineTo(cx + dx * (gap + r * 0.6), cy + dy * (gap + r * 0.6));
                ctx.stroke();
            });
            if (marker) {
                ctx.strokeStyle = p.b;
                const m = r * 0.35;
                ctx.beginPath();
                ctx.moveTo(cx - m, cy - m); ctx.lineTo(cx - m * 0.4, cy - m * 0.4);
                ctx.moveTo(cx + m, cy - m); ctx.lineTo(cx + m * 0.4, cy - m * 0.4);
                ctx.moveTo(cx - m, cy + m); ctx.lineTo(cx - m * 0.4, cy + m * 0.4);
                ctx.moveTo(cx + m, cy + m); ctx.lineTo(cx + m * 0.4, cy + m * 0.4);
                ctx.stroke();
            }
            // Ammo pips
            const shots = Math.floor(t / 1.6) % 8;
            for (let i = 0; i < 8; i++) {
                ctx.fillStyle = i < 8 - shots ? p.a : "rgba(255,255,255,0.15)";
                ctx.fillRect(W - 14 - i * 7, H * 0.08, 4, 12);
            }
        },

        quiz(ctx, W, H, t, p) {
            // Spinning record
            const cx = W * 0.74, cy = H * 0.4, R = H * 0.3;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t * 1.2);
            ctx.fillStyle = "rgba(0,0,0,0.65)";
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.07)";
            for (let k = 0.45; k < 1; k += 0.08) { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke(); }
            ctx.strokeStyle = p.dim; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, R * 0.8, -0.4, 0.4); ctx.stroke();
            ctx.fillStyle = p.a;
            ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = p.bg2;
            ctx.beginPath(); ctx.arc(0, 0, R * 0.05, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // Equalizer
            const n = 28, bw = W / n;
            for (let i = 0; i < n; i++) {
                const v = 0.5 + 0.25 * Math.sin(t * 5 + i * 0.6) + 0.25 * Math.sin(t * 3.3 + i * 1.7);
                const h = H * 0.08 + v * H * 0.3;
                ctx.fillStyle = i % 3 === 0 ? p.b : p.a;
                ctx.globalAlpha = 0.25 + v * 0.45;
                ctx.fillRect(i * bw + 1, H - h, bw - 2, h);
            }
            ctx.globalAlpha = 1;
        },

        web(ctx, W, H, t, p) {
            // Browser window with a live-typing editor and preview
            const x = W * 0.38, y = H * 0.1, w = W * 0.56, h = H * 0.62;
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(x, y, w, h * 0.1);
            [p.b, p.a, p.c].forEach((c, i) => {
                ctx.fillStyle = c; ctx.globalAlpha = 0.7;
                ctx.beginPath(); ctx.arc(x + 8 + i * 9, y + h * 0.05, 2.5, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
            const cycle = (t % 6) / 6;
            const lines = [0.8, 0.55, 0.7, 0.4, 0.65, 0.5];
            const half = w * 0.48;
            lines.forEach((len, i) => {
                const k = Math.max(0, Math.min(1, cycle * lines.length - i));
                const ly = y + h * 0.18 + i * h * 0.12;
                ctx.fillStyle = i % 2 ? p.a : p.dim;
                ctx.fillRect(x + 8, ly, (half - 16) * len * k, h * 0.05);
                // Mirrored preview on the right
                ctx.fillStyle = i === 0 ? p.b : "rgba(255,255,255,0.12)";
                ctx.globalAlpha = k;
                ctx.fillRect(x + half + 8, ly, (w - half - 16) * (i === 0 ? 0.9 : len), h * (i === 0 ? 0.08 : 0.04));
                ctx.globalAlpha = 1;
                if (k > 0 && k < 1) {
                    ctx.fillStyle = p.c;
                    ctx.fillRect(x + 8 + (half - 16) * len * k + 2, ly - 1, 2, h * 0.07);
                }
            });
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(x + half, y + h * 0.12, 1, h * 0.85);
        }
    };

    on("themechange", () => {
        for (const it of items) if (it.el.isConnected) draw(it, performance.now() / 1000);
    });

    TH.covers = { mount };
})();
