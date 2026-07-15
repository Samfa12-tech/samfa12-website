(() => {
  const DATA_VERSION = "20260715-3";
  const DATA_URL = `/data/projects.json?v=${DATA_VERSION}`;
  const ANALYTICS_STORAGE_KEY = "samfa12:analytics-consent";
  const CLARITY_PROJECT_ID = "x4qwugpfik";
  const FETCH_TIMEOUT_MS = 8000;
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const fallbackProjects = [
    {
      title: "Dust on the River",
      category: "Games",
      type: "Game",
      status: "Published",
      description: "A story-driven bushranger adventure about whether a violent past can ever really stay buried.",
      featured: true,
      links: [{ label: "Play on itch.io", url: "https://samfa12.itch.io/dust-on-the-river" }],
      sortOrder: 0,
      thumbnail: "assets/thumbnails/dust-on-the-river-b9a9e3.png",
    },
    {
      title: "Cursed Cutter",
      category: "Games",
      type: "Browser game",
      status: "Playable",
      description: "Cut through cursed waves, survive each run, upgrade, and push further on phone or computer.",
      links: [{ label: "Play now", url: "/games/cursed-cutter/" }],
      sortOrder: 3.5,
      thumbnail: "assets/thumbnails/cursed-cutter-icon.webp",
    },
    {
      title: "ToKnight",
      category: "Books",
      type: "Book",
      status: "Published",
      description: "A middle-grade fantasy adventure about Jason Proud and the first step into the ToKnight world.",
      featured: true,
      links: [{ label: "Amazon Kindle", url: "https://www.amazon.com.au/dp/B0GX2NG31Z" }],
      sortOrder: 12,
      thumbnail: "assets/thumbnails/toknight-47d9be.png",
    },
    {
      title: "Pocket Chordsmith",
      category: "Apps & Tools",
      type: "Web app",
      status: "Published",
      description: "The Pocket Audio songwriting hub for sketching progressions, MIDI ideas, exports, and game-audio handoff workflows.",
      featured: true,
      links: [{ label: "Use on Samfa12.com", url: "/apps/pocket-chordsmith/" }],
      sortOrder: 3,
      thumbnail: "assets/thumbnails/pocket-chordsmith-0f81a2.png",
    },
    {
      title: "Pocket Chordsmith Godot addon",
      category: "Assets",
      type: "Godot add-on",
      status: "Published",
      description: "A Godot addon for importing Pocket Chordsmith data and driving adaptive music callbacks in games.",
      links: [{ label: "Godot Asset Library", url: "https://godotengine.org/asset-library/asset/5174" }],
      sortOrder: 18,
      thumbnail: "assets/thumbnails/pocket-chordsmith-godot-addon-icon.png",
    },
    {
      title: "Drink OST",
      category: "Music",
      type: "Album",
      status: "Published",
      description: "The Drink original soundtrack album.",
      featured: true,
      links: [{ label: "Listen on Spotify", url: "https://open.spotify.com/album/42zZtz4npdYAkaFBa8fZtg" }],
      sortOrder: 31,
      thumbnail: "assets/thumbnails/drink-ost-6d4b8e.webp",
    },
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

  const linkGroups = [
    {
      title: "Play",
      links: [
        ["itch.io", "https://samfa12.itch.io/"],
        ["Steam", "https://store.steampowered.com/search/?publisher=Samfa12"],
        ["Google Play", "https://play.google.com/store/apps/dev?id=7761853381809168545"],
      ],
    },
    {
      title: "Read",
      links: [
        ["Amazon author store", "https://www.amazon.com.au/stores/Samfa-12/author/B0GTPM5KF2?ref=ap_rdr&shoppingPortalEnabled=true"],
        ["Google Books discovery", "https://www.google.com/search?q=site%3Abooks.google.com+Samfa12"],
      ],
    },
    {
      title: "Listen",
      links: [
        ["Spotify", "https://open.spotify.com/artist/6ZDb5x10yqra2d6lBCpnkS"],
        ["YouTube Music", "https://music.youtube.com/search?q=Samfa12"],
        ["YouTube", "https://www.youtube.com/@samsmall12"],
      ],
    },
    {
      title: "Build / source",
      links: [
        ["GitHub", "https://github.com/Samfa12-tech"],
        ["Pocket Audio source", "https://github.com/Samfa12-tech/Pocket-Chordsmith"],
        ["Godot Asset Library", "https://godotengine.org/asset-library/asset?filter=Samfa12"],
      ],
    },
    {
      title: "Follow",
      links: [
        ["X / Twitter", "https://x.com/Samfa12"],
        ["Facebook", "https://www.facebook.com/profile.php?id=61577421161868"],
        ["Reddit", "https://www.reddit.com/user/Samfa12/"],
      ],
    },
  ];

  const dataStatus = document.getElementById("data-status");
  const catalogueControls = document.getElementById("catalogue-controls");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  let activeGameOverlay = null;
  let activeGameLauncher = null;
  let navigationReady = false;
  let overlayReady = false;
  let revealObserver = null;
  const CATALOGUE_FILTER_CONFIG = {
    Games: {
      filterLabel: "Platform",
      filterLabelPlural: "platforms",
      sortLabel: "Platform",
      labelOrder: ["Browser", "itch.io", "Google Play", "Steam", "Wavedash"],
    },
    Books: {
      filterLabel: "Storefront",
      filterLabelPlural: "storefronts",
      sortLabel: "Storefront",
      labelOrder: ["Amazon", "Google Play", "itch.io"],
    },
  };

  function createElement(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === false || value === null || value === undefined) return;
      if (key === "className") {
        element.className = value;
        return;
      }
      if (key === "text") {
        element.textContent = value;
        return;
      }
      if (key === "dataset") {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          if (dataValue !== null && dataValue !== undefined) element.dataset[dataKey] = String(dataValue);
        });
        return;
      }
      if (key === "styleProps") {
        Object.entries(value).forEach(([property, propertyValue]) => {
          element.style.setProperty(property, propertyValue);
        });
        return;
      }
      if (key in element && key !== "list" && key !== "role") {
        element[key] = value === true ? true : value;
        return;
      }
      element.setAttribute(key, value === true ? "" : String(value));
    });

    appendChildren(element, children);
    return element;
  }

  function appendChildren(parent, children) {
    const list = Array.isArray(children) ? children : [children];
    list.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
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

  function safeUrl(rawUrl) {
    if (typeof rawUrl !== "string") return "";
    const url = rawUrl.trim();
    if (!url || /[\u0000-\u001f]/.test(url)) return "";

    if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
      return url;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function safeHostname(url) {
    try {
      return new URL(url, window.location.origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function readAnalyticsConsent() {
    try {
      const value = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
      return value === "granted" || value === "denied" ? value : "unset";
    } catch {
      return "unset";
    }
  }

  function writeAnalyticsConsent(value) {
    try {
      window.localStorage.setItem(ANALYTICS_STORAGE_KEY, value);
    } catch {
      // The choice still applies to this page when storage is unavailable.
    }
  }

  function loadClarityAnalytics() {
    if (document.querySelector("script[data-samfa12-clarity]")) return;
    window.clarity = window.clarity || function clarityQueue() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    const script = document.createElement("script");
    script.async = true;
    script.dataset.samfa12Clarity = "true";
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    document.head.append(script);
  }

  function removeAnalyticsChoice() {
    document.querySelector("[data-analytics-choice]")?.remove();
  }

  function showAnalyticsChoice() {
    removeAnalyticsChoice();
    const previouslyLoaded = Boolean(document.querySelector("script[data-samfa12-clarity]"));
    const message = createElement("p", {
      className: "analytics-choice-copy",
      text: "Optional analytics help Samfa12 find broken or confusing parts of the site. They stay off unless you allow them.",
    });
    const privacyLink = createElement("a", { className: "analytics-choice-link", href: "/privacy/", text: "Privacy details" });
    const allowButton = createElement("button", {
      className: "button analytics-choice-allow",
      type: "button",
      text: "Allow analytics",
    });
    const declineButton = createElement("button", {
      className: "button button-ghost analytics-choice-decline",
      type: "button",
      text: readAnalyticsConsent() === "granted" ? "Disable analytics" : "No thanks",
    });
    const choice = createElement("aside", {
      className: "analytics-choice",
      role: "region",
      "aria-label": "Analytics preference",
      dataset: { analyticsChoice: "" },
    }, [
      createElement("div", { className: "analytics-choice-text" }, [
        createElement("p", { className: "eyebrow", text: "Privacy signal" }),
        message,
        privacyLink,
      ]),
      createElement("div", { className: "analytics-choice-actions" }, [allowButton, declineButton]),
    ]);

    allowButton.addEventListener("click", () => {
      writeAnalyticsConsent("granted");
      loadClarityAnalytics();
      removeAnalyticsChoice();
    });
    declineButton.addEventListener("click", () => {
      writeAnalyticsConsent("denied");
      removeAnalyticsChoice();
      if (previouslyLoaded) window.location.reload();
    });
    document.body.append(choice);
  }

  function initializeAnalyticsPreferences() {
    const consent = readAnalyticsConsent();
    if (consent === "granted") loadClarityAnalytics();
    else if (consent === "unset") showAnalyticsChoice();

    const signals = document.querySelector(".site-footer .footer-grid > div:last-child .footer-links");
    if (!signals || signals.querySelector("[data-analytics-preferences]")) return;
    const preferences = createElement("button", {
      className: "footer-link-button",
      type: "button",
      text: "Analytics preferences",
      dataset: { analyticsPreferences: "" },
    });
    preferences.addEventListener("click", showAnalyticsChoice);
    signals.append(preferences);
  }

  function safePathname(url) {
    try {
      return new URL(url, window.location.origin).pathname.toLowerCase();
    } catch {
      return "";
    }
  }

  function isLocalGameRoute(url) {
    return typeof url === "string" && /^\/games\/.+/.test(url);
  }

  function isExternalUrl(url) {
    try {
      return new URL(url, window.location.origin).origin !== window.location.origin;
    } catch {
      return false;
    }
  }

  function isSafeLocalThumbnail(path) {
    if (typeof path !== "string") return false;
    const normalized = path.trim().replace(/\\/g, "/");
    return (
      /^assets\/thumbnails\/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp|gif|svg)$/i.test(normalized) &&
      !normalized.includes("..") &&
      !/(fallback|placeholder|dummy|temp|default)/i.test(normalized)
    );
  }

  function rootRelativePath(path) {
    const normalized = String(path || "").trim().replace(/\\/g, "/");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }

  function pushUniqueLabel(labels, label) {
    if (label && !labels.includes(label)) labels.push(label);
  }

  function orderCatalogueLabels(labels, labelOrder) {
    return labelOrder.filter((label) => labels.includes(label));
  }

  function deriveGameCatalogueLabels(project, links) {
    const labels = [];
    const primaryUrl = links[0]?.url || "";
    const type = String(project.type || "").toLowerCase();

    if (type.includes("browser") || isLocalGameRoute(primaryUrl)) {
      pushUniqueLabel(labels, "Browser");
    }

    links.forEach((link) => {
      const host = safeHostname(link.url);
      const path = safePathname(link.url);
      if (isLocalGameRoute(link.url)) pushUniqueLabel(labels, "Browser");
      if (host.endsWith("itch.io")) pushUniqueLabel(labels, "itch.io");
      if (host === "play.google.com" && path.startsWith("/store/apps")) pushUniqueLabel(labels, "Google Play");
      if (host === "store.steampowered.com") pushUniqueLabel(labels, "Steam");
      if (host === "wavedash.com" || host.endsWith(".wavedash.com")) pushUniqueLabel(labels, "Wavedash");
    });

    return orderCatalogueLabels(labels, CATALOGUE_FILTER_CONFIG.Games.labelOrder);
  }

  function deriveBookCatalogueLabels(links) {
    const labels = [];

    links.forEach((link) => {
      const host = safeHostname(link.url);
      const path = safePathname(link.url);
      if (host.includes("amazon.")) pushUniqueLabel(labels, "Amazon");
      if (host === "play.google.com" && (path.startsWith("/store/books") || path.startsWith("/store/audiobooks"))) {
        pushUniqueLabel(labels, "Google Play");
      }
      if (host.endsWith("itch.io")) pushUniqueLabel(labels, "itch.io");
    });

    return orderCatalogueLabels(labels, CATALOGUE_FILTER_CONFIG.Books.labelOrder);
  }

  function deriveCatalogueLabels(project, links) {
    if (project.category === "Games") return deriveGameCatalogueLabels(project, links);
    if (project.category === "Books") return deriveBookCatalogueLabels(links);
    return [];
  }

  function normalizeProject(project) {
    if (!project || typeof project !== "object" || !project.title) return null;
    const links = Array.isArray(project.links)
      ? project.links
          .map((link) => {
            const url = safeUrl(link?.url);
            const label = typeof link?.label === "string" && link.label.trim() ? link.label.trim() : "Open";
            return url ? { label, url, fullscreen: link.fullscreen === true } : null;
          })
          .filter(Boolean)
      : [];
    const catalogueLabels = deriveCatalogueLabels(project, links);

    return {
      ...project,
      title: String(project.title),
      category: String(project.category || "Uncategorized"),
      type: String(project.type || "Project"),
      status: String(project.status || "Available"),
      description: String(project.description || ""),
      tags: Array.isArray(project.tags) ? project.tags.filter((tag) => typeof tag === "string" && tag.trim()) : [],
      links,
      catalogueLabels,
    };
  }

  function normalizeProjects(projects) {
    return Array.isArray(projects) ? projects.map(normalizeProject).filter(Boolean) : [];
  }

  function getFallbackProjects() {
    return normalizeProjects(fallbackProjects);
  }

  function getStatusClass(status) {
    const value = String(status || "Available").toLowerCase();
    if (value.includes("coming soon")) return "status-coming-soon";
    if (value.includes("development") || value.includes("wip")) return "status-development";
    if (value.includes("prototype")) return "status-prototype";
    if (value.includes("experimental")) return "status-experimental";
    if (value.includes("published")) return "status-published";
    return "status-available";
  }

  function getAccent(project, index = 0) {
    const accents = new Set(["cyan", "violet", "spark", "green", "pink"]);
    if (accents.has(project.accent)) return project.accent;
    const category = String(project.category || "").toLowerCase();
    if (category.includes("book")) return "spark";
    if (category.includes("music")) return "pink";
    if (category.includes("apps") || category.includes("assets")) return "green";
    return index % 2 ? "violet" : "cyan";
  }

  function getHomepageRank(project) {
    const rank = Number(project.homepageRank);
    return Number.isInteger(rank) && rank > 0 ? rank : null;
  }

  function getHomepageSize(project, index) {
    const allowed = new Set(["hero", "tall", "wide", "standard"]);
    if (allowed.has(project.homepageSize)) return project.homepageSize;
    if (index === 0) return "hero";
    if (index === 1) return "tall";
    if (index === 4) return "wide";
    return "standard";
  }

  function homepageWeight(project) {
    const rank = getHomepageRank(project);
    if (rank) return rank;
    if (project.featured === true) return 10000 + (Number(project.sortOrder) || 0);
    return 20000 + (Number(project.sortOrder) || 0);
  }

  function getPrimaryLink(project) {
    return project.links.find((link) => safeUrl(link.url)) || null;
  }

  function gridHasUsefulCards(element) {
    return Boolean(element?.querySelector(".project-card, .mini-lab-card"));
  }

  function canUseFullscreenOverlay() {
    return finePointer.matches && window.innerWidth >= 760 && "HTMLIFrameElement" in window;
  }

  function projectThumbnail(project, priority = false) {
    const thumbnail = project.thumbnail ?? project.image;
    const hasThumbnail = isSafeLocalThumbnail(thumbnail);
    const mediaClass = ["project-media", project.category === "Books" ? "project-media-book" : ""].filter(Boolean).join(" ");

    if (!hasThumbnail) {
      return createElement("div", { className: mediaClass }, [
        createElement("span", { className: "project-image-fallback", text: project.title }),
      ]);
    }

    const fit = project.imageFit === "cover" ? "cover" : "contain";
    const image = createElement("img", {
      className: `project-image ${fit === "cover" ? "project-image-cover-fill" : ""}`.trim(),
      alt: project.thumbnailAlt || project.imageAlt || `Cover image for ${project.title}`,
      loading: priority ? "eager" : "lazy",
      decoding: "async",
      width: project.category === "Books" ? 640 : 960,
      height: project.category === "Books" ? 800 : 540,
    });

    image.addEventListener("error", () => {
      const fallback = createElement("span", { className: "project-image-fallback", text: project.title });
      image.closest(".project-media")?.replaceChildren(fallback);
    });
    image.src = rootRelativePath(thumbnail);

    return createElement("div", { className: mediaClass }, [image]);
  }

  function projectLink(link, project, primary = false) {
    const href = safeUrl(link.url);
    if (!href) return null;
    const anchor = createElement("a", {
      className: `project-link ${primary ? "project-link-primary" : ""}`.trim(),
      href,
      dataset: {
        projectTitle: project.title,
        projectCategory: project.category,
        linkLabel: link.label,
      },
    });

    if (isExternalUrl(href)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }

    if (link.fullscreen === true && !isExternalUrl(href) && canUseFullscreenOverlay()) {
      anchor.dataset.fullscreenGame = href;
      anchor.classList.add("project-play-link");
    }

    anchor.append(link.label, createElement("span", { className: "link-arrow", text: "->", "aria-hidden": "true" }));
    return anchor;
  }

  function createProjectCard(project, options = {}) {
    const { variant = "catalogue", index = 0 } = options;
    const isFeatured = variant === "featured";
    const isSpotlight = variant === "spotlight";
    const size = isFeatured ? getHomepageSize(project, index) : "standard";
    const primaryLink = getPrimaryLink(project);
    const article = createElement("article", {
      className: `project-card project-card-${variant} card-size-${size}`.trim(),
      dataset: {
        accent: getAccent(project, index),
        reveal: "",
      },
    });

    appendChildren(article, [
      projectThumbnail(project, (isFeatured || isSpotlight) && index === 0),
      createElement("p", {
        className: "project-label",
        text: `${project.type}${isFeatured || isSpotlight ? ` // ${project.category}` : ""}`,
      }),
      createElement("h3", { text: project.title }),
      createElement("p", { className: "card-description", text: project.description }),
    ]);

    const meta = createElement("p", { className: "project-meta" }, [
      createElement("span", { className: `pill ${getStatusClass(project.status)}`, text: project.status }),
    ]);
    article.append(meta);

    if (!isFeatured && !isSpotlight && project.catalogueLabels.length) {
      const labels = createElement("p", { className: "project-meta project-meta-catalogue-labels" });
      project.catalogueLabels.forEach((label) => {
        labels.append(createElement("span", { className: "pill pill-catalogue-label", text: label }));
      });
      article.append(labels);
    }

    if (primaryLink) {
      const actions = createElement("div", {
        className: "project-actions",
        role: "group",
        "aria-label": `${project.title} links`,
      });
      actions.append(projectLink(primaryLink, project, true));

      if (!isFeatured && !isSpotlight) {
        project.links.slice(1).forEach((link) => {
          const node = projectLink(link, project, false);
          if (node) actions.append(node);
        });
      }

      article.append(actions);
    }

    if (!isFeatured && !isSpotlight && project.tags.length) {
      const tags = createElement("p", { className: "project-meta" });
      project.tags.slice(0, 5).forEach((tag) => tags.append(createElement("span", { className: "pill", text: tag })));
      article.append(tags);
    }

    return article;
  }

  function buildProjectFragment(projects, variant = "catalogue") {
    const fragment = document.createDocumentFragment();
    let cardCount = 0;

    projects.forEach((project, index) => {
      try {
        const card = createProjectCard(project, { variant, index });
        if (card?.classList?.contains("project-card")) {
          fragment.append(card);
          cardCount += 1;
        }
      } catch (error) {
        console.warn("Skipping project card that could not be rendered:", project?.title || project, error);
      }
    });

    return { fragment, cardCount };
  }

  function replaceGridWithBuiltCards(element, fragment, cardCount, emptyMessage, preserveExistingOnEmpty = true) {
    if (!element) return false;

    if (cardCount > 0) {
      element.replaceChildren(fragment);
      initializeReveals(element);
      initializePointerGlow(element);
      return true;
    }

    if (preserveExistingOnEmpty && gridHasUsefulCards(element)) {
      if (emptyMessage) showDataStatus(emptyMessage, false);
      initializeReveals(element);
      return false;
    }

    element.replaceChildren();
    if (emptyMessage) showDataStatus(emptyMessage, false);
    return false;
  }

  function createMiniLabCard() {
    const pads = [
      ["LOFI", "lofi"],
      ["CHIP", "chip"],
      ["WESTERN", "western"],
      ["STANDARD", "standard"],
    ];
    const card = createElement("article", { className: "mini-lab-card", dataset: { pocketMiniLab: "", reveal: "" } }, [
      createElement("p", { className: "project-label", text: "Pocket Audio // Mini lab" }),
      createElement("h3", { text: "Tap a style to loop four bars." }),
      createElement("div", { className: "mini-wave", "aria-hidden": "true" }),
    ]);

    const grid = createElement("div", { className: "pad-grid" });
    pads.forEach(([label, tone]) => {
      grid.append(
        createElement("button", {
          className: "audio-pad",
          type: "button",
          text: label,
          dataset: { tone },
          "aria-pressed": "false",
          "aria-label": `Play ${label.toLowerCase()} four-bar Pocket Audio demo loop`,
        })
      );
    });

    card.append(
      grid,
      createElement("button", { className: "stop-audio", type: "button", text: "Stop / Reset", dataset: { stopAudio: "" } }),
      createElement("a", { className: "project-link", href: "/pocket-audio/" }, [
        "Open the full tool",
        createElement("span", { className: "link-arrow", text: "->", "aria-hidden": "true" }),
      ])
    );

    return card;
  }

  function selectHomeProjects(projects) {
    const valid = projects.filter((project) => getPrimaryLink(project));
    const selected = valid
      .filter((project) => getHomepageRank(project) || project.featured === true)
      .sort((a, b) => homepageWeight(a) - homepageWeight(b) || byTitle(a, b));

    if (selected.length < 6) {
      valid
        .filter((project) => !selected.includes(project) && !["Social", "Storefronts"].includes(project.category))
        .sort(bySortThenTitle)
        .forEach((project) => {
          if (selected.length < 6) selected.push(project);
        });
    }

    return selected.slice(0, 6);
  }

  function renderLoadingState() {
    const grid = document.getElementById("featured-grid") || document.getElementById("project-grid");
    if (!grid) return;
    if (gridHasUsefulCards(grid)) return;
    grid.replaceChildren();
    const count = document.body.dataset.page === "home" ? 6 : 4;
    for (let index = 0; index < count; index += 1) {
      grid.append(createElement("div", { className: "skeleton-card", "aria-hidden": "true" }));
    }
  }

  function renderGrid(element, projects, options = {}) {
    const {
      variant = "catalogue",
      emptyMessage = "No matching project records were found. Showing the saved page content instead.",
      preserveExistingOnEmpty = true,
    } = options;
    const { fragment, cardCount } = buildProjectFragment(projects, variant);
    return replaceGridWithBuiltCards(element, fragment, cardCount, emptyMessage, preserveExistingOnEmpty);
  }

  function usePageFallbackIfEmpty(grid, list, predicate, message) {
    if (list.length || gridHasUsefulCards(grid)) return list;
    const fallbackList = getFallbackProjects().filter(predicate).slice().sort(bySortThenTitle);
    if (fallbackList.length) {
      showDataStatus(message, true);
      return fallbackList;
    }
    return list;
  }

  function renderHome(projects) {
    const grid = document.getElementById("featured-grid");
    if (!grid) return;
    const fragment = document.createDocumentFragment();
    let cardCount = 0;
    let selectedProjects = selectHomeProjects(projects);

    if (!selectedProjects.length && !gridHasUsefulCards(grid)) {
      selectedProjects = selectHomeProjects(getFallbackProjects());
      if (selectedProjects.length) {
        showDataStatus("Featured project data is incomplete. Showing saved fallback cards instead.", true);
      }
    }

    selectedProjects.forEach((project, index) => {
      try {
        const card = createProjectCard(project, { variant: "featured", index });
        fragment.append(card);
        cardCount += 1;
        if (index === 0) fragment.append(createMiniLabCard());
      } catch (error) {
        console.warn("Skipping homepage card that could not be rendered:", project?.title || project, error);
      }
    });

    replaceGridWithBuiltCards(grid, fragment, cardCount, "Featured project data is unavailable. Showing the saved page content instead.");
    initializeMiniLabs();
  }

  function getCatalogueConfig(category) {
    return CATALOGUE_FILTER_CONFIG[String(category || "")] || null;
  }

  function getCatalogueGroupRank(project, config) {
    const rank = config.labelOrder.findIndex((label) => project.catalogueLabels.includes(label));
    return rank >= 0 ? rank : config.labelOrder.length;
  }

  function sortCatalogueProjects(projects, sortMode, config) {
    const list = projects.slice();
    if (sortMode === "title") return list.sort(byTitle);
    if (sortMode === "label") {
      return list.sort((a, b) => getCatalogueGroupRank(a, config) - getCatalogueGroupRank(b, config) || byTitle(a, b));
    }
    return list.sort(bySortThenTitle);
  }

  function buildCatalogueStatusMessage({ category, config, filterValue, sortValue, total, visibleCount, loaded }) {
    const labelText = filterValue === "All" ? `All ${config.filterLabelPlural}` : filterValue;
    const sortText = sortValue === "curated" ? "Curated" : sortValue === "title" ? "Title A-Z" : config.sortLabel;
    const noun = String(category || "records").toLowerCase();
    const sourceNote = loaded ? "" : " Saved catalogue data is in use because live data could not be loaded.";

    if (visibleCount === 0) {
      return `No ${noun} match ${labelText}. Sort: ${sortText}.${sourceNote}`;
    }

    return `Showing ${visibleCount} of ${total} ${noun}. Filter: ${labelText}. Sort: ${sortText}.${sourceNote}`;
  }

  function createCatalogueControls(config, filterOptions, state, onFilterChange, onSortChange) {
    if (!catalogueControls) return null;

    const buttons = [createElement("button", {
      className: "filter-btn",
      type: "button",
      text: "All",
      dataset: { filterValue: "All" },
      "aria-controls": "project-grid",
      "aria-pressed": state.filter === "All" ? "true" : "false",
    })];

    filterOptions.forEach((label) => {
      buttons.push(createElement("button", {
        className: "filter-btn",
        type: "button",
        text: label,
        dataset: { filterValue: label },
        "aria-controls": "project-grid",
        "aria-pressed": state.filter === label ? "true" : "false",
      }));
    });

    buttons.forEach((button) => {
      button.addEventListener("click", () => onFilterChange(button.dataset.filterValue || "All"));
    });

    const sortSelect = createElement("select", {
      className: "catalogue-select",
      id: "catalogue-sort",
      "aria-controls": "project-grid",
    }, [
      createElement("option", { value: "curated", text: "Curated" }),
      createElement("option", { value: "title", text: "Title A-Z" }),
      createElement("option", { value: "label", text: config.sortLabel }),
    ]);
    sortSelect.value = state.sort;
    sortSelect.addEventListener("change", (event) => onSortChange(event.target.value));

    const filterRow = createElement("div", { className: "filter-row", role: "group", "aria-label": `${config.filterLabel} filters` }, buttons);
    const panel = createElement("div", { className: "catalogue-controls-panel" }, [
      createElement("div", { className: "catalogue-control-group" }, [
        createElement("p", { className: "catalogue-control-label", text: config.filterLabel }),
        filterRow,
      ]),
      createElement("label", { className: "catalogue-control-group catalogue-control-group-sort", htmlFor: "catalogue-sort" }, [
        createElement("span", { className: "catalogue-control-label", text: "Sort" }),
        sortSelect,
      ]),
    ]);

    catalogueControls.replaceChildren(panel);
    catalogueControls.hidden = false;

    return {
      sync(nextState) {
        buttons.forEach((button) => {
          const active = (button.dataset.filterValue || "All") === nextState.filter;
          button.classList.toggle("active", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        sortSelect.value = nextState.sort;
      },
    };
  }

  function renderCatalogue(projects, context = {}) {
    const grid = document.getElementById("project-grid");
    const spotlightGrid = document.getElementById("spotlight-grid");
    const category = document.body.dataset.category;
    const predicate = (project) => project.category === category;
    const list = usePageFallbackIfEmpty(
      grid,
      projects.filter(predicate).slice().sort(bySortThenTitle),
      predicate,
      `${category || "This catalogue"} data is incomplete. Showing saved fallback cards instead.`
    );
    const config = getCatalogueConfig(category);

    if (spotlightGrid) {
      const spotlight = list.filter((project) => project.featured === true).slice(0, 4);
      renderGrid(spotlightGrid, spotlight, {
        variant: "spotlight",
        emptyMessage: "",
        preserveExistingOnEmpty: false,
      });
      spotlightGrid.closest("[data-spotlight-section]")?.toggleAttribute("hidden", spotlight.length === 0);
    }

    if (!config) {
      if (catalogueControls) {
        catalogueControls.hidden = true;
        catalogueControls.replaceChildren();
      }
      renderGrid(grid, list, {
        emptyMessage: `${category || "This catalogue"} records are unavailable right now. Showing the saved page content instead.`,
      });
      return;
    }

    const filterOptions = config.labelOrder.filter((label) => list.some((project) => project.catalogueLabels.includes(label)));
    const state = { filter: "All", sort: "curated" };
    const controls = createCatalogueControls(
      config,
      filterOptions,
      state,
      (filterValue) => {
        state.filter = filterValue;
        applyCatalogueState();
      },
      (sortValue) => {
        state.sort = sortValue;
        applyCatalogueState();
      }
    );

    function applyCatalogueState() {
      controls?.sync(state);
      const filtered = state.filter === "All" ? list.slice() : list.filter((project) => project.catalogueLabels.includes(state.filter));
      const sorted = sortCatalogueProjects(filtered, state.sort, config);
      const emptyMessage =
        state.filter === "All"
          ? `No ${String(category || "catalogue").toLowerCase()} records are available right now.`
          : `No ${String(category || "catalogue").toLowerCase()} match ${state.filter}.`;

      renderGrid(grid, sorted, {
        emptyMessage,
        preserveExistingOnEmpty: false,
      });
      showDataStatus(
        buildCatalogueStatusMessage({
          category,
          config,
          filterValue: state.filter,
          sortValue: state.sort,
          total: list.length,
          visibleCount: sorted.length,
          loaded: context.loaded !== false,
        }),
        { tone: context.loaded === false ? "warning" : "summary" }
      );
    }

    applyCatalogueState();
  }

  function renderApps(projects) {
    const grid = document.getElementById("project-grid");
    const predicate = (project) => project.category === "Apps & Tools" || project.category === "Assets";
    const list = usePageFallbackIfEmpty(
      grid,
      projects.filter(predicate).slice().sort(bySortThenTitle),
      predicate,
      "App and tool data is incomplete. Showing saved fallback cards instead."
    );
    renderGrid(grid, list, {
      emptyMessage: "App and tool records are unavailable right now. Showing the saved page content instead.",
    });
  }

  function renderPocketAudio(projects) {
    const grid = document.getElementById("project-grid");
    const predicate = (project) => {
      const text = `${project.title} ${project.description} ${project.tags.join(" ")}`.toLowerCase();
      return (project.category === "Apps & Tools" || project.category === "Assets") && text.includes("pocket");
    };
    const list = usePageFallbackIfEmpty(
      grid,
      projects.filter(predicate).slice().sort(bySortThenTitle),
      predicate,
      "Pocket Audio data is incomplete. Showing saved fallback cards instead."
    );
    renderGrid(grid, list, {
      emptyMessage: "Pocket Audio records are unavailable right now. Showing the saved page content instead.",
    });
  }

  function renderLinkGroups() {
    const linkGrid = document.getElementById("link-grid");
    if (!linkGrid) return;
    linkGrid.replaceChildren();
    linkGroups.forEach((group) => {
      const list = createElement("div", { className: "link-group-list" });
      group.links.forEach(([label, url]) => {
        const href = safeUrl(url);
        if (!href) return;
        const anchor = createElement("a", { href }, [label, createElement("span", { text: "->", "aria-hidden": "true" })]);
        if (isExternalUrl(href)) {
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
        }
        list.append(anchor);
      });
      linkGrid.append(createElement("section", { className: "link-group", dataset: { reveal: "" } }, [createElement("h2", { text: group.title }), list]));
    });
  }

  function renderLinks(projects) {
    renderLinkGroups();
    const grid = document.getElementById("project-grid");
    const predicate = (project) => ["Social", "Storefronts"].includes(project.category);
    const list = usePageFallbackIfEmpty(
      grid,
      projects.filter(predicate).slice().sort(bySortThenTitle),
      predicate,
      "Link directory data is incomplete. Showing saved fallback cards instead."
    );
    renderGrid(grid, list, {
      emptyMessage: "Link directory records are unavailable right now. Showing the saved page content instead.",
    });
  }

  function renderPage(projects, context = {}) {
    const page = document.body.dataset.page;
    if (page === "home") renderHome(projects);
    if (page === "catalogue") renderCatalogue(projects, context);
    if (page === "apps") renderApps(projects);
    if (page === "pocket-audio") renderPocketAudio(projects);
    if (page === "links") renderLinks(projects);
  }

  function showDataStatus(message, options = {}) {
    if (!dataStatus) return;
    const normalizedOptions =
      typeof options === "boolean"
        ? { canRetry: options, tone: "warning" }
        : { canRetry: options.canRetry === true, tone: options.tone || "warning" };

    dataStatus.replaceChildren(document.createTextNode(message));
    dataStatus.dataset.state = normalizedOptions.tone;
    if (normalizedOptions.canRetry) {
      const retry = createElement("button", { className: "filter-btn", type: "button", text: "Retry" });
      retry.addEventListener("click", () => window.location.reload());
      dataStatus.append(retry);
    }
    dataStatus.hidden = false;
  }

  function hideDataStatus() {
    if (!dataStatus) return;
    dataStatus.hidden = true;
    delete dataStatus.dataset.state;
    dataStatus.replaceChildren();
  }

  async function fetchJsonWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadProjects() {
    try {
      const data = await fetchJsonWithTimeout(DATA_URL);
      const projects = normalizeProjects(data);
      if (!projects.length) throw new Error("No project records");
      if (document.body.dataset.page !== "catalogue") hideDataStatus();
      return { projects, loaded: true };
    } catch (error) {
      console.warn("Project data could not be loaded:", error);
      showDataStatus("Project data could not be loaded. Saved catalogue cards are still available.", { canRetry: true, tone: "warning" });
      return { projects: normalizeProjects(fallbackProjects), loaded: false };
    }
  }

  function setCurrentYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = year;
    });
  }

  function initializeSiteClock() {
    const clocks = document.querySelectorAll("[data-site-time]");
    if (!clocks.length) return;

    const formatter = new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const updateClock = () => {
      const now = new Date();
      const label = formatter.format(now);
      const datetime = now.toISOString();
      clocks.forEach((clock) => {
        clock.textContent = label;
        clock.setAttribute("datetime", datetime);
        clock.setAttribute("aria-label", `Local time ${label}`);
      });
    };

    updateClock();
    window.setInterval(updateClock, 60000);
  }

  function getFocusable(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
      return !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true";
    });
  }

  function setShellInert(isInert) {
    if (!("inert" in HTMLElement.prototype)) return;
    document.querySelectorAll("body > header, body > main, body > footer").forEach((element) => {
      if (!activeGameOverlay || element !== activeGameOverlay) element.inert = isInert;
    });
  }

  function initializeNavigation() {
    if (navigationReady) return;
    navigationReady = true;
    const toggle = document.querySelector("[data-menu-toggle]");
    const panel = document.querySelector("[data-nav-panel]");
    if (!toggle || !panel) return;
    toggle.setAttribute("aria-label", "Open menu");
    panel.setAttribute("tabindex", "-1");

    const closeMenu = (returnFocus = true) => {
      if (!document.body.classList.contains("nav-menu-open")) return;
      document.body.classList.remove("nav-menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      if ("inert" in HTMLElement.prototype) {
        document.querySelectorAll("main, footer").forEach((element) => {
          element.inert = false;
        });
      }
      if (returnFocus) toggle.focus();
    };

    const openMenu = () => {
      document.body.classList.add("nav-menu-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      if ("inert" in HTMLElement.prototype) {
        document.querySelectorAll("main, footer").forEach((element) => {
          element.inert = true;
        });
      }
      const focusMenu = () => {
        if (!document.body.classList.contains("nav-menu-open")) return;
        const first = getFocusable(panel)[0];
        const target = first || panel;
        target.focus({ preventScroll: true });
        if (!panel.contains(document.activeElement)) {
          panel.focus({ preventScroll: true });
        }
      };
      toggle.blur();
      focusMenu();
      requestAnimationFrame(focusMenu);
      window.setTimeout(focusMenu, 280);
      window.setTimeout(focusMenu, 560);
    };

    toggle.addEventListener("click", () => {
      if (document.body.classList.contains("nav-menu-open")) closeMenu();
      else openMenu();
    });

    panel.addEventListener("click", (event) => {
      if (event.target.closest("a, [data-surprise]")) closeMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (!document.body.classList.contains("nav-menu-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable(panel);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (finePointer.matches) closeMenu(false);
    });
  }

  function initializeSurprise(projects, dataLoaded) {
    const buttons = document.querySelectorAll("[data-surprise]");
    const candidates = projects
      .map((project) => ({ project, link: getPrimaryLink(project) }))
      .filter(({ link }) => link && safeUrl(link.url));

    buttons.forEach((button) => {
      button.disabled = !dataLoaded || candidates.length === 0;
      button.setAttribute("aria-label", dataLoaded ? "Surprise me with a Samfa12 project" : "Surprise me unavailable while project data is offline");
      button.title = dataLoaded ? "" : "Project data is offline";
      button.onclick = () => {
        if (!dataLoaded || candidates.length === 0) return;
        const previous = sessionStorage.getItem("samfa12:lastSurprise");
        const currentPath = window.location.pathname.replace(/\/index\.html$/, "/");
        let pool = candidates.filter(({ link }) => {
          const url = new URL(link.url, window.location.origin);
          return url.href !== previous && url.pathname !== currentPath;
        });

        if (!pool.length) {
          pool = candidates.filter(({ link }) => new URL(link.url, window.location.origin).href !== previous);
        }
        if (!pool.length) pool = candidates;

        const choice = pool[Math.floor(Math.random() * pool.length)];
        const destination = new URL(choice.link.url, window.location.origin).href;
        sessionStorage.setItem("samfa12:lastSurprise", destination);
        window.location.assign(destination);
      };
    });
  }

  function initializeMiniLabs() {
    document.querySelectorAll("[data-pocket-mini-lab]").forEach((root) => {
      if (root.dataset.ready === "true") return;
      root.dataset.ready = "true";
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const pads = Array.from(root.querySelectorAll(".audio-pad"));
      const stopButton = root.querySelector("[data-stop-audio]");
      const demoLoops = {
        lofi: {
          bpm: 82,
          swing: 0.11,
          padWave: "triangle",
          bassWave: "sine",
          leadWave: "triangle",
          padGain: 0.026,
          bassGain: 0.07,
          leadGain: 0.045,
          filterFreq: 1450,
          chords: [
            [57, 60, 64, 67],
            [53, 57, 60, 64],
            [55, 59, 62, 65],
            [52, 55, 59, 64],
          ],
          bass: [45, null, 45, 52, 41, null, 48, 41, 43, null, 50, 43, 40, null, 47, 40],
          melody: [
            [2, 72, 2],
            [6, 69, 2],
            [10, 67, 2],
            [18, 69, 2],
            [22, 64, 4],
            [34, 71, 2],
            [38, 67, 3],
            [50, 64, 2],
            [56, 60, 4],
          ],
          kickSteps: [0, 10, 24, 32, 42, 56],
          snareSteps: [16, 48],
          hatSteps: [4, 12, 20, 28, 36, 44, 52, 60],
        },
        chip: {
          bpm: 142,
          swing: 0,
          padWave: "square",
          bassWave: "triangle",
          leadWave: "square",
          padGain: 0.017,
          bassGain: 0.06,
          leadGain: 0.04,
          filterFreq: 6200,
          chords: [
            [60, 64, 67],
            [65, 69, 72],
            [67, 71, 74],
            [60, 67, 72],
          ],
          bass: [48, 48, 55, 55, 53, 53, 60, 60, 55, 55, 62, 62, 48, 48, 55, 47],
          melody: [
            [0, 72, 1],
            [2, 76, 1],
            [4, 79, 2],
            [8, 76, 1],
            [10, 72, 1],
            [12, 84, 2],
            [18, 77, 1],
            [20, 81, 1],
            [22, 84, 2],
            [28, 79, 2],
            [32, 83, 1],
            [34, 86, 1],
            [36, 79, 2],
            [42, 74, 1],
            [44, 76, 1],
            [48, 72, 2],
            [56, 79, 2],
            [60, 84, 2],
          ],
          kickSteps: [0, 8, 24, 32, 40, 56],
          snareSteps: [16, 48],
          hatSteps: Array.from({ length: 32 }, (_, index) => index * 2),
        },
        western: {
          bpm: 104,
          swing: 0.04,
          padWave: "sawtooth",
          bassWave: "triangle",
          leadWave: "sawtooth",
          padGain: 0.018,
          bassGain: 0.07,
          leadGain: 0.038,
          filterFreq: 2600,
          chords: [
            [50, 57, 62, 66],
            [55, 59, 62, 67],
            [57, 61, 64, 69],
            [50, 57, 62, 66],
          ],
          bass: [38, 45, 38, 45, 43, 50, 43, 50, 45, 52, 45, 52, 38, 45, 38, 45],
          melody: [
            [0, 74, 2],
            [4, 76, 2],
            [8, 78, 2],
            [12, 74, 2],
            [18, 71, 2],
            [22, 74, 2],
            [26, 67, 2],
            [32, 76, 2],
            [36, 78, 2],
            [40, 81, 2],
            [48, 74, 2],
            [54, 69, 2],
            [58, 66, 3],
          ],
          kickSteps: [0, 8, 16, 24, 32, 40, 48, 56],
          snareSteps: [4, 12, 20, 28, 36, 44, 52, 60],
          hatSteps: [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62],
        },
        standard: {
          bpm: 112,
          swing: 0.02,
          padWave: "triangle",
          bassWave: "sawtooth",
          leadWave: "sine",
          padGain: 0.023,
          bassGain: 0.062,
          leadGain: 0.04,
          filterFreq: 3200,
          chords: [
            [60, 64, 67],
            [55, 59, 62],
            [57, 60, 64],
            [53, 57, 60],
          ],
          bass: [48, null, 48, 55, 43, null, 50, 43, 45, null, 52, 45, 41, null, 48, 41],
          melody: [
            [0, 67, 2],
            [4, 72, 2],
            [8, 71, 2],
            [12, 67, 2],
            [18, 69, 2],
            [22, 67, 2],
            [26, 62, 2],
            [32, 64, 2],
            [36, 67, 2],
            [40, 72, 2],
            [48, 69, 3],
            [54, 67, 2],
            [58, 64, 3],
          ],
          kickSteps: [0, 8, 24, 32, 40, 56],
          snareSteps: [16, 48],
          hatSteps: Array.from({ length: 16 }, (_, index) => index * 4 + 2),
        },
      };
      let context = null;
      let masterGain = null;
      let noiseBuffer = null;
      let activeNodes = [];
      let activeTimers = [];
      let activeDemo = "";

      const midiToFrequency = (note) => 440 * 2 ** ((note - 69) / 12);

      const getContext = async () => {
        context = context || new AudioContextCtor();
        if (!masterGain) {
          masterGain = context.createGain();
          masterGain.gain.setValueAtTime(0.78, context.currentTime);
          masterGain.connect(context.destination);
        }
        if (context.state === "suspended") await context.resume();
        return context;
      };

      const getNoiseBuffer = () => {
        if (noiseBuffer) return noiseBuffer;
        const length = Math.max(1, Math.floor(context.sampleRate));
        noiseBuffer = context.createBuffer(1, length, context.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let index = 0; index < length; index += 1) {
          data[index] = Math.random() * 2 - 1;
        }
        return noiseBuffer;
      };

      const trackNode = (source, gain, startTime) => {
        const node = { source, gain, startTime };
        activeNodes.push(node);
        source.addEventListener("ended", () => {
          activeNodes = activeNodes.filter((item) => item !== node);
        });
      };

      const scheduleTone = ({ note, frequency, time, duration, type = "sine", gain = 0.04, attack = 0.01, release = 0.08, detune = 0, filterFreq = 4200 }) => {
        const oscillator = context.createOscillator();
        const noteGain = context.createGain();
        const filter = context.createBiquadFilter();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency || midiToFrequency(note), time);
        oscillator.detune.setValueAtTime(detune, time);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(filterFreq, time);
        filter.Q.setValueAtTime(0.8, time);
        noteGain.gain.setValueAtTime(0.0001, time);
        noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), time + attack);
        noteGain.gain.setTargetAtTime(0.0001, time + Math.max(attack, duration), release);
        oscillator.connect(filter).connect(noteGain).connect(masterGain);
        oscillator.start(time);
        oscillator.stop(time + duration + release * 4);
        trackNode(oscillator, noteGain, time);
      };

      const scheduleNoise = ({ time, duration, gain = 0.03, filterType = "highpass", filterFreq = 5200, q = 0.7 }) => {
        const source = context.createBufferSource();
        const noiseGain = context.createGain();
        const filter = context.createBiquadFilter();
        source.buffer = getNoiseBuffer();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, time);
        filter.Q.setValueAtTime(q, time);
        noiseGain.gain.setValueAtTime(0.0001, time);
        noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), time + 0.006);
        noiseGain.gain.setTargetAtTime(0.0001, time + duration, 0.025);
        source.connect(filter).connect(noiseGain).connect(masterGain);
        source.start(time, 0, duration + 0.1);
        source.stop(time + duration + 0.12);
        trackNode(source, noiseGain, time);
      };

      const scheduleKick = (time) => {
        const oscillator = context.createOscillator();
        const kickGain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(120, time);
        oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.18);
        kickGain.gain.setValueAtTime(0.0001, time);
        kickGain.gain.exponentialRampToValueAtTime(0.16, time + 0.008);
        kickGain.gain.setTargetAtTime(0.0001, time + 0.12, 0.045);
        oscillator.connect(kickGain).connect(masterGain);
        oscillator.start(time);
        oscillator.stop(time + 0.42);
        trackNode(oscillator, kickGain, time);
      };

      const scheduleSnare = (time, western = false) => {
        scheduleNoise({ time, duration: western ? 0.075 : 0.11, gain: western ? 0.025 : 0.04, filterType: "bandpass", filterFreq: western ? 2400 : 1800, q: 1.1 });
        scheduleTone({ frequency: western ? 180 : 210, time, duration: 0.055, type: "triangle", gain: western ? 0.018 : 0.025, release: 0.035, filterFreq: 1200 });
      };

      const stepTime = (loopStart, step, stepLength, swing) => loopStart + step * stepLength + (step % 2 === 1 ? swing * stepLength : 0);

      const scheduleFourBars = (loopStart, demoId) => {
        const demo = demoLoops[demoId] || demoLoops.standard;
        const beatLength = 60 / demo.bpm;
        const stepLength = beatLength / 4;
        const loopLength = beatLength * 16;

        demo.chords.forEach((chord, barIndex) => {
          const chordTime = loopStart + barIndex * beatLength * 4;
          chord.forEach((note, noteIndex) => {
            scheduleTone({
              note,
              time: chordTime + noteIndex * 0.012,
              duration: beatLength * 3.7,
              type: demo.padWave,
              gain: demo.padGain,
              attack: demoId === "chip" ? 0.01 : 0.08,
              release: demoId === "chip" ? 0.05 : 0.32,
              detune: (noteIndex - 1) * (demoId === "lofi" ? 5 : 2),
              filterFreq: demo.filterFreq,
            });
          });
        });

        demo.bass.forEach((note, beatIndex) => {
          if (note === null) return;
          scheduleTone({
            note,
            time: loopStart + beatIndex * beatLength,
            duration: beatLength * (demoId === "western" ? 0.42 : 0.58),
            type: demo.bassWave,
            gain: demo.bassGain,
            attack: 0.008,
            release: 0.07,
            filterFreq: demoId === "chip" ? 3600 : 1400,
          });
        });

        demo.melody.forEach(([step, note, durationSteps]) => {
          scheduleTone({
            note,
            time: stepTime(loopStart, step, stepLength, demo.swing),
            duration: Math.max(stepLength * 0.8, durationSteps * stepLength * 0.86),
            type: demo.leadWave,
            gain: demo.leadGain,
            attack: demoId === "western" ? 0.006 : 0.012,
            release: demoId === "lofi" ? 0.16 : 0.07,
            detune: demoId === "western" ? 6 : 0,
            filterFreq: demoId === "western" ? 2200 : demo.filterFreq,
          });
        });

        demo.kickSteps.forEach((step) => scheduleKick(stepTime(loopStart, step, stepLength, demo.swing)));
        demo.snareSteps.forEach((step) => scheduleSnare(stepTime(loopStart, step, stepLength, demo.swing), demoId === "western"));
        demo.hatSteps.forEach((step) => {
          scheduleNoise({
            time: stepTime(loopStart, step, stepLength, demo.swing),
            duration: demoId === "lofi" ? 0.045 : 0.032,
            gain: demoId === "chip" ? 0.022 : 0.017,
            filterType: "highpass",
            filterFreq: demoId === "western" ? 3600 : 6200,
            q: 0.8,
          });
        });

        return loopLength;
      };

      const queueNextLoop = (loopStart, demoId) => {
        const demo = demoLoops[demoId] || demoLoops.standard;
        const loopLength = (60 / demo.bpm) * 16;
        const delay = Math.max(0, (loopStart - context.currentTime - 0.25) * 1000);
        const timer = window.setTimeout(() => {
          if (activeDemo !== demoId) return;
          scheduleFourBars(loopStart, demoId);
          queueNextLoop(loopStart + loopLength, demoId);
        }, delay);
        activeTimers.push(timer);
      };

      const stopAll = () => {
        activeTimers.forEach((timer) => window.clearTimeout(timer));
        activeTimers = [];
        activeDemo = "";
        root.dataset.playing = "false";
        root.dataset.currentTone = "";
        activeNodes.forEach(({ source, gain, startTime }) => {
          try {
            const now = context?.currentTime || 0;
            gain?.gain.cancelScheduledValues(now);
            gain?.gain.setTargetAtTime(0.0001, now, 0.02);
            source?.stop(Math.max(now + 0.08, (startTime || now) + 0.001));
          } catch {
            // Already stopped.
          }
        });
        activeNodes = [];
        pads.forEach((pad) => pad.setAttribute("aria-pressed", "false"));
        if (stopButton) stopButton.disabled = true;
      };

      if (!AudioContextCtor) {
        pads.forEach((pad) => {
          pad.disabled = true;
          pad.title = "Web Audio is not supported in this browser";
        });
        if (stopButton) stopButton.disabled = true;
        return;
      }
      if (stopButton) stopButton.disabled = true;

      const playLoop = async (button) => {
        await getContext();
        stopAll();
        await getContext();

        const demoId = button.dataset.tone || "standard";
        activeDemo = demoId;
        root.dataset.playing = "true";
        root.dataset.currentTone = demoId;
        pads.forEach((pad) => pad.setAttribute("aria-pressed", String(pad === button)));
        if (stopButton) stopButton.disabled = false;

        const startTime = context.currentTime + 0.08;
        const loopLength = scheduleFourBars(startTime, demoId);
        queueNextLoop(startTime + loopLength, demoId);
      };

      pads.forEach((button) => button.addEventListener("click", () => playLoop(button)));
      stopButton?.addEventListener("click", stopAll);
      window.addEventListener("pagehide", stopAll);
    });
  }

  function initializeReveals(root = document) {
    const elements = root.querySelectorAll(".section, .page-hero, .project-card, .mini-lab-card, .nav-tile, .workflow-card, .link-group");
    elements.forEach((element) => {
      if (!element.hasAttribute("data-reveal")) element.setAttribute("data-reveal", "");
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.96 && rect.bottom > 0) {
        element.classList.add("is-visible");
      }
    });
    document.documentElement.classList.add("reveal-ready");

    if (reducedMotion.matches || typeof window.IntersectionObserver !== "function") {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
    }

    elements.forEach((element) => {
      if (element.classList.contains("is-visible")) return;
      revealObserver.observe(element);
    });

    window.setTimeout(() => {
      elements.forEach((element) => element.classList.add("is-visible"));
    }, 1400);
  }

  function initializePointerGlow(root = document) {
    if (!finePointer.matches || reducedMotion.matches) return;
    root.querySelectorAll(".project-card-featured").forEach((card) => {
      if (card.dataset.pointerGlowReady === "true") return;
      card.dataset.pointerGlowReady = "true";
      let frame = 0;
      card.addEventListener(
        "pointermove",
        (event) => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
            card.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
            frame = 0;
          });
        },
        { passive: true }
      );
    });
  }

  function initializeHeroParallax() {
    const zone = document.querySelector("[data-parallax-zone]");
    if (!zone || !finePointer.matches || reducedMotion.matches) return;
    const nodes = Array.from(zone.querySelectorAll("[data-depth]"));
    let frame = 0;

    zone.addEventListener(
      "pointermove",
      (event) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          const rect = zone.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          nodes.forEach((node) => {
            const depth = Number(node.dataset.depth) || 0.4;
            node.style.translate = `${(x * depth * 10).toFixed(2)}px ${(y * depth * 10).toFixed(2)}px`;
          });
          frame = 0;
        });
      },
      { passive: true }
    );

    zone.addEventListener("pointerleave", () => {
      nodes.forEach((node) => {
        node.style.translate = "";
      });
    });
  }

  function closeFullscreenGameOverlay() {
    if (!activeGameOverlay) return;
    const overlay = activeGameOverlay;
    activeGameOverlay = null;
    document.body.classList.remove("game-fullscreen-open");
    setShellInert(false);
    if (document.fullscreenElement === overlay) {
      document.exitFullscreen().catch(() => {});
    }
    overlay.remove();
    activeGameLauncher?.focus();
    activeGameLauncher = null;
  }

  function openFullscreenGame(url, title, launcher) {
    closeFullscreenGameOverlay();
    activeGameLauncher = launcher;

    const overlay = createElement("div", {
      className: "fullscreen-game-shell",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `${title} game player`,
    });
    const closeButton = createElement("button", { className: "fullscreen-game-close", type: "button", text: "Close" });
    const frameWrap = createElement("div", { className: "fullscreen-game-frame-wrap" });
    const status = createElement("p", { className: "fullscreen-game-status", role: "status", text: "Loading game..." });
    const iframe = createElement("iframe", {
      title,
      src: url,
      allow: "fullscreen; gamepad",
      loading: "eager",
    });

    frameWrap.append(status, iframe);
    overlay.append(
      createElement("div", { className: "fullscreen-game-toolbar" }, [
        createElement("p", { className: "fullscreen-game-title", text: title }),
        closeButton,
      ]),
      frameWrap
    );

    closeButton.addEventListener("click", closeFullscreenGameOverlay);
    iframe.addEventListener("load", () => frameWrap.classList.add("is-loaded"));
    iframe.addEventListener("error", () => {
      status.textContent = "This browser could not load the game. Try opening it as a normal page.";
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFullscreenGameOverlay();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable(overlay);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.body.appendChild(overlay);
    activeGameOverlay = overlay;
    document.body.classList.add("game-fullscreen-open");
    setShellInert(true);
    requestAnimationFrame(() => closeButton.focus());

    if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(() => {
        // The fixed dialog remains full-window when browser fullscreen is blocked.
      });
    }
  }

  function initializeGameOverlay() {
    if (overlayReady) return;
    overlayReady = true;
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element) || !canUseFullscreenOverlay()) return;
      const link = event.target.closest("[data-fullscreen-game]");
      if (!link) return;
      event.preventDefault();
      const url = safeUrl(link.getAttribute("href"));
      if (!url) return;
      openFullscreenGame(url, link.dataset.projectTitle || link.textContent.trim() || "Game", link);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeGameOverlay) {
        event.preventDefault();
        closeFullscreenGameOverlay();
      }
    });
  }

  async function initialize() {
    document.documentElement.classList.add("js-enhanced");
    setCurrentYear();
    initializeSiteClock();
    initializeNavigation();
    initializeAnalyticsPreferences();
    initializeGameOverlay();
    initializeReveals();
    renderLoadingState();

    const primaryGrid = document.getElementById("featured-grid") || document.getElementById("project-grid");
    const hasSavedCards = gridHasUsefulCards(primaryGrid);
    const { projects, loaded } = await loadProjects();
    if (loaded || !hasSavedCards) {
      renderPage(projects, { loaded });
    } else {
      initializeReveals(primaryGrid);
    }
    initializeSurprise(projects, loaded);
    initializeMiniLabs();
    initializePointerGlow();
    initializeHeroParallax();
  }

  initialize();
})();
