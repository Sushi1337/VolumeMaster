# VolumeMaster

VolumeMaster is a Firefox extension for controlling the volume of the current tab from `0%` up to `600%`.

I originally found a Chrome extension that handled tab volume in a way I liked, but I could not find a Firefox version that felt as clean or polished as I wanted. So I built this one for myself: lightweight, focused, and easy to use.

## Features

- Adjust the active tab volume from `0%` to `600%`
- Start at `100%` by default
- Quick presets for common volume levels
- `Mute` and `Reset` actions
- Theme settings with light/dark mode
- Multiple accent color variants
- Toolbar badge showing the current volume when it is not `100%`
- Bug report shortcut with a confirmation dialog

## Why This Exists

There are already a few volume-related browser extensions out there, especially on Chrome. The problem was not that nothing existed, but that I did not find a Firefox add-on that matched the combination I wanted:

- simple UI
- per-tab control
- strong volume boost
- a design that feels a bit more intentional than a default utility popup

So this project is basically the result of building the Firefox version I personally wanted to use.

## How It Works

The extension injects a content script into regular web pages and connects HTML media elements (`audio` and `video`) to a `GainNode` through the Web Audio API. That makes it possible to go beyond the browser's native `100%` volume level for the current tab.

The popup communicates with the active tab, updates the current gain level, and stores UI preferences like dark mode and accent theme in extension storage.

There is also a small background script that keeps the toolbar badge in sync with the current tab volume, so you can immediately see when a tab is running above or below the default level.

## Project Structure

- `manifest.json`: Firefox extension manifest and registration
- `popup.html`: popup markup
- `popup.css`: popup styling, themes, and states
- `popup.js`: popup logic, settings, and tab communication
- `content-script.js`: tab-side audio handling with Web Audio
- `background.js`: toolbar badge updates
- `icons/volumemaster.svg`: extension icon

## Installation

For local testing in Firefox:

1. Open `about:debugging`
2. Select `This Firefox`
3. Click `Load Temporary Add-on`
4. Choose `manifest.json`

## Release for Firefox Distribution

If you want to distribute this add-on to other Firefox users, there are two realistic paths:

- publish it on `addons.mozilla.org` (`AMO`)
- self-distribute a signed `.xpi`

### 1. Build the package

From the project root, create the release file:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-firefox.ps1
```

That creates `dist/volumemaster-firefox-<version>.xpi`.

### 2. Prepare the Firefox metadata

The manifest already includes:

- a stable Firefox add-on ID
- `browser_specific_settings.gecko`
- `data_collection_permissions.required: ["none"]`

That setup is important for signing, store submission, and future updates.

### 3. Choose a distribution path

#### AMO listing

Use this if you want normal Firefox users to discover and install the add-on through the Mozilla add-on store.

High-level flow:

1. Create the `.xpi`
2. Sign in to the Firefox Add-on Developer Hub
3. Upload the package
4. Fill out listing data such as description, categories, screenshots, and support links
5. Submit for review

#### Self-distribution

Use this if you want to host the `.xpi` yourself or share it directly.

Important: Firefox still expects the package to be signed. Unsigned temporary installs are for development only.

If you want Firefox to handle updates for a self-hosted build later, add an `update_url` in `browser_specific_settings.gecko` and host the update manifest yourself.

### Release checklist

- bump `manifest.json` version before each release
- run the packaging script
- test the packaged add-on in Firefox
- upload the package to AMO or sign it for self-distribution
- add screenshots and store metadata if publishing on AMO

## Notes

- The extension is mainly designed for regular websites with HTML media elements.
- Some custom players may behave differently depending on how they implement audio playback.
- Volume values above `100%` rely on Web Audio gain amplification and may introduce distortion depending on the source.

## Feedback

Feature requests are very welcome. If there is something you would like to see added, improved, or adjusted, feel free to suggest it.

Bug reports are also appreciated, especially when they include example websites where the issue can be reproduced. If something behaves strangely on a specific player or platform, a concrete test page makes it much easier to debug and improve compatibility.

## Development

This codebase is intentionally small and straightforward. Most of the behavior lives in only three places:

- popup UI
- content-side audio control
- background badge sync

That makes it relatively easy to tweak the design, add settings, or adapt the behavior for specific sites later on.
