// --- Global State ---
let pastDraws = []; // 회차별 배열: [[n1,n2,...,n6], ...]
let pastWinningNumbers = []; // 평탄화 배열 (통계 생성용)
let numberFrequencies = {};
let weightedNumberList = [];

// const REQUIRED_HEADERS = ['번호1', '번호2', '번호3', '번호4', '번호5', '번호6'];
const LOCAL_STORAGE_KEY = 'lottoWinningNumbers';

// --- Core Logic ---

// Centralized function to process winning numbers
// draws: 회차별 배열 [[n1,...,n6], ...] 또는 이전 포맷인 flat 배열
function processLottoData(draws) {
  pastDraws = draws;
  pastWinningNumbers = draws.flat();
  if (pastDraws.length === 0) {
    console.warn("No winning numbers processed. Check data source.");
  } else {
    calculateFrequencies();
    createWeightedList();
    console.log(`Lotto data loaded: ${pastDraws.length}회차 데이터 처리 완료.`);
    ['btnStatistical', 'btnUltimate', 'btnEV'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = false;
    });
  }
}

// Load data from Local Storage
function loadDataFromLocalStorage() {
  const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (storedData) {
    try {
      const parsed = JSON.parse(storedData);
      // 구버전 flat 배열 감지 → 새 포맷으로 변환 불가하므로 무시하고 재업로드 유도
      if (parsed.length > 0 && !Array.isArray(parsed[0])) {
        console.warn("구버전 데이터 포맷 감지. 새 포맷으로 재업로드가 필요합니다.");
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return;
      }
      processLottoData(parsed);
      console.log("Lotto data loaded from local storage.");
    } catch (e) {
      console.error("Failed to parse lotto data from local storage:", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }
}

// Handle Excel file upload
function handleExcelFileUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (json.length < 2) {
        alert("업로드된 엑셀 파일에 예상되는 형식의 데이터가 부족합니다.");
        return;
      }

      // 헤더 행 자동 감지: 열 2~7 모두 유효한 로또 번호(1~45)인 첫 행을 데이터 시작으로 사용
      let dataStartIndex = 0;
      for (let i = 0; i < Math.min(json.length, 5); i++) {
        const row = json[i];
        const nums = [2,3,4,5,6,7].map(j => parseInt(row[j], 10));
        if (nums.every(n => !isNaN(n) && n >= 1 && n <= 45)) {
          dataStartIndex = i;
          break;
        }
        dataStartIndex = i + 1; // 아직 데이터 행 못 찾은 경우 다음으로
      }
      console.log(`헤더 자동 감지: ${dataStartIndex}행부터 데이터 시작`);

      const newWinningNumbers = []; // 회차별 배열: [[n1,...,n6], ...]
      for (let i = dataStartIndex; i < json.length; i++) {
        const row = json[i];
        const lottoSet = [];
        for (let j = 2; j <= 7; j++) {
          const num = parseInt(row[j], 10);
          if (!isNaN(num) && num >= 1 && num <= 45) {
            lottoSet.push(num);
          }
        }
        if (lottoSet.length === 6) {
          newWinningNumbers.push(lottoSet);
        }
      }
      console.log(`파싱된 회차 수: ${newWinningNumbers.length}회차`);

      if (newWinningNumbers.length === 0) {
        alert("엑셀 파일에서 유효한 로또 번호를 찾을 수 없습니다. 번호가 1에서 45 사이인지 확인해주세요.");
        return;
      }

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newWinningNumbers));
      processLottoData(newWinningNumbers);
      alert(`업로드 완료! 총 ${newWinningNumbers.length}회차 데이터가 분석에 사용됩니다.`);

    } catch (error) {
      console.error("Failed to process Excel file:", error);
      alert("엑셀 파일을 처리하는 중 오류가 발생했습니다. 파일이 손상되었거나 형식이 올바르지 않은지 확인해주세요.");
    }
  };
  reader.readAsArrayBuffer(file);
}


// Calculate the frequency of each number
function calculateFrequencies() {
  numberFrequencies = {};
  for (const num of pastWinningNumbers) {
    numberFrequencies[num] = (numberFrequencies[num] || 0) + 1;
  }
}

// Create a weighted list for statistical selection
function createWeightedList() {
  weightedNumberList = [];
  for (const num in numberFrequencies) {
    const frequency = numberFrequencies[num];
    for (let i = 0; i < frequency; i++) {
      weightedNumberList.push(parseInt(num, 10));
    }
  }
}

// --- Generation Functions ---

// Generate a single set of 6 unique lotto numbers (simple random)
function generateSimpleLottoSet() {
  const numbers = new Set();
  while (numbers.size < 6) {
    const num = Math.floor(Math.random() * 45) + 1;
    numbers.add(num);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

// Generate a single set of 6 unique lotto numbers (statistical weighted)
function generateSingleStatisticalSet() {
  const numbers = new Set();
  if (weightedNumberList.length === 0) {
    console.error("Weighted list is not ready.");
    return generateSimpleLottoSet(); // Fallback to simple random
  }
  while (numbers.size < 6) {
    const randomIndex = Math.floor(Math.random() * weightedNumberList.length);
    const num = weightedNumberList[randomIndex];
    numbers.add(num);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

// ─────────────────────────────────────────────
// 궁극의 번호 생성 — 다중 요소 점수 기반 공식
//
// [점수 구성]
//  1. 빈도 점수  (35%) — 전체 기간 출현 빈도 (정규화)
//  2. 최신성 점수 (40%) — 최근 회차일수록 지수적으로 높은 가중치
//                       decay = e^(-0.03 * 최근으로부터_회차수)
//  3. 미출현 점수 (25%) — 평균 출현 간격 대비 오래 안 나온 번호 보정
//                       (오래 안 나올수록 점수 상승, 3배 초과 시 캡)
//
// 각 요소를 0~1로 정규화 후 가중치 합산 → 점수 기반 가중 랜덤 추출 (5세트)
// ─────────────────────────────────────────────
function scoreAllNumbers() {
  const totalDraws = pastDraws.length;
  if (totalDraws === 0) return null;

  const freq = {};
  const lastSeen = {};     // 번호별 마지막 출현 회차 인덱스
  const intervalsList = {}; // 번호별 출현 간격 목록

  for (let n = 1; n <= 45; n++) freq[n] = 0;

  for (let i = 0; i < totalDraws; i++) {
    for (const num of pastDraws[i]) {
      freq[num]++;
      if (lastSeen[num] !== undefined) {
        if (!intervalsList[num]) intervalsList[num] = [];
        intervalsList[num].push(i - lastSeen[num]);
      }
      lastSeen[num] = i;
    }
  }

  // 1. 빈도 점수 (정규화)
  const maxFreq = Math.max(...Object.values(freq));
  const freqScore = {};
  for (let n = 1; n <= 45; n++) {
    freqScore[n] = maxFreq > 0 ? freq[n] / maxFreq : 0;
  }

  // 2. 최신성 점수 (지수 감쇠, 정규화)
  const decayFactor = 0.03;
  const recencyRaw = {};
  for (let n = 1; n <= 45; n++) recencyRaw[n] = 0;

  for (let i = 0; i < totalDraws; i++) {
    const drawsFromNow = totalDraws - 1 - i;
    const weight = Math.exp(-decayFactor * drawsFromNow);
    for (const num of pastDraws[i]) {
      recencyRaw[num] += weight;
    }
  }
  const maxRecency = Math.max(...Object.values(recencyRaw));
  const recencyScore = {};
  for (let n = 1; n <= 45; n++) {
    recencyScore[n] = maxRecency > 0 ? recencyRaw[n] / maxRecency : 0;
  }

  // 3. 미출현(due) 점수 (오래 안 나올수록 높음, 3배 초과 캡)
  const dueScore = {};
  for (let n = 1; n <= 45; n++) {
    const last = lastSeen[n];
    const drawsSinceLast = last !== undefined ? totalDraws - 1 - last : totalDraws;
    const avgInterval = intervalsList[n] && intervalsList[n].length > 0
      ? intervalsList[n].reduce((a, b) => a + b, 0) / intervalsList[n].length
      : (freq[n] > 0 ? totalDraws / freq[n] : totalDraws);
    dueScore[n] = Math.min(drawsSinceLast / avgInterval, 3) / 3;
  }

  // 최종 점수 합산 (빈도 35% + 최신성 40% + 미출현 25%)
  const finalScore = {};
  for (let n = 1; n <= 45; n++) {
    finalScore[n] = freqScore[n] * 0.35 + recencyScore[n] * 0.40 + dueScore[n] * 0.25;
  }

  return finalScore;
}

function generateUltimateNumber() {
  if (pastDraws.length === 0) {
    alert('과거 데이터가 없습니다. 엑셀 파일을 업로드하여 데이터를 먼저 로드해주세요.');
    return;
  }

  const scores = scoreAllNumbers();
  const scoreEntries = Object.entries(scores).map(([n, s]) => [parseInt(n, 10), s]);

  const sets = [];
  for (let s = 0; s < 5; s++) {
    const chosen = new Set();
    const pool = [...scoreEntries]; // 남은 후보 풀 (중복 방지)

    while (chosen.size < 6 && pool.length > 0) {
      const totalWeight = pool.reduce((sum, [, w]) => sum + w, 0);
      let rand = Math.random() * totalWeight;
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
      // 부동소수점 오차로 아무것도 선택되지 않은 경우 폴백
      if (!selected && pool.length > 0) {
        chosen.add(pool[pool.length - 1][0]);
        pool.pop();
      }
    }

    sets.push(Array.from(chosen).sort((a, b) => a - b));
  }

  displayLottoSets('ultimateLottoContainer', sets);
}


// --- UI Functions ---

function getBallColorClass(number) {
  if (number <= 10) return 'ball-color-1';
  if (number <= 20) return 'ball-color-2';
  if (number <= 30) return 'ball-color-3';
  if (number <= 40) return 'ball-color-4';
  return 'ball-color-5';
}

function displayLottoSets(containerId, sets) {
  const container = document.getElementById(containerId);
  container.innerHTML = ''; // Clear previous results

  sets.forEach(numbers => {
    const setDiv = document.createElement('div');
    setDiv.className = 'lotto-set';

    numbers.forEach(num => {
      const ball = document.createElement('div');
      ball.className = `ball ${getBallColorClass(num)}`;
      ball.textContent = num;
      setDiv.appendChild(ball);
    });

    container.appendChild(setDiv);
  });
}

// --- Button Click Handlers ---

function generateSimpleSets() {
  const sets = [];
  for (let i = 0; i < 5; i++) {
    sets.push(generateSimpleLottoSet());
  }
  displayLottoSets('simpleLottoContainer', sets);
}

function generateStatisticalSets() {
  if (weightedNumberList.length === 0) {
    alert('아직 과거 데이터가 로딩 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  
  const sets = [];
  for (let i = 0; i < 5; i++) {
    sets.push(generateSingleStatisticalSet());
  }
  displayLottoSets('statisticalLottoContainer', sets);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  const excelFileInput = document.getElementById('excelFileInput');
  if (excelFileInput) {
    excelFileInput.addEventListener('change', handleExcelFileUpload);
  }

  const uploadPastDataBtn = document.getElementById('uploadPastDataBtn');
  if (uploadPastDataBtn) {
    uploadPastDataBtn.addEventListener('click', () => {
      excelFileInput.click();
    });
  }

  // 데이터 필요 버튼 초기 비활성화 (데이터 로드 후 processLottoData에서 활성화)
  ['btnStatistical', 'btnUltimate', 'btnEV'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
  });
  
  loadDataFromLocalStorage();
});
