import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(frontend, "public");
const distDir = join(frontend, "dist");

if (process.argv[2] === "icons") {
  await mkdir(join(publicDir, "icons"), { recursive: true });
  const svg = await readFile(join(publicDir, "icon.svg"), "utf8");
  for (const [name, size] of [
    ["icon-192", 192],
    ["icon-512", 512],
    ["maskable-512", 512],
  ]) {
    const raster = new Resvg(svg, {
      fitTo: { mode: "width", value: size },
    }).render();
    await writeFile(join(publicDir, "icons", `${name}.png`), raster.asPng());
  }
} else {
  async function files(dir) {
    const output = [];
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.isDirectory()) output.push(...(await files(path)));
      else if (item.name !== "sw.js") output.push(path);
    }
    return output;
  }
  const paths = await files(distDir);
  const hash = createHash("sha256");
  for (const path of paths.sort()) hash.update(await readFile(path));
  const version = hash.digest("hex").slice(0, 12);
  const resources = [
    "/",
    ...paths.map((path) => "/" + relative(distDir, path).split(sep).join("/")),
  ];
  await writeFile(
    join(distDir, "sw.js"),
    `// Generated from the production build. Private API responses are NEVER cached.
const CACHE='baxi-shell-${version}';
const ASSETS=${JSON.stringify(resources)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('baxi-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html',{ignoreVary:true})));
  }else if(ASSETS.includes(url.pathname)){
    event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request)));
  }
});
`,
  );
  console.log(
    `PWA shell ${version}: ${resources.length} public resources; API cache excluded.`,
  );
}
