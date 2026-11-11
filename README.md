# Lucky Reels — Casino Card Room

A single-page casino game room with five play-money games: **slots**, **roulette**, **blackjack**, **baccarat**, and **video poker**. Everything runs in the browser — no accounts, no payments, no real wagering.

## Run it

There is no build step and no dependencies. Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 3000
# then visit http://localhost:3000
```

## What's in here

| File | Purpose |
| --- | --- |
| `index.html` | The whole app: markup, styles and game logic in one self-contained file |

Notes on how it works:

- **No network calls.** The page loads no scripts, fonts, images or analytics from anywhere; the favicon is an inline SVG and all audio is synthesised with the Web Audio API.
- **Progress is saved locally** in `localStorage`, so your balance and best results survive a refresh. Nothing is sent to a server.
- **Fake credits only.** There is no payment, sign-up or server component of any kind.

## Live preview

Deployed with Freebuff Sites: <https://site-92e92b74e1624278b31dd6e22fe42e5a.freebuff.page>

## License

No license file is included yet — add one before distributing or accepting contributions.
