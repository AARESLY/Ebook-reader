import * as THREE from "three";

/* ============================================================
    PointerTracker.ts
    Part 1A
============================================================ */

export enum PointerDevice {

    Mouse = "mouse",

    Touch = "touch",

    Pen = "pen",

    Unknown = "unknown"

}

export enum PointerPhase {

    Idle,

    Hover,

    Down,

    Drag,

    Up,

    Cancelled

}

export interface PointerFrame {

    id:number;

    x:number;

    y:number;

    previousX:number;

    previousY:number;

    worldX:number;

    worldY:number;

    deltaX:number;

    deltaY:number;

    velocityX:number;

    velocityY:number;

    accelerationX:number;

    accelerationY:number;

    pressure:number;

    tiltX:number;

    tiltY:number;

    twist:number;

    time:number;

    phase:PointerPhase;

}

export interface PointerTrackerOptions{

    historySize:number;

    dragThreshold:number;

    doubleClickDelay:number;

    smoothing:number;

}

interface InternalPointer{

    id:number;

    active:boolean;

    device:PointerDevice;

    frame:PointerFrame;

}

export default class PointerTracker{

    private readonly dom:HTMLElement;

    private readonly camera:THREE.Camera;

    private readonly raycaster=

        new THREE.Raycaster();

    private readonly ndc=

        new THREE.Vector2();

    private readonly world=

        new THREE.Vector3();

    private readonly previousWorld=

        new THREE.Vector3();

    private readonly velocity=

        new THREE.Vector2();

    private readonly acceleration=

        new THREE.Vector2();

    private readonly options:

        PointerTrackerOptions;

    private readonly history:

        PointerFrame[]=[];

    private readonly pointers=

        new Map<number,InternalPointer>();

    private currentPointer:

        InternalPointer|null=null;

    private lastDownTime=0;

    private lastClickTime=0;

    private dragging=false;

    private enabled=true;

    constructor(

        dom:HTMLElement,

        camera:THREE.Camera,

        options?:

        Partial<PointerTrackerOptions>

    ){

        this.dom=

            dom;

        this.camera=

            camera;

        this.options={

            historySize:

                options?.historySize??64,

            dragThreshold:

                options?.dragThreshold??6,

            doubleClickDelay:

                options?.doubleClickDelay??250,

            smoothing:

                options?.smoothing??0.2

        };

    }

    /* ------------------------------------------------ */

    public initialize(){

        this.attachEvents();

    }

    /* ------------------------------------------------ */

    private attachEvents(){

        this.dom.addEventListener(

            "pointerdown",

            this.onPointerDown

        );

        this.dom.addEventListener(

            "pointermove",

            this.onPointerMove

        );

        this.dom.addEventListener(

            "pointerup",

            this.onPointerUp

        );

        this.dom.addEventListener(

            "pointercancel",

            this.onPointerCancel

        );

        this.dom.addEventListener(

            "pointerleave",

            this.onPointerLeave

        );

    }

    /* ------------------------------------------------ */

    private readonly onPointerDown=(

        e:PointerEvent

    )=>{

        if(!this.enabled)

            return;

        const pointer=

            this.createPointer(

                e

            );

        this.pointers.set(

            e.pointerId,

            pointer

        );

        this.currentPointer=

            pointer;

        this.lastDownTime=

            performance.now();

        this.dom.setPointerCapture(

            e.pointerId

        );

    };

    /* ------------------------------------------------ */

    private readonly createPointer=(

        e:PointerEvent

    ):InternalPointer=>{

        return{

            id:e.pointerId,

            active:true,

            device:

                this.resolveDevice(

                    e.pointerType

                ),

            frame:{

                id:e.pointerId,

                x:e.clientX,

                y:e.clientY,

                previousX:e.clientX,

                previousY:e.clientY,

                worldX:0,

                worldY:0,

                deltaX:0,

                deltaY:0,

                velocityX:0,

                velocityY:0,

                accelerationX:0,

                accelerationY:0,

                pressure:e.pressure,

                tiltX:e.tiltX,

                tiltY:e.tiltY,

                twist:e.twist,

                time:performance.now(),

                phase:PointerPhase.Down

            }

        };

    };

    /* ------------------------------------------------ */

    private resolveDevice(

        type:string

    ):PointerDevice{

        switch(type){

            case "mouse":

                return PointerDevice.Mouse;

            case "touch":

                return PointerDevice.Touch;

            case "pen":

                return PointerDevice.Pen;

            default:

                return PointerDevice.Unknown;

        }

    }

    /* ------------------------------------------------ */
    /* ------------------------------------------------ */

    private readonly onPointerMove=(

        e:PointerEvent

    )=>{

        if(

            !this.enabled

        ){

            return;

        }

        const pointer=

            this.pointers.get(

                e.pointerId

            );

        if(

            !pointer

        ){

            return;

        }

        const frame=

            pointer.frame;

        frame.previousX=

            frame.x;

        frame.previousY=

            frame.y;

        frame.x=

            e.clientX;

        frame.y=

            e.clientY;

        frame.deltaX=

            frame.x-

            frame.previousX;

        frame.deltaY=

            frame.y-

            frame.previousY;

        frame.pressure=

            e.pressure;

        frame.tiltX=

            e.tiltX;

        frame.tiltY=

            e.tiltY;

        frame.twist=

            e.twist;

        frame.phase=

            pointer.active

                ? PointerPhase.Drag

                : PointerPhase.Hover;

        this.updateWorldPosition(

            frame

        );

        this.updateVelocity(

            frame

        );

        this.detectDrag(

            frame

        );

        this.pushHistory(

            frame

        );

    };

    /* ------------------------------------------------ */

    private readonly onPointerUp=(

        e:PointerEvent

    )=>{

        const pointer=

            this.pointers.get(

                e.pointerId

            );

        if(

            !pointer

        ){

            return;

        }

        pointer.active=false;

        pointer.frame.phase=

            PointerPhase.Up;

        this.pushHistory(

            pointer.frame

        );

        if(

            this.dom.hasPointerCapture(

                e.pointerId

            )

        ){

            this.dom.releasePointerCapture(

                e.pointerId

            );

        }

        this.dragging=false;

        this.lastClickTime=

            performance.now();

    };

    /* ------------------------------------------------ */

    private readonly onPointerCancel=(

        e:PointerEvent

    )=>{

        const pointer=

            this.pointers.get(

                e.pointerId

            );

        if(

            !pointer

        ){

            return;

        }

        pointer.active=false;

        pointer.frame.phase=

            PointerPhase.Cancelled;

        this.pushHistory(

            pointer.frame

        );

        this.pointers.delete(

            e.pointerId

        );

    };

    /* ------------------------------------------------ */

    private readonly onPointerLeave=(

        e:PointerEvent

    )=>{

        const pointer=

            this.pointers.get(

                e.pointerId

            );

        if(

            !pointer

        ){

            return;

        }

        if(

            !pointer.active

        ){

            pointer.frame.phase=

                PointerPhase.Idle;

        }

    };

    /* ------------------------------------------------ */

    private updateWorldPosition(

        frame:PointerFrame

    ){

        const rect=

            this.dom.getBoundingClientRect();

        this.ndc.x=

            (

                (frame.x-rect.left)

                /rect.width

            )*2-1;

        this.ndc.y=

            -(

                (frame.y-rect.top)

                /rect.height

            )*2+1;

        this.world.set(

            this.ndc.x,

            this.ndc.y,

            0

        );

        this.world.unproject(

            this.camera

        );

        frame.worldX=

            this.world.x;

        frame.worldY=

            this.world.y;

    }

    /* ------------------------------------------------ */

    private updateVelocity(

        frame:PointerFrame

    ){

        const now=

            performance.now();

        const dt=

            Math.max(

                0.0001,

                (now-frame.time)/1000

            );

        const vx=

            frame.deltaX/dt;

        const vy=

            frame.deltaY/dt;

        frame.velocityX=

            THREE.MathUtils.lerp(

                frame.velocityX,

                vx,

                this.options.smoothing

            );

        frame.velocityY=

            THREE.MathUtils.lerp(

                frame.velocityY,

                vy,

                this.options.smoothing

            );

        frame.accelerationX=

            (

                frame.velocityX-

                this.velocity.x

            )/dt;

        frame.accelerationY=

            (

                frame.velocityY-

                this.velocity.y

            )/dt;

        this.velocity.set(

            frame.velocityX,

            frame.velocityY

        );

        frame.time=

            now;

    }

    /* ------------------------------------------------ */

    private detectDrag(

        frame:PointerFrame

    ){

        if(

            this.dragging

        ){

            return;

        }

        const distance=

            Math.hypot(

                frame.x-

                frame.previousX,

                frame.y-

                frame.previousY

            );

        if(

            distance>=

            this.options.dragThreshold

        ){

            this.dragging=true;

            frame.phase=

                PointerPhase.Drag;

        }

    }

    /* ------------------------------------------------ */

    private pushHistory(

        frame:PointerFrame

    ){

        this.history.push({

            ...frame

        });

        if(

            this.history.length>

            this.options.historySize

        ){

            this.history.shift();

        }

    }

    /* ------------------------------------------------ */
    /* ------------------------------------------------ */

    private clickCount=0;

    private hoverPointerId=-1;

    private longPressTimer:number|null=null;

    private frameNumber=0;

    /* ------------------------------------------------ */

    public update(

        delta:number

    ){

        this.frameNumber++;

        this.cleanupPointers();

        this.updateHoverState();

        this.updateLongPress();

    }

    /* ------------------------------------------------ */

    private cleanupPointers(){

        const remove:number[]=[];

        for(

            const [

                id,

                pointer

            ]

            of

            this.pointers

        ){

            if(

                pointer.frame.phase===

                PointerPhase.Up||

                pointer.frame.phase===

                PointerPhase.Cancelled

            ){

                remove.push(

                    id

                );

            }

        }

        for(

            const id

            of

            remove

        ){

            this.pointers.delete(

                id

            );

        }

    }

    /* ------------------------------------------------ */

    private updateHoverState(){

        this.hoverPointerId=-1;

        for(

            const [

                id,

                pointer

            ]

            of

            this.pointers

        ){

            if(

                !pointer.active

            ){

                this.hoverPointerId=id;

                break;

            }

        }

    }

    /* ------------------------------------------------ */

    private updateLongPress(){

        if(

            !this.currentPointer

        ){

            return;

        }

        const elapsed=

            performance.now()-

            this.lastDownTime;

        if(

            elapsed<500

        ){

            return;

        }

        if(

            this.longPressTimer!==null

        ){

            return;

        }

        this.longPressTimer=

            window.setTimeout(

                ()=>{

                    if(

                        this.currentPointer

                    ){

                        this.currentPointer.frame.phase=

                            PointerPhase.Down;

                    }

                },

                1

            );

    }

    /* ------------------------------------------------ */

    public isDragging(){

        return this.dragging;

    }

    /* ------------------------------------------------ */

    public isPointerActive(){

        return this.currentPointer!==null;

    }

    /* ------------------------------------------------ */

    public getCurrentPointer(){

        return this.currentPointer;

    }

    /* ------------------------------------------------ */

    public getHistory(){

        return this.history;

    }

    /* ------------------------------------------------ */

    public getFrameNumber(){

        return this.frameNumber;

    }

    /* ------------------------------------------------ */

    public getPointerCount(){

        return this.pointers.size;

    }

    /* ------------------------------------------------ */

    public getPointer(

        id:number

    ){

        return this.pointers.get(

            id

        )??null;

    }

    /* ------------------------------------------------ */

    public hasPointer(

        id:number

    ){

        return this.pointers.has(

            id

        );

    }

    /* ------------------------------------------------ */

    public clearHistory(){

        this.history.length=0;

    }

    /* ------------------------------------------------ */

    public reset(){

        this.history.length=0;

        this.pointers.clear();

        this.currentPointer=null;

        this.dragging=false;

        this.hoverPointerId=-1;

        this.frameNumber=0;

        this.velocity.set(

            0,

            0

        );

        this.acceleration.set(

            0,

            0

        );

    }

    /* ------------------------------------------------ */

    public setEnabled(

        enabled:boolean

    ){

        this.enabled=

            enabled;

    }

    /* ------------------------------------------------ */

    public isEnabled(){

        return this.enabled;

    }

    /* ------------------------------------------------ */
