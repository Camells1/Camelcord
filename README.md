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
- Not built yet: screen sharing / video, soundboard, stickers, message editing, threads.
