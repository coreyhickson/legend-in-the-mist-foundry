# Legend in the Mist FoundryVTT System

An unofficial [FoundryVTT](https://foundryvtt.com) implementation of [Legend in the Mist](https://www.legendinthemist.com).

---

## Features

### Hero Sheet

Open a Hero actor from the **Actors** sidebar. Click the pencil icon in the header to toggle edit mode. Right-click tags, statuses, backpack items, or relationships for a context menu.

![Hero Sheet](assets/screenshots/hero-sheet.png)

---

### Challenge Sheet

Open a Challenge actor from the **Actors** sidebar. The GM can toggle edit mode with the pencil icon. Description fields support inline tag and status syntax. See the **Input Reference** banner at the bottom of the sheet for details.

![Challenge Sheet](assets/screenshots/challenge-sheet.png)

---

### Fellowship Sheet

Open a Fellowship actor from the **Actors** sidebar. Link it to a Hero by entering the Fellowship actor's ID into the **Fellowship ID** field on the Hero sheet. Changes reflect live on linked hero sheets.

![Fellowship Sheet](assets/screenshots/fellowship-sheet.png)

---

### Roll Panel

Opens from the roll bar at the top of any Hero sheet. Select a roll type (**Quick**, **Detailed**, **Reaction**, or **Sacrifice**), build your roll by clicking tags, then submit. A chat card is posted with the result.

![Roll Panel](assets/screenshots/roll-panel.png)

---

### Scene Tracker

Open from the **Legend in the Mist** canvas controls (scroll icon) or via `LitmSceneTracker.open()`. Toggle between **Prep** (GM-only) and **Live** (visible to players) in the header. Add story tags, statuses, and linked challenges. Entering roll mode lets the GM click tags and statuses to contribute them to the active player's roll.

![Scene Tracker](assets/screenshots/scene-tracker.png)

---

### Camping Scene

Open from the **Legend in the Mist** canvas controls (campfire icon) or via `LitmCampingScene.open()`. The window opens for all connected players simultaneously. Set each hero's activities (Rest, Reflect, Camp Action), mark backpack items for expiry, and choose a fellowship activity. Click **Pack Up & Go** to apply all changes and post a summary chat card.

![Camping Scene](assets/screenshots/camping-scene.png)

---

### Party Overview

Open from the **Legend in the Mist** canvas controls (people icon) or via `LitmPartyOverview.open()`. Shows all active heroes at a glance. The GM can remove or re-add heroes by hovering a card or dragging from the **Actors** sidebar.

![Party Overview](assets/screenshots/party-overview.png)

---

## Installation

### From the Foundry module browser (recommended)
1. Open Foundry VTT and go to **Game Systems**
2. Click **Install System**
3. Paste the manifest URL into the **Manifest URL** field:
   ```
   https://raw.githubusercontent.com/coreyhickson/legend-in-the-mist-foundry/main/system.json
   ```
4. Click **Install**

### Manual installation
1. Download the latest release zip from the [releases page](https://github.com/coreyhickson/legend-in-the-mist-foundry/releases)
2. Extract it into your Foundry `Data/systems/` folder so the path is `Data/systems/legend-in-the-mist-foundry/`
3. Restart Foundry

---

## Compatibility

| Foundry version | Status |
|---|---|
| v13 | Verified |

---

## Development

The system uses [Dart Sass](https://sass-lang.com/dart-sass/) to compile styles. Node.js is required.

```bash
npm install        # install dependencies
npm run build      # compile SCSS once
npm run watch      # watch and recompile on changes
```

---

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/coreyhickson/legend-in-the-mist-foundry).

---

## License

See [LICENSE](LICENSE).

---

## Acknowledgements

*Legend in the Mist* is created by Son of Oak Game Studio. This is a fan-made implementation and is not affiliated with or endorsed by the original creators. Please support the official game.

Thanks to MrTheBino and aMediocreDad for their work on the other Legend in the Mist Foundry systems, they inspired me to make my own :)
