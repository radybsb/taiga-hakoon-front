# Project page backgrounds

The image button in Kanban and taskboard offers Photos, Colors, and Custom.
Backgrounds are personal preferences stored for each signed-in user and project
in this browser, independently for each of these pages. Taskboard preferences apply
to all sprints of that project. They are not shared with project members. Custom images are
resized to a maximum of 1920 pixels and stored locally, without uploading them to
the Taiga server. Remove background restores the theme's normal board.

## Unsplash setup

Register the application at https://unsplash.com/developers and configure its
Access Key as `UNSPLASH_ACCESS_KEY` in the back-end environment. Do not put this
credential in front-end configuration or commit it to the repository.

For Docker Compose, add the variable to the shared back-end environment mapping:

```yaml
UNSPLASH_ACCESS_KEY: "${UNSPLASH_ACCESS_KEY:-}"
```

Set its value in the deployment's untracked `.env` file. Build/deploy the updated
back-end image (which includes `taiga/backgrounds.py` and its router registration),
then recreate the back-end service with the updated environment. A simple
container restart does not apply changes to environment variables.

The authenticated `GET /api/v1/background-photos?q=landscape&page=1` endpoint
proxies Unsplash search. The browser uses the hotlinked URLs returned by Unsplash,
shows photographer profile links, and sends a signed selection token to
`POST /api/v1/background-photos/select` to trigger Unsplash download tracking.
Search responses are cached for 15 minutes. The photo picker includes the Unsplash
license and terms notice. Without a configured key, Photos reports that the
service is unavailable; Colors and Custom remain available.

Follow https://unsplash.com/documentation and the Unsplash API guidelines when
registering the application and requesting production access.
