#!/bin/bash
set -euo pipefail

# Empty TAIGA_URL means same-origin API, as used by the preview proxy.
export TAIGA_URL="${TAIGA_URL-}"
export TAIGA_SUBPATH="${TAIGA_SUBPATH:-}"
export TAIGA_WEBSOCKETS_URL="${TAIGA_WEBSOCKETS_URL:-}"
export DEFAULT_LANGUAGE="${DEFAULT_LANGUAGE:-en}"
export DEBUG="${DEBUG:-false}"
export PUBLIC_REGISTER_ENABLED="${PUBLIC_REGISTER_ENABLED:-false}"
export ENABLE_GITHUB_IMPORTER="${ENABLE_GITHUB_IMPORTER:-false}"
export ENABLE_JIRA_IMPORTER="${ENABLE_JIRA_IMPORTER:-false}"
export ENABLE_TRELLO_IMPORTER="${ENABLE_TRELLO_IMPORTER:-false}"
export GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
export GITLAB_CLIENT_ID="${GITLAB_CLIENT_ID:-}"
export GITLAB_URL="${GITLAB_URL:-}"

for setting in DEBUG PUBLIC_REGISTER_ENABLED ENABLE_GITHUB_IMPORTER ENABLE_JIRA_IMPORTER ENABLE_TRELLO_IMPORTER; do
    [[ "${!setting}" == true || "${!setting}" == false ]] || { echo "$setting must be true or false" >&2; exit 1; }
done
contribs=()
add_plugin() {
    local file="plugins/$1/$2.json"
    [[ -f "/usr/share/nginx/html/$file" ]] || { echo "Plugin not installed: $file. Mount its dist directory before enabling it." >&2; exit 1; }
    contribs+=("\"$file\"")
}
[[ "${ENABLE_SLACK:-false}" != true ]] || add_plugin slack slack
if [[ "$PUBLIC_REGISTER_ENABLED" == true ]]; then
    [[ "${ENABLE_GITHUB_AUTH:-false}" != true ]] || add_plugin github-auth github-auth
    [[ "${ENABLE_GITLAB_AUTH:-false}" != true ]] || add_plugin gitlab-auth gitlab-auth
fi
export CONTRIB_PLUGINS="[$(IFS=,; echo "${contribs[*]}")]"

FILE=/usr/share/nginx/html/conf.json
if [[ ! -f "$FILE" ]]; then
    # Substitute only config variables, avoiding expansion of unrelated values.
    envsubst '${TAIGA_URL} ${TAIGA_SUBPATH} ${TAIGA_WEBSOCKETS_URL} ${DEFAULT_LANGUAGE} ${DEBUG} ${PUBLIC_REGISTER_ENABLED} ${ENABLE_GITHUB_IMPORTER} ${ENABLE_JIRA_IMPORTER} ${ENABLE_TRELLO_IMPORTER} ${GITHUB_CLIENT_ID} ${GITLAB_CLIENT_ID} ${GITLAB_URL} ${CONTRIB_PLUGINS}' \
        < /usr/share/nginx/html/conf.json.template > "$FILE.tmp"
    # Existing production deployments can keep their explicit mounted conf.json.
    if [[ "${ENABLE_EVENTS:-true}" == false ]]; then
        jq '.eventsUrl = null' "$FILE.tmp" > "$FILE"
        rm "$FILE.tmp"
    else
        jq -e . "$FILE.tmp" > /dev/null
        mv "$FILE.tmp" "$FILE"
    fi
fi
jq -e '.api | type == "string"' "$FILE" > /dev/null
# Read baseHref from the actual config, also respecting mounted configuration.
BASE_HREF=$(jq -r '.baseHref' "$FILE")
[[ "$BASE_HREF" =~ ^/[a-zA-Z0-9/_-]*$ ]] || { echo "Unsupported baseHref" >&2; exit 1; }
sed -i "s|<base href=\"[^\"]*\">|<base href=\"${BASE_HREF}\">|g" /usr/share/nginx/html/index.html
