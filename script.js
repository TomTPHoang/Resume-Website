document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const themeToggle = document.getElementById("themeToggle");
    const toggleIcon = themeToggle.querySelector(".toggle-icon");
    const filterBtns = document.querySelectorAll(".filter-btn");
    const projectCards = document.querySelectorAll(".project-card");
    const scrollTopBtn = document.getElementById("scrollTopBtn");
    const contactForm = document.getElementById("contactForm");
    const formStatus = document.getElementById("formStatus");
    const yearSpan = document.getElementById("year");
    const rollingNumbers = document.querySelectorAll(".rolling-number");
    const skillXpFills = document.querySelectorAll(".skill-xp-fill");
    const downloadResumeBtn = document.getElementById("downloadResumeBtn");
    const resumeDownloadCountSpan = document.getElementById("resumeDownloadCount");
    const lazyImages = document.querySelectorAll(".lazy-img");
    const navLinks = document.querySelectorAll(".main-nav a");

    const emailInput = document.getElementById("email");
    const nameInput = document.getElementById("name");
    const messageInput = document.getElementById("message");
    const emailError = document.getElementById("emailError");
    const nameError = document.getElementById("nameError");
    const messageError = document.getElementById("messageError");
    const messageCharCount = document.getElementById("messageCharCount");

    // --- small helpers ---
    const RESUME_PATH = "files/Tom_Hoang_Resume.pdf";

    // --- Footer year ---
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // ============ THEME PERSISTENCE ============
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
        root.setAttribute("data-theme", savedTheme);
        updateThemeIcon(savedTheme);
    } else {
        updateThemeIcon("dark");
    }

    function updateThemeIcon(theme) {
        toggleIcon.textContent = theme === "light" ? "☀" : "☾";
    }

    themeToggle.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        updateThemeIcon(next);
    });

    // ============ #1 TYPEWRITER ROLE ROTATOR ============
    const roleRotatorEl = document.getElementById("roleRotator");
    const roles = [
        "Game Programmer",
        "Tools & Systems Developer",
        "Unity / C# Developer",
        "Web & Backend Developer"
    ];
    let roleIndex = 0;
    let charIndex = 0;
    let typingForward = true;

    function stepTypewriter() {
        if (!roleRotatorEl) return;

        const currentRole = roles[roleIndex];

        if (typingForward) {
            charIndex++;
            if (charIndex >= currentRole.length) {
                charIndex = currentRole.length;
                typingForward = false;
                roleRotatorEl.textContent = currentRole.slice(0, charIndex);
                setTimeout(stepTypewriter, 1400);
                return;
            }
        } else {
            charIndex--;
            if (charIndex <= 0) {
                charIndex = 0;
                typingForward = true;
                roleIndex = (roleIndex + 1) % roles.length;
                roleRotatorEl.textContent = "";
                setTimeout(stepTypewriter, 300);
                return;
            }
        }

        roleRotatorEl.textContent = currentRole.slice(0, charIndex);
        const delay = typingForward ? 80 : 40;
        setTimeout(stepTypewriter, delay);
    }

    stepTypewriter();

    // ============ PROJECT FILTERS ============
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const filter = btn.getAttribute("data-filter");

            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            projectCards.forEach(card => {
                const category = card.getAttribute("data-category") || "";
                if (filter === "all" || category.includes(filter)) {
                    card.style.display = "";
                } else {
                    card.style.display = "none";
                }
            });
        });
    });

    // ============ SCROLL TO TOP BUTTON ============
    window.addEventListener("scroll", () => {
        const scrollY = window.scrollY || window.pageYOffset;
        if (scrollY > 300) {
            scrollTopBtn.classList.add("show");
        } else {
            scrollTopBtn.classList.remove("show");
        }
    });

    scrollTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // ============ REVEAL ON SCROLL ============
    const revealEls = document.querySelectorAll(".reveal");

    const revealObserver = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15
        }
    );

    revealEls.forEach(el => revealObserver.observe(el));

    // ============ ROLLING NUMBERS (#stats) ============
    const statsObserver = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startRollingNumbers();
                    statsObserver.disconnect();
                }
            });
        },
        {
            threshold: 0.3
        }
    );

    if (rollingNumbers.length > 0) {
        const firstStat = rollingNumbers[0].closest(".stat-card");
        if (firstStat) {
            statsObserver.observe(firstStat);
        }
    }

    function startRollingNumbers() {
        rollingNumbers.forEach(span => {
            const target = parseInt(span.getAttribute("data-target"), 10) || 0;
            let current = 0;
            const duration = 1400 + Math.random() * 600;
            const interval = 30;
            const steps = duration / interval;
            const increment = Math.max(1, Math.floor(target / steps));
            let elapsed = 0;

            const timer = setInterval(() => {
                elapsed += interval;
                current += increment + Math.floor(Math.random() * 2);

                if (elapsed >= duration || current >= target) {
                    span.textContent = target.toString();
                    clearInterval(timer);
                } else {
                    span.textContent = current.toString();
                }
            }, interval);
        });
    }

    // ============ #5 SKILL XP BAR ANIMATION ============
    const skillObserverTarget = document.querySelector(".skill-xp-grid");
    if (skillObserverTarget) {
        const skillObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        skillXpFills.forEach(fill => {
                            const percent = parseInt(fill.getAttribute("data-percent"), 10) || 0;
                            fill.style.width = percent + "%";
                        });
                        skillObserver.disconnect();
                    }
                });
            },
            { threshold: 0.3 }
        );
        skillObserver.observe(skillObserverTarget);
    }

    // ============ #8 RESUME DOWNLOAD + COUNTER ============
    function loadResumeDownloadCount() {
        const stored = sessionStorage.getItem("resumeDownloadCount");
        const value = stored ? parseInt(stored, 10) || 0 : 0;
        if (resumeDownloadCountSpan) {
            resumeDownloadCountSpan.textContent = value.toString();
        }
    }

    function incrementResumeDownloadCount() {
        const stored = sessionStorage.getItem("resumeDownloadCount");
        const value = stored ? parseInt(stored, 10) || 0 : 0;
        const next = value + 1;
        sessionStorage.setItem("resumeDownloadCount", next.toString());
        if (resumeDownloadCountSpan) {
            resumeDownloadCountSpan.textContent = next.toString();
        }
    }

    loadResumeDownloadCount();

    if (downloadResumeBtn) {
        downloadResumeBtn.addEventListener("click", () => {
            // Programmatic download
            const link = document.createElement("a");
            link.href = RESUME_PATH;
            link.download = "Tom_Hoang_Resume.pdf"; // adjust if you rename
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            incrementResumeDownloadCount();
        });
    }

    // ============ #12 LAZY-LOADING IMAGES ============
    if ("IntersectionObserver" in window && lazyImages.length > 0) {
        const imgObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.getAttribute("data-src");
                        if (src) {
                            img.src = src;
                            img.addEventListener("load", () => {
                                img.classList.add("loaded");
                            }, { once: true });
                            imgObserver.unobserve(img);
                        }
                    }
                });
            },
            { threshold: 0.15 }
        );

        lazyImages.forEach(img => imgObserver.observe(img));
    } else {
        // Fallback: just set src directly
        lazyImages.forEach(img => {
            const src = img.getAttribute("data-src");
            if (src) {
                img.src = src;
                img.classList.add("loaded");
            }
        });
    }

    // ============ SMOOTH NAV SCROLL ============
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener("click", (e) => {
            const targetId = anchor.getAttribute("href").slice(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({ behavior: "smooth" });
            }
        });
    });

// ============ #2 SCROLLSPY NAV (top-proximity method) ============
const sections = Array.from(document.querySelectorAll("main .section"));

function updateScrollspy() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const headerHeight = 120; // sticky header height
    const anchorLine = scrollY + headerHeight + 10; // line used as reference

    let currentId = sections[0].id;
    let smallestDistance = Infinity;

    for (const section of sections) {
        const top = section.offsetTop;

        // Distance between section top and our anchor line
        const distance = Math.abs(top - anchorLine);

        // Pick the section whose top is closest to anchorLine
        if (distance < smallestDistance) {
            smallestDistance = distance;
            currentId = section.id;
        }
    }

    // Update nav highlights
    navLinks.forEach(link => {
        const href = link.getAttribute("href") || "";
        link.classList.toggle("active", href === "#" + currentId);
    });
}

window.addEventListener("scroll", updateScrollspy);
window.addEventListener("load", updateScrollspy);


    // ============ #3 PROJECT DETAILS MODAL ============
    const projectModal = document.getElementById("projectModal");
    const modalTitle = projectModal?.querySelector(".modal-title");
    const modalTech = projectModal?.querySelector(".modal-tech");
    const modalBody = projectModal?.querySelector(".modal-body");
    const modalLinksContainer = projectModal?.querySelector(".modal-links");
    const modalCloseBtn = projectModal?.querySelector(".modal-close");
    const modalBackdrop = projectModal?.querySelector(".modal-backdrop");

    function openProjectModal(card) {
        if (!projectModal) return;

        const title = card.querySelector(".project-title")?.textContent || "";
        const tech = card.querySelector(".project-tech")?.textContent || "";
        const desc = card.querySelector(".project-desc")?.textContent || "";

        if (modalTitle) modalTitle.textContent = title;
        if (modalTech) modalTech.textContent = tech;
        if (modalBody) modalBody.textContent = desc;

        if (modalLinksContainer) {
            modalLinksContainer.innerHTML = "";

            // If you want per-project external links, you can use data attributes.
            // For now, just a generic "close" hint or placeholder.
            const hint = document.createElement("p");
            hint.style.fontSize = "0.8rem";
            hint.style.color = "var(--text-muted)";
            hint.textContent = "You can attach GitHub/itch.io/Steam links here via data attributes.";
            modalLinksContainer.appendChild(hint);
        }

        projectModal.classList.add("open");
        projectModal.setAttribute("aria-hidden", "false");
    }

    function closeProjectModal() {
        if (!projectModal) return;
        projectModal.classList.remove("open");
        projectModal.setAttribute("aria-hidden", "true");
    }

    document.querySelectorAll(".project-details-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const card = btn.closest(".project-card");
            if (card) openProjectModal(card);
        });
    });

    modalCloseBtn?.addEventListener("click", closeProjectModal);
    modalBackdrop?.addEventListener("click", closeProjectModal);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeProjectModal();
        }
    });

    // ============ #10 PROJECT HOVER TOOLTIP (DELAYED) ============
    projectCards.forEach(card => {
        const tooltipText = card.getAttribute("data-tooltip");
        if (!tooltipText) return;

        const tooltip = document.createElement("div");
        tooltip.className = "project-tooltip";
        tooltip.textContent = tooltipText;
        card.appendChild(tooltip);

        let hoverTimer = null;

        card.addEventListener("mouseenter", () => {
            hoverTimer = setTimeout(() => {
                tooltip.classList.add("show");
            }, 400);
        });

        card.addEventListener("mouseleave", () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
            tooltip.classList.remove("show");
        });
    });

    // ============ #11 CONTACT FORM VALIDATION + CHAR COUNTER ============
    function validateEmail(value) {
        // simple email check
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(value);
    }

    if (messageInput && messageCharCount) {
        messageCharCount.textContent = "0";
        messageInput.addEventListener("input", () => {
            const len = messageInput.value.length;
            messageCharCount.textContent = len.toString();
        });
    }

    if (emailInput) {
        emailInput.addEventListener("input", () => {
            const val = emailInput.value.trim();
            if (!val) {
                emailError.textContent = "";
                emailInput.classList.remove("input-error");
            } else if (!validateEmail(val)) {
                emailError.textContent = "Please enter a valid email address.";
                emailInput.classList.add("input-error");
            } else {
                emailError.textContent = "";
                emailInput.classList.remove("input-error");
            }
        });
    }

    if (nameInput) {
        nameInput.addEventListener("input", () => {
            const val = nameInput.value.trim();
            if (!val) {
                nameError.textContent = "";
                nameInput.classList.remove("input-error");
            } else if (val.length < 2) {
                nameError.textContent = "Name looks a bit too short.";
                nameInput.classList.add("input-error");
            } else {
                nameError.textContent = "";
                nameInput.classList.remove("input-error");
            }
        });
    }

    if (messageInput) {
        messageInput.addEventListener("input", () => {
            const val = messageInput.value.trim();
            if (!val) {
                messageError.textContent = "";
                messageInput.classList.remove("input-error");
            } else if (val.length < 10) {
                messageError.textContent = "Give me at least a short summary, please.";
                messageInput.classList.add("input-error");
            } else {
                messageError.textContent = "";
                messageInput.classList.remove("input-error");
            }
        });
    }

    contactForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const nameVal = nameInput.value.trim();
        const emailVal = emailInput.value.trim();
        const messageVal = messageInput.value.trim();

        let hasError = false;

        if (!nameVal) {
            nameError.textContent = "Name is required.";
            nameInput.classList.add("input-error");
            hasError = true;
        }

        if (!emailVal) {
            emailError.textContent = "Email is required.";
            emailInput.classList.add("input-error");
            hasError = true;
        } else if (!validateEmail(emailVal)) {
            emailError.textContent = "Please enter a valid email address.";
            emailInput.classList.add("input-error");
            hasError = true;
        }

        if (!messageVal) {
            messageError.textContent = "Message is required.";
            messageInput.classList.add("input-error");
            hasError = true;
        } else if (messageVal.length < 10) {
            messageError.textContent = "Please provide a bit more detail.";
            messageInput.classList.add("input-error");
            hasError = true;
        }

        if (hasError) {
            formStatus.textContent = "Please fix the highlighted fields.";
            formStatus.style.color = "var(--danger)";
            return;
        }

        formStatus.textContent = "Sending...";
        formStatus.style.color = "var(--text-muted)";

        setTimeout(() => {
            formStatus.textContent = "Message sent! I’ll reply soon.";
            formStatus.style.color = "var(--accent)";
            contactForm.reset();
            // reset errors + char count
            nameError.textContent = "";
            emailError.textContent = "";
            messageError.textContent = "";
            nameInput.classList.remove("input-error");
            emailInput.classList.remove("input-error");
            messageInput.classList.remove("input-error");
            if (messageCharCount) messageCharCount.textContent = "0";
        }, 700);
    });

    // ============ #13 STEAM & SPOTIFY NOW PLAYING ============
    const steamContainer = document.getElementById("steamNowPlaying");
    const spotifyContainer = document.getElementById("spotifyNowPlaying");

    // --- Steam: GetRecentlyPlayedGames ---
    async function fetchSteamNowPlaying() {
        if (!steamContainer) return;

        // TODO: put your Steam Web API key here (or proxy it from a backend).
        // WARNING: putting keys directly in frontend code means they are visible to everyone.
        const STEAM_API_KEY = "YOUR_STEAM_API_KEY_HERE";
        const STEAM_ID = "76561198073191273"; // your Steam64 ID

        if (!STEAM_API_KEY || STEAM_API_KEY === "YOUR_STEAM_API_KEY_HERE") {
            steamContainer.innerHTML = `
                <p class="nowplaying-sub">
                    Steam API key not configured yet. Once you add it in <code>script.js</code>,
                    this box will show your recently played game.
                </p>
            `;
            return;
        }

        try {
            const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${encodeURIComponent(
                STEAM_API_KEY
            )}&steamid=${encodeURIComponent(STEAM_ID)}&format=json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Steam API error");

            const data = await res.json();
            const games = data?.response?.games || [];
            if (games.length === 0) {
                steamContainer.innerHTML = `<p class="nowplaying-sub">No recent games reported by Steam.</p>`;
                return;
            }

            const top = games[0];
            const name = top.name || "Unknown Game";
            const minutes2Weeks = top.playtime_2weeks || 0;
            const hours = (minutes2Weeks / 60).toFixed(1);

            steamContainer.innerHTML = `
                <p class="nowplaying-title">${name}</p>
                <p class="nowplaying-sub">Played ~${hours} hours in the last 2 weeks.</p>
            `;
        } catch (err) {
            console.error(err);
            steamContainer.innerHTML = `
                <p class="nowplaying-sub">
                    Couldn’t reach the Steam API right now. Showing a placeholder instead.
                    Recently, I’ve been playing <strong>whatever you want to put here</strong>.
                </p>
            `;
        }
    }

    // --- Spotify: Currently Playing ---
    async function fetchSpotifyNowPlaying() {
        if (!spotifyContainer) return;

        // Spotify requires OAuth and a short-lived access token.
        // Typical flow: get a token via PKCE or from your backend, then call the Web API.
        // For the static site, you can temporarily paste a token from the Spotify Console for testing.
        const SPOTIFY_ACCESS_TOKEN = "YOUR_SPOTIFY_ACCESS_TOKEN_HERE";

        if (!SPOTIFY_ACCESS_TOKEN || SPOTIFY_ACCESS_TOKEN === "YOUR_SPOTIFY_ACCESS_TOKEN_HERE") {
            spotifyContainer.innerHTML = `
                <p class="nowplaying-sub">
                    Spotify access token not configured yet. Once you hook up OAuth or a backend,
                    this will show the track you’re currently listening to.
                </p>
            `;
            return;
        }

        try {
            const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
                headers: {
                    Authorization: `Bearer ${SPOTIFY_ACCESS_TOKEN}`
                }
            });

            if (res.status === 204) {
                spotifyContainer.innerHTML = `<p class="nowplaying-sub">Nothing playing on Spotify right now.</p>`;
                return;
            }
            if (!res.ok) throw new Error("Spotify API error");

            const data = await res.json();
            const item = data?.item;
            if (!item) {
                spotifyContainer.innerHTML = `<p class="nowplaying-sub">Nothing playing at the moment.</p>`;
                return;
            }

            const trackName = item.name || "Unknown track";
            const artists = (item.artists || []).map(a => a.name).join(", ");
            const album = item.album?.name || "";
            const url = item.external_urls?.spotify || "#";

            spotifyContainer.innerHTML = `
                <p class="nowplaying-title">
                    <a href="${url}" target="_blank" rel="noopener">${trackName}</a>
                </p>
                <p class="nowplaying-sub">${artists}${album ? " — " + album : ""}</p>
            `;
        } catch (err) {
            console.error(err);
            spotifyContainer.innerHTML = `
                <p class="nowplaying-sub">
                    Couldn’t reach Spotify’s API right now. As a stand-in, let’s just say
                    I’m looping <strong>your favorite OST here</strong>.
                </p>
            `;
        }
    }

    fetchSteamNowPlaying();
    fetchSpotifyNowPlaying();

    // ============ (Optional) Keyboard shortcuts for nav (tiny bonus) ============
    window.addEventListener("keydown", (e) => {
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

        switch (e.key) {
            case "1":
                scrollToSection("hero");
                break;
            case "2":
                scrollToSection("skills");
                break;
            case "3":
                scrollToSection("projects");
                break;
            case "4":
                scrollToSection("timeline");
                break;
            case "5":
                scrollToSection("stats");
                break;
            case "6":
                scrollToSection("resume");
                break;
            case "7":
                scrollToSection("nowPlaying");
                break;
            case "8":
                scrollToSection("contact");
                break;
            default:
                break;
        }
    });

    function scrollToSection(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth" });
    }
});
