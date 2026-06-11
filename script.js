const fallbackProjects = [
  {
    title: "Samfa12 itch.io",
    category: "Storefronts",
    type: "Publisher page",
    status: "Published",
    description: "Samfa12's central storefront for playable builds and releases.",
    featured: true,
    links: [{ label: "Visit page", url: "https://samfa12.itch.io/" }],
  },
  {
    title: "GitHub",
    category: "Social",
    type: "Profile",
    status: "Published",
    description: "Public source repositories, releases, and development history for Samfa12 projects.",
    links: [{ label: "Open profile", url: "https://github.com/Samfa12-tech" }],
  },
];

const homeFeaturedTitles = [
  "Dust on the River",
  "Drink",
  "Night Shift at Possum's Cafe",
  "ToKnight",
  "Article 18",
  "Google Play apps",
];

const pocketAudioTitles = [
  "Pocket Chordsmith",
  "Pocket DJ",
  "Pocket DAW",
  "Pocket Chordsmith Godot addon",
];

const topLinks = [
  ["GitHub", "https://github.com/Samfa12-tech"],
  ["Pocket Audio source", "https://github.com/Samfa12-tech/Pocket-Chordsmith"],
  ["Contact", "https://www.facebook.com/messages/t/61577421161868/"],
  ["itch.io", "https://samfa12.itch.io/"],
  ["Steam", "https://store.steampowered.com/search/?publisher=Samfa12"],
  ["Google Play apps", "https://play.google.com/store/apps/dev?id=7761853381809168545"],
  ["Amazon author", "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true"],
  ["Spotify", "https://open.spotify.com/artist/6ZDb5x10yqra2d6lBCpnkS"],
  ["YouTube Music", "https://music.youtube.com/search?q=Samfa12"],
  ["X / Twitter", "https://x.com/Samfa12"],
  ["Facebook", "https://www.facebook.com/people/Samfa12-Drink-Sober"],
  ["Reddit", "https://www.reddit.com/user/Samfa12/"],
  ["Godot Asset Library", "https://godotengine.org/asset-library/asset?filter=Samfa12"],
];

const dataStatus = document.getElementById("data-status");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function isExternalUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function linkAttributes(url) {
  return isExternalUrl(url) ? ' target="_blank" rel="noopener noreferrer"' : "";
}

function getStatusClass(status) {
  const value = String(status || "Available").toLowerCase();
  if (value.includes("coming soon")) return "status-coming-soon";
  if (value.includes("in development") || value.includes("wip")) return "status-development";
  if (value.includes("prototype")) return "status-prototype";
  if (value.includes("published")) return "status-published";
  return "status-available";
}

function isSafeLocalThumbnail(path) {
  if (typeof path !== "string") return false;
  const normalized = path.trim().replace(/\\/g, "/");
  if (!/^assets\/thumbnails\/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp|gif|svg)$/i.test(normalized)) {
    return false;
  }
  return !normalized.includes("..") && !/(fallback|placeholder|dummy|temp|default)/i.test(normalized);
}

function rootRelativePath(path) {
  const normalized = String(path || "").trim().replace(/\\/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function projectThumbnailHtml(project) {
  const thumbnail = project.thumbnail ?? project.image;
  if (!isSafeLocalThumbnail(thumbnail)) return "";

  const title = project.title || "Samfa12 project";
  const category = project.category || "";
  const fitClass = category === "Books" ? "" : project.imageFit === "cover" ? "project-image-cover-fill" : "";
  const mediaClass = `project-media ${category === "Books" ? "project-media-book" : ""}`.trim();
  const imageClass = `project-image ${fitClass}`.trim();
  const alt = project.thumbnailAlt || project.imageAlt || `Cover image for ${title}`;

  return `
    <div class="${mediaClass}">
      <img
        src="${escapeHtml(rootRelativePath(thumbnail))}"
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
    .map((link) => {
      const url = String(link.url);
      return `<a href="${escapeHtml(url)}"${linkAttributes(url)} data-analytics="project-link" data-project-title="${escapeHtml(
        title
      )}" data-project-category="${escapeHtml(category)}" data-link-label="${escapeHtml(link.label)}">${escapeHtml(
        link.label
      )}</a>`;
    })
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
      ${links ? `<div class="links" aria-label="${escapeHtml(title)} links">${links}</div>` : ""}
      <p class="card-category">${escapeHtml(category)}</p>
      ${tags ? `<div class="project-meta">${tags}</div>` : ""}
    </article>
  `;
}

function hideBrokenThumbnails() {
  document.querySelectorAll("img.project-image").forEach((image) => {
    image.addEventListener("error", () => {
      const container = image.closest(".project-media");
      if (container) container.hidden = true;
    });
  });
}

function renderGrid(element, projects) {
  if (!element) return;
  element.innerHTML = projects.map(projectCardHtml).join("");
  hideBrokenThumbnails();
}

function renderHome(projects) {
  const grid = document.getElementById("featured-grid");
  const order = new Map(homeFeaturedTitles.map((title, index) => [title, index]));
  const featured = projects
    .filter((project) => order.has(project.title))
    .slice()
    .sort((a, b) => order.get(a.title) - order.get(b.title))
    .slice(0, 6);

  renderGrid(grid, featured);
}

function renderCatalogue(projects) {
  const grid = document.getElementById("project-grid");
  const category = document.body.dataset.category;
  const list = projects.filter((project) => project.category === category).slice().sort(bySortThenTitle);
  renderGrid(grid, list);
}

function renderApps(projects) {
  const grid = document.getElementById("project-grid");
  const list = projects
    .filter((project) => project.category === "Apps & Tools" || project.category === "Assets")
    .slice()
    .sort(bySortThenTitle);
  renderGrid(grid, list);
}

function renderPocketAudio(projects) {
  const grid = document.getElementById("project-grid");
  const order = new Map(pocketAudioTitles.map((title, index) => [title, index]));
  const list = projects
    .filter((project) => order.has(project.title))
    .slice()
    .sort((a, b) => order.get(a.title) - order.get(b.title));
  renderGrid(grid, list);
}

function renderLinks(projects) {
  const linkGrid = document.getElementById("link-grid");
  if (linkGrid) {
    linkGrid.innerHTML = topLinks
      .map(
        ([label, url], index) =>
          `<a class="button${index === 0 ? "" : " button-ghost"}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            label
          )}</a>`
      )
      .join("");
  }

  const grid = document.getElementById("project-grid");
  const list = projects
    .filter((project) => ["Social", "Storefronts"].includes(project.category))
    .slice()
    .sort(bySortThenTitle);
  renderGrid(grid, list);
}

async function loadProjects() {
  try {
    const response = await fetch("/data/projects.json?v=20260612-1", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid JSON data");
    return data;
  } catch (error) {
    if (dataStatus) {
      dataStatus.hidden = false;
      dataStatus.textContent = "Could not load data/projects.json. Using embedded fallback data for local preview.";
    }
    return fallbackProjects;
  }
}

async function initialize() {
  const projects = await loadProjects();
  const page = document.body.dataset.page;

  if (page === "home") renderHome(projects);
  if (page === "catalogue") renderCatalogue(projects);
  if (page === "apps") renderApps(projects);
  if (page === "pocket-audio") renderPocketAudio(projects);
  if (page === "links") renderLinks(projects);
}

initialize();
