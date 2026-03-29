const DEFAULT_VOLUME = 100;
const MIN_VOLUME = 0;
const MAX_VOLUME = 600;

const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const modeBadge = document.getElementById("modeBadge");
const statusEl = document.getElementById("status");
const resetButton = document.getElementById("resetButton");
const muteButton = document.getElementById("muteButton");
const presetButtons = Array.from(document.querySelectorAll(".preset"));
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const settingsClose = document.getElementById("settingsClose");
const darkModeToggle = document.getElementById("darkModeToggle");
const themeOptions = Array.from(document.querySelectorAll(".theme-option"));
const bugLink = document.getElementById("bugLink");
const confirmOverlay = document.getElementById("confirmOverlay");
const confirmCancel = document.getElementById("confirmCancel");
const confirmProceed = document.getElementById("confirmProceed");
const panel = document.querySelector(".panel");
const unsupportedOverlay = document.getElementById("unsupportedOverlay");

const THEME_STORAGE_KEY = "uiTheme";
const ACCENT_STORAGE_KEY = "accentTheme";
const DEFAULT_ACCENT_THEME = "amber";
const BUG_REPORT_URL = "https://github.com";
const STATUS_MESSAGES = {
  ready: "Ready.",
  active: "Volume control is active for this tab.",
  applied: "Applied to audio elements.",
  pending: "Will apply as soon as media starts.",
  changedError: "Volume could not be changed.",
  muteFailed: "Mute toggle failed.",
  muted: "Tab muted.",
  restored: "Audio restored.",
  darkOn: "Dark mode enabled.",
  darkOff: "Dark mode disabled.",
  accentSaved: "Accent color updated.",
  accentError: "Accent color could not be saved."
};

let activeTabId = null;
let currentVolume = DEFAULT_VOLUME;
let isMuted = false;
let currentTheme = "light";
let currentAccentTheme = DEFAULT_ACCENT_THEME;

function clampVolume(value) {
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, Math.round(value)));
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "var(--danger)" : "";
}

function updateBadge(volume) {
  if (isMuted || volume === 0) {
    modeBadge.textContent = "Muted";
    return;
  }

  if (volume === DEFAULT_VOLUME) {
    modeBadge.textContent = "Normal";
    return;
  }

  if (volume < DEFAULT_VOLUME) {
    modeBadge.textContent = "Lower";
    return;
  }

  modeBadge.textContent = "Boost";
}

function updatePresets(volume) {
  presetButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.volume) === volume);
  });
}

function getVolumeColor(volume) {
  if (volume <= 100) {
    return "#2f9e44";
  }

  if (volume <= 200) {
    const ratio = (volume - 100) / 100;
    const hue = 60 - ratio * 28;
    const lightness = 52 - ratio * 6;
    return `hsl(${hue} 85% ${lightness}%)`;
  }

  const ratio = Math.min(1, (volume - 200) / 400);
  const lightness = 48 - ratio * 18;
  return `hsl(0 72% ${lightness}%)`;
}

function updateUi(volume, muted) {
  currentVolume = clampVolume(volume);
  isMuted = Boolean(muted);
  volumeSlider.value = String(currentVolume);
  volumeValue.textContent = `${currentVolume}%`;
  volumeValue.style.color = getVolumeColor(currentVolume);
  muteButton.textContent = isMuted || currentVolume === 0 ? "Unmute" : "Mute";
  muteButton.classList.toggle("is-alert", isMuted || currentVolume === 0);
  updateBadge(currentVolume);
  updatePresets(currentVolume);
}

function setControlsDisabled(isDisabled) {
  volumeSlider.disabled = isDisabled;
  resetButton.disabled = isDisabled;
  muteButton.disabled = isDisabled;
  presetButtons.forEach((button) => {
    button.disabled = isDisabled;
  });
}

function applyTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = currentTheme;
  document.body.dataset.theme = currentTheme;
  darkModeToggle.checked = currentTheme === "dark";
}

function applyAccentTheme(accentTheme) {
  currentAccentTheme = accentTheme || DEFAULT_ACCENT_THEME;
  document.documentElement.dataset.accentTheme = currentAccentTheme;

  themeOptions.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.accentTheme === currentAccentTheme);
  });
}

function setSettingsOpen(isOpen) {
  settingsPanel.hidden = !isOpen;
  settingsToggle.setAttribute("aria-expanded", String(isOpen));
}

function setUnsupportedState(isUnsupported) {
  panel.classList.toggle("is-disabled", isUnsupported);
  unsupportedOverlay.hidden = !isUnsupported;

  if (isUnsupported) {
    setSettingsOpen(false);
  }
}

function setConfirmOpen(isOpen) {
  confirmOverlay.hidden = !isOpen;
  panel.classList.toggle("is-confirming", isOpen);

  if (isOpen) {
    setSettingsOpen(false);
  }
}

async function loadTheme() {
  const stored = await browser.storage.local.get([THEME_STORAGE_KEY, ACCENT_STORAGE_KEY]);
  applyTheme(stored[THEME_STORAGE_KEY]);
  applyAccentTheme(stored[ACCENT_STORAGE_KEY]);
}

async function saveTheme(theme) {
  applyTheme(theme);
  await browser.storage.local.set({ [THEME_STORAGE_KEY]: currentTheme });
}

async function saveAccentTheme(accentTheme) {
  applyAccentTheme(accentTheme);
  await browser.storage.local.set({ [ACCENT_STORAGE_KEY]: currentAccentTheme });
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function sendToActiveTab(message) {
  if (activeTabId == null) {
    throw new Error("No active tab found.");
  }

  return browser.tabs.sendMessage(activeTabId, message);
}

async function updateToolbarBadge(volume) {
  if (activeTabId == null) {
    return;
  }

  try {
    await browser.runtime.sendMessage({
      type: "UPDATE_BADGE",
      tabId: activeTabId,
      volume
    });
  } catch (error) {
    console.error(error);
  }
}

async function refreshToolbarBadgeStyle() {
  if (activeTabId == null || currentVolume === DEFAULT_VOLUME) {
    return;
  }

  try {
    await browser.runtime.sendMessage({
      type: "REFRESH_BADGE_STYLE",
      tabId: activeTabId,
      volume: currentVolume
    });
  } catch (error) {
    console.error(error);
  }
}

async function initialize() {
  try {
    await loadTheme();
  } catch (error) {
    console.error(error);
    applyTheme("light");
    applyAccentTheme(DEFAULT_ACCENT_THEME);
  }

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      throw new Error("The active tab could not be read.");
    }

    activeTabId = activeTab.id;
    const state = await sendToActiveTab({ type: "GET_STATE" });
    updateUi(state.volume, state.muted);
    await updateToolbarBadge(state.volume);
    setUnsupportedState(false);
    setControlsDisabled(false);
    setStatus(STATUS_MESSAGES.active);
  } catch (error) {
    console.error(error);
    setUnsupportedState(true);
    setStatus("", true);
    setControlsDisabled(true);
  }
}

async function applyVolume(volume) {
  const nextVolume = clampVolume(volume);

  try {
    const state = await sendToActiveTab({
      type: "SET_VOLUME",
      volume: nextVolume
    });

    updateUi(state.volume, state.muted);
    await updateToolbarBadge(state.volume);
    setStatus(state.hasMedia ? STATUS_MESSAGES.applied : STATUS_MESSAGES.pending);
  } catch (error) {
    console.error(error);
    setStatus(STATUS_MESSAGES.changedError, true);
  }
}

volumeSlider.addEventListener("input", () => {
  const nextVolume = clampVolume(Number(volumeSlider.value));
  updateUi(nextVolume, false);
  applyVolume(nextVolume);
});

resetButton.addEventListener("click", () => {
  updateUi(DEFAULT_VOLUME, false);
  applyVolume(DEFAULT_VOLUME);
});

muteButton.addEventListener("click", async () => {
  if (currentVolume === 0) {
    updateUi(DEFAULT_VOLUME, false);
    await applyVolume(DEFAULT_VOLUME);
    return;
  }

  try {
    const state = await sendToActiveTab({ type: "TOGGLE_MUTE" });
    updateUi(state.volume, state.muted);
    await updateToolbarBadge(state.volume);
    setStatus(state.muted ? STATUS_MESSAGES.muted : STATUS_MESSAGES.restored);
  } catch (error) {
    console.error(error);
    setStatus(STATUS_MESSAGES.muteFailed, true);
  }
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = Number(button.dataset.volume);
    updateUi(value, false);
    applyVolume(value);
  });
});

settingsToggle.addEventListener("click", () => {
  setSettingsOpen(settingsPanel.hidden);
});

settingsClose.addEventListener("click", () => {
  setSettingsOpen(false);
});

bugLink.addEventListener("click", () => {
  setConfirmOpen(true);
});

confirmCancel.addEventListener("click", () => {
  setConfirmOpen(false);
});

confirmProceed.addEventListener("click", () => {
  window.open(BUG_REPORT_URL, "_blank", "noopener,noreferrer");
  setConfirmOpen(false);
});

darkModeToggle.addEventListener("change", async () => {
  try {
    await saveTheme(darkModeToggle.checked ? "dark" : "light");
    await refreshToolbarBadgeStyle();
    setStatus(darkModeToggle.checked ? STATUS_MESSAGES.darkOn : STATUS_MESSAGES.darkOff);
  } catch (error) {
    console.error(error);
    setStatus("Theme could not be saved.", true);
  }
});

themeOptions.forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await saveAccentTheme(button.dataset.accentTheme);
      await refreshToolbarBadgeStyle();
      setStatus(STATUS_MESSAGES.accentSaved);
    } catch (error) {
      console.error(error);
      setStatus(STATUS_MESSAGES.accentError, true);
    }
  });
});

setStatus(STATUS_MESSAGES.ready);
initialize();
