import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const backendDir = path.join(rootDir, 'backend');
const destZip = path.join(rootDir, 'public', 'downloads', 'filterbykake-backend.zip');
const distZip = path.join(rootDir, 'dist', 'downloads', 'filterbykake-backend.zip');

fs.mkdirSync(path.dirname(destZip), { recursive: true });

// Cria o ZIP usando python nativo no Linux/ambiente
const pythonScript = `
import zipfile, os
backend_dir = r"${backendDir}"
dest_zip = r"${destZip}"
with zipfile.ZipFile(dest_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(backend_dir):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if "auth_info" in dirs:
            dirs.remove("auth_info")
        if ".git" in dirs:
            dirs.remove(".git")
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, backend_dir)
            zipf.write(full_path, rel_path)
print(f"[ZIP] filterbykake-backend.zip gerado com {os.path.getsize(dest_zip)} bytes")
`;

try {
  execSync(`python3 -c '${pythonScript}'`, { stdio: 'inherit' });
  if (fs.existsSync(path.dirname(distZip))) {
    fs.mkdirSync(path.dirname(distZip), { recursive: true });
    fs.copyFileSync(destZip, distZip);
    console.log('[ZIP] Sincronizado também em dist/downloads/filterbykake-backend.zip');
  }
} catch (e) {
  console.error('[ZIP] Falha ao gerar backend zip:', e.message);
}
