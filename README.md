# Camelcord

Servers, chat rooms, direct messages and voice calls, on your Camel Studios account.
Electron app, Firebase (the same project as Camel Client), WebRTC voice.

## Run it
```
npm install
npm start            # the app
npm run build        # Windows installer in dist/
```

## One-time setup: publish the database rules
Servers, rooms, calls, profiles and emoji need the rules in `firestore.rules`
(it is the existing Camel Studios ruleset plus a Camelcord section).
Firebase console > Firestore Database > Rules > paste the file > Publish.
Until that is done the app signs in and shows friends, but creating servers or calling will say
"database rules need publishing".

## Test it locally (no real accounts touched)
```
npm run emu          # Firebase emulators (auth 9189, firestore 8185); needs firebase-tools + Java
npm run serve        # http://127.0.0.1:5190/?emu  (the ?emu switch points the app at the emulators)
```
Test accounts for the emulator are in `tools/test-accounts.json`.

## How it hangs together
| file | what |
|---|---|
| `src/account.js` | sign in / sign up; usernames are unique, the `#tag` is a hidden internal detail |
| `src/social.js` | friends, presence, direct messages (same collections as Camel Client) |
| `src/servers.js` | servers, rooms, messages, invites, custom emoji, reactions |
| `src/voice.js` | WebRTC mesh voice, signalled through Firestore; calls between friends |
| `src/profiles.js` | avatar, banner, bio, status, name colour |
| `src/themes.js` | 34 themes, custom themes, theme-from-picture, image shrinking |
| `src/app.js` | all UI |

## Limits worth knowing
- Voice is a full mesh: great for small groups (about 6-8 people per room), not for big rooms.
- Voice uses public STUN. If a friend cannot hear you on a strict network a TURN server is needed
  (Settings > Voice > Advanced).
- Pictures and emoji are stored inside database documents (about 880 KB per picture), so there is
  no separate file hosting. Big videos and files are not supported yet.
- Not built yet: camera video, sound while screen sharing, soundboard, stickers, threads.

## What's new in 0.2
- **Screen sharing** with a screen/window picker (720p/1080p, 30/60 fps); people in the room watch it live.
- **Volume**: one master level and a slider per person (hover their tile). Push-to-talk, noise suppression, echo cancellation.
- **Bots**: auto-mod (blocked words, links, floods, shouting, mass mentions) and a welcome bot run on the owner's copy;
  giveaways, polls and support tickets are stored in the database so they work any time.
- **Server tools**: moderators, bans, announcement rooms, slowmode (enforced by the database rules), room rename, per-server mute, server info.
- **Chat**: edit messages, search a room (Ctrl+F), @mentions, slash commands (`/help`), status (online / idle / do not disturb / invisible).
- **Rate limiters**: slowmode per room, a per-message limit in the database rules, and client-side limiters for messages, reactions, uploads, friend requests and calls.
- **Settings**: appearance (size, text size, bubbles or list, density, 24-hour clock), notifications, voice, keybinds, behaviour, account.
- **Auto-updates**: the installed app checks GitHub Releases every 20 minutes, downloads in the background and installs quietly
  (button: "Restart to update", or on the next quit).

## Releasing an update
1. Bump `version` in `package.json`, `npm run build`.
2. `gh release create vX.Y.Z dist/Camelcord-Setup-X.Y.Z.exe` (the file name must start with `Camelcord-Setup-`).
3. Everyone's installed copy picks it up on its own.

