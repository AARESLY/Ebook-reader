import * as THREE from "three";

export default class PageMesh {

    public mesh: THREE.Mesh;

    public geometry: THREE.PlaneGeometry;

    public material: THREE.MeshStandardMaterial;

    constructor() {

        this.geometry = new THREE.PlaneGeometry(
            2,
            2.8,
            120,
            180
        );

        this.material = new THREE.MeshStandardMaterial({

            color: 0xffffff,

            roughness: 0.92,

            metalness: 0,

            side: THREE.DoubleSide

        });

        this.mesh = new THREE.Mesh(
            this.geometry,
            this.material
        );

        this.mesh.castShadow = true;

        this.mesh.receiveShadow = true;

    }

    public setTexture(texture: THREE.Texture) {

        this.material.map = texture;

        this.material.needsUpdate = true;

    }

    public clearTexture() {

        this.material.map = null;

        this.material.needsUpdate = true;

    }

    public setOpacity(opacity: number) {

        this.material.transparent = opacity < 1;

        this.material.opacity = opacity;

    }

    public setVisible(value: boolean) {

        this.mesh.visible = value;

    }

    public dispose() {

        this.geometry.dispose();

        this.material.dispose();

    }

}