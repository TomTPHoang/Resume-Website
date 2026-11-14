/* =====================================================================
   Settings menu (#46) and save-file inspector (#38)
   ===================================================================== */
(() => {
    "use strict";
    const TH = window.TH;
    if (!TH) return;
    const { $, $$, esc, store, on, settings } = TH;
    const root = document.documentElement;

    // Small helper shared by both dialogs.
    function dialog(modal, onOpen) {
        const panel = $(".modal-panel", modal);
        let last = null;
        function open() {
            last = document.activeElement;
            if (onOpen) onOpen();
            modal.hidden = false;
            document.body.style.overflow = "hidden";
            panel.focus({ preventScroll: true });
        }
        function close() {
            modal.hidden = true;
            if (!$$(".modal").some((m) => !m.hidden)) document.body.style.overflow = "";
            if (last && last.focus) last.focus({ preventScroll: true });
        }
        modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
        modal.addEventListener("keydown", (e) => {
            if (e.key === "Escape") { e.preventDefault(); close(); }
            if (e.key === "Tab") TH.trapFocus(e, panel);
        });
        return { open, close };
    }

    /* ---------- Settings ---------- */
    function initSettings() {
        const modal = $("#settingsModal");
        const body = $("#settingsBody");
        if (!modal) return;

        function render() {
            const s = settings.all();
            const themes = Object.entries(TH.theme.list).filter(([id, t]) => !t.secret || TH.theme.retroUnlocked());
            const seg = (key, items) => `<div class="seg seg-left" role="radiogroup" aria-label="${key}">${items.map(([v, l]) =>
                `<button type="button" role="radio" aria-checked="${String(s[key]) === String(v)}" data-set="${key}" data-val="${v}">${l}</button>`).join("")}</div>`;
            const toggle = (key, label, tip) => `
                <label class="toggle"><input type="checkbox" data-set-bool="${key}" ${s[key] ? "checked" : ""}>
                <span class="toggle-ui" aria-hidden="true"></span><span class="toggle-text"><b>${label}</b><small>${tip}</small></span></label>`;
            body.innerHTML = `
                <section class="settings-group">
                    <h3 class="side-title">Theme when the site loads</h3>
                    <label class="select"><span class="sr-only">Theme on load</span>
                        <select data-set-select="themeOnLoad">
                            <option value="random" ${s.themeOnLoad === "random" ? "selected" : ""}>Random every visit</option>
                            ${themes.map(([id, t]) => `<option value="${id}" ${s.themeOnLoad === id ? "selected" : ""}>${esc(t.label)}</option>`).join("")}
                        </select></label>
                </section>
                <section class="settings-group">
                    <h3 class="side-title">Motion</h3>
                    ${seg("motion", [["auto", "Follow my system"], ["reduced", "Reduce motion"]])}
                    <p class="side-note">Reduced motion turns off background animations, card tilts and screen shake. Some changes apply after a reload.</p>
                </section>
                <section class="settings-group">
                    <h3 class="side-title">Text size</h3>
                    ${seg("textSize", [[1, "100%"], [1.12, "112%"], [1.25, "125%"]])}
                </section>
                <section class="settings-group">
                    <h3 class="side-title">Sound</h3>
                    <div class="range-row"><input type="range" data-set-range="volume" min="0" max="1" step="0.05" value="${s.volume}" aria-label="Game volume"><output>${Math.round(s.volume * 100)}%</output></div>
                </section>
                <section class="settings-group">
                    <h3 class="side-title">Extras</h3>
                    <div class="toggle-list">
                        ${toggle("seasonal", "Seasonal effects", "Snow in winter, fog at Halloween and other date-based touches.")}
                        ${toggle("flashlight", "Horror flashlight", "In the horror theme, light follows your cursor.")}
                        ${toggle("boot", "Boot screen", "Show the short intro once per visit.")}
                        ${toggle("perf", "Performance overlay", "Frame rate and frame-time graph. Shortcut: the ` key.")}
                    </div>
                </section>
                <section class="settings-group settings-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-recruiter-toggle>${TH.recruiter.active() ? "Exit recruiter view" : "Recruiter view"}</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-act="tour">Take the tour</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-act="save">Save data inspector</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-act="reset">Reset settings</button>
                </section>`;
        }

        const dlg = dialog(modal, render);
        $("#settingsBtn").addEventListener("click", dlg.open);

        body.addEventListener("click", (e) => {
            const b = e.target.closest("[data-set]");
            if (b) {
                const key = b.dataset.set;
                const val = key === "textSize" ? Number(b.dataset.val) : b.dataset.val;
                settings.set(key, val);
                render();
                const again = body.querySelector(`[data-set="${key}"][data-val="${b.dataset.val}"]`);
                if (again) again.focus();
                return;
            }
            const a = e.target.closest("[data-act]");
            if (!a) return;
            if (a.dataset.act === "tour") { dlg.close(); TH.emit("tour-start"); }
            if (a.dataset.act === "save") { dlg.close(); TH.emit("open-save"); }
            if (a.dataset.act === "reset") {
                Object.entries(settings.defaults).forEach(([k, v]) => settings.set(k, v));
                render();
            }
        });
        body.addEventListener("click", (e) => { if (e.target.closest("[data-recruiter-toggle]")) dlg.close(); });
        body.addEventListener("change", (e) => {
            const t = e.target;
            if (t.dataset.setBool) settings.set(t.dataset.setBool, t.checked);
            if (t.dataset.setSelect) settings.set(t.dataset.setSelect, t.value);
        });
        body.addEventListener("input", (e) => {
            const t = e.target;
            if (!t.dataset.setRange) return;
            settings.set(t.dataset.setRange, Number(t.value));
            t.nextElementSibling.textContent = Math.round(Number(t.value) * 100) + "%";
        });

        // Apply visual settings live.
        function apply() {
            root.classList.toggle("reduce-motion", settings.get("motion") === "reduced");
            root.style.setProperty("--text-scale", settings.get("textSize") || 1);
        }
        on("settings", apply);
        apply();
    }

    /* ---------- Save inspector ---------- */
    function initSave() {
        const modal = $("#saveModal");
        if (!modal) return;
        const text = $("#saveText");
        const status = $("#saveStatus");
        const snapshot = () => Object.fromEntries(store.keys().map((k) => [k, store.get(k, null)]));
        const fill = (obj) => { text.value = JSON.stringify(obj, null, 2); status.textContent = `${Object.keys(obj).length} keys`; status.className = "form-status"; };
        const dlg = dialog(modal, () => { fill(snapshot()); TH.Ach.unlock("save-scummer"); });
        $("#openSaveInspector").addEventListener("click", dlg.open);
        on("open-save", dlg.open);
        text.addEventListener("keydown", (e) => e.stopPropagation());

        function reloadNote(msg) {
            status.className = "form-status ok";
            status.innerHTML = `${esc(msg)} <button type="button" class="text-btn" id="saveReload">Reload to apply</button>`;
            $("#saveReload").addEventListener("click", () => location.reload());
        }
        $("#saveApply").addEventListener("click", () => {
            let obj;
            try { obj = JSON.parse(text.value); } catch (err) { status.className = "form-status err"; status.textContent = "Invalid JSON: " + err.message; return; }
            if (!obj || typeof obj !== "object" || Array.isArray(obj)) { status.className = "form-status err"; status.textContent = "The save must be a JSON object of key → value."; return; }
            store.keys().forEach((k) => { if (!(k in obj)) store.remove(k); });
            Object.entries(obj).forEach(([k, v]) => store.set(k, v));
            reloadNote("Saved.");
        });
        $("#saveExport").addEventListener("click", () => {
            TH.download(`tom-hoang-save-${TH.dateKey()}.json`, JSON.stringify(snapshot(), null, 2), "application/json");
        });
        $("#saveImport").addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try { fill(JSON.parse(reader.result)); status.textContent = "Imported. Review it, then press Apply changes."; }
                catch { status.className = "form-status err"; status.textContent = "That file isn't valid JSON."; }
            };
            reader.readAsText(file);
            e.target.value = "";
        });
        $("#saveWipe").addEventListener("click", () => {
            if (!confirm("Delete every achievement, score, ghost and setting this site has saved?")) return;
            store.keys().forEach((k) => store.remove(k));
            fill({});
            reloadNote("Wiped.");
        });
    }

    TH.modules.push(["settings", () => { initSettings(); initSave(); }]);
})();
