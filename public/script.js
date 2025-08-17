const canvas = document.getElementById('ladder');
const ctx = canvas.getContext('2d');
const generateBtn = document.getElementById('generate');
const output = document.getElementById('output');

generateBtn.addEventListener('click', () => {
  const names = document.getElementById('names').value.trim().split('\n');
  const results = document.getElementById('results').value.trim().split('\n');
  
  if (names.length !== results.length || names.length < 2) {
    alert('참가자 수와 결과 항목 수가 같고, 2명 이상이어야 합니다.');
    return;
  }

  const cols = names.length;
  const rows = 20;
  const ladder = generateLadder(cols, rows);
  drawLadder(names, results, ladder);

  canvas.onclick = (e) => {
    const x = e.offsetX;
    const colWidth = canvas.width / cols;
    const col = Math.floor(x / colWidth);
    const resultIndex = followLadder(col, ladder);
    output.innerText = `${names[col]} ➡ ${results[resultIndex]}`;
  };
});

function generateLadder(cols, rows) {
  const ladder = Array.from({ length: rows }, () =>
    Array(cols - 1).fill(false)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (Math.random() < 0.3 && !ladder[r][c - 1]) {
        ladder[r][c] = true;
      }
    }
  }
  return ladder;
}

function followLadder(startCol, ladder) {
  let col = startCol;
  for (let r = 0; r < ladder.length; r++) {
    if (col > 0 && ladder[r][col - 1]) {
      col--;
    } else if (col < ladder[0].length && ladder[r][col]) {
      col++;
    }
  }
  return col;
}

function drawLadder(names, results, ladder) {
  const cols = names.length;
  const rows = ladder.length;
  const colWidth = canvas.width / cols;
  const rowHeight = canvas.height / rows;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#000';

  for (let c = 0; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(colWidth * (c + 0.5), 0);
    ctx.lineTo(colWidth * (c + 0.5), canvas.height);
    ctx.stroke();
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (ladder[r][c]) {
        const x = colWidth * (c + 0.5);
        const x2 = colWidth * (c + 1.5);
        const y = rowHeight * r + rowHeight / 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }
    }
  }

  // 이름과 결과 출력
  ctx.font = '14px Arial';
  ctx.fillStyle = '#000';
  names.forEach((name, i) => {
    ctx.fillText(name.trim(), colWidth * (i + 0.5) - 15, -5 + 15);
  });
  results.forEach((result, i) => {
    ctx.fillText(result.trim(), colWidth * (i + 0.5) - 15, canvas.height - 5);
  });
}
