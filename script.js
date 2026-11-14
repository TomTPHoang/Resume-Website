/* =====================================================================
   Tom Hoang portfolio: interactions
   Content lives in data.js; this file only renders and wires it up.
   ===================================================================== */
(() => {
    "use strict";

    const DATA = Object.assign({ games: [], skills: [], journey: [], contact: {} }, window.PORTFOLIO);
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    // localStorage can throw (private mode, blocked storage), so never let it break the page.
    const store = {
        get(key, fallback) {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : JSON.parse(v);
            } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
        }
    };

    /* ================================================================
       Shared render helpers
       ================================================================ */

    function coverHTML(g) {
        if (g.cover) {
            return `<img class="media-fill" src="${esc(g.cover)}" alt="${esc(g.title)} cover art" loading="lazy">`;
        }
        return `<div class="cover-art" style="--h:${Number(g.hue) || 205}" role="img" aria-label="${esc(g.title)}">
                    <span class="cover-genre">${esc(g.subtitle)}</span>
                    <span class="cover-title">${esc(g.title)}</span>
                </div>`;
    }

    function thumbSrc(m) {
        if (m.type === "image") return m.src;
        if (m.type === "youtube") return `https://i.ytimg.com/vi/${encodeURIComponent(m.id)}/hqdefault.jpg`;
        return m.poster || "";
    }

    function mediaHTML(m, g) {
        if (m.type === "image") {
            return `<img class="media-fill" src="${esc(m.src)}" alt="${esc(m.caption || g.title + " screenshot")}">`;
        }
        if (m.type === "video") {
            return `<video class="media-fill" src="${esc(m.src)}" ${m.poster ? `poster="${esc(m.poster)}"` : ""} controls playsinline preload="metadata"></video>`;
        }
        if (m.type === "youtube") {
            return `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.id)}?rel=0"
                        title="${esc(m.caption || g.title + " video")}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen loading="lazy"></iframe>`;
        }
        return "";
    }

    // Big visual for the featured slide: cover > first screenshot > generated art, plus optional looping preview.
    function heroMediaHTML(g) {
        const firstImg = (g.media || []).find((m) => m.type === "image");
        let html = !g.cover && firstImg
            ? `<img class="media-fill" src="${esc(firstImg.src)}" alt="${esc(g.title)}">`
            : coverHTML(g);
        if (g.preview && !reduceMotion) {
            html += `<video class="media-fill" style="position:absolute;inset:0" src="${esc(g.preview)}" autoplay muted loop playsinline></video>`;
        }
        return html;
    }

    const tagsHTML = (arr) => (arr || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");

    function metaHTML(g) {
        const rows = [["Role", g.role], ["Team", g.team], ["Engine", g.engine], ["Year", g.year]]
            .filter(([, v]) => v);
        if (!rows.length) return "";
        return `<dl class="meta-list">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    }

    const LINKS = {
        play: ["▶ Play", "btn-green"],
        video: ["Watch trailer", "btn-blue"],
        repo: ["Source code", "btn-ghost"],
        page: ["Project page", "btn-ghost"]
    };
    function linksHTML(g) {
        return Object.keys(LINKS)
            .filter((k) => g.links && g.links[k])
            .map((k) => `<a class="btn ${LINKS[k][1]}" href="${esc(g.links[k])}" target="_blank" rel="noopener">${LINKS[k][0]}</a>`)
            .join("");
    }

    /* ================================================================
       Achievements
       ================================================================ */

    const ACHIEVEMENTS = [
        { id: "press-start",    name: "Press Start",    desc: "Visited the portfolio.",                 icon: "▶", h: 200 },
        { id: "window-shopper", name: "Window Shopper", desc: "Opened a game page.",                    icon: "◆", h: 190 },
        { id: "completionist",  name: "Completionist",  desc: "Opened every game page.",                icon: "★", h: 42 },
        { id: "curator",        name: "Curator",        desc: "Filtered or searched the library.",      icon: "≡", h: 160 },
        { id: "beat-initiate",  name: "Beat Initiate",  desc: "Finished a run of Beat Lanes.",          icon: "♪", h: 285 },
        { id: "on-beat",        name: "On Beat",        desc: "Hit 90%+ accuracy in Beat Lanes.",       icon: "♫", h: 320 },
        { id: "full-combo",     name: "Full Combo",     desc: "Finished Beat Lanes without a miss.",    icon: "∞", h: 350 },
        { id: "paper-trail",    name: "Paper Trail",    desc: "Opened or downloaded the resume.",       icon: "¶", h: 110 },
        { id: "explorer",       name: "Explorer",       desc: "Scrolled all the way to Contact.",       icon: "⚑", h: 15 },
        { id: "say-hello",      name: "Say Hello",      desc: "Sent a message.",                        icon: "✉", h: 95 }
    ];

    const Ach = (() => {
        const valid = new Set(ACHIEVEMENTS.map((a) => a.id));
        const unlocked = new Set(store.get("ach-unlocked", []).filter((id) => valid.has(id)));
        const grid = $("#achGrid");
        const toasts = $("#toasts");

        function updateCounts() {
            const n = unlocked.size;
            const total = ACHIEVEMENTS.length;
            const pct = Math.round((n / total) * 100) + "%";
            [["#achCount", n], ["#achTotal", total], ["#achCountMini", n], ["#achTotalMini", total]]
                .forEach(([sel, v]) => { const el = $(sel); if (el) el.textContent = v; });
            ["#achBar", "#achBarMini"].forEach((sel) => { const el = $(sel); if (el) el.style.width = pct; });
        }

        function render() {
            if (grid) {
                grid.innerHTML = ACHIEVEMENTS.map((a) => {
                    const on = unlocked.has(a.id);
                    return `<div class="ach ${on ? "unlocked" : "locked"}" data-id="${a.id}">
                                <div class="ach-icon" style="--h:${a.h}" aria-hidden="true">${a.icon}</div>
                                <div>
                                    <div class="ach-name">${esc(a.name)}${on ? "" : '<span class="sr-only"> (locked)</span>'}</div>
                                    <div class="ach-desc">${esc(a.desc)}</div>
                                </div>
                            </div>`;
                }).join("");
            }
            updateCounts();
        }

        function toast(a) {
            if (!toasts) return;
            const el = document.createElement("div");
            el.className = "toast";
            el.innerHTML = `<div class="ach-icon" style="--h:${a.h}" aria-hidden="true">${a.icon}</div>
                            <div><div class="toast-kicker">Achievement unlocked</div><div class="toast-name">${esc(a.name)}</div></div>`;
            toasts.appendChild(el);
            while (toasts.children.length > 3) toasts.firstElementChild.remove();
            setTimeout(() => {
                el.classList.add("out");
                setTimeout(() => el.remove(), 400);
            }, 4200);
        }

        function unlock(id) {
            if (unlocked.has(id)) return;
            const a = ACHIEVEMENTS.find((x) => x.id === id);
            if (!a) return;
            unlocked.add(id);
            store.set("ach-unlocked", [...unlocked]);
            render();
            const card = grid && grid.querySelector(`[data-id="${id}"]`);
            if (card) card.classList.add("just-unlocked");
            toast(a);
        }

        function reset() {
            unlocked.clear();
            store.set("ach-unlocked", []);
            store.set("viewed-games", []);
            render();
        }

        return { render, unlock, reset };
    })();

    function initAchievements() {
        Ach.render();
        setTimeout(() => Ach.unlock("press-start"), 1200);

        const reset = $("#achReset");
        if (reset) reset.addEventListener("click", Ach.reset);

        $$("[data-resume]").forEach((a) => a.addEventListener("click", () => Ach.unlock("paper-trail")));

        const contact = $("#contact");
        if (contact && "IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    Ach.unlock("explorer");
                    io.disconnect();
                }
            }, { threshold: 0.35 });
            io.observe(contact);
        }
    }

    /* ================================================================
       Top bar: scrolled state, mobile menu, scrollspy
       ================================================================ */

    function initNav() {
        const bar = $("#topbar");
        const toggle = $("#navToggle");
        const nav = $("#nav");
        if (!bar) return;

        const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        function setMenu(open) {
            bar.classList.toggle("menu-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        }
        toggle.addEventListener("click", () => setMenu(!bar.classList.contains("menu-open")));
        nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
        document.addEventListener("click", (e) => {
            if (bar.classList.contains("menu-open") && !bar.contains(e.target)) setMenu(false);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && bar.classList.contains("menu-open")) { setMenu(false); toggle.focus(); }
        });

        // Scrollspy: highlight the section crossing the middle of the viewport.
        const links = $$("a[href^='#']", nav);
        const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
        if (!("IntersectionObserver" in window)) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                links.forEach((a) => a.classList.remove("active"));
                const link = byId.get(entry.target.id);
                if (link) link.classList.add("active");
            });
        }, { rootMargin: "-45% 0px -50% 0px" });
        ["top", ...byId.keys()].forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }

    /* ================================================================
       Reveal on scroll
       ================================================================ */

    const revealIO = ("IntersectionObserver" in window && !reduceMotion)
        ? new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add("visible");
                    revealIO.unobserve(e.target);
                }
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" })
        : null;

    function observeReveal(root = document) {
        $$(".reveal:not(.visible)", root).forEach((el) => {
            if (revealIO) revealIO.observe(el);
            else el.classList.add("visible");
        });
    }

    /* ================================================================
       Typewriter role
       ================================================================ */

    function initRoleRotator() {
        const el = $("#roleRotator");
        if (!el || reduceMotion) return;
        const roles = ["Gameplay Programmer", "Systems Programmer", "Tools Programmer", "Unity / C# Developer"];
        let r = 0, i = roles[0].length, forward = false;

        function step() {
            const word = roles[r];
            i += forward ? 1 : -1;
            el.textContent = word.slice(0, i);
            if (forward && i >= word.length) { forward = false; return setTimeout(step, 1800); }
            if (!forward && i <= 0) { forward = true; r = (r + 1) % roles.length; return setTimeout(step, 350); }
            setTimeout(step, forward ? 70 : 35);
        }
        setTimeout(step, 2200);
    }

    /* ================================================================
       Hero background: drifting network that reacts to the cursor
       ================================================================ */

    function initHeroCanvas() {
        const canvas = $("#heroCanvas");
        const section = $(".profile");
        if (!canvas || !section) return;
        const ctx = canvas.getContext("2d");
        let W = 0, H = 0, pts = [], raf = 0, running = false;
        const mouse = { x: -9999, y: -9999 };
        const LINK = 120, MOUSE_R = 170;

        function resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            W = section.clientWidth;
            H = section.clientHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.round(Math.min(90, (W * H) / 13000));
            pts = Array.from({ length: n }, () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.4 + 0.5
            }));
            if (!running) draw();
        }

        function step() {
            for (const p of pts) {
                const dx = p.x - mouse.x, dy = p.y - mouse.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < MOUSE_R * MOUSE_R && d2 > 1) {
                    const d = Math.sqrt(d2);
                    const f = (1 - d / MOUSE_R) * 0.6;
                    p.x += (dx / d) * f;
                    p.y += (dy / d) * f;
                }
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
                if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
            }
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.lineWidth = 1;
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                for (let j = i + 1; j < pts.length; j++) {
                    const b = pts[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < LINK * LINK) {
                        ctx.strokeStyle = `rgba(102,192,244,${(1 - Math.sqrt(d2) / LINK) * 0.16})`;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
                const mx = a.x - mouse.x, my = a.y - mouse.y;
                const md = Math.sqrt(mx * mx + my * my);
                if (md < MOUSE_R) {
                    ctx.strokeStyle = `rgba(163,207,6,${(1 - md / MOUSE_R) * 0.3})`;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                }
            }
            ctx.fillStyle = "rgba(198,212,223,0.55)";
            for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        }

        function loop() { step(); draw(); raf = requestAnimationFrame(loop); }
        function start() { if (!running && !reduceMotion) { running = true; raf = requestAnimationFrame(loop); } }
        function stop() { running = false; cancelAnimationFrame(raf); }

        section.addEventListener("pointermove", (e) => {
            const r = section.getBoundingClientRect();
            mouse.x = e.clientX - r.left;
            mouse.y = e.clientY - r.top;
        });
        section.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(section);
        else window.addEventListener("resize", resize);
        resize();

        if ("IntersectionObserver" in window) {
            new IntersectionObserver((entries) => {
                entries.forEach((e) => (e.isIntersecting ? start() : stop()));
            }).observe(section);
        } else start();
    }

    /* ================================================================
       Featured carousel
       ================================================================ */

    function initFeatured() {
        const section = $("#featured");
        const root = $("#featuredCarousel");
        const stage = $("#featuredStage");
        const dotsBox = $("#featuredDots");
        const games = DATA.games.filter((g) => g.featured);
        if (!stage) return;
        if (!games.length) { section.hidden = true; return; }

        const MS = 7000;
        const auto = !reduceMotion && games.length > 1;
        let idx = 0, elapsed = 0, last = performance.now(), paused = false, inView = true;

        if (!auto) root.classList.add("no-auto");
        if (games.length < 2) $(".carousel-arrows", section).hidden = true;

        dotsBox.innerHTML = games.map((g) =>
            `<button role="tab" aria-label="${esc(g.title)}" aria-selected="false"><span class="dot-fill"></span></button>`
        ).join("");
        const dots = $$("button", dotsBox);

        function render() {
            const g = games[idx];
            const media = g.media || [];
            const shots = media.map((m, i) => ({ m, i })).filter(({ m }) => thumbSrc(m)).slice(0, 4);
            stage.innerHTML = `
                <article class="feat-slide" aria-label="${idx + 1} of ${games.length}: ${esc(g.title)}">
                    <div class="feat-media" data-open="${esc(g.id)}">${heroMediaHTML(g)}</div>
                    <div class="feat-info">
                        <p class="feat-kicker">Featured${g.year ? " · " + esc(g.year) : ""}</p>
                        <h3 class="feat-title">${esc(g.title)}</h3>
                        <p class="feat-pitch">${esc(g.pitch)}</p>
                        ${shots.length
                            ? `<div class="feat-thumbs">${shots.map(({ m, i }, n) =>
                                `<button data-open="${esc(g.id)}" data-media="${i}" aria-label="Open screenshot ${n + 1}">
                                    <img src="${esc(thumbSrc(m))}" alt="" loading="lazy"></button>`).join("")}</div>`
                            : metaHTML(g)}
                        <div class="tag-row">${tagsHTML(g.tags)}</div>
                        <div class="feat-actions">
                            <button class="btn btn-blue" data-open="${esc(g.id)}">View game page</button>
                            ${g.links && g.links.play ? `<a class="btn btn-green" href="${esc(g.links.play)}" target="_blank" rel="noopener">▶ Play</a>` : ""}
                        </div>
                    </div>
                </article>`;
            dots.forEach((d, i) => d.setAttribute("aria-selected", String(i === idx)));
        }

        function go(i) {
            idx = (i + games.length) % games.length;
            elapsed = 0;
            render();
        }

        function tick(now) {
            const dt = now - last;
            last = now;
            if (auto && !paused && inView && !document.hidden) {
                elapsed += dt;
                if (elapsed >= MS) go(idx + 1);
            }
            dots.forEach((d, i) => {
                d.firstElementChild.style.width = i === idx ? (auto ? (elapsed / MS) * 100 : 100) + "%" : "0%";
            });
            requestAnimationFrame(tick);
        }

        $("#featPrev").addEventListener("click", () => go(idx - 1));
        $("#featNext").addEventListener("click", () => go(idx + 1));
        dots.forEach((d, i) => d.addEventListener("click", () => go(i)));

        stage.addEventListener("click", (e) => {
            const t = e.target.closest("[data-open]");
            if (t) openGame(t.dataset.open, Number(t.dataset.media) || 0);
        });

        root.addEventListener("pointerenter", () => { paused = true; root.classList.add("paused"); });
        root.addEventListener("pointerleave", () => { paused = false; root.classList.remove("paused"); });
        root.addEventListener("focusin", () => { paused = true; });
        root.addEventListener("focusout", (e) => { if (!root.contains(e.relatedTarget)) paused = false; });
        root.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft") go(idx - 1);
            if (e.key === "ArrowRight") go(idx + 1);
        });

        // Swipe on touch
        let sx = null;
        stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") sx = e.clientX; });
        stage.addEventListener("pointerup", (e) => {
            if (sx === null) return;
            const dx = e.clientX - sx;
            sx = null;
            if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
        });

        if ("IntersectionObserver" in window) {
            new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; }).observe(root);
        }

        render();
        requestAnimationFrame(tick);
    }

    /* ================================================================
       Library grid: filter, search, sort, hover tilt + preview
       ================================================================ */

    function initLibrary() {
        const grid = $("#libraryGrid");
        if (!grid) return;
        const empty = $("#libraryEmpty");
        const search = $("#librarySearch");
        const sort = $("#librarySort");
        const chips = $$("#libraryFilters .chip");
        const state = { filter: "all", q: "", sort: "featured" };

        $("#libraryCount").textContent = DATA.games.length;

        const yearOf = (g) => {
            const m = String(g.year || "").match(/\d{4}/g);
            return m ? Number(m[m.length - 1]) : 0;
        };

        function visibleGames() {
            let list = DATA.games.filter((g) => state.filter === "all" || (g.categories || []).includes(state.filter));
            if (state.q) {
                const q = state.q.toLowerCase();
                list = list.filter((g) =>
                    [g.title, g.subtitle, g.pitch, g.role, g.engine, ...(g.tags || []), ...(g.tech || [])]
                        .join(" ").toLowerCase().includes(q));
            }
            list = list.slice();
            if (state.sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
            else if (state.sort === "newest") list.sort((a, b) => yearOf(b) - yearOf(a));
            else list.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
            return list;
        }

        function cardHTML(g) {
            const meta = [g.subtitle, g.role, g.team].filter(Boolean).map(esc).join(" · ");
            return `<a class="game-card" href="#game=${esc(g.id)}" data-open="${esc(g.id)}" aria-label="${esc(g.title)}: open game page">
                        <div class="card-media">
                            ${coverHTML(g)}
                            ${g.preview && !reduceMotion ? `<video class="media-fill" src="${esc(g.preview)}" muted loop playsinline preload="none"></video>` : ""}
                            <span class="card-shine"></span>
                            ${g.featured ? '<span class="card-badge">Featured</span>' : ""}
                        </div>
                        <div class="card-body">
                            <span class="card-title">${esc(g.title)}</span>
                            <span class="card-meta">${meta}</span>
                            <span class="tag-row">${tagsHTML((g.tags || []).slice(0, 3))}</span>
                        </div>
                    </a>`;
        }

        function bindCard(card) {
            const video = $("video", card);
            card.addEventListener("pointermove", (e) => {
                if (e.pointerType !== "mouse") return;
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width;
                const y = (e.clientY - r.top) / r.height;
                card.style.setProperty("--mx", x * 100 + "%");
                card.style.setProperty("--my", y * 100 + "%");
                if (!reduceMotion) {
                    card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-4px)`;
                }
            });
            card.addEventListener("pointerenter", () => {
                if (video) { card.classList.add("previewing"); video.play().catch(() => {}); }
            });
            card.addEventListener("pointerleave", () => {
                card.style.transform = "";
                if (video) { card.classList.remove("previewing"); video.pause(); }
            });
            card.addEventListener("click", (e) => {
                e.preventDefault();
                openGame(card.dataset.open);
            });
        }

        function render() {
            const list = visibleGames();
            grid.innerHTML = list.map(cardHTML).join("");
            empty.hidden = list.length > 0;
            $$(".game-card", grid).forEach(bindCard);
        }

        chips.forEach((chip) => chip.addEventListener("click", () => {
            chips.forEach((c) => { c.classList.toggle("active", c === chip); c.setAttribute("aria-pressed", String(c === chip)); });
            state.filter = chip.dataset.filter;
            if (state.filter !== "all") Ach.unlock("curator");
            render();
        }));

        let t = 0;
        search.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(() => {
                state.q = search.value.trim();
                if (state.q) Ach.unlock("curator");
                render();
            }, 120);
        });

        sort.addEventListener("change", () => { state.sort = sort.value; render(); });

        render();
    }

    /* ================================================================
       Game page modal (deep-linkable via #game=<id>)
       ================================================================ */

    const modal = $("#gameModal");
    const modalPanel = modal && $(".modal-panel", modal);
    const modalContent = $("#gmContent");
    let modalOpen = false;
    let lastFocus = null;
    let currentGame = null;
    let currentMedia = 0;

    const gameFromHash = () => {
        const m = location.hash.match(/^#game=([\w-]+)/);
        return m ? m[1] : null;
    };

    function showMedia(i) {
        const g = currentGame;
        const media = g.media || [];
        const viewer = $("#gmViewer");
        const caption = $("#gmCaption");
        if (!media.length) {
            viewer.innerHTML = coverHTML(g);
            caption.textContent = "";
            return;
        }
        currentMedia = (i + media.length) % media.length;
        const m = media[currentMedia];
        viewer.innerHTML = mediaHTML(m, g);
        caption.textContent = m.caption || "";
        $$("#gmThumbs button").forEach((b, n) => b.setAttribute("aria-current", String(n === currentMedia)));
    }

    function openGame(id, mediaIndex = 0, { push = true } = {}) {
        const g = DATA.games.find((x) => x.id === id);
        if (!g || !modal) return;
        if (!modalOpen) lastFocus = document.activeElement;
        currentGame = g;

        const media = g.media || [];
        const links = linksHTML(g);
        modalContent.innerHTML = `
            <p class="gm-crumb">Library › ${esc(g.subtitle || "Project")}</p>
            <h2 class="gm-title" id="gmTitle">${esc(g.title)}</h2>

            <div class="gm-top">
                <div>
                    <div class="gm-viewer" id="gmViewer"></div>
                    <p class="gm-caption" id="gmCaption"></p>
                    ${media.length > 1 ? `<div class="gm-thumbs" id="gmThumbs">${media.map((m, i) => `
                        <button data-i="${i}" aria-label="Show media ${i + 1} of ${media.length}">
                            ${thumbSrc(m) ? `<img src="${esc(thumbSrc(m))}" alt="" loading="lazy">` : ""}
                            ${m.type !== "image" ? '<span class="thumb-play" aria-hidden="true">▶</span>' : ""}
                        </button>`).join("")}</div>` : ""}
                </div>
                <div class="gm-side">
                    ${media.length ? `<div class="gm-capsule">${coverHTML(g)}</div>` : ""}
                    <p class="gm-pitch">${esc(g.pitch)}</p>
                    ${metaHTML(g)}
                    <div class="tag-row">${tagsHTML(g.tags)}</div>
                </div>
            </div>

            <div class="gm-body">
                <div>
                    <section class="gm-section">
                        <h3 class="gm-h">About this project</h3>
                        <p>${esc(g.about || g.pitch)}</p>
                    </section>
                    ${g.built && g.built.length ? `
                    <section class="gm-section">
                        <h3 class="gm-h">What I built</h3>
                        <ul class="gm-built">${g.built.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
                    </section>` : ""}
                </div>
                <aside>
                    <section class="gm-section">
                        <h3 class="gm-h">Links</h3>
                        ${links ? `<div class="gm-links">${links}</div>` : '<p class="gm-note">Builds and source available on request.</p>'}
                    </section>
                    <section class="gm-section">
                        <h3 class="gm-h">Tech</h3>
                        <div class="tag-row">${tagsHTML(g.tech)}</div>
                    </section>
                </aside>
            </div>`;

        const thumbs = $("#gmThumbs");
        if (thumbs) thumbs.addEventListener("click", (e) => {
            const b = e.target.closest("button[data-i]");
            if (b) showMedia(Number(b.dataset.i));
        });
        showMedia(mediaIndex);

        modal.hidden = false;
        modalOpen = true;
        document.body.style.overflow = "hidden";
        modal.scrollTop = 0;
        modalPanel.focus({ preventScroll: true });

        if (push && gameFromHash() !== id) history.pushState({ modal: true }, "", "#game=" + id);

        // Achievements
        Ach.unlock("window-shopper");
        const viewed = new Set(store.get("viewed-games", []));
        viewed.add(id);
        store.set("viewed-games", [...viewed]);
        if (DATA.games.every((x) => viewed.has(x.id))) Ach.unlock("completionist");
    }

    function closeGame({ fromPop = false } = {}) {
        if (!modalOpen) return;
        modalOpen = false;
        modal.hidden = true;
        modalContent.innerHTML = ""; // stops any playing video
        document.body.style.overflow = "";
        if (!fromPop) {
            if (history.state && history.state.modal) history.back();
            else history.replaceState(null, "", location.pathname + location.search);
        }
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    function initModal() {
        if (!modal) return;
        modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeGame(); });

        document.addEventListener("keydown", (e) => {
            if (!modalOpen) return;
            if (e.key === "Escape") { e.preventDefault(); closeGame(); return; }
            if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && currentGame && (currentGame.media || []).length > 1) {
                if (e.target.closest && e.target.closest("input, textarea, select")) return;
                showMedia(currentMedia + (e.key === "ArrowRight" ? 1 : -1));
                return;
            }
            if (e.key === "Tab") {
                const f = $$('a[href], button:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])', modalPanel)
                    .filter((el) => el.offsetParent !== null);
                if (!f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && (document.activeElement === first || document.activeElement === modalPanel)) {
                    e.preventDefault(); last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault(); first.focus();
                }
            }
        });

        window.addEventListener("popstate", () => {
            const id = gameFromHash();
            if (id) openGame(id, 0, { push: false });
            else closeGame({ fromPop: true });
        });

        const initial = gameFromHash();
        if (initial) openGame(initial, 0, { push: false });
    }

    /* ================================================================
       Skills + Journey
       ================================================================ */

    function initSkills() {
        const grid = $("#skillsGrid");
        if (!grid) return;
        grid.innerHTML = DATA.skills.map((s) => `
            <div class="skill-card reveal">
                <h3>${esc(s.group)}</h3>
                <div class="tag-row">${tagsHTML(s.items)}</div>
            </div>`).join("");
    }

    function initJourney() {
        const list = $("#journeyList");
        if (!list) return;
        list.innerHTML = DATA.journey.map((j) => `
            <li class="journey-item reveal">
                <div class="journey-date">${esc(j.date)}</div>
                <div><h3>${esc(j.title)}</h3><p>${esc(j.text)}</p></div>
            </li>`).join("");
    }

    /* ================================================================
       Beat Lanes: canvas rhythm mini-game
       ================================================================ */

    function initRhythm() {
        const shell = $("#gameShell");
        const canvas = $("#rhythmCanvas");
        if (!shell || !canvas) return;
        const ctx = canvas.getContext("2d");
        const overlay = $("#gameOverlay");
        const card = $("#overlayCard");
        const hud = { score: $("#hudScore"), combo: $("#hudCombo"), acc: $("#hudAcc") };
        const muteBtn = $("#gameMute");

        const KEYS = ["d", "f", "j", "k"];
        const COLORS = ["#66c0f4", "#a3cf06", "#c58af9", "#f2a65a"];
        const JUDGE_COLOR = { perfect: "#7fe3ff", great: "#a3cf06", good: "#e8c060", miss: "#ff7b7b" };
        const BPM = 124;
        const BEAT = 60 / BPM;
        const TRAVEL = 1.3;            // seconds a note is visible before the hit line
        const WIN = { perfect: 0.045, great: 0.09, good: 0.14 };
        const PTS = { perfect: 300, great: 200, good: 100 };

        let W = 0, H = 0;
        let state = "idle";            // idle | playing | done
        let notes = [], lastNoteT = 0, startAt = 0, nextHalfBeat = 0;
        let score = 0, combo = 0, maxCombo = 0, judged = 0;
        let counts = { perfect: 0, great: 0, good: 0, miss: 0 };
        const held = [false, false, false, false];
        const flash = [0, 0, 0, 0];
        let bursts = [], popup = null;
        let raf = 0, looping = false, inView = false;
        const pointers = new Map();

        /* ---------- audio (synthesized) ---------- */
        let muted = store.get("beatlanes-muted", false);
        let actx = null, master = null, noise = null;

        function audio() {
            if (!actx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                actx = new AC();
                master = actx.createGain();
                master.gain.value = muted ? 0 : 0.45;
                master.connect(actx.destination);
                noise = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.05), actx.sampleRate);
                const d = noise.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (actx.state === "suspended") actx.resume();
            return actx;
        }
        function kick(at) {
            const o = actx.createOscillator(), g = actx.createGain();
            o.frequency.setValueAtTime(150, at);
            o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
            g.gain.setValueAtTime(0.9, at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
            o.connect(g).connect(master);
            o.start(at); o.stop(at + 0.22);
        }
        function hat(at) {
            const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
            s.buffer = noise;
            f.type = "highpass"; f.frequency.value = 7000;
            g.gain.setValueAtTime(0.22, at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
            s.connect(f).connect(g).connect(master);
            s.start(at);
        }
        const LANE_FREQ = [392.0, 466.16, 587.33, 698.46];
        function blip(lane, strength) {
            if (!actx) return;
            const at = actx.currentTime;
            const o = actx.createOscillator(), g = actx.createGain();
            o.type = "triangle";
            o.frequency.value = LANE_FREQ[lane];
            g.gain.setValueAtTime(0.22 * strength, at);
            g.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
            o.connect(g).connect(master);
            o.start(at); o.stop(at + 0.18);
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

        /* ---------- chart ---------- */
        function mulberry32(seed) {
            return () => {
                seed = (seed + 0x6D2B79F5) | 0;
                let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }
        function buildChart() {
            const rand = mulberry32(124);
            const out = [];
            const START = 4, BEATS = 56;
            let last = -1;
            for (let s = 0; s < BEATS * 2; s++) {
                const beat = START + s / 2;
                const p = s / (BEATS * 2);
                const onBeat = s % 2 === 0;
                if (rand() > (onBeat ? 0.85 : 0.08 + p * 0.5)) continue;
                let lane = Math.floor(rand() * 4);
                if (lane === last && rand() < 0.65) lane = (lane + 1 + Math.floor(rand() * 3)) % 4;
                last = lane;
                out.push({ t: beat * BEAT, lane, done: false });
                if (onBeat && s % 8 === 0 && p > 0.3 && rand() < 0.6) {
                    out.push({ t: beat * BEAT, lane: (lane + 2) % 4, done: false });
                }
            }
            return out;
        }

        /* ---------- game flow ---------- */
        const songTime = () => performance.now() / 1000 - startAt;
        const accuracy = () => judged ? (counts.perfect + counts.great * 0.7 + counts.good * 0.4) / judged : 1;

        function updateHUD() {
            hud.score.textContent = score.toLocaleString();
            hud.combo.textContent = combo;
            hud.acc.textContent = (accuracy() * 100).toFixed(1) + "%";
        }

        function start() {
            audio();
            notes = buildChart();
            lastNoteT = notes[notes.length - 1].t;
            score = combo = maxCombo = judged = 0;
            counts = { perfect: 0, great: 0, good: 0, miss: 0 };
            bursts = []; popup = null; nextHalfBeat = 0;
            startAt = performance.now() / 1000 + 0.25;
            state = "playing";
            overlay.classList.add("hidden");
            updateHUD();
            canvas.focus({ preventScroll: true });
            ensureLoop();
        }

        function judge(kind, lane) {
            counts[kind]++;
            judged++;
            if (kind === "miss") combo = 0;
            else {
                combo++;
                maxCombo = Math.max(maxCombo, combo);
                score += Math.round(PTS[kind] * (1 + Math.min(combo, 100) / 100));
            }
            popup = { text: kind === "miss" ? "Miss" : kind[0].toUpperCase() + kind.slice(1), color: JUDGE_COLOR[kind], born: performance.now(), lane };
            updateHUD();
        }

        function press(lane) {
            held[lane] = true;
            flash[lane] = 1;
            if (state !== "playing") return;
            const t = songTime();
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
                judge(kind, lane);
                blip(lane, kind === "good" ? 0.6 : 1);
                bursts.push({ lane, born: performance.now() });
            }
        }
        const release = (lane) => { held[lane] = false; };

        function gradeFor(acc) {
            if (acc >= 0.95) return "S";
            if (acc >= 0.88) return "A";
            if (acc >= 0.78) return "B";
            if (acc >= 0.65) return "C";
            return "D";
        }

        function renderBest() {
            const best = store.get("beatlanes-best", null);
            $("#bestScore").textContent = best ? Number(best.score).toLocaleString() : "-";
            $("#bestGrade").textContent = best ? best.grade : "";
        }
        renderBest();

        function finish() {
            state = "done";
            const acc = accuracy();
            const grade = gradeFor(acc);
            const best = store.get("beatlanes-best", null);
            const isBest = !best || score > best.score;
            if (isBest) store.set("beatlanes-best", { score, grade });
            renderBest();

            card.innerHTML = `
                <p class="overlay-kicker">${isBest ? "New personal best" : "Run complete"}</p>
                <div class="overlay-grade">${grade}</div>
                <div class="result-stats">
                    <div><b>${score.toLocaleString()}</b>Score</div>
                    <div><b>${(acc * 100).toFixed(1)}%</b>Accuracy</div>
                    <div><b>${maxCombo}</b>Max combo</div>
                </div>
                <p class="overlay-text">${counts.perfect} perfect · ${counts.great} great · ${counts.good} good · ${counts.miss} miss</p>
                <button class="btn btn-green" id="gameStart"><span class="btn-icon" aria-hidden="true">↻</span> Play again</button>`;
            overlay.classList.remove("hidden");
            $("#gameStart").focus({ preventScroll: true });

            Ach.unlock("beat-initiate");
            if (acc >= 0.9) Ach.unlock("on-beat");
            if (counts.miss === 0) Ach.unlock("full-combo");
        }

        function abort() {
            state = "idle";
            card.innerHTML = `
                <p class="overlay-kicker">Paused</p>
                <h3 class="overlay-title">Run stopped</h3>
                <p class="overlay-text">You switched tabs, so the run was stopped to keep timing fair.</p>
                <button class="btn btn-green" id="gameStart"><span class="btn-icon" aria-hidden="true">▶</span> Try again</button>`;
            overlay.classList.remove("hidden");
        }

        overlay.addEventListener("click", (e) => { if (e.target.closest("#gameStart")) start(); });
        document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") abort(); });

        /* ---------- input ---------- */
        window.addEventListener("keydown", (e) => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || modalOpen) return;
            if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
            if (state === "playing" && e.key === " ") { e.preventDefault(); return; }
            const lane = KEYS.indexOf(e.key.toLowerCase());
            if (lane < 0 || (state !== "playing" && !inView)) return;
            if (state === "playing") e.preventDefault();
            press(lane);
            ensureLoop();
        });
        window.addEventListener("keyup", (e) => {
            const lane = KEYS.indexOf(e.key.toLowerCase());
            if (lane >= 0) release(lane);
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
            const lane = laneAt(e.clientX - r.left);
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

        /* ---------- update + draw ---------- */
        function update() {
            const t = songTime();
            if (actx) {
                // Schedule the backing beat slightly ahead of time: kick on beats, hat on off-beats.
                while (nextHalfBeat * BEAT / 2 < t + 0.12) {
                    const bt = nextHalfBeat * BEAT / 2;
                    if (bt >= t - 0.03 && bt <= lastNoteT + BEAT) {
                        const at = actx.currentTime + Math.max(0, bt - t);
                        if (nextHalfBeat % 2 === 0) kick(at); else hat(at);
                    }
                    nextHalfBeat++;
                }
            }
            for (const n of notes) {
                if (n.t - t > 0) break;
                if (!n.done && t - n.t > WIN.good) { n.done = true; judge("miss", n.lane); }
            }
            if (t > lastNoteT + 1.2) finish();
        }

        function hexA(hex, a) {
            const n = parseInt(hex.slice(1), 16);
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

        function draw() {
            const now = performance.now();
            const t = state === "idle" ? 0 : songTime();
            const { lw, x0, hitY } = geo();
            ctx.clearRect(0, 0, W, H);

            // Scrolling grid backdrop
            const spacing = 44;
            const off = state === "playing" ? ((t / BEAT) * spacing) % spacing : 0;
            ctx.strokeStyle = "rgba(102,192,244,0.05)";
            ctx.lineWidth = 1;
            for (let y = (off % spacing) - spacing; y < H; y += spacing) {
                ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
            }

            // Lanes
            for (let i = 0; i < 4; i++) {
                const x = x0 + i * lw;
                ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.045)";
                ctx.fillRect(x, 0, lw, H);
                const a = held[i] ? 0.26 : flash[i] * 0.26;
                if (a > 0.01) {
                    const gr = ctx.createLinearGradient(0, hitY, 0, hitY - 280);
                    gr.addColorStop(0, hexA(COLORS[i], a));
                    gr.addColorStop(1, hexA(COLORS[i], 0));
                    ctx.fillStyle = gr;
                    ctx.fillRect(x, hitY - 280, lw, 280);
                }
                if (!held[i]) flash[i] = Math.max(0, flash[i] - 0.06);
            }
            ctx.strokeStyle = "rgba(102,192,244,0.12)";
            for (let i = 0; i <= 4; i++) {
                const x = Math.round(x0 + i * lw) + 0.5;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
            }

            // Big faint combo counter
            if (state === "playing" && combo >= 5) {
                ctx.fillStyle = "rgba(255,255,255,0.07)";
                ctx.font = "700 88px 'Barlow Condensed', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(String(combo), W / 2, H * 0.38);
            }

            // Hit line
            ctx.save();
            ctx.shadowColor = "rgba(102,192,244,0.8)";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "rgba(102,192,244,0.7)";
            ctx.fillRect(x0, hitY - 1, lw * 4, 2);
            ctx.restore();

            // Notes
            if (state !== "idle") {
                for (const n of notes) {
                    const dy = (n.t - t) / TRAVEL;
                    if (dy > 1.05) break;
                    if (n.done) continue;
                    const y = hitY - dy * (hitY + 30);
                    if (y > H + 20) continue;
                    const x = x0 + n.lane * lw;
                    ctx.save();
                    ctx.shadowColor = COLORS[n.lane];
                    ctx.shadowBlur = 14;
                    const gr = ctx.createLinearGradient(0, y - 10, 0, y + 10);
                    gr.addColorStop(0, "#ffffff");
                    gr.addColorStop(0.35, COLORS[n.lane]);
                    gr.addColorStop(1, hexA(COLORS[n.lane], 0.75));
                    ctx.fillStyle = gr;
                    rrect(x + 7, y - 10, lw - 14, 20, 6);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Receptors + key labels
            ctx.textAlign = "center";
            ctx.font = "600 14px Barlow, sans-serif";
            for (let i = 0; i < 4; i++) {
                const x = x0 + i * lw;
                rrect(x + 7, hitY - 13, lw - 14, 26, 7);
                ctx.lineWidth = 2;
                ctx.strokeStyle = hexA(COLORS[i], held[i] ? 1 : 0.45);
                ctx.stroke();
                if (held[i]) { ctx.fillStyle = hexA(COLORS[i], 0.3); ctx.fill(); }
                ctx.fillStyle = held[i] ? "#ffffff" : "rgba(198,212,223,0.6)";
                ctx.fillText(KEYS[i].toUpperCase(), x + lw / 2, hitY + 42);
            }

            // Hit bursts
            bursts = bursts.filter((b) => now - b.born < 320);
            for (const b of bursts) {
                const k = (now - b.born) / 320;
                ctx.beginPath();
                ctx.arc(x0 + b.lane * lw + lw / 2, hitY, lw * 0.25 + k * lw * 0.45, 0, Math.PI * 2);
                ctx.lineWidth = 3 * (1 - k) + 0.5;
                ctx.strokeStyle = hexA(COLORS[b.lane], 1 - k);
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
                    ctx.font = `700 ${Math.round(30 + (1 - k) * 6)}px 'Barlow Condensed', sans-serif`;
                    ctx.fillText(popup.text.toUpperCase(), W / 2, hitY - 120 - k * 14);
                    ctx.globalAlpha = 1;
                }
            }
        }

        function loop() {
            if (state === "playing") update();
            draw();
            const idleCalm = state !== "playing" && !held.some(Boolean) && flash.every((f) => f === 0) && !bursts.length && !popup;
            if ((state === "playing" || inView) && !idleCalm) raf = requestAnimationFrame(loop);
            else looping = false;
        }
        function ensureLoop() {
            if (looping) return;
            looping = true;
            raf = requestAnimationFrame(loop);
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
        // Web fonts may load after the first draw.
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    }

    /* ================================================================
       Contact form
       ================================================================ */

    function initContact() {
        const form = $("#contactForm");
        if (!form) return;
        const status = $("#cfStatus");
        const submit = $("#cfSubmit");
        const count = $("#cfCount");
        const cfg = DATA.contact || {};

        const fields = {
            name: { el: $("#cfName"), err: $("#cfNameErr"), check: (v) => v.length >= 2 ? "" : v ? "That name looks a bit short." : "Please enter your name." },
            email: { el: $("#cfEmail"), err: $("#cfEmailErr"), check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : v ? "That email doesn't look right." : "Please enter your email." },
            message: { el: $("#cfMsg"), err: $("#cfMsgErr"), check: (v) => v.length >= 10 ? "" : v ? "A little more detail, please (10+ characters)." : "Please write a message." }
        };

        function validate(key) {
            const f = fields[key];
            const msg = f.check(f.el.value.trim());
            f.err.textContent = msg;
            f.el.closest(".field").classList.toggle("invalid", !!msg);
            f.el.setAttribute("aria-invalid", String(!!msg));
            return !msg;
        }

        Object.keys(fields).forEach((key) => {
            const f = fields[key];
            f.el.setAttribute("aria-describedby", f.err.id);
            f.el.addEventListener("blur", () => { if (f.el.value) validate(key); });
            f.el.addEventListener("input", () => { if (f.el.closest(".field").classList.contains("invalid")) validate(key); });
        });
        fields.message.el.addEventListener("input", () => { count.textContent = fields.message.el.value.length; });

        function setStatus(text, kind, html) {
            status.className = "form-status" + (kind ? " " + kind : "");
            if (html) status.innerHTML = html; else status.textContent = text;
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const ok = Object.keys(fields).map(validate).every(Boolean);
            if (!ok) {
                setStatus("Please fix the highlighted fields.", "err");
                const firstBad = Object.values(fields).find((f) => f.el.getAttribute("aria-invalid") === "true");
                if (firstBad) firstBad.el.focus();
                return;
            }
            if (form.elements._gotcha.value) return; // bot

            const name = fields.name.el.value.trim();
            const email = fields.email.el.value.trim();
            const message = fields.message.el.value.trim();

            if (cfg.formspreeId) {
                submit.disabled = true;
                setStatus("Sending…");
                try {
                    const res = await fetch(`https://formspree.io/f/${encodeURIComponent(cfg.formspreeId)}`, {
                        method: "POST",
                        body: new FormData(form),
                        headers: { Accept: "application/json" }
                    });
                    if (!res.ok) throw new Error("Bad response");
                    setStatus("Thanks! Your message is on its way and I'll reply soon.", "ok");
                    form.reset();
                    count.textContent = "0";
                    Ach.unlock("say-hello");
                } catch {
                    setStatus("", "err", `Couldn't send right now. Please try again, or message me on <a href="${esc(cfg.linkedin || "#")}" target="_blank" rel="noopener">LinkedIn</a>.`);
                } finally {
                    submit.disabled = false;
                }
            } else if (cfg.email) {
                const subject = encodeURIComponent(`Portfolio message from ${name}`);
                const body = encodeURIComponent(`${message}\n\n${name} <${email}>`);
                window.location.href = `mailto:${cfg.email}?subject=${subject}&body=${body}`;
                setStatus("Opening your email app…", "ok");
                Ach.unlock("say-hello");
            } else {
                setStatus("", "err", `This form isn't connected yet. Please message me on <a href="${esc(cfg.linkedin || "#")}" target="_blank" rel="noopener">LinkedIn</a> instead.`);
            }
        });
    }

    /* ================================================================
       Boot
       ================================================================ */

    document.addEventListener("DOMContentLoaded", () => {
        const year = $("#year");
        if (year) year.textContent = new Date().getFullYear();

        initAchievements();
        initNav();
        initRoleRotator();
        initHeroCanvas();
        initFeatured();
        initLibrary();
        initModal();
        initSkills();
        initJourney();
        initRhythm();
        initContact();
        observeReveal();
    });
})();
