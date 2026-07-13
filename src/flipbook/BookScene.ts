import * as THREE from "three";

import { createCamera } from "./Camera";
import { createRenderer } from "./Renderer";
import { addLights } from "./Lights";
import PageMesh from "./PageMesh";
import BookSpine from "./BookSpine";
import PageStack from "./PageStack";

export default class BookScene {

    public scene: THREE.Scene;

    public renderer: THREE.WebGLRenderer;

    public camera: THREE.PerspectiveCamera;

    public leftPage: PageMesh;

    public rightPage: PageMesh;

    public spine: BookSpine;

    public pages: PageStack;

    private animationId = 0;

    constructor(
        private container: HTMLDivElement
    ) {

        this.scene = new THREE.Scene();

        this.scene.background = null;

        this.camera = createCamera(
            container.clientWidth,
            container.clientHeight
        );

        this.renderer = createRenderer();

        this.renderer.setSize(
            container.clientWidth,
            container.clientHeight
        );

        container.appendChild(
            this.renderer.domElement
        );

        addLights(this.scene);

    this.pages = new PageStack();

    this.scene.add(this.pages.mesh);

    this.spine = new BookSpine();

    this.scene.add(this.spine.mesh);

        this.leftPage = new PageMesh();

        this.leftPage.mesh.position.set(
           -1.05,
            0,
            0
        );

        this.scene.add(
            this.leftPage.mesh
        );

        this.rightPage = new PageMesh();

        this.rightPage.mesh.position.set(
            1.05,
            0,
            0
        );

        this.scene.add(
            this.rightPage.mesh
        );

        this.animate();

    }

    private animate = () => {

        this.animationId =
            requestAnimationFrame(
                this.animate
            );

        this.renderer.render(
            this.scene,
            this.camera
        );

    };

    public renderOnce() {

        this.renderer.render(
            this.scene,
            this.camera
        );

    }

    public resize() {

        const w =
            this.container.clientWidth;

        const h =
            this.container.clientHeight;

        this.camera.aspect =
            w / h;

        this.camera.updateProjectionMatrix();

        this.renderer.setSize(
            w,
            h
        );

    }

    public getRenderer() {

        return this.renderer;

    }

    public getLeftPage() {

        return this.leftPage;

    }

    public getRightPage() {

        return this.rightPage;

    }

    public destroy() {

        cancelAnimationFrame(
            this.animationId
        );

        this.leftPage.dispose();

        this.rightPage.dispose();

        this.renderer.dispose();

    }

}