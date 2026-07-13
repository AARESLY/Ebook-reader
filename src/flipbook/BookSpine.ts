import * as THREE from "three";

export default class BookSpine {

    public mesh: THREE.Mesh;

    constructor() {

        const geometry = new THREE.BoxGeometry(
            0.08,
            2.82,
            0.18,
            1,
            20,
            1
        );

        const material = new THREE.MeshStandardMaterial({

            color: 0xdddddd,

            roughness: 0.9,

            metalness: 0

        });

        this.mesh = new THREE.Mesh(
            geometry,
            material
        );

        this.mesh.castShadow = true;

        this.mesh.receiveShadow = true;

    }

}