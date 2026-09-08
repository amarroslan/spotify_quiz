# Theme summary

## Tokens
- Background: `#10100f`, surface `#171813`, border `#34362d`
- Accent: neon lime `#d3f36b`
- Text: warm white `#f4f0e8`, muted `#a8a59c`, dim `#77776f`
- Error: `#e98a82`; success surface `#31431d`; error surface `#482422`
- Display/body font: `Space Grotesk`; mono metadata font: `DM Mono`
- Radius: 4px controls, 8px card, 999px pills
- Main content width: 960px; mobile breakpoint: 600px

## Raw CSS source

```css
:root { font-family: 'Space Grotesk', sans-serif; color: #f4f0e8; background: #10100f; }
body { background: radial-gradient(circle at 85% 10%, #29351e 0, transparent 28rem), #10100f; }
.shell { width: min(100% - 48px, 960px); min-height: 100vh; margin: auto; }
.accent { color: #d3f36b; }
```

Full source: `frontend/src/styles.css`.
