(() => {
  "use strict";
  document.querySelectorAll("[data-theme-player]").forEach((root) => {
    const audio = root.querySelector("audio");
    const button = root.querySelector("[data-theme-toggle]");
    const controls = root.querySelector("[data-theme-controls]");
    const status = root.querySelector("[data-theme-status]");
    if (!audio || !button || !controls || !status) return;
    let wanted = false;
    let attempt = 0;
    let timer;
    const render = () => {
      button.textContent = wanted ? "Pause island theme" : "Listen to the island theme";
      button.setAttribute("aria-pressed", String(wanted));
    };
    const stop = (message = "") => {
      wanted = false;
      attempt += 1;
      window.clearTimeout(timer);
      audio.pause();
      status.textContent = message;
      render();
    };
    const failed = () => stop("The island theme could not play. Please try again.");
    button.addEventListener("click", () => {
      if (wanted) { stop("Paused."); return; }
      // The homepage's live demo has its own Stop / Reset control.
      document.querySelectorAll("[data-stop-audio]").forEach((control) => control.click());
      document.querySelectorAll("audio, video").forEach((media) => {
        if (media !== audio) media.pause();
      });
      if (audio.error) audio.load();
      wanted = true;
      const current = ++attempt;
      status.textContent = "Loading island theme…";
      render();
      timer = window.setTimeout(() => { if (current === attempt) failed(); }, 15000);
      // Keep play() inside this click: mobile browsers require a user gesture.
      try {
        Promise.resolve(audio.play()).then(() => {
          if (!wanted) audio.pause();
          if (current !== attempt) return;
          window.clearTimeout(timer);
          status.textContent = "Playing island theme.";
        }).catch(() => { if (current === attempt) failed(); });
      } catch { if (current === attempt) failed(); }
    });
    audio.addEventListener("pause", () => {
      if (audio.paused && wanted) stop("Paused.");
    });
    audio.addEventListener("ended", () => stop("Finished."));
    audio.addEventListener("error", () => { if (wanted) failed(); });
    window.addEventListener("pagehide", () => stop());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
    });
    // Native controls remain available when JavaScript is unavailable.
    audio.controls = false;
    audio.hidden = true;
    controls.hidden = false;
    render();
  });
})();
