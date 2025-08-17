const defaultRunners = ['A', 'B', 'C', 'D', 'E'];
const runners = [...defaultRunners];

const runnerList = document.getElementById('runnerList');
const newRunnerInput = document.getElementById('newRunner');
const addRunnerBtn = document.getElementById('addRunner');
const startRaceBtn = document.getElementById('startRace');
const raceTrack = document.getElementById('raceTrack');

function renderRunnerList() {
  runnerList.innerHTML = '';
  runners.forEach((name, idx) => {
    const li = document.createElement('li');
    li.textContent = name;
    runnerList.appendChild(li);
  });
}
renderRunnerList();

addRunnerBtn.addEventListener('click', () => {
  const name = newRunnerInput.value.trim();
  if (name) {
    runners.push(name);
    newRunnerInput.value = '';
    renderRunnerList();
  }
});

startRaceBtn.addEventListener('click', () => {
  if (runners.length < 2) {
    alert('선수는 최소 2명 이상이어야 합니다.');
    return;
  }
  startRace();
});

function startRace() {
  raceTrack.innerHTML = '';
  const finishLine = raceTrack.clientWidth - 50;
  const runnerElems = runners.map((name, idx) => {
    const div = document.createElement('div');
    div.className = 'runner';
    div.textContent = name[0];
    div.style.top = `${(idx * 50) + 20}px`;
    div.style.left = '0px';
    raceTrack.appendChild(div);
    return { name, el: div, pos: 0 };
  });

  function step() {
    let finished = false;
    runnerElems.forEach(runner => {
      const delta = Math.random() * 3 + 1; // 1~4 px 랜덤 이동
      runner.pos += delta;
      runner.el.style.left = `${runner.pos}px`;
      if (runner.pos >= finishLine) {
        finished = true;
      }
    });

    if (!finished) {
      requestAnimationFrame(step);
    } else {
      const winner = runnerElems.reduce((best, cur) => cur.pos > best.pos ? cur : best, runnerElems[0]);
      setTimeout(() => alert(`${winner.name}님이 우승했습니다!`), 100);
    }
  }
  requestAnimationFrame(step);
}
