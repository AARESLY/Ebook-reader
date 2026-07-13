import * as THREE from "three";

export default class TextureCache {

    private cache =
        new Map<number, THREE.Texture>();

    get(page: number) {

        return this.cache.get(page);

    }

    set(page: number, texture: THREE.Texture) {

        this.cache.set(page, texture);

    }

    clear() {

        this.cache.forEach(t => t.dispose());

        this.cache.clear();

    }

}