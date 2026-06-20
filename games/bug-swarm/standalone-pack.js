(() => {
  const SETTINGS_KEY = "bug_flood_standalone_settings_v1";
  const defaults = { audio: true, motion: true, musicVolume: 80 };
  function clampPercent(value, fallback = defaults.musicVolume) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
  }
  function loadSettings() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
      return { ...defaults };
    }
  }
  function saveSettings(nextSettings) {
    const merged = { ...loadSettings(), ...nextSettings };
    merged.musicVolume = clampPercent(merged.musicVolume);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged)); } catch {}
    Object.assign(settings, merged);
    return settings;
  }
  const settings = loadSettings();
  settings.musicVolume = clampPercent(settings.musicVolume);
  window.Samfa12Pack = {
    SETTINGS_KEY,
    settings,
    loadSettings,
    saveSettings,
    audioEnabled: () => loadSettings().audio !== false,
    motionEnabled: () => loadSettings().motion !== false,
    musicVolumePercent: () => clampPercent(loadSettings().musicVolume),
    setMusicVolume: (value) => saveSettings({ musicVolume: clampPercent(value) }),
    musicLevel: () => {
      const current = loadSettings();
      return current.audio === false ? 0 : clampPercent(current.musicVolume) / 100;
    },
  };
})();