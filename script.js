const categoryOrder = ["Games", "Books", "Apps & Tools", "Assets", "Music", "Social"];

const fallbackProjects = [
  {
    title: "Dust on the River",
    category: "Games",
    type: "Game",
    status: "Published",
    description:
      "An atmospheric puzzle-adventure game combining gentle systems, exploration, and story moments.",
    tags: ["Game", "Adventure", "Samfa12"],
    featured: true,
    links: [
      { label: "Play on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "Night Shift at Possum's Cafe",
    category: "Games",
    type: "Game",
    status: "Published",
    description:
      "A late-night shift simulator with character moments, charming chaos, and cozy challenge.",
    tags: ["Game", "Arcade", "Simulation", "Samfa12"],
    featured: true,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "Pocket Chordsmith",
    category: "Apps & Tools",
    type: "Mobile app",
    status: "Published",
    description: "Music writing and harmony workflow tools for practical, fast song-making.",
    tags: ["Music", "Utility", "Apps"],
    featured: true,
    links: [
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
      "A creative fantasy journey in the larger ToKnight universe.",
    tags: ["Novel", "Fantasy", "Adventure"],
    featured: true,
    links: [
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" },
      { label: "Google Play books search", url: "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12" }
    ]
  },
  {
    title: "Article 18",
    category: "Books",
    type: "Book",
    status: "Published",
    description: "A speculative title in the Samfa12 fiction and world-building portfolio.",
    tags: ["Speculative", "Science", "Literary"],
    featured: true,
    links: [
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" },
      { label: "Google Play books search", url: "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12" }
    ]
  },
  {
    title: "Google Play apps",
    category: "Apps & Tools",
    type: "Developer listing",
    status: "Published",
    description: "The full range of Samfa12 Android releases and experiments.",
    tags: ["Android", "Creator", "Tools"],
    featured: true,
    links: [
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Pocket DJ",
    category: "Apps & Tools",
    type: "Mobile app",
    status: "Published",
    description: "A practical music utility with an emphasis on rapid creative workflows.",
    tags: ["Music", "DJ", "Utility"],
    featured: false,
    links: [
      { label: "Google Play developer", url: "https://play.google.com/store/apps/dev?id=7761853381809168545" }
    ]
  },
  {
    title: "Godot MusicConductor / Godot assets",
    category: "Assets",
    type: "Asset pack",
    status: "Published",
    description: "Reusable music and audio tools designed for faster Godot projects.",
    tags: ["Godot", "Audio", "Indie tools"],
    featured: false,
    links: [
      { label: "Godot Asset Library", url: "https://godotengine.org/asset-library/asset?filter=Samfa12" }
    ]
  },
  {
    title: "Class Profile Builder",
    category: "Apps & Tools",
    type: "Education app",
    status: "Available",
    description: "An education-focused local app for profile-building workflows.",
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
    status: "Known",
    description: "A compact competitive prototype with tactical movement and bite-sized moments.",
    tags: ["Game", "Prototype", "Action"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "Moon Mower",
    category: "Games",
    type: "Game",
    status: "Known",
    description: "A compact, polished build with an offbeat loop and playful systems.",
    tags: ["Game", "Arcade", "Indie"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "Voxel Fish Tank",
    category: "Games",
    type: "Game",
    status: "Known",
    description: "An immersive, pixel-driven world with soothing but dynamic play patterns.",
    tags: ["Game", "Voxel", "Relax"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "Voxel Kart Pocket GP",
    category: "Games",
    type: "Game",
    status: "Known",
    description: "Pocket-sized kart racing energy with a colorful voxel production style.",
    tags: ["Game", "Racing", "Pocket format"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "Party Bus / Wasteland Run",
    category: "Games",
    type: "Game",
    status: "Known",
    description: "A fast-moving journey with a stylized sci-fi bus concept and gameplay loops.",
    tags: ["Game", "Adventure", "Runner"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "River Locks",
    category: "Games",
    type: "Game",
    status: "Known",
    description: "A systems-driven game concept centered around flow, timing, and progression.",
    tags: ["Game", "Puzzle", "Systems"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "Ant Farm",
    category: "Games",
    type: "Game",
    status: "Known",
    description: "An exploratory mini-game project with growth-and-manage mechanics.",
    tags: ["Game", "Simulation", "Growth"],
    featured: false,
    links: [
      { label: "Find on itch.io", url: "https://samfa12.itch.io/" },
      { label: "Steam publisher page", url: "https://store.steampowered.com/search/?publisher=Samfa12" }
    ]
  },
  {
    title: "ToKnight 2: The Fire Beneath",
    category: "Books",
    type: "Book",
    status: "Known",
    description: "A continuing chapter in the world of ToKnight.",
    tags: ["Novel", "Fantasy", "Sequel"],
    featured: false,
    links: [
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" },
      { label: "Google Play books search", url: "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12" }
    ]
  },
  {
    title: "Free to a Good Home",
    category: "Books",
    type: "Book",
    status: "Known",
    description: "A grounded and humane narrative from the Samfa12 catalog.",
    tags: ["Narrative", "Drama", "Fiction"],
    featured: false,
    links: [
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" },
      { label: "Google Play books search", url: "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12" }
    ]
  },
  {
    title: "A Place of His Own",
    category: "Books",
    type: "Book",
    status: "Known",
    description: "Character-first storytelling and quiet but powerful pacing.",
    tags: ["Narrative", "Fiction", "Contemporary"],
    featured: false,
    links: [
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" },
      { label: "Google Play books search", url: "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12" }
    ]
  },
  {
    title: "Concubine",
    category: "Books",
    type: "Book",
    status: "Known",
    description: "An intense and imaginative work in the Samfa12 literary lineup.",
    tags: ["Novel", "Psychological", "Fiction"],
    featured: false,
    links: [
      { label: "Amazon author page", url: "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true" },
      { label: "Google Play books search", url: "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12" }
    ]
  },
  {
    title: "Godot assets",
    category: "Assets",
    type: "Asset pack",
    status: "Published",
    description: "Visual and utility packs for quick implementation in game projects.",
    tags: ["Godot", "Assets", "Indie tools"],
    featured: false,
    links: [
      { label: "Godot Asset Library", url: "https://godotengine.org/asset-library/asset?filter=Samfa12" }
    ]
  },
  {
    title: "Music/audio workflow tools",
    category: "Assets",
    type: "Audio toolkit",
    status: "Published",
    description: "Reusable music workflow assets for small teams and solo creators.",
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
    description: "Utility code, workflows, and ideas for building indie-ready game systems.",
    tags: ["Game dev", "Tools", "Utility"],
    featured: false,
    links: [
      { label: "GitHub", url: "https://github.com/Samfa12-tech" },
      { label: "Godot Asset Library", url: "https://godotengine.org/asset-library/asset?filter=Samfa12" }
    ]
  },
  {
    title: "Spotify",
    category: "Music",
    type: "Music search",
    status: "Available",
    description: "Explore and listen to music by Samfa12.",
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
    description: "Find Samfa12 releases and mixes on YouTube Music.",
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
    description: "Code, repos, and development snapshots.",
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
    description: "Quick updates and creator announcements.",
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
    description: "Public posts and community activity.",
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
    description: "Discussions and community participation.",
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
    description: "Primary game channel for browser and downloadable releases.",
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
