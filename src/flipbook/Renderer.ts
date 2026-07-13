import * as THREE from "three";

export function createRenderer() {

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    // Transparent background
    renderer.setClearColor(0x000000, 0);

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    return renderer;
}