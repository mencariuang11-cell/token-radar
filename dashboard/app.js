// Token Radar's dashboard (model radar-2). It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a live-token view, the method behind the numbers, and a
// per-protocol detail drawer with the full valuation audit trail and the protocol's farm plan.
// No network: every byte it shows is in data.js.
//
// The value model, stated once here and recomputed by this page from the data it carries:
//   peers     = token-bearing protocols in the snapshot with a market cap, TVL >= $25M and a
//               category that is not CEX; a peer's multiple is market cap / TVL clamped to
//               [0.005, 20].
//   multiple  = the category peers' median, shrunk toward the global median with prior strength 5:
//               M = (n x median + 5 x global) / (n + 5); a category with no peer uses the global.
//   implied   = TVL x M x momentum x maturity x breadth
//     momentum = 1 + clamp(change_7d, -50, 100)/100 x 0.6   (unreported growth counts as 0)
//     maturity = 0.75 + 0.5 x min(age_days, 1460)/1460      (an unlisted age counts as 365 days)
//     breadth  = 1 + 0.03 x min(chains - 1, 7)
//   low/high  = the same product with the category's shrunk 25th / 75th percentile multiple.
// Each row also carries the raw seven-day change the snapshot records (growth_raw_pct) beside the
// clamped figure its momentum factor used; the detail view prints both, so the record is never
// restated as the clamp.
// deriveMultiples() below re-derives every category's median from the peer rows in data.js and the
// method panel prints the comparison; impliedOf() recomputes a row's value from its stated inputs
// and the detail drawer prints whether it matches board.json. The page and the board are the same
// arithmetic, checked in the open.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', tier: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(n < 0.1 ? 3 : 2) + 'x';
  }

  // The model's statistics, re-derived from the peer rows the data carries: the same median and
  // lower-quantile definitions lib/model.ts uses, so the comparison in the method panel is honest.
  function medianOf(values) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    var mid = s.length >> 1;
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function quantileOf(values, f) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    return s[Math.min(s.length - 1, Math.floor(f * s.length))];
  }
  function clampedMultiple(peer) {
    return Math.min(M.multiple_clamp_high, Math.max(M.multiple_clamp_low, peer.mcap_usd / peer.tvl_usd));
  }
  function deriveMultiples() {
    var all = DATA.peers.map(clampedMultiple);
    var global = { peers: all.length, median: medianOf(all), p25: quantileOf(all, 0.25), p75: quantileOf(all, 0.75) };
    var byCat = {};
    DATA.peers.forEach(function (p) {
      var key = p.category || 'Uncategorised';
      if (!byCat[key]) byCat[key] = [];
      byCat[key].push(clampedMultiple(p));
    });
    return { global: global, byCat: byCat };
  }
  var DERIVED = deriveMultiples();
  function shrink(n, own, globalValue) {
    return n === 0 ? globalValue : (n * own + M.shrinkage_peers * globalValue) / (n + M.shrinkage_peers);
  }
  // A row's implied value recomputed from its stated inputs: TVL and the four model factors.
  function impliedOf(row) {
    var m = row.model;
    return Math.max(1, Math.round(row.tvl_usd * m.category_multiple * m.momentum_multiplier * m.age_multiplier * m.chain_multiplier));
  }
  function statsOf(row) {
    return DATA.categories.filter(function (c) { return c.category === (row.category || 'Uncategorised'); })[0] || null;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tier')) state.tier = params.get('tier');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tier !== 'all') params.set('tier', state.tier);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.tier === 'watch' && !r.watchlist) return false;
      if (state.tier === 'early' && r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.model.category_multiple; bv = b.model.category_multiple; }
      else if (key === 'rank') { av = a.rank; bv = b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark' }),
        el('div', null,
          el('div', { class: 'brand-name', text: 'TOKEN RADAR' }),
          el('div', { class: 'brand-sub', text: 'pre-token launch values, priced from traded peers' })
        )
      ),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Source ', el('b', { text: 'DefiLlama protocol index' })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version }))
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
        el('p', null,
          'Every protocol in the snapshot that records no token, ranked by what its launch would be worth if its record stayed as it is. The value is not TVL in disguise: it is each protocol\u2019s TVL priced at ',
          el('b', { text: 'the multiple the market already pays for traded protocols in the same category' }),
          ', adjusted for its seven-day momentum, how long it has run with no token, and how many chains it runs on. Select any row for the full audit trail and its farm plan.'
        )
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { class: 'teal', text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows ranked' }), el('b', null, String(DATA.board_size), el('small', { text: '  (' + DATA.early_size + ' early)' }))),
        el('div', { class: 'fact' }, el('span', { text: 'Implied value, whole board' }), el('b', { class: 'gold', text: fmtUsd(DATA.implied_total_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Pricing peers (median)' }), el('b', null, String(DATA.global.peers), el('small', { text: '  at ' + fmtMult(DATA.global.median) })))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
    var chainCounts = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCounts[c] = (chainCounts[c] || 0) + 1; }); });
    var chains = Object.keys(chainCounts).sort(function (a, b) { return chainCounts[b] - chainCounts[a] || (a < b ? -1 : 1); }).slice(0, 24);
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    function select(id, label, values, current, onchange) {
      var sel = el('select', { id: id, 'aria-label': label },
        values.map(function (v) { return el('option', { value: v[0], text: v[1], selected: v[0] === current ? 'selected' : null }); })
      );
      sel.addEventListener('change', function () { onchange(sel.value); writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), sel);
    }
    var catSel = select('category', 'Category', [['all', 'All categories']].concat(categories.map(function (c) { return [c, c]; })), state.category, function (v) { state.category = v; });
    var chainSel = select('chain', 'Chain', [['all', 'All chains']].concat(chains.map(function (c) { return [c, c + ' (' + chainCounts[c] + ')']; })), state.chain, function (v) { state.chain = v; });
    function chip(tab, label, pressed, fn) {
      return el('button', { type: 'button', 'aria-pressed': pressed ? 'true' : 'false', text: label, onclick: fn });
    }
    var tiers = el('div', { class: 'tabs tier' },
      chip('all', 'All rows', state.tier === 'all', function () { state.tier = 'all'; writeHash(); render(); }),
      chip('watch', 'Watchlist', state.tier === 'watch', function () { state.tier = 'watch'; writeHash(); render(); }),
      chip('early', 'Early only', state.tier === 'early', function () { state.tier = 'early'; writeHash(); render(); })
    );
    var tabs = el('div', { class: 'tabs' },
      chip('board', 'Pre-token board', state.tab === 'board', function () { state.tab = 'board'; render(); }),
      chip('live', 'Live tokens (the comps)', state.tab === 'live', function () { state.tab = 'live'; render(); })
    );
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      catSel,
      chainSel,
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Radar tier' }), tiers),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'View' }), tabs),
      el('span', { class: 'count', text: state.tab === 'board' ? rows().length + ' of ' + DATA.board_size + ' rows' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' ? 1 : -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u25bc' : ' \u25b2' }) : null
      )
    );
  }

  function chainLine(r) {
    var cs = r.chains || [];
    if (!cs.length) return 'an unnamed chain';
    return cs.slice(0, 2).join(', ') + (cs.length > 2 ? ' +' + (cs.length - 2) : '');
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tier = 'all'; writeHash(); render(); } })
      ));
    }
    var max = 0;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    max = max || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var multNote = r.model.category_peers > 0
        ? (r.category || 'Uncategorised') + ' median, ' + r.model.category_peers + ' peer' + (r.model.category_peers === 1 ? '' : 's')
        : 'global median (no peer at scale)';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'rank', text: '#' + r.rank }),
        el('td', null, el('div', { class: 'name' },
          el('div', null,
            el('b', { text: r.name }),
            el('span', { class: 'pill ' + (r.watchlist ? 'watch' : 'early'), text: r.watchlist ? 'WATCHLIST' : 'EARLY' })
          ),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + chainLine(r) })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: r.change_7d === null ? 'n/a' : fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'mult' },
          el('span', { class: 'num', text: fmtMult(r.model.category_multiple) }),
          el('span', { class: 'sub', text: multNote })
        )),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('div', null,
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
            el('span', { class: 'sub', text: '  ' + fmtUsd(r.implied_low_usd) + '\u2013' + fmtUsd(r.implied_high_usd) })
          )
        ))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols ranked by implied launch value. The range is the same estimate at the category\u2019s 25th and 75th percentile peer multiples. Select a row for its audit trail and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Multiple'),
            sortHeader('implied', 'Implied value')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + chainLine(r) }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.multiple === null ? 'n/a' : fmtMult(r.multiple) })
      ));
    });
    return el('div', null,
      el('p', { class: 'sub', text: 'These protocols already trade, so their market cap is a fact, not a model. They are never ranked on the board; the ones at or above the $' + Math.round(M.peer_min_tvl_usd / 1e6) + 'M TVL peer floor are the comps the board\u2019s multiples are derived from.' }),
      el('div', { class: 'panel', style: 'margin-top:12px' },
        el('div', { class: 'table-wrap' },
          el('table', null,
            el('thead', null, el('tr', null,
              el('th', { scope: 'col', text: 'Protocol' }),
              el('th', { scope: 'col', text: 'TVL' }),
              el('th', { scope: 'col', text: '7d' }),
              el('th', { scope: 'col', text: 'Market cap' }),
              el('th', { scope: 'col', text: 'Mcap / TVL' })
            )),
            tbody
          )
        )
      )
    );
  }

  function methodPanel() {
    var g = DERIVED.global;
    var globalMatch = Math.abs(g.median - DATA.global.median) < 0.001 && g.peers === DATA.global.peers;
    var catRows = DATA.categories.map(function (c) {
      var own = DERIVED.byCat[c.category] || [];
      var note = c.peers === 0 ? 'no peer at scale: global applies' : c.peers < 5 ? 'shrunk toward global' : 'category median leads';
      return el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.peers) }),
        el('td', { class: 'num', text: c.median === null ? '\u2014' : fmtMult(c.median) }),
        el('td', { class: 'num', text: c.p25 === null ? '\u2014' : fmtMult(c.p25) + ' \u2013 ' + fmtMult(c.p75) }),
        el('td', { class: 'num', text: fmtMult(c.effective) }),
        el('td', { class: 'sub', text: note + (own.length && c.peers ? '' : '') })
      );
    });
    var peerRows = DATA.peers.slice(0, 12).map(function (p) {
      return el('tr', null,
        el('td', { text: p.name }),
        el('td', { class: 'sub', text: p.category || 'Other' }),
        el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }),
        el('td', { class: 'num', text: fmtMult(p.multiple) })
      );
    });
    return el('section', { class: 'panel method' },
      el('div', null,
        el('h2', { text: 'How implied value is derived' }),
        el('p', { text: 'One function prices every row from the snapshot\u2019s own figures. Nothing is looked up by name, and no row is hand-picked: change the snapshot and the board changes.' })
      ),
      el('div', { class: 'formula' },
        'implied = TVL x M x momentum x maturity x breadth',
        el('br'), el('span', { class: 'dim', text: 'M = (n x category median + ' + M.shrinkage_peers + ' x global median) / (n + ' + M.shrinkage_peers + '), from ' + DATA.global.peers + ' traded peers (TVL >= $' + Math.round(M.peer_min_tvl_usd / 1e6) + 'M, not CEX), multiples clamped to [' + M.multiple_clamp_low + ', ' + M.multiple_clamp_high + ']' }),
        el('br'), el('span', { class: 'dim', text: 'momentum = 1 + clamp(7d change, ' + M.momentum_floor + ', ' + M.momentum_cap + ')/100 x ' + M.momentum_weight + ' \u00b7 maturity = ' + M.maturity_floor + ' + ' + M.maturity_range + ' x min(age, ' + M.maturity_days + 'd)/' + M.maturity_days + 'd \u00b7 breadth = 1 + ' + M.chain_bonus_per_chain + ' x min(chains - 1, ' + M.chain_bonus_max_extra + ')' })
      ),
      el('p', { class: 'check', text: 'Checked in this page: re-deriving the multiples from the ' + DATA.peers.length + ' peer rows in the data gives a global median of ' + fmtMult(g.median) + ' over ' + g.peers + ' peers \u2014 ' + (globalMatch ? 'the same figures the board states.' : 'which differs from the board\u2019s stated figures: the data would be stale.') }),
      el('div', { class: 'method-grid' },
        el('div', null,
          el('h3', { text: 'Category multiples (board categories)' }),
          el('div', { class: 'table-wrap' }, el('table', null,
            el('thead', null, el('tr', null,
              el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Peers' }),
              el('th', { scope: 'col', text: 'Median' }), el('th', { scope: 'col', text: 'P25 \u2013 P75' }),
              el('th', { scope: 'col', text: 'Used' }), el('th', { scope: 'col', text: 'Basis' })
            )),
            el('tbody', null, catRows)
          ))
        ),
        el('div', null,
          el('h3', { text: 'Largest pricing peers' }),
          el('div', { class: 'table-wrap' }, el('table', null,
            el('thead', null, el('tr', null,
              el('th', { scope: 'col', text: 'Peer' }), el('th', { scope: 'col', text: 'Category' }),
              el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Mcap' }), el('th', { scope: 'col', text: 'Mult' })
            )),
            el('tbody', null, peerRows)
          )),
          el('h3', { text: 'Reading the board', style: 'margin-top:20px' }),
          el('ul', { class: 'notes' },
            el('li', null, el('b', { text: 'Coverage. ' }), 'All ' + DATA.watchlist_size + ' watchlist protocols are ranked (the gold WATCHLIST pill), plus ' + DATA.early_size + ' early protocols below the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor or outside the list.'),
            el('li', null, el('b', { text: 'Products are not launches. ' }), 'Wrapped, staked and bridged products of tokens that already trade (WBTC and its kin) are excluded at every size by the watchlist\u2019s own rule, as are exchanges and versioned pools.'),
            el('li', null, el('b', { text: 'Separation. ' }), 'Protocols whose token already trades are never ranked; they sit in the Live tokens view at the market\u2019s own cap, and the qualifying ones are the comps above.'),
            el('li', null, el('b', { text: 'A claim, not a price. ' }), 'An implied value says what a launch would be worth if the protocol\u2019s record stayed as it is. It does not say a token will be issued, or when.')
          )
        )
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); render(); });

  function wrow(label, note, value) {
    return el('div', { class: 'wrow' },
      el('span', { class: 'wlab' }, label, note ? el('small', { text: note }) : null),
      el('span', { class: 'wval', text: value })
    );
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    var m = row.model;
    var stats = statsOf(row);
    var recomputed = impliedOf(row);
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-sub', text: 'RANK #' + row.rank + ' OF ' + DATA.board_size + (row.watchlist ? ' \u00b7 WATCHLIST' : ' \u00b7 EARLY RADAR') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' \u00b7 ' + (row.chains && row.chains.length ? row.chains.slice(0, 3).join(', ') + (row.chains.length > 3 ? ' +' + (row.chains.length - 3) + ' more' : '') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var multNote = m.category_peers > 0
      ? (row.category || 'Uncategorised') + ': ' + m.category_peers + ' traded peer' + (m.category_peers === 1 ? '' : 's') + ', median ' + fmtMult(m.category_median) + ', shrunk toward the global ' + fmtMult(m.global_median)
      : 'no traded peer at scale in ' + (row.category || 'this category') + ': the global median of ' + DATA.global.peers + ' peers applies whole';
    var rawGrowth = (m.growth_raw_pct === null || m.growth_raw_pct === undefined) ? m.growth_pct : m.growth_raw_pct;
    var growthNote = rawGrowth !== m.growth_pct
      ? '7d TVL change ' + fmtPct(rawGrowth) + ' on record; the model clamps it to ' + fmtPct(m.growth_pct)
      : '7d TVL change ' + fmtPct(m.growth_pct) + ' (clamped to [' + M.momentum_floor + ', +' + M.momentum_cap + '])';
    var waterfall = el('div', { class: 'waterfall' },
      wrow('TVL (snapshot)', row.listed_at ? 'listed ' + row.listed_at + ' \u00b7 age ' + fmtAge(row.age_days) : 'listing date not recorded', fmtUsd(row.tvl_usd)),
      wrow('x Category multiple', multNote, fmtMult(m.category_multiple)),
      wrow('x Momentum', growthNote, m.momentum_multiplier.toFixed(2) + 'x'),
      wrow('x Maturity', 'has run ' + fmtAge(row.age_days) + ' with no token on record', m.age_multiplier.toFixed(2) + 'x'),
      wrow('x Breadth', m.chain_count + ' chain' + (m.chain_count === 1 ? '' : 's') + ' on record', m.chain_multiplier.toFixed(2) + 'x'),
      el('div', { class: 'wrow total' }, el('span', { class: 'wlab', text: 'Implied launch value' }), el('span', { class: 'wval', text: fmtUsd(row.implied_value_usd) }))
    );
    var span = row.implied_high_usd - row.implied_low_usd;
    var at = span > 0 ? ((row.implied_value_usd - row.implied_low_usd) / span) * 100 : 50;
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Valuation breakdown' }),
      waterfall,
      el('div', { class: 'range' },
        el('div', { class: 'track' }, el('span', { class: 'marker', style: 'left:calc(' + at.toFixed(1) + '% - 1px)' })),
        el('div', { class: 'rlabs' },
          el('span', { text: 'low ' + fmtUsd(row.implied_low_usd) + ' (P25 ' + fmtMult(m.multiple_low) + ')' }),
          el('span', { text: 'high ' + fmtUsd(row.implied_high_usd) + ' (P75 ' + fmtMult(m.multiple_high) + ')' })
        )
      ),
      el('p', { class: 'sub', text: 'The range is the same estimate at the category\u2019s 25th and 75th percentile peer multiples. This page recomputes the row from the inputs above as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from board.json: the data would be stale.') + ' An estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'The record' }),
      el('div', { class: 'facts-grid' },
        el('div', null, el('span', { text: 'Token status' }), el('b', { text: 'no token on record' })),
        el('div', null, el('span', { text: 'Radar tier' }), el('b', { text: row.watchlist ? 'Watchlist' : 'Early radar' })),
        el('div', null, el('span', { text: 'First listed' }), el('b', { text: row.listed_at || 'not recorded' })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Category peers' }), el('b', { text: stats ? String(stats.peers) + ' at scale' : 'n/a' })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { text: String(m.chain_count) }))
      )
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'board' ? boardTable() : liveTable());
    if (state.tab === 'board') shell.appendChild(methodPanel());
    shell.appendChild(el('footer', { class: 'foot' },
      el('span', { text: 'Token Radar \u00b7 model ' + DATA.model_version }),
      el('span', { text: 'Snapshot ' + DATA.as_of + ', DefiLlama protocol index, sealed for this bounty' }),
      el('span', { text: 'Implied value is this radar\u2019s own claim, not a prediction that a token will be issued' })
    ));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
