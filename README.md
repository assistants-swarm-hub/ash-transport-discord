# ash-transport-discord

The **Discord transport** for [assistants-swarm-hub][core], as the package
`@assistants-swarm-hub/ash-transport-discord`: the core hosts it in its own
process, runs a gateway client for each assistant's bot, forwards every
update as the contract's events, performs the sends, and offers Discord's own
actions as MCP tools.

It has no process, no port and no files of its own. Everything it knows at
runtime it learns from the core (which bots to run, with which tokens), and
its whole job is translation.

It is also the **second proof** of the transport interface: it was written
against the published [`@assistants-swarm-hub/transport-sdk`][sdk] and
[the manual][manual] alone, and the core needed no change to accept it — no
branch, no capability flag, no list to add `discord` to.

## Install it into a core

```bash
npm install @assistants-swarm-hub/ash-transport-discord
```

then restart the core. It finds the package among its installed dependencies,
registers it, and the transport appears on the dashboard, where each
assistant gets a Discord connection section with the bot token field this
package announces. No core change, no service to add.

The package lives in the org's registry on GitHub Packages, which wants a
token on every request: a public package there is readable by any account,
but not anonymously. Point the scope at the registry in the core's `.npmrc`
and keep a token with `read:packages` in your user-level `~/.npmrc`:

```
# .npmrc
@assistants-swarm-hub:registry=https://npm.pkg.github.com
```

```
# ~/.npmrc
//npm.pkg.github.com/:_authToken=<token>
```

## Setting up the bot

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. **New Application** → **Bot** → **Reset Token**, and paste that token into
   the assistant's Discord connection in the dashboard.
2. Under **Privileged Gateway Intents**, enable **MESSAGE CONTENT INTENT**.
   Without it the bot connects, looks healthy, and receives every message with
   an empty body — the single most common way this transport appears broken
   when it is merely unconfigured.
3. **OAuth2 → URL Generator**: scope `bot`, and the permissions below. Open the
   generated URL to invite it to a server. DMs need no invitation, and need no
   permissions at all.

   | Permission | Why the transport needs it |
   | --- | --- |
   | View Channels | Resolving a channel by id at all |
   | Send Messages | Replies, standalone sends, feedback menus, the typing indicator |
   | Send Messages in Threads | The same, when the channel is a thread |
   | Read Message History | Fetching a message to react to, resolving a reply's target, hydrating a reaction on a message older than the process |
   | Add Reactions | The `set_message_reaction` tool |
   | Attach Files | Voice replies, generated images, browser-run downloads |

   Permissions integer **274878008384**. Two more are worth granting but not
   required: **Embed Links** (a URL in a reply renders a preview) and **Use
   External Emojis** (a reaction may use a custom emoji from another server) —
   with both, the integer is **274878286912**.

   It does **not** need *Manage Messages* or *Administrator*. It only ever
   deletes its own messages and clears its own reactions, and neither takes a
   permission. Granting Manage Messages would let it delete other people's.

## What lives where

Almost nothing. Registration, reconcile, deduping, event assembly, the sends,
the delivery tools and shutdown are all the core's host — the same for every
platform, so they live in one place. What is here is Discord, and the
boundary is the folder: `discord/` is the only code that knows the Discord
API exists, and replacing it is what gets you a different transport.

```
src/
  index.ts              the package: the four pieces, on defineTransport
  descriptor.ts         who this transport is: id, name, config fields, limits

  discord/              the only code that knows the Discord API
    adapter.ts          gateway clients, intents, what each event means
    connection.ts       the platform actions (text, files, menus, reactions)
    reaction-tool.ts    the reaction MCP tool
    ids.ts              snowflakes, citation links, mention stripping
    media.ts            attachments and stickers, fetched and normalized

  inbound/              reading a gateway message into the contract
    normalize.ts        one Discord message becomes one InboundMessage
    addressing.ts       the structural verdict, per receiving bot
```

Tests sit beside what they cover.

## Where Discord differs from Telegram

Both are the same host with a different platform under it, so everything
that differs is in `discord/` and `inbound/`. The parts worth knowing:

| | |
| --- | --- |
| **Ids are snowflakes** | 64-bit, and `Number()` corrupts them. The interface keeps every id a string for exactly this reason, so nothing here parses one |
| **2000 characters, not 4096** | Long replies split far more often. The cap is a number in the descriptor; the splitting itself is the host's, so both transports cut the same way |
| **Mentions are structured** | `<@id>`, not a name to match — so the structural check is exact, with no case folding to get wrong. A role or `@everyone` ping is deliberately *not* addressing |
| **No voice bubble** | The core's voice reply arrives as audio plus its spoken text; this transport sends the audio as an attachment and reports `asVoice: false` rather than claiming a form the platform lacks |
| **Menus are buttons** | The feedback flow's 👍/👎 menu is an action row, and a press is an interaction that must be answered within three seconds — so the toast comes back as an ephemeral reply |
| **No chat titles to set** | A channel always has its own name, so the connection has no `setChatTitle`. An action a platform lacks is a method that does not exist, not one that answers "unsupported" |
| **No ffmpeg** | Attachments arrive with a CDN URL and a content type, so there is no frame sampling and no file-id round trip |

## The interface

Everything this package implements comes from
[`@assistants-swarm-hub/transport-sdk`][sdk]: the descriptor, adapter,
normalizer and addressing types, the runtime a tool receives, and the few
helpers a transport's own tools call. The SDK is a **peer** dependency, and
its major is the compatibility contract: the core you are installed into
checks the range this package declares against the SDK it was built with and
refuses a mismatch by name, with a reason its dashboard shows.

## Development

```bash
npm install         # needs the GitHub Packages token above
npm run typecheck
npm run test        # the seams worth pinning: ids, media, menus, addressing
npm run build       # dist/index.js, what the core imports
```

Against a core checkout next door, link this package into it and restart the
core — a transport is boot-time, so a change needs a restart to show:

```bash
npm link
cd ../ash-core && npm link @assistants-swarm-hub/ash-transport-discord --no-save
```

Note that `npm install` in the core prunes anything in its `node_modules` that
its manifest does not list — a link included — so link again after one.

Releases: bump `version` in `package.json`, push to `main`, and the workflow
typechecks, tests, builds, publishes the package on that version, installs it
back from the registry to prove it imports, and tags the commit.

[core]: https://github.com/assistants-swarm-hub/ash-core
[manual]: https://github.com/assistants-swarm-hub/ash-core/blob/main/docs/development/adding-a-transport.md
[sdk]: https://github.com/assistants-swarm-hub/ash-core/blob/main/packages/transport-sdk/README.md
