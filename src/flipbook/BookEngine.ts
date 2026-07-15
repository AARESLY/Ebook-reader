import * as THREE from "three";
import BookScene from "./BookScene";
import SnapshotManager from "./SnapshotManager";
import PageProvider, { type PageSnapshot } from "./PageProvider";

export default class BookEngine {

    private scene: BookScene;
    private snapshot = new SnapshotManager();
    private provider = new PageProvider();

    constructor(container: HTMLDivElement) {
        this.scene = new BookScene(container);

        this.provider.subscribe(() => {
            this.refreshPages();
        });
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

    public getLeftPageGeometry(): THREE.PlaneGeometry {
        return this.scene.getLeftPageGeometry();
    }

    public getRightPageGeometry(): THREE.PlaneGeometry {
        return this.scene.getRightPageGeometry();
    }

    public getCurrentSnapshot(): PageSnapshot | null {
        return this.provider.getCurrent();
    }

    public getPreviousSnapshot(): PageSnapshot | null {
        return this.provider.getPrevious();
    }

    public getNextSnapshot(): PageSnapshot | null {
        return this.provider.getNext();
    }

    public setCurrentPage(snapshot: PageSnapshot) {
        this.provider.setCurrent(snapshot);
    }

    public setPreviousPage(snapshot: PageSnapshot) {
        this.provider.setPrevious(snapshot);
    }

    public setNextPage(snapshot: PageSnapshot) {
        this.provider.setNext(snapshot);
    }

    public refreshPages(): void {

        const previous = this.provider.getPrevious();
        const current = this.provider.getCurrent();

        if (previous) {
            this.updateLeftPage(previous.canvas);
        }

        if (current) {
            this.updateRightPage(current.canvas);
        }

    }

    public commitNextPage(): void {
        const next = this.provider.getNext();
        if (next) {
            this.provider.setPrevious(this.provider.getCurrent() ?? next);
            this.provider.setCurrent(next);
            this.provider.setNext(null as unknown as PageSnapshot);
            this.updateRightPage(next.canvas);
        }
    }

    public commitPreviousPage(): void {
        const previous = this.provider.getPrevious();
        if (previous) {
            this.provider.setNext(this.provider.getCurrent() ?? previous);
            this.provider.setCurrent(previous);
            this.provider.setPrevious(null as unknown as PageSnapshot);
            this.updateRightPage(previous.canvas);
        }
    }

    public updateRightPage(image: CanvasImageSource) {
        this.snapshot.drawImage(image);
        this.scene.getRightPage().setTexture(this.snapshot.getTexture());
    }

    public updateLeftPage(image: CanvasImageSource) {
        this.snapshot.drawImage(image);
        this.scene.getLeftPage().setTexture(this.snapshot.getTexture());
    }

    public destroy() {
        this.scene.destroy();
    }
}
