// --- Global State ---
let pastWinningNumbers = [];
let numberFrequencies = {};
let weightedNumberList = [];

const DATA_URL = 'https://raw.githubusercontent.com/godmode2k/lotto645/master/lotto645_%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B81205%ED%9A%8C%EC%B0%A8%EA%B9%8C%EC%A7%80.csv';

// --- Core Logic ---

// Fetch and parse the lotto data from the CSV file
async function fetchAndParseLottoData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    
    // Parse CSV
    const rows = text.split('\n').slice(1); // Skip header row
    pastWinningNumbers = rows.flatMap(row => {
      const columns = row.split(',');
      if (columns.length > 18) {
        return columns.slice(13, 19).map(numStr => parseInt(numStr.trim(), 10)).filter(num => !isNaN(num) && num >= 1 && num <= 45);
      }
      return [];
    });

    if (pastWinningNumbers.length === 0) {
      console.error("Failed to parse winning numbers. Check CSV structure and content.");
      return;
    }

    calculateFrequencies();
    createWeightedList();
    console.log("Lotto data loaded and processed.");
    // Enable the button now that data is loaded
    document.querySelector('.btn-success').disabled = false;

  } catch (error) {
    console.error("Failed to fetch lotto data:", error);
    alert("과거 당첨번호 데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
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
  // Disable stat button until data is loaded
  const statButton = document.querySelector('.btn-success');
  if (statButton) {
    statButton.disabled = true;
  }
  fetchAndParseLottoData();
});
