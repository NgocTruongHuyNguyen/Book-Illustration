import fs from 'node:fs/promises';
import path from 'node:path';
import { getDataDir } from './config.js';

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png'; // reasonable default
}

export async function writeImage(
  projectId: string,
  filenameBase: string,
  base64Data: string,
  mimeType: string
): Promise<string> {
  const dir = path.join(getDataDir(), 'images', projectId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${filenameBase}.${extensionFor(mimeType)}`;
  const filePath = path.join(dir, filename);

  const buffer = Buffer.from(base64Data, 'base64');
  await fs.writeFile(filePath, buffer);

  return filePath;
}