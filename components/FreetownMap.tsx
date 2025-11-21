import React, { useEffect, useRef } from 'react';  
import * as THREE from 'three';  

interface FreetownMapProps {  
    showParticles: boolean;  
    isThinking?: boolean;  
}  

export const FreetownMap: React.FC<FreetownMapProps> = ({ showParticles, isThinking = false }) => {  
  const mountRef = useRef<HTMLDivElement>(null);  
  const showHint = true;   
    
  const targetOpacityRef = useRef(0.9);  
  const targetSpeedMultRef = useRef(1.0);  
  const isThinkingRef = useRef(isThinking);  

  useEffect(() => {  
      if (showParticles) {  
          targetOpacityRef.current = 0.9;  
          targetSpeedMultRef.current = 1.0;  
      } else {  
          targetOpacityRef.current = 0.0;  
          targetSpeedMultRef.current = 0.0;  
      }  
  }, [showParticles]);  

  useEffect(() => {  
      isThinkingRef.current = isThinking;  
  }, [isThinking]);  

  useEffect(() => {  
    if (!mountRef.current) return;  

    const scene = new THREE.Scene();  
    const BG_COLOR = 0x081224;   
    scene.background = new THREE.Color(BG_COLOR);  
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.0015);  

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);  
    camera.position.set(0, -55, 40);   
    camera.up.set(0, 0, 1);   
    camera.lookAt(0, 5, 0);  

    const renderer = new THREE.WebGLRenderer({   
      antialias: true,   
      alpha: false,  
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);  
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  
    mountRef.current.appendChild(renderer.domElement);  

    // Apply fixed positioning to the canvas to isolate it from layout
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '-1'; // Behind everything
    renderer.domElement.style.pointerEvents = 'none'; // Don't block clicks

    const worldGroup = new THREE.Group();  
    scene.add(worldGroup);  

    const C_NEON_BLUE = 0x00FFFF;     
    const C_DEEP_BLUE = 0x0066FF;     
    const C_WHITE_BLUE = 0xF0FFFF;    
    const C_PULSE_HOT = 0xAAFFFF;  

    const isLand = (x: number, y: number) => {  
      const northernCoastY = 18 - (x * x) / 120;   
      if (y > northernCoastY) return false;  
      if (x < -35) return false;  
      if (x > 40) return false;  
      if (y < -30) return false;  
      return true;  
    };  

    const getElevation = (x: number, y: number) => {  
       if (!isLand(x, y)) return -10;  
       const spineY = -10 + (x * 0.1);  
       const distFromSpine = Math.abs(y - spineY);  
       let elevation = 32 * Math.exp(-Math.pow(distFromSpine * 0.07, 2));  
       if (y > 0) {  
           elevation *= 0.4;   
           elevation += Math.random() * 0.5;  
       }  
       const gullyNoise = Math.sin(x * 0.5) * Math.cos(y * 0.2);  
       elevation += gullyNoise * 2;  
       if (elevation < 0) elevation = 0;  
       return elevation;  
    };  

    const gridHelper = new THREE.GridHelper(200, 50, C_DEEP_BLUE, 0x001a33);  
    gridHelper.rotation.x = Math.PI / 2;  
    gridHelper.position.z = -2;  
    worldGroup.add(gridHelper);  

    const terrainGeo = new THREE.BufferGeometry();  
    const terrainPoints: number[] = [];  
    for (let y = -35; y < 25; y += 1.0) {  
        for (let x = -40; x < 40; x += 1.0) {  
            if ((x*x)/1600 + (y*y)/900 > 1.2) continue;   
            if (isLand(x, y)) {  
                terrainPoints.push(x, y, getElevation(x, y));  
            }  
        }  
    }  
    terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(terrainPoints, 3));  
    const terrainMat = new THREE.PointsMaterial({  
        color: C_DEEP_BLUE,  
        size: 0.35,   
        transparent: true,  
        opacity: 0.8,  
        blending: THREE.AdditiveBlending  
    });  
    const terrainMesh = new THREE.Points(terrainGeo, terrainMat);  
    worldGroup.add(terrainMesh);  

    const roadsPos: number[] = [];  
    for (let x = -30; x < 30; x += 0.5) {  
        const y = 12 - (x*x)/150;  
        if (isLand(x, y)) {  
            const z = getElevation(x, y) + 0.2;  
            roadsPos.push(x, y, z, x+0.5, 12 - ((x+0.5)*(x+0.5))/150, getElevation(x+0.5, 12 - ((x+0.5)*(x+0.5))/150)+0.2);  
        }  
    }  
    for (let y = 0; y > -20; y -= 0.5) {  
        const x = Math.sin(y * 0.5) * 5;  
        if (isLand(x, y)) {  
             const z = getElevation(x, y) + 0.2;  
             const nextY = y - 0.5;  
             const nextX = Math.sin(nextY * 0.5) * 5;  
             roadsPos.push(x, y, z, nextX, nextY, getElevation(nextX, nextY)+0.2);  
        }  
    }  
    const roadsGeo = new THREE.BufferGeometry();  
    roadsGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadsPos, 3));  
    const roadsMat = new THREE.LineBasicMaterial({  
        color: C_NEON_BLUE,  
        transparent: true,  
        opacity: 0.3,  
        linewidth: 2,  
        blending: THREE.AdditiveBlending  
    });  
    const roadsMesh = new THREE.LineSegments(roadsGeo, roadsMat);  
    worldGroup.add(roadsMesh);  

    const buildingsPos: number[] = [];  
    const addBox = (x: number, y: number, zBase: number, height: number, width: number) => {  
        const hw = width / 2; const zTop = zBase + height;  
        buildingsPos.push(x-hw, y-hw, zTop, x+hw, y-hw, zTop, x+hw, y-hw, zTop, x+hw, y+hw, zTop, x+hw, y+hw, zTop, x-hw, y+hw, zTop, x-hw, y+hw, zTop, x-hw, y-hw, zTop);  
        buildingsPos.push(x-hw, y-hw, zBase, x-hw, y-hw, zTop, x+hw, y-hw, zBase, x+hw, y-hw, zTop, x+hw, y+hw, zBase, x+hw, y+hw, zTop, x-hw, y+hw, zBase, x-hw, y+hw, zTop);  
    };  
      
    for(let x = -35; x < 35; x += 1.1) {  
        for(let y = -25; y < 18; y += 1.1) {  
             if ((x*x)/1400 + (y*y)/800 > 1.0) continue;  
             if (isLand(x, y)) {  
                 const z = getElevation(x, y);  
                 if (y > 5 && Math.random() > 0.2) addBox(x, y, z, Math.random() * 0.5 + 0.3, Math.random() * 0.6 + 0.5);  
                 else if (z > 5 && z < 20 && Math.random() > 0.5) addBox(x, y, z, Math.random() * 0.8 + 0.5, 1.0);  
             }  
        }  
    }  
    const buildingsGeo = new THREE.BufferGeometry();  
    buildingsGeo.setAttribute('position', new THREE.Float32BufferAttribute(buildingsPos, 3));  
    const buildingsMat = new THREE.LineBasicMaterial({  
        color: C_NEON_BLUE,  
        transparent: true,  
        opacity: 0.85,   
        blending: THREE.AdditiveBlending  
    });  
    const cityMesh = new THREE.LineSegments(buildingsGeo, buildingsMat);  
    worldGroup.add(cityMesh);  

    const pGeo = new THREE.BufferGeometry();  
    const pCount = 450;  
    const pPos = new Float32Array(pCount * 3);  
    const pSpeeds = new Float32Array(pCount);  
      
    for(let i=0; i<pCount; i++) {  
        pPos[i*3] = (Math.random() - 0.5) * 90;   
        pPos[i*3+1] = (Math.random() - 0.5) * 70;    
        pPos[i*3+2] = Math.random() * 30 + 5;       
        pSpeeds[i] = Math.random() * 0.1 + 0.02;  
    }  
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));  
      
    const pMat = new THREE.PointsMaterial({  
        color: C_WHITE_BLUE,  
        size: 0.7,   
        transparent: true,  
        blending: THREE.AdditiveBlending,  
        opacity: 0.9,   
        depthWrite: false   
    });  
    const particles = new THREE.Points(pGeo, pMat);  
    worldGroup.add(particles);  

    let isDragging = false;  
    let previousMousePosition = { x: 0, y: 0 };  
    let rotationZ = 0;  
    let rotationX = 0.3;   

    const onMouseDown = (event: MouseEvent) => {  
        if (event.button === 2) {   
            isDragging = true;  
            previousMousePosition = { x: event.clientX, y: event.clientY };  
            document.body.style.cursor = 'grabbing';  
        }  
    };  
    const onMouseUp = () => { isDragging = false; document.body.style.cursor = 'default'; };  
    const onMouseMove = (event: MouseEvent) => {  
        if (isDragging) {  
            const deltaX = event.clientX - previousMousePosition.x;  
            const deltaY = event.clientY - previousMousePosition.y;  
            rotationZ -= deltaX * 0.005;  
            rotationX -= deltaY * 0.002;  
            rotationX = Math.max(-0.2, Math.min(0.6, rotationX));  
            worldGroup.rotation.z = rotationZ;  
            worldGroup.rotation.x = rotationX;  
            previousMousePosition = { x: event.clientX, y: event.clientY };  
        }  
    };  

    window.addEventListener('mousedown', onMouseDown);  
    window.addEventListener('mouseup', onMouseUp);  
    window.addEventListener('mousemove', onMouseMove);  
    window.addEventListener('contextmenu', (e) => e.preventDefault());  

    let currentSpeedMult = 1.0;  

    let reqId: number;  
    const animate = () => {  
        reqId = requestAnimationFrame(animate);  
        const now = Date.now();  

        if (!isDragging) worldGroup.rotation.z += 0.0008;   

        const fadeSpeed = 0.05;  
        pMat.opacity += (targetOpacityRef.current - pMat.opacity) * fadeSpeed;  
        currentSpeedMult += (targetSpeedMultRef.current - currentSpeedMult) * fadeSpeed;  

        const posAttr = particles.geometry.attributes.position;  
        const arr = posAttr.array as Float32Array;  
        for(let i=0; i<pCount; i++) {  
            arr[i*3+2] += pSpeeds[i] * currentSpeedMult;  
            if (arr[i*3+2] > 40) arr[i*3+2] = 5;  
        }  
        posAttr.needsUpdate = true;  

        if (isThinkingRef.current) {  
            const pulse = (Math.sin(now * 0.004) + 1) * 0.5;   
            buildingsMat.opacity = 0.6 + (pulse * 0.4);  
            roadsMat.opacity = 0.3 + (pulse * 0.5);  
            terrainMat.opacity = 0.7 + (pulse * 0.3);  
              
            const targetColor = new THREE.Color(C_NEON_BLUE).lerp(new THREE.Color(C_PULSE_HOT), pulse);  
            buildingsMat.color.copy(targetColor);  
            roadsMat.color.copy(targetColor);  
        } else {  
            roadsMat.opacity += (0.3 - roadsMat.opacity) * 0.05;  
            buildingsMat.opacity += (0.85 - buildingsMat.opacity) * 0.05;  
            terrainMat.opacity += (0.8 - terrainMat.opacity) * 0.05;  
            buildingsMat.color.lerp(new THREE.Color(C_NEON_BLUE), 0.05);  
            roadsMat.color.lerp(new THREE.Color(C_NEON_BLUE), 0.05);  
        }  

        renderer.render(scene, camera);  
    };  

    animate();  

    worldGroup.rotation.x = 0.3;  

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
        roadsGeo.dispose();  
        pGeo.dispose();  
    };  
  }, []);  

  return (  
    <div   
      ref={mountRef}   
      className="absolute inset-0 z-0 pointer-events-none"
    />  
  );  
};