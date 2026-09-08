import * as THREE from 'https://esm.sh/three@0.160.0';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';

/* ===================== 3D Pet Model Viewer ===================== *
 * 为7种宠物构建程序化3D模型，使用Three.js原生几何体组合。
 * 猫咪模型使用外部 GLB 文件 (cat_3d_model.glb) 加载。
 * 每个模型支持：闲置动画(呼吸/眨眼/摆尾)、鼠标旋转交互、装扮挂载。
 * =============================================================== */

/* ---------- GLB 模型加载器 ---------- */
const gltfLoader = new GLTFLoader();
// Draco 解码器：用于加载压缩过的 GLB（解码器从 Google CDN 拉取，无需打包）
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
dracoLoader.setDecoderConfig({ type: 'js' });
gltfLoader.setDRACOLoader(dracoLoader);

/* ---------- 材质工厂 ---------- */
function mat(color, roughness = 0.6, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function sphere(r, seg, material, pos) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material);
  if (pos) m.position.set(...pos);
  m.castShadow = true;
  return m;
}

function cylinder(rt, rb, h, seg, material, pos) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  if (pos) m.position.set(...pos);
  m.castShadow = true;
  return m;
}

function cone(r, h, seg, material, pos) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), material);
  if (pos) m.position.set(...pos);
  m.castShadow = true;
  return m;
}

function box(w, h, d, material, pos) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  if (pos) m.position.set(...pos);
  m.castShadow = true;
  return m;
}

/* ---------- 通用部件 ---------- */
function buildEyes(group, headY, headZ, eyeColor, spacing, eyeR) {
  const eyeMat = mat(eyeColor, 0.2);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeL = sphere(eyeR, 16, eyeMat, [-spacing, headY + 0.02, headZ]);
  const eyeR2 = sphere(eyeR, 16, eyeMat, [spacing, headY + 0.02, headZ]);
  group.add(eyeL, eyeR2);
  group.userData.eyeL = eyeL;
  group.userData.eyeR = eyeR2;

  const hlL = sphere(eyeR * 0.35, 8, hlMat, [-spacing + eyeR * 0.3, headY + 0.06, headZ + eyeR * 0.5]);
  const hlR = sphere(eyeR * 0.35, 8, hlMat, [spacing + eyeR * 0.3, headY + 0.06, headZ + eyeR * 0.5]);
  group.add(hlL, hlR);
  return { eyeL, eyeR: eyeR2 };
}

function buildLegs(group, matBody, w, h, positions) {
  positions.forEach(p => group.add(cylinder(w, w * 1.1, h, 12, matBody, p)));
}

function buildTail(group, matBody, color, type) {
  let tail;
  if (type === 'curved') {
    tail = cylinder(0.05, 0.08, 0.5, 12, matBody, [0, 0.1, -0.6]);
    tail.rotation.x = -0.5;
    const tip = sphere(0.08, 16, mat(0xF5E6D3), [0, 0.3, -0.75]);
    group.add(tail, tip);
  } else if (type === 'wag') {
    tail = cylinder(0.06, 0.04, 0.45, 12, matBody, [0, 0.05, -0.55]);
    tail.rotation.x = -0.7;
    group.add(tail);
  } else if (type === 'tuft') {
    tail = cylinder(0.05, 0.07, 0.4, 12, matBody, [0, 0.1, -0.58]);
    tail.rotation.x = -0.6;
    const tuft = sphere(0.1, 16, mat(color, 0.8), [0, 0.25, -0.72]);
    group.add(tail, tuft);
  }
  if (tail) group.userData.tail = tail;
}

/* ---------- 7种宠物模型构建 ---------- */
const PET_BUILDERS = {

  /* 猫咪 */
  '猫咪': () => {
    const g = new THREE.Group();
    const fc = 0xE8A04F, bc = 0xF5E6D3;
    const mBody = mat(fc), mBelly = mat(bc, 0.7);

    const body = sphere(0.55, 32, mBody);
    body.scale.set(1, 0.85, 1.1);
    g.add(body);
    g.userData.body = body;

    const belly = sphere(0.32, 32, mBelly, [0, -0.1, 0.38]);
    belly.scale.set(1, 0.7, 0.5);
    g.add(belly);

    const head = sphere(0.38, 32, mBody, [0, 0.5, 0.18]);
    g.add(head);
    g.userData.head = head;

    // 耳朵 - 三角锥
    [-0.2, 0.2].forEach((x, i) => {
      const ear = cone(0.13, 0.28, 4, mBody, [x, 0.78, 0.12]);
      ear.rotation.z = i ? -0.2 : 0.2;
      g.add(ear);
      const inner = cone(0.06, 0.15, 4, mat(0xFFB6C1), [x, 0.75, 0.18]);
      inner.rotation.z = i ? -0.2 : 0.2;
      g.add(inner);
    });

    buildEyes(g, 0.56, 0.42, 0x2a2a3e, 0.13, 0.07);
    const nose = sphere(0.045, 16, mat(0xFF6B8A, 0.4), [0, 0.4, 0.46]);
    nose.scale.set(1, 0.7, 0.7);
    g.add(nose);

    buildLegs(g, mBody, 0.1, 0.28, [[-0.28, -0.45, 0.22], [0.28, -0.45, 0.22], [-0.28, -0.45, -0.22], [0.28, -0.45, -0.22]]);
    buildTail(g, mBody, bc, 'curved');
    return g;
  },

  /* 狗狗 */
  '狗狗': () => {
    const g = new THREE.Group();
    const c = 0xC49A6A;
    const mBody = mat(c), mDark = mat(0xA67C4A);

    const body = sphere(0.58, 32, mBody);
    body.scale.set(1, 0.88, 1.15);
    g.add(body);
    g.userData.body = body;

    const head = sphere(0.4, 32, mBody, [0, 0.5, 0.22]);
    g.add(head);
    g.userData.head = head;

    // 鼻吻
    const snout = sphere(0.18, 24, mDark, [0, 0.42, 0.48]);
    snout.scale.set(1, 0.7, 0.8);
    g.add(snout);

    // 垂耳
    [-0.32, 0.32].forEach(x => {
      const ear = sphere(0.12, 20, mDark, [x, 0.55, 0.15]);
      ear.scale.set(0.6, 1.5, 0.8);
      g.add(ear);
    });

    buildEyes(g, 0.6, 0.4, 0x2a2a1e, 0.14, 0.065);
    const nose = sphere(0.05, 16, mat(0x1a1a1a, 0.3), [0, 0.44, 0.56]);
    g.add(nose);

    buildLegs(g, mBody, 0.11, 0.3, [[-0.3, -0.47, 0.24], [0.3, -0.47, 0.24], [-0.3, -0.47, -0.24], [0.3, -0.47, -0.24]]);
    buildTail(g, mBody, c, 'wag');
    return g;
  },

  /* 小兔子 */
  '小兔子': () => {
    const g = new THREE.Group();
    const c = 0xF5F0F5;
    const mBody = mat(c, 0.8);

    const body = sphere(0.5, 32, mBody);
    body.scale.set(0.9, 1.05, 1);
    g.add(body);
    g.userData.body = body;

    const head = sphere(0.35, 32, mBody, [0, 0.52, 0.12]);
    g.add(head);
    g.userData.head = head;

    // 长耳朵
    [-0.13, 0.13].forEach((x, i) => {
      const ear = cylinder(0.07, 0.05, 0.5, 16, mBody, [x, 0.95, 0]);
      ear.rotation.z = i ? 0.15 : -0.15;
      g.add(ear);
      const inner = cylinder(0.04, 0.03, 0.42, 12, mat(0xFFB6C1, 0.7), [x, 0.95, 0.04]);
      inner.rotation.z = i ? 0.15 : -0.15;
      g.add(inner);
    });

    buildEyes(g, 0.56, 0.36, 0xCC3344, 0.12, 0.06);
    const nose = sphere(0.04, 16, mat(0xFF8FA3, 0.4), [0, 0.42, 0.4]);
    nose.scale.set(1.3, 0.8, 0.8);
    g.add(nose);

    // 棉花尾
    const tail = sphere(0.1, 16, mat(0xFFFFFF, 0.9), [0, 0.05, -0.55]);
    g.add(tail);

    buildLegs(g, mBody, 0.1, 0.26, [[-0.25, -0.44, 0.2], [0.25, -0.44, 0.2], [-0.25, -0.44, -0.2], [0.25, -0.44, -0.2]]);
    return g;
  },

  /* 大熊猫 */
  '大熊猫': () => {
    const g = new THREE.Group();
    const mW = mat(0xFFFFFF, 0.7), mB = mat(0x1a1a1a, 0.5);

    const body = sphere(0.55, 32, mW);
    body.scale.set(1, 0.9, 1.1);
    g.add(body);
    g.userData.body = body;

    const head = sphere(0.4, 32, mW, [0, 0.5, 0.15]);
    g.add(head);
    g.userData.head = head;

    // 黑耳朵
    [-0.28, 0.28].forEach(x => g.add(sphere(0.12, 20, mB, [x, 0.78, 0.1])));

    // 黑眼圈
    [-0.14, 0.14].forEach(x => {
      const patch = sphere(0.09, 20, mB, [x, 0.56, 0.36]);
      patch.scale.set(1, 1.3, 0.6);
      g.add(patch);
    });

    buildEyes(g, 0.56, 0.4, 0x1a1a1a, 0.14, 0.04);
    const nose = sphere(0.045, 16, mB, [0, 0.42, 0.45]);
    g.add(nose);

    // 黑色四肢
    [[-0.28, -0.42, 0.25], [0.28, -0.42, 0.25], [-0.28, -0.42, -0.25], [0.28, -0.42, -0.25]].forEach(p => {
      g.add(cylinder(0.12, 0.14, 0.32, 16, mB, p));
    });
    return g;
  },

  /* 小狮子 */
  '小狮子': () => {
    const g = new THREE.Group();
    const c = 0xD4A017;
    const mBody = mat(c), mMane = mat(0xB8860B, 0.8);

    const body = sphere(0.55, 32, mBody);
    body.scale.set(1, 0.88, 1.1);
    g.add(body);
    g.userData.body = body;

    // 鬃毛 - 环形
    const maneGeo = new THREE.TorusGeometry(0.38, 0.15, 16, 32);
    const mane = new THREE.Mesh(maneGeo, mMane);
    mane.position.set(0, 0.5, 0.15);
    mane.scale.set(1, 1, 0.5);
    g.add(mane);

    const head = sphere(0.33, 32, mBody, [0, 0.5, 0.25]);
    g.add(head);
    g.userData.head = head;

    // 小圆耳
    [-0.22, 0.22].forEach(x => g.add(sphere(0.08, 16, mBody, [x, 0.72, 0.2])));

    buildEyes(g, 0.56, 0.45, 0x2a2a1e, 0.11, 0.055);
    const nose = sphere(0.04, 16, mat(0x3a2a1a, 0.4), [0, 0.42, 0.5]);
    nose.scale.set(1.3, 0.8, 0.8);
    g.add(nose);

    buildLegs(g, mBody, 0.1, 0.3, [[-0.28, -0.46, 0.24], [0.28, -0.46, 0.24], [-0.28, -0.46, -0.24], [0.28, -0.46, -0.24]]);
    buildTail(g, mBody, 0x8B6914, 'tuft');
    return g;
  },

  /* 小老虎 */
  '小老虎': () => {
    const g = new THREE.Group();
    const c = 0xFF8C00;
    const mBody = mat(c), mStripe = mat(0x2a1a0a, 0.5);

    const body = sphere(0.55, 32, mBody);
    body.scale.set(1, 0.88, 1.1);
    g.add(body);
    g.userData.body = body;

    // 身体条纹
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const stripe = box(0.06, 0.04, 0.15, mStripe, [Math.cos(ang) * 0.5, 0.1, Math.sin(ang) * 0.5]);
      stripe.lookAt(0, 0.1, 0);
      g.add(stripe);
    }

    const head = sphere(0.38, 32, mBody, [0, 0.5, 0.18]);
    g.add(head);
    g.userData.head = head;

    // 条纹耳朵
    [-0.2, 0.2].forEach((x, i) => {
      const ear = cone(0.12, 0.22, 4, mBody, [x, 0.75, 0.1]);
      ear.rotation.z = i ? -0.2 : 0.2;
      g.add(ear);
    });

    // 头部条纹
    [[-0.12, 0.7, 0.2], [0.12, 0.7, 0.2], [0, 0.8, 0.15]].forEach(p => {
      const s = box(0.04, 0.12, 0.04, mStripe, p);
      g.add(s);
    });

    buildEyes(g, 0.56, 0.42, 0x1a2a1a, 0.13, 0.065);
    const nose = sphere(0.045, 16, mat(0xFF6B8A, 0.4), [0, 0.4, 0.46]);
    nose.scale.set(1, 0.7, 0.7);
    g.add(nose);

    buildLegs(g, mBody, 0.1, 0.3, [[-0.28, -0.46, 0.24], [0.28, -0.46, 0.24], [-0.28, -0.46, -0.24], [0.28, -0.46, -0.24]]);
    buildTail(g, mBody, c, 'wag');
    return g;
  },

  /* 小鸡 */
  '小鸡': () => {
    const g = new THREE.Group();
    const c = 0xFFD700;
    const mBody = mat(c, 0.5), mBeak = mat(0xFFA500, 0.4);

    // 圆胖身体
    const body = sphere(0.5, 32, mBody);
    body.scale.set(1, 1.05, 1);
    g.add(body);
    g.userData.body = body;

    const head = sphere(0.35, 32, mBody, [0, 0.45, 0.1]);
    g.add(head);
    g.userData.head = head;

    // 鸡冠
    for (let i = -1; i <= 1; i++) {
      const comb = sphere(0.06, 12, mat(0xFF4444, 0.4), [i * 0.08, 0.75, 0.05]);
      comb.scale.set(0.8, 1.2, 0.8);
      g.add(comb);
    }

    buildEyes(g, 0.5, 0.4, 0x1a1a1a, 0.11, 0.055);

    // 喙
    const beak = cone(0.07, 0.12, 4, mBeak, [0, 0.38, 0.42]);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);

    // 翅膀
    [-0.42, 0.42].forEach(x => {
      const wing = sphere(0.18, 20, mBody, [x, 0.05, 0]);
      wing.scale.set(0.4, 0.8, 1.2);
      g.add(wing);
    });

    // 脚
    [-0.12, 0.12].forEach(x => {
      g.add(cylinder(0.03, 0.04, 0.15, 8, mBeak, [x, -0.55, 0.05]));
    });

    return g;
  },
};

/* ---------- 装扮3D挂件 ---------- */
const EQUIP_BUILDERS = {
  '小帽子': (g) => {
    const m = mat(0x1a1a1a, 0.4);
    g.add(cylinder(0.14, 0.14, 0.18, 20, m, [0, 0.95, 0.1]));
    g.add(cylinder(0.22, 0.22, 0.03, 20, m, [0, 0.87, 0.1]));
  },
  '蝴蝶结': (g) => {
    const m = mat(0xFF4466, 0.4);
    const l = sphere(0.08, 16, m, [-0.12, 0.38, 0.35]);
    l.scale.set(1.2, 0.7, 0.4);
    const r = sphere(0.08, 16, m, [0.12, 0.38, 0.35]);
    r.scale.set(1.2, 0.7, 0.4);
    g.add(l, r, sphere(0.04, 12, m, [0, 0.38, 0.36]));
  },
  '小围巾': (g) => {
    const geo = new THREE.TorusGeometry(0.28, 0.06, 12, 32);
    const mesh = new THREE.Mesh(geo, mat(0xFF4444, 0.5));
    mesh.position.set(0, 0.32, 0.15);
    mesh.scale.set(1, 0.6, 1);
    g.add(mesh);
  },
  '小眼镜': (g) => {
    const m = mat(0x333333, 0.3, 0.3);
    [-0.13, 0.13].forEach(x => {
      const torusGeo = new THREE.TorusGeometry(0.07, 0.015, 8, 20);
      const lens = new THREE.Mesh(torusGeo, m);
      lens.position.set(x, 0.56, 0.42);
      g.add(lens);
    });
    g.add(box(0.1, 0.01, 0.01, m, [0, 0.56, 0.42]));
  },
  '小书包': (g) => {
    g.add(box(0.3, 0.32, 0.12, mat(0xFF6600, 0.5), [0, 0.05, -0.5]));
  },
  '小铃铛': (g) => {
    g.add(sphere(0.05, 16, mat(0xFFD700, 0.3, 0.7), [0, 0.3, 0.4]));
  },
  '皇冠': (g) => {
    const m = mat(0xFFD700, 0.3, 0.8);
    g.add(cylinder(0.16, 0.16, 0.06, 20, m, [0, 0.85, 0.1]));
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI - Math.PI / 2;
      g.add(cone(0.03, 0.1, 4, m, [Math.cos(ang) * 0.14, 0.95, 0.1 + Math.sin(ang) * 0.14]));
    }
  },
  '小翅膀': (g) => {
    const m = mat(0xFFFFFF, 0.7);
    [-0.55, 0.55].forEach((x, i) => {
      const wing = sphere(0.15, 20, m, [x, 0.2, -0.1]);
      wing.scale.set(0.3, 1, 1.5);
      wing.rotation.z = i ? -0.3 : 0.3;
      g.add(wing);
    });
  },
};

/* ---------- 宠物叫声配置 ---------- */
const PET_SOUNDS = {
  '猫咪':   { text: '喵～',    freq: 880,  freqEnd: 660,  dur: 0.35, type: 'sine',     vol: 0.12 },
  '狗狗':   { text: '汪！汪！', freq: 520,  freqEnd: 360,  dur: 0.18, type: 'square',   vol: 0.10 },
  '小兔子': { text: '吱～',    freq: 1400, freqEnd: 1100, dur: 0.22, type: 'sine',     vol: 0.08 },
  '大熊猫': { text: '嗯～',    freq: 220,  freqEnd: 160,  dur: 0.45, type: 'sine',     vol: 0.14 },
  '小狮子': { text: '吼～',    freq: 160,  freqEnd: 90,   dur: 0.55, type: 'sawtooth', vol: 0.15 },
  '小老虎': { text: '嗷～',    freq: 190,  freqEnd: 110,  dur: 0.50, type: 'sawtooth', vol: 0.14 },
  '小鸡':   { text: '叽叽～',  freq: 1600, freqEnd: 2000, dur: 0.15, type: 'sine',     vol: 0.08 },
};

let _audioCtx = null;
let _audioUnlocked = false;

// 标记用户已交互（不在此处创建 AudioContext，避免沙箱报错）
function unlockAudio() {
  _audioUnlocked = true;
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
}

// 仅在需要播放声音时才创建 AudioContext，全部包裹 try-catch
function getAudioCtx() {
  if (!_audioUnlocked) return null;
  if (!_audioCtx) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _audioCtx = new AC();
    } catch (e) { return null; }
  }
  try {
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
  } catch (e) { /* 静默 */ }
  return _audioCtx;
}

function playPetSound(petType, container) {
  const cfg = PET_SOUNDS[petType] || PET_SOUNDS['猫咪'];

  // 语音气泡（始终显示，不依赖音频）
  showSpeechBubble(cfg.text, container);

  // Web Audio 合成叫声（仅在音频已解锁时播放）
  if (!_audioUnlocked) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, cfg.freqEnd), now + cfg.dur);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(cfg.vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + cfg.dur + 0.05);
  } catch (e) { /* 静默失败 */ }
}

function showSpeechBubble(text, container) {
  // 移除已有气泡
  const old = container.querySelector('.pet-speech');
  if (old) old.remove();

  const bubble = document.createElement('div');
  bubble.className = 'pet-speech';
  bubble.textContent = text;
  bubble.style.cssText = [
    'position:absolute', 'top:-6px', 'left:50%',
    'transform:translateX(-50%) translateY(10px) scale(0.5)',
    'background:linear-gradient(135deg,#fff,#f0f4ff)', 'border:2px solid rgba(100,140,255,0.3)',
    'border-radius:18px', 'padding:6px 18px',
    'font-size:18px', 'font-weight:800', 'color:#4a6cf7',
    'box-shadow:0 4px 16px rgba(74,108,247,0.25)',
    'pointer-events:none', 'z-index:30', 'opacity:0',
    'transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    'white-space:nowrap',
  ].join(';');
  container.appendChild(bubble);

  requestAnimationFrame(function () {
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateX(-50%) translateY(0) scale(1)';
  });

  setTimeout(function () {
    bubble.style.opacity = '0';
    bubble.style.transform = 'translateX(-50%) translateY(-10px) scale(0.7)';
    setTimeout(function () { if (bubble.parentNode) bubble.remove(); }, 350);
  }, 2000);
}

/* ---------- WebGL 可用性检测 ---------- */
function isWebGLAvailable() {
  try {
    var canvas = document.createElement('canvas');
    // 使用与 Three.js WebGLRenderer 完全相同的上下文属性
    var attrs = {
      alpha: true, depth: true, stencil: false,
      antialias: true, premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false
    };
    var gl = canvas.getContext('webgl2', attrs);
    if (!gl) gl = canvas.getContext('webgl', attrs);
    if (!gl) gl = canvas.getContext('experimental-webgl', attrs);
    if (!gl) return false;
    // 验证上下文是否真正可用
    if (!gl.getParameter(gl.VERSION)) return false;
    if (!gl.createShader(gl.VERTEX_SHADER)) return false;
    // 清理测试上下文，避免占用 WebGL 资源
    var ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 终极 WebGL 检测：渲染一个已知颜色像素并读回验证。
 * 只有 readPixels 返回正确颜色才说明 WebGL 真正能渲染。
 */
function testWebGLRender() {
  try {
    var canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    var gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) return false;

    // 用特殊颜色清屏（避免与默认黑色混淆）
    gl.clearColor(0.3, 0.7, 0.5, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 读回中心像素
    var px = new Uint8Array(4);
    gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

    // 验证颜色是否匹配（允许微小误差）
    var r = Math.abs(px[0] - 77) < 10;
    var g = Math.abs(px[1] - 179) < 10;
    var b = Math.abs(px[2] - 128) < 10;
    var ok = r && g && b;

    // 清理
    var ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();

    return ok;
  } catch (e) {
    return false;
  }
}

/* ---------- 宠物 emoji 映射 ---------- */
const PET_ICONS = {
  '猫咪': '🐱', '狗狗': '🐶', '小兔子': '🐰',
  '大熊猫': '🐼', '小狮子': '🦁', '小老虎': '🐯', '小鸡': '🐤',
};
const PET_COLORS = {
  '猫咪': '#FFB347', '狗狗': '#C4956A', '小兔子': '#FFB6C1',
  '大熊猫': '#E0E0E0', '小狮子': '#FFD700', '小老虎': '#FF8C00', '小鸡': '#FFE135',
};

/* ---------- CSS 3D 回退方案 ---------- */
function initCSSFallback(containerId, petType, equipment) {
  dispose(containerId);
  var container = document.getElementById(containerId);
  if (!container) return;

  // 移除加载占位符
  var oldLoading = container.querySelector('.pet3d-loading');
  if (oldLoading && oldLoading.parentNode) oldLoading.parentNode.removeChild(oldLoading);

  var icon = PET_ICONS[petType] || '🐱';
  var accentColor = PET_COLORS[petType] || '#FFB347';
  var equips = equipment || [];

  // 构建 CSS 3D 容器
  container.style.cssText += ';position:relative;perspective:600px;';
  container.innerHTML = '';

  // 舞台
  var stage = document.createElement('div');
  stage.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;transform-style:preserve-3d;';

  // 光环底座
  var glow = document.createElement('div');
  glow.style.cssText = 'position:absolute;bottom:15%;left:50%;transform:translateX(-50%);width:120px;height:30px;border-radius:50%;background:radial-gradient(ellipse,' + accentColor + '33,transparent 70%);filter:blur(4px);';
  stage.appendChild(glow);

  // 阴影
  var shadow = document.createElement('div');
  shadow.style.cssText = 'position:absolute;bottom:18%;left:50%;transform:translateX(-50%);width:80px;height:12px;border-radius:50%;background:rgba(0,0,0,0.2);filter:blur(3px);';
  stage.appendChild(shadow);

  // 宠物主体（3D 旋转容器）
  var petWrap = document.createElement('div');
  petWrap.style.cssText = 'position:relative;transform-style:preserve-3d;transition:transform 0.1s ease-out;cursor:grab;';

  // 光晕背景
  var aura = document.createElement('div');
  aura.style.cssText = 'position:absolute;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle at 35% 35%,rgba(255,255,255,0.6),' + accentColor + '22 50%,transparent 75%);filter:blur(3px);top:50%;left:50%;transform:translate(-50%,-50%);';
  petWrap.appendChild(aura);

  // 宠物 emoji
  var petEmoji = document.createElement('div');
  petEmoji.style.cssText = 'position:relative;font-size:90px;line-height:1;filter:drop-shadow(0 8px 16px rgba(0,0,0,0.3));user-select:none;z-index:2;';
  petEmoji.textContent = icon;
  petWrap.appendChild(petEmoji);

  // 装扮
  equips.forEach(function(eq) {
    var equipDiv = document.createElement('div');
    var slot = eq.slot || '';
    var styleParts = ['position:absolute', 'font-size:24px', 'z-index:5', 'text-shadow:0 2px 4px rgba(0,0,0,0.2)', 'pointer-events:none'];
    if (slot === '头部') { styleParts.push('top:-10px', 'left:50%', 'transform:translateX(-50%)'); }
    else if (slot === '颈部') { styleParts.push('bottom:20px', 'left:50%', 'transform:translateX(-50%)'); }
    else if (slot === '面部') { styleParts.push('top:45%', 'left:50%', 'transform:translate(-50%,-50%)'); }
    else if (slot === '背部') { styleParts.push('top:20px', 'left:50%', 'transform:translateX(-50%)', 'opacity:0.7'); }
    else { styleParts.push('top:30px', 'right:-5px'); }
    equipDiv.style.cssText = styleParts.join(';');
    equipDiv.textContent = eq.icon || '';
    petWrap.appendChild(equipDiv);
  });

  stage.appendChild(petWrap);
  container.appendChild(stage);

  // 状态
  var startTime = performance.now();
  var lastTime = startTime;
  var state = {
    isCSS: true,
    container: container,
    petType: petType,
    petWrap: petWrap,
    petEmoji: petEmoji,
    shadow: shadow,
    glow: glow,
    startTime: startTime,
    lastTime: lastTime,
    targetRotY: 0, targetRotX: 0,
    currentRotY: 0, currentRotX: 0,
    autoRotate: true,
    autoRotateSpeed: 0.3,
    soundTimer: 3 + Math.random() * 2,
    hopTimer: 3 + Math.random() * 4,
    isHopping: false,
    hopPhase: 0,
    callAnim: 0,
    headPhase: Math.random() * Math.PI * 2,
    disposed: false,
    rafId: null,
  };

  // 鼠标/触摸交互
  function onMove(clientX, clientY) {
    var rect = container.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width - 0.5;
    var y = (clientY - rect.top) / rect.height - 0.5;
    state.targetRotY = x * 35;
    state.targetRotX = -y * 20;
    state.autoRotate = false;
  }
  function onEnd() { state.autoRotate = true; }

  container.addEventListener('mousemove', function(e) { onMove(e.clientX, e.clientY); });
  container.addEventListener('mouseleave', onEnd);
  container.addEventListener('touchmove', function(e) { e.preventDefault(); if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  container.addEventListener('touchend', onEnd);
  state._onMove = onMove;
  state._onEnd = onEnd;
  state._container = container;

  viewers[containerId] = state;
  animateCSS(state);
}

function animateCSS(state) {
  if (state.disposed) return;
  state.rafId = requestAnimationFrame(function() { animateCSS(state); });

  var now = performance.now();
  var t = (now - state.startTime) / 1000;
  var dt = (now - state.lastTime) / 1000;
  state.lastTime = now;
  if (dt > 0.1) dt = 0.1; // 防止切换标签后 dt 过大

  // 叫声定时
  state.soundTimer -= dt;
  if (state.soundTimer <= 0) {
    playPetSound(state.petType, state.container);
    state.callAnim = 1.0;
    state.soundTimer = 8 + Math.random() * 12;
  }
  if (state.callAnim > 0) {
    state.callAnim = Math.max(0, state.callAnim - dt * 2.5);
  }

  // 蹦跳
  state.hopTimer -= dt;
  if (state.hopTimer <= 0 && !state.isHopping) {
    state.isHopping = true;
    state.hopPhase = 0;
  }
  var hopOffset = 0;
  if (state.isHopping) {
    state.hopPhase += dt * 7;
    if (state.hopPhase >= Math.PI) {
      state.isHopping = false;
      state.hopTimer = 3 + Math.random() * 6;
    } else {
      hopOffset = Math.sin(state.hopPhase) * 40;
    }
  }

  // 旋转
  if (state.autoRotate) {
    state.targetRotY += dt * state.autoRotateSpeed * 30;
  }
  state.currentRotY += (state.targetRotY - state.currentRotY) * 0.08;
  state.currentRotX += (state.targetRotX - state.currentRotX) * 0.08;

  // 浮动 + 蹦跳 + 叫唤振动
  var floatY = Math.sin(t * 1.5) * 5;
  var callShake = state.callAnim > 0 ? Math.sin(t * 28) * 3 * state.callAnim : 0;
  var totalY = floatY + hopOffset + callShake;

  // 叫唤时放大
  var pulse = state.callAnim > 0 ? 1 + state.callAnim * 0.08 : 1;

  // 头部摇摆（更明显的左右转头 + 微微点头）
  var headTilt = Math.sin(t * 0.8 + state.headPhase) * 8;

  // 身体摆动（随呼吸节奏左右轻摆）
  var bodyTilt = Math.sin(t * 0.7 + state.headPhase) * 3;

  // 阴影缩放（蹦跳时变小）
  var shadowScale = 1 - hopOffset / 100;

  // 应用变换
  state.petWrap.style.transform = 
    'translateY(' + (-totalY) + 'px) ' +
    'rotateY(' + state.currentRotY + 'deg) ' +
    'rotateX(' + state.currentRotX + 'deg) ' +
    'rotateZ(' + bodyTilt + 'deg) ' +
    'scale(' + pulse + ')';
  
  state.petEmoji.style.transform = 'rotate(' + headTilt + 'deg)';
  state.shadow.style.transform = 'translateX(-50%) scale(' + Math.max(0.5, shadowScale) + ')';
  state.shadow.style.opacity = String(Math.max(0.3, shadowScale));
  state.glow.style.transform = 'translateX(-50%) scale(' + (1 + state.callAnim * 0.2) + ')';
}

/* ---------- 查看器主逻辑 ---------- */
const viewers = {};

function init(containerId, petType, equipment) {
  dispose(containerId);
  const container = document.getElementById(containerId);
  if (!container) return;

  // 清空容器（移除 app.js 的简单宠物 HTML 和加载占位符）
  container.innerHTML = '';

  // 检测 WebGL 是否可用，不可用则使用 CSS 3D 回退
  if (!isWebGLAvailable()) {
    initCSSFallback(containerId, petType, equipment);
    return;
  }

  const W = 220, H = 220;
  
  // 临时屏蔽 console，防止 Three.js 在沙箱环境中打印 WebGL 错误
  var _origWarn = console.warn;
  var _origError = console.error;
  console.warn = function() {};
  console.error = function() {};
  
  let renderer;
  let glCtx = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false });
    renderer.setSize(W, H);
    glCtx = renderer.getContext();
    // 进一步验证上下文是否真正可用
    if (glCtx) {
      var testVer = glCtx.getParameter(glCtx.VERSION);
      if (!testVer) glCtx = null;
    }
  } catch (e) {
    glCtx = null;
  } finally {
    console.warn = _origWarn;
    console.error = _origError;
  }
  
  // WebGL 上下文不可用，回退到 CSS 3D
  if (!glCtx) {
    if (renderer) { try { renderer.dispose(); } catch(_) {} }
    initCSSFallback(containerId, petType, equipment);
    return;
  }

  // 测试渲染：验证 WebGL 上下文是否能真正渲染（沙箱可能返回非 null 但无法使用的上下文）
  try {
    var testScene = new THREE.Scene();
    var testCam = new THREE.Camera();
    renderer.render(testScene, testCam);
    if (glCtx.isContextLost()) throw new Error('Context lost after test render');
  } catch (e) {
    try { renderer.dispose(); } catch(_) {}
    initCSSFallback(containerId, petType, equipment);
    return;
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
  camera.position.set(0, 0.4, 3.6);
  camera.lookAt(0, 0.15, 0);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.borderRadius = '12px';
  renderer.domElement.style.cursor = 'grab';

  // 光照
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(2, 4, 3);
  dir.castShadow = true;
  dir.shadow.mapSize.set(512, 512);
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = 20;
  dir.shadow.camera.left = -2;
  dir.shadow.camera.right = 2;
  dir.shadow.camera.top = 2;
  dir.shadow.camera.bottom = -2;
  scene.add(dir);
  const fill = new THREE.PointLight(0xa0c0ff, 0.35);
  fill.position.set(-2, 1, 2);
  scene.add(fill);

  // 阴影地面
  const groundGeo = new THREE.CircleGeometry(1.0, 32);
  const ground = new THREE.Mesh(groundGeo, new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.72;
  ground.receiveShadow = true;
  scene.add(ground);

  // 光环底座
  const ringGeo = new THREE.RingGeometry(0.55, 0.85, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6688ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.71;
  scene.add(ring);

  // 构建宠物模型
  container.style.position = 'relative';
  const state = {
    scene, camera, renderer, petGroup: null, container,
    petType: petType,
    clock: new THREE.Clock(),
    targetRotY: 0, targetRotX: 0,
    currentRotY: 0, currentRotX: 0,
    autoRotate: true,
    autoRotateSpeed: 0.3,
    blinkTimer: 2 + Math.random() * 3,
    isBlinking: false,
    disposed: false,
    rafId: null,
    isGLB: false,
    mixer: null,
    containerId: containerId,
    petType: petType,
    equipment: equipment,
    renderFailed: false,
    // 叫声定时器 (3-5秒后第一次叫)
    soundTimer: 3 + Math.random() * 2,
    // 蹦跳定时器 (3-7秒后第一次跳)
    hopTimer: 3 + Math.random() * 4,
    isHopping: false,
    hopPhase: 0,
    // 叫唤时的振动动画
    callAnim: 0,
    // 头部摇摆相位偏移
    headPhase: Math.random() * Math.PI * 2,
  };

  // 挂载装扮的辅助函数
  function attachEquips(petGroup) {
    if (equipment && equipment.length) {
      equipment.forEach(eq => {
        const builder = EQUIP_BUILDERS[eq.key];
        if (builder) builder(petGroup);
      });
    }
  }

  // GLB 模型映射：指定哪些宠物使用外部 GLB 模型
  // 猫咪已有 cat_3d_model.glb（放在 web 根目录，随站点部署）；
  // 狗狗等暂无 GLB 文件，走程序化模型兜底。
  const GLB_MODELS = {
    '猫咪': 'cat_3d_model.glb',
  };

  if (GLB_MODELS[petType]) {
    // 使用 GLB 模型
    state.isGLB = true;
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#999;font-size:13px;white-space:nowrap;pointer-events:none;z-index:10;';
    loadingDiv.textContent = '加载3D模型中...';
    container.appendChild(loadingDiv);

    gltfLoader.load(GLB_MODELS[petType], function (gltf) {
      if (state.disposed) return;
      const model = gltf.scene;

      // 阴影
      model.traverse(function (obj) {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      // 识别头部网格，创建头部枢轴组（用于头部摇摆动画）
      // 在缩放前执行，此时坐标空间一致
      (function () {
        var mBox = new THREE.Box3().setFromObject(model);
        var mHeight = mBox.max.y - mBox.min.y;
        var neckY = mBox.max.y - mHeight * 0.35; // 颈部位置
        var hMeshes = [];
        var totalMeshes = 0;
        model.traverse(function (obj) {
          if (obj.isMesh) {
            totalMeshes++;
            var c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
            if (c.y > neckY) hMeshes.push(obj);
          }
        });
        // 只有头部网格存在且不是全部网格时才创建枢轴
        if (hMeshes.length > 0 && hMeshes.length < totalMeshes) {
          var hp = new THREE.Group();
          hp.position.set(0, neckY, 0);
          model.add(hp);
          hMeshes.forEach(function (mesh) { hp.attach(mesh); });
          state.headPivot = hp;
        }
      })();

      // 居中 + 缩放适配
      var box = new THREE.Box3().setFromObject(model);
      var center = box.getCenter(new THREE.Vector3());
      var size = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z);
      var scaleVal = 1.5 / maxDim;
      model.scale.setScalar(scaleVal);
      model.position.sub(center.multiplyScalar(scaleVal));
      // 让模型坐落在地面上方
      model.position.y += size.y * scaleVal * 0.5 - 0.55;

      var petGroup = new THREE.Group();
      petGroup.add(model);
      scene.add(petGroup);
      state.petGroup = petGroup;

      // 存储body引用用于呼吸动画
      var bodyMesh = null;
      model.traverse(function (obj) {
        if (obj.isMesh && !bodyMesh) bodyMesh = obj;
      });
      if (bodyMesh) {
        petGroup.userData.body = bodyMesh;
        bodyMesh.userData.baseScaleY = bodyMesh.scale.y;
      }

      // GLB 内嵌动画
      if (gltf.animations && gltf.animations.length > 0) {
        state.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(function (clip) {
          state.mixer.clipAction(clip).play();
        });
      }

      // 挂载装扮
      attachEquips(petGroup);

      if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
    }, function (progress) {
      if (progress.total > 0) {
        var pct = Math.round((progress.loaded / progress.total) * 100);
        loadingDiv.textContent = '加载3D模型中... ' + pct + '%';
      }
    }, function (error) {
      console.error('GLB load failed:', error);
      if (state.disposed) return;
      // 回退到程序化模型
      var builder = PET_BUILDERS[petType] || PET_BUILDERS['猫咪'];
      var petGroup = builder();
      scene.add(petGroup);
      state.petGroup = petGroup;
      state.isGLB = false;
      attachEquips(petGroup);
      loadingDiv.textContent = '使用默认模型';
      setTimeout(function () { if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv); }, 1500);
    });
  } else {
    // 其他宠物使用程序化模型
    var builder = PET_BUILDERS[petType] || PET_BUILDERS['猫咪'];
    var petGroup = builder();
    scene.add(petGroup);
    state.petGroup = petGroup;
    attachEquips(petGroup);
  }

  // 鼠标/触摸交互
  function onMove(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    state.targetRotY = x * 1.2;
    state.targetRotX = y * 0.6;
    state.autoRotate = false;
  }
  function onEnd() { state.autoRotate = true; }

  renderer.domElement.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  renderer.domElement.addEventListener('mouseleave', onEnd);
  renderer.domElement.addEventListener('touchmove', e => { e.preventDefault(); if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  renderer.domElement.addEventListener('touchend', onEnd);
  state._onMove = onMove;
  state._onEnd = onEnd;

  viewers[containerId] = state;
  animate(state);
}

function animate(state) {
  if (state.disposed || state.renderFailed) return;
  state.rafId = requestAnimationFrame(() => animate(state));

  // 注意：getElapsedTime() 内部会调用 getDelta() 消耗掉时间差，
  // 所以必须先调 getDelta()，再用 clock.elapsedTime 获取总时间
  const dt = state.clock.getDelta();
  const t = state.clock.elapsedTime;

  // ====== 叫声定时 (即使模型还在加载也运行) ======
  state.soundTimer -= dt;
  if (state.soundTimer <= 0) {
    playPetSound(state.petType, state.container);
    state.callAnim = 1.0;
    state.soundTimer = 8 + Math.random() * 12; // 8-20秒后再叫
  }
  if (state.callAnim > 0) {
    state.callAnim = Math.max(0, state.callAnim - dt * 2.5);
  }

  // 渲染辅助函数：try-catch 防止 WebGL 崩溃
  function safeRender() {
    try {
      state.renderer.render(state.scene, state.camera);
      var gl = state.renderer.getContext();
      if (gl && gl.isContextLost()) throw new Error('Context lost');
    } catch (e) {
      // WebGL 渲染失败，回退到 CSS 3D
      state.renderFailed = true;
      state.disposed = true;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      var cid = state.containerId;
      var pt = state.petType;
      var eq = state.equipment;
      // 从 viewers 中删除旧状态，避免 dispose 重复处理
      delete viewers[cid];
      // 尝试清理 WebGL 资源（可能失败，忽略错误）
      try { state.renderer.dispose(); } catch(_) {}
      // 清空容器并启动 CSS 回退
      var cont = document.getElementById(cid);
      if (cont) cont.innerHTML = '';
      setTimeout(function() { initCSSFallback(cid, pt, eq); }, 0);
    }
  }

  // GLB 模型仍在加载中，只渲染场景
  if (!state.petGroup) {
    safeRender();
    return;
  }

  // 更新 GLB 内嵌动画
  if (state.mixer) {
    state.mixer.update(dt);
  }

  // ====== 蹦跳定时 ======
  state.hopTimer -= dt;
  if (state.hopTimer <= 0 && !state.isHopping) {
    state.isHopping = true;
    state.hopPhase = 0;
  }
  var hopOffset = 0;
  if (state.isHopping) {
    state.hopPhase += dt * 7;
    if (state.hopPhase >= Math.PI) {
      state.isHopping = false;
      state.hopTimer = 3 + Math.random() * 6; // 3-9秒后再跳
    } else {
      hopOffset = Math.sin(state.hopPhase) * 0.35;
    }
  }

  // ====== 旋转 - 平滑追踪目标 ======
  if (state.autoRotate) {
    state.targetRotY += dt * state.autoRotateSpeed;
  }
  state.currentRotY += (state.targetRotY - state.currentRotY) * 0.08;
  state.currentRotX += (state.targetRotX - state.currentRotX) * 0.08;
  state.petGroup.rotation.y = state.currentRotY;
  state.petGroup.rotation.x = state.currentRotX * 0.5;

  // ====== 呼吸 ======
  var body = state.petGroup.userData.body;
  if (body && !state.mixer) {
    if (!body.userData.baseScaleY) body.userData.baseScaleY = body.scale.y;
    var breathe = 1 + Math.sin(t * 2) * 0.03;
    body.scale.y = body.userData.baseScaleY * breathe;
  }

  // ====== 身体摆动（随呼吸节奏左右轻摆）======
  // 主节拍 0.7Hz 轻柔摇摆 + 呼吸节拍 2.1Hz 微颤
  var bodySway = Math.sin(t * 0.7 + state.headPhase) * 0.08 + Math.sin(t * 2.1) * 0.02;
  if (state.isGLB && state.petGroup.children[0]) {
    // GLB 模型：摆动整个 model
    state.petGroup.children[0].rotation.z = bodySway;
  } else if (body && !state.mixer) {
    // 程序化模型：摆动 body 网格
    body.rotation.z = bodySway;
  }

  // ====== 上下浮动 + 蹦跳 + 叫唤振动 ======
  var floatY = Math.sin(t * 1.5) * 0.04;
  var callShake = state.callAnim > 0 ? Math.sin(t * 28) * 0.025 * state.callAnim : 0;
  state.petGroup.position.y = floatY + hopOffset + callShake;

  // 叫唤时整体轻微放大
  if (state.callAnim > 0) {
    var pulse = 1 + state.callAnim * 0.05;
    state.petGroup.scale.set(pulse, pulse, pulse);
  } else {
    state.petGroup.scale.set(1, 1, 1);
  }

  // ====== 头部摇摆 (程序化模型) ======
  if (!state.isGLB) {
    var head = state.petGroup.userData.head;
    if (head) {
      head.rotation.z = Math.sin(t * 0.9 + state.headPhase) * 0.15;
      head.rotation.x = Math.sin(t * 1.3 + state.headPhase * 0.7) * 0.10;
      // 叫唤时头部前倾
      if (state.callAnim > 0) {
        head.position.z = 0.18 + state.callAnim * 0.08;
      } else {
        head.position.z = head.userData.basePosZ || 0.18;
        if (!head.userData.basePosZ) head.userData.basePosZ = head.position.z;
      }
    }

    // ====== 眨眼 ======
    state.blinkTimer -= dt;
    if (state.blinkTimer <= 0 && !state.isBlinking) {
      state.isBlinking = true;
      state.blinkTimer = 0.12;
    } else if (state.isBlinking && state.blinkTimer <= 0) {
      state.isBlinking = false;
      state.blinkTimer = 2 + Math.random() * 3;
    }
    var eyeScale = state.isBlinking ? 0.1 : 1;
    ['eyeL', 'eyeR'].forEach(k => {
      var eye = state.petGroup.userData[k];
      if (eye) eye.scale.y = eyeScale;
    });

    // ====== 摆尾 (更活泼) ======
    var tail = state.petGroup.userData.tail;
    if (tail) {
      var tailSpeed = state.callAnim > 0 ? 8 : 4;
      tail.rotation.z = Math.sin(t * tailSpeed) * 0.35;
    }
  } else if (state.isGLB && state.headPivot) {
    // GLB 模型头部摇摆：持续轻柔地左右转头 + 微微点头
    state.headPivot.rotation.y = Math.sin(t * 0.9 + state.headPhase) * 0.20;
    state.headPivot.rotation.x = Math.sin(t * 1.3 + state.headPhase * 0.7) * 0.08;
    // 叫唤时头部前倾
    if (state.callAnim > 0) {
      state.headPivot.rotation.x += state.callAnim * 0.08;
    }
  }

  safeRender();
}

function dispose(containerId) {
  const state = viewers[containerId];
  if (!state) return;
  state.disposed = true;
  if (state.rafId) cancelAnimationFrame(state.rafId);

  // 清理语音气泡
  const bubble = state.container.querySelector('.pet-speech');
  if (bubble) bubble.remove();

  // CSS 回退模式的清理
  if (state.isCSS) {
    if (state._onMove && state._container) {
      state._container.removeEventListener('mousemove', state._onMove);
      state._container.removeEventListener('touchmove', state._onMove);
    }
    if (state._onEnd && state._container) {
      state._container.removeEventListener('mouseleave', state._onEnd);
      state._container.removeEventListener('touchend', state._onEnd);
    }
    // 清空容器内容
    state.container.innerHTML = '';
    delete viewers[containerId];
    return;
  }

  // WebGL 模式的清理
  const el = state.renderer.domElement;
  if (state._onMove) {
    el.removeEventListener('mousemove', state._onMove);
    el.removeEventListener('touchmove', state._onMove);
  }
  if (state._onEnd) {
    el.removeEventListener('mouseleave', state._onEnd);
    el.removeEventListener('touchend', state._onEnd);
  }

  // 释放资源
  state.scene.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  state.renderer.dispose();
  if (el.parentNode) el.parentNode.removeChild(el);
  delete viewers[containerId];
}

function disposeAll() {
  Object.keys(viewers).forEach(id => dispose(id));
}

// 暴露到全局
window.Pet3DViewer = { init, dispose, disposeAll, testWebGLRender };
