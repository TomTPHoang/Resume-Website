/* =====================================================================
   Extras
   #30 boot screen · #44 guided tour · #48 hire-me quest · #40 relics
   #47 seasonal events · horror flashlight · #45 progress card
   #29 holo trading cards + vCard · #25 architecture map · #31 analytics
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, $$, esc, store, on, emit, settings, reduceMotion, DATA } = TH;
    const root = document.documentElement;
    const isRecruiter = () => root.classList.contains("recruiter");
    const sess = {
        get(k) { try { return sessionStorage.getItem("th:" + k); } catch { return null; } },
        set(k, v) { try { sessionStorage.setItem("th:" + k, v); } catch { /* ignore */ } }
    };

    /* ================================================================
       #31 Analytics (GoatCounter, only on a real host)
       ================================================================ */
    function initAnalytics() {
        const code = (DATA.analytics || {}).goatcounter;
        if (!code || location.protocol === "file:" || !/^[a-z0-9-]+$/i.test(code)) return;
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://gc.zgo.at/count.js";
        s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
        document.head.appendChild(s);
    }

    /* ================================================================
       #30 Boot screen
       ================================================================ */
    function initBoot() {
        const boot = $("#boot");
        const skip = !settings.get("boot") || sess.get("booted") || isRecruiter() || /^#(game|chart|lab|ghost)=/.test(location.hash);
        if (!boot || skip) { emit("boot-done"); return; }
        sess.set("booted", "1");
        const theme = TH.theme.get();
        const name = "Tom Hoang";
        const LINES = {
            steam: `<div class="boot-logo">TH</div><p class="boot-name">${name}</p><div class="boot-bar"><span></span></div><p class="boot-hint">Press any key</p>`,
            expedition: `<div class="boot-logo">TH</div><p class="boot-name">${name}</p><p class="boot-sub">The expedition begins</p><p class="boot-hint">Press any key</p>`,
            horror: `<canvas class="boot-static" aria-hidden="true"></canvas><p class="boot-name">${name}</p><p class="boot-sub">…the radio crackles…</p><p class="boot-hint">Press any key</p>`,
            retro: `<pre class="boot-term">TH-OS v1.2\nMEMORY CHECK .... OK\nLOADING PORTFOLIO .... OK\n\n> ${name.toUpperCase()}_</pre><p class="boot-hint">PRESS ANY KEY</p>`
        };
        boot.innerHTML = `<div class="boot-inner">${LINES[theme] || LINES.steam}</div>`;
        boot.hidden = false;
        document.body.classList.add("booting");
        let raf = 0;
        const cv = $(".boot-static", boot);
        if (cv && !reduceMotion) {
            const ctx = cv.getContext("2d");
            cv.width = 160; cv.height = 90;
            const img = ctx.createImageData(160, 90);
            const tick = () => {
                for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 40; }
                ctx.putImageData(img, 0, 0);
                raf = requestAnimationFrame(tick);
            };
            tick();
        }
        let done = false;
        function finish() {
            if (done) return;
            done = true;
            boot.classList.add("out");
            document.body.classList.remove("booting");
            window.removeEventListener("keydown", finish, true);
            setTimeout(() => { cancelAnimationFrame(raf); boot.hidden = true; boot.innerHTML = ""; emit("boot-done"); }, reduceMotion ? 0 : 450);
        }
        window.addEventListener("keydown", finish, true);
        boot.addEventListener("pointerdown", finish);
        setTimeout(finish, reduceMotion ? 1200 : 3400);
    }

    /* ================================================================
       #44 Guided tour
       ================================================================ */
    function initTour() {
        const box = $("#tour");
        if (!box) return;
        const STEPS = [
            ["#top .profile-main", "Welcome", "I'm Tom, a gameplay, systems and tools programmer. This quick tour shows what's on the site."],
            [".theme-menu-wrap", "Three themes", "Every visit boots into Steam, Expedition or Horror at random. Switch here, or lock one in Settings."],
            ["#featured", "Featured games", "My proudest projects. Open one for its full game page."],
            ["#library", "Library", "Every project, filterable and searchable. Skills further down link straight here."],
            ["#play", "Beat Lanes", "A rhythm game with a chart editor, daily chart and visualizer."],
            ["#lab", "Game Feel Lab", "A platformer with story rooms, enemy AI, a boss and a level editor. Tune the physics live."],
            ["#playground", "Playground", "Pathfinding, particles, shaders and an input-lag tester."],
            ["#achievements", "Achievements", "Unlocked by exploring. Get them all for a secret theme."],
            ["#contact", "Get in touch", "Hiring or collaborating? This is the place. Thanks for taking the tour!"]
        ];
        let i = 0, open = false;
        function position() {
            if (!open) return;
            const target = $(STEPS[i][0]);
            if (!target) return;
            const r = target.getBoundingClientRect();
            const pad = 8;
            const spot = $(".tour-spot", box), tip = $(".tour-tip", box);
            const top = Math.max(r.top - pad, 4), height = Math.min(r.height + pad * 2, window.innerHeight - top - 4);
            Object.assign(spot.style, { left: r.left - pad + "px", top: top + "px", width: r.width + pad * 2 + "px", height: height + "px" });
            const tw = tip.offsetWidth, th = tip.offsetHeight;
            let tx = Math.min(Math.max(12, r.left), window.innerWidth - tw - 12);
            let ty = top + height + 12;
            if (ty + th > window.innerHeight - 12) ty = Math.max(12, top - th - 12);
            if (ty < 12 || ty + th > window.innerHeight - 12) ty = window.innerHeight - th - 16;
            Object.assign(tip.style, { left: tx + "px", top: ty + "px" });
        }
        function show() {
            const [sel, title, text] = STEPS[i];
            const target = $(sel);
            box.innerHTML = `
                <div class="tour-spot"></div>
                <div class="tour-tip" role="dialog" aria-modal="false" aria-labelledby="tourTitle" tabindex="-1">
                    <p class="tour-count">Step ${i + 1} of ${STEPS.length}</p>
                    <h3 id="tourTitle">${esc(title)}</h3>
                    <p>${esc(text)}</p>
                    <div class="overlay-actions">
                        ${i > 0 ? '<button type="button" class="btn btn-ghost btn-sm" data-tour="back">Back</button>' : ""}
                        <button type="button" class="btn btn-green btn-sm" data-tour="next">${i === STEPS.length - 1 ? "Finish" : "Next"}</button>
                        <button type="button" class="text-btn" data-tour="skip">Skip tour</button>
                    </div>
                </div>`;
            if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
            position();
            setTimeout(position, 350);
            setTimeout(position, 800);
            $(".tour-tip", box).focus({ preventScroll: true });
        }
        function start() {
            if (isRecruiter()) return;
            i = 0; open = true; box.hidden = false;
            store.set("tour-offered", true);
            show();
        }
        function end(completed) {
            open = false; box.hidden = true; box.innerHTML = "";
            if (completed) TH.Ach.unlock("guided");
        }
        box.addEventListener("click", (e) => {
            const b = e.target.closest("[data-tour]");
            if (!b) return;
            const a = b.dataset.tour;
            if (a === "next") { if (i === STEPS.length - 1) end(true); else { i++; show(); } }
            if (a === "back") { i = Math.max(0, i - 1); show(); }
            if (a === "skip") end(false);
        });
        document.addEventListener("keydown", (e) => {
            if (!open) return;
            if (e.key === "Escape") end(false);
            if (e.key === "ArrowRight") { e.preventDefault(); if (i < STEPS.length - 1) { i++; show(); } }
            if (e.key === "ArrowLeft") { e.preventDefault(); if (i > 0) { i--; show(); } }
        });
        window.addEventListener("resize", position);
        window.addEventListener("scroll", position, { passive: true });
        $("#tourBtn").addEventListener("click", start);
        on("tour-start", start);

        // Offer the tour once to first-time visitors, after the boot screen.
        on("boot-done", () => {
            if (store.get("tour-offered", false) || isRecruiter() || location.hash) return;
            setTimeout(() => {
                if (open) return;
                const el = document.createElement("div");
                el.className = "tour-offer";
                el.setAttribute("role", "status");
                el.innerHTML = `<span>New here? Take the 60-second tour.</span>
                    <button type="button" class="btn btn-green btn-sm" data-offer="yes">Start</button>
                    <button type="button" class="text-btn" data-offer="no">No thanks</button>`;
                document.body.appendChild(el);
                el.addEventListener("click", (e) => {
                    const b = e.target.closest("[data-offer]");
                    if (!b) return;
                    store.set("tour-offered", true);
                    el.remove();
                    if (b.dataset.offer === "yes") start();
                });
                setTimeout(() => { if (el.isConnected) { el.remove(); } }, 15000);
            }, 1200);
        });
    }

    /* ================================================================
       #48 Hire-me quest
       ================================================================ */
    function initQuest() {
        const box = $("#quest");
        if (!box) return;
        const STEPS = [
            ["game", "Open a game page"],
            ["demo", "Finish a run in Beat Lanes or the Lab"],
            ["resume", "Open the resume"],
            ["contact", "Visit the contact section"]
        ];
        const done = new Set(store.get("quest", []));
        let expanded = false;
        function render() {
            if (store.get("quest-hidden", false)) { box.hidden = true; return; }
            box.hidden = false;
            const n = STEPS.filter(([k]) => done.has(k)).length;
            const complete = n === STEPS.length;
            box.innerHTML = `
                <button type="button" class="quest-pill" aria-expanded="${expanded}" aria-controls="questList">
                    <span class="quest-icon" aria-hidden="true">${complete ? "✔" : "!"}</span>
                    <span>Quest: Recruit Tom <b>${n}/${STEPS.length}</b></span>
                </button>
                <div class="quest-panel" id="questList" ${expanded ? "" : "hidden"}>
                    <ol>${STEPS.map(([k, l]) => `<li class="${done.has(k) ? "done" : ""}"><span aria-hidden="true">${done.has(k) ? "✔" : "○"}</span>${esc(l)}${done.has(k) ? '<span class="sr-only"> (done)</span>' : ""}</li>`).join("")}</ol>
                    ${complete ? '<p class="quest-reward">Quest complete. Reward: an actual conversation with me. <a href="#contact">Say hi</a></p>' : ""}
                    <button type="button" class="text-btn" data-quest="hide">Hide quest</button>
                </div>`;
        }
        box.addEventListener("click", (e) => {
            if (e.target.closest(".quest-pill")) { expanded = !expanded; render(); }
            if (e.target.closest("[data-quest=hide]")) { store.set("quest-hidden", true); render(); }
        });
        on("progress", (k) => {
            const key = k === "contact-seen" ? "contact" : k;
            if (!STEPS.some(([s]) => s === key) || done.has(key)) return;
            done.add(key);
            store.set("quest", [...done]);
            if (STEPS.every(([s]) => done.has(s))) { TH.Ach.unlock("quest"); expanded = true; }
            render();
        });
        on("ach-reset", () => { done.clear(); store.remove("quest-hidden"); render(); });
        render();
    }

    /* ================================================================
       #40 Hidden relics
       ================================================================ */
    function initRelics() {
        const TOTAL = 6;
        const found = new Set(store.get("relics", []));
        const count = $("#relicCount");
        const totalEl = $("#relicTotal");
        if (totalEl) totalEl.textContent = TOTAL;
        const update = () => {
            if (count) count.textContent = found.size;
            $$(".relic").forEach((b) => {
                const got = found.has(b.dataset.relic);
                b.classList.toggle("found", got);
                b.disabled = got;
            });
        };
        document.addEventListener("click", (e) => {
            const b = e.target.closest(".relic");
            if (!b || found.has(b.dataset.relic)) return;
            found.add(b.dataset.relic);
            store.set("relics", [...found]);
            TH.Ach.toast({ name: `Relic ${found.size} of ${TOTAL}`, icon: "✧", h: 50 }, "You found something");
            if (found.size >= TOTAL) TH.Ach.unlock("relic-hunter");
            update();
        });
        on("progress", (k) => { if (k === "game") update(); });
        on("ach-reset", () => { found.clear(); update(); });
        update();
    }

    /* ================================================================
       #47 Seasonal events
       ================================================================ */
    function initSeasonal() {
        const cv = $("#seasonCanvas");
        const banner = $("#seasonBanner");
        if (!cv) return;
        const forced = (location.search.match(/[?&]season=(\w+)/) || [])[1];
        const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
        const season = forced || (
            (m === 12) || (m === 1 && day <= 6) ? "winter" :
            (m === 10 && day >= 15) || (m === 11 && day <= 2) ? "halloween" :
            (m === 2 && day >= 10 && day <= 15) ? "hearts" : null);
        const INFO = {
            winter: ["❄", "Winter event: it's snowing on the site."],
            halloween: ["🦇", "Halloween event: something is fluttering around."],
            hearts: ["♥", "Valentine's week: love is in the air."]
        };
        if (!season || !INFO[season]) return;
        const ctx = cv.getContext("2d");
        let W = 0, H = 0, parts = [], raf = 0;
        function resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            W = window.innerWidth; H = window.innerHeight;
            cv.width = W * dpr; cv.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const make = (any) => ({ x: Math.random() * W, y: any ? Math.random() * H : -20, s: 1 + Math.random() * 3, v: 0.3 + Math.random() * 0.9, ph: Math.random() * 6 });
        function frame() {
            ctx.clearRect(0, 0, W, H);
            for (const p of parts) {
                p.ph += 0.02;
                if (season === "halloween") {
                    p.x += Math.sin(p.ph) * 1.2 + 0.4; p.y += Math.cos(p.ph * 1.3) * 0.6 + 0.15;
                    ctx.fillStyle = "rgba(10,10,10,0.75)";
                    const flap = Math.sin(p.ph * 8) * p.s * 2;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.quadraticCurveTo(p.x - p.s * 4, p.y - flap - p.s * 2, p.x - p.s * 7, p.y);
                    ctx.quadraticCurveTo(p.x - p.s * 3.5, p.y + p.s, p.x, p.y + p.s);
                    ctx.quadraticCurveTo(p.x + p.s * 3.5, p.y + p.s, p.x + p.s * 7, p.y);
                    ctx.quadraticCurveTo(p.x + p.s * 4, p.y - flap - p.s * 2, p.x, p.y);
                    ctx.fill();
                } else if (season === "hearts") {
                    p.y += p.v * 0.8; p.x += Math.sin(p.ph) * 0.5;
                    ctx.fillStyle = "rgba(255,90,130,0.55)"; ctx.font = `${8 + p.s * 4}px sans-serif`; ctx.fillText("♥", p.x, p.y);
                } else {
                    p.y += p.v; p.x += Math.sin(p.ph) * 0.4;
                    ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
                }
                if (p.y > H + 20 || p.x > W + 40) Object.assign(p, make(false));
            }
            raf = requestAnimationFrame(frame);
        }
        function apply() {
            const on2 = settings.get("seasonal") && !reduceMotion && !isRecruiter();
            cancelAnimationFrame(raf);
            cv.hidden = !on2;
            if (on2) {
                resize();
                parts = Array.from({ length: season === "halloween" ? 8 : 60 }, () => make(true));
                frame();
            }
            banner.hidden = !settings.get("seasonal") || isRecruiter() || sess.get("season-dismissed") === season;
        }
        banner.innerHTML = `<span aria-hidden="true">${INFO[season][0]}</span> ${esc(INFO[season][1])} <button type="button" class="text-btn" data-season="off">Turn off</button><button type="button" class="season-close" aria-label="Dismiss">×</button>`;
        banner.addEventListener("click", (e) => {
            if (e.target.closest("[data-season=off]")) settings.set("seasonal", false);
            if (e.target.closest(".season-close")) { sess.set("season-dismissed", season); banner.hidden = true; }
        });
        window.addEventListener("resize", () => { if (!cv.hidden) resize(); });
        on("settings", ({ key }) => { if (key === "seasonal") apply(); });
        on("recruiter", apply);
        apply();
    }

    /* ================================================================
       Horror flashlight
       ================================================================ */
    function initFlashlight() {
        const el = $("#flashlight");
        if (!el) return;
        const fine = window.matchMedia("(pointer: fine)").matches;
        let pending = false, x = window.innerWidth / 2, y = window.innerHeight / 3;
        const apply = () => {
            const on2 = fine && TH.theme.get() === "horror" && settings.get("flashlight") && !isRecruiter();
            el.classList.toggle("on", !!on2);
        };
        window.addEventListener("pointermove", (e) => {
            x = e.clientX; y = e.clientY;
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => { el.style.setProperty("--fx", x + "px"); el.style.setProperty("--fy", y + "px"); pending = false; });
        }, { passive: true });
        on("themechange", apply);
        on("settings", apply);
        on("recruiter", apply);
        apply();
    }

    /* ================================================================
       #45 Progress card (downloadable PNG)
       ================================================================ */
    function initShowcase() {
        const btn = $("#achShare");
        if (!btn) return;
        btn.addEventListener("click", async () => {
            await (document.fonts ? document.fonts.ready : Promise.resolve());
            const W = 1200, H = 630;
            const cv = document.createElement("canvas");
            cv.width = W; cv.height = H;
            const ctx = cv.getContext("2d");
            const css = (v, f) => TH.cssVar(v) || f;
            const bg = ctx.createLinearGradient(0, 0, W, H);
            bg.addColorStop(0, css("--bg-top", "#2a475e"));
            bg.addColorStop(1, css("--bg-deep", "#171a21"));
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            const accent = css("--accent", "#66c0f4"), text = css("--text-bright", "#ffffff"), muted = css("--muted", "#8f98a0");
            const head = css("--font-head", "sans-serif"), body = css("--font", "sans-serif");
            const list = TH.Ach.list, got = list.filter((a) => TH.Ach.has(a.id)).length;
            ctx.fillStyle = accent; ctx.font = `600 22px ${body}`;
            ctx.fillText("TOM HOANG · PORTFOLIO PROGRESS", 60, 80);
            ctx.fillStyle = text; ctx.font = `700 72px ${head}`;
            ctx.fillText(`${got} / ${list.length} achievements`, 60, 160);
            ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(60, 190, W - 120, 14);
            ctx.fillStyle = accent; ctx.fillRect(60, 190, (W - 120) * (got / list.length), 14);
            const cols = 15, size = 64, gap = 10, x0 = 60, y0 = 240;
            list.forEach((a, i) => {
                const x = x0 + (i % cols) * (size + gap), y = y0 + Math.floor(i / cols) * (size + gap);
                const has = TH.Ach.has(a.id);
                if (has) {
                    const g = ctx.createLinearGradient(x, y, x + size, y + size);
                    g.addColorStop(0, `hsl(${a.h} 70% 55%)`); g.addColorStop(1, `hsl(${a.h + 40} 70% 30%)`);
                    ctx.fillStyle = g;
                } else ctx.fillStyle = "rgba(255,255,255,0.06)";
                ctx.fillRect(x, y, size, size);
                ctx.fillStyle = has ? "#fff" : "rgba(255,255,255,0.25)";
                ctx.font = `28px "Segoe UI Symbol", "Noto Sans Symbols 2", sans-serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(has || !a.hidden ? a.icon : "?", x + size / 2, y + size / 2 + 1);
                ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            });
            ctx.fillStyle = muted; ctx.font = `20px ${body}`;
            ctx.fillText(`Relics found: ${store.get("relics", []).length}/6 · Theme: ${TH.theme.list[TH.theme.get()].label} · ${TH.dateKey()}`, 60, H - 50);
            ctx.textAlign = "right";
            ctx.fillText(location.host || "Tom Hoang's portfolio", W - 60, H - 50);
            cv.toBlob((blob) => {
                if (!blob) return;
                TH.download("tom-hoang-progress.png", blob);
                TH.Ach.unlock("shutterbug");
            }, "image/png");
        });
    }

    /* ================================================================
       #29 Holo trading cards + vCard
       ================================================================ */
    function initCards() {
        const grid = $("#cardGrid");
        if (!grid) return;
        const flipped = new Set(store.get("flipped-cards", []));
        const games = DATA.games;
        const contact = DATA.contact || {};
        const playerCard = `
            <div class="tcard tcard--player" data-card="player" tabindex="0" role="button" aria-pressed="false" aria-label="Player card: Tom Hoang. Press to flip.">
                <div class="tcard-inner">
                    <div class="tcard-face tcard-front">
                        <span class="tcard-rarity">Mythic</span>
                        <div class="tcard-art"><img src="images/ThienHoang-480.jpg" alt="" loading="lazy"></div>
                        <div class="tcard-name">Tom Hoang</div>
                        <div class="tcard-type">Player · Game Programmer</div>
                        <div class="tcard-stats"><span>Unity / C#</span><span>C++</span><span>Systems</span></div>
                        <span class="tcard-holo" aria-hidden="true"></span><span class="tcard-glare" aria-hidden="true"></span>
                    </div>
                    <div class="tcard-face tcard-back">
                        <div class="tcard-name">Tom Hoang</div>
                        <p>Gameplay, systems and tools programmer. Open to internships and junior roles.</p>
                        <ul class="plain-list">
                            ${contact.linkedin ? `<li><a href="${esc(contact.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></li>` : ""}
                            ${contact.github ? `<li><a href="${esc(contact.github)}" target="_blank" rel="noopener">GitHub</a></li>` : ""}
                        </ul>
                        <button type="button" class="btn btn-green btn-sm" data-vcard>Save contact (.vcf)</button>
                    </div>
                </div>
            </div>`;
        grid.innerHTML = playerCard + games.map((g) => `
            <div class="tcard" data-card="${esc(g.id)}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(g.title)} card. Press to flip.">
                <div class="tcard-inner">
                    <div class="tcard-face tcard-front">
                        <span class="tcard-rarity">${g.featured ? "Legendary" : "Rare"}</span>
                        <div class="tcard-art">${TH.coverHTML(g)}</div>
                        <div class="tcard-name">${esc(g.title)}</div>
                        <div class="tcard-type">${esc(g.subtitle)}${g.year ? " · " + esc(g.year) : ""}</div>
                        <div class="tcard-stats">${[g.role, g.team, g.engine].filter(Boolean).map((s) => `<span>${esc(s)}</span>`).join("")}</div>
                        <span class="tcard-holo" aria-hidden="true"></span><span class="tcard-glare" aria-hidden="true"></span>
                    </div>
                    <div class="tcard-face tcard-back">
                        <div class="tcard-name">${esc(g.title)}</div>
                        <ul class="plain-list">${(g.built || []).slice(0, 2).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
                        <div class="tag-row">${TH.tagsHTML((g.tech || []).slice(0, 3))}</div>
                        <button type="button" class="btn btn-blue btn-sm" data-open="${esc(g.id)}">Open game page</button>
                    </div>
                </div>
            </div>`).join("");
        TH.mountCovers(grid);
        const total = games.length + 1;

        function flip(card) {
            const on2 = !card.classList.contains("flipped");
            card.classList.toggle("flipped", on2);
            card.setAttribute("aria-pressed", String(on2));
            flipped.add(card.dataset.card);
            store.set("flipped-cards", [...flipped]);
            if (flipped.size >= total) TH.Ach.unlock("collector");
        }
        grid.addEventListener("click", (e) => {
            if (e.target.closest("[data-vcard]")) { downloadVCard(); return; }
            const open = e.target.closest("[data-open]");
            if (open) { TH.openGame(open.dataset.open); return; }
            if (e.target.closest("a")) return;
            const card = e.target.closest(".tcard");
            if (card) flip(card);
        });
        grid.addEventListener("keydown", (e) => {
            const card = e.target.closest(".tcard");
            if (card && e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); flip(card); }
        });
        if (!reduceMotion) {
            grid.addEventListener("pointermove", (e) => {
                const card = e.target.closest(".tcard");
                if (!card || e.pointerType !== "mouse") return;
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
                card.style.setProperty("--rx", ((0.5 - y) * 18).toFixed(2) + "deg");
                card.style.setProperty("--ry", ((x - 0.5) * 22).toFixed(2) + "deg");
                card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
                card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
                card.classList.add("tilting");
            });
            grid.addEventListener("pointerout", (e) => {
                const card = e.target.closest(".tcard");
                if (card && !card.contains(e.relatedTarget)) { card.classList.remove("tilting"); card.style.removeProperty("--rx"); card.style.removeProperty("--ry"); }
            });
        }
        function downloadVCard() {
            const lines = [
                "BEGIN:VCARD", "VERSION:3.0", "N:Hoang;Tom;;;", "FN:Tom Hoang",
                "TITLE:Game Programmer (Gameplay / Systems / Tools)",
                contact.email ? `EMAIL;TYPE=INTERNET:${contact.email}` : "",
                contact.linkedin ? `URL;TYPE=LinkedIn:${contact.linkedin}` : "",
                contact.github ? `URL;TYPE=GitHub:${contact.github}` : "",
                location.protocol.startsWith("http") ? `URL;TYPE=Portfolio:${location.origin}${location.pathname}` : "",
                "NOTE:Open to internships and junior roles in game programming.",
                "END:VCARD"
            ].filter(Boolean);
            TH.download("Tom_Hoang.vcf", lines.join("\r\n"), "text/vcard");
        }
    }

    /* ================================================================
       #25 Under the hood: architecture map
       ================================================================ */
    function initHood() {
        const diagram = $("#hoodDiagram");
        const detail = $("#hoodDetail");
        if (!diagram) return;
        const NODES = {
            data:     { tier: 0, label: "data.js", file: "data.js", desc: "All content: games, skills, journey, patch notes, and config for the contact form, analytics and leaderboards. Editing this one file updates the whole site.", links: ["core"] },
            core:     { tier: 1, label: "script.js · core", file: "script.js", desc: "Creates the shared TH namespace: an event bus (on/emit), namespaced storage, settings, achievements, themes, recruiter view, and renders the featured carousel, library, game pages, skills, journey map and patch notes.", links: ["covers", "beat", "lab", "pg", "devlog", "lb", "settings", "extras", "perf"] },
            covers:   { tier: 2, label: "covers.js", file: "js/covers.js", desc: "Animated placeholder cover art. One shared requestAnimationFrame loop, and only covers on screen (IntersectionObserver) get drawn.", links: ["canvas", "io"] },
            beat:     { tier: 2, label: "beatlanes.js", file: "js/beatlanes.js", desc: "Rhythm game, chart editor and visualizer. Audio is scheduled slightly ahead on the Web Audio clock; charts are seeded so everyone gets the same notes.", links: ["canvas", "audio", "storage"] },
            lab:      { tier: 2, label: "feel-lab.js", file: "js/feel-lab.js", desc: "Platformer with a fixed 120 Hz simulation. Because physics is deterministic, a run can be stored as button presses and replayed as a ghost. Enemies use a small finite state machine.", links: ["canvas", "storage"] },
            pg:       { tier: 2, label: "playground.js", file: "js/playground.js", desc: "Pathfinding (generators step the search), particle editor, WebGL shader playground and the input-lag tester.", links: ["canvas", "webgl", "audio"] },
            devlog:   { tier: 2, label: "devlog.js", file: "js/devlog.js", desc: "Posts with live demos that only animate while open and on screen.", links: ["canvas", "io"] },
            lb:       { tier: 2, label: "leaderboard.js", file: "js/leaderboard.js", desc: "Talks to Supabase's REST API with row-level security, or falls back to local scores.", links: ["storage"] },
            settings: { tier: 2, label: "settings.js", file: "js/settings.js", desc: "Settings dialog and the save-file inspector (export, import and edit everything stored).", links: ["storage"] },
            extras:   { tier: 2, label: "extras.js", file: "js/extras.js", desc: "Boot screen, tour, quest, relics, seasonal events, trading cards, this map, and the shareable progress card.", links: ["canvas", "storage", "vt"] },
            perf:     { tier: 2, label: "perf.js", file: "js/perf.js", desc: "Frame-time overlay. Press ` to toggle it.", links: ["canvas"] },
            canvas:   { tier: 3, label: "Canvas 2D", desc: "Used for every game, cover, demo and the hero background." },
            webgl:    { tier: 3, label: "WebGL", desc: "Fragment shaders in the Playground." },
            audio:    { tier: 3, label: "Web Audio", desc: "Every sound on the site is synthesized: no audio files." },
            storage:  { tier: 3, label: "localStorage", desc: "Progress, settings, ghosts and scores, all under a th: prefix." },
            io:       { tier: 3, label: "IntersectionObserver", desc: "Pauses work that's off screen and triggers reveal animations." },
            vt:       { tier: 3, label: "View Transitions", desc: "The circular wipe when you switch themes." }
        };
        const tiers = [0, 1, 2, 3].map((t) => Object.entries(NODES).filter(([, n]) => n.tier === t));
        diagram.innerHTML = `<svg class="hood-lines" aria-hidden="true"></svg>` + tiers.map((row, t) => `
            <div class="hood-tier hood-tier-${t}">
                ${row.map(([id, n]) => `<button type="button" class="hood-node" data-node="${id}">${esc(n.label)}</button>`).join("")}
            </div>`).join("");
        const svg = $(".hood-lines", diagram);
        const lineCache = {};
        const clicked = new Set();

        function edges() { return Object.entries(NODES).flatMap(([id, n]) => (n.links || []).map((to) => [id, to])); }
        function drawLines(active) {
            const box = diagram.getBoundingClientRect();
            svg.setAttribute("width", box.width); svg.setAttribute("height", box.height);
            svg.innerHTML = edges().map(([a, b]) => {
                const ea = diagram.querySelector(`[data-node="${a}"]`).getBoundingClientRect();
                const eb = diagram.querySelector(`[data-node="${b}"]`).getBoundingClientRect();
                const x1 = ea.left + ea.width / 2 - box.left, y1 = ea.bottom - box.top;
                const x2 = eb.left + eb.width / 2 - box.left, y2 = eb.top - box.top;
                const hot = active && (a === active || b === active);
                return `<path class="${hot ? "hot" : ""}" d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}"/>`;
            }).join("");
        }
        async function show(id) {
            const n = NODES[id];
            $$(".hood-node", diagram).forEach((b) => b.classList.toggle("active", b.dataset.node === id));
            drawLines(id);
            detail.innerHTML = `<h3 class="side-title">${esc(n.label)}</h3><p>${esc(n.desc)}</p><p class="side-note" id="hoodLines">${n.file ? "Counting lines…" : "Browser API"}</p>`;
            if (n.file) {
                if (lineCache[id] == null) {
                    try {
                        const res = await fetch(n.file, { cache: "force-cache" });
                        lineCache[id] = res.ok ? (await res.text()).split("\n").length : 0;
                    } catch { lineCache[id] = 0; }
                }
                const el = $("#hoodLines");
                if (el) el.textContent = lineCache[id] ? `${n.file} · ${lineCache[id].toLocaleString()} lines` : n.file;
            }
            clicked.add(id);
            if (clicked.size >= 3) TH.Ach.unlock("look-inside");
        }
        diagram.addEventListener("click", (e) => { const b = e.target.closest("[data-node]"); if (b) show(b.dataset.node); });
        diagram.addEventListener("pointerover", (e) => { const b = e.target.closest("[data-node]"); if (b) drawLines(b.dataset.node); });
        if ("ResizeObserver" in window) new ResizeObserver(() => drawLines()).observe(diagram);
        on("themechange", () => requestAnimationFrame(() => drawLines()));
        detail.innerHTML = `<h3 class="side-title">Pick a box</h3><p>The site is plain HTML, CSS and JavaScript with no framework or build step. Modules talk through a tiny event bus, so each feature can be added or removed on its own.</p>`;
        setTimeout(() => drawLines(), 200);
    }

    TH.modules.push(["extras", () => {
        const run = (n, f) => { try { f(); } catch (err) { console.error(`[extras:${n}]`, err); } };
        run("analytics", initAnalytics);
        run("tour", initTour);
        run("quest", initQuest);
        run("relics", initRelics);
        run("seasonal", initSeasonal);
        run("flashlight", initFlashlight);
        run("showcase", initShowcase);
        run("cards", initCards);
        run("hood", initHood);
        run("boot", initBoot);
    }]);
})();
