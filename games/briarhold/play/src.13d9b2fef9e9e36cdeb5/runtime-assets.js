/**
 * Source assets retain their authored paths. Packaged modules select the asset
 * tree beside their own immutable ESM tree, including assets loaded lazily by
 * an older open tab. Hosting must retain that tree for the tab to keep working.
 */
export function runtimeAssetUrl(path, moduleUrl = import.meta.url) {
  const authored = String(path ?? "").replaceAll("\\", "/");
  const assetPath = authored.replace(/^(?:\.\/|\.\.\/)/u, "");
  if (!assetPath.startsWith("assets/")) return authored;
  const module = new URL(moduleUrl);
  const scope = module.pathname.match(/\/src\.([a-f0-9]{20})\//u);
  if (!scope) return authored;
  // Never interpret an asset path as traversal outside its allowlisted tree.
  if (assetPath.split("/").some(part => part === "." || part === "..")) {
    throw new TypeError("runtime asset path must stay inside assets");
  }
  const root = new URL(module.href);
  root.pathname = module.pathname.slice(0, scope.index + 1);
  root.search = "";
  root.hash = "";
  return new URL(`assets.${scope[1]}/${assetPath.slice("assets/".length)}`, root).href;
}
