const player = document.getElementById('player');
const obstaclesContainer = document.getElementById('obstacles');
const distanceSpan = document.getElementById('distance');
const timeSpan = document.getElementById('time');

let playerY = 0;
let velocityY = 0;
let isJumping = false;
let distance = 0;
let timeElapsed = 0;
let gameRunning = true;

const gravity = 0.6;
const jumpPower = -10;
const obstacleSpeed = 5;
const obstacleInterval = 1500;
const gameFPS = 60;

// 점프
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !isJumping) {
    velocityY = jumpPower;
    isJumping = true;
  }
});

// 충돌 체크
function isCollision(playerRect, obsRect) {
  return !(
    playerRect.top > obsRect.bottom ||
    playerRect.bottom < obsRect.top ||
    playerRect.right < obsRect.left ||
    playerRect.left > obsRect.right
  );
}

// 장애물 생성
function spawnObstacle() {
  const obs = document.createElement('div');
  obs.classList.add('obstacle');
  obs.style.left = '800px';
  obstaclesContainer.appendChild(obs);

  const move = setInterval(() => {
    if (!gameRunning) return clearInterval(move);
    let x = parseInt(obs.style.left);
    x -= obstacleSpeed;
    obs.style.left = `${x}px`;

    const playerRect = player.getBoundingClientRect();
    const obsRect = obs.getBoundingClientRect();

    if (isCollision(playerRect, obsRect)) {
      endGame();
    }

    if (x < -30) {
      obs.remove();
      clearInterval(move);
    }
  }, 1000 / gameFPS);
}

// 게임 루프
function gameLoop() {
  if (!gameRunning) return;

  // 중력 적용
  velocityY += gravity;
  playerY += velocityY;

  if (playerY > 0) {
    playerY = 0;
    velocityY = 0;
    isJumping = false;
  }

  player.style.bottom = `${40 + playerY}px`;

  // 거리 & 시간 업데이트
  distance += 0.1;
  timeElapsed += 1 / gameFPS;

  distanceSpan.textContent = distance.toFixed(1);
  timeSpan.textContent = timeElapsed.toFixed(1);

  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  alert(`게임 종료! 거리: ${distance.toFixed(1)}m, 시간: ${timeElapsed.toFixed(1)}s`);
}

// 시작
setInterval(() => {
  if (gameRunning) spawnObstacle();
}, obstacleInterval);

gameLoop();
