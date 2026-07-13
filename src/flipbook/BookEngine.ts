import * as THREE from "three";
import BookScene from "./BookScene";
import SnapshotManager from "./SnapshotManager";
import PageProvider, { type PageSnapshot } from "./PageProvider";

export default class BookEngine {

    private scene: BookScene;
    private snapshot = new SnapshotManager();
    private provider = new PageProvider();

    public setCurrentPage(snapshot: PageSnapshot) {
    this.provider.setCurrent(snapshot);
    this.updateRightPage(snapshot.canvas);
    }

    public refreshPages() {
    const current = this.provider.getCurrent();
    if (current) {
        this.updateRightPage(current.canvas);
    }
    }

    public updateRightPage(
    image: CanvasImageSource
    ) {

    this.snapshot.drawImage(
        image
    );

    this.scene
        .getRightPage()
        .setTexture(
            this.snapshot.getTexture()
        );

    }

    constructor(container: HTMLDivElement) {
        this.scene = new BookScene(container);
    }

    public resize() {
        this.scene.resize();
    }

    public render() {
        this.scene.renderOnce();
    }

    public getRenderer(): THREE.WebGLRenderer {
        return this.scene.getRenderer();
    }

    public getLeftPage(): THREE.Mesh {
        return this.scene.getLeftPage();
    }

    public getRightPage(): THREE.Mesh {
        return this.scene.getRightPage();
    }

    public destroy() {
        this.scene.destroy();
    }
}