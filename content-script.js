const DEFAULT_VOLUME = 100;
const MIN_VOLUME = 0;
const MAX_VOLUME = 600;

let currentVolume = DEFAULT_VOLUME;
let muted = false;
let audioContext = null;

const mediaState = new WeakMap();
const observedMedia = new WeakSet();

function clampVolume(value) {
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, Math.round(value)));
}

function getGainValue() {
  if (muted || currentVolume === 0) {
    return 0;
  }

  return currentVolume / 100;
}

function ensureContext() {
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      return null;
    }
    audioContext = new Context();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function setGainValue(gainNode, value) {
  const context = audioContext;
  if (!context) {
    gainNode.gain.value = value;
    return;
  }

  gainNode.gain.cancelScheduledValues(context.currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
  gainNode.gain.linearRampToValueAtTime(value, context.currentTime + 0.04);
}

function attachMediaListeners(element) {
  if (observedMedia.has(element)) {
    return;
  }

  const syncElement = () => {
    const state = mediaState.get(element);
    if (!state) {
      return;
    }

    setGainValue(state.gainNode, getGainValue());
  };

  ["play", "playing", "loadedmetadata", "canplay"].forEach((eventName) => {
    element.addEventListener(eventName, syncElement, true);
  });

  observedMedia.add(element);
}

function connectMediaElement(element) {
  if (mediaState.has(element)) {
    return mediaState.get(element);
  }

  const context = ensureContext();
  if (!context) {
    return null;
  }

  try {
    const source = context.createMediaElementSource(element);
    const gainNode = context.createGain();

    source.connect(gainNode);
    gainNode.connect(context.destination);
    setGainValue(gainNode, getGainValue());

    const state = { gainNode };
    mediaState.set(element, state);
    attachMediaListeners(element);
    return state;
  } catch (error) {
    console.warn("VolumeMaster: Media-Element konnte nicht verbunden werden.", error);
    return null;
  }
}

function getMediaElements() {
  return Array.from(document.querySelectorAll("audio, video"));
}

function syncMediaElements() {
  const elements = getMediaElements();

  elements.forEach((element) => {
    const state = connectMediaElement(element);
    if (state) {
      setGainValue(state.gainNode, getGainValue());
    }
  });

  return elements.length > 0;
}

function observeMedia() {
  const observer = new MutationObserver((mutations) => {
    const shouldSync = mutations.some((mutation) => mutation.addedNodes.length > 0);
    if (shouldSync) {
      syncMediaElements();
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
}

browser.storage.local.get(location.origin).then((stored) => {
  const savedState = stored?.[location.origin];
  if (savedState) {
    currentVolume = clampVolume(savedState.volume ?? DEFAULT_VOLUME);
    muted = Boolean(savedState.muted);
  }

  syncMediaElements();
});

observeMedia();

async function persistState() {
  await browser.storage.local.set({
    [location.origin]: {
      volume: currentVolume,
      muted
    }
  });
}

browser.runtime.onMessage.addListener((message) => {
  if (!message?.type) {
    return undefined;
  }

  switch (message.type) {
    case "GET_STATE":
      syncMediaElements();
      return Promise.resolve({
        volume: currentVolume,
        muted,
        hasMedia: getMediaElements().length > 0
      });

    case "SET_VOLUME":
      currentVolume = clampVolume(message.volume);
      muted = false;
      return persistState().then(() => ({
        volume: currentVolume,
        muted,
        hasMedia: syncMediaElements()
      }));

    case "TOGGLE_MUTE":
      muted = !muted;
      return persistState().then(() => ({
        volume: currentVolume,
        muted,
        hasMedia: syncMediaElements()
      }));

    default:
      return undefined;
  }
});
