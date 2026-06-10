const categoryOrder = ["Games", "Books", "Apps & Tools", "Assets", "Music", "Storefronts", "Social"];

const fallbackProjects = [
  {
    "title": "Samfa12 itch.io",
    "category": "Storefronts",
    "type": "Publisher page",
    "status": "Published",
    "description": "Samfa12's central storefront for playable builds and releases.",
    "featured": true,
    "links": [
      {
        "label": "Visit page",
        "url": "https://samfa12.itch.io/"
      }
    ]
  },
  {
    "title": "Google Play apps",
    "category": "Storefronts",
    "type": "Developer listing",
    "status": "Published",
    "description": "A publisher page listing Samfa12's Android games, tools, and experiments.",
    "featured": false,
    "links": [
      {
        "label": "Google Play developer",
        "url": "https://play.google.com/store/apps/dev?id=7761853381809168545"
      }
    ]
  },
  {
    "title": "Amazon author",
    "category": "Social",
    "type": "Author profile",
    "status": "Published",
    "description": "Samfa12 author page for books and publication links.",
    "featured": false,
    "links": [
      {
        "label": "Open author page",
        "url": "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true"
      }
    ]
  },
  {
    "title": "GitHub",
    "category": "Social",
    "type": "Profile",
    "status": "Published",
    "description": "Public source repositories, releases, and development history for Samfa12 projects.",
    "featured": false,
    "links": [
      {
        "label": "Open profile",
        "url": "https://github.com/Samfa12-tech"
      }
    ]
  },
  {
    "title": "X / Twitter",
    "category": "Social",
    "type": "Profile",
    "status": "Published",
    "description": "Official updates, experiments, and short-form developer notes.",
    "featured": false,
    "links": [
      {
        "label": "Open profile",
        "url": "https://x.com/Samfa12"
      }
    ]
  }
];
const featuredGrid = document.getElementById("featured-grid");
const comingSoonGrid = document.getElementById("coming-soon-grid");
const categoryFilters = document.getElementById("category-filters");
const categorySections = document.getElementById("category-sections");
const dataStatus = document.getElementById("data-status");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugifyCategory(category) {
  return String(category || "uncategorized")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function normalizeTitle(title) {
  return String(title || "").replace(/^(the|a|an)\s+/i, "").toLowerCase();
}

function byTitle(a, b) {
  return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
}

function bySortThenTitle(a, b) {
  const aOrder = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999;
  const bOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999;
  return aOrder - bOrder || byTitle(a, b);
}

function isComingSoonProject(project) {
  const status = String(project.status || "").toLowerCase();
  return (
    status.includes("coming soon") ||
    status.includes("in development") ||
    status.includes("prototype") ||
    status.includes("wip")
  );
}

function getStatusClass(status) {
  const value = String(status || "Available").toLowerCase();

  if (value.includes("coming soon")) {
    return "status-coming-soon";
  }

  if (value.includes("in development") || value.includes("wip")) {
    return "status-development";
  }

  if (value.includes("prototype")) {
    return "status-prototype";
  }

  if (value.includes("published")) {
    return "status-published";
  }

  return "status-available";
}

function isSafeLocalThumbnail(path) {
  if (typeof path !== "string") {
    return false;
  }

  const normalized = path.trim().replace(/\\/g, "/");
  if (!/^assets\/thumbnails\/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp|gif|svg)$/i.test(normalized)) {
    return false;
  }

  return !normalized.includes("..") && !/(fallback|placeholder|dummy|temp|default)/i.test(normalized);
}

function projectThumbnailHtml(project) {
  const thumbnail = project.thumbnail ?? project.image;
  if (!isSafeLocalThumbnail(thumbnail)) {
    return "";
  }

  const thumbnailPath = thumbnail.trim().replace(/\\/g, "/");
  const title = project.title || "Samfa12 project";
  const category = project.category || "";
  const fitClass =
    category === "Books" ? "" : project.imageFit === "cover" ? "project-image-cover-fill" : "";
  const mediaClass = `project-media ${category === "Books" ? "project-media-book" : ""}`.trim();
  const imageClass = `project-image ${fitClass}`.trim();
  const alt = project.thumbnailAlt || project.imageAlt || `Cover image for ${title}`;

  return `
    <div class="${mediaClass}">
      <img
        src="${escapeHtml(thumbnailPath)}"
        alt="${escapeHtml(alt)}"
        class="${imageClass}"
        loading="lazy"
        width="960"
        height="540"
        onerror="this.closest('.project-media').hidden = true"
      />
    </div>
  `;
}

function hideBrokenThumbnails() {
  document.querySelectorAll("img.project-image").forEach((image) => {
    image.addEventListener("error", () => {
      const container = image.closest(".project-media");
      if (container) {
        container.hidden = true;
      }
    });
  });
}

function projectCardHtml(project) {
  const title = project.title || "Untitled project";
  const category = project.category || "Uncategorized";
  const statusLabel = project.status || "Available";
  const tagList = Array.isArray(project.tags) ? project.tags : [];
  const linkList = Array.isArray(project.links) ? project.links : [];
  const tags = tagList
    .filter((tag) => typeof tag === "string" && tag.trim())
    .map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`)
    .join("");

  const links = linkList
    .filter((link) => link?.url && link?.label)
    .map(
      (link) =>
        `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" data-analytics="project-link" data-project-title="${escapeHtml(
          title
        )}" data-project-category="${escapeHtml(category)}" data-link-label="${escapeHtml(
          link.label
        )}">${escapeHtml(link.label)}</a>`
    )
    .join("");

  return `
    <article class="card">
      ${projectThumbnailHtml(project)}
      <h3>${escapeHtml(title)}</h3>
      <p class="project-meta">
        <span class="pill">${escapeHtml(project.type || "Project")}</span>
        <span class="pill ${getStatusClass(statusLabel)}">${escapeHtml(statusLabel)}</span>
      </p>
      <p class="description">${escapeHtml(project.description || "")}</p>
      <div class="links" aria-label="${escapeHtml(title)} links">${links}</div>
      <p class="description" style="margin-top: 0.65rem;">${escapeHtml(category)}</p>
      <div class="project-meta">${tags}</div>
    </article>
  `;
}

function renderFeatured(projects) {
  const featured = projects.filter((project) => project.featured === true).slice().sort(bySortThenTitle);
  featuredGrid.innerHTML = featured.map(projectCardHtml).join("");
}

function renderComingSoon(projects) {
  if (!comingSoonGrid) {
    return;
  }

  const comingSoon = projects.filter(isComingSoonProject).slice().sort(byTitle);
  comingSoonGrid.innerHTML = comingSoon.map(projectCardHtml).join("");
}

function scrollToHashTarget() {
  const hash = window.location.hash;
  if (!hash) {
    return;
  }

  const target = document.getElementById(hash.slice(1));
  if (!target) {
    return;
  }

  if (target.dataset.category) {
    updateFilter("all");
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCategorySections(projects) {
  categorySections.innerHTML = "";

  categoryOrder.forEach((category) => {
    const list = projects.filter((project) => project.category === category).slice().sort(byTitle);
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
  categoryFilters.innerHTML = "";
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
    const response = await fetch("data/projects.json?v=20260610-5", { cache: "no-store" });
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
  renderComingSoon(projects);
  renderCategorySections(projects);
  buildFilterButtons();
  updateFilter("all");
  hideBrokenThumbnails();
  scrollToHashTarget();
}

window.addEventListener("hashchange", scrollToHashTarget);

initialize();




