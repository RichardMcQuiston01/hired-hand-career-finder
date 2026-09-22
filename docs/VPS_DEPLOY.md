# Deploying `apps/proxy` to your VPS

`apps/proxy` (see [`apps/proxy/README.md`](../apps/proxy/README.md)) runs as
a single, long-lived Docker container on the user's own VPS — not a
serverless platform — because a single persistent process is what makes the
proxy's global rate limiter and response cache
(`apps/proxy/src/lib/{rateLimit,cache}.ts`) actually meaningful (see
`docs/DEVELOPMENT_PLAN.md`'s Stage 8). Deploys are driven by
[`.github/workflows/deploy-proxy.yml`](../.github/workflows/deploy-proxy.yml)
over SSH, using GitHub Actions secrets — no live VPS credential is ever
passed through chat, a session, or committed to the repo.

## One-time VPS setup

These steps assume a Debian/Ubuntu-style VPS with SSH access you control
(e.g. Hostinger). Run them once, before the first deploy.

1. **Install Docker** (with the Compose plugin), if not already present:

   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Create a deploy user** (or reuse an existing non-root sudo user) that's
   a member of the `docker` group, so it can run `docker`/`docker compose`
   without `sudo`:

   ```bash
   sudo usermod -aG docker <deploy-user>
   ```

3. **Clone the repository** to a fixed path on the VPS — this is the
   directory `deploy-proxy.yml` will `git fetch`/`reset --hard` on every
   deploy, so nothing else should be left uncommitted there:

   ```bash
   git clone https://github.com/<owner>/hired-hand-career-finder.git ~/hired-hand-career-finder
   ```

4. **Create the proxy's `.env` file** from the template — this holds the
   real O\*NET key and never gets committed:

   ```bash
   cd ~/hired-hand-career-finder/apps/proxy
   cp .env.example .env
   $EDITOR .env   # fill in ONET_API and ALLOWED_EXTENSION_ORIGINS
   ```

5. **Generate a dedicated SSH deploy key** (don't reuse your personal key —
   this one's private half goes into a GitHub secret, so it should carry no
   broader access than "log in and run Docker commands in this repo's
   directory"):

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/hired_hand_deploy -N "" -C "github-actions-deploy-proxy"
   cat ~/.ssh/hired_hand_deploy.pub >> ~/.ssh/authorized_keys
   ```

   Keep `~/.ssh/hired_hand_deploy` (the **private** key) — its contents go
   into the `VPS_SSH_KEY` GitHub secret below. Never paste it into a chat,
   issue, or commit.

6. **Point your existing reverse proxy** (nginx, Caddy, or whatever this VPS
   already runs for its other sites) at `127.0.0.1:3100` — `docker-compose.yml`
   deliberately only binds to localhost, since this VPS likely already
   claims the public ports. The production hostname is
   `onet-proxy.hiredhandhq.com` (DNS `A` record already points it at this
   VPS — see the GitHub Actions secrets table below for where that value
   also has to match). A worked nginx example:

   ```nginx
   server {
       listen 443 ssl;
       server_name onet-proxy.hiredhandhq.com;

       location / {
           proxy_pass http://127.0.0.1:3100;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   (Issue a TLS cert for that hostname the same way you already do for this
   VPS's other sites, e.g. `certbot --nginx -d onet-proxy.hiredhandhq.com`.)
   A Caddy `Caddyfile` is even shorter:

   ```
   onet-proxy.hiredhandhq.com {
       reverse_proxy 127.0.0.1:3100
   }
   ```

7. **First manual start**, to confirm everything above actually works before
   wiring up CI:

   ```bash
   cd ~/hired-hand-career-finder
   docker compose -f apps/proxy/docker-compose.yml up -d --build
   curl http://127.0.0.1:3100/
   ```

## GitHub Actions secrets

Add these under the repository's **Settings → Secrets and variables →
Actions**, scoped to the `production` environment if this repo uses
[deployment environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
(`deploy-proxy.yml` targets an environment named `production`; either create
one and gate it with a required reviewer, or remove the `environment:` line
from the workflow to use repository-level secrets instead):

| Secret            | Value                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `VPS_HOST`        | The VPS's hostname or IP address.                                                                   |
| `VPS_USER`        | The deploy user created above.                                                                      |
| `VPS_SSH_KEY`     | The **private** half of the dedicated deploy key generated above (`hired_hand_deploy`, not `.pub`). |
| `VPS_SSH_PORT`    | Optional. SSH port, if not the default `22`.                                                        |
| `VPS_DEPLOY_PATH` | Absolute path to the repo clone on the VPS, e.g. `/home/<deploy-user>/hired-hand-career-finder`.    |

`apps/proxy`'s own runtime configuration (`ONET_API`,
`ALLOWED_EXTENSION_ORIGINS`, rate-limit tuning) lives in `apps/proxy/.env` on
the VPS itself (step 4 above), **not** in GitHub secrets — `docker-compose.yml`
reads it directly via `env_file`, so it never needs to pass through CI.

## Day-to-day deploys

Once the above is set up, deploys are automatic: pushing to `main` with
changes under `apps/proxy/**` (or the shared packages it depends on)
triggers `deploy-proxy.yml`, which SSHes in, pulls the latest `main`, rebuilds
the image, and restarts the container with `docker compose up -d --build`.
Trigger a deploy manually (no code change) from the Actions tab via this
workflow's "Run workflow" button (`workflow_dispatch`).

To check on the running container directly:

```bash
ssh <deploy-user>@<vps-host>
cd ~/hired-hand-career-finder
docker compose -f apps/proxy/docker-compose.yml logs -f
docker compose -f apps/proxy/docker-compose.yml ps
```
