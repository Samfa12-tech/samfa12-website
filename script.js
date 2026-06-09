const categoryOrder = ["Games", "Books", "Apps & Tools", "Assets", "Music", "Social"];

const fallbackProjects = [
  {
    title: "Dust on the River",
    category: "Games",
    type: "Game",
    status: "Published",
    description:
      "A river-based puzzle-adventure with atmospheric, low-pressure progression loops, exploration beats, and narrative moments across small game systems.",
    tags: ["Game", "Adventure", "Samfa12"],
    featured: true,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/dust-on-the-river" }
    ]
  },
  {
    title: "Drink",
    category: "Games",
    type: "Game",
    status: "Published",
    description: "A Samfa12 game release available on Steam and Google Play.",
    tags: ["Game", "Shooter", "Samfa12"],
    featured: true,
    links: [
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" },
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Night Shift at Possum's Cafe",
    category: "Games",
    type: "Game",
    status: "Coming soon to Google Play",
    description:
      "A night-shift simulation of café operations in a stylized, humorous setting with service pacing, atmosphere, and progression.",
    tags: ["Game", "Arcade", "Simulation", "Samfa12"],
    featured: true,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/possum-cafe" },
      { label: "Coming soon on Google Play", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Pocket Chordsmith",
    category: "Apps & Tools",
    type: "Mobile app",
    status: "Published",
    description: "A mobile music-writing companion for fast chord mapping, quick harmony checks, and practical songwriting workflows.",
    tags: ["Music", "Utility", "Apps"],
    featured: true,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/pocket-chordsmith" },
      { label: "Google Play apps", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" },
      { label: "GitHub", url: "https://github.com/Samfa12-tech" }
    ]
  },
  {
    title: "ToKnight",
    category: "Books",
    type: "Book",
    status: "Published",
    description:
      "A self-contained fantasy novel opening the ToKnight world with focused worldbuilding and character-driven conflict.",
    tags: ["Novel", "Fantasy", "Adventure"],
    featured: true,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/toknight" },
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" }
    ]
  },
  {
    title: "Article 18",
    category: "Books",
    type: "Book",
    status: "Published — itch.io, Google Play audiobook / ebook",
    description: "A speculative fiction novel blending suspense with social and ethical questions in a near-future setting.",
    tags: ["Speculative", "Science", "Literary"],
    featured: true,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/article-18" },
      { label: "Google Play audiobook", url: "https://play.google.com/store/audiobooks/details/Samfa12_Article_18?hl=en&id=AQAAAEDaH2pfoM:" },
      { label: "Google Play books search", url: "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12" }
    ]
  },
  {
    title: "Google Play apps",
    category: "Apps & Tools",
    type: "Developer listing",
    status: "Published",
    description: "A publisher page listing Samfa12's Android games, tools, and experiments in one Google Play collection.",
    tags: ["Android", "Creator", "Tools"],
    featured: true,
    links: [
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "TD Pack",
    category: "Games",
    type: "Android game collection",
    status: "Published on Google Play",
    description: "A collection of Samfa12 tower defence games and compact strategy releases for Android.",
    tags: ["Game", "Android", "Strategy", "Samfa12"],
    featured: false,
    links: [
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Spin Vector",
    category: "Games",
    type: "Android game",
    status: "Published on Google Play",
    description: "A neon action arcade game from Samfa12, available through the Google Play developer page.",
    tags: ["Game", "Android", "Arcade", "Samfa12"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/spin-vector" },
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Pocket DJ",
    category: "Apps & Tools",
    type: "Mobile app",
    status: "Published",
    description: "A DJ-oriented utility designed for set planning, pacing ideas, and rapid track utility on mobile.",
    tags: ["Music", "DJ", "Utility"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/pocket-dj" },
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Godot MusicConductor / Godot assets",
    category: "Assets",
    type: "Asset pack",
    status: "Published",
    description: "A Godot-focused music toolkit for faster composition wiring, timeline prep, and implementation across game projects.",
    tags: ["Godot", "Audio", "Indie tools"],
    featured: false,
    links: [
      { label: "Godot Asset Library", url: "https://godotengine.org/asset-library/asset/5174" }
    ]
  },
  {
    title: "Class Profile Builder",
    category: "Apps & Tools",
    type: "Education app",
    status: "Available",
    description: "A local-first education utility for building and managing class profile data workflows.",
    tags: ["Education", "Productivity", "Local-first"],
    featured: false,
    links: [
      { label: "GitHub", url: "https://github.com/Samfa12-tech" },
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Mandible Wars",
    category: "Games",
    type: "Game",
    status: "Playable prototype",
    description: "A compact prototype centered on tactical skirmishes, fast rounds, and replayable competitive action.",
    tags: ["Game", "Prototype", "Action"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/mandible-wars" }
    ]
  },
  {
    title: "Moon Mower",
    category: "Games",
    type: "Game",
    status: "Playable prototype",
    description: "A short-form arcade prototype with quirky mechanics, repeated loops, and playful progression.",
    tags: ["Game", "Arcade", "Indie"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/moon-mower" }
    ]
  },
  {
    title: "Voxel Fish Tank",
    category: "Games",
    type: "Game",
    status: "Playable prototype",
    description: "A low-poly voxel world game centered on fish-care progression and ambient simulation rhythm.",
    tags: ["Game", "Voxel", "Relax"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/fish-tank" }
    ]
  },
  {
    title: "Voxel Kart Pocket GP",
    category: "Games",
    type: "Game",
    status: "Playable prototype",
    description: "A compact kart game using pocket-scale tracks, stylized visuals, and punchy race sessions.",
    tags: ["Game", "Racing", "Pocket format"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" }
    ]
  },
  {
    title: "Party Bus / Wasteland Run",
    category: "Games",
    type: "Game",
    status: "In development",
    description: "An energetic project concept around a drifting bus and wasteland route, balancing momentum with level progression.",
    tags: ["Game", "Adventure", "Runner"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/party-bus" }
    ]
  },
  {
    title: "River Locks",
    category: "Games",
    type: "Game",
    status: "In development",
    description: "A game-logic concept exploring water-flow mechanics, sequencing, and timing-based challenges.",
    tags: ["Game", "Puzzle", "Systems"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" }
    ]
  },
  {
    title: "Ant Farm",
    category: "Games",
    type: "Game",
    status: "In development",
    description: "A simulation sketch focused on colony growth, maintenance rhythms, and scalable growth mechanics.",
    tags: ["Game", "Simulation", "Growth"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/ant-farm" }
    ]
  },
  {
    title: "ToKnight 2: The Fire Beneath",
    category: "Books",
    type: "Book",
    status: "Published",
    description: "The next chapter in the ToKnight series, continuing the core lore and adding deeper stakes.",
    tags: ["Novel", "Fantasy", "Sequel"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/toknight-2-the-fire-beneath" },
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" }
    ]
  },
  {
    title: "Free to a Good Home",
    category: "Books",
    type: "Book",
    status: "Published",
    description: "A literary study of belonging and consequence set in a character-forward narrative arc.",
    tags: ["Narrative", "Drama", "Fiction"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/free-to-a-good-home" },
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" }
    ]
  },
  {
    title: "A Place of His Own",
    category: "Books",
    type: "Book",
    status: "Published",
    description: "An introspective fiction title about finding place, space, and self-determination.",
    tags: ["Narrative", "Fiction", "Contemporary"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/a-place-of-his-own" },
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" }
    ]
  },
  {
    title: "Concubine",
    category: "Books",
    type: "Book",
    status: "Published",
    description: "A dark, intimate novel examining power, desire, and transformation through tense character conflict.",
    tags: ["Novel", "Psychological", "Fiction"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/concubine" },
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" }
    ]
  },
  {
    title: "Sober",
    category: "Books",
    type: "Book",
    status: "Published",
    description: "A literary title exploring loss, restraint, and emotional clarity through an intimate modern narrative.",
    tags: ["Narrative", "Fiction", "Contemporary"],
    featured: false,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/sober" },
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" }
    ]
  },
  {
    title: "Godot assets",
    category: "Assets",
    type: "Asset pack",
    status: "Published",
    description: "Reusable Godot assets designed to help with visual consistency and rapid iteration.",
    tags: ["Godot", "Assets", "Indie tools"],
    featured: false,
    links: [
      { label: "Godot Asset Library", url: "https://godotengine.org/asset-library/asset/5174" }
    ]
  },
  {
    title: "Music/audio workflow tools",
    category: "Assets",
    type: "Audio toolkit",
    status: "Published",
    description: "A practical music-audio toolkit aimed at builders who need reusable workflow assets quickly.",
    tags: ["Music", "Audio", "Workflow"],
    featured: false,
    links: [
      { label: "Google Play apps", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" },
      { label: "Spotify search", url: "https://open.spotify.com/search/Samfa12" }
    ]
  },
  {
    title: "Game-dev helpers",
    category: "Assets",
    type: "Tooling",
    status: "Published",
    description: "Reusable game-production helpers for prototyping, tooling ideas, and indie workflow speed.",
    tags: ["Game dev", "Tools", "Utility"],
    featured: false,
    links: [
      { label: "GitHub", url: "https://github.com/Samfa12-tech" },
      { label: "Godot Asset Library", url: "https://godotengine.org/asset-library/asset/5174" }
    ]
  },
  {
    title: "Spotify",
    category: "Music",
    type: "Music search",
    status: "Available",
    description: "A searchable music hub entry for Samfa12 catalog discovery on Spotify.",
    tags: ["Music", "Listening", "Catalog"],
    featured: false,
    links: [
      { label: "Open in Spotify", url: "https://open.spotify.com/search/Samfa12" }
    ]
  },
  {
    title: "YouTube Music",
    category: "Music",
    type: "Music search",
    status: "Available",
    description: "A searchable music hub entry for Samfa12 tracks and releases on YouTube Music.",
    tags: ["Music", "Streaming", "Catalog"],
    featured: false,
    links: [
      { label: "Open in YouTube Music", url: "https://music.youtube.com/search?q=Samfa12" }
    ]
  },
  {
    title: "GitHub",
    category: "Social",
    type: "Profile",
    status: "Published",
    description: "A public landing view for source repositories, releases, and development history across Samfa12 projects.",
    tags: ["Code", "Repos", "Community"],
    featured: false,
    links: [
      { label: "Open profile", url: "https://github.com/Samfa12-tech" }
    ]
  },
  {
    title: "X / Twitter",
    category: "Social",
    type: "Profile",
    status: "Published",
    description: "A concise channel for updates, experiments, and release notes.",
    tags: ["Social", "Updates"],
    featured: false,
    links: [
      { label: "Open profile", url: "https://x.com/Samfa12" }
    ]
  },
  {
    title: "Facebook",
    category: "Social",
    type: "Profile",
    status: "Published",
    description: "Community posting and updates on projects, work sessions, and announcements.",
    tags: ["Community", "Social"],
    featured: false,
    links: [
      { label: "Open page", url: "https://www.facebook.com/people/Samfa12-Drink-Sober" }
    ]
  },
  {
    title: "Reddit",
    category: "Social",
    type: "Profile",
    status: "Published",
    description: "A forum profile for sharing development discussions and creator experiences.",
    tags: ["Community", "Forums"],
    featured: false,
    links: [
      { label: "Open profile", url: "https://www.reddit.com/user/Samfa12/" }
    ]
  },
  {
    title: "itch.io",
    category: "Social",
    type: "Publisher page",
    status: "Published",
    description: "The central Samfa12 storefront entry for game demos, browser builds, and releases.",
    tags: ["Games", "Storefront"],
    featured: false,
    links: [
      { label: "Visit page", url: "https://samfa12.itch.io/" }
    ]
  }
];

const featuredGrid = document.getElementById("featured-grid");
const categoryFilters = document.getElementById("category-filters");
const categorySections = document.getElementById("category-sections");
const dataStatus = document.getElementById("data-status");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyCategory(category) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function projectCardHtml(project) {
  const tags = project.tags
    .map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`)
    .join("");

  const links = project.links
    .map(
      (link) =>
        `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          link.label
        )}</a>`
    )
    .join("");

  return `
    <article class="card">
      <h3>${escapeHtml(project.title)}</h3>
      <p class="project-meta">
        <span class="pill">${escapeHtml(project.type)}</span>
        <span class="pill">${escapeHtml(project.status)}</span>
      </p>
      <p class="description">${escapeHtml(project.description)}</p>
      <div class="links" aria-label="${escapeHtml(project.title)} links">${links}</div>
      <p class="description" style="margin-top: 0.65rem;">${escapeHtml(project.category)}</p>
      <div class="project-meta">${tags}</div>
    </article>
  `;
}

function renderFeatured(projects) {
  const featured = projects.filter((project) => project.featured);
  featuredGrid.innerHTML = featured.map(projectCardHtml).join("");
}

function renderCategorySections(projects) {
  categorySections.innerHTML = "";

  categoryOrder.forEach((category) => {
    const list = projects.filter((project) => project.category === category);
    if (!list.length) {
      return;
    }

    const section = document.createElement("section");
    section.className = "category-section";
    section.id = slugifyCategory(category);
    section.dataset.category = category;

    const heading = document.createElement("h3");
    heading.textContent = category;

    const grid = document.createElement("div");
    grid.className = "card-grid";
    grid.innerHTML = list.map(projectCardHtml).join("");

    section.append(heading, grid);
    categorySections.append(section);
  });
}

function buildFilterButtons() {
  const filters = ["all", ...categoryOrder];
  filters.forEach((filter, index) => {
    const label = filter === "all" ? "All" : filter;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-btn${index === 0 ? " active" : ""}`;
    button.dataset.category = filter;
    button.textContent = label;
    button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
    button.addEventListener("click", () => updateFilter(filter));
    categoryFilters.append(button);
  });
}

function updateFilter(selectedCategory) {
  const buttons = categoryFilters.querySelectorAll(".filter-btn");
  buttons.forEach((btn) => {
    const isActive = btn.dataset.category === selectedCategory;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const sections = categorySections.querySelectorAll(".category-section");
  sections.forEach((section) => {
    const isMatch = selectedCategory === "all" || section.dataset.category === selectedCategory;
    section.hidden = !isMatch;
  });
}

async function loadProjects() {
  try {
    const response = await fetch("data/projects.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid JSON data");
    return data;
  } catch (error) {
    if (dataStatus) {
      dataStatus.hidden = false;
      dataStatus.textContent =
        "Could not load data/projects.json. Using embedded fallback data for local preview.";
    }
    return fallbackProjects;
  }
}

async function initialize() {
  const projects = await loadProjects();
  renderFeatured(projects);
  renderCategorySections(projects);
  buildFilterButtons();
  updateFilter("all");
}

initialize();

