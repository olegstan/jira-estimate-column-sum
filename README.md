# Jira Estimate Summary — sum Original estimate hours per board column

> Chrome extension that totals the **Original estimate** hours for every column on a Jira
> board (Scrum & Kanban) and highlights cards that have no estimate. A lightweight time
> tracking / capacity-planning helper for Agile teams.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Platform](https://img.shields.io/badge/platform-Chrome-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

Chrome extension for Jira boards. It sums up the **Original estimate** for each column,
converts time (`30m`, `10h`, `1h`, `1d`, including compound values like `1d 2h 30m`) into hours and
shows the total in the column header. Cards without an estimate are highlighted in pink,
and their count is displayed next to the total (`5 without time`).

Recalculation happens automatically when filters change and as more cards are loaded
(via `MutationObserver`).

<!-- Add a screenshot/GIF here — it boosts click-through and dwell time, both indirect ranking signals:
![Screenshot](docs/screenshot.png)
-->

**Keywords:** Jira board estimate sum, Jira column total hours, Jira original estimate,
Jira time tracking extension, Chrome extension for Jira, Agile / Scrum / Kanban estimate totals.

## Structure

The code is split by responsibility (SOLID/KISS): each module solves a single task,
and the orchestrator only wires them together and decides "when to recalculate".

```
jira-ext/
├── manifest.json        # extension manifest (MV3)
├── src/
│   ├── estimate.js      # estimate-to-hours conversion + formatting (pure functions)
│   ├── settings.js      # load/observe settings from chrome.storage
│   ├── store.js         # board tasks + column totals
│   ├── board.js         # board DOM: banner placement, card highlighting
│   ├── content.js       # orchestrator: receive API data, render, watchdog
│   ├── net/
│   │   ├── interceptor.js  # MAIN-world: intercept board API responses → postMessage
│   │   └── board-api.js    # parse fetchBoardData response → task list
│   ├── styles.css       # banner and highlight styles
│   ├── popup.html       # settings (on/off, hours per day/week)
│   └── popup.js
├── fixtures/            # anonymized example API responses (for debugging)
├── tools/anonymize.mjs  # anonymize raw API dumps
├── part.html            # reference Jira board markup (for development)
└── README.md
```

One-way data flow:

```
interceptor.js (MAIN) → postMessage → content.js → board-api → estimate → store
                                                          ↓
                                              board (banners/highlighting)
```

Single-responsibility modules, tested independently.

## Installation

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked extension** → select the `jira-ext` folder.
4. Open a Jira board (`*.atlassian.net`) — the total will appear in the column headers.

## Settings

Extension icon → popup:

- **Enabled** — turn the count on/off.
- **Hours per day** — how many hours are in `1d` (default 8).
- **Days per week** — how many days are in `1w` (default 5).

## Hour conversion logic

| Unit | Meaning             |
|------|---------------------|
| `m`  | minutes (`/60`)     |
| `h`  | hours               |
| `d`  | `hoursPerDay` hours |
| `w`  | `daysPerWeek × hoursPerDay` |

## Data source and virtualization

Jira keeps only visible cards in the DOM, so reading estimates from HTML is not reliable —
the data is incomplete while scrolling. Instead, the extension intercepts the board API
response (`/rest/boards/.../fetchBoardData`), which contains **all** board tasks regardless of
scrolling, with the `estimation` and `isVisible` fields. The total is computed from this response.

- `isVisible: false` → the card is hidden by an active quick filter and is not counted.
- `columns[].name` matches the column name on the board, which is used to place the banner.
- When the filter/sprint changes, Jira itself issues a new request — the interceptor catches it,
  the store is refilled, and the totals are recalculated. Scrolling does not affect the data.

The DOM is used only to place the banner in the header and to highlight visible cards
without an estimate (based on data from the API).
