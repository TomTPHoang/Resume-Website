/* =====================================================================
   Leaderboards (#32)
   Global boards via Supabase's REST API when keys are set in data.js
   (see docs/leaderboard.sql), otherwise this browser's own top runs.
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, esc, store, on, DATA } = TH;

    const cfg = DATA.leaderboard || {};
    const online = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
    const base = online ? cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/scores" : "";
    const headers = online ? { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey } : {};

    const SONGS = [["pulse", "Pulse"], ["overdrive", "Overdrive"], ["drift", "Drift"]];
    const DIFFS = [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]];
    const ROOMS = [["test", "Test Room"], ["story1", "1 · First Steps"], ["story2", "2 · The Chimney"], ["story3", "3 · Dash Gap"], ["story4", "4 · Patrol Yard"], ["boss", "Boss · The Warden"]];

    const BOARDS = [];
    SONGS.forEach(([s, sl]) => DIFFS.forEach(([d, dl]) => BOARDS.push({ id: `beat:${s}:${d}`, label: `Beat Lanes · ${sl} / ${dl}`, order: "desc", fmt: (v) => Number(v).toLocaleString() })));
    BOARDS.push({ id: "beat:daily", label: "Beat Lanes · Today's chart", order: "desc", fmt: (v) => Number(v).toLocaleString(), daily: true });
    ROOMS.forEach(([r, rl]) => BOARDS.push({ id: `lab:${r}`, label: `Feel Lab · ${rl}`, order: "asc", fmt: (v) => Number(v).toFixed(2) + "s" }));
    BOARDS.push({ id: "lab:daily", label: "Feel Lab · Today's room", order: "asc", fmt: (v) => Number(v).toFixed(2) + "s", daily: true });

    // Daily boards are keyed by date so each day starts fresh.
    const boardKey = (id) => (BOARDS.find((b) => b.id === id) || {}).daily ? `${id}:${TH.dateKey()}` : id;
    const boardOf = (id) => BOARDS.find((b) => b.id === id);
    const cleanName = (n) => String(n || "").replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 16);

    function localTop(id) { return (store.get("lb-local", {})[boardKey(id)] || []); }
    function saveLocal(id, entry) {
        const all = store.get("lb-local", {});
        const key = boardKey(id);
        const list = (all[key] || []).concat(entry);
        const b = boardOf(id);
        list.sort((a, c) => b.order === "asc" ? a.score - c.score : c.score - a.score);
        all[key] = list.slice(0, 10);
        store.set("lb-local", all);
    }

    async function top(id, n = 10) {
        if (!online) return localTop(id);
        const b = boardOf(id);
        const url = `${base}?board=eq.${encodeURIComponent(boardKey(id))}&select=name,score,created_at&order=score.${b.order === "asc" ? "asc" : "desc"}&limit=${n}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("Leaderboard fetch failed");
        return res.json();
    }

    async function submit(id, name, score) {
        name = cleanName(name);
        if (name.length < 2) throw new Error("Name must be at least 2 letters or numbers.");
        store.set("player-name", name);
        saveLocal(id, { name, score, created_at: new Date().toISOString() });
        if (online) {
            const res = await fetch(base, {
                method: "POST",
                headers: Object.assign({ "Content-Type": "application/json", Prefer: "return=minimal" }, headers),
                body: JSON.stringify({ board: boardKey(id), name, score })
            });
            if (!res.ok) throw new Error("Couldn't reach the global board, saved locally.");
        }
        TH.emit("leaderboard", id);
    }

    // Small inline "submit your score" form for result screens.
    function formHTML() {
        return `<form class="lb-form" novalidate>
                    <label class="sr-only" for="lbName">Name for the leaderboard</label>
                    <input id="lbName" name="name" maxlength="16" placeholder="Your name" value="${esc(store.get("player-name", ""))}" autocomplete="nickname">
                    <button type="submit" class="btn btn-ghost btn-sm">Submit score</button>
                    <span class="lb-form-status" role="status"></span>
                </form>`;
    }
    function bindForm(container, id, score) {
        const form = container.querySelector(".lb-form");
        if (!form) return;
        const status = form.querySelector(".lb-form-status");
        // Keep keystrokes inside the form from reaching the games.
        form.addEventListener("keydown", (e) => e.stopPropagation());
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = form.querySelector("button");
            btn.disabled = true;
            status.textContent = "Submitting…";
            try {
                await submit(id, form.elements.name.value, score);
                status.textContent = online ? "Posted!" : "Saved to your local board.";
                form.elements.name.disabled = true;
            } catch (err) {
                status.textContent = err.message;
                btn.disabled = false;
            }
        });
    }

    function init() {
        const select = $("#lbBoard");
        const list = $("#lbList");
        const status = $("#lbStatus");
        if (!select) return;
        select.innerHTML = BOARDS.map((b) => `<option value="${b.id}">${esc(b.label)}</option>`).join("");
        $("#lbSub").textContent = online
            ? "Global top 10 for Beat Lanes and the Feel Lab. Submit a score from any results screen."
            : "Your best runs in this browser. Submit a score from any results screen.";

        async function render() {
            const b = boardOf(select.value);
            list.innerHTML = '<li class="lb-empty">Loading…</li>';
            try {
                const rows = await top(b.id);
                list.innerHTML = rows.length
                    ? rows.map((r, i) => `<li><span class="lb-rank">${i + 1}</span><span class="lb-name">${esc(r.name)}</span><span class="lb-score">${esc(b.fmt(r.score))}</span></li>`).join("")
                    : '<li class="lb-empty">No runs yet. Be the first.</li>';
                status.textContent = online ? "" : "Global boards are offline, so these are scores from this browser.";
            } catch {
                list.innerHTML = '<li class="lb-empty">Couldn\'t load the board right now.</li>';
            }
        }
        select.addEventListener("change", render);
        on("leaderboard", (id) => { if (id === select.value) render(); });
        on("lb-show", (id) => { if (boardOf(id)) { select.value = id; render(); } });
        render();
    }

    TH.leaderboard = { online, boards: BOARDS, top, submit, formHTML, bindForm };
    TH.modules.push(["leaderboard", init]);
})();
