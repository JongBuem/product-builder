// ev-generator.js — 기대 수령액 최적화 생성기
// 당첨 확률 향상 기능 아님. 분배 인원 감소를 목적으로 인기 패턴을 회피함.

const EV_FILTER_CONFIG = {
  lowHighCoverage: true,       // [A1] 32~45 구간 2개 미만
  consecutiveTriple: true,     // [A2] 연속 번호 3개 이상
  arithmeticProg: true,        // [A3] 4개 이상 등차수열
  gridConcentration: true,     // [A4] 마킹지 7열 그리드 같은 행/열 4개 이상
  lowEndingVariety: true,      // [A5] 끝자리 종류 3종 이하
  allSameDigitRange: true,     // [A6] 전부 한 자릿수 또는 전부 두 자릿수
  hotOverall: true,            // [B1] 전체 빈도 상위 12개 중 4개 이상
  hotRecent: true,             // [B2] 최근 50회차 상위 12개 중 4개 이상
  pastCombination: true,       // [C1] 과거 당첨조합과 5개 이상 일치
  recentDraw: true,            // [C2] 직전 5회차 번호 3개 이상 포함
};

// 암호학적 안전 난수 (모듈로 편향 제거)
function secureRandomInt(maxExclusive) {
  const limit = (2 ** 32) - ((2 ** 32) % maxExclusive);
  const arr = new Uint32Array(1);
  do {
    crypto.getRandomValues(arr);
  } while (arr[0] >= limit);
  return arr[0] % maxExclusive;
}

// 부분 Fisher-Yates 셔플로 count개 비복원 추출 (정렬은 최종 출력 시에만)
function secureSample(count) {
  const arr = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = 0; i < count; i++) {
    const j = i + secureRandomInt(45 - i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

// ── 필터 함수들 ──────────────────────────────────

function filterLowHighCoverage(combo) {
  // 32~45 구간 번호가 2개 미만이면 true(거부)
  return combo.filter(n => n >= 32).length < 2;
}

function filterConsecutiveTriple(combo) {
  const sorted = [...combo].sort((a, b) => a - b);
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      streak++;
      if (streak >= 3) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}

function filterArithmeticProg(combo) {
  // 4개 이상이 등차수열을 이루면 true(거부)
  const sorted = [...combo].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 3; i++) {
    for (let j = i + 1; j < sorted.length - 2; j++) {
      const diff = sorted[j] - sorted[i];
      if (diff === 0) continue;
      let count = 2;
      let prev = sorted[j];
      for (let k = j + 1; k < sorted.length; k++) {
        if (sorted[k] - prev === diff) {
          count++;
          prev = sorted[k];
          if (count >= 4) return true;
        }
      }
    }
  }
  return false;
}

function filterGridConcentration(combo) {
  // 1~45를 7열 그리드로 배치: row = Math.floor((n-1)/7), col = (n-1)%7
  const rowCount = {};
  const colCount = {};
  for (const n of combo) {
    const r = Math.floor((n - 1) / 7);
    const c = (n - 1) % 7;
    rowCount[r] = (rowCount[r] || 0) + 1;
    colCount[c] = (colCount[c] || 0) + 1;
    if (rowCount[r] >= 4 || colCount[c] >= 4) return true;
  }
  return false;
}

function filterLowEndingVariety(combo) {
  const endings = new Set(combo.map(n => n % 10));
  return endings.size <= 3;
}

function filterAllSameDigitRange(combo) {
  const allSingle = combo.every(n => n <= 9);
  const allDouble = combo.every(n => n >= 10);
  return allSingle || allDouble;
}

function filterHotOverall(combo) {
  if (!numberFrequencies || Object.keys(numberFrequencies).length === 0) return false;
  const sorted = Object.entries(numberFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([n]) => parseInt(n, 10));
  const hotSet = new Set(sorted);
  return combo.filter(n => hotSet.has(n)).length >= 4;
}

function filterHotRecent(combo) {
  if (!pastDraws || pastDraws.length === 0) return false;
  const recent50 = pastDraws.slice(-50).flat();
  const recentFreq = {};
  for (const n of recent50) recentFreq[n] = (recentFreq[n] || 0) + 1;
  const sorted = Object.entries(recentFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([n]) => parseInt(n, 10));
  const hotSet = new Set(sorted);
  return combo.filter(n => hotSet.has(n)).length >= 4;
}

function filterPastCombination(combo) {
  if (!pastDraws || pastDraws.length === 0) return false;
  const comboSet = new Set(combo);
  for (const draw of pastDraws) {
    const matches = draw.filter(n => comboSet.has(n)).length;
    if (matches >= 5) return true;
  }
  return false;
}

function filterRecentDraw(combo) {
  if (!pastDraws || pastDraws.length === 0) return false;
  const last5 = pastDraws.slice(-5);
  const comboSet = new Set(combo);
  for (const draw of last5) {
    const matches = draw.filter(n => comboSet.has(n)).length;
    if (matches >= 3) return true;
  }
  return false;
}

// 활성화된 필터 순서 목록 (완화 시 뒤에서부터 제거)
const ALL_FILTERS = [
  { key: 'lowHighCoverage',   fn: filterLowHighCoverage },
  { key: 'consecutiveTriple', fn: filterConsecutiveTriple },
  { key: 'arithmeticProg',    fn: filterArithmeticProg },
  { key: 'gridConcentration', fn: filterGridConcentration },
  { key: 'lowEndingVariety',  fn: filterLowEndingVariety },
  { key: 'allSameDigitRange', fn: filterAllSameDigitRange },
  { key: 'hotOverall',        fn: filterHotOverall },
  { key: 'hotRecent',         fn: filterHotRecent },
  { key: 'pastCombination',   fn: filterPastCombination },
  { key: 'recentDraw',        fn: filterRecentDraw },
];

function isRejected(combo, activeFilters) {
  for (const { key, fn } of activeFilters) {
    if (EV_FILTER_CONFIG[key] && fn(combo)) return true;
  }
  return false;
}

function countPassedFilters(combo) {
  let passed = 0;
  for (const { key, fn } of ALL_FILTERS) {
    if (EV_FILTER_CONFIG[key] && !fn(combo)) passed++;
  }
  return passed;
}

// 단일 EV 최적화 세트 생성 (재시도 횟수 반환 포함)
function generateSingleEVSet(activeFilters, maxRetries) {
  let attempts = 0;
  while (attempts < maxRetries) {
    const combo = secureSample(6);
    attempts++;
    if (!isRejected(combo, activeFilters)) {
      return { numbers: combo.sort((a, b) => a - b), attempts };
    }
  }
  return null;
}

// 세트 간 중복 검사: 4개 이상 겹치면 true
function setsOverlap(a, b) {
  const setA = new Set(a);
  return b.filter(n => setA.has(n)).length >= 4;
}

// 메인 함수 — index.html 버튼에서 호출
function generateEVOptimizedSets() {
  if (!pastDraws || pastDraws.length === 0) {
    alert('과거 데이터가 없습니다. 엑셀 파일을 업로드하여 데이터를 먼저 로드해주세요.');
    return;
  }

  const MAX_RETRIES = 10000;
  const TARGET_SETS = 5;
  let activeFilters = [...ALL_FILTERS];
  const results = [];
  let relaxationCount = 0;

  while (results.length < TARGET_SETS) {
    let set = null;
    let outerAttempts = 0;

    while (!set || results.some(r => setsOverlap(r.numbers, set.numbers))) {
      outerAttempts++;
      set = generateSingleEVSet(activeFilters, MAX_RETRIES);

      if (!set) {
        // 필터 완화: 뒤에서부터 하나씩 제거
        if (activeFilters.length > 0) {
          const removed = activeFilters.pop();
          relaxationCount++;
          console.warn(`[EV Generator] 필터 완화: "${removed.key}" 비활성화 (총 ${relaxationCount}회 완화)`);
        } else {
          // 모든 필터 제거 후에도 실패하면 순수 랜덤
          console.warn('[EV Generator] 모든 필터 제거 후에도 생성 실패. 순수 랜덤 사용.');
          const numbers = secureSample(6).sort((a, b) => a - b);
          set = { numbers, attempts: MAX_RETRIES };
          break;
        }
        continue;
      }

      if (outerAttempts > MAX_RETRIES) {
        console.warn('[EV Generator] 세트 간 중복 회피 한계 초과.');
        break;
      }
    }

    if (set) {
      const passedFilters = countPassedFilters(set.numbers);
      const totalActive = activeFilters.filter(f => EV_FILTER_CONFIG[f.key]).length;
      results.push({
        numbers: set.numbers,
        attempts: set.attempts,
        passedFilters,
        totalFilters: totalActive,
      });
    }
  }

  displayEVSets(results);
}

function displayEVSets(results) {
  const container = document.getElementById('evLottoContainer');
  container.innerHTML = '';

  results.forEach((result, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-3';

    const setDiv = document.createElement('div');
    setDiv.className = 'lotto-set';

    result.numbers.forEach(num => {
      const ball = document.createElement('div');
      ball.className = `ball ${getBallColorClass(num)}`;
      ball.textContent = num;
      setDiv.appendChild(ball);
    });

    const meta = document.createElement('div');
    meta.className = 'text-white-50 small mt-1';
    meta.textContent = `필터 통과 ${result.passedFilters}/${result.totalFilters}개 · 재추출 ${result.attempts - 1}회`;

    const disclaimer = document.createElement('div');
    disclaimer.className = 'text-warning small';
    disclaimer.textContent = '이 필터는 당첨 확률을 높이지 않습니다';

    wrapper.appendChild(setDiv);
    wrapper.appendChild(meta);
    wrapper.appendChild(disclaimer);
    container.appendChild(wrapper);
  });
}
