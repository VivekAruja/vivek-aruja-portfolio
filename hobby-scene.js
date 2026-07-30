(function () {
  var tabs = document.getElementById('hobbyTabs');
  var info = document.getElementById('hobbyInfo');
  var captionEl = document.getElementById('hobbyCaption');
  var descEl = document.getElementById('hobbyDesc');

  if (!tabs) return;

  function setActive(hobbyKey) {
    tabs.querySelectorAll('.hobby-tab').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.hobby === hobbyKey);
    });
  }

  function selectHobby(btn) {
    var key = btn.dataset.hobby;
    setActive(key);
    btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });

    info.classList.add('is-fading');
    window.setTimeout(function () {
      captionEl.textContent = btn.dataset.caption;
      descEl.textContent = btn.dataset.body;
      info.classList.remove('is-fading');
    }, 180);

    if (window.hobbySetScene) window.hobbySetScene(key);
  }

  tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('.hobby-tab');
    if (!btn) return;
    selectHobby(btn);
  });

  /* ---- 3D scene ---- */
  var stage = document.querySelector('.hobby-stage');
  var canvas = document.getElementById('hobbyCanvas');
  if (!stage || !canvas) return;
  if (canvas.dataset.hobbySceneInit) return;
  canvas.dataset.hobbySceneInit = 'true';

  function showStageError(message) {
    var note = document.createElement('p');
    note.className = 'hobby-stage-error';
    note.textContent = message;
    stage.appendChild(note);
    if (window.console) console.error('[hobby-scene] ' + message);
  }

  if (typeof THREE === 'undefined') {
    showStageError('3D library failed to load (vendor/three.min.js). Check the browser console/network tab.');
    return;
  }
  if (typeof THREE.GLTFLoader !== 'function') {
    showStageError('glTF loader failed to load (vendor/GLTFLoader.js). Check the browser console/network tab.');
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) {
    showStageError('WebGL is unavailable in this browser: ' + e.message);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  var keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(2.5, 3, 4);
  scene.add(keyLight);
  var fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(-3, -1.5, 2);
  scene.add(fillLight);

  var modelGroup = new THREE.Group();
  scene.add(modelGroup);

  var gltfLoader = (typeof THREE.GLTFLoader === 'function') ? new THREE.GLTFLoader() : null;

  var hobbyDefs = {
    basketball: { src: 'assets/models/basketball/scene.gltf', baseRotation: { x: Math.PI / 2, y: Math.PI / 2 }, spinAxis: 'y' },
    reading: { src: 'assets/models/book/scene.gltf', baseRotation: { x: 1.3, y: 0.45 }, spinAxis: 'y' },
    music: { src: 'assets/models/headset/model.glb', baseRotation: { x: 0, y: 0 }, spinAxis: 'y' },
    video: { src: 'assets/models/clapperboard/scene.gltf', baseRotation: { x: 0, y: 0 }, spinAxis: 'y' }
  };

  var modelCache = {};
  var currentKey = 'basketball';
  var modelRotation = { x: 0, y: 0 };
  var spinAxis = 'y';

  function clearModelGroup() {
    while (modelGroup.children.length) modelGroup.remove(modelGroup.children[0]);
  }

  function frameModel(object3d, tilt) {
    /* Bake the resting pose in as the model's own local rotation, not
       the spinning group's. The continuous idle/drag spin always turns
       the outer modelGroup around a single world axis; if a static tilt
       were mixed into that same Euler rotation, the tilt would redirect
       the spin into the screen plane instead of a clean depth-wise
       globe turn. Keeping the tilt on the child (like a planet's axial
       tilt riding along with its own spin) avoids that entirely. */
    if (tilt) {
      object3d.rotation.x = tilt.x || 0;
      object3d.rotation.y = tilt.y || 0;
    }

    /* Pass 1: measure the raw (unscaled) size to pick a scale factor. */
    object3d.updateMatrixWorld(true);
    var rawBox = new THREE.Box3().setFromObject(object3d);
    var rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);
    var maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;
    var targetSize = 2.6;
    object3d.scale.setScalar(targetSize / maxDim);

    /* Pass 2: re-measure at the final scale before centering. Centering
       from the pass-1 box would tune the position offset for the old
       scale, then the later scale change amplifies that offset instead
       of cancelling it. */
    object3d.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(object3d);
    var center = new THREE.Vector3();
    box.getCenter(center);
    object3d.position.sub(center);

    object3d.traverse(function (node) {
      if (node.isMesh) {
        var oldMat = node.material;

        /* Some low-poly exports pair a per-facet UV layout with a
           normal/roughness map that reads as harsh, faceted specular
           noise under this scene's lighting. Rebuilding those specific
           materials as plain diffuse keeps the real base color texture
           without that noise. Materials with no normal map (most of these
           solid-color Sketchfab models) are left alone so their actual
           PBR look (clearcoat, emissive, roughness) survives instead of
           being flattened for a problem they don't have. */
        if (oldMat.normalMap) {
          var map = oldMat.map;
          node.material = new THREE.MeshLambertMaterial({
            map: map,
            color: map ? 0xffffff : oldMat.color,
            transparent: oldMat.transparent,
            side: oldMat.side
          });

          /* Mesh-simplification tools generally don't recompute smooth
             per-vertex normals after collapsing edges, so decimated
             geometry (like this one) often keeps flat, per-facet normals
             that read as faceted/glitchy shading regardless of polygon
             count. Recomputing them blends adjacent faces properly. */
          node.geometry.computeVertexNormals();
        }
      }
    });
  }

  function showModel(key, src) {
    modelRotation.x = 0;
    modelRotation.y = 0;
    var def = hobbyDefs[key];
    spinAxis = (def && def.spinAxis) ? def.spinAxis : 'y';

    if (modelCache[key]) {
      clearModelGroup();
      modelGroup.add(modelCache[key]);
      return;
    }
    if (!gltfLoader) return;

    gltfLoader.load(
      src,
      function (gltf) {
        var obj = gltf.scene;
        frameModel(obj, def && def.baseRotation);
        modelCache[key] = obj;
        if (currentKey === key) {
          clearModelGroup();
          modelGroup.add(obj);
        }
      },
      undefined,
      function () {
        showStageError('Failed to load "' + key + '" model (' + src + '). Check the browser console/network tab for a 404 or CORS error.');
      }
    );
  }

  function applyHobby(key) {
    var def = hobbyDefs[key];
    if (!def) return;
    showModel(key, def.src);
  }

  window.hobbySetScene = function (key) {
    currentKey = key;
    applyHobby(key);
  };
  applyHobby(currentKey);

  function resize() {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* -- pointer interaction: drag to rotate the model -- */
  var isDragging = false;
  var lastX = 0;
  var lastY = 0;

  stage.addEventListener('pointerdown', function (e) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('pointerup', function () {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });
  stage.addEventListener('pointermove', function (e) {
    if (!isDragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    modelRotation.y += dx * 0.01;
    modelRotation.x = Math.max(-0.6, Math.min(0.6, modelRotation.x + dy * 0.01));
    lastX = e.clientX;
    lastY = e.clientY;
  });

  function animate() {
    requestAnimationFrame(animate);

    if (modelGroup.children[0]) {
      if (!isDragging && !reduceMotion) modelRotation[spinAxis] += 0.004;
      modelGroup.rotation.set(modelRotation.x, modelRotation.y, 0);
    }

    renderer.render(scene, camera);
  }
  animate();
})();
