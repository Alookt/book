const fs = require('fs');
const path = require('path');
const root = process.cwd();
const exts = new Set(['.js', '.mjs', '.cjs', '.ts', '.json']);
const search = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      search(p);
      continue;
    }
    if (!exts.has(path.extname(name))) continue;
    const content = fs.readFileSync(p, 'utf8');
    if (content.includes('three/package.json') || content.includes('three\\package.json')) {
      console.log(p);
    }
  }
};
try {
  search(root);
} catch (err) {
  console.error(err);
  process.exit(1);
}
