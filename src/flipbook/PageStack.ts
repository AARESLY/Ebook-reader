import * as THREE from "three";

export default class PageStack {

    public mesh: THREE.Mesh;

    constructor() {

        const geometry = new THREE.BoxGeometry(
            4.05,
            2.82,
            0.12
        );

        const material = new THREE.MeshStandardMaterial({

            color: 0xf5f5f0,

            roughness: 1

        });

        this.mesh = new THREE.Mesh(
            geometry,
            material
        );

        this.mesh.position.z = -0.06;

        this.mesh.castShadow = true;

        this.mesh.receiveShadow = true;

    }

}