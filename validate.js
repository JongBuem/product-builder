// validate.js — 통계 검증 유틸

async function runValidation() {
  const container = document.getElementById('validateContainer');

  if (!pastDraws || pastDraws.length === 0) {
    alert('데이터가 없습니다. 엑셀 파일을 업로드해주세요.');
    return;
  }

  container.innerHTML = '<p class="text-white-50">검증 실행 중... (10만 회 생성기 테스트 포함, 수초 소요)</p>';
  await new Promise(r => setTimeout(r, 50));

  const results = [];

  // ── 1. 업로드된 데이터 카이제곱 적합도 검정 ─────────
  {
    const N = pastDraws.length;
    const flat = pastDraws.flat();
    const observed = {};
    for (let n = 1; n <= 45; n++) observed[n] = 0;
    for (const n of flat) observed[n]++;

    const expected = N * 6 / 45;
    let chi2 = 0;
    for (let n = 1; n <= 45; n++) {
      chi2 += (observed[n] - expected) ** 2 / expected;
    }
    const df = 44;
    const p = 1 - chi2CDF(chi2, df);
    const reject = p < 0.05;

    results.push({
      title: '1. 실제 로또 데이터 균등성 검정 (H₀: 모든 번호 출현 확률 = 1/45)',
      body: `회차 수: ${N} | χ² = ${chi2.toFixed(3)}, df = ${df}, p = ${p < 0.001 ? '< 0.001' : p.toFixed(4)}<br>
             H₀ ${reject ? '<span class="text-danger">기각 (p < 0.05) — 예상외이나 샘플 수가 충분히 크면 미세한 편차도 기각될 수 있음</span>' : '<span class="text-success">채택 (p ≥ 0.05) — 균등성과 일치</span>'}`,
    });
  }

  // ── 2. 신규 생성기 10만 회 균등성 검정 ──────────────
  {
    const RUNS = 100000;
    const freq = {};
    for (let n = 1; n <= 45; n++) freq[n] = 0;

    // 필터 없이 secureRandomInt 기반 순수 추출
    for (let i = 0; i < RUNS; i++) {
      const sample = secureSample(6);
      for (const n of sample) freq[n]++;
    }

    const expected = RUNS * 6 / 45;
    let chi2 = 0;
    for (let n = 1; n <= 45; n++) {
      chi2 += (freq[n] - expected) ** 2 / expected;
    }
    const df = 44;
    const p = 1 - chi2CDF(chi2, df);
    const reject = p < 0.05;

    const minFreq = Math.min(...Object.values(freq));
    const maxFreq = Math.max(...Object.values(freq));

    results.push({
      title: `2. 신규 생성기 균등성 검정 (${RUNS.toLocaleString()}회, 필터 미적용)`,
      body: `기대 빈도: ${expected.toFixed(1)} | 실제 범위: ${minFreq}~${maxFreq}<br>
             χ² = ${chi2.toFixed(3)}, df = ${df}, p = ${p < 0.001 ? '< 0.001' : p.toFixed(4)}<br>
             ${reject ? '<span class="text-danger">균등성 이탈 감지 — crypto.getRandomValues 구현 확인 필요</span>' : '<span class="text-success">균등 분포 확인됨</span>'}`,
    });
  }

  // ── 3. 필터 통과율 몬테카를로 추정 ──────────────────
  {
    const MC_RUNS = 10000;
    let passed = 0;
    const savedPastDraws = pastDraws;
    const savedFreq = numberFrequencies;

    for (let i = 0; i < MC_RUNS; i++) {
      const combo = secureSample(6).sort((a, b) => a - b);
      if (!isRejected(combo, ALL_FILTERS)) passed++;
    }

    const passRate = passed / MC_RUNS;
    const passPercent = (passRate * 100).toFixed(2);
    const tooLow = passRate < 0.05;

    results.push({
      title: `3. 회피 필터 통과율 몬테카를로 추정 (${MC_RUNS.toLocaleString()}회)`,
      body: `통과: ${passed}/${MC_RUNS} = ${passPercent}%<br>
             ${tooLow
               ? `<span class="text-danger">⚠ 통과율 5% 미만 — 조합 공간이 지나치게 좁아 예측 가능성이 생길 수 있습니다. 필터 완화를 검토하세요.</span>`
               : `<span class="text-success">통과율 정상 (≥ 5%) — 필터가 과도하게 좁지 않음</span>`}`,
    });
  }

  renderValidationResults(results);
}

function renderValidationResults(results) {
  const container = document.getElementById('validateContainer');
  let html = '';
  for (const r of results) {
    html += `
      <div class="mb-4 p-3 rounded" style="background:#2a2a2a; text-align:left">
        <p class="fw-bold mb-2">${r.title}</p>
        <p class="text-white-50 small mb-0">${r.body}</p>
      </div>
    `;
  }
  container.innerHTML = html;
}

// 검증 버튼도 데이터 로드 후 활성화 (backtest.js 패치 이후에 실행)
(function patchForValidate() {
  const _orig = window.processLottoData;
  if (typeof _orig === 'function') {
    window.processLottoData = function(draws) {
      _orig(draws);
      const btn = document.getElementById('btnValidate');
      if (btn) btn.disabled = false;
    };
  }
})();
