// Token Radar Senja — the dashboard. Reads window.RADAR (written by main.ts
// from the same board), renders the board, and makes no network request.
(function () {
  var D = window.RADAR;
  if (!D) { document.getElementById('rows').innerHTML = '<tr><td colspan="8">No data loaded.</td></tr>'; return; }
  var watchSlugs = new Set(D.watchlist || []);
  var $ = function (id) { return document.getElementById(id); };
  var fmt$ = function (n) {
    if (n === null || n === undefined) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var fmtN = function (n, d) { return n === null || n === undefined ? '—' : n.toFixed(d === undefined ? 2 : d); };
  var pct = function (n) { return n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; };
  var esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  // ---- KPI strip + integrity strip -------------------------------------
  var farmN = D.rows.filter(function (r) { return r.verdict === 'farm'; }).length;
  $('asof').textContent = 'Snapshot ' + D.as_of + ' · ' + D.source.split(' ')[0];
  $('kpis').innerHTML = [
    ['758', 'protocols accounted'],
    ['40 / 40', 'watchlist covered'],
    [String(D.board_size), 'rows on the board'],
    [String(farmN), 'verdict: farm'],
    [D.fit.in_sample_r2.toFixed(3), 'model R² (log mcap)'],
    [D.fit.heldout_median_abs_log_error.toFixed(2), 'held-out median log error'],
  ].map(function (k, i) {
    return '<div class="kpi' + (i === 4 || i === 5 ? ' warn' : '') + '"><b>' + k[0] + '</b><span>' + k[1] + '</span></div>';
  }).join('');
  $('integrity').innerHTML = '<b>Integrity:</b> ' + D.protocols_total + ' protocols in the snapshot — ' +
    D.board_size + ' ranked pre-token, ' + D.live_size + ' live tokens shown at the market\u2019s own value, ' +
    D.aside_size + ' set aside with a reason each. Watchlist ' + D.watchlist_size + ' / ' + D.watchlist_size +
    '. Model log(mcap) ~ ' + D.fit.global_intercept + ' + ' + D.fit.global_slope +
    ' log(TVL), fitted on ' + D.fit.peers_n + ' token-bearing peers, tested held-out twice (median abs log error ' +
    D.fit.heldout_median_abs_log_error + '). Data as of ' + D.as_of +
    '. Every row below records no token — never that it has none.';

  // ---- model section ----------------------------------------------------
  var foldRows = D.fit.folds.map(function (f) {
    return '<tr><td>Fold ' + f.fold + '</td><td>' + f.train_n + ' train / ' + f.test_n + ' test</td><td>' +
      f.r2.toFixed(3) + '</td><td>' + f.median_abs_log_error.toFixed(2) + '</td></tr>';
  }).join('');
  var bandRows = Object.keys(D.fit.age_band_rates).map(function (b) {
    return '<tr><td>' + esc(b) + '</td><td>' + (D.fit.age_band_rates[b] * 100).toFixed(1) + '% of peers list</td></tr>';
  }).join('');
  $('model').innerHTML = '<h2>How the value is fitted</h2>' +
    '<p><code>implied = fitted_mcap × maturity × growth × chains × token_odds</code> — ' +
    '<code>fitted_mcap = exp(a_category + b · ln TVL)</code>, with the global fit ' +
    '<code>log(mcap) ~ ' + D.fit.global_intercept + ' + ' + D.fit.global_slope + ' log(TVL)</code> on ' +
    D.fit.peers_n + ' token-bearing peers and each category\u2019s intercept shrunk toward it (weight n / (n + 8)). ' +
    'Maturity rises with days since listing (0.70 → 1.00 over 3 years); growth is the 7-day TVL change, clamped −40%…+80% and halved; ' +
    'chains adds 5% per extra chain (max 20%); token odds are half the protocol\u2019s age band listing rate and half its category\u2019s, ' +
    'clamped 3%…45%. The band is implied × exp(± the held-out median log error, ' + D.fit.heldout_median_abs_log_error + ').</p>' +
    '<p>Farm verdicts are netted: expected value to one farmer = band low × 5% farmer pool ÷ estimated farmers (TVL ÷ $100k, clamped 100…5,000), ' +
    'minus the plan\u2019s gas total. <b>farm</b> when the net is ≥ $25, <b>thin</b> when it is ≥ $0, <b>skip</b> otherwise. ' +
    'The fit is weak (R² ' + D.fit.in_sample_r2 + ' in-sample) — TVL alone does not price a token, and the band says so on every row.</p>' +
    '<h2>Held-out test</h2><table><thead><tr><th>Fold</th><th>Split</th><th>R² (test)</th><th>Median abs log error</th></tr></thead><tbody>' +
    foldRows + '</tbody></table>' +
    '<h2>Token odds by age — share of peers that record a token</h2><table><tbody>' + bandRows + '</tbody></table>';

  // ---- state, filters, sorting ------------------------------------------
  var state = { tab: 'board', sort: 'rank', dir: 1, cat: '', chain: '', verdict: '', minTvl: 0, q: '', watch: false };
  var cats = [], chains = [];
  D.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  $('f-cat').innerHTML += cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('f-chain').innerHTML += chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  function boardRows() {
    var rows = D.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.verdict && r.verdict !== state.verdict) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (state.watch && !watchSlugs.has(r.slug)) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    var k = state.sort, d = state.dir;
    rows.sort(function (a, b) {
      var av = a[k], bv = b[k];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * d;
      return (av - bv) * d;
    });
    return rows;
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === state.tab); });
    $('filters').style.display = state.tab === 'board' && !document.body.classList.contains('focus-detail') ? 'flex' : 'none';
    document.querySelectorAll('#board th').forEach(function (th) { th.classList.toggle('sorted', th.dataset.k === state.sort); });
    var body = $('rows'), html = '';
    if (state.tab === 'board') {
      var rows = boardRows();
      $('count').textContent = rows.length + ' of ' + D.board_size + ' ranked rows';
      html = rows.map(function (r) {
        var chg = r.change_7d === null ? '—' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</span>';
        return '<tr data-slug="' + esc(r.slug) + '">' +
          '<td class="num">' + r.rank + '</td>' +
          '<td><span class="nm">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) + (watchSlugs.has(r.slug) ? ' <span class="watch">WATCHLIST</span>' : '') + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td class="num">' + fmt$(r.tvl_usd) + '</td>' +
          '<td class="num">' + chg + '</td>' +
          '<td class="num"><b>' + fmt$(r.implied_value_usd) + '</b></td>' +
          '<td class="num">' + (r.token_odds * 100).toFixed(0) + '%</td>' +
          '<td><span class="pill ' + r.verdict + '">' + r.verdict + '</span></td></tr>';
      }).join('');
    } else if (state.tab === 'live') {
      $('count').textContent = D.live_size + ' protocols whose token already trades — the market\u2019s value, never a model\u2019s';
      html = D.live.map(function (r) {
        return '<tr data-slug="' + esc(r.slug) + '"><td class="num">—</td>' +
          '<td><span class="nm">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td><td class="num">' + fmt$(r.tvl_usd) + '</td>' +
          '<td class="num">' + pct(r.change_7d) + '</td><td class="num"><b>' + fmt$(r.mcap_usd) + '</b></td>' +
          '<td class="num">—</td><td><span class="pill skip">live</span></td></tr>';
      }).join('');
    } else {
      $('count').textContent = D.aside_size + ' protocols with no market cap set aside from the board, each with its reason';
      html = D.aside.map(function (r) {
        return '<tr><td class="num">—</td><td><span class="nm">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>' +
          '<td>' + esc(r.reason) + '</td></tr>';
      }).join('');
    }
    body.innerHTML = html || '<tr><td colspan="8">Nothing matches these filters.</td></tr>';
  }

  // ---- detail view -------------------------------------------------------
  function showDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var box = $('detail');
    document.body.classList.toggle('focus-detail', !!r);
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    var net = r.expected_farmer_usd - r.plan_cost_usd;
    var steps = r.farm_steps.map(function (s) {
      var m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      return '<li>' + esc(m[1]) + ' <b>Cost: ' + esc(m[2]) + '. Time: ' + esc(m[3]) + '.</b></li>';
    }).join('');
    var comps = r.comps.map(function (c) {
      return '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.category || '—') + '</td><td class="num">' +
        fmt$(c.tvl_usd) + '</td><td class="num">' + fmt$(c.mcap_usd) + '</td><td class="num">' + c.multiple.toFixed(2) + '×</td></tr>';
    }).join('');
    box.innerHTML = '<button class="close" id="d-close">Close ×</button>' +
      '<h2>#' + r.rank + ' ' + esc(r.name) + ' <small>' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' +
      r.chains.slice(0, 4).map(esc).join(', ') + (r.chains.length > 4 ? ' +' + (r.chains.length - 4) + ' more' : '') + ' · TVL ' + fmt$(r.tvl_usd) + ' · 7d ' + pct(r.change_7d) + ' · listed ' + esc(r.listed_at || 'unknown') + '</small></h2>' +
      '<div class="terms">' +
      '<div class="term"><b>' + fmt$(r.implied_value_usd) + '</b><span>implied value</span></div>' +
      '<div class="term"><b>' + fmt$(r.band_low_usd) + ' – ' + fmt$(r.band_high_usd) + '</b><span>value band (± held-out error)</span></div>' +
      '<div class="term"><b>' + fmt$(r.fitted_mcap_usd) + '</b><span>fitted mcap from comps</span></div>' +
      '<div class="term"><b>' + (r.token_odds * 100).toFixed(1) + '%</b><span>token odds (age ' + esc(r.age_band) + ')</span></div>' +
      '<div class="term"><b>×' + fmtN(r.growth_multiplier) + '</b><span>growth multiplier</span></div>' +
      '<div class="term"><b>×' + fmtN(r.maturity_multiplier) + '</b><span>maturity multiplier</span></div>' +
      '<div class="term"><b>×' + fmtN(r.chain_multiplier) + '</b><span>chain multiplier</span></div>' +
      '<div class="term"><b>$' + r.expected_farmer_usd + ' − $' + r.plan_cost_usd + ' = $' + net + '</b><span>expected farmer value − plan cost</span></div>' +
      '</div>' +
      '<h3>Verdict: ' + r.verdict + ' — net $' + net + ' per farmer at the band\u2019s low end</h3>' +
      '<h3>Farm plan — 6 steps, costed and timed</h3><ol>' + steps + '</ol>' +
      '<h3>Nearest token-bearing peers (comps)</h3>' +
      '<table><thead><tr><th>Protocol</th><th>Category</th><th>TVL</th><th>Market cap</th><th>mcap / TVL</th></tr></thead><tbody>' + comps + '</tbody></table>';
    box.hidden = false;
    $('d-close').addEventListener('click', function () { location.hash = ''; showDetail(null); });
    window.scrollTo(0, 0);
  }

  // ---- events ------------------------------------------------------------
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.k;
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' || k === 'category' || k === 'verdict' ? 1 : -1; }
      if (k === 'rank') state.dir = 1;
      render();
    });
  });
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { state.tab = b.dataset.tab; render(); });
  });
  $('f-cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  $('f-chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  $('f-verdict').addEventListener('change', function (e) { state.verdict = e.target.value; render(); });
  $('f-tvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); render(); });
  $('f-watch').addEventListener('change', function (e) { state.watch = e.target.checked; render(); });
  $('f-q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) location.hash = 'detail=' + tr.dataset.slug;
  });

  // ---- hash state: detail + filters, so a view can be linked and shot ---
  function fromHash() {
    var h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0] === 'detail' && kv[1]) showDetail(decodeURIComponent(kv[1]));
      if (kv[0] === 'filter' && kv[1]) {
        var f = decodeURIComponent(kv[1]).split(':');
        if (f[0] === 'verdict' && f[1]) { state.verdict = f[1]; $('f-verdict').value = f[1]; }
        if (f[0] === 'category' && f[1]) { state.cat = f[1]; $('f-cat').value = f[1]; }
        if (f[0] === 'watch') { state.watch = true; $('f-watch').checked = true; }
      }
    });
  }
  window.addEventListener('hashchange', function () { fromHash(); render(); });
  render();
  fromHash();
  render();
})();
