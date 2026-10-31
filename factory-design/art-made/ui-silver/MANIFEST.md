# Silver UI kit (Brush, 2026-10-30), for Ken's "silvery UI, buttons with a gem in a border"
All painted, transparent WebP (PNG copies local only), no text baked in, no gold. Made in Ken's ChatGPT in the style of the silver Commander frame; gems/glow keyed from green screen. Today the game's buttons are pure CSS (.btn in src/style.css: gold border + dark gradient); this kit replaces that look with images.

## Buttons (9-slice horizontally): 1400x240, gem caps 250 px wide each side, plain rail between
btn-normal / btn-hover / btn-pressed / btn-disabled (icy neutral gem). Faction gems: btn-{normal,hover,pressed}-{goblin,gnome,dwarf} (green / purple / blue; disabled stays grey for all).
CSS idea: border-image-source:url(btn-normal.webp); border-image-slice: 0 250 fill; border-image-width: 0 <caps in px, e.g. 62px for a 60px high button> ; or three background layers (left cap, stretched middle, right cap). Text sits in the dark middle. Map: .btn -> btn-normal, .btn:hover -> btn-hover, .btn:active -> btn-pressed, .btn:disabled / [disabled] -> btn-disabled, .btn.primary / [aria-pressed=true] -> btn-hover (or the faction variant). Done / menu buttons the same.
## Gems (loose, 256 and -96): gem-neutral, gem-goblin, gem-gnome, gem-dwarf (silver-bezel faceted gems, for badges, toggles, bullets)
## Panel (9-slice, 1510x683, corners 250 px): panel-silver (replaces gold-bordered .dialog / panel / side-panel backgrounds)
## Dividers: divider-gem (1431x174, gem in the centre), divider-line (1430x114, plain) (replace gold <hr>/section rules)
## Icons (128 px, plus -256), silver medallion with icy gem: icon-play, icon-deck, icon-howto, icon-settings, icon-quit, icon-back, icon-done, icon-close, icon-help (main-menu entries Play / Deck Builder / How to Play / Settings / Quit, Back, Done, close X, help ?)
Existing stat icons (stat-sword/boot, ruby-heart) and badge icons (public/art/ui/badges/*-silver) are unchanged: the badges already have silver variants.
