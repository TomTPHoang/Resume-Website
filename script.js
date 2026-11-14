/* =====================================================================
   Tom Hoang portfolio: core site script
   Content lives in data.js. Feature modules in js/ plug in through
   window.TH (helpers, event bus, settings, achievements, theme, cheats).
   ===================================================================== */
(() => {
    "use strict";

    const DATA = Object.assign({ games: [], skills: [], journey: [], patchNotes: [], contact: {}, analytics: {}, leaderboard: {} }, window.PORTFOLIO);
    const root = document.documentElement;
    const $ = (sel, r = document) => r.querySelector(sel);
    const $$ = (sel, r = document) => Array.from(r.querySelectorAll(sel));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("reduce-motion");

    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    // Every key is namespaced with "th:" so the save inspector can find them
    // (GitHub Pages sites on the same domain share localStorage).
    const PREFIX = "th:";
    const store = {
        get(key, fallback) {
            try {
                const v = localStorage.getItem(PREFIX + key);
                return v === null ? fallback : JSON.parse(v);
            } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
        },
        remove(key) { try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ } },
        keys() {
            const out = [];
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
                }
            } catch { /* ignore */ }
            return out.sort();
        }
    };

    const bus = document.createElement("span");
    const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));
    const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
    const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    function download(filename, data, type = "application/octet-stream") {
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    async function copyText(text) {
        try { await navigator.clipboard.writeText(text); return true; }
        catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand("copy"); } catch { /* ignore */ }
            ta.remove();
            return ok;
        }
    }

    // Base64url helpers for shareable links.
    const b64 = {
        enc(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
        dec(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
    };

    const TH = window.TH = { DATA, $, $$, esc, store, reduceMotion, on, emit, cssVar, dateKey, download, copyText, b64, modules: [] };

    /* ================================================================
       Settings (UI lives in js/settings.js)
       ================================================================ */

    const SETTINGS_DEFAULTS = {
        themeOnLoad: "random", motion: "auto", volume: 0.8, textSize: 1,
        seasonal: true, flashlight: true, perf: false, boot: true
    };
    const Settings = (() => {
        const s = Object.assign({}, SETTINGS_DEFAULTS, store.get("settings", {}));
        return {
            get: (k) => s[k],
            all: () => Object.assign({}, s),
            set(k, v) {
                s[k] = v;
                store.set("settings", s);
                emit("settings", { key: k, value: v });
            },
            defaults: SETTINGS_DEFAULTS
        };
    })();
    TH.settings = Settings;

    /* ================================================================
       Analytics hook (GoatCounter, optional)
       ================================================================ */

    TH.track = (path, title) => {
        try {
            if (window.goatcounter && window.goatcounter.count) {
                window.goatcounter.count({ path, title: title || path, event: true });
            }
        } catch { /* ignore */ }
    };

    /* ================================================================
       Shared render helpers
       ================================================================ */

    function coverHTML(g) {
        if (g.cover) {
            return `<img class="media-fill" src="${esc(g.cover)}" alt="${esc(g.title)} cover art" loading="lazy">`;
        }
        return `<div class="cover-art" data-art="${esc(g.art || "web")}" style="--h:${Number(g.hue) || 205}" role="img" aria-label="${esc(g.title)}">
                    <canvas class="cover-canvas" aria-hidden="true"></canvas>
                    <span class="cover-genre">${esc(g.subtitle)}</span>
                    <span class="cover-title">${esc(g.title)}</span>
                </div>`;
    }
    const mountCovers = (r) => { if (TH.covers) TH.covers.mount(r); };
    TH.coverHTML = coverHTML;
    TH.mountCovers = mountCovers;

    function thumbSrc(m) {
        if (m.type === "image") return m.src;
        if (m.type === "youtube") return `https://i.ytimg.com/vi/${encodeURIComponent(m.id)}/hqdefault.jpg`;
        return m.poster || "";
    }

    function mediaHTML(m, g) {
        if (m.type === "image") return `<img class="media-fill" src="${esc(m.src)}" alt="${esc(m.caption || g.title + " screenshot")}">`;
        if (m.type === "video") return `<video class="media-fill" src="${esc(m.src)}" ${m.poster ? `poster="${esc(m.poster)}"` : ""} controls playsinline preload="metadata"></video>`;
        if (m.type === "youtube") {
            return `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.id)}?rel=0"
                        title="${esc(m.caption || g.title + " video")}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen loading="lazy"></iframe>`;
        }
        return "";
    }

    function heroMediaHTML(g) {
        const firstImg = (g.media || []).find((m) => m.type === "image");
        let html = !g.cover && firstImg ? `<img class="media-fill" src="${esc(firstImg.src)}" alt="${esc(g.title)}">` : coverHTML(g);
        if (g.preview && !reduceMotion) html += `<video class="media-fill" style="position:absolute;inset:0" src="${esc(g.preview)}" autoplay muted loop playsinline></video>`;
        return html;
    }

    const tagsHTML = (arr) => (arr || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    TH.tagsHTML = tagsHTML;

    function metaHTML(g) {
        const rows = [["Role", g.role], ["Team", g.team], ["Engine", g.engine], ["Year", g.year]].filter(([, v]) => v);
        if (!rows.length) return "";
        return `<dl class="meta-list">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    }

    const LINKS = { play: ["▶ Play", "btn-green"], video: ["Watch trailer", "btn-blue"], repo: ["Source code", "btn-ghost"], page: ["Project page", "btn-ghost"] };
    function linksHTML(g) {
        return Object.keys(LINKS).filter((k) => g.links && g.links[k])
            .map((k) => `<a class="btn ${LINKS[k][1]}" href="${esc(g.links[k])}" target="_blank" rel="noopener">${LINKS[k][0]}</a>`).join("");
    }

    /* ================================================================
       Achievements
       ================================================================ */

    const ACHIEVEMENTS = [
        { id: "press-start",     name: "Press Start",       desc: "Visited the portfolio.",                      icon: "▶", h: 200 },
        { id: "window-shopper",  name: "Window Shopper",    desc: "Opened a game page.",                         icon: "◆", h: 190 },
        { id: "completionist",   name: "Completionist",     desc: "Opened every game page.",                     icon: "★", h: 42 },
        { id: "curator",         name: "Curator",           desc: "Filtered or searched the library.",           icon: "≡", h: 160 },
        { id: "skill-check",     name: "Skill Check",       desc: "Clicked a skill to find its projects.",       icon: "✦", h: 180 },
        { id: "collector",       name: "Collector",         desc: "Flipped every trading card.",                 icon: "▣", h: 190 },
        { id: "beat-initiate",   name: "Beat Initiate",     desc: "Finished a run of Beat Lanes.",               icon: "♪", h: 285 },
        { id: "on-beat",         name: "On Beat",           desc: "Hit 90%+ accuracy in Beat Lanes.",            icon: "♫", h: 320 },
        { id: "hard-mode",       name: "No Sweat",          desc: "Finished Beat Lanes on Hard.",                icon: "♛", h: 0 },
        { id: "full-combo",      name: "Full Combo",        desc: "Finished Beat Lanes without a miss.",         icon: "∞", h: 350, hidden: true },
        { id: "daily-beat",      name: "Daily Rhythm",      desc: "Finished today's Beat Lanes chart.",          icon: "♬", h: 300 },
        { id: "composer",        name: "Composer",          desc: "Shared a chart from the chart editor.",       icon: "♩", h: 280 },
        { id: "visualizer",      name: "Light Show",        desc: "Watched the music visualizer.",               icon: "✷", h: 310 },
        { id: "in-sync",         name: "In Sync",           desc: "Calibrated your audio offset.",               icon: "◷", h: 250 },
        { id: "feel-engineer",   name: "Feel Engineer",     desc: "Tuned a physics value in the Feel Lab.",      icon: "⚙", h: 210 },
        { id: "shard-collector", name: "Shard Collector",   desc: "Cleared the Feel Lab test room.",             icon: "◇", h: 170 },
        { id: "speedrunner",     name: "Speedrunner",       desc: "Cleared the test room in under 20 seconds.",  icon: "»", h: 130, hidden: true },
        { id: "gold-split",      name: "Gold Split",        desc: "Beat your best time for a single split.",     icon: "✪", h: 45 },
        { id: "ghost-buster",    name: "Beat Your Ghost",   desc: "Set a new best while racing a ghost.",        icon: "◌", h: 180 },
        { id: "stomp",           name: "Heads Up",          desc: "Stomped an enemy in the Feel Lab.",           icon: "▼", h: 20 },
        { id: "story-clear",     name: "Story Mode",        desc: "Cleared all four story rooms.",               icon: "❖", h: 260 },
        { id: "boss-down",       name: "Warden Down",       desc: "Defeated the boss.",                          icon: "☠", h: 355 },
        { id: "daily-lab",       name: "Daily Grind",       desc: "Cleared today's Feel Lab room.",              icon: "☼", h: 50 },
        { id: "architect",       name: "Architect",         desc: "Cleared a room you built in the editor.",     icon: "▦", h: 200 },
        { id: "pathfinder",      name: "Pathfinder",        desc: "Ran a pathfinding search.",                   icon: "↯", h: 140 },
        { id: "particle-artist", name: "Particle Artist",   desc: "Exported a particle effect.",                 icon: "✺", h: 25 },
        { id: "shader-hopper",   name: "Shader Hopper",     desc: "Tried every shader.",                         icon: "◍", h: 270 },
        { id: "latency-lab",     name: "Latency Lab",       desc: "Finished the input-lag test.",                icon: "◴", h: 230 },
        { id: "reader",          name: "Reader",            desc: "Opened every devlog post.",                   icon: "❡", h: 80 },
        { id: "look-inside",     name: "Look Inside",       desc: "Explored the site architecture map.",         icon: "⊞", h: 220 },
        { id: "cartographer",    name: "Cartographer",      desc: "Visited every stage on the journey map.",     icon: "◎", h: 30 },
        { id: "scenery",         name: "Change of Scenery", desc: "Switched the site theme.",                    icon: "◐", h: 40 },
        { id: "patch-reader",    name: "Patch Reader",      desc: "Read the older patch notes.",                 icon: "✎", h: 60 },
        { id: "guided",          name: "Guided",            desc: "Finished the site tour.",                     icon: "➜", h: 160 },
        { id: "busy-recruiter",  name: "Busy Recruiter",    desc: "Tried the recruiter view.",                   icon: "▭", h: 0 },
        { id: "quest",           name: "Hired?",            desc: "Completed the hire-me quest.",                icon: "✔", h: 100 },
        { id: "shutterbug",      name: "Shutterbug",        desc: "Downloaded your progress card.",              icon: "▤", h: 210 },
        { id: "paper-trail",     name: "Paper Trail",       desc: "Opened or downloaded the resume.",            icon: "¶", h: 110 },
        { id: "explorer",        name: "Explorer",          desc: "Scrolled all the way to Contact.",            icon: "⚑", h: 15 },
        { id: "say-hello",       name: "Say Hello",         desc: "Sent a message or reached out.",              icon: "✉", h: 95, optional: true },
        { id: "relic-hunter",    name: "Relic Hunter",      desc: "Found all 6 hidden relics.",                  icon: "✧", h: 50, hidden: true },
        { id: "save-scummer",    name: "Save Scummer",      desc: "Opened the save file inspector.",             icon: "≣", h: 120, hidden: true },
        { id: "old-school",      name: "Old School",        desc: "Entered the code.",                           icon: "✚", h: 300, hidden: true }
    ];

    const Ach = (() => {
        const valid = new Set(ACHIEVEMENTS.map((a) => a.id));
        const unlocked = new Set(store.get("ach-unlocked", []).filter((id) => valid.has(id)));
        const required = ACHIEVEMENTS.filter((a) => !a.optional).map((a) => a.id);
        const grid = $("#achGrid");
        const toasts = $("#toasts");

        function updateCounts() {
            const n = unlocked.size, total = ACHIEVEMENTS.length;
            const pct = Math.round((n / total) * 100) + "%";
            [["#achCount", n], ["#achTotal", total], ["#achCountMini", n], ["#achTotalMini", total]]
                .forEach(([sel, v]) => { const el = $(sel); if (el) el.textContent = v; });
            ["#achBar", "#achBarMini"].forEach((sel) => { const el = $(sel); if (el) el.style.width = pct; });
        }

        function render() {
            if (grid) {
                grid.innerHTML = ACHIEVEMENTS.map((a) => {
                    const got = unlocked.has(a.id);
                    const secret = a.hidden && !got;
                    return `<div class="ach ${got ? "unlocked" : "locked"}${secret ? " secret" : ""}" data-id="${a.id}">
                                <div class="ach-icon" style="--h:${a.h}" aria-hidden="true">${secret ? "?" : a.icon}</div>
                                <div>
                                    <div class="ach-name">${secret ? "Hidden achievement" : esc(a.name)}${got ? "" : '<span class="sr-only"> (locked)</span>'}</div>
                                    <div class="ach-desc">${secret ? "Keep exploring." : esc(a.desc)}</div>
                                </div>
                            </div>`;
                }).join("");
            }
            updateCounts();
        }

        function toast(a, kicker = "Achievement unlocked") {
            if (!toasts || root.classList.contains("recruiter")) return;
            const el = document.createElement("div");
            el.className = "toast";
            el.innerHTML = `<div class="ach-icon" style="--h:${a.h}" aria-hidden="true">${a.icon}</div>
                            <div><div class="toast-kicker">${esc(kicker)}</div><div class="toast-name">${esc(a.name)}</div></div>`;
            toasts.appendChild(el);
            while (toasts.children.length > 3) toasts.firstElementChild.remove();
            setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 4200);
        }

        function checkComplete() {
            if (store.get("retro-unlocked", false)) return;
            if (required.every((id) => unlocked.has(id))) {
                store.set("retro-unlocked", true);
                toast({ name: "Retro theme", icon: "▚", h: 120 }, "100% reward unlocked");
                emit("retro-unlocked");
            }
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
            emit("achievement", id);
            TH.track("achievement/" + id, a.name);
            checkComplete();
        }

        function reset() {
            unlocked.clear();
            ["ach-unlocked", "viewed-games", "visited-stages", "relics", "flipped-cards", "devlog-read", "quest", "shaders-seen"].forEach((k) => store.remove(k));
            render();
            emit("ach-reset");
        }

        return { render, unlock, reset, toast, has: (id) => unlocked.has(id), list: ACHIEVEMENTS, unlockedCount: () => unlocked.size };
    })();
    TH.Ach = Ach;

    function initAchievements() {
        Ach.render();
        setTimeout(() => Ach.unlock("press-start"), 1500);

        const reset = $("#achReset");
        if (reset) reset.addEventListener("click", () => {
            if (confirm("Reset all achievements and relics?")) Ach.reset();
        });

        $$("[data-resume]").forEach((a) => a.addEventListener("click", () => { Ach.unlock("paper-trail"); emit("progress", "resume"); }));

        const contact = $("#contact");
        if (contact && "IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    Ach.unlock("explorer");
                    emit("progress", "contact-seen");
                    io.disconnect();
                }
            }, { threshold: 0.35 });
            io.observe(contact);
        }
    }

    /* ================================================================
       Themes: Steam / Expedition / Horror, plus the secret Retro theme.
       A random one is picked on every load (see the inline script in <head>).
       ================================================================ */

    const THEMES = {
        steam:      { label: "Steam",      color: "#171a21" },
        expedition: { label: "Expedition", color: "#0b0908" },
        horror:     { label: "Horror",     color: "#0b0b0a" },
        retro:      { label: "Retro",      color: "#020a04", secret: true }
    };

    const Theme = (() => {
        let current = THEMES[root.dataset.theme] ? root.dataset.theme : "steam";
        const btn = $("#themeMenuBtn");
        const menu = $("#themeMenu");

        const retroUnlocked = () => store.get("retro-unlocked", false) === true;

        function renderMenu() {
            menu.innerHTML = Object.entries(THEMES).map(([id, t]) => {
                const locked = t.secret && !retroUnlocked();
                return `<button type="button" role="menuitemradio" aria-checked="${id === current}" data-theme-btn="${id}" ${locked ? "disabled" : ""}>
                            <span class="swatch swatch-${id}" aria-hidden="true"></span>
                            <span>${locked ? "???" : t.label}${locked ? "<small>Unlock every achievement</small>" : ""}</span>
                        </button>`;
            }).join("");
        }

        function sync() {
            $("#themeName").textContent = THEMES[current].label;
            const meta = $('meta[name="theme-color"]');
            if (meta) meta.content = THEMES[current].color;
            renderMenu();
        }

        function set(theme, origin) {
            if (!THEMES[theme] || theme === current) return;
            if (THEMES[theme].secret && !retroUnlocked()) return;
            const apply = () => {
                if (current === theme) return;
                current = theme;
                root.dataset.theme = theme;
                sync();
                emit("themechange", theme);
            };
            if (origin) {
                const r = origin.getBoundingClientRect();
                root.style.setProperty("--vt-x", Math.round(r.left + r.width / 2) + "px");
                root.style.setProperty("--vt-y", Math.round(r.top + r.height / 2) + "px");
            }
            if (document.startViewTransition && !reduceMotion) {
                let vt = null, finished = false;
                try { vt = document.startViewTransition(apply); } catch { apply(); }
                setTimeout(apply, 400);
                // Watchdog: if the transition stalls (it suppresses rendering), skip it.
                if (vt) {
                    vt.finished.then(() => { finished = true; }, () => { finished = true; });
                    setTimeout(() => { if (!finished) { try { vt.skipTransition(); } catch { /* ignore */ } } }, 1200);
                }
            } else apply();
            Ach.unlock("scenery");
            TH.track("theme/" + theme);
        }

        function openMenu(open) {
            menu.hidden = !open;
            btn.setAttribute("aria-expanded", String(open));
            if (open) {
                const first = menu.querySelector("[aria-checked='true']") || menu.querySelector("button:not([disabled])");
                if (first) first.focus();
            }
        }

        function init() {
            sync();
            btn.addEventListener("click", () => openMenu(menu.hidden));
            menu.addEventListener("click", (e) => {
                const b = e.target.closest("[data-theme-btn]");
                if (!b || b.disabled) return;
                set(b.dataset.themeBtn, btn);
                openMenu(false);
                btn.focus();
            });
            menu.addEventListener("keydown", (e) => {
                const items = $$("button:not([disabled])", menu);
                const i = items.indexOf(document.activeElement);
                if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
                if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
            });
            document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".theme-menu-wrap")) openMenu(false); });
            document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { openMenu(false); btn.focus(); } });
            on("retro-unlocked", renderMenu);
            on("ach-reset", renderMenu);
        }

        return { init, set, get: () => current, list: THEMES, retroUnlocked };
    })();
    TH.theme = Theme;

    /* ================================================================
       Recruiter view: hides the playful sections, shows a summary
       ================================================================ */

    const Recruiter = (() => {
        function render() {
            const box = $("#recruiterGames");
            if (!box) return;
            const games = DATA.games.filter((g) => g.featured).slice(0, 3);
            box.innerHTML = games.map((g) => `
                <button type="button" class="recruiter-game" data-open="${esc(g.id)}">
                    <span class="recruiter-thumb">${coverHTML(g)}</span>
                    <span class="recruiter-game-text">
                        <b>${esc(g.title)}</b>
                        <small>${esc([g.role, g.team, g.engine, g.year].filter(Boolean).join(" · "))}</small>
                        <span>${esc(g.pitch)}</span>
                    </span>
                </button>`).join("");
            box.onclick = (e) => { const b = e.target.closest("[data-open]"); if (b) openGame(b.dataset.open); };
            const skills = $("#recruiterSkills");
            if (skills) skills.innerHTML = tagsHTML(DATA.skills.flatMap((s) => s.items.slice(0, 4)));
            mountCovers(box);
        }
        function set(onState) {
            root.classList.toggle("recruiter", onState);
            try { sessionStorage.setItem("th:recruiter", onState ? "1" : "0"); } catch { /* ignore */ }
            if (onState) { Ach.unlock("busy-recruiter"); TH.track("recruiter-view"); }
            window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
            emit("recruiter", onState);
        }
        function init() {
            render();
            document.addEventListener("click", (e) => {
                if (e.target.closest("[data-recruiter-toggle]")) set(!root.classList.contains("recruiter"));
            });
        }
        return { init, set, active: () => root.classList.contains("recruiter") };
    })();
    TH.recruiter = Recruiter;

    /* ================================================================
       Cheats (Konami code, or 7 taps on the logo)
       ================================================================ */

    const Cheats = (() => {
        const LIST = [
            { id: "autoplay", name: "Auto-play Beat Lanes", desc: "Watch a perfect run. Scores won't save." },
            { id: "moon",     name: "Moon gravity",         desc: "Feel Lab gravity drops to a third. Times won't save." },
            { id: "bighead",  name: "Big head mode",        desc: "A classic." },
            { id: "rainbow",  name: "Rainbow mode",         desc: "Cycle every colour on the page." },
            { id: "outlines", name: "Debug outlines",       desc: "Outline every element, like a layout debugger." }
        ];
        const state = Object.fromEntries(LIST.map((c) => [c.id, false]));
        const panel = $("#cheatPanel");
        const list = $("#cheatList");
        let lastFocus = null;

        function render() {
            list.innerHTML = LIST.map((c) => `
                <label class="toggle">
                    <input type="checkbox" data-cheat="${c.id}" ${state[c.id] ? "checked" : ""}>
                    <span class="toggle-ui" aria-hidden="true"></span>
                    <span class="toggle-text"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span>
                </label>`).join("");
        }
        function set(id, value) {
            state[id] = value;
            root.classList.toggle("cheat-" + id, value);
            emit("cheat", { id, value });
        }
        function open() {
            if (!panel.hidden) return;
            lastFocus = document.activeElement;
            render();
            panel.hidden = false;
            Ach.unlock("old-school");
            const first = $("input", panel);
            if (first) first.focus({ preventScroll: true });
        }
        function close() {
            panel.hidden = true;
            if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
        }
        function init() {
            if (!panel) return;
            list.addEventListener("change", (e) => {
                const box = e.target.closest("[data-cheat]");
                if (box) set(box.dataset.cheat, box.checked);
            });
            $("#cheatClose").addEventListener("click", close);
            document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

            const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
            let pos = 0;
            window.addEventListener("keydown", (e) => {
                if (e.target.closest && e.target.closest("input, textarea, select")) return;
                const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
                pos = key === CODE[pos] ? pos + 1 : (key === CODE[0] ? 1 : 0);
                if (pos === CODE.length) { pos = 0; open(); }
            });

            const brand = $("#brand");
            let taps = 0, timer = 0;
            brand.addEventListener("click", () => {
                taps++;
                clearTimeout(timer);
                timer = setTimeout(() => { taps = 0; }, 2500);
                if (taps >= 7) { taps = 0; open(); }
            });
        }
        return { init, open, close, state };
    })();
    TH.cheats = Cheats;

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
        document.addEventListener("click", (e) => { if (bar.classList.contains("menu-open") && !bar.contains(e.target)) setMenu(false); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && bar.classList.contains("menu-open")) { setMenu(false); toggle.focus(); } });

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
        $$("main > section[id]").forEach((s) => io.observe(s));
    }

    /* ================================================================
       Reveal on scroll
       ================================================================ */

    const revealIO = ("IntersectionObserver" in window && !reduceMotion)
        ? new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { e.target.classList.add("visible"); revealIO.unobserve(e.target); }
            });
        }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" })
        : null;

    function observeReveal(r = document) {
        $$(".reveal:not(.visible)", r).forEach((el) => {
            if (revealIO) revealIO.observe(el); else el.classList.add("visible");
        });
    }
    TH.observeReveal = observeReveal;

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
       Hero background, one mode per theme:
       steam = network, expedition = petals, horror = fog + ash + lilies,
       retro = pixel starfield
       ================================================================ */

    function initHeroCanvas() {
        const canvas = $("#heroCanvas");
        const section = $(".profile");
        if (!canvas || !section) return;
        const ctx = canvas.getContext("2d");
        let W = 0, H = 0, pts = [], extra = [], raf = 0, running = false, mode = Theme.get(), t = 0, staticT = 0;
        const mouse = { x: -9999, y: -9999, px: -9999, py: -9999 };
        const LINK = 120, MOUSE_R = 170;
        const PETAL_COLORS = ["#b3242f", "#d4af6a", "#e9dcc3", "#7d1620"];
        const rand = (a, b) => a + Math.random() * (b - a);

        function newPetal(anywhere) {
            return {
                x: Math.random() * W, y: anywhere ? Math.random() * H : -20,
                vy: rand(0.25, 0.8), sway: Math.random() * Math.PI * 2,
                size: rand(3, 8), rot: Math.random() * Math.PI, vr: rand(-0.02, 0.02),
                flip: Math.random() * Math.PI * 2,
                color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)], alpha: rand(0.35, 0.85)
            };
        }
        function newAsh(anywhere) {
            return { x: Math.random() * W, y: anywhere ? Math.random() * H : -10, vy: rand(0.15, 0.5), sway: Math.random() * 6, size: rand(1, 3), alpha: rand(0.2, 0.6) };
        }

        function seed() {
            const area = W * H;
            extra = [];
            if (mode === "expedition") {
                pts = Array.from({ length: Math.round(Math.min(55, area / 20000)) }, () => newPetal(true));
            } else if (mode === "horror") {
                pts = Array.from({ length: Math.round(Math.min(70, area / 14000)) }, () => newAsh(true));
                extra = Array.from({ length: 7 }, (_, i) => ({ x: rand(0, W), y: rand(H * 0.2, H), r: rand(160, 360), vx: rand(-0.15, 0.15), a: rand(0.05, 0.1) }));
                // Red spider lilies along the bottom, kept to the edges so text stays readable
                const lilies = [];
                const n = Math.max(4, Math.round(W / 160));
                for (let i = 0; i < n; i++) {
                    const side = i % 2 ? rand(W * 0.72, W) : rand(0, W * 0.2);
                    lilies.push({ x: side, h: rand(50, 120), ph: Math.random() * 6, s: rand(0.7, 1.15) });
                }
                pts.lilies = lilies;
            } else if (mode === "retro") {
                pts = Array.from({ length: Math.round(Math.min(120, area / 7000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: rand(0.2, 1) }));
            } else {
                pts = Array.from({ length: Math.round(Math.min(90, area / 13000)) }, () => ({
                    x: Math.random() * W, y: Math.random() * H, vx: rand(-0.15, 0.15), vy: rand(-0.15, 0.15), r: rand(0.5, 1.9)
                }));
            }
        }

        function resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            W = section.clientWidth;
            H = section.clientHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
            if (!running) draw();
        }

        function pushFromMouse(p, strength) {
            const dx = p.x - mouse.x, dy = p.y - mouse.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < MOUSE_R * MOUSE_R && d2 > 1) {
                const d = Math.sqrt(d2), f = (1 - d / MOUSE_R) * strength;
                p.x += (dx / d) * f; p.y += (dy / d) * f;
            }
        }

        function step() {
            t += 1 / 60;
            if (mode === "expedition") {
                for (let i = 0; i < pts.length; i++) {
                    const p = pts[i];
                    p.sway += 0.012;
                    p.x += Math.sin(p.sway) * 0.35 + 0.15;
                    p.y += p.vy; p.rot += p.vr; p.flip += 0.03;
                    pushFromMouse(p, 1.4);
                    if (p.y > H + 20 || p.x > W + 20 || p.x < -20) pts[i] = newPetal(false);
                }
            } else if (mode === "horror") {
                for (let i = 0; i < pts.length; i++) {
                    const p = pts[i];
                    p.sway += 0.01;
                    p.x += Math.sin(p.sway) * 0.25;
                    p.y += p.vy;
                    pushFromMouse(p, 0.8);
                    if (p.y > H + 10) { const n = newAsh(false); Object.assign(p, n); }
                }
                for (const f of extra) { f.x += f.vx; if (f.x < -f.r) f.x = W + f.r; if (f.x > W + f.r) f.x = -f.r; }
                const speed = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
                if (mouse.px > -999 && speed > 40) staticT = 0.25;
                mouse.px = mouse.x; mouse.py = mouse.y;
                staticT = Math.max(0, staticT - 1 / 60);
            } else if (mode === "retro") {
                for (const p of pts) { p.x -= p.z * 1.2; if (p.x < 0) { p.x = W; p.y = Math.random() * H; } }
            } else {
                for (const p of pts) {
                    pushFromMouse(p, 0.6);
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
                    if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
                }
            }
        }

        function drawLily(l) {
            const sway = Math.sin(t * 0.8 + l.ph) * 6;
            const bx = l.x, by = H, tx = l.x + sway, ty = H - l.h;
            ctx.strokeStyle = "rgba(40,70,40,0.75)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sway * 0.3, by - l.h * 0.5, tx, ty); ctx.stroke();
            ctx.save();
            ctx.translate(tx, ty);
            ctx.scale(l.s, l.s);
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + Math.sin(t * 0.5 + l.ph) * 0.05;
                ctx.save();
                ctx.rotate(a);
                // Petal curling back
                ctx.strokeStyle = "rgba(176,18,26,0.9)";
                ctx.lineWidth = 2.4;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -4, 16, 2); ctx.stroke();
                // Long stamen
                ctx.strokeStyle = "rgba(200,30,36,0.7)";
                ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14, -14, 26, -10); ctx.stroke();
                ctx.fillStyle = "rgba(230,190,120,0.8)";
                ctx.fillRect(25, -11, 2, 2);
                ctx.restore();
            }
            ctx.restore();
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            if (mode === "expedition") {
                for (const p of pts) {
                    ctx.save();
                    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.size, p.size * 0.45 * Math.abs(Math.cos(p.flip)) + 0.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                return;
            }
            if (mode === "horror") {
                for (const f of extra) {
                    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
                    g.addColorStop(0, `rgba(190,188,180,${f.a})`);
                    g.addColorStop(1, "rgba(190,188,180,0)");
                    ctx.fillStyle = g;
                    ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
                }
                if (pts.lilies) pts.lilies.forEach(drawLily);
                for (const p of pts) {
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle = "#cfcac0";
                    ctx.fillRect(p.x, p.y, p.size, p.size);
                }
                ctx.globalAlpha = 1;
                if (staticT > 0) {
                    for (let i = 0; i < 40; i++) {
                        ctx.fillStyle = `rgba(220,220,210,${Math.random() * 0.15 * (staticT / 0.25)})`;
                        ctx.fillRect(0, Math.random() * H, W, Math.random() * 2 + 0.5);
                    }
                }
                return;
            }
            if (mode === "retro") {
                for (const p of pts) {
                    ctx.fillStyle = `rgba(80,255,120,${0.25 + p.z * 0.6})`;
                    const s = p.z > 0.7 ? 3 : 2;
                    ctx.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, s, s);
                }
                return;
            }
            ctx.lineWidth = 1;
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                for (let j = i + 1; j < pts.length; j++) {
                    const b = pts[j];
                    const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                    if (d2 < LINK * LINK) {
                        ctx.strokeStyle = `rgba(102,192,244,${(1 - Math.sqrt(d2) / LINK) * 0.16})`;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
                const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
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
            mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
        });
        section.addEventListener("pointerleave", () => { mouse.x = mouse.y = mouse.px = mouse.py = -9999; });
        on("themechange", (th) => { mode = th; seed(); if (!running) draw(); });

        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(section);
        else window.addEventListener("resize", resize);
        resize();
        if ("IntersectionObserver" in window) {
            new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop()))).observe(section);
        } else start();
    }

    /* ================================================================
       Featured carousel
       ================================================================ */

    function initFeatured() {
        const section = $("#featured");
        const r = $("#featuredCarousel");
        const stage = $("#featuredStage");
        const dotsBox = $("#featuredDots");
        const games = DATA.games.filter((g) => g.featured);
        if (!stage) return;
        if (!games.length) { section.hidden = true; return; }

        const MS = 7000;
        const auto = !reduceMotion && games.length > 1;
        let idx = 0, elapsed = 0, last = performance.now(), paused = false, inView = true;
        if (games.length < 2) $(".carousel-arrows", section).hidden = true;

        dotsBox.innerHTML = games.map((g) => `<button role="tab" aria-label="${esc(g.title)}" aria-selected="false"><span class="dot-fill"></span></button>`).join("");
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
                        ${shots.length ? `<div class="feat-thumbs">${shots.map(({ m, i }, n) =>
                            `<button data-open="${esc(g.id)}" data-media="${i}" aria-label="Open screenshot ${n + 1}"><img src="${esc(thumbSrc(m))}" alt="" loading="lazy"></button>`).join("")}</div>`
                            : metaHTML(g)}
                        <div class="tag-row">${tagsHTML(g.tags)}</div>
                        <div class="feat-actions">
                            <button class="btn btn-blue" data-open="${esc(g.id)}">View game page</button>
                            ${g.links && g.links.play ? `<a class="btn btn-green" href="${esc(g.links.play)}" target="_blank" rel="noopener">▶ Play</a>` : ""}
                        </div>
                    </div>
                </article>`;
            mountCovers(stage);
            dots.forEach((d, i) => d.setAttribute("aria-selected", String(i === idx)));
        }
        function go(i) { idx = (i + games.length) % games.length; elapsed = 0; render(); }
        function tick(now) {
            const dt = now - last;
            last = now;
            if (auto && !paused && inView && !document.hidden) { elapsed += dt; if (elapsed >= MS) go(idx + 1); }
            dots.forEach((d, i) => { d.firstElementChild.style.width = i === idx ? (auto ? (elapsed / MS) * 100 : 100) + "%" : "0%"; });
            requestAnimationFrame(tick);
        }

        $("#featPrev").addEventListener("click", () => go(idx - 1));
        $("#featNext").addEventListener("click", () => go(idx + 1));
        dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
        stage.addEventListener("click", (e) => { const t = e.target.closest("[data-open]"); if (t) openGame(t.dataset.open, Number(t.dataset.media) || 0); });
        r.addEventListener("pointerenter", () => { paused = true; });
        r.addEventListener("pointerleave", () => { paused = false; });
        r.addEventListener("focusin", () => { paused = true; });
        r.addEventListener("focusout", (e) => { if (!r.contains(e.relatedTarget)) paused = false; });
        r.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") go(idx - 1); if (e.key === "ArrowRight") go(idx + 1); });
        let sx = null;
        stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") sx = e.clientX; });
        stage.addEventListener("pointerup", (e) => {
            if (sx === null) return;
            const dx = e.clientX - sx; sx = null;
            if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
        });
        if ("IntersectionObserver" in window) new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; }).observe(r);
        render();
        requestAnimationFrame(tick);
    }

    /* ================================================================
       Library
       ================================================================ */

    const Library = { setSkill: () => {} };

    function initLibrary() {
        const grid = $("#libraryGrid");
        if (!grid) return;
        const empty = $("#libraryEmpty");
        const search = $("#librarySearch");
        const sort = $("#librarySort");
        const chips = $$("#libraryFilters .chip");
        const skillBar = $("#skillFilter");
        const state = { filter: "all", q: "", sort: "featured", skill: "" };

        $("#libraryCount").textContent = DATA.games.length;
        const yearOf = (g) => { const m = String(g.year || "").match(/\d{4}/g); return m ? Number(m[m.length - 1]) : 0; };

        function visibleGames() {
            let list = DATA.games.filter((g) => state.filter === "all" || (g.categories || []).includes(state.filter));
            if (state.skill) list = list.filter((g) => (g.skills || []).includes(state.skill));
            if (state.q) {
                const q = state.q.toLowerCase();
                list = list.filter((g) => [g.title, g.subtitle, g.pitch, g.role, g.engine, ...(g.tags || []), ...(g.tech || []), ...(g.skills || [])].join(" ").toLowerCase().includes(q));
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
                const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
                card.style.setProperty("--mx", x * 100 + "%");
                card.style.setProperty("--my", y * 100 + "%");
                if (!reduceMotion) card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-4px)`;
            });
            card.addEventListener("pointerenter", () => { if (video) { card.classList.add("previewing"); video.play().catch(() => {}); } });
            card.addEventListener("pointerleave", () => { card.style.transform = ""; if (video) { card.classList.remove("previewing"); video.pause(); } });
            card.addEventListener("click", (e) => { e.preventDefault(); openGame(card.dataset.open); });
        }

        function renderSkillBar() {
            skillBar.hidden = !state.skill;
            if (!state.skill) return;
            skillBar.innerHTML = `<span>Projects using <b>${esc(state.skill)}</b></span>
                <button type="button" class="chip chip-clear" id="skillClear" aria-label="Clear skill filter">Clear ×</button>`;
            $("#skillClear").addEventListener("click", () => { state.skill = ""; render(); });
        }

        function render() {
            const list = visibleGames();
            grid.innerHTML = list.map(cardHTML).join("");
            empty.hidden = list.length > 0;
            $$(".game-card", grid).forEach(bindCard);
            mountCovers(grid);
            renderSkillBar();
        }

        function setFilter(filter) {
            state.filter = filter;
            chips.forEach((c) => { const a = c.dataset.filter === filter; c.classList.toggle("active", a); c.setAttribute("aria-pressed", String(a)); });
        }

        chips.forEach((chip) => chip.addEventListener("click", () => {
            setFilter(chip.dataset.filter);
            if (state.filter !== "all") Ach.unlock("curator");
            render();
        }));
        let t = 0;
        search.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(() => { state.q = search.value.trim(); if (state.q) Ach.unlock("curator"); render(); }, 120);
        });
        sort.addEventListener("change", () => { state.sort = sort.value; render(); });

        Library.setSkill = (skill) => {
            state.skill = skill; state.q = ""; search.value = "";
            setFilter("all");
            render();
            $("#library").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
            Ach.unlock("skill-check");
        };
        render();
    }

    /* ================================================================
       Game page modal (deep-linkable via #game=<id>)
       ================================================================ */

    const modal = $("#gameModal");
    const modalPanel = modal && $(".modal-panel", modal);
    const modalContent = $("#gmContent");
    let modalOpen = false, lastFocus = null, currentGame = null, currentMedia = 0;
    const gameFromHash = () => { const m = location.hash.match(/^#game=([\w-]+)/); return m ? m[1] : null; };

    function showMedia(i) {
        const g = currentGame, media = g.media || [];
        const viewer = $("#gmViewer"), caption = $("#gmCaption");
        if (!media.length) { viewer.innerHTML = coverHTML(g); mountCovers(viewer); caption.textContent = ""; return; }
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
        const relic = g.id === "zombie-shooter" ? ' <button type="button" class="relic relic-inline" data-relic="6" aria-label="A strange glint"><span aria-hidden="true">✧</span></button>' : "";
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
                    <section class="gm-section"><h3 class="gm-h">About this project</h3><p>${esc(g.about || g.pitch)}${relic}</p></section>
                    ${g.built && g.built.length ? `<section class="gm-section"><h3 class="gm-h">What I built</h3><ul class="gm-built">${g.built.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>` : ""}
                </div>
                <aside>
                    <section class="gm-section"><h3 class="gm-h">Links</h3>
                        ${links ? `<div class="gm-links">${links}</div>` : '<p class="gm-note">Builds and source available on request.</p>'}
                    </section>
                    <section class="gm-section"><h3 class="gm-h">Tech</h3><div class="tag-row">${tagsHTML(g.tech)}</div></section>
                </aside>
            </div>`;
        const thumbs = $("#gmThumbs");
        if (thumbs) thumbs.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) showMedia(Number(b.dataset.i)); });
        showMedia(mediaIndex);
        mountCovers(modalContent);

        modal.hidden = false;
        modalOpen = true;
        document.body.style.overflow = "hidden";
        modal.scrollTop = 0;
        modalPanel.focus({ preventScroll: true });
        if (push && gameFromHash() !== id) history.pushState({ modal: true }, "", "#game=" + id);

        Ach.unlock("window-shopper");
        const viewed = new Set(store.get("viewed-games", []));
        viewed.add(id);
        store.set("viewed-games", [...viewed]);
        if (DATA.games.every((x) => viewed.has(x.id))) Ach.unlock("completionist");
        emit("progress", "game");
        TH.track("game/" + id, g.title);
    }
    TH.openGame = openGame;
    TH.isModalOpen = () => modalOpen || $$(".modal").some((m) => !m.hidden);

    function closeGame({ fromPop = false } = {}) {
        if (!modalOpen) return;
        modalOpen = false;
        modal.hidden = true;
        modalContent.innerHTML = "";
        document.body.style.overflow = "";
        if (!fromPop) {
            if (history.state && history.state.modal) history.back();
            else history.replaceState(null, "", location.pathname + location.search);
        }
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    // Generic focus trap for every .modal dialog.
    function trapFocus(e, panel) {
        const f = $$('a[href], button:not([disabled]), input, select, textarea, iframe, video[controls], [tabindex]:not([tabindex="-1"])', panel)
            .filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    TH.trapFocus = trapFocus;

    function initModal() {
        if (!modal) return;
        modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeGame(); });
        document.addEventListener("keydown", (e) => {
            if (!modalOpen) return;
            if (e.key === "Escape") { e.preventDefault(); closeGame(); return; }
            if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && currentGame && (currentGame.media || []).length > 1) {
                showMedia(currentMedia + (e.key === "ArrowRight" ? 1 : -1));
                return;
            }
            if (e.key === "Tab") trapFocus(e, modalPanel);
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
       Skills
       ================================================================ */

    function initSkills() {
        const grid = $("#skillsGrid");
        if (!grid) return;
        const count = (skill) => DATA.games.filter((g) => (g.skills || []).includes(skill)).length;
        grid.innerHTML = DATA.skills.map((s) => `
            <div class="skill-card reveal">
                <h3>${esc(s.group)}</h3>
                <div class="tag-row">${s.items.map((item) => {
                    const n = count(item);
                    return n
                        ? `<button type="button" class="tag tag-btn" data-skill="${esc(item)}" aria-label="${esc(item)}: show ${n} project${n > 1 ? "s" : ""}">${esc(item)}<span class="tag-count" aria-hidden="true">${n}</span></button>`
                        : `<span class="tag tag-dim" title="Not tied to a listed project yet">${esc(item)}</span>`;
                }).join("")}</div>
            </div>`).join("");
        grid.addEventListener("click", (e) => { const b = e.target.closest("[data-skill]"); if (b) Library.setSkill(b.dataset.skill); });
    }

    /* ================================================================
       Journey map
       ================================================================ */

    function initJourney() {
        const track = $("#mapTrack");
        if (!track || !DATA.journey.length) return;
        const nodesBox = $("#mapNodes"), svg = $("#mapPath"), marker = $("#mapMarker"), detail = $("#mapDetail");
        const stages = DATA.journey;
        let sel = stages.length - 1;
        const visited = new Set(store.get("visited-stages", []));

        nodesBox.innerHTML = stages.map((s, i) => `
            <button type="button" class="map-node" role="tab" id="mapNode${i}" aria-controls="mapDetail" aria-selected="false" tabindex="-1" data-i="${i}">
                <span class="node-orb"><span>${i + 1}</span></span>
                <span class="node-date">${esc(s.date)}</span>
                <span class="node-title">${esc(s.title)}</span>
            </button>`).join("");
        const nodes = $$(".map-node", nodesBox);

        function centers() {
            const t = track.getBoundingClientRect();
            return nodes.map((n) => { const r = $(".node-orb", n).getBoundingClientRect(); return { x: r.left - t.left + r.width / 2, y: r.top - t.top + r.height / 2 }; });
        }
        function pathThrough(pts) {
            if (!pts.length) return "";
            let d = `M${pts[0].x},${pts[0].y}`;
            for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a.x + b.x) / 2; d += ` C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`; }
            return d;
        }
        function drawPath() {
            const pts = centers();
            svg.setAttribute("width", track.scrollWidth);
            svg.setAttribute("height", track.scrollHeight);
            svg.innerHTML = `<path class="map-path-bg" d="${pathThrough(pts)}"/><path class="map-path-done" d="${pathThrough(pts.slice(0, sel + 1))}"/>`;
            const p = pts[sel];
            if (p) marker.style.transform = `translate(${p.x}px, ${p.y}px)`;
        }
        function select(i, focus, countVisit = true) {
            sel = i;
            nodes.forEach((n, k) => { n.setAttribute("aria-selected", String(k === i)); n.tabIndex = k === i ? 0 : -1; n.classList.toggle("cleared", k < i); });
            if (focus) nodes[i].focus();
            const s = stages[i];
            const games = (s.games || []).map((id) => DATA.games.find((g) => g.id === id)).filter(Boolean);
            detail.setAttribute("aria-labelledby", "mapNode" + i);
            detail.innerHTML = `
                <div class="map-detail-text">
                    <p class="map-stage">${esc(s.stage || "Stage " + (i + 1))} · ${esc(s.date)}</p>
                    <h3>${esc(s.title)}</h3>
                    <p>${esc(s.text)}</p>
                </div>
                ${games.length ? `<div class="map-games"><p class="map-games-label">Shipped this stage</p>
                    ${games.map((g) => `<button type="button" class="map-game" data-open="${esc(g.id)}"><span class="map-game-thumb">${coverHTML(g)}</span><span><b>${esc(g.title)}</b><small>${esc(g.subtitle)}</small></span></button>`).join("")}
                </div>` : ""}`;
            mountCovers(detail);
            drawPath();
            if (!countVisit) return;
            visited.add(i);
            store.set("visited-stages", [...visited]);
            if (visited.size >= stages.length) Ach.unlock("cartographer");
        }
        nodesBox.addEventListener("click", (e) => { const n = e.target.closest(".map-node"); if (n) select(Number(n.dataset.i)); });
        nodesBox.addEventListener("keydown", (e) => {
            const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (d) { e.preventDefault(); select((sel + d + stages.length) % stages.length, true); }
            if (e.key === "Home") { e.preventDefault(); select(0, true); }
            if (e.key === "End") { e.preventDefault(); select(stages.length - 1, true); }
        });
        detail.addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (b) openGame(b.dataset.open); });
        if ("ResizeObserver" in window) new ResizeObserver(drawPath).observe(track);
        window.addEventListener("resize", drawPath);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawPath);
        on("themechange", () => requestAnimationFrame(drawPath));
        select(sel, false, false);
    }

    /* ================================================================
       Patch notes
       ================================================================ */

    function initPatchNotes() {
        const box = $("#patchList");
        const notes = DATA.patchNotes || [];
        if (!box) return;
        if (!notes.length) { $("#patch-notes").hidden = true; return; }
        const badge = $("#versionBadge");
        if (badge) badge.textContent = "v" + notes[0].version;
        const LABEL = { new: "New", change: "Changed", fix: "Fixed" };
        const fmt = (d) => { const dt = new Date(d + "T12:00:00"); return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); };
        box.innerHTML = notes.map((p, i) => `
            <details class="patch reveal" ${i === 0 ? "open" : ""} data-i="${i}">
                <summary>
                    <span class="patch-version">v${esc(p.version)}</span>
                    <span class="patch-title">${esc(p.title || "")}</span>
                    <span class="patch-date">${esc(fmt(p.date))}</span>
                    ${i === 0 ? '<span class="patch-latest">Latest</span>' : ""}
                </summary>
                <ul class="patch-notes">${p.notes.map((n) => `<li><span class="patch-type patch-type--${esc(n.type)}">${LABEL[n.type] || esc(n.type)}</span>${esc(n.text)}</li>`).join("")}</ul>
            </details>`).join("");
        $$("details.patch", box).forEach((d) => d.addEventListener("toggle", () => { if (d.open && d.dataset.i !== "0") Ach.unlock("patch-reader"); }));
    }

    /* ================================================================
       Contact form
       ================================================================ */

    function initContact() {
        const form = $("#contactForm");
        if (!form) return;
        const status = $("#cfStatus"), submit = $("#cfSubmit"), count = $("#cfCount");
        const cfg = DATA.contact || {};
        const fields = {
            name: { el: $("#cfName"), err: $("#cfNameErr"), check: (v) => v.length >= 2 ? "" : v ? "That name looks a bit short." : "Please enter your name." },
            email: { el: $("#cfEmail"), err: $("#cfEmailErr"), check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : v ? "That email doesn't look right." : "Please enter your email." },
            message: { el: $("#cfMsg"), err: $("#cfMsgErr"), check: (v) => v.length >= 10 ? "" : v ? "A little more detail, please (10+ characters)." : "Please write a message." }
        };
        function validate(key) {
            const f = fields[key], msg = f.check(f.el.value.trim());
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
        const reached = () => { Ach.unlock("say-hello"); emit("progress", "contact"); };
        $$("[data-contact-link]").forEach((a) => a.addEventListener("click", reached));

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const ok = Object.keys(fields).map(validate).every(Boolean);
            if (!ok) {
                setStatus("Please fix the highlighted fields.", "err");
                const bad = Object.values(fields).find((f) => f.el.getAttribute("aria-invalid") === "true");
                if (bad) bad.el.focus();
                return;
            }
            if (form.elements._gotcha.value) return;
            const name = fields.name.el.value.trim(), email = fields.email.el.value.trim(), message = fields.message.el.value.trim();
            if (cfg.formspreeId) {
                submit.disabled = true;
                setStatus("Sending…");
                try {
                    const res = await fetch(`https://formspree.io/f/${encodeURIComponent(cfg.formspreeId)}`, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
                    if (!res.ok) throw new Error("Bad response");
                    setStatus("Thanks! Your message is on its way and I'll reply soon.", "ok");
                    form.reset();
                    count.textContent = "0";
                    reached();
                } catch {
                    setStatus("", "err", `Couldn't send right now. Please try again, or message me on <a href="${esc(cfg.linkedin || "#")}" target="_blank" rel="noopener">LinkedIn</a>.`);
                } finally { submit.disabled = false; }
            } else if (cfg.email) {
                window.location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(`Portfolio message from ${name}`)}&body=${encodeURIComponent(`${message}\n\n${name} <${email}>`)}`;
                setStatus("Opening your email app…", "ok");
                reached();
            } else {
                setStatus("", "err", `This form isn't connected yet. Please message me on <a href="${esc(cfg.linkedin || "#")}" target="_blank" rel="noopener" data-contact-link>LinkedIn</a> instead.`);
                const a = status.querySelector("[data-contact-link]");
                if (a) a.addEventListener("click", reached);
            }
        });
    }

    /* ================================================================
       Boot
       ================================================================ */

    document.addEventListener("DOMContentLoaded", () => {
        const year = $("#year");
        if (year) year.textContent = new Date().getFullYear();
        const run = (name, fn) => { try { fn(); } catch (err) { console.error(`[${name}]`, err); } };

        run("achievements", initAchievements);
        run("theme", Theme.init);
        run("recruiter", Recruiter.init);
        run("cheats", Cheats.init);
        run("nav", initNav);
        run("role", initRoleRotator);
        run("hero", initHeroCanvas);
        run("featured", initFeatured);
        run("library", initLibrary);
        run("modal", initModal);
        run("skills", initSkills);
        run("journey", initJourney);
        run("patch", initPatchNotes);
        run("contact", initContact);
        TH.modules.forEach(([name, fn]) => run(name, fn));
        observeReveal();
    });
})();
