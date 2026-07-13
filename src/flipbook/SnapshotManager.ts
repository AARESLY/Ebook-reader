import * as THREE from "three";

export default class SnapshotManager {

    private canvas: HTMLCanvasElement;

    private context: CanvasRenderingContext2D;

    constructor() {

        this.canvas = document.createElement("canvas");

        this.canvas.width = 2048;

        this.canvas.height = 2048;

        const ctx = this.canvas.getContext("2d");

        if (!ctx)
            throw new Error("Cannot create canvas.");

        this.context = ctx;

    }

    public clear() {

        this.context.clearRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );

    }

    public drawImage(
        image: CanvasImageSource
    ) {

        this.clear();

        this.context.drawImage(

            image,

            0,

            0,

            this.canvas.width,

            this.canvas.height

        );

    }

    public getTexture() {

        const texture =
            new THREE.CanvasTexture(
                this.canvas
            );

        texture.colorSpace =
            THREE.SRGBColorSpace;

        texture.needsUpdate = true;

        return texture;

    }

}