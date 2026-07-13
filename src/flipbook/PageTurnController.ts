import * as THREE from "three";
import type CurlDeformer from "./CurlDeformer";
import type BookEngine from "./BookEngine";
import type {
    FlipCorner,
    FlipDirection,
    FlipEvents,
    FlipStage,
    PointerInfo,
    CurlState,
    PhysicsConfig,
    AnimationConfig,
    PageSnapshot
} from "./types";

export interface PageTurnControllerOptions {
    engine: BookEngine;
    deformers: {
        front: CurlDeformer;
        back: CurlDeformer;
    };
    pageWidth: number;
    pageHeight: number;
    events?: FlipEvents;
    physics?: Partial<PhysicsConfig>;
    animation?: Partial<AnimationConfig>;
}

interface FlipSession {
    direction: FlipDirection;
    corner: FlipCorner;
    progress: number;
    targetProgress: number;
    state: FlipStage;
    pointer: PointerInfo;
    startTime: number;
    startSnapshot: PageSnapshot | null;
    currentSnapshot: PageSnapshot | null;
    nextSnapshot: PageSnapshot | null;
    previousSnapshot: PageSnapshot | null;
    curl: CurlState;
    rafId: number | null;
}

const DEFAULT_PHYSICS: PhysicsConfig = {
    stiffness: 0.12,
    damping: 0.82,
    mass: 1,
    maxVelocity: 2.8
};

const DEFAULT_ANIMATION: AnimationConfig = {
    duration: 0.42,
    easing: "power3.out"
};

export default class PageTurnController {
    private readonly engine: BookEngine;
    private readonly frontDeformer: CurlDeformer;
    private readonly backDeformer: CurlDeformer;
    private readonly pageWidth: number;
    private readonly pageHeight: number;
    private readonly events: FlipEvents;
    private readonly physics: PhysicsConfig;
    private readonly animation: AnimationConfig;

    private stage: FlipStage = FlipStage.Idle;
    private session: FlipSession | null = null;
    private pointer: PointerInfo = {
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        deltaX: 0,
        deltaY: 0,
        velocityX: 0,
        velocityY: 0,
        pressure: 0,
        active: false
    };

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        if (event.defaultPrevented) {
            return;
        }
        if (event.key === "ArrowRight") {
            this.next();
        } else if (event.key === "ArrowLeft") {
            this.previous();
        }
    };

    private readonly handlePointerMove = (event: PointerEvent): void => {
        if (!this.session || !this.pointer.active) {
            return;
        }
        this.updatePointer(event.clientX, event.clientY, event.pressure || 0.5);
        this.updateDragProgress(event.clientX, event.clientY);
    };

    private readonly handlePointerUp = (_event: PointerEvent): void => {
        if (!this.session || !this.pointer.active) {
            return;
        }
        this.release();
    };

    constructor(options: PageTurnControllerOptions) {
        this.engine = options.engine;
        this.frontDeformer = options.deformers.front;
        this.backDeformer = options.deformers.back;
        this.pageWidth = options.pageWidth;
        this.pageHeight = options.pageHeight;
        this.events = options.events ?? {};
        this.physics = { ...DEFAULT_PHYSICS, ...(options.physics ?? {}) };
        this.animation = { ...DEFAULT_ANIMATION, ...(options.animation ?? {}) };

        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
        window.addEventListener("pointerup", this.handlePointerUp, { passive: true });
        window.addEventListener("pointercancel", this.handlePointerUp, { passive: true });
    }

    public dispose(): void {
        this.cancelRaf();
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("pointermove", this.handlePointerMove);
        window.removeEventListener("pointerup", this.handlePointerUp);
        window.removeEventListener("pointercancel", this.handlePointerUp);
    }

    public getStage(): FlipStage {
        return this.stage;
    }

    public isFlipping(): boolean {
        return this.stage !== FlipStage.Idle && this.stage !== FlipStage.Finished && this.stage !== FlipStage.Cancelled;
    }

    public beginFlip(direction: FlipDirection, corner: FlipCorner, snapshot?: PageSnapshot | null): void {
        if (this.isFlipping()) {
            return;
        }

        const currentSnapshot = snapshot ?? this.engine.getCurrentSnapshot();
        const nextSnapshot = direction === "next" ? this.engine.getNextSnapshot() : null;
        const previousSnapshot = direction === "previous" ? this.engine.getPreviousSnapshot() : null;

        this.stage = FlipStage.Pressed;
        this.pointer.active = true;
        this.pointer.pressure = 0.5;
        this.session = {
            direction,
            corner,
            progress: 0,
            targetProgress: 0,
            state: FlipStage.Pressed,
            pointer: { ...this.pointer },
            startTime: performance.now(),
            startSnapshot: currentSnapshot,
            currentSnapshot,
            nextSnapshot,
            previousSnapshot,
            curl: {
                progress: 0,
                angle: 0,
                radius: 0.18,
                origin: new THREE.Vector3(),
                direction,
                corner
            },
            rafId: null
        };

        this.events.onStart?.();
        this.applyDeformation(0);
    }

    public next(): void {
        this.beginFlip("next", "bottom-right");
    }

    public previous(): void {
        this.beginFlip("previous", "bottom-left");
    }

    public pointerDown(x: number, y: number, pressure = 0.5): void {
        this.pointer.active = true;
        this.updatePointer(x, y, pressure);
        const direction: FlipDirection = x >= this.pageWidth / 2 ? "next" : "previous";
        const corner: FlipCorner = y >= this.pageHeight / 2
            ? (direction === "next" ? "top-right" : "top-left")
            : (direction === "next" ? "bottom-right" : "bottom-left");
        this.beginFlip(direction, corner);
    }

    public pointerMove(x: number, y: number, pressure = 0.5): void {
        if (!this.session) {
            return;
        }
        this.updatePointer(x, y, pressure);
        this.updateDragProgress(x, y);
    }

    public pointerUp(): void {
        if (!this.session) {
            return;
        }
        this.release();
    }

    public cancel(): void {
        if (!this.session) {
            return;
        }
        this.stage = FlipStage.Cancelled;
        this.cancelRaf();
        this.animateTo(0, () => {
            this.stage = FlipStage.Idle;
            this.pointer.active = false;
            this.session = null;
            this.frontDeformer.reset(this.engine.getRightPageGeometry());
            this.backDeformer.reset(this.engine.getLeftPageGeometry());
            this.events.onCancel?.();
        });
    }

    public finish(): void {
        if (!this.session) {
            return;
        }
        this.stage = FlipStage.Finished;
        this.cancelRaf();
        this.animateTo(1, () => {
            this.completeTurn();
        });
    }

    public update(deltaTime: number): void {
        if (!this.session) {
            return;
        }

        if (this.stage === FlipStage.Dragging || this.stage === FlipStage.Pressed) {
            this.session.curl.progress = this.session.progress;
            this.applyDeformation(this.session.progress);
            return;
        }

        if (this.stage === FlipStage.Animating) {
            const next = THREE.MathUtils.clamp(this.session.progress + deltaTime * this.physics.stiffness, 0, 1);
            this.session.progress = THREE.MathUtils.lerp(this.session.progress, this.session.targetProgress, this.physics.damping);
            this.applyDeformation(this.session.progress);
            if (Math.abs(this.session.targetProgress - this.session.progress) < 0.001) {
                if (this.session.targetProgress >= 1) {
                    this.completeTurn();
                } else {
                    this.cancelledToIdle();
                }
            }
        }
    }

    private updatePointer(x: number, y: number, pressure: number): void {
        const prevX = this.pointer.x;
        const prevY = this.pointer.y;
        this.pointer.previousX = prevX;
        this.pointer.previousY = prevY;
        this.pointer.x = x;
        this.pointer.y = y;
        this.pointer.deltaX = x - prevX;
        this.pointer.deltaY = y - prevY;
        this.pointer.velocityX = THREE.MathUtils.clamp(this.pointer.deltaX, -this.physics.maxVelocity, this.physics.maxVelocity);
        this.pointer.velocityY = THREE.MathUtils.clamp(this.pointer.deltaY, -this.physics.maxVelocity, this.physics.maxVelocity);
        this.pointer.pressure = pressure;
        this.pointer.active = true;
        if (this.session) {
            this.session.pointer = { ...this.pointer };
        }
    }

    private updateDragProgress(x: number, y: number): void {
        if (!this.session) {
            return;
        }

        const direction = this.session.direction;
        const normalizedX = THREE.MathUtils.clamp(x / this.pageWidth, 0, 1);
        const normalizedY = THREE.MathUtils.clamp(y / this.pageHeight, 0, 1);

        let progress = 0;
        if (direction === "next") {
            progress = THREE.MathUtils.clamp(1 - normalizedX + normalizedY * 0.04, 0, 1);
        } else {
            progress = THREE.MathUtils.clamp(normalizedX + (1 - normalizedY) * 0.04, 0, 1);
        }

        if (this.pointer.pressure > 0.6) {
            progress = THREE.MathUtils.clamp(progress + (this.pointer.pressure - 0.6) * 0.25, 0, 1);
        }

        this.stage = FlipStage.Dragging;
        this.session.state = FlipStage.Dragging;
        this.session.progress = progress;
        this.session.targetProgress = progress;
        this.session.curl.progress = progress;
        this.session.curl.angle = progress * Math.PI * 0.95;
        this.session.curl.radius = this.computeRadius(progress, this.pointer.velocityX, this.pointer.velocityY);
        this.session.curl.origin.set(x, y, 0);
        this.applyDeformation(progress);
        this.events.onUpdate?.(progress);
    }

    private computeRadius(progress: number, velocityX: number, velocityY: number): number {
        const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        const stiffness = THREE.MathUtils.lerp(0.28, 0.12, THREE.MathUtils.clamp(progress, 0, 1));
        const motionFactor = THREE.MathUtils.clamp(speed / this.physics.maxVelocity, 0, 1);
        return THREE.MathUtils.clamp(stiffness - motionFactor * 0.08, 0.08, 0.32);
    }

    private release(): void {
        if (!this.session) {
            return;
        }

        this.pointer.active = false;
        const shouldFinish = this.session.progress > 0.5 || Math.abs(this.pointer.velocityX) > 1.2;
        this.session.targetProgress = shouldFinish ? 1 : 0;
        this.stage = FlipStage.Settling;
        this.session.state = FlipStage.Settling;
        this.animateTo(this.session.targetProgress, () => {
            if (shouldFinish) {
                this.completeTurn();
            } else {
                this.cancelledToIdle();
            }
        });
    }

    private animateTo(target: number, done: () => void): void {
        if (!this.session) {
            return;
        }
        this.cancelRaf();
        const duration = this.animation.duration * 1000;
        const start = performance.now();
        const from = this.session.progress;
        const easing = this.animation.easing;

        const step = (now: number): void => {
            const t = THREE.MathUtils.clamp((now - start) / duration, 0, 1);
            const eased = this.ease(t, easing);
            this.session!.progress = THREE.MathUtils.lerp(from, target, eased);
            this.session!.curl.progress = this.session!.progress;
            this.session!.curl.angle = this.session!.progress * Math.PI * 0.95;
            this.session!.curl.radius = this.computeRadius(this.session!.progress, this.pointer.velocityX, this.pointer.velocityY);
            this.applyDeformation(this.session!.progress);
            if (t < 1) {
                this.session!.rafId = requestAnimationFrame(step);
            } else {
                done();
            }
        };

        this.session.rafId = requestAnimationFrame(step);
    }

    private ease(t: number, easing: string): number {
        switch (easing) {
            case "linear":
                return t;
            case "power2.out":
                return 1 - Math.pow(1 - t, 2);
            case "power3.out":
                return 1 - Math.pow(1 - t, 3);
            case "power4.out":
                return 1 - Math.pow(1 - t, 4);
            default:
                return 1 - Math.pow(1 - t, 3);
        }
    }

    private applyDeformation(progress: number): void {
        if (!this.session) {
            return;
        }
        const curlState = this.session.curl;
        curlState.progress = progress;
        curlState.angle = progress * Math.PI * 0.95;
        curlState.radius = this.computeRadius(progress, this.pointer.velocityX, this.pointer.velocityY);
        const direction = this.session.direction;
        if (direction === "next") {
            this.frontDeformer.deform(this.engine.getRightPageGeometry(), curlState);
            this.backDeformer.reset(this.engine.getLeftPageGeometry());
        } else {
            this.frontDeformer.deform(this.engine.getLeftPageGeometry(), curlState);
            this.backDeformer.reset(this.engine.getRightPageGeometry());
        }
        this.engine.render();
    }

    private completeTurn(): void {
        if (!this.session) {
            return;
        }
        this.cancelRaf();
        const direction = this.session.direction;
        if (direction === "next") {
            this.engine.commitNextPage();
        } else {
            this.engine.commitPreviousPage();
        }
        this.frontDeformer.reset(this.engine.getRightPageGeometry());
        this.backDeformer.reset(this.engine.getLeftPageGeometry());
        this.stage = FlipStage.Idle;
        this.pointer.active = false;
        this.session = null;
        this.events.onFinish?.();
    }

    private cancelledToIdle(): void {
        if (!this.session) {
            return;
        }
        this.cancelRaf();
        this.frontDeformer.reset(this.engine.getRightPageGeometry());
        this.backDeformer.reset(this.engine.getLeftPageGeometry());
        this.stage = FlipStage.Idle;
        this.pointer.active = false;
        this.session = null;
        this.events.onCancel?.();
    }

    private cancelRaf(): void {
        if (this.session?.rafId !== null) {
            cancelAnimationFrame(this.session.rafId);
            this.session.rafId = null;
        }
    }
}
