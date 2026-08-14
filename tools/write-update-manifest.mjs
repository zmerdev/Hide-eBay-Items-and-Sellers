/**
 * Regenerates updates.json, the update manifest Firefox polls for this build.
 *
 * Self-distributed add-ons are not updated by addons.mozilla.org. Firefox instead fetches
 * the URL in browser_specific_settings.gecko.update_url, compares the version there
 * against the installed one, and downloads update_link if it is newer. Both URLs have to
 * be https, and the version has to match the signed package exactly, so this is generated
 * from the manifest and the signed file rather than edited by hand.
 *
 *   node tools/write-update-manifest.mjs <path-to-signed-xpi> [download-url]
 *
 * The download URL defaults to the GitHub release asset for the manifest's version.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'static/manifest.json'), 'utf8'));
const gecko = manifest.browser_specific_settings?.gecko;
if (!gecko?.id) throw new Error('manifest has no browser_specific_settings.gecko.id');
if (!gecko.update_url) throw new Error('manifest has no update_url, so nothing would ever poll this file');

const xpiPath = process.argv[2];
if (!xpiPath) throw new Error('usage: node tools/write-update-manifest.mjs <signed.xpi> [download-url]');
if (!fs.existsSync(xpiPath)) throw new Error(`no such file: ${xpiPath}`);

const { version } = manifest;
const updateLink =
    process.argv[3] ??
    `https://github.com/zmerdev/Hide-eBay-Items-and-Sellers/releases/download/v${version}/${path.basename(xpiPath)}`;

if (!updateLink.startsWith('https://')) {
    throw new Error(`update_link must be https, got: ${updateLink}`);
}

// Firefox verifies this before installing, so a truncated or swapped download is rejected
// rather than installed.
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(xpiPath)).digest('hex');

const updates = {
    addons: {
        [gecko.id]: {
            updates: [
                {
                    version,
                    update_link: updateLink,
                    update_hash: `sha256:${sha256}`,
                    applications: { gecko: { strict_min_version: gecko.strict_min_version } },
                },
            ],
        },
    },
};

const dest = path.join(ROOT, 'updates.json');
fs.writeFileSync(dest, JSON.stringify(updates, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, dest)} for version ${version}`);
console.log(`  update_link: ${updateLink}`);
console.log(`  update_hash: sha256:${sha256.slice(0, 16)}...`);
