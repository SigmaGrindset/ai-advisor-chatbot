/**
 * Reading the project's own files back.
 *
 * Several of the design system's claims — that no component states a colour,
 * that no typeface comes from somebody else's CDN — are only checkable against
 * what is actually written and actually built. The guard tests that check them
 * share the walking from here rather than each growing their own.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The directory a module URL points at, as a path this platform can open.
 *
 * `URL.pathname` keeps the leading slash that a Windows drive letter does not
 * want, so `/D:/work` has to come back as `D:/work`.
 */
export function directoryOf(url: URL): string {
  return url.pathname.replace(/^\/([a-z]:)/i, "$1");
}

/** Every file under a directory, depth first, optionally only the wanted ones. */
export function filesUnder(directory: string, wanted?: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path, wanted);
    return wanted === undefined || wanted.test(entry.name) ? [path] : [];
  });
}
