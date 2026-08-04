// backtest.js — 전략 백테스트
// 학습구간(60%) 데이터로 5가지 전략 각 500세트 생성 후 검증구간(40%)과 대조

const BACKTEST_SETS_PER_STRATEGY = 500;
const PRIZE = { 3: 1500000, 4: 50000, 5: 5000 };

// ── 검증구간 대조 ────────────────────────────────
function checkMatches(generatedSet, winningSet) {
  const ws = new Set(winningSet);
  return generatedSet.filter(n => ws.has(n)).length;
}

function rankFromMatches(matches) {
  if (matches === 6) return 1;
  if (matches === 5) return 2; // 보너스 무시 (단순화)
  if (matches === 4) return 4;
  if (matches === 3) return 5;
  return 0;
}

function evaluateSetsAgainstDraws(sets, validationDraws) {
  const rankCounts = { 3: 0, 4: 0, 5: 0, 1: 0, 2: 0 };
  let totalPrize = 0;

  for (const s of sets) {
    for (const draw of validationDraws) {
      const m = checkMatches(s, draw);
      const rank = rankFromMatches(m);
      if (rank >= 3 && rank <= 5) {
        rankCounts[rank]++;
        totalPrize += PRIZE[rank];
      } else if (rank === 1 || rank === 2) {
        rankCounts[rank]++;
      }
    }
  }

  return { rankCounts, totalPrize };
}

// ── 전략별 세트 생성 ─────────────────────────────

function strategyRandom(n) {
  const sets = [];
  for (let i = 0; i < n; i++) {
    const pool = Array.from({ length: 45 }, (_, k) => k + 1);
    const chosen = [];
    for (let j = 0; j < 6; j++) {
      const idx = Math.floor(Math.random() * (pool.length - j));
      chosen.push(pool[idx]);
      [pool[idx], pool[pool.length - 1 - j]] = [pool[pool.length - 1 - j], pool[idx]];
    }
    sets.push(chosen.sort((a, b) => a - b));
  }
  return sets;
}

function strategyWeighted(trainDraws, n) {
  const flat = trainDraws.flat();
  const freq = {};
  for (const num of flat) freq[num] = (freq[num] || 0) + 1;
  const weighted = [];
  for (const [num, cnt] of Object.entries(freq)) {
    for (let i = 0; i < cnt; i++) weighted.push(parseInt(num, 10));
  }
  const sets = [];
  for (let i = 0; i < n; i++) {
    const chosen = new Set();
    while (chosen.size < 6) {
      chosen.add(weighted[Math.floor(Math.random() * weighted.length)]);
    }
    sets.push(Array.from(chosen).sort((a, b) => a - b));
  }
  return sets;
}

function strategyUltimate(trainDraws, n) {
  const scores = scoreAllNumbersFromDraws(trainDraws);
  const scoreEntries = Object.entries(scores).map(([num, s]) => [parseInt(num, 10), s]);
  const sets = [];
  for (let s = 0; s < n; s++) {
    const chosen = new Set();
    const pool = [...scoreEntries];
    while (chosen.size < 6 && pool.length > 0) {
      const total = pool.reduce((sum, [, w]) => sum + w, 0);
      let rand = Math.random() * total;
      let selected = false;
      for (let i = 0; i < pool.length; i++) {
        rand -= pool[i][1];
        if (rand <= 0) {
          chosen.add(pool[i][0]);
          pool.splice(i, 1);
          selected = true;
          break;
        }
      }
      if (!selected && pool.length > 0) {
        chosen.add(pool[pool.length - 1][0]);
        pool.pop();
      }
    }
    sets.push(Array.from(chosen).sort((a, b) => a - b));
  }
  return sets;
}


function strategyEV(trainDraws, n) {
  // 학습 데이터로 임시 전역 상태를 교체하여 ev-generator 필터를 활용
  const savedPastDraws = pastDraws;
  const savedFreq = numberFrequencies;
  pastDraws = trainDraws;
  const flat = trainDraws.flat();
  numberFrequencies = {};
  for (const num of flat) numberFrequencies[num] = (numberFrequencies[num] || 0) + 1;

  const sets = [];
  const MAX_RETRIES = 5000;
  for (let i = 0; i < n; i++) {
    let set = generateSingleEVSet([...ALL_FILTERS], MAX_RETRIES);
    if (!set) {
      // 필터 없이 폴백
      const numbers = secureSample(6).sort((a, b) => a - b);
      set = { numbers, attempts: MAX_RETRIES };
    }
    sets.push(set.numbers);
  }

  pastDraws = savedPastDraws;
  numberFrequencies = savedFreq;
  return sets;
}

// 학습 데이터 기반 scoreAllNumbers (main.js 로직 복제, 전역 상태 불변)
function scoreAllNumbersFromDraws(draws) {
  const totalDraws = draws.length;
  if (totalDraws === 0) return {};
  const freq = {};
  const lastSeen = {};
  const intervalsList = {};
  for (let n = 1; n <= 45; n++) freq[n] = 0;
  for (let i = 0; i < totalDraws; i++) {
    for (const num of draws[i]) {
      freq[num]++;
      if (lastSeen[num] !== undefined) {
        if (!intervalsList[num]) intervalsList[num] = [];
        intervalsList[num].push(i - lastSeen[num]);
      }
      lastSeen[num] = i;
    }
  }
  const maxFreq = Math.max(...Object.values(freq));
  const freqScore = {};
  for (let n = 1; n <= 45; n++) freqScore[n] = maxFreq > 0 ? freq[n] / maxFreq : 0;

  const decayFactor = 0.03;
  const recencyRaw = {};
  for (let n = 1; n <= 45; n++) recencyRaw[n] = 0;
  for (let i = 0; i < totalDraws; i++) {
    const w = Math.exp(-decayFactor * (totalDraws - 1 - i));
    for (const num of draws[i]) recencyRaw[num] += w;
  }
  const maxRecency = Math.max(...Object.values(recencyRaw));
  const recencyScore = {};
  for (let n = 1; n <= 45; n++) recencyScore[n] = maxRecency > 0 ? recencyRaw[n] / maxRecency : 0;

  const dueScore = {};
  for (let n = 1; n <= 45; n++) {
    const last = lastSeen[n];
    const since = last !== undefined ? totalDraws - 1 - last : totalDraws;
    const avg = intervalsList[n] && intervalsList[n].length > 0
      ? intervalsList[n].reduce((a, b) => a + b, 0) / intervalsList[n].length
      : (freq[n] > 0 ? totalDraws / freq[n] : totalDraws);
    dueScore[n] = Math.min(since / avg, 3) / 3;
  }

  const finalScore = {};
  for (let n = 1; n <= 45; n++) {
    finalScore[n] = freqScore[n] * 0.35 + recencyScore[n] * 0.40 + dueScore[n] * 0.25;
  }
  return finalScore;
}

// ── 카이제곱 검정 (전략 간 3~5등 적중 횟수) ────────
function chiSquareTest(observed) {
  // observed: [궁극, 가중, 핫, 무작위, EV] 각 전략의 총 적중(3+4+5등 합산) 횟수
  const total = observed.reduce((a, b) => a + b, 0);
  const expected = total / observed.length;
  if (expected === 0) return { chi2: 0, df: observed.length - 1, p: 1 };
  let chi2 = 0;
  for (const obs of observed) {
    chi2 += (obs - expected) ** 2 / expected;
  }
  const df = observed.length - 1;
  // p값 근사 (카이제곱 누적분포 역산, 간단한 감마 정규화 근사)
  const p = 1 - chi2CDF(chi2, df);
  return { chi2, df, p };
}

// 카이제곱 CDF 근사 (Wilson-Hilferty 변환)
function chi2CDF(x, df) {
  if (x <= 0) return 0;
  const k = df / 2;
  return regularizedGammaP(k, x / 2);
}

function regularizedGammaP(a, x) {
  if (x < 0) return 0;
  if (x === 0) return 0;
  // 급수 전개
  let sum = 1 / a;
  let term = 1 / a;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function logGamma(z) {
  // Lanczos 근사
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// ── 메인 백테스트 실행 ───────────────────────────
async function runBacktest() {
  if (!pastDraws || pastDraws.length < 10) {
    alert('데이터가 충분하지 않습니다. 엑셀 파일을 업로드해주세요.');
    return;
  }

  const container = document.getElementById('backtestContainer');
  container.innerHTML = '<p class="text-white-50">백테스트 실행 중... (잠시 기다려주세요)</p>';

  // 비동기로 UI 업데이트 후 실행
  await new Promise(r => setTimeout(r, 50));

  const splitIdx = Math.floor(pastDraws.length * 0.6);
  const trainDraws = pastDraws.slice(0, splitIdx);
  const validDraws = pastDraws.slice(splitIdx);

  if (validDraws.length === 0) {
    container.innerHTML = '<p class="text-danger">검증 구간이 너무 짧습니다.</p>';
    return;
  }

  const N = BACKTEST_SETS_PER_STRATEGY;

  const strategies = [
    { name: '궁극의 번호', sets: strategyUltimate(trainDraws, N) },
    { name: '데이터 기반 가중', sets: strategyWeighted(trainDraws, N) },
    { name: '완전 무작위', sets: strategyRandom(N) },
    { name: '회피 필터(EV)', sets: strategyEV(trainDraws, N) },
  ];

  const results = strategies.map(s => {
    const { rankCounts, totalPrize } = evaluateSetsAgainstDraws(s.sets, validDraws);
    const hits345 = rankCounts[3] + rankCounts[4] + rankCounts[5];
    return { name: s.name, rankCounts, totalPrize, hits345 };
  });

  // 통계적 유의성 검정
  const observed = results.map(r => r.hits345);
  const { chi2, df, p } = chiSquareTest(observed);

  if (p < 0.05) {
    console.warn('[Backtest] 특정 전략이 유의하게 앞섭니다. 데이터 누수나 구현 버그 가능성을 확인하세요. p =', p.toFixed(4));
  }

  renderBacktestTable(results, { chi2, df, p }, splitIdx, validDraws.length);
}

function renderBacktestTable(results, stat, trainSize, validSize) {
  const container = document.getElementById('backtestContainer');

  let html = `
    <p class="text-white-50 small">학습: ${trainSize}회차 / 검증: ${validSize}회차 / 전략당 ${BACKTEST_SETS_PER_STRATEGY}세트</p>
    <div class="table-responsive">
    <table class="table table-dark table-bordered table-sm text-center">
      <thead>
        <tr>
          <th>전략</th><th>1등</th><th>2등</th><th>3등</th><th>4등</th><th>5등</th><th>총 환급액(원)</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const r of results) {
    const rc = r.rankCounts;
    html += `<tr>
      <td>${r.name}</td>
      <td>${rc[1] || 0}</td><td>${rc[2] || 0}</td>
      <td>${rc[3] || 0}</td><td>${rc[4] || 0}</td><td>${rc[5] || 0}</td>
      <td>${r.totalPrize.toLocaleString()}</td>
    </tr>`;
  }

  const pStr = stat.p < 0.001 ? '< 0.001' : stat.p.toFixed(4);
  const significant = stat.p < 0.05;

  html += `
      </tbody>
    </table>
    </div>
    <div class="mt-3 p-3 rounded" style="background:#2a2a2a">
      <p class="mb-1 text-white-50 small">카이제곱 검정 (3~5등 적중 횟수): χ²=${stat.chi2.toFixed(3)}, df=${stat.df}, p=${pStr}</p>
      ${significant
        ? '<p class="text-danger small">⚠ p < 0.05: 특정 전략이 유의하게 앞섭니다. 데이터 누수나 구현 버그 가능성을 확인하세요.</p>'
        : '<p class="text-success small">p ≥ 0.05: 전략 간 차이가 통계적으로 유의하지 않습니다.</p>'
      }
      <p class="text-white-50 small mb-0">5개 전략의 적중률이 통계적으로 구분되지 않으면, 그것이 정상입니다.</p>
      <p class="text-white-50 small mb-0">1·2등 환급액은 분배식이라 별도 표기 (횟수만 참고)</p>
    </div>
  `;

  container.innerHTML = html;
}

// 백테스트 버튼도 데이터 로드 후 활성화
(function patchProcessLottoData() {
  const _orig = window.processLottoData;
  if (typeof _orig === 'function') {
    window.processLottoData = function(draws) {
      _orig(draws);
      const btn = document.getElementById('btnBacktest');
      if (btn) btn.disabled = false;
    };
  }
})();
