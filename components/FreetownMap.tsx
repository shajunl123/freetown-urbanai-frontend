import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const FreetownMap: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    // Brighter Midnight Blue background to lift the overall page brightness
    const BG_COLOR = 0x081224; 
    scene.background = new THREE.Color(BG_COLOR);
    // Reduced fog density to let the neon shine through clearer
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.0015);

    // --- CAMERA ---
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    // Adjusted position to frame the smaller, denser model perfectly (Keep exact position as requested)
    camera.position.set(0, -50, 45); 
    camera.up.set(0, 0, 1); // Z-up
    camera.lookAt(0, 0, 0);

    // --- RENDERER ---
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // --- WORLD GROUP ---
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // --- COLORS (NEON BLUE PALETTE - BOOSTED) ---
    const C_NEON_BLUE = 0x00FFFF;   // Maximum Cyan
    const C_DEEP_BLUE = 0x0066FF;   // Brighter Mid Blue
    const C_WHITE_BLUE = 0xF0FFFF;  // Near White Highlights

    // --- GEOGRAPHY LOGIC ---
    // Mimicking Freetown Peninsula shape roughly
    const isLand = (x: number, y: number) => {
      // Ocean on the West (negative x)
      if (x < -35 && y > 0) return false; 
      // Estuary to the North (positive y) - Cut off earlier to keep on screen
      if (y > 20) return false;
      
      // Rough coastline curve
      if (x < -35 + (y/2)) return false;

      return true;
    };

    const getElevation = (x: number, y: number) => {
       if (!isLand(x, y)) return -10;

       // Mountain ridge running NW to SE (Leicester Peak area)
       const ridge = Math.exp(-Math.pow((x + y * 0.5) * 0.08, 2)) * 25;
       
       // Coastal flats
       let elevation = Math.max(0, ridge - 4);
       
       // Add noise for hilliness
       elevation += Math.sin(x * 0.3) * 1.5 + Math.cos(y * 0.3) * 1.5;
       
       if (elevation < 0) elevation = 0;
       return elevation;
    };

    // ==========================================
    // 1. GROUND GRID (Restricted Size)
    // ==========================================
    // Brighter grid colors
    const gridHelper = new THREE.GridHelper(200, 50, C_DEEP_BLUE, 0x001a33);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -2;
    // Hide grid edges with fog, but strictly render it
    worldGroup.add(gridHelper);

    // ==========================================
    // 2. TERRAIN DOTS (Topography)
    // ==========================================
    const terrainGeo = new THREE.BufferGeometry();
    const terrainPoints: number[] = [];
    
    // Reduced bounds for generation: -35 to 35
    for (let y = -35; y < 25; y += 1.2) {
        for (let x = -45; x < 45; x += 1.2) {
            // Radial constraint to keep rotation safe within screen
            if (x*x + y*y > 1200) continue; 

            if (isLand(x, y)) {
                const z = getElevation(x, y);
                terrainPoints.push(x, y, z);
            }
        }
    }
    terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(terrainPoints, 3));
    const terrainMat = new THREE.PointsMaterial({
        color: C_DEEP_BLUE,
        size: 0.45, // Slightly larger dots
        transparent: true,
        opacity: 0.8, // Higher opacity for glow
        blending: THREE.AdditiveBlending // Ensure additive blending is explicit
    });
    const terrainMesh = new THREE.Points(terrainGeo, terrainMat);
    worldGroup.add(terrainMesh);

    // ==========================================
    // 3. INFORMAL SETTLEMENTS (Varied Shapes)
    // ==========================================
    const buildingsPos: number[] = [];
    
    // --- SHAPE GENERATORS ---
    
    // 1. Standard Flat Roof Box
    const addBox = (x: number, y: number, zBase: number, height: number, width: number) => {
        const hw = width / 2;
        const zTop = zBase + height;

        // Top rect (Roof)
        buildingsPos.push(x-hw, y-hw, zTop, x+hw, y-hw, zTop);
        buildingsPos.push(x+hw, y-hw, zTop, x+hw, y+hw, zTop);
        buildingsPos.push(x+hw, y+hw, zTop, x-hw, y+hw, zTop);
        buildingsPos.push(x-hw, y+hw, zTop, x-hw, y-hw, zTop);

        // Vertical pillars (Corners)
        buildingsPos.push(x-hw, y-hw, zBase, x-hw, y-hw, zTop);
        buildingsPos.push(x+hw, y-hw, zBase, x+hw, y-hw, zTop);
        buildingsPos.push(x+hw, y+hw, zBase, x+hw, y+hw, zTop);
        buildingsPos.push(x-hw, y+hw, zBase, x-hw, y+hw, zTop);
    };

    // 2. Slanted Roof Shed (Informal Settlement)
    const addSlantedShed = (x: number, y: number, zBase: number, height: number, width: number) => {
        const hw = width / 2;
        const zTopHigh = zBase + height;
        const zTopLow = zBase + height * 0.7; // Slope down

        // Roof Lines (High side to Low side)
        // Top Left (High) -> Top Right (High)
        buildingsPos.push(x-hw, y-hw, zTopHigh, x+hw, y-hw, zTopHigh);
        // Bottom Left (Low) -> Bottom Right (Low)
        buildingsPos.push(x-hw, y+hw, zTopLow, x+hw, y+hw, zTopLow);
        // Connect High to Low
        buildingsPos.push(x-hw, y-hw, zTopHigh, x-hw, y+hw, zTopLow);
        buildingsPos.push(x+hw, y-hw, zTopHigh, x+hw, y+hw, zTopLow);

        // Verticals
        buildingsPos.push(x-hw, y-hw, zBase, x-hw, y-hw, zTopHigh);
        buildingsPos.push(x+hw, y-hw, zBase, x+hw, y-hw, zTopHigh);
        buildingsPos.push(x-hw, y+hw, zBase, x-hw, y+hw, zTopLow);
        buildingsPos.push(x+hw, y+hw, zBase, x+hw, y+hw, zTopLow);
    };

    // 3. Gabled House (Peaked Roof)
    const addGabledHouse = (x: number, y: number, zBase: number, height: number, width: number) => {
        const hw = width / 2;
        const wallH = height * 0.7;
        const zWall = zBase + wallH;
        const zPeak = zBase + height;

        // Base Box (Walls)
        // Verticals
        buildingsPos.push(x-hw, y-hw, zBase, x-hw, y-hw, zWall);
        buildingsPos.push(x+hw, y-hw, zBase, x+hw, y-hw, zWall);
        buildingsPos.push(x+hw, y+hw, zBase, x+hw, y+hw, zWall);
        buildingsPos.push(x-hw, y+hw, zBase, x-hw, y+hw, zWall);
        
        // Ceiling/Roof Base Rim
        buildingsPos.push(x-hw, y-hw, zWall, x+hw, y-hw, zWall);
        buildingsPos.push(x+hw, y-hw, zWall, x+hw, y+hw, zWall);
        buildingsPos.push(x+hw, y+hw, zWall, x-hw, y+hw, zWall);
        buildingsPos.push(x-hw, y+hw, zWall, x-hw, y-hw, zWall);

        // Ridge Line (along X axis in middle)
        buildingsPos.push(x-hw, y, zPeak, x+hw, y, zPeak);

        // Connect corners to ridge
        buildingsPos.push(x-hw, y-hw, zWall, x-hw, y, zPeak);
        buildingsPos.push(x-hw, y+hw, zWall, x-hw, y, zPeak);
        buildingsPos.push(x+hw, y-hw, zWall, x+hw, y, zPeak);
        buildingsPos.push(x+hw, y+hw, zWall, x+hw, y, zPeak);
    };

    // Generation Loop - High Density
    for(let x = -40; x < 40; x += 1.2) {
        for(let y = -30; y < 20; y += 1.2) {
            // Strict radial clip to ensure model stays on screen during rotation
            if (x*x + y*y > 1000) continue; 

            if (isLand(x, y)) {
                // 70% coverage (dense)
                if (Math.random() > 0.3) {
                    const z = getElevation(x, y);
                    
                    // INFORMAL SETTLEMENT LOGIC:
                    // Mostly low height (tin sheds/shanties): 0.2 to 0.8 height
                    let h = Math.random() * 0.6 + 0.2; 
                    let w = Math.random() * 0.8 + 0.4; // Varied widths

                    const typeProb = Math.random();

                    // Rare "Administrative" or larger buildings (1% chance)
                    if (typeProb > 0.99) {
                        h = Math.random() * 2 + 1.5; // 2-3 units high max
                        w = 1.2;
                        addBox(x, y, z, h, w);
                    } else {
                        // Mix of informal shapes
                        if (typeProb < 0.4) {
                            addBox(x, y, z, h, w);
                        } else if (typeProb < 0.8) {
                            addSlantedShed(x, y, z, h, w);
                        } else {
                            addGabledHouse(x, y, z, h, w);
                        }
                    }
                }
            }
        }
    }

    const buildingsGeo = new THREE.BufferGeometry();
    buildingsGeo.setAttribute('position', new THREE.Float32BufferAttribute(buildingsPos, 3));
    
    const buildingsMat = new THREE.LineBasicMaterial({
        color: C_NEON_BLUE,
        transparent: true,
        opacity: 0.85, // Harder glow (was 0.35)
        blending: THREE.AdditiveBlending
    });
    
    const cityMesh = new THREE.LineSegments(buildingsGeo, buildingsMat);
    worldGroup.add(cityMesh);

    // ==========================================
    // 4. FLOATING DATA PARTICLES (Allowed to flow out)
    // ==========================================
    const pGeo = new THREE.BufferGeometry();
    const pCount = 400;
    const pPos = new Float32Array(pCount * 3);
    const pSpeeds = new Float32Array(pCount);
    
    for(let i=0; i<pCount; i++) {
        // Allow particles to be wider than city
        pPos[i*3] = (Math.random() - 0.5) * 100; 
        pPos[i*3+1] = (Math.random() - 0.5) * 80;  
        pPos[i*3+2] = Math.random() * 30 + 5;     
        pSpeeds[i] = Math.random() * 0.1 + 0.02;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
        color: C_WHITE_BLUE,
        size: 0.7, // Slightly bigger
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.9 // Much brighter particles
    });
    const particles = new THREE.Points(pGeo, pMat);
    worldGroup.add(particles);


    // --- INTERACTION ---
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationZ = 0;
    let rotationX = 0;

    const onMouseDown = (event: MouseEvent) => {
        if (event.button === 2) { // Right click
            isDragging = true;
            previousMousePosition = { x: event.clientX, y: event.clientY };
            document.body.style.cursor = 'grabbing';
            setShowHint(false);
        }
    };

    const onMouseUp = () => {
        isDragging = false;
        document.body.style.cursor = 'default';
    };

    const onMouseMove = (event: MouseEvent) => {
        if (isDragging) {
            const deltaX = event.clientX - previousMousePosition.x;
            const deltaY = event.clientY - previousMousePosition.y;
            rotationZ -= deltaX * 0.005;
            rotationX -= deltaY * 0.002;
            // Limit tilt so we don't see underneath too much
            rotationX = Math.max(-0.2, Math.min(0.4, rotationX));
            
            worldGroup.rotation.z = rotationZ;
            worldGroup.rotation.x = rotationX;
            
            previousMousePosition = { x: event.clientX, y: event.clientY };
        }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- ANIMATION ---
    let reqId: number;
    const animate = () => {
        reqId = requestAnimationFrame(animate);

        // Auto Rotate if not dragging
        if (!isDragging) {
            worldGroup.rotation.z += 0.001; 
        }

        // Animate Particles
        const posAttr = particles.geometry.attributes.position;
        const arr = posAttr.array as Float32Array;
        for(let i=0; i<pCount; i++) {
            // Move up slowly
            arr[i*3+2] += pSpeeds[i];
            // Reset if too high
            if (arr[i*3+2] > 40) arr[i*3+2] = 5;
        }
        posAttr.needsUpdate = true;

        renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(reqId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mousemove', onMouseMove);
        
        if (mountRef.current) {
            mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
        terrainGeo.dispose();
        buildingsGeo.dispose();
    };
  }, []);

  return (
    <>
      <div 
        ref={mountRef} 
        className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none"
        style={{ background: '#081224' }} 
      />
      
      {showHint && (
        <div className="fixed bottom-6 right-6 z-0 pointer-events-none bg-black/40 backdrop-blur-md px-4 py-2 rounded border border-freetown-neonBlue/30 text-[10px] text-freetown-neonBlue shadow-[0_0_10px_rgba(0,240,255,0.1)]">
          <span className="font-bold text-white">SYSTEM NAV</span> // RIGHT CLICK + DRAG TO ROTATE
        </div>
      )}
    </>
  );
};