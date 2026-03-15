# Legend in the Mist — FoundryVTT System

An unofficial [FoundryVTT](https://foundryvtt.com) implementation of [Legend in the Mist](https://www.legendinthemist.com).

---

## Features

### Hero Sheet
- Four theme cards with
- Status tracking
- Quintessences, backpack items, and relationship tags
- Linked Fellowship displays the fellowship's tags and quest inline
- Edit mode toggle to lock the sheet against accidental changes

### Challenge Sheet
- Tags, statuses, limits threats, consequences, and special features
- Inline shorthand syntax: `[tag name]`, `[status-N]`, `{limit name}` in description fields

### Fellowship Sheet
- Title tag, power and weakness tags, quest, AIM track, and special improvements

### Roll Panel
- **Quick**, **Detailed**, and **Reaction** roll types
- Click to add a tag; right-click a power tag to burn it for +3
- Weakness tags automatically mark Improve on the relevant theme

### Scene Tracker
- Story tags and statuses for the current scene
- Linked challenge cards showing tags, statuses, and limits at a glance
- GM visibility toggles per tag, status, and challenge
- **Roll mode** — when a player opens the roll panel, the GM can click scene tags, statuses, and challenge tags/statuses to contribute them to the roll in real time
- Drag a Challenge actor onto the tracker to link it

### Party Overview
- At-a-glance view of all heroes: theme names, weakness tags, and quests
- Accessible to all players

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
| v13 | ✅ Verified |

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

*Legend in the Mist* is created by Son of Oak Game Studio. This project is a fan-made implementation and is not affiliated with or endorsed by the original creators. Please support the official game.

Thanks to the other Legend in the Mist Foundry system developers, MrTheBino and aMediocreDad, for their work on the other Legend in the Mist systems! These systems helped inspire me to create my own :)
