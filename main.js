// --- Global State ---
let pastWinningNumbers = [];
let numberFrequencies = {};
let weightedNumberList = [];

// const REQUIRED_HEADERS = ['번호1', '번호2', '번호3', '번호4', '번호5', '번호6'];
const LOCAL_STORAGE_KEY = 'lottoWinningNumbers';

// --- Core Logic ---

// Centralized function to process winning numbers
function processLottoData(numbers) {
  pastWinningNumbers = numbers;
  if (pastWinningNumbers.length === 0) {
    console.warn("No winning numbers processed. Check data source.");
    // Optionally disable statistical button here if no data
  } else {
    calculateFrequencies();
    createWeightedList();
    console.log("Lotto data loaded and processed.");
    // Enable the statistical button now that data is loaded
    const statButton = document.querySelector('.btn-success');
    if (statButton) statButton.disabled = false;
  }
}

// Load data from Local Storage
function loadDataFromLocalStorage() {
  const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (storedData) {
    try {
      const numbers = JSON.parse(storedData);
      processLottoData(numbers);
      console.log("Lotto data loaded from local storage.");
      // If data is loaded from storage, assume a file was previously uploaded successfully.
      // We might want to visually indicate this to the user.
    } catch (e) {
      console.error("Failed to parse lotto data from local storage:", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupt data
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

      if (json.length < 3) { // Expect at least 3 rows: example headers, actual headers, and one data row
        alert("업로드된 엑셀 파일에 예상되는 형식의 데이터가 부족합니다.");
        return;
      }
      
      const newWinningNumbers = [];
      // Start from the third row (index 2) for data, as per the user's example
      for (let i = 2; i < json.length; i++) {
        const row = json[i];
        const lottoSet = [];
        // Extract 6 winning numbers from columns C to H (indices 2 to 7)
        for (let j = 2; j <= 7; j++) { // Columns C to H
          const num = parseInt(row[j], 10);
          if (!isNaN(num) && num >= 1 && num <= 45) {
            lottoSet.push(num);
          }
        }
        if (lottoSet.length === 6) { // Ensure all 6 numbers were successfully parsed
          newWinningNumbers.push(...lottoSet);
        }
      }

      if (newWinningNumbers.length === 0) {
        alert("엑셀 파일에서 유효한 로또 번호를 찾을 수 없습니다. 번호가 1에서 45 사이인지 확인해주세요.");
        return;
      }

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newWinningNumbers));
      processLottoData(newWinningNumbers);
      alert("엑셀 파일이 성공적으로 업로드 및 처리되었습니다!");

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

// Generate the "Ultimate Number" based on highest frequency
function generateUltimateNumber() {
  if (Object.keys(numberFrequencies).length === 0) {
    alert('과거 데이터가 없습니다. 엑셀 파일을 업로드하여 데이터를 먼저 로드해주세요.');
    return;
  }

  // Convert frequencies to an array of [number, frequency] pairs
  const sortedFrequencies = Object.entries(numberFrequencies)
    .sort(([, freqA], [, freqB]) => freqB - freqA); // Sort by frequency descending

  const ultimateSet = new Set();
  for (const [numberStr,] of sortedFrequencies) {
    const num = parseInt(numberStr, 10);
    if (!isNaN(num) && num >= 1 && num <= 45 && ultimateSet.size < 6) {
      ultimateSet.add(num);
    }
    if (ultimateSet.size === 6) {
      break;
    }
  }

  // If fewer than 6 unique numbers appear, fill the rest with random numbers
  // (This scenario is highly unlikely for lotto numbers 1-45 over many draws)
  while (ultimateSet.size < 6) {
    const randomNum = Math.floor(Math.random() * 45) + 1;
    ultimateSet.add(randomNum);
  }

  const finalSet = Array.from(ultimateSet).sort((a, b) => a - b);
  displayLottoSets('ultimateLottoContainer', [finalSet]);
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

  // Disable stat button until data is loaded
  const statButton = document.querySelector('.btn-success');
  if (statButton) {
    statButton.disabled = true;
  }
  
  loadDataFromLocalStorage();
});
