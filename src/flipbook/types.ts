import * as THREE from "three";

/* ----------------------------------------------------------
 * Basic Directions
 * ---------------------------------------------------------- */

export type FlipDirection = "next" | "previous";

export type FlipCorner =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";

/* ----------------------------------------------------------
 * Page Snapshot
 * ---------------------------------------------------------- */

export interface PageSnapshot {

    pageNumber: number;

    cfi: string;

    canvas: HTMLCanvasElement;

    width: number;

    height: number;

    timestamp: number;

}

/* ----------------------------------------------------------
 * Page Metadata
 * ---------------------------------------------------------- */

export interface PageMetadata {

    pageNumber: number;

    cfi: string;

    chapter?: string;

    title?: string;

}

/* ----------------------------------------------------------
 * Runtime Page
 * ---------------------------------------------------------- */

export interface RuntimePage {

    metadata: PageMetadata;

    snapshot: PageSnapshot | null;

    texture: THREE.Texture | null;

    dirty: boolean;

}

/* ----------------------------------------------------------
 * Spread
 * ---------------------------------------------------------- */

export interface BookSpread {

    left: RuntimePage | null;

    right: RuntimePage | null;

}

/* ----------------------------------------------------------
 * Pointer
 * ---------------------------------------------------------- */

export interface PointerInfo {

    x: number;

    y: number;

    previousX: number;

    previousY: number;

    deltaX: number;

    deltaY: number;

    velocityX: number;

    velocityY: number;

    pressure: number;

    active: boolean;

}

/* ----------------------------------------------------------
 * Curl Geometry
 * ---------------------------------------------------------- */

export interface CurlState {

    progress: number;

    angle: number;

    radius: number;

    origin: THREE.Vector3;

    direction: FlipDirection;

    corner: FlipCorner;

}

/* ----------------------------------------------------------
 * Physics
 * ---------------------------------------------------------- */

export interface PhysicsConfig {

    stiffness: number;

    damping: number;

    mass: number;

    maxVelocity: number;

}

/* ----------------------------------------------------------
 * Animation
 * ---------------------------------------------------------- */

export interface AnimationConfig {

    duration: number;

    easing: string;

}

/* ----------------------------------------------------------
 * Controller State
 * ---------------------------------------------------------- */

export enum FlipStage {

    Idle,

    Pressed,

    Dragging,

    Settling,

    Animating,

    Finished,

    Cancelled

}

/* ----------------------------------------------------------
 * Events
 * ---------------------------------------------------------- */

export interface FlipEvents {

    onStart?(): void;

    onUpdate?(progress: number): void;

    onFinish?(): void;

    onCancel?(): void;

}

/* ----------------------------------------------------------
 * Book Options
 * ---------------------------------------------------------- */

export interface BookOptions {

    width: number;

    height: number;

    pageWidth: number;

    pageHeight: number;

    pageThickness: number;

    shadows: boolean;

    lighting: boolean;

    perspective: number;

}

/* ----------------------------------------------------------
 * Provider API
 * ---------------------------------------------------------- */

export interface IPageProvider {

    getCurrent(): RuntimePage | null;

    getPrevious(): RuntimePage | null;

    getNext(): RuntimePage | null;

}

/* ----------------------------------------------------------
 * Renderer API
 * ---------------------------------------------------------- */

export interface IBookRenderer {

    render(): void;

    resize(): void;

    destroy(): void;

}