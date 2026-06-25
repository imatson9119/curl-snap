# Themes

← back to the [README](../README.md)

The card ships in **gruvbox** by default. Pick another palette with `--theme`:

```sh
curl-snap '<curl>' --theme dracula
curl-snap --list-themes        # see them all
```

Fourteen themes ship in the box — eleven dark, three light:

| `gruvbox` (default) | `dracula` | `nord` |
| --- | --- | --- |
| ![gruvbox](../samples/themes/gruvbox.png) | ![dracula](../samples/themes/dracula.png) | ![nord](../samples/themes/nord.png) |
| **`one-dark`** | **`catppuccin`** (Mocha) | **`tokyo-night`** |
| ![one-dark](../samples/themes/one-dark.png) | ![catppuccin](../samples/themes/catppuccin.png) | ![tokyo-night](../samples/themes/tokyo-night.png) |
| **`github-dark`** | **`monokai`** | **`rose-pine`** |
| ![github-dark](../samples/themes/github-dark.png) | ![monokai](../samples/themes/monokai.png) | ![rose-pine](../samples/themes/rose-pine.png) |
| **`everforest`** | **`ayu-dark`** | **`github-light`** |
| ![everforest](../samples/themes/everforest.png) | ![ayu-dark](../samples/themes/ayu-dark.png) | ![github-light](../samples/themes/github-light.png) |
| **`solarized-light`** | **`catppuccin-latte`** | |
| ![solarized-light](../samples/themes/solarized-light.png) | ![catppuccin-latte](../samples/themes/catppuccin-latte.png) | |

## Custom themes

A theme is just a flat set of 15 hex values — 8 structural slots
(`background`, `panel`, `codeBackground`, `border`, `text`, `textDim`,
`textMuted`, `accentText`) and 7 accents (`red`, `green`, `yellow`, `blue`,
`purple`, `cyan`, `orange`). Define your own in a [config file](configuration.md)
under `themes`, then select it by name. Any slot you omit is inherited from
`base` (or the default), so you can tweak just a color or two:

```json
{
  "theme": "midnight",
  "themes": {
    "midnight": { "base": "tokyo-night", "green": "#00ffa0", "accentText": "#000000" }
  }
}
```

You can also set `theme` directly to an inline object instead of a name. Unknown
theme names or invalid hex values fall back to the default with a warning rather
than failing.
