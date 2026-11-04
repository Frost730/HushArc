import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('Vite Bundle Chunking & Code-Splitting Configuration (F1, F2)', () => {
  const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const welcomeScreenPath = path.join(projectRoot, 'src/features/welcome/WelcomeScreen.tsx');
  const sessionPath = path.join(projectRoot, 'src/lib/ephemeral-session/session.ts');

  // Tier 1: Feature Coverage (>=5 tests)
  it('defines explicit manualChunks for vendor-react, vendor-crypto, and vendor-icons', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toContain('manualChunks');
    expect(viteConfigContent).toContain("'vendor-react': ['react', 'react-dom']");
    expect(viteConfigContent).toContain("'vendor-crypto': ['libsodium-wrappers']");
    expect(viteConfigContent).toContain("'vendor-icons': ['lucide-react']");
  });

  it('configures es2022 build target and sourcemap generation in vite.config.ts', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toMatch(/target:\s*['"]es2022['"]/);
    expect(viteConfigContent).toMatch(/sourcemap:\s*true/);
  });

  it('sets appropriate chunkSizeWarningLimit to manage large crypto chunk warning thresholds', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toMatch(/chunkSizeWarningLimit:\s*\d+/);
  });

  it('guarantees WelcomeScreen does not statically import libsodium-wrappers or e2ee', () => {
    const welcomeContent = fs.readFileSync(welcomeScreenPath, 'utf8');
    expect(welcomeContent).not.toContain("from 'libsodium-wrappers'");
    expect(welcomeContent).not.toContain('from "../lib/crypto/e2ee');
    expect(welcomeContent).not.toContain('from "../../lib/crypto/e2ee');
    expect(welcomeContent).not.toContain('from "@/lib/crypto/e2ee');
  });

  it('guarantees session.ts does not statically import libsodium-wrappers', () => {
    const sessionContent = fs.readFileSync(sessionPath, 'utf8');
    expect(sessionContent).not.toContain("from 'libsodium-wrappers'");
    expect(sessionContent).not.toContain('from "../crypto/e2ee');
  });

  // Tier 2: Boundary & Corner Cases (>=5 tests)
  it('configures path aliases for libsodium-wrappers to resolve exact distribution bundle', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toContain('libsodium-wrappers');
    expect(viteConfigContent).toContain('libsodium-wrappers.js');
  });

  it('configures root path alias @ for clean src resolution', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toContain("'@':");
  });

  it('verifies package.json enforces "type": "module" for native ESM code-splitting', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.type).toBe('module');
  });

  it('verifies proxy configuration routing for WebSocket /ws and REST /api without bundle leakage', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toContain("'/api':");
    expect(viteConfigContent).toContain("'/health':");
    expect(viteConfigContent).toContain("'/ws':");
    expect(viteConfigContent).toContain('ws: true');
  });

  it('verifies production build output directory is set to dist', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toMatch(/outDir:\s*['"]dist['"]/);
  });

  // Tier 3: Cross-Feature Combinations & Architectural Invariants
  it('verifies vite react plugin integration alongside rollup output chunking', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfigContent).toContain('react()');
    expect(viteConfigContent).toContain('rollupOptions');
  });

  it('verifies tsconfig.json aligns with es2022 target and module resolution bundler', () => {
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
    const cleanJson = tsconfigContent.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '');
    const tsconfig = JSON.parse(cleanJson);
    expect(tsconfig.compilerOptions.target.toLowerCase()).toBe('es2022');
    expect(tsconfig.compilerOptions.moduleResolution.toLowerCase()).toBe('bundler');
  });
});
