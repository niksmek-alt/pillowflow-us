import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

(function(){
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = Boolean(window.gsap && window.ScrollTrigger);
  if (hasGSAP) window.gsap.registerPlugin(window.ScrollTrigger);

  function q(selector, root){ return (root || document).querySelector(selector); }
  function qa(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function scrollProgress(){
    var max = Math.max(1,document.documentElement.scrollHeight - window.innerHeight);
    return Math.max(0,Math.min(1,window.scrollY / max));
  }

  function addScrollCue(){
    var hero = q(".pf-section-hero");
    if (!hero || q(".pf-v3-scroll-cue",hero)) return;
    var cue = document.createElement("span");
    cue.className = "pf-v3-scroll-cue";
    cue.setAttribute("aria-hidden","true");
    cue.innerHTML = "<i></i>";
    hero.appendChild(cue);
  }

  function makeRoadRibbon(curve,width){
    var segments = 180;
    var positions = [];
    var uvs = [];
    var indices = [];
    var up = new THREE.Vector3(0,1,0);
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var point = curve.getPoint(t);
      var tangent = curve.getTangent(t).normalize();
      var side = new THREE.Vector3().crossVectors(up,tangent).normalize();
      var swell = 1 + Math.sin(t * Math.PI * 2.4) * .07;
      var half = width * swell * .5;
      var left = point.clone().addScaledVector(side,half);
      var right = point.clone().addScaledVector(side,-half);
      positions.push(left.x,left.y,left.z,right.x,right.y,right.z);
      uvs.push(0,t * 12,1,t * 12);
      if (i < segments) {
        var base = i * 2;
        indices.push(base,base + 1,base + 2,base + 1,base + 3,base + 2);
      }
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function initRoadScene(){
    if (!window.WebGLRenderingContext) return;

    var shade = document.createElement("div");
    shade.className = "pf-v3-road-shade";
    document.body.prepend(shade);

    var mount = document.createElement("div");
    mount.className = "pf-v3-road-world";
    document.body.prepend(mount);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42,1,.1,120);
    var renderer = new THREE.WebGLRenderer({
      alpha:true,
      antialias:true,
      powerPreference:"high-performance"
    });
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.45));
    mount.appendChild(renderer.domElement);

    var roadCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(4.2,-2.15,18),
      new THREE.Vector3(1.1,-2.1,8),
      new THREE.Vector3(4.8,-2.15,-4),
      new THREE.Vector3(-.8,-2.1,-16),
      new THREE.Vector3(3.4,-2.18,-30),
      new THREE.Vector3(-2.4,-2.12,-44),
      new THREE.Vector3(2.6,-2.2,-60),
      new THREE.Vector3(-.8,-2.1,-76)
    ]);

    var road = new THREE.Mesh(
      makeRoadRibbon(roadCurve,4.8),
      new THREE.MeshBasicMaterial({
        color:0xefe8dd,
        transparent:true,
        opacity:.48,
        side:THREE.DoubleSide,
        depthWrite:false
      })
    );
    scene.add(road);

    var edgeMaterial = new THREE.MeshBasicMaterial({
      color:0xc9b9aa,
      transparent:true,
      opacity:.34,
      depthWrite:false
    });
    var up = new THREE.Vector3(0,1,0);
    [-2.45,2.45].forEach(function(offset){
      var points = [];
      for (var i = 0; i <= 150; i++) {
        var t = i / 150;
        var point = roadCurve.getPoint(t);
        var side = new THREE.Vector3().crossVectors(up,roadCurve.getTangent(t).normalize()).normalize();
        points.push(point.clone().addScaledVector(side,offset));
      }
      var edgeCurve = new THREE.CatmullRomCurve3(points);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(edgeCurve,150,.018,6,false),edgeMaterial));
    });

    var dashMaterial = new THREE.MeshBasicMaterial({
      color:0xe8673a,
      transparent:true,
      opacity:.42,
      depthWrite:false
    });
    for (var d = 0; d < 36; d++) {
      var dt = d / 36;
      var p = roadCurve.getPoint(dt);
      var tan = roadCurve.getTangent(dt);
      var dash = new THREE.Mesh(new THREE.PlaneGeometry(.06,1.1),dashMaterial);
      dash.position.copy(p).add(new THREE.Vector3(0,.025,0));
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = Math.atan2(tan.x,tan.z);
      scene.add(dash);
    }

    var flowMaterial = new THREE.MeshBasicMaterial({
      color:0xe8673a,
      transparent:true,
      opacity:.62,
      depthWrite:false
    });
    var flowDots = [];
    for (var f = 0; f < 18; f++) {
      var dot = new THREE.Mesh(new THREE.SphereGeometry(.045,10,10),flowMaterial);
      dot.userData.seed = f / 18;
      flowDots.push(dot);
      scene.add(dot);
    }

    function resize(){
      var width = Math.max(1,window.innerWidth);
      var height = Math.max(1,window.innerHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);
    }
    window.addEventListener("resize",resize,{ passive:true });
    resize();

    var start = performance.now();
    function tick(now){
      var p = scrollProgress();
      var mobile = window.innerWidth < 760;
      if (reduced) {
        camera.position.set(mobile ? 2.8 : 4.2,3.8,14);
        camera.rotation.set(-.26,.14,0);
        camera.lookAt(mobile ? .6 : 1.2,-2.05,-7);
        road.material.opacity = mobile ? .22 : .38;
        edgeMaterial.opacity = mobile ? .14 : .24;
        dashMaterial.opacity = mobile ? .16 : .3;
        flowDots.forEach(function(dot){
          var point = roadCurve.getPoint(Math.min(.998,Math.max(.002,dot.userData.seed)));
          dot.position.copy(point).add(new THREE.Vector3(0,.12,0));
          dot.scale.setScalar(.72);
        });
        renderer.render(scene,camera);
        return;
      }
      var time = (now - start) / 1000;
      camera.position.set(mobile ? 2.8 : 4.2,3.8 - p * 1.1,14 - p * 55);
      camera.rotation.set(-.26 - p * .08,.14 - p * .22,0);
      camera.lookAt(mobile ? .6 : 1.2,-2.05,-7 - p * 48);
      road.material.opacity = mobile ? .28 : .46 - p * .06;
      edgeMaterial.opacity = mobile ? .18 : .34;
      dashMaterial.opacity = mobile ? .2 : .42;
      flowDots.forEach(function(dot,index){
        var rawT = (dot.userData.seed + time * .045 + p * .18) % 1;
        var t = Number.isFinite(rawT) ? Math.min(.998,Math.max(.002,rawT)) : .002;
        var point = roadCurve.getPoint(t);
        var side = new THREE.Vector3().crossVectors(up,roadCurve.getTangent(t).normalize()).normalize();
        dot.position.copy(point).addScaledVector(side,Math.sin((time + index) * 1.7) * .32).add(new THREE.Vector3(0,.12,0));
        var pulse = .65 + Math.sin(time * 2.1 + index) * .22;
        dot.scale.setScalar(pulse);
      });
      renderer.render(scene,camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function runLoader(done){
    if (document.getElementById("pfLoader")) {
      done();
      return;
    }

    if (reduced) {
      document.body.classList.add("pf-ready");
      done();
      return;
    }

    var loader = document.createElement("div");
    loader.className = "pf-loader";
    loader.id = "pfLoader";
    loader.setAttribute("aria-hidden","true");
    loader.innerHTML = [
      '<div class="pf-loader-inner">',
        '<div class="pf-loader-kicker">PF-X01 / Fleet comfort systems</div>',
        '<div class="pf-loader-mark"><span>PillowFlow<sup>TM</sup></span></div>',
        '<div class="pf-loader-count" id="pfLoaderCount">000</div>',
        '<div class="pf-loader-bar"><i id="pfLoaderBar"></i></div>',
        '<div class="pf-loader-status"><i></i><span id="pfLoaderStatus">Preparing experience</span></div>',
      '</div>'
    ].join("");
    document.body.prepend(loader);

    var count = q("#pfLoaderCount",loader);
    var bar = q("#pfLoaderBar",loader);
    var status = q("#pfLoaderStatus",loader);
    var started = 0;
    var duration = 1050;

    requestAnimationFrame(function(){ loader.classList.add("tick"); });

    function finish(){
      if (status) status.textContent = "Ready";
      loader.classList.add("done");
      document.body.classList.add("pf-ready");
      window.setTimeout(done,300);
      window.setTimeout(function(){ loader.remove(); },1300);
    }

    function step(now){
      if (!started) started = now;
      var progress = Math.min(1,(now - started) / duration);
      var eased = 1 - Math.pow(1 - progress,3);
      var value = Math.round(eased * 100);
      if (count) count.textContent = String(value).padStart(3,"0");
      if (bar) bar.style.transform = "scaleX(" + eased.toFixed(4) + ")";
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        window.setTimeout(finish,160);
      }
    }

    requestAnimationFrame(step);
  }

  function initModel(){
    var frame = q(".pf-hero-product-frame");
    if (!frame || !window.WebGLRenderingContext) return;

    var mount = document.createElement("div");
    mount.className = "pf-v3-model";
    mount.innerHTML = '<div class="pf-v3-model-fallback">Loading PF-X01 3D model</div>';
    var productSpec = q(".pf-hero-product-spec",frame);
    frame.insertBefore(mount,productSpec || null);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32,1,0.01,100);
    camera.position.set(0.04,0.04,3.85);

    var renderer = new THREE.WebGLRenderer({
      alpha:true,
      antialias:true,
      powerPreference:"high-performance"
    });
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.65));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff,0xf0d8c8,1.65));
    var key = new THREE.DirectionalLight(0xffffff,3.1);
    key.position.set(2.8,3.4,3.6);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xffb58f,1.5);
    fill.position.set(-2.2,1.5,1.8);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffffff,2.2);
    rim.position.set(-2.4,2.6,-2.8);
    scene.add(rim);

    var group = new THREE.Group();
    scene.add(group);

    var loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load("/assets/models/PF_OnSeat_orange.optimized.glb",function(gltf){
      gltf.scene.updateMatrixWorld(true);
      var rawObject = new THREE.Group();
      gltf.scene.traverse(function(child){
        if (!child.isMesh) return;
        var mesh = new THREE.Mesh(child.geometry,child.material);
        mesh.name = child.name;
        mesh.matrix.copy(child.matrixWorld);
        mesh.matrixAutoUpdate = false;
        rawObject.add(mesh);
      });
      var box = new THREE.Box3().setFromObject(rawObject);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      var maxAxis = Math.max(size.x,size.y,size.z);
      rawObject.position.set(-center.x,-center.y,-center.z);
      var object = new THREE.Group();
      object.scale.setScalar(maxAxis > 0 ? 2.18 / maxAxis : 1);
      object.rotation.set(0.17,-.54,-0.05);
      object.add(rawObject);
      rawObject.traverse(function(child){
        if (!child.isMesh || !child.material) return;
        var materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(function(material){
          if (!material) return;
          if (!material.map && material.color) material.color.lerp(new THREE.Color(0xe8673a),.18);
          if ("roughness" in material) material.roughness = Math.min(.82,Math.max(.46,material.roughness || .62));
          if ("metalness" in material) material.metalness = Math.min(.08,material.metalness || 0);
          material.needsUpdate = true;
        });
      });
      group.add(object);
      mount.classList.add("is-loaded");
    },undefined,function(){
      var fallback = q(".pf-v3-model-fallback",mount);
      if (fallback) fallback.textContent = "PF-X01 model could not load";
    });

    function resize(){
      var rect = mount.getBoundingClientRect();
      var width = Math.max(1,rect.width);
      var height = Math.max(1,rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);
    }
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(mount);
    else window.addEventListener("resize",resize,{ passive:true });
    resize();

    var start = performance.now();
    function tick(now){
      var time = (now - start) / 1000;
      var hero = q(".pf-section-hero");
      var p = 0;
      if (hero) {
        var rect = hero.getBoundingClientRect();
        p = Math.max(0,Math.min(1,-rect.top / Math.max(1,rect.height)));
      }
      if (!reduced) {
        group.rotation.y = -0.08 + Math.sin(time * .32) * .045 + p * .26;
        group.rotation.x = Math.sin(time * .25) * .024 - p * .045;
        group.rotation.z = Math.sin(time * .22) * .018 + p * .06;
        group.position.y = Math.sin(time * .58) * .026 - p * .035;
        group.position.x = p * .055;
        camera.position.z = 3.85 - p * .22;
        camera.lookAt(0,0,0);
      }
      renderer.render(scene,camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initPillowLab(){
    if (!window.WebGLRenderingContext || q(".pf-pillow-lab")) return;

    var hero = q(".pf-section-hero");
    var lab = document.createElement("section");
    lab.className = "pf-section pf-pillow-lab";
    lab.id = "pillow-lab";
    lab.innerHTML = [
      '<div class="pf-wrap pf-pillow-lab-wrap">',
        '<div class="pf-pillow-lab-copy">',
          '<p class="pf-eyebrow">Interactive prototype</p>',
          '<h2>Try the floating pillow.</h2>',
          '<p>Drag the object to inspect the PF-X01 form in 3D. This is a temporary test section for rotation, lighting, and product presence.</p>',
          '<div class="pf-pillow-lab-specs" aria-label="Interaction notes">',
            '<span>FBX source</span>',
            '<span>Drag to rotate</span>',
            '<span>Scroll-safe</span>',
          '</div>',
        '</div>',
        '<div class="pf-pillow-lab-stage" role="application" tabindex="0" aria-label="Interactive 3D pillow viewer. Drag left or right to rotate the pillow within a limited range.">',
          '<div class="pf-pillow-lab-loader">Loading interactive pillow</div>',
        '</div>',
      '</div>'
    ].join("");
    if (hero && hero.parentNode) hero.parentNode.insertBefore(lab,hero.nextSibling);

    var mount = q(".pf-pillow-lab-stage",lab);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32,1,.01,100);
    camera.position.set(0.18,0.04,4.15);

    var renderer = new THREE.WebGLRenderer({
      alpha:true,
      antialias:true,
      powerPreference:"high-performance"
    });
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.55));
    mount.appendChild(renderer.domElement);

    var controls = new OrbitControls(camera,renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .1;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minDistance = 2.35;
    controls.maxDistance = 4.6;
    controls.rotateSpeed = .28;
    controls.zoomSpeed = .32;
    controls.autoRotate = false;
    controls.minAzimuthAngle = THREE.MathUtils.degToRad(-25);
    controls.maxAzimuthAngle = THREE.MathUtils.degToRad(25);
    controls.minPolarAngle = Math.PI / 2 - THREE.MathUtils.degToRad(8);
    controls.maxPolarAngle = Math.PI / 2 + THREE.MathUtils.degToRad(10);
    controls.target.set(0,0,0);
    var userInteracting = false;
    controls.addEventListener("start",function(){ userInteracting = true; });
    controls.addEventListener("end",function(){ userInteracting = false; });

    scene.add(new THREE.HemisphereLight(0xffffff,0xf1d5c4,1.8));
    var key = new THREE.DirectionalLight(0xffffff,3.8);
    key.position.set(3.2,3.6,4);
    scene.add(key);
    var warm = new THREE.DirectionalLight(0xff9a63,1.45);
    warm.position.set(-2.6,.8,2.1);
    scene.add(warm);
    var rim = new THREE.DirectionalLight(0xffffff,2.2);
    rim.position.set(-3.2,2.8,-3.2);
    scene.add(rim);

    var pedestal = new THREE.Mesh(
      new THREE.CircleGeometry(1.15,96),
      new THREE.MeshBasicMaterial({ color:0xe8673a, transparent:true, opacity:.09, depthWrite:false })
    );
    pedestal.rotation.x = -Math.PI / 2;
    pedestal.position.y = -.72;
    scene.add(pedestal);

    var group = new THREE.Group();
    scene.add(group);

    function loadPillow(){
      if (mount.classList.contains("is-loading") || mount.classList.contains("is-loaded")) return;
      mount.classList.add("is-loading");
      new FBXLoader().load("/assets/models/Pillow_Clean_Front.fbx",function(fbx){
      var box = new THREE.Box3().setFromObject(fbx);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      var maxAxis = Math.max(size.x,size.y,size.z);
      fbx.position.set(-center.x,-center.y,-center.z);
      var pivot = new THREE.Group();
      pivot.scale.setScalar(maxAxis > 0 ? 1.45 / maxAxis : 1);
      pivot.rotation.set(-.1,-.48,.06);
      pivot.add(fbx);
      fbx.traverse(function(child){
        if (!child.isMesh || !child.material) return;
        child.castShadow = false;
        child.receiveShadow = false;
        var materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(function(material){
          if (!material) return;
          if (material.color) material.color.lerp(new THREE.Color(0xe8673a),.18);
          if ("roughness" in material) material.roughness = .58;
          if ("metalness" in material) material.metalness = 0;
          material.needsUpdate = true;
        });
      });
      group.add(pivot);
      mount.classList.add("is-loaded");
      var loader = q(".pf-pillow-lab-loader",mount);
      if (loader) loader.remove();
    },undefined,function(){
      var loader = q(".pf-pillow-lab-loader",mount);
      if (loader) loader.textContent = "Pillow FBX could not load";
    });
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function(entries){
        if (!entries.some(function(entry){ return entry.isIntersecting; })) return;
        observer.disconnect();
        loadPillow();
      },{ rootMargin:"0px 0px -12% 0px" });
      observer.observe(lab);
    } else {
      loadPillow();
    }

    function resize(){
      var rect = mount.getBoundingClientRect();
      var width = Math.max(1,rect.width);
      var height = Math.max(1,rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);
    }
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(mount);
    else window.addEventListener("resize",resize,{ passive:true });
    resize();

    var start = performance.now();
    function tick(now){
      var time = (now - start) / 1000;
      if (!reduced) {
        group.position.y = Math.sin(time * .72) * .034;
        if (!userInteracting) {
          group.rotation.y = Math.sin(time * .36) * .035;
          group.rotation.z = Math.sin(time * .34) * .018;
        }
      }
      controls.update();
      renderer.render(scene,camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    if (hasGSAP && !reduced) {
      window.gsap.from(lab.querySelectorAll(".pf-pillow-lab-copy > *, .pf-pillow-lab-stage"),{
        scrollTrigger:{ trigger:lab, start:"top 70%", once:true },
        y:42,
        opacity:0,
        duration:1,
        stagger:.08,
        ease:"power3.out"
      });
    }
  }

  function initGSAP(){
    if (!hasGSAP) return;
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    var header = q(".pf-site-header");
    var hero = q(".pf-section-hero");

    gsap.set("body",{ opacity:1 });
    if (reduced) {
      gsap.set(".pf-site-header",{ y:0, opacity:1, filter:"none" });
      gsap.set([".pf-hero-copy .pf-eyebrow",".pf-hero-copy h1",".pf-hero-subcopy",".pf-hero-actions",".pf-hero-stats",".pf-hero-product"],{
        y:0,
        opacity:1,
        filter:"none",
        clipPath:"none"
      });
      gsap.set(".pf-v3-scroll-cue",{ display:"none" });
      return;
    }

    gsap.set(".pf-site-header",{ y:-18, opacity:0 });
    gsap.set([".pf-hero-copy .pf-eyebrow",".pf-hero-copy h1",".pf-hero-subcopy",".pf-hero-actions",".pf-hero-stats",".pf-hero-product"],{
      y:42,
      opacity:0,
      filter:"blur(6px)"
    });
    gsap.set(".pf-hero-copy h1",{ clipPath:"inset(0% 0% 100% 0%)" });
    gsap.set(".pf-v3-scroll-cue",{ opacity:0, y:12 });

    var intro = gsap.timeline({ defaults:{ ease:"power3.out" } });
    intro
      .to(".pf-site-header",{ y:0, opacity:1, duration:.8 },.08)
      .to(".pf-hero-copy .pf-eyebrow",{ y:0, opacity:1, filter:"blur(0px)", duration:.8 },.16)
      .to(".pf-hero-copy h1",{ y:0, opacity:1, filter:"blur(0px)", duration:1.1, clipPath:"inset(0% 0% 0% 0%)" },.28)
      .fromTo(".pf-hero-headline-em",{ color:"#0f172a" },{ color:"#b9471e", duration:.9, ease:"power2.out" },.55)
      .to(".pf-hero-subcopy",{ y:0, opacity:1, filter:"blur(0px)", duration:.9 },.48)
      .to(".pf-hero-actions",{ y:0, opacity:1, filter:"blur(0px)", duration:.85 },.62)
      .to(".pf-hero-product",{ y:0, opacity:1, filter:"blur(0px)", duration:1.15 },.42)
      .to(".pf-hero-stats",{ y:0, opacity:1, filter:"blur(0px)", duration:.9 },.74)
      .to(".pf-v3-scroll-cue",{ opacity:1, y:0, duration:.55 },.95);

    if (!reduced) {
      gsap.to(".pf-v3-scroll-cue i",{
        yPercent:150,
        repeat:-1,
        duration:1.35,
        ease:"power2.inOut"
      });
    }

    if (reduced || !hero) return;

    if (header) {
      gsap.timeline({
        scrollTrigger:{
          trigger:hero,
          start:"top top",
          end:"+=640",
          scrub:.7
        }
      })
        .to(header,{ y:-14, opacity:.72, scale:.985, duration:.25, ease:"none" },0)
        .to(header,{ y:-74, opacity:0, scale:.96, filter:"blur(1.5px)", duration:.75, ease:"none" },.25);
    }

    gsap.timeline({
      scrollTrigger:{
        trigger:hero,
        start:"top top",
        end:"bottom top",
        scrub:1.1
      }
    })
      .to(".pf-hero-copy",{ y:-48, opacity:.72, duration:.55, ease:"none" },0)
      .to(".pf-hero-stats",{ y:-24, opacity:.2, duration:.45, ease:"none" },.05)
      .to(".pf-hero-product",{ y:-34, x:-18, scale:.975, duration:1, ease:"none" },0)
      .to(".pf-v3-scroll-cue",{ opacity:0, y:-14, duration:.24, ease:"none" },.05);

    qa(".pf-section:not(.pf-section-hero)").forEach(function(section){
      var items = qa("h2, .pf-eyebrow, p, li, article, svg, form, table",section).slice(0,12);
      if (!items.length) return;
      gsap.fromTo(items,{
        y:34,
        opacity:0,
        filter:"blur(5px)"
      },{
        scrollTrigger:{
          trigger:section,
          start:"top 72%",
          once:true
        },
        y:0,
        opacity:1,
        filter:"blur(0px)",
        duration:.9,
        stagger:.045,
        ease:"power3.out"
      });
    });

    ScrollTrigger.batch(".pf-stat-card, .pf-loss-source, .pf-scale-rows li, .pf-company-principles li, .pf-scope-col, .pf-pilot-fieldset, .pf-pillow-lab-specs span",{
      start:"top 86%",
      once:true,
      onEnter:function(batch){
        gsap.fromTo(batch,{ y:24, opacity:0 },{ y:0, opacity:1, duration:.72, stagger:.055, ease:"power3.out" });
      }
    });
  }

  function init(){
    document.documentElement.classList.add("pf-v3");
    addScrollCue();
    initRoadScene();
    initModel();
    initPillowLab();
    runLoader(function(){
      initGSAP();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{ once:true });
  else init();
})();
