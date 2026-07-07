# Contributing

Thanks for wanting to help!

## Getting started

1. Fork the repo.
2. `npm install`
3. `npm run dev`

## Guidelines

- **Keep it simple.** This project runs entirely on free data sources. No paid APIs, no proprietary dependencies.
- **No giant PRs.** Open an issue first if it's more than ~50 lines.
- **Match the style.** The codebase uses no comments in source files (README/docs are fine). Follow existing patterns for imports, naming, and component structure.
- **Three.js / R3F conventions.** Use `@react-three/drei` where possible. Prefer shader-based solutions over post-processing when targeting performance.
- **Accessibility.** New UI should work with keyboard navigation and respect `prefers-reduced-motion`.

## PR checklist

- [ ] `npm run build` passes
- [ ] No new dependencies unless necessary
- [ ] UI changes tested at 1920×1080 and 375×667 viewports

If you're adding a data source, make sure it's free and openly licensed.
