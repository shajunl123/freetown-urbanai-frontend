import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const backendRoot =
  moduleDir.endsWith('/src') || moduleDir.endsWith('/dist')
    ? dirname(moduleDir)
    : moduleDir;
const projectRoot = dirname(backendRoot);

function resolveFromProjectRoot(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(projectRoot, pathValue);
}

export const DATA_DIR = resolveFromProjectRoot(process.env.DATA_DIR || 'data');
export const DB_PATH = resolveFromProjectRoot(
  process.env.DB_PATH || 'data/freetown.db'
);
export const UPLOAD_DIR = resolveFromProjectRoot(
  process.env.UPLOAD_DIR || 'data/uploads'
);

export function ensureParentDir(pathValue: string): void {
  mkdirSync(dirname(pathValue), { recursive: true });
}

export function ensureDir(pathValue: string): void {
  mkdirSync(pathValue, { recursive: true });
}
