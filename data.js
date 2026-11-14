/* =====================================================================
   PORTFOLIO DATA — edit this file to update the site.
   Everything on the page (featured carousel, library, game pages,
   skills, journey) is rendered from the objects below.
   ===================================================================== */

window.PORTFOLIO = {
    /* ---------- Contact form ----------
       1. Create a free form at https://formspree.io and paste its ID
          (the part after /f/ in the endpoint), e.g. "xyzabcd".
       2. OR leave formspreeId empty and set `email` to open the visitor's
          mail app instead.
       If both are empty, the form points visitors to LinkedIn. */
    contact: {
        formspreeId: "",
        email: "",
        linkedin: "https://www.linkedin.com/in/thien-hoang-059117236/"
    },

    /* ---------- Games & projects ----------
       Fields:
         id         unique slug (used in share links: #game=<id>)
         featured   true = shows in the big "Featured" carousel
         title, subtitle, year, pitch (1–2 sentences), about (paragraph)
         built      bullet list of what YOU personally built
         role, team, engine, tech[], tags[]
         categories filter keys: game | unity | engine | web
         hue        0–360, colour of the generated cover art (used until
                    you add a real `cover` image)
         cover      "images/games/guitar-legend/cover.jpg"  (16:9 works best)
         preview    short muted .mp4/.webm that plays when hovering a card
         media      gallery for the game page, any mix of:
                      { type: "image",   src: "images/...png", caption: "" }
                      { type: "video",   src: "images/...mp4", caption: "" }
                      { type: "youtube", id:  "dQw4w9WgXcQ",   caption: "" }
         links      play / repo / video / page — empty ones are hidden
    */
    games: [
        {
            id: "guitar-legend",
            featured: true,
            title: "Guitar Legend",
            subtitle: "Rhythm Game",
            year: "2024 – 2025",
            pitch: "A Unity rhythm game with custom charts, multiple input types, and animated results screens. My capstone project.",
            about: "Guitar Legend is a rhythm game inspired by classic note-highway and click-timing games. Players pick a song, hit notes in time across multiple input types, and finish on an animated results screen that breaks down their performance.",
            built: [
                "Gameplay and systems programming for the core rhythm loop",
                "Custom chart support so songs can be authored and played",
                "Multiple input types handled through Unity's Input System",
                "Results screen with animated scoring"
            ],
            role: "Gameplay / Systems",
            team: "4 devs",
            engine: "Unity",
            tech: ["Unity", "C#", "ScriptableObjects", "Input System"],
            tags: ["Rhythm", "Capstone", "Unity"],
            categories: ["game", "unity"],
            hue: 285,
            cover: "",
            preview: "",
            media: [],
            links: { play: "", repo: "", video: "", page: "" }
        },
        {
            id: "metroidvania-engine",
            featured: true,
            title: "2D Metroidvania Engine",
            subtitle: "Custom C++ Engine",
            year: "2023 – 2024",
            pitch: "A custom C++ engine prototype built for 2D side-scrolling level design, input handling, and modular gameplay systems.",
            about: "A from-scratch engine prototype aimed at Metroidvania-style games. The focus was on the foundations a designer needs: tile-based levels, responsive input, and gameplay systems that can be composed and extended without rewriting the core.",
            built: [
                "Engine and systems architecture",
                "Tile system for 2D side-scrolling levels",
                "Input handling layer",
                "Modular gameplay systems"
            ],
            role: "Engine / Systems",
            team: "3 devs",
            engine: "Custom (C++)",
            tech: ["C++", "Custom Engine", "Tile Systems"],
            tags: ["Engine", "2D", "C++"],
            categories: ["game", "engine"],
            hue: 205,
            cover: "",
            preview: "",
            media: [],
            links: { play: "", repo: "", video: "", page: "" }
        },
        {
            id: "zombie-shooter",
            featured: true,
            title: "Round-Based Zombie Shooter",
            subtitle: "FPS Survival",
            year: "2022 – 2023",
            pitch: "A first-person, round-based zombie survival game with weapon swapping, reloads, hit markers, VFX, and responsive ammo/health UI.",
            about: "A first-person survival prototype where waves of zombies get tougher each round. I owned how the weapons felt and read: swapping, reloading, hit feedback, and the UI that keeps the player informed mid-fight.",
            built: [
                "Weapon swapping and reload systems",
                "Hit markers and combat VFX",
                "Responsive ammo and health UI"
            ],
            role: "Weapons & UX",
            team: "3 devs",
            engine: "Unity",
            tech: ["Unity", "C#", "Animator", "VFX Graph"],
            tags: ["FPS", "Survival", "Unity"],
            categories: ["game", "unity"],
            hue: 95,
            cover: "",
            preview: "",
            media: [],
            links: { play: "", repo: "", video: "", page: "" }
        },
        {
            id: "song-guesser",
            featured: false,
            title: "Spotify Song Guesser",
            subtitle: "Browser Game",
            year: "",
            pitch: "A browser game where players guess songs from short audio clips, powered by the Spotify Web API, with score tracking.",
            about: "A quick-fire music quiz in the browser. Players hear a short clip and race to name the song, with tracks pulled live from the Spotify Web API and a running score.",
            built: [
                "Full-stack implementation (front end and Node.js back end)",
                "Spotify Web API integration",
                "Score tracking"
            ],
            role: "Full-stack",
            team: "2 devs",
            engine: "Web",
            tech: ["HTML", "CSS", "JavaScript", "Node.js", "Spotify Web API"],
            tags: ["Web", "Music", "API"],
            categories: ["game", "web"],
            hue: 145,
            cover: "",
            preview: "",
            media: [],
            links: { play: "", repo: "", video: "", page: "" }
        },
        {
            id: "resume-builder",
            featured: false,
            title: "Resume Builder",
            subtitle: "Web App",
            year: "2022 – 2023",
            pitch: "A resume generator that formats user input into a job-ready resume, with custom templates and live preview.",
            about: "A web app that turns form input into a clean, job-ready resume. Users pick a template and watch the document update live as they type.",
            built: [
                "Led development across a 4-person team",
                "Custom resume templates",
                "Live preview"
            ],
            role: "Lead Dev",
            team: "4 devs",
            engine: "Web",
            tech: ["HTML", "CSS", "JavaScript"],
            tags: ["Web", "Tool"],
            categories: ["web"],
            hue: 25,
            cover: "",
            preview: "",
            media: [],
            links: { play: "", repo: "", video: "", page: "" }
        }
    ],

    /* ---------- Skills ---------- */
    skills: [
        {
            group: "Game Programming",
            items: ["Unity", "C#", "Gameplay systems", "State machines", "Input systems", "UI", "Profiling"]
        },
        {
            group: "Engine & Systems",
            items: ["C++", "Data structures", "Memory", "Tile / ECS-style systems", "Rendering basics", "Debugging"]
        },
        {
            group: "Tools & Web",
            items: ["Editor & debug tools", "HTML / CSS / JS", "Node.js", "REST / JSON", "Responsive UI"]
        },
        {
            group: "Workflow",
            items: ["Git", "Team collaboration", "Technical docs", "Rapid prototyping", "Testing"]
        }
    ],

    /* ---------- Journey (newest first) ---------- */
    journey: [
        {
            date: "2024 – 2025",
            title: "Capstone & advanced projects",
            text: "Developed Guitar Legend, a rhythm game with multiple input types and custom charts, plus more tools and graphics work."
        },
        {
            date: "2023 – 2024",
            title: "Engine work & tools",
            text: "Worked on a 2D Metroidvania-style engine in C++, focused on input handling, tile systems, and modular gameplay logic."
        },
        {
            date: "2022 – 2023",
            title: "Game programming & web projects",
            text: "Built Unity games including a round-based zombie shooter, plus web apps like a resume builder."
        },
        {
            date: "2021 – 2022",
            title: "CS foundations at TAMU–CC",
            text: "Completed core CS coursework (data structures, algorithms, operating systems) and started building small game prototypes."
        }
    ]
};
