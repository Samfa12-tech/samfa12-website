(() => {
  const DATA_VERSION = "20260621-1";
  const DATA_URL = `/data/projects.json?v=${DATA_VERSION}`;
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  let activeGameOverlay = null;
  let activeGameLauncher = null;
  let navigationReady = false;
  let overlayReady = false;

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

    return {
      ...project,
      title: String(project.title),
      category: String(project.category || "Uncategorized"),
      type: String(project.type || "Project"),
      status: String(project.status || "Available"),
      description: String(project.description || ""),
      tags: Array.isArray(project.tags) ? project.tags.filter((tag) => typeof tag === "string" && tag.trim()) : [],
      links,
    };
  }

  function normalizeProjects(projects) {
    return Array.isArray(projects) ? projects.map(normalizeProject).filter(Boolean) : [];
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
      src: rootRelativePath(thumbnail),
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

    if (link.fullscreen === true && !isExternalUrl(href)) {
      anchor.dataset.fullscreenGame = href;
      anchor.classList.add("project-play-link");
    }

    anchor.append(link.label, createElement("span", { className: "link-arrow", text: "->", "aria-hidden": "true" }));
    return anchor;
  }

  function createProjectCard(project, options = {}) {
    const { variant = "catalogue", index = 0 } = options;
    const isFeatured = variant === "featured";
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
      projectThumbnail(project, isFeatured && index === 0),
      createElement("p", {
        className: "project-label",
        text: `${project.type}${isFeatured ? ` // ${project.category}` : ""}`,
      }),
      createElement("h3", { text: project.title }),
      createElement("p", { className: "card-description", text: project.description }),
    ]);

    const meta = createElement("p", { className: "project-meta" }, [
      createElement("span", { className: `pill ${getStatusClass(project.status)}`, text: project.status }),
    ]);
    article.append(meta);

    if (primaryLink) {
      const actions = createElement("div", { className: "project-actions", "aria-label": `${project.title} links` });
      actions.append(projectLink(primaryLink, project, true));

      if (!isFeatured) {
        project.links.slice(1).forEach((link) => {
          const node = projectLink(link, project, false);
          if (node) actions.append(node);
        });
      }

      article.append(actions);
    }

    if (!isFeatured && project.tags.length) {
      const tags = createElement("p", { className: "project-meta" });
      project.tags.slice(0, 5).forEach((tag) => tags.append(createElement("span", { className: "pill", text: tag })));
      article.append(tags);
    }

    return article;
  }

  function createMiniLabCard() {
    const pads = [
      ["DREAM", "dream"],
      ["DRIFT", "drift"],
      ["PULSE", "pulse"],
      ["LIFT", "lift"],
    ];
    const card = createElement("article", { className: "mini-lab-card", dataset: { pocketMiniLab: "", reveal: "" } }, [
      createElement("p", { className: "project-label", text: "Pocket Audio // Mini lab" }),
      createElement("h3", { text: "Tap a signal to hear it." }),
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
    grid.replaceChildren();
    const count = document.body.dataset.page === "home" ? 6 : 4;
    for (let index = 0; index < count; index += 1) {
      grid.append(createElement("div", { className: "skeleton-card", "aria-hidden": "true" }));
    }
  }

  function renderGrid(element, projects, variant = "catalogue") {
    if (!element) return;
    element.replaceChildren();
    projects.forEach((project, index) => element.append(createProjectCard(project, { variant, index })));
  }

  function renderHome(projects) {
    const grid = document.getElementById("featured-grid");
    if (!grid) return;
    grid.replaceChildren();

    selectHomeProjects(projects).forEach((project, index) => {
      grid.append(createProjectCard(project, { variant: "featured", index }));
      if (index === 0) grid.append(createMiniLabCard());
    });
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
    const list = projects
      .filter((project) => {
        const text = `${project.title} ${project.description} ${project.tags.join(" ")}`.toLowerCase();
        return (project.category === "Apps & Tools" || project.category === "Assets") && text.includes("pocket");
      })
      .slice()
      .sort(bySortThenTitle);
    renderGrid(grid, list);
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
    const list = projects
      .filter((project) => ["Social", "Storefronts"].includes(project.category))
      .slice()
      .sort(bySortThenTitle);
    renderGrid(grid, list);
  }

  function renderPage(projects) {
    const page = document.body.dataset.page;
    if (page === "home") renderHome(projects);
    if (page === "catalogue") renderCatalogue(projects);
    if (page === "apps") renderApps(projects);
    if (page === "pocket-audio") renderPocketAudio(projects);
    if (page === "links") renderLinks(projects);
  }

  function showDataStatus(message, canRetry = false) {
    if (!dataStatus) return;
    dataStatus.replaceChildren(document.createTextNode(message));
    if (canRetry) {
      const retry = createElement("button", { className: "filter-btn", type: "button", text: "Retry" });
      retry.addEventListener("click", () => window.location.reload());
      dataStatus.append(retry);
    }
    dataStatus.hidden = false;
  }

  async function loadProjects() {
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const projects = normalizeProjects(data);
      if (!projects.length) throw new Error("No project records");
      return { projects, loaded: true };
    } catch {
      showDataStatus("Project data could not be loaded. Static navigation still works, and fallback cards are shown for preview.", true);
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
    panel.setAttribute("tabindex", "-1");

    const closeMenu = (returnFocus = true) => {
      if (!document.body.classList.contains("nav-menu-open")) return;
      document.body.classList.remove("nav-menu-open");
      toggle.setAttribute("aria-expanded", "false");
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
      const tones = {
        dream: [261.63, 329.63, 392.0],
        drift: [220.0, 277.18, 329.63],
        pulse: [196.0, 246.94, 392.0],
        lift: [293.66, 369.99, 440.0],
      };
      let context = null;
      let activeNodes = [];

      const stopAll = () => {
        activeNodes.forEach(({ oscillator, gain }) => {
          try {
            const now = context?.currentTime || 0;
            gain?.gain.cancelScheduledValues(now);
            gain?.gain.setTargetAtTime(0.0001, now, 0.02);
            oscillator?.stop(now + 0.08);
          } catch {
            // Already stopped.
          }
        });
        activeNodes = [];
        pads.forEach((pad) => pad.setAttribute("aria-pressed", "false"));
      };

      if (!AudioContextCtor) {
        pads.forEach((pad) => {
          pad.disabled = true;
          pad.title = "Web Audio is not supported in this browser";
        });
        if (stopButton) stopButton.disabled = true;
        return;
      }

      const playTone = async (button) => {
        context = context || new AudioContextCtor();
        if (context.state === "suspended") await context.resume();

        const tone = button.dataset.tone;
        const frequencies = tones[tone] || tones.dream;
        const now = context.currentTime;
        button.setAttribute("aria-pressed", "true");

        frequencies.forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = index === 1 ? "triangle" : "sine";
          oscillator.frequency.setValueAtTime(frequency, now);
          oscillator.detune.setValueAtTime((index - 1) * 4, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.045, now + 0.035);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(now);
          oscillator.stop(now + 0.9);
          activeNodes.push({ oscillator, gain });
          oscillator.addEventListener("ended", () => {
            activeNodes = activeNodes.filter((node) => node.oscillator !== oscillator);
          });
        });

        window.setTimeout(() => button.setAttribute("aria-pressed", "false"), 520);
      };

      pads.forEach((button) => button.addEventListener("click", () => playTone(button)));
      stopButton?.addEventListener("click", stopAll);
      window.addEventListener("pagehide", stopAll);
    });
  }

  function initializeReveals() {
    const elements = document.querySelectorAll(".section, .page-hero, .project-card, .mini-lab-card, .nav-tile, .workflow-card, .link-group");
    elements.forEach((element) => {
      if (!element.hasAttribute("data-reveal")) element.setAttribute("data-reveal", "");
    });

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    elements.forEach((element) => observer.observe(element));
  }

  function initializePointerGlow() {
    if (!finePointer.matches || reducedMotion.matches) return;
    document.querySelectorAll(".project-card-featured").forEach((card) => {
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
    initializeGameOverlay();
    renderLoadingState();

    const { projects, loaded } = await loadProjects();
    renderPage(projects);
    initializeSurprise(projects, loaded);
    initializeMiniLabs();
    initializeReveals();
    initializePointerGlow();
    initializeHeroParallax();
  }

  initialize();
})();
