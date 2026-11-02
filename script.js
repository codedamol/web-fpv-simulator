// --- DEV CREDIT ---
console.log("Web FPV Simulator developed by John (johnicebourne@gmail.com)");

// --- GAME STATE ---
let scene, camera, renderer;
let drone;
let velocity = new THREE.Vector3(0, 0, 0);
let isFlying = false;
let clock = new THREE.Clock();

// Physics Constants
const GRAVITY = -9.8;
const THRUST_POWER = 20;
const DRAG = 0.95;

// Controls (Simpleng Keyboard)
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };

// DOM Elements
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const speedEl = document.getElementById('speed');
const altEl = document.getElementById('altitude');
const timerEl = document.getElementById('timer');
const fpsEl = document.getElementById('fps');

let startTime;

// --- INIT THREE.JS ---
function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky Blue
    scene.fog = new THREE.Fog(0x87CEEB, 10, 100);

    // Camera (FPV View)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Ground (Simple Grid)
    const gridHelper = new THREE.GridHelper(200, 50, 0x00ff00, 0x444444);
    scene.add(gridHelper);
    
    // Add some "trees" (Simple Cylinders)
    for(let i=0; i<50; i++) {
        const geometry = new THREE.ConeGeometry( 1, 5, 8 );
        const material = new THREE.MeshLambertMaterial( {color: 0x228B22} );
        const tree = new THREE.Mesh( geometry, material );
        tree.position.set((Math.random() - 0.5) * 100, 2.5, (Math.random() - 0.5) * 100);
        scene.add(tree);
    }

    // Drone (Placeholder Cube)
    const droneGeo = new THREE.BoxGeometry(1, 0.2, 1);
    const droneMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    drone = new THREE.Mesh(droneGeo, droneMat);
    drone.position.set(0, 5, 0);
    scene.add(drone);

    // Camera attached to drone
    camera.position.set(0, 0.5, 0); // Medyo nasa ibabaw
    drone.add(camera);

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', (e) => {
        if(e.key === ' ') keys.space = true;
        if(e.key === 'Shift') keys.shift = true;
        if(e.key === 'w') keys.w = true;
        if(e.key === 's') keys.s = true;
        if(e.key === 'a') keys.a = true;
        if(e.key === 'd') keys.d = true;
        if(e.key === 'Escape' && isFlying) exitGame();
    });
    window.addEventListener('keyup', (e) => {
        if(e.key === ' ') keys.space = false;
        if(e.key === 'Shift') keys.shift = false;
        if(e.key === 'w') keys.w = false;
        if(e.key === 's') keys.s = false;
        if(e.key === 'a') keys.a = false;
        if(e.key === 'd') keys.d = false;
    });
}

// --- GAME LOGIC ---
function startGame() {
    if (!scene) init3D();
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    isFlying = true;
    startTime = Date.now();
    animate();
}

function exitGame() {
    isFlying = false;
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex';
    document.getElementById('exit-btn').style.display = 'none';
    // Reset drone
    drone.position.set(0, 5, 0);
    drone.rotation.set(0, 0, 0);
    velocity.set(0, 0, 0);
}

function updatePhysics(delta) {
    if (!isFlying) return;

    // Throttle (Space = Up, Shift = Down)
    if (keys.space) velocity.y += THRUST_POWER * delta;
    if (keys.shift) velocity.y -= THRUST_POWER * delta;
    
    // Gravity
    velocity.y += GRAVITY * delta;

    // Movement (W, S, A, D)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(drone.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(drone.quaternion);

    if (keys.w) velocity.add(forward.multiplyScalar(15 * delta));
    if (keys.s) velocity.add(forward.multiplyScalar(-15 * delta));
    if (keys.a) velocity.add(right.multiplyScalar(-15 * delta));
    if (keys.d) velocity.add(right.multiplyScalar(15 * delta));

    // Drag
    velocity.multiplyScalar(DRAG);

    // Apply to drone
    drone.position.add(velocity.clone().multiplyScalar(delta));

    // Prevent going underground
    if (drone.position.y < 0.5) {
        drone.position.y = 0.5;
        velocity.y = 0;
    }

    // Tilt Drone based on velocity (Simple Acro mode feel)
    drone.rotation.x = THREE.MathUtils.lerp(drone.rotation.x, velocity.z * -0.05, 0.1);
    drone.rotation.z = THREE.MathUtils.lerp(drone.rotation.z, velocity.x * 0.05, 0.1);

    // Update OSD
    const speed = velocity.length() * 3.6; // Convert to KM/H (approx)
    speedEl.innerText = speed.toFixed(1);
    altEl.innerText = drone.position.y.toFixed(1);
}

function updateTimer() {
    if (!startTime) return;
    const elapsed = Date.now() - startTime;
    const mins = String(Math.floor(elapsed / 60000)).padStart(2, '0');
    const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
    const ms = String(Math.floor((elapsed % 1000) / 10)).padStart(2, '0');
    timerEl.innerText = `${mins}:${secs}:${ms}`;
}

// --- RENDER LOOP ---
function animate() {
    if (!isFlying) return;
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    
    updatePhysics(delta);
    updateTimer();
    
    // FPS Counter (Fake)
    fpsEl.innerText = Math.floor(1 / delta);

    // Pause Button Logic (Escape)
    if (document.getElementById('exit-btn').style.display === 'block') {
        renderer.render(scene, camera);
        return;
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Pause Toggle
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFlying) {
        const btn = document.getElementById('exit-btn');
        btn.style.display = btn.style.display === 'none' ? 'block' : 'none';
    }
});
