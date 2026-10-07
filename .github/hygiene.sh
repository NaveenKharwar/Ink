#!/usr/bin/env bash
# Repo hygiene: the public repo must not carry private planning, tooling or assistant traces, in files,
# commit messages or the branch name. Usage: .github/hygiene.sh [base-ref]   (base-ref: check commits since it)
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"
failed=0
# Patterns are assembled from pieces so this file does not match itself.
words=("task ids:(^|[^A-Za-z0-9])INK""-[0-9]+" "Notion links:notion""\\.(so|com)|notion""\\.site" "assistant mentions:clau""de|anthr""opic")
paths_banned='(^|/)(CLAU''DE\.md|AGENTS\.md|\.clau''de|experiments)(/|$)'

# Files
for entry in "${words[@]}"; do
  label="${entry%%:*}"; pattern="${entry#*:}"
  case="-i"; [ "$label" = "task ids" ] && case=""
  hits=$(git grep -nIE $case "$pattern" -- . ':!.github/hygiene.sh' ':!pnpm-lock.yaml' ':!.gitignore' | head -20 || true)
  if [ -n "$hits" ]; then echo "Found $label in files:"; echo "$hits"; failed=1; fi
done

banned=$(git ls-files | grep -E "$paths_banned" || true)
if [ -n "$banned" ]; then echo "Files that must not be in the repo:"; echo "$banned"; failed=1; fi

# Commit messages and the branch name
if [ -n "${1:-}" ]; then
  messages=$(git log --format='%H%n%B' "$1"..HEAD)
  for entry in "${words[@]}"; do
    label="${entry%%:*}"; pattern="${entry#*:}"
    case="-i"; [ "$label" = "task ids" ] && case=""
    hits=$(printf '%s\n' "$messages" | grep -E $case "$pattern" | head -5 || true)
    if [ -n "$hits" ]; then echo "Found $label in commit messages:"; echo "$hits"; failed=1; fi
  done
fi
branch="${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}"
for entry in "${words[@]}"; do
  label="${entry%%:*}"; pattern="${entry#*:}"
  case="-i"; [ "$label" = "task ids" ] && case=""
  if printf '%s' "$branch" | grep -qE $case "$pattern"; then echo "Found $label in the branch name: $branch"; failed=1; fi
done

[ "$failed" -eq 0 ] && echo "Hygiene check passed."
exit "$failed"
