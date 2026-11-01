(() => {
  const root = document.querySelector("[data-book-trailer]");
  if (!root) return;
  const button = root.querySelector("[data-trailer-play]");
  const video = root.querySelector("[data-trailer-video]");
  const poster = root.querySelector("[data-trailer-poster]");
  const status = root.querySelector("[data-trailer-status]");
  const fallback = root.querySelector("[data-trailer-fallback]");
  button.hidden = false;
  button.addEventListener("click", () => {
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    video.dataset.layout = portrait ? "portrait" : "landscape";
    video.src = portrait ? "/assets/videos/no-wall-to-hold-portrait.mp4" : "/assets/videos/no-wall-to-hold-landscape.mp4";
    video.hidden = false;
    poster.hidden = true;
    button.hidden = true;
    video.focus();
    status.textContent = "";
    video.play().catch(() => { status.textContent = "Use the video controls to play the trailer."; });
  }, { once: true });
  video.addEventListener("error", () => { status.textContent = "The trailer could not be loaded. Try opening a video directly."; fallback.hidden = false; });
})();
