import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import Ammo from "ammojs-typed";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import tableroImg from "./texturas/tablero.jpg";
import bolaImg from "./texturas/bola.jpg";
import marcoImg from "./texturas/marco.jpg";
import fondoImg from "./texturas/fondo.jpg";

// Escena y renderizado
let scene, camera, renderer, controls;
const clock = new THREE.Clock();

// Mundo físico (Ammo.js)
let ammo;
let physicsWorld;
let transformAux;
const rigidBodies = [];
const kinematicObjects = [];

// Bola y elementos del tablero
let ballMesh, ballBody;
const BALL_RADIUS = 0.32;
const BALL_START = new THREE.Vector3(4.23, BALL_RADIUS + 0.05, 7.15);

let leftFlipperPivot, leftFlipperMesh, leftFlipperBody;
let rightFlipperPivot, rightFlipperMesh, rightFlipperBody;
let spinnerMesh, spinnerBody;
const bumpers = [];

// Estado de partida y audio
let score = 0;
let ballsPlayed = 1;
let audioCtx = null;

// Arranque tras cargar Ammo.js
Ammo().then((AmmoLib) => {
  ammo = AmmoLib;
  initGraphics();
  initPhysics();
  buildPinballTable();
  setupHUD();
  setupControls();
  animate();
});

// Inicialización gráfica (Three.js)
function initGraphics() {
  scene = new THREE.Scene();
  const bgTex = new THREE.TextureLoader().load(fondoImg);
  bgTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = bgTex;

  scene.fog = new THREE.FogExp2(0x0b1021, 0.018);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(-0.6, 18, 18);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Ajuste a pantalla completa sin barras de desplazamiento
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.margin = "0";
  renderer.domElement.style.position = "fixed";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.left = "0";

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-0.6, -0.4, 0.5);
  controls.enableDamping = true;
  controls.update();

  // Luces y sombras
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(6, 18, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 2;
  dirLight.shadow.camera.far = 40;
  const d = 18;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);

  const neonLight = new THREE.PointLight(0x38bdf8, 1.4, 22);
  neonLight.position.set(-0.6, 4, -3);
  scene.add(neonLight);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Inicialización física (Ammo.js)
function initPhysics() {
  const collisionConfiguration = new ammo.btDefaultCollisionConfiguration();
  const dispatcher = new ammo.btCollisionDispatcher(collisionConfiguration);
  const overlappingPairCache = new ammo.btDbvtBroadphase();
  const solver = new ammo.btSequentialImpulseConstraintSolver();

  physicsWorld = new ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);

  // Gravedad inclinada en +Z para simular la pendiente de la mesa
  physicsWorld.setGravity(new ammo.btVector3(0, -9.8, 3.8));
  transformAux = new ammo.btTransform();
}

// Construcción de la mesa, bola, palas y obstáculos
function buildPinballTable() {
  const textureLoader = new THREE.TextureLoader();

  // Base del tablero
  const boardTex = textureLoader.load(tableroImg);
  boardTex.anisotropy = 4;
  const boardMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    roughness: 0.45,
    metalness: 0.15,
  });
  createRigidBox(
    new THREE.Vector3(0, -0.25, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(10, 0.5, 18),
    0,
    boardMat,
    0.4
  );

  // Materiales del marco y guías translúcidas
  const wallTex = textureLoader.load(marcoImg);
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(6, 1);

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    bumpMap: wallTex,
    bumpScale: 0.02,
    color: 0x64748b,
    roughness: 0.28,
    metalness: 0.8,
  });

  const accentWallMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x1e293b,
    emissiveIntensity: 0.2,
    roughness: 0.12,
    metalness: 0.85,
    transparent: true,
    opacity: 0.65,
  });

  // Marco exterior
  createStaticWall(-4.85, 0.4, 0, 0.3, 0.8, 18, 0, wallMat, 0.7);
  createStaticWall(4.85, 0.4, 0, 0.3, 0.8, 18, 0, wallMat, 0.7);
  createStaticWall(0, 0.4, -8.85, 10, 0.8, 0.3, 0, wallMat, 0.7);
  createStaticWall(0, 0.4, 8.85, 10, 0.8, 0.3, 0, wallMat, 0.2);

  // Carril de lanzamiento, deflectores superiores y embudos
  createStaticWall(3.65, 0.34, 1.9, 0.14, 0.68, 13.4, 0, accentWallMat, 0.6);
  createStaticWall(3.75, 0.34, -7.95, 2.2, 0.68, 0.14, 0.52, accentWallMat, 0.85);
  createStaticWall(-3.9, 0.34, -7.8, 2.2, 0.68, 0.14, -Math.PI / 4, accentWallMat, 0.8);
  createStaticWall(-3.52, 0.34, 5.65, 2.9, 0.68, 0.14, -0.62, accentWallMat, 0.6);
  createStaticWall(2.32, 0.34, 5.65, 2.9, 0.68, 0.14, 0.62, accentWallMat, 0.6);
  createStaticWall(4.25, 0.4, 7.75, 1.0, 0.8, 0.3, 0, wallMat, 0.2);

  // Bola metálica con detección continua de colisiones (CCD)
  const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
  const ballTex = textureLoader.load(bolaImg);
  const ballMat = new THREE.MeshStandardMaterial({
    map: ballTex,
    metalness: 0.85,
    roughness: 0.15,
  });

  ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.castShadow = true;
  ballMesh.position.copy(BALL_START);
  scene.add(ballMesh);

  const ballShape = new ammo.btSphereShape(BALL_RADIUS);
  ballBody = createAmmoBody(ballShape, BALL_START, new THREE.Quaternion(), 1.2, 0.65);
  ballBody.setFriction(0.08);
  ballBody.setRollingFriction(0.02);
  ballBody.setActivationState(4);
  ballBody.setCcdMotionThreshold(0.05);
  ballBody.setCcdSweptSphereRadius(BALL_RADIUS * 0.8);
  rigidBodies.push({ mesh: ballMesh, body: ballBody });

  // Palas inferiores (pivotes + cuerpos cinemáticos)
  const flipperMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.3,
  });

  const pivotCapGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.46, 20);

  leftFlipperPivot = new THREE.Object3D();
  leftFlipperPivot.position.set(-2.34, 0.22, 6.5);
  leftFlipperPivot.rotation.y = -0.62;
  scene.add(leftFlipperPivot);
  leftFlipperPivot.add(new THREE.Mesh(pivotCapGeo, wallMat));

  leftFlipperMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.44, 0.17), flipperMat);
  leftFlipperMesh.position.set(0.71, 0, 0);
  leftFlipperMesh.castShadow = true;
  leftFlipperPivot.add(leftFlipperMesh);

  leftFlipperBody = createKinematicBox(leftFlipperMesh, new THREE.Vector3(1.42, 0.44, 0.17), 1.1);

  rightFlipperPivot = new THREE.Object3D();
  rightFlipperPivot.position.set(1.14, 0.22, 6.5);
  rightFlipperPivot.rotation.y = 0.62;
  scene.add(rightFlipperPivot);
  rightFlipperPivot.add(new THREE.Mesh(pivotCapGeo, wallMat));

  rightFlipperMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.44, 0.17), flipperMat);
  rightFlipperMesh.position.set(-0.71, 0, 0);
  rightFlipperMesh.castShadow = true;
  rightFlipperPivot.add(rightFlipperMesh);

  rightFlipperBody = createKinematicBox(rightFlipperMesh, new THREE.Vector3(1.42, 0.44, 0.17), 1.1);

  // Bumpers de puntuación
  createBumper(-1.85, -3.6, 0.62, 0xf59e0b, 100);
  createBumper(0.65, -3.6, 0.62, 0xf59e0b, 100);
  createBumper(-0.6, -1.7, 0.68, 0x10b981, 200);

  // Obstáculo móvil central animado con Tween.js
  const spinnerMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.4,
  });
  spinnerMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.28), spinnerMat);
  spinnerMesh.position.set(-2.1, 0.35, 1.3);
  spinnerMesh.castShadow = true;
  scene.add(spinnerMesh);

  spinnerBody = createKinematicBox(spinnerMesh, new THREE.Vector3(1.6, 0.55, 0.28), 0.9);

  new TWEEN.Tween({ x: -2.1, rotY: 0 })
    .to({ x: 0.9, rotY: Math.PI }, 1800)
    .easing(TWEEN.Easing.Sinusoidal.InOut)
    .yoyo(true)
    .repeat(Infinity)
    .onUpdate((coords) => {
      spinnerMesh.position.x = coords.x;
      spinnerMesh.rotation.y = coords.rotY;
    })
    .start();

  // Cajón inferior, patas y plano receptor de sombras
  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.4,
  });

  const cabinetMesh = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.4, 17.6), cabinetMat);
  cabinetMesh.position.set(0, -1.2, 0);
  cabinetMesh.castShadow = true;
  cabinetMesh.receiveShadow = true;
  scene.add(cabinetMesh);

  const legGeo = new THREE.BoxGeometry(0.42, 7.5, 0.42);
  const footGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.16, 16);
  const footMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
  });

  const legPositions = [
    [-4.65, -8.65],
    [4.65, -8.65],
    [-4.65, 8.65],
    [4.65, 8.65],
  ];

  for (const [lx, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, wallMat);
    leg.position.set(lx, -4.25, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);

    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(lx, -8.08, lz);
    foot.receiveShadow = true;
    scene.add(foot);
  }

  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -8.16;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);
}

// Funciones auxiliares de geometría y cuerpos físicos
function createStaticWall(x, y, z, w, h, d, rotY, material, restitution) {
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  createRigidBox(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(w, h, d), 0, material, restitution);
}

function createRigidBox(pos, quat, size, mass, material, restitution = 0.5) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);

  const shape = new ammo.btBoxShape(new ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5));
  const body = createAmmoBody(shape, pos, quat, mass, restitution);
  if (mass > 0) rigidBodies.push({ mesh, body });
  return body;
}

function createKinematicBox(mesh, size, restitution = 1.0) {
  mesh.updateWorldMatrix(true, false);
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  mesh.getWorldPosition(worldPos);
  mesh.getWorldQuaternion(worldQuat);

  const shape = new ammo.btBoxShape(new ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5));
  const body = createAmmoBody(shape, worldPos, worldQuat, 0, restitution);
  body.setCollisionFlags(body.getCollisionFlags() | 2);
  body.setActivationState(4);
  kinematicObjects.push({ mesh, body });
  return body;
}

function createAmmoBody(shape, pos, quat, mass, restitution) {
  const transform = new ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new ammo.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(new ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));

  const motionState = new ammo.btDefaultMotionState(transform);
  const localInertia = new ammo.btVector3(0, 0, 0);
  if (mass > 0) shape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  const body = new ammo.btRigidBody(rbInfo);
  body.setRestitution(restitution);
  physicsWorld.addRigidBody(body);
  return body;
}

function createBumper(x, z, radius, colorHex, points = 100) {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.65, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.35, z);
  mesh.castShadow = true;
  scene.add(mesh);

  const shape = new ammo.btCylinderShape(new ammo.btVector3(radius, 0.325, radius));
  createAmmoBody(shape, mesh.position, new THREE.Quaternion(), 0, 1.35);

  bumpers.push({ mesh, radius, points, cooldown: 0 });
}

// Acciones de juego y sonido sintetizado
function triggerFlipper(pivot, restAngle, activeAngle) {
  if (pivot.userData.tween) {
    TWEEN.remove(pivot.userData.tween);
  }
  const state = { angle: pivot.rotation.y };

  const upTween = new TWEEN.Tween(state)
    .to({ angle: activeAngle }, 75)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(() => {
      pivot.rotation.y = state.angle;
    });

  const downTween = new TWEEN.Tween(state)
    .to({ angle: restAngle }, 130)
    .easing(TWEEN.Easing.Quadratic.In)
    .onUpdate(() => {
      pivot.rotation.y = state.angle;
    });

  upTween.chain(downTween);
  pivot.userData.tween = upTween;
  upTween.start();
}

function launchBall() {
  if (ballMesh.position.x > 3.6 && ballMesh.position.z > 2.0) {
    ballBody.activate();
    ballBody.setLinearVelocity(new ammo.btVector3(0, 0, 0));
    ballBody.applyCentralImpulse(new ammo.btVector3(0, 0, -24));
    playTone(320, 0.12);
  }
}

function resetBall() {
  const transform = new ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new ammo.btVector3(BALL_START.x, BALL_START.y, BALL_START.z));
  transform.setRotation(new ammo.btQuaternion(0, 0, 0, 1));

  ballBody.setWorldTransform(transform);
  ballBody.getMotionState().setWorldTransform(transform);
  ballBody.setLinearVelocity(new ammo.btVector3(0, 0, 0));
  ballBody.setAngularVelocity(new ammo.btVector3(0, 0, 0));
  ballBody.activate();

  ballsPlayed++;
  updateHUD();
}

function playTone(freq, duration = 0.09) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// Marcador (HUD) y controles de teclado
function setupHUD() {
  const oldHud = document.getElementById("pinball-hud");
  if (oldHud) oldHud.remove();

  const hud = document.createElement("div");
  hud.id = "pinball-hud";
  hud.style.cssText = `
    position: absolute;
    top: 16px;
    left: 16px;
    background: rgba(12, 14, 20, 0.78);
    color: #e5e7eb;
    padding: 12px 16px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    font-family: monospace;
    pointer-events: none;
    user-select: none;
  `;

  const kbdStyle = "background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; color: #f3f4f6;";

  hud.innerHTML = `
    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px; letter-spacing: 0.5px;">
      PINBALL 3D - Nicolás Hernández Castro
    </div>
    <div style="display: flex; gap: 20px; align-items: baseline; margin-bottom: 10px;">
      <div>
        <div style="font-size: 10px; color: #9ca3af;">PUNTUACIÓN</div>
        <div id="hud-points" style="font-size: 22px; font-weight: bold; color: #ffffff;">0</div>
      </div>
      <div style="border-left: 1px solid rgba(255,255,255,0.14); padding-left: 16px;">
        <div style="font-size: 10px; color: #9ca3af;">BOLA</div>
        <div id="hud-ball" style="font-size: 22px; font-weight: bold; color: #ffffff;">1</div>
      </div>
    </div>
    <div style="font-size: 11px; color: #9ca3af; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
      <span style="${kbdStyle}">Espacio</span> Lanzar &nbsp;
      <span style="${kbdStyle}">A/←</span> Izq &nbsp;
      <span style="${kbdStyle}">D/→</span> Der &nbsp;
      <span style="${kbdStyle}">Enter</span> Nueva
    </div>
  `;
  document.body.appendChild(hud);
}

function updateHUD() {
  const pointsEl = document.getElementById("hud-points");
  const ballEl = document.getElementById("hud-ball");
  if (pointsEl) pointsEl.textContent = score;
  if (ballEl) ballEl.textContent = ballsPlayed;
}

function setupControls() {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case "Space":
        launchBall();
        break;
      case "ArrowLeft":
      case "KeyA":
        triggerFlipper(leftFlipperPivot, -0.62, 0.48);
        break;
      case "ArrowRight":
      case "KeyD":
        triggerFlipper(rightFlipperPivot, 0.62, -0.48);
        break;
      case "Enter":
        resetBall();
        break;
    }
  });
}

// Bucle de simulación física y renderizado
function updatePhysics(deltaTime) {
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();

  // Sincronizar objetos animados (palas y obstáculo) con Ammo.js
  for (const item of kinematicObjects) {
    item.mesh.updateWorldMatrix(true, false);
    item.mesh.getWorldPosition(tmpPos);
    item.mesh.getWorldQuaternion(tmpQuat);

    transformAux.setIdentity();
    transformAux.setOrigin(new ammo.btVector3(tmpPos.x, tmpPos.y, tmpPos.z));
    transformAux.setRotation(new ammo.btQuaternion(tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w));
    item.body.getMotionState().setWorldTransform(transformAux);
    item.body.setWorldTransform(transformAux);
  }

  physicsWorld.stepSimulation(deltaTime, 10);

  // Actualizar posición visual de los cuerpos dinámicos
  for (const obj of rigidBodies) {
    const ms = obj.body.getMotionState();
    if (ms) {
      ms.getWorldTransform(transformAux);
      const p = transformAux.getOrigin();
      const q = transformAux.getRotation();
      obj.mesh.position.set(p.x(), p.y(), p.z());
      obj.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
  }

  // Rebotes y puntuación en los bumpers
  for (const b of bumpers) {
    if (b.cooldown > 0) b.cooldown -= deltaTime;

    const dx = ballMesh.position.x - b.mesh.position.x;
    const dz = ballMesh.position.z - b.mesh.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < BALL_RADIUS + b.radius + 0.18 && b.cooldown <= 0) {
      b.cooldown = 0.22;
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);

      ballBody.activate();
      ballBody.applyCentralImpulse(new ammo.btVector3(nx * 10, 0, nz * 10));

      b.mesh.scale.set(1.35, 1.15, 1.35);
      new TWEEN.Tween(b.mesh.scale).to({ x: 1, y: 1, z: 1 }, 180).easing(TWEEN.Easing.Elastic.Out).start();

      score += b.points;
      updateHUD();
      playTone(b.points > 100 ? 780 : 580, 0.11);
    }
  }

  // Reiniciar bola si cae por debajo de las palas
  if (ballMesh.position.z > 8.2 && ballMesh.position.x < 3.5) {
    playTone(160, 0.25);
    resetBall();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.05);

  TWEEN.update();
  updatePhysics(deltaTime);

  controls.update();
  renderer.render(scene, camera);
}
