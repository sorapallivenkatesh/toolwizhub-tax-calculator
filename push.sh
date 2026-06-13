# #!/usr/bin/env bash
# # Stage, commit, and push this repo.
# # Usage:  ./push.sh "your commit message"
# #         ./push.sh            # uses a default message
# set -euo pipefail

# # Always run from the repo root (the dir this script lives in).
# cd "$(dirname "$0")"

# MSG="${*:-Update $(date '+%Y-%m-%d %H:%M')}"
# BRANCH="$(git symbolic-ref --short HEAD)"

# git add -A

# if git diff --cached --quiet; then
#   echo "No staged changes — nothing to commit."
# else
#   git commit -m "$MSG"
#   echo "Committed: $MSG"
# fi

# echo "Pushing to origin/$BRANCH …"
# git push -u origin "$BRANCH"
# echo "Done."
