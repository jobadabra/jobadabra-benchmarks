#!/usr/bin/env bash
# Keeps a round's judged lists for good, under the git TAG bench-archive (tools/state-tag.sh moves it; never a branch).
#   tools/archive.sh <kind> <key> <dir>    copy the files of <dir> to <kind>/<key>/ in the tag and move the tag; run in a clone of the repo that has the tag
# Why (12 Nov 2026, owner: "do we keep track of all the benchmark runs?... Or the results are being lost"): the per-job verdicts lived only in Actions artifacts (30 or 90 days), and the
# search notes and the Admin rows were keyed by the DAY, so a second round the same day overwrote the first. One folder per round key, never overwritten: the same key again only adds files that are new.
# kind = search | form; key = the round's own key (search: YYYY-MM-DD-rNNNNN, form: the run id). Titles, employers and places only; never a URL or a posting text (the judged lists carry none).
set -euo pipefail
kind="${1:?usage: tools/archive.sh <search|form> <key> <dir>}"; key="${2:?key}"; src="${3:?dir}"
case "$kind" in search|form) ;; *) echo "archive: kind must be search or form, not $kind" >&2; exit 2 ;; esac
case "$key" in */*|.*|'') echo "archive: a key is one plain folder name, not $key" >&2; exit 2 ;; esac
[ -d "$src" ] && [ -n "$(ls -A "$src")" ] || { echo "archive: nothing in $src to keep" >&2; exit 2; }
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"; trap 'git worktree remove --force "$work/a" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
"$here/state-tag.sh" read bench-archive "$work/a"
mkdir -p "$work/a/$kind/$key"
dest="$work/a/$kind/$key"
# a file an earlier run archived under this key is never replaced (cp -n differs between GNU and BSD, so: one explicit test per file)
(cd "$src" && find . -type f) | while IFS= read -r f; do
  [ -e "$dest/$f" ] || { mkdir -p "$(dirname "$dest/$f")"; cp "$src/$f" "$dest/$f"; }
done
"$here/state-tag.sh" write bench-archive "$work/a" "Archive $kind $key" "$kind/$key"
echo "archive: $kind/$key kept in the tag bench-archive"
