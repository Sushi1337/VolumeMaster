const DEFAULT_VOLUME = 100;
const THEME_STORAGE_KEY = "uiTheme";
const ACCENT_STORAGE_KEY = "accentTheme";
const DEFAULT_ACCENT_THEME = "amber";

const BADGE_COLORS = {
  light: {
    amber: "#cf5f2e",
    ocean: "#2d77d2",
    forest: "#2d8f5b",
    rose: "#cb4d76"
  },
  dark: {
    amber: "#ff9359",
    ocean: "#6aaeff",
    forest: "#4dc98a",
    rose: "#ff7fa8"
  }
};

function getBadgeText(volume) {
  return volume === DEFAULT_VOLUME ? "" : String(volume);
}

async function getBadgeColor() {
  const stored = await browser.storage.local.get([THEME_STORAGE_KEY, ACCENT_STORAGE_KEY]);
  const theme = stored[THEME_STORAGE_KEY] === "dark" ? "dark" : "light";
  const accentTheme = stored[ACCENT_STORAGE_KEY] || DEFAULT_ACCENT_THEME;
  return BADGE_COLORS[theme][accentTheme] || BADGE_COLORS[theme][DEFAULT_ACCENT_THEME];
}

async function setBadgeForTab(tabId, volume) {
  const text = getBadgeText(volume);

  await browser.browserAction.setBadgeText({
    tabId,
    text
  });

  if (text) {
    const color = await getBadgeColor();
    await browser.browserAction.setBadgeBackgroundColor({
      tabId,
      color
    });
  }
}

async function clearBadgeForTab(tabId) {
  await browser.browserAction.setBadgeText({
    tabId,
    text: ""
  });
}

async function refreshBadgeForTab(tabId) {
  try {
    const state = await browser.tabs.sendMessage(tabId, { type: "GET_STATE" });
    await setBadgeForTab(tabId, state.volume);
  } catch (error) {
    await clearBadgeForTab(tabId);
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message?.type) {
    return undefined;
  }

  switch (message.type) {
    case "UPDATE_BADGE":
      if (typeof message.tabId !== "number" || typeof message.volume !== "number") {
        return undefined;
      }

      return setBadgeForTab(message.tabId, message.volume);

    case "CLEAR_BADGE":
      if (typeof message.tabId !== "number") {
        return undefined;
      }

      return clearBadgeForTab(message.tabId);

    case "REFRESH_BADGE_STYLE":
      if (typeof message.tabId !== "number" || typeof message.volume !== "number") {
        return undefined;
      }

      return setBadgeForTab(message.tabId, message.volume);

    default:
      return undefined;
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  await refreshBadgeForTab(tabId);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    await refreshBadgeForTab(tabId);
  }
});
