let scene;
let camera;
let renderer;

// 플레이어 상태
const players = []; // { group: THREE.Group, speed: number, dir: 1|-1 }
const LANE_COUNT = 8;
const RIGHT_BOUND = 5;
const LEFT_BOUND = -5;
const LINE_Y = 0.006;

const clock = new THREE.Clock();

// 동기화 리셋 상태  
let raceFinished = false;
let resetting = false;          // 리셋 중인지
let readyDelay = 0;             // 리셋 후 대기 시간(초)
const READY_DELAY_SEC = 0.6;    // 리셋 후 잠깐 멈추는 연출(원하면 0으로)

// 속도 관련 상수 (초당 단위)
const BASE_MIN = 0.8;   // 느린 플레이어 기본 속도
const BASE_MAX = 1.6;   // 빠른 플레이어 기본 속도
const TARGET_MIN_FACTOR = 0.5; // 감속 하한 (기본 속도의 배수)
const TARGET_MAX_FACTOR = 1.8; // 가속 상한 (기본 속도의 배수)
const CHANGE_INTERVAL_MIN = 0.6; // 속도 변경 최소 간격(초)
const CHANGE_INTERVAL_MAX = 1.8; // 속도 변경 최대 간격(초)

const TURBO = {
  multiplier: 2.5,       // 터보 시 속도 배수
  minDuration: 0.6,      // 터보 최소 지속 시간 (초)
  maxDuration: 1.2,      // 터보 최대 지속 시간 (초)
  cooldownMin: 2.0,      // 터보 최소 쿨다운 (초)
  cooldownMax: 4.0,      // 터보 최대 쿨다운 (초)
  spawnChancePerSec: 0.35 // 터보가 쿨다운이 끝났을 때 초당 발동 확률
};

// 슬로우 모션 상태
const slowmo = {
  active: false,
  factor: 0.25,        // 슬로우 배속 (0.25 = 1/4속)
  triggerX: RIGHT_BOUND - 1, // 결승선 3m 전
  maxDuration: 2.0,    // 최대 지속 시간(초)
  timeLeft: 0
};

function rand(min, max) { return Math.random() * (max - min) + min; }

function animate() {
  requestAnimationFrame(animate);

  const dtRaw = clock.getDelta();        // 실제 지난 시간(초)
  // 슬로모가 켜지면 dt를 줄여서 모든 업데이트 속도를 느리게
  const dt = slowmo.active ? dtRaw * slowmo.factor : dtRaw;

  // 리셋 대기 중이면 정지
  if (resetting) {
    // 리셋 중에는 슬로모 끔
    if (slowmo.active) { slowmo.active = false; setSlowmoUI(false); }
    readyDelay -= dtRaw;                 // 카운트다운은 실제 시간 기준으로 줄이자
    if (readyDelay <= 0) {
      resetting = false;
      raceFinished = false;
    }
    renderer.render(scene, camera);
    return;
  }

  // ----- 슬로모 트리거: 아직 우승자 없고 슬로모 꺼져 있고 누구든 3m 전선 통과 -----
  if (!raceFinished && !slowmo.active) {
    for (const p of players) {
      if (p.group.position.x >= slowmo.triggerX) {
        slowmo.active = true;
        slowmo.timeLeft = slowmo.maxDuration;
        setSlowmoUI(true);
        break;
      }
    }
  }

  // ----- 메인 업데이트 -----
  for (const p of players) {
    // 1) 기본 가속/감속 타이밍
    p.timeSinceChange += dt;
    if (p.timeSinceChange >= p.nextChangeIn) {
      const factor = rand(TARGET_MIN_FACTOR, TARGET_MAX_FACTOR);
      p.targetSpeed = p.baseSpeed * factor;
      p.timeSinceChange = 0;
      p.nextChangeIn = rand(CHANGE_INTERVAL_MIN, CHANGE_INTERVAL_MAX);
    }

    // 2) 터보 갱신 (지속시간/쿨다운도 dt로 느려짐 → 슬로모 동안 천천히 줄어듦)
    if (p.turboActive) {
      p.turboTimeLeft -= dt;
      if (p.turboTimeLeft <= 0) setTurbo(p, false);
    } else {
      p.turboCooldown -= dt;
      if (p.turboCooldown <= 0 && Math.random() < TURBO.spawnChancePerSec * dt) {
        setTurbo(p, true);
      }
    }

    // 3) 속도 이징
    const effectiveTarget = p.targetSpeed * (p.turboActive ? TURBO.multiplier : 1);
    p.speed += (effectiveTarget - p.speed) * Math.min(1, dt * 3);

    // 4) 이동
    p.group.position.x += p.speed * p.dir * dt;

    // 5) 우승 판정: 이번 라운드 첫 통과자만
    if (!raceFinished && p.group.position.x >= RIGHT_BOUND) {
      p.laps = (p.laps || 0) + 1;
      announceWinner(p);    // 우승 배너/스코어
      raceFinished = true;
      // 우승 순간 슬로모 해제 (연출 유지하고 싶으면 아래 두 줄 주석)
      if (slowmo.active) { slowmo.active = false; setSlowmoUI(false); }
      beginReset();         // 전원 텔레포트 & 대기
      break;
    }

    // 6) 회전 왕복
    p.group.children.forEach(mesh => {
      if (mesh.userData.rotateDir === undefined) mesh.userData.rotateDir = 1;
      mesh.rotation.x += 0.01 * mesh.userData.rotateDir;
      mesh.rotation.y += 0.01 * mesh.userData.rotateDir;
      if (mesh.rotation.x > 0.5) { mesh.rotation.x = 0.5; mesh.userData.rotateDir = -1; }
      else if (mesh.rotation.x < -0.5) { mesh.rotation.x = -0.5; mesh.userData.rotateDir = 1; }
    });
  }

  // ----- 슬로모 유지시간 관리 -----
  if (slowmo.active) {
    slowmo.timeLeft -= dtRaw;     // 슬로모 총 길이는 실제 시간 기준
    if (slowmo.timeLeft <= 0) {
      slowmo.active = false;
      setSlowmoUI(false);
    }
  }

  renderer.render(scene, camera);
}


function ensureSlowmoBanner() {
  if (document.getElementById('slowmoBanner')) return;
  const b = document.createElement('div');
  b.id = 'slowmoBanner';
  Object.assign(b.style, {
    position:'fixed', top:'20px', right:'20px',
    padding:'8px 12px', borderRadius:'10px',
    background:'rgba(0,0,0,0.55)', color:'#fff',
    font:'700 14px/1 system-ui,Arial', letterSpacing:'.4px',
    zIndex:9999, display:'none'
  });
  b.textContent = 'SLOW MOTION';
  document.body.appendChild(b);
}
ensureSlowmoBanner();
function setSlowmoUI(on){
  const el = document.getElementById('slowmoBanner');
  if (!el) return;
  el.style.display = on ? 'block' : 'none';
}

// 리사이즈 대응
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function createLight() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
  dirLight.position.set(5, 8, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  dirLight.shadow.bias = -0.0005;
  return [ambient, dirLight];
}

function createPlayer(initialX = 0, laneZ = 0, name) {
  const group = new THREE.Group();
  const red = createCube(2, 1.5, 'red');
  const blue = createCube(3.5, 1, 'blue');
  group.add(red);
  group.add(blue);
  group.position.set(initialX, 0, laneZ);

  const label = createLabel(name);
  label.position.set(0, 5, 0); // 큐브 위쪽에 띄우기
  group.add(label);

  const baseSpeed = rand(BASE_MIN, BASE_MAX);

  return {
    name,
    group,
    wins: 0,
    baseSpeed,
    speed: baseSpeed,
    targetSpeed: baseSpeed,
    dir: 1,                // 항상 오른쪽으로 달리기
    startX: initialX,      // 출발선 x 기록
    timeSinceChange: 0,
    nextChangeIn: rand(CHANGE_INTERVAL_MIN, CHANGE_INTERVAL_MAX),
    // 터보 상태가 있다면 여기에 포함
    turboActive: false,
    turboTimeLeft: 0,
    turboCooldown: rand(TURBO.cooldownMin, TURBO.cooldownMax),
    laps: 0               // 랩 카운트(선택)
  };
}

// 선수위의 이름 레이블을 달기 위한 function
function createLabel(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 128;

  // 텍스트 스타일
  ctx.fillStyle = "white";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 1, 1); // 라벨 크기 조정
  return sprite;
}


function createCube(y, size, color) {
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const cube = new THREE.Mesh(geo, mat);
  cube.position.y = y + size / 2;
  cube.castShadow = true;
  return cube;
}

function createFloor() {
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.9,
    metalness: 0.0
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  return floor;
}

function setTurbo(p, on) {
  if (on) {
    p.turboActive = true;
    p.turboTimeLeft = rand(TURBO.minDuration, TURBO.maxDuration);
    // 시각 효과. 발광 살짝 주기
    p.group.children.forEach(mesh => {
      if (!mesh.material) return;
      mesh.userData._origEmissive = mesh.material.emissive?.clone?.() || new THREE.Color(0x000000);
      mesh.material.emissive = new THREE.Color(0xffff66);
      mesh.material.emissiveIntensity = 0.6;
      // 살짝 커지게
      mesh.scale.set(1.06, 1.06, 1.06);
    });
  } else {
    p.turboActive = false;
    p.turboCooldown = rand(TURBO.cooldownMin, TURBO.cooldownMax);
    // 시각 효과 되돌리기
    p.group.children.forEach(mesh => {
      if (!mesh.material) return;
      const orig = mesh.userData._origEmissive || new THREE.Color(0x000000);
      mesh.material.emissive = orig;
      mesh.material.emissiveIntensity = 0.0;
      mesh.scale.set(1, 1, 1);
    });
  }
}

function ensureHUD() {
  // 우승 배너
  if (!document.getElementById('winnerBanner')) {
    const b = document.createElement('div');
    b.id = 'winnerBanner';
    Object.assign(b.style, {
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      padding: '10px 16px', borderRadius: '10px',
      background: 'rgba(0,0,0,0.6)', color: '#fff',
      font: '700 18px/1.2 system-ui,Arial', letterSpacing: '.3px',
      zIndex: 9999, display: 'none'
    });
    document.body.appendChild(b);
  }
  // 스코어보드
  if (!document.getElementById('scoreboard')) {
    const s = document.createElement('div');
    s.id = 'scoreboard';
    Object.assign(s.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      padding: '10px 12px', borderRadius: '10px',
      background: 'rgba(0,0,0,0.5)', color: '#fff',
      font: '600 13px/1.4 system-ui,Arial',
      zIndex: 9999, minWidth: '140px'
    });
    s.textContent = 'Scoreboard';
    document.body.appendChild(s);
  }
}

function updateScoreboard() {
  const el = document.getElementById('scoreboard');
  if (!el) return;
  el.innerHTML = '<div style="font-weight:800;margin-bottom:6px;">Scoreboard</div>' +
    players.map(p => `<div>${p.name ?? 'Player'} : ${p.wins ?? 0}</div>`).join('');
}

function announceWinner(p) {
  ensureHUD();
  // 승수 업데이트
  p.wins = (p.wins || 0) + 1;
  updateScoreboard();

  const banner = document.getElementById('winnerBanner');
  banner.textContent = `🏁 WINNER: ${p.name ?? 'Player'}`;
  banner.style.display = 'block';
  // 1.2초 후 자동 숨김
  setTimeout(() => { banner.style.display = 'none'; }, 1200);
}

function beginReset() {
  if (resetting) return;
  resetting = true;
  readyDelay = READY_DELAY_SEC;

  // 모든 플레이어를 즉시 출발 위치로 텔레포트
  for (const p of players) {
    const startX = (p.startX !== undefined ? p.startX : LEFT_BOUND);
    p.group.position.x = startX;
    p.dir = 1;                 // 다음 턴도 오른쪽으로
    p.speed = p.baseSpeed;     // 원하면 속도를 유지하고 싶다면 이 줄 지워도 됨
    // 터보/효과를 초기화하고 싶으면 여기서 처리
    if (p.turboActive) setTurbo(p, false);
  }
}

// 단색 라인 (출발선)
function createSolidLineOnFloor(x, length = 26, color = 0xffffff, thickness = 0.12) {
  const geo = new THREE.BoxGeometry(thickness, 0.01, length);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, LINE_Y, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// 체크무늬 라인 (결승선)
function createCheckeredLineOnFloor(x, length = 26, tile = 0.5) {
  const group = new THREE.Group();
  const colors = [0x111111, 0xffffff];
  let toggle = 0;
  for (let z = -length / 2; z < length / 2; z += tile) {
    const geo = new THREE.BoxGeometry(0.14, 0.012, tile * 0.98); // 살짝 간격을 줘서 경계가 보이게
    const mat = new THREE.MeshStandardMaterial({ color: colors[toggle], roughness: 0.5, metalness: 0.0 });
    const tileMesh = new THREE.Mesh(geo, mat);
    tileMesh.position.set(x, LINE_Y, z + tile / 2);
    group.add(tileMesh);
    toggle ^= 1;
  }
  return group;
}

// 레인 구분선 (z축 방향으로 얇은 선들을 그어줌)
function createLaneLines(laneCount = 8, laneSpacing = 2.2, color = 0x9aa5b1, alpha = 0.35) {
  const group = new THREE.Group();
  const totalWidth = (laneCount - 1) * laneSpacing;
  const zStart = -totalWidth / 2;
  const zEnd = totalWidth / 2;

  // 각 레인의 경계선: x방향으로 긴 얇은 박스
  for (let i = 0; i <= laneCount; i++) {
    const z = zStart + i * laneSpacing;
    const geo = new THREE.BoxGeometry(RIGHT_BOUND - LEFT_BOUND, 0.006, 0.03);
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: alpha, metalness: 0, roughness: 1 });
    const line = new THREE.Mesh(geo, mat);
    line.position.set((LEFT_BOUND + RIGHT_BOUND) / 2, LINE_Y, z);
    group.add(line);
  }

  return group;
}

// 트랙 전체 묶음: 출발선 + 결승선 + (옵션) 레인 라인
function createTrack({ showLanes = true, laneCount = 8, laneSpacing = 2.2 } = {}) {
  const group = new THREE.Group();
  // 출발선(왼쪽 경계)
  const start = createSolidLineOnFloor(LEFT_BOUND, laneCount * laneSpacing + 2, 0xffffff, 0.14);
  group.add(start);
  // 결승선(오른쪽 경계, 체크무늬)
  const finish = createCheckeredLineOnFloor(RIGHT_BOUND, laneCount * laneSpacing + 2, 0.5);
  group.add(finish);
  // 레인 라인
  if (showLanes) group.add(createLaneLines(laneCount, laneSpacing));
  return group;
}

function main() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x20232a);

  // Camera
  camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(5, 8, 15);
  camera.lookAt(0, 0, 0);

  // Renderer + Shadow
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const [ambient, dirLight] = createLight();
  scene.add(ambient);
  scene.add(dirLight);
  scene.add(createFloor());

  // 레인 배치
  const laneSpacing = 2.2;
  scene.add(createTrack({ showLanes: true, laneCount: LANE_COUNT, laneSpacing }));

  const startX = -3.5;

  const playerNames = ["준영", "준모", "시헌", "승민", "찬솔", "현준", "찬우", "하링"];

  for (let i = 0; i < LANE_COUNT; i++) {
    const z = (i - (LANE_COUNT - 1) / 2) * laneSpacing;
    const player = createPlayer(startX, z, playerNames[i]);
    players.push(player);
    scene.add(player.group);
  }
  updateScoreboard();
  animate();
}

main();
