import * as THREE from "three";

export function createCamera(
    width: number,
    height: number
) {

    const camera =
        new THREE.PerspectiveCamera(

            35,

            width / height,

            0.1,

            100

        );

    camera.position.set(

        0,

        0.2,

        6

    );

    camera.lookAt(0,0,0);

    return camera;

}