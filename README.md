# Lucky Reels — Casino Card Room

A single-page casino game room with five play-money games: **slots**, **roulette**, **blackjack**, **baccarat**, and **video poker**. Everything runs in the browser — no accounts, no payments, no real wagering.

> **Play money only.** The credits in this game have no value, cannot be bought, sold or cashed out, and there is no gambling service here. It is a browser toy for entertainment and code-reading purposes, not a betting product, and it is not affiliated with any casino or gambling operator.

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

## Live site

Deployed with Freebuff Sites:

- Production: <https://site-4d8146c817884b8e961f57f3cf1d5943.freebuff.page>
- Preview: <https://site-92e92b74e1624278b31dd6e22fe42e5a.freebuff.page>

## License

MIT — see [LICENSE](LICENSE).
