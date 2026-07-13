import * as THREE from "three";

export function addLights(scene: THREE.Scene) {

    scene.add(

        new THREE.AmbientLight(
            0xffffff,
            1.1
        )

    );

    const key =
        new THREE.DirectionalLight(
            0xffffff,
            2.2
        );

    key.position.set(
        3,
        5,
        4
    );

    key.castShadow = true;

    scene.add(key);

    const fill =
        new THREE.DirectionalLight(
            0xffffff,
            0.7
        );

    fill.position.set(
        -3,
        2,
        -4
    );

    scene.add(fill);

}