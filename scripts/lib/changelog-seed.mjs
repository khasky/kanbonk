// @ts-check
//
// commit-and-tag-version keeps everything above the previous release heading as
// changelog body and re-appends it under the header it just wrote. A
// CHANGELOG.md committed before the first release carries no such heading, so
// the whole file counts as body and its header lands twice. Emptying the seed
// first is what breaks that.

/** The pattern commit-and-tag-version itself searches for to find the start of the last release. */
const RELEASE_HEADING = /(^#+ \[?[0-9]+\.[0-9]+\.[0-9]+|<a name=)/m;

/**
 * @param {string} changelog contents of CHANGELOG.md
 * @returns {boolean} true when the file holds only a hand-written seed and no released version
 */
export function isSeedOnly(changelog) {
  return changelog.trim() !== "" && !RELEASE_HEADING.test(changelog);
}
