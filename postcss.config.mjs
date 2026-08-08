// No postcss plugins. Tailwind CSS v4 handles processing through the
// @tailwindcss/vite plugin, so this file only exists to stop postcss
// config search from walking up into the parent repository (this repo
// is a submodule inside the tendersa tree, which has its own
// postcss.config.mjs for Tailwind v3).
export default {};
