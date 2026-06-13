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
  "Pocket Chordsmith",
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
  ["YouTube", "https://www.youtube.com/@samsmall12"],
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

function getIconKey(label, url, title = "") {
  const text = `${title} ${label} ${url}`.toLowerCase();
  if (text.includes("play.google.com") || text.includes("google play")) return "google-play";
  if (text.includes("amazon.") || /\bamazon\b/.test(text)) return "amazon";
  if (text.includes("godotengine.org") || /\bgodot\b/.test(text)) return "godot";
  if (text.includes("open.spotify.com") || /\bspotify\b/.test(text)) return "spotify";
  if (text.includes("store.steampowered.com") || /\bsteam\b/.test(text)) return "steam";
  if (text.includes("facebook.com") || /\bfacebook\b/.test(text)) return "facebook";
  if (text.includes("github.com") || /\bgithub\b/.test(text)) return "github";
  if (text.includes("itch.io") || /\bitch\.io\b/.test(text)) return "itch";
  if (text.includes("reddit.com") || /\breddit\b/.test(text)) return "reddit";
  if (text.includes("youtube.com") || /\byoutube\b/.test(text)) return "youtube";
  if (text.includes("x.com") || /\bx\s*\/\s*twitter\b/.test(text) || /\btwitter\b/.test(text)) return "x";
  return "";
}

function iconSvg(key) {
  const icons = {
    "google-play":
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.8 2.8c-.2.22-.3.55-.3.97v15.46c0 .42.1.75.3.97l.08.07 8.66-8.66v-.18L3.88 2.73l-.08.07Z"/><path fill="#4285F4" d="m15.4 14.5-2.87-2.88v-.18l2.88-2.88.06.04 3.4 1.94c.98.56.98 1.47 0 2.03l-3.4 1.94-.07-.01Z"/><path fill="#FBBC04" d="M15.46 14.46 12.52 11.5 3.8 20.22c.32.35.85.4 1.45.06l10.2-5.82Z"/><path fill="#EA4335" d="M15.46 8.54 5.25 2.72c-.6-.34-1.13-.29-1.45.06l8.72 8.72 2.94-2.96Z"/></svg>',
    amazon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.2 14.5c-.78.58-1.92.9-2.9.9-1.42 0-2.7-.52-3.67-1.39-.08-.07-.01-.17.08-.12 1.05.61 2.36.98 3.71.98.87 0 1.83-.18 2.71-.55.13-.05.24.08.07.18Z"/><path fill="currentColor" d="M16.03 13.55c-.1-.13-.68-.06-.94-.03-.08.01-.1-.06-.03-.12.45-.32 1.18-.23 1.27-.12.09.11-.03.85-.45 1.21-.07.06-.13.03-.1-.05.1-.24.35-.77.25-.89Z"/><path fill="currentColor" d="M13.07 10.62c0 .54.01.99-.26 1.47-.22.39-.58.63-.97.63-.54 0-.86-.41-.86-1.02 0-1.2 1.08-1.42 2.09-1.42v.34Zm1.42 3.43c-.09.08-.22.08-.32.03-.45-.37-.53-.54-.78-.91-.75.77-1.27 1-2.23 1-1.14 0-2.03-.7-2.03-2.1 0-1.09.59-1.83 1.43-2.2.73-.33 1.75-.39 2.53-.48v-.18c0-.34.03-.75-.17-1.05-.17-.27-.5-.38-.79-.38-.54 0-1.03.28-1.15.85-.03.13-.12.27-.25.27l-1.3-.14c-.11-.03-.23-.11-.2-.28.3-1.58 1.73-2.05 3.01-2.05.65 0 1.5.17 2.02.66.65.61.58 1.42.58 2.31v2.09c0 .63.26.91.51 1.26.09.13.11.29 0 .38-.27.23-.75.64-1.01.87l-.02-.03Z"/></svg>',
    godot:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6 9.9 4.1 7.3 3.75 6.1 6.08 3.72 7.05l.26 2.62L2.6 12l1.38 2.33-.26 2.62 2.39.97 1.19 2.33 2.6-.35L12 21.4l2.1-1.5 2.6.35 1.19-2.33 2.39-.97-.26-2.62L21.4 12l-1.38-2.33.26-2.62-2.39-.97-1.19-2.33-2.6.35L12 2.6Zm0 3.1a6.3 6.3 0 1 1 0 12.6 6.3 6.3 0 0 1 0-12.6Zm-2.27 3.47a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm4.54 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm-4.56 4.4c.65.82 1.46 1.22 2.29 1.22.82 0 1.64-.4 2.29-1.22.18-.22.52-.26.74-.08.22.18.26.52.08.74-.85 1.06-1.97 1.6-3.11 1.6s-2.26-.54-3.11-1.6a.53.53 0 0 1 .82-.66Z"/></svg>',
    spotify:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm4.34 13.7a.79.79 0 0 1-1.08.26c-2.96-1.8-6.68-2.2-11.07-1.17a.79.79 0 1 1-.36-1.54c4.8-1.13 8.92-.67 12.25 1.35.37.23.49.72.26 1.1Zm1.54-3.43a.98.98 0 0 1-1.34.32c-3.39-2.08-8.56-2.68-12.57-1.47a.98.98 0 1 1-.57-1.87c4.58-1.39 10.28-.72 14.16 1.67.46.28.6.88.32 1.35Zm.13-3.57C13.94 6.77 7.2 6.56 3.36 7.73a1.18 1.18 0 1 1-.69-2.25c4.41-1.34 11.75-1.08 16.55 1.77a1.18 1.18 0 0 1-1.21 2.05Z"/></svg>',
    steam:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.98 2A10 10 0 0 0 2.9 15.94l4.27 1.77a3.13 3.13 0 0 1 1.78-.14l1.9-2.76v-.04a4.17 4.17 0 1 1 4.17 4.17h-.1l-2.72 1.94a3.13 3.13 0 1 1-5.9-1.17l-3.06-1.27A10 10 0 1 0 11.98 2Zm-4.21 17.9a1.87 1.87 0 1 0 1.87 1.87 1.87 1.87 0 0 0-1.87-1.87Zm7.24-9.32a2.92 2.92 0 1 0 2.92 2.92 2.92 2.92 0 0 0-2.92-2.92Z"/></svg>',
    facebook:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 22v-8.2h2.77l.42-3.2H13.5V8.56c0-.93.27-1.56 1.61-1.56h1.72V4.14A22.4 22.4 0 0 0 14.33 4C11.86 4 10.17 5.5 10.17 8.26v2.34H7.5v3.2h2.67V22h3.33Z"/></svg>',
    github:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.54 1.04 1.54 1.04.9 1.53 2.35 1.09 2.92.84.09-.66.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.67-.1-.25-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.02A9.5 9.5 0 0 1 12 6.84c.85 0 1.7.11 2.5.33 1.9-1.29 2.74-1.02 2.74-1.02.56 1.38.21 2.41.1 2.66.64.69 1.03 1.58 1.03 2.67 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
    itch:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 8.5c0-.9.46-1.74 1.22-2.21l7.26-4.5a2.94 2.94 0 0 1 3.04 0l7.26 4.5A2.6 2.6 0 0 1 22 8.5v7.8c0 .95-.77 1.72-1.72 1.72h-1.11a3.18 3.18 0 0 1-6.34 0H11.2a3.18 3.18 0 0 1-6.34 0H3.72A1.72 1.72 0 0 1 2 16.3V8.5Zm4.82 4.32a1.68 1.68 0 1 0 0-3.36 1.68 1.68 0 0 0 0 3.36Zm10.36 0a1.68 1.68 0 1 0 0-3.36 1.68 1.68 0 0 0 0 3.36Z"/></svg>',
    reddit:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.2 15.26a3.77 3.77 0 0 1-4.4 0 .45.45 0 1 0-.53.73 4.67 4.67 0 0 0 5.46 0 .45.45 0 1 0-.53-.73ZM9.45 12.3a1.02 1.02 0 1 0 1.02 1.02 1.02 1.02 0 0 0-1.02-1.02Zm5.1 0a1.02 1.02 0 1 0 1.02 1.02 1.02 1.02 0 0 0-1.02-1.02Z"/><path fill="currentColor" d="M22 12a2.22 2.22 0 0 0-3.8-1.56 8.18 8.18 0 0 0-4.94-1.54 8.32 8.32 0 0 0-1.9.22l.96-3.04 2.61.61a1.68 1.68 0 1 0 .2-.88l-3.14-.73a.45.45 0 0 0-.53.3l-1.15 3.68A8.19 8.19 0 0 0 5.8 10.4 2.22 2.22 0 1 0 3.3 14a4.7 4.7 0 0 0-.05.66c0 3.3 3.92 6 8.75 6s8.75-2.69 8.75-6a4.9 4.9 0 0 0-.05-.67A2.22 2.22 0 0 0 22 12Z"/></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 12.01s0-3.26-.42-4.83a2.52 2.52 0 0 0-1.77-1.78C19.24 5 12 5 12 5s-7.24 0-8.81.4A2.52 2.52 0 0 0 1.42 7.2C1 8.75 1 12 1 12s0 3.26.42 4.82a2.52 2.52 0 0 0 1.77 1.78C4.76 19 12 19 12 19s7.24 0 8.81-.4a2.52 2.52 0 0 0 1.77-1.78c.42-1.56.42-4.81.42-4.81ZM9.1 15.5v-7l6.05 3.5-6.05 3.5Z"/></svg>',
    x:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.77 7.74L23 22h-6.2l-4.85-6.33L6.4 22H3.3l7.24-8.27L1 2h6.36l4.38 5.77L18.9 2Zm-1.09 18h1.72L6.43 3.9H4.58L17.81 20Z"/></svg>',
  };

  return icons[key] || "";
}

function iconLabelHtml(label, url, title = "") {
  const key = getIconKey(label, url, title);
  const svg = iconSvg(key);
  if (!svg) return escapeHtml(label);
  return `<span class="icon-label"><span class="icon-mark" aria-hidden="true">${svg}</span><span>${escapeHtml(label)}</span></span>`;
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
  const titleHtml = iconLabelHtml(title, "", title);
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
      )}" data-project-category="${escapeHtml(category)}" data-link-label="${escapeHtml(link.label)}">${iconLabelHtml(
        link.label,
        url,
        title
      )}</a>`;
    })
    .join("");

  return `
    <article class="card">
      ${projectThumbnailHtml(project)}
      <h3>${titleHtml}</h3>
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
          `<a class="button${index === 0 ? "" : " button-ghost"}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${iconLabelHtml(
            label,
            url,
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
    const response = await fetch("/data/projects.json?v=20260613-1", { cache: "no-store" });
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
