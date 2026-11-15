# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mencariuang11-cell/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mencariuang11-cell/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over a sealed DefiLlama snapshot: every protocol that records no token, ranked by what its launch would be worth. The value is not TVL in disguise — each protocol's TVL is priced at the market-cap/TVL multiple the market already pays for traded protocols in the same category (61 peers at scale, median 0.13x), with the category median shrunk toward the global median when peers are few, then adjusted for seven-day momentum, time running with no token, and chain breadth. Every row carries its full audit trail — the multiple, its basis, and each adjustment — plus a P25–P75 range and a seven-step farm plan sized to the protocol's chains, category and TVL. The board covers the whole 40-protocol watchlist and 158 earlier-stage protocols (198 rows, $2.93B implied in total), and the static dashboard re-derives the multiples and recomputes every row's value in the page, so what you read is what board.json carries.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
# then open out/dashboard/index.html — it renders fully offline
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=emnkdrqh&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
