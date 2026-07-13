import * as THREE from "three";

import type {
    CurlState,
    FlipCorner,
    FlipDirection
} from "./types";

/* ===========================================================
   CurlDeformer.ts
   Part 1 / ?
   DO NOT close the class yet.
   Continue directly with Part 2.
=========================================================== */

export interface CurlDeformerOptions {

    pageWidth: number;

    pageHeight: number;

    thickness: number;

    segmentsX: number;

    segmentsY: number;

}

interface VertexCache {

    x: number;

    y: number;

    z: number;

    u: number;

    v: number;

}

interface VertexResult {

    x: number;

    y: number;

    z: number;

    nx: number;

    ny: number;

    nz: number;

}

interface CurlAxis {

    origin: THREE.Vector3;

    direction: THREE.Vector3;

    normal: THREE.Vector3;

}

interface PaperConstraint {

    spineWeight: number;

    edgeWeight: number;

    cornerWeight: number;

    stiffness: number;

}

interface CurlRuntime {

    radius: number;

    angle: number;

    progress: number;

    axis: CurlAxis;

    direction: FlipDirection;

    corner: FlipCorner;

}

export default class CurlDeformer {

    private readonly pageWidth: number;

    private readonly pageHeight: number;

    private readonly thickness: number;

    private readonly segmentsX: number;

    private readonly segmentsY: number;

    private readonly vertexCache: VertexCache[] = [];

    private readonly resultCache: VertexResult[] = [];

    private readonly tmpVecA = new THREE.Vector3();

    private readonly tmpVecB = new THREE.Vector3();

    private readonly tmpVecC = new THREE.Vector3();

    private readonly tmpNormal = new THREE.Vector3();

    private readonly tmpAxis = new THREE.Vector3();

    private readonly tmpCross = new THREE.Vector3();

    private readonly tmpMatrix = new THREE.Matrix4();

    private readonly tmpQuaternion = new THREE.Quaternion();

    private readonly paper: PaperConstraint = {

        spineWeight: 1,

        edgeWeight: 1,

        cornerWeight: 1,

        stiffness: 1

    };

    private runtime: CurlRuntime = {

        radius: .15,

        angle: 0,

        progress: 0,

        direction: "next",

        corner: "bottom-right",

        axis: {

            origin: new THREE.Vector3(),

            direction: new THREE.Vector3(1,0,0),

            normal: new THREE.Vector3(0,0,1)

        }

    };

    private initialized = false;

    constructor(
        options: CurlDeformerOptions
    ){

        this.pageWidth  = options.pageWidth;

        this.pageHeight = options.pageHeight;

        this.thickness  = options.thickness;

        this.segmentsX  = options.segmentsX;

        this.segmentsY  = options.segmentsY;

    }

    /* ------------------------------------------------ */

    public initialize(
        geometry: THREE.PlaneGeometry
    ){

        if(this.initialized)
            return;

        this.buildVertexCache(
            geometry
        );

        this.buildResultCache();

        this.computePaperConstraint();

        this.initialized = true;

    }

    /* ------------------------------------------------ */

    private buildVertexCache(
        geometry: THREE.PlaneGeometry
    ){

        this.vertexCache.length = 0;

        const pos =
            geometry.attributes.position
            as THREE.BufferAttribute;

        const uv =
            geometry.attributes.uv
            as THREE.BufferAttribute;

        for(
            let i=0;
            i<pos.count;
            i++
        ){

            this.vertexCache.push({

                x:pos.getX(i),

                y:pos.getY(i),

                z:pos.getZ(i),

                u:uv.getX(i),

                v:uv.getY(i)

            });

        }

    }

    /* ------------------------------------------------ */

    private buildResultCache(){

        this.resultCache.length = 0;

        for(

            let i=0;

            i<this.vertexCache.length;

            i++

        ){

            this.resultCache.push({

                x:0,

                y:0,

                z:0,

                nx:0,

                ny:0,

                nz:1

            });

        }

    }

    /* ------------------------------------------------ */

    private computePaperConstraint(){

        this.paper.spineWeight=.95;

        this.paper.edgeWeight=.72;

        this.paper.cornerWeight=.88;

        this.paper.stiffness=.83;

    }

    /* ------------------------------------------------ */

    public deform(

        geometry:THREE.PlaneGeometry,

        state:CurlState

    ){

        if(
            !this.initialized
        ){

            this.initialize(
                geometry
            );

        }

        this.prepareRuntime(
            state
        );

        this.computeCurlAxis();

        this.computeCylinderPass();

        this.computeConePass();

        this.computeHybridPass();

        this.computeThicknessPass();

        this.computeEdgeResistance();

        this.computeCornerResistance();

        this.computeSpineResistance();

        this.computeRelaxation();

        this.computeNormals();

        this.commitGeometry(
            geometry
        );

    }

    /* ------------------------------------------------ */

    private prepareRuntime(

        state:CurlState

    ){

        this.runtime.radius=

            Math.max(

                .02,

                state.radius

            );

        this.runtime.angle=

            state.angle;

        this.runtime.progress=

            THREE.MathUtils.clamp(

                state.progress,

                0,

                1

            );

        this.runtime.direction=

            state.direction;

        this.runtime.corner=

            state.corner;

    }

    /* ------------------------------------------------ */

    private computeCurlAxis(){

        const axis=

            this.runtime.axis;

        const halfW=

            this.pageWidth*.5;

        const halfH=

            this.pageHeight*.5;

        axis.origin.set(

            this.runtime.corner.includes("left")

                ?-halfW

                :halfW,

            this.runtime.corner.includes("top")

                ?halfH

                :-halfH,

            0

        );

        axis.direction.set(

            this.runtime.direction==="next"

                ?-1

                :1,

            0,

            0

        );

        axis.direction.normalize();

        axis.normal.set(

            0,

            0,

            1

        );

    }

    /* ------------------------------------------------ */

    private computeCylinderPass(){

        // Continue in Part 2...
            const axis =
            this.runtime.axis;

        const radius =
            this.runtime.radius;

        const angle =
            this.runtime.angle;

        const progress =
            this.runtime.progress;

        const axisDir =
            axis.direction;

        for (

            let i = 0;

            i < this.vertexCache.length;

            i++

        ) {

            const source =
                this.vertexCache[i];

            const result =
                this.resultCache[i];

            this.tmpVecA.set(

                source.x,

                source.y,

                source.z

            );

            this.tmpVecA.sub(
                axis.origin
            );

            const signedDistance =

                this.tmpVecA.dot(
                    axisDir
                );

            const foldWeight =

                THREE.MathUtils.clamp(

                    signedDistance /

                        (this.pageWidth * .65),

                    -1,

                    1

                );

            const influence =

                THREE.MathUtils.smoothstep(

                    progress,

                    0,

                    1

                );

            const theta =

                angle *

                influence *

                foldWeight;

            const limitedDistance =

                THREE.MathUtils.clamp(

                    signedDistance,

                    -radius * Math.PI,

                    radius * Math.PI

                );

            const arc =

                limitedDistance /

                radius;

            const localX =

                Math.sin(

                    arc

                ) * radius;

            const localZ =

                radius *

                (

                    1 -

                    Math.cos(

                        arc

                    )

                );

            result.x =

                axis.origin.x +

                axisDir.x *

                localX +

                (

                    source.x -

                    axis.origin.x

                ) *

                (

                    1 -

                    influence * .08

                );

            result.y =

                source.y;

            result.z =

                localZ *

                influence;

            this.tmpQuaternion.setFromAxisAngle(

                new THREE.Vector3(

                    0,

                    1,

                    0

                ),

                theta

            );

            this.tmpVecB.set(

                result.x -

                    axis.origin.x,

                result.y -

                    axis.origin.y,

                result.z

            );

            this.tmpVecB.applyQuaternion(

                this.tmpQuaternion

            );

            result.x =

                axis.origin.x +

                this.tmpVecB.x;

            result.y =

                axis.origin.y +

                this.tmpVecB.y;

            result.z =

                this.tmpVecB.z;

        }

    }

    /* ------------------------------------------------ */

    private computeConePass(){

        const radius =
            this.runtime.radius;

        const progress =
            this.runtime.progress;

        const topBias =

            this.runtime.corner.includes(

                "top"

            )

                ? 1

                : -1;

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const source =
                this.vertexCache[i];

            const result =
                this.resultCache[i];

            const yFactor =

                (

                    source.y+

                    this.pageHeight*.5

                )/

                this.pageHeight;

            const coneRadius =

                THREE.MathUtils.lerp(

                    radius*.35,

                    radius,

                    yFactor

                );

            const lift =

                coneRadius*

                progress*

                .42;

            result.z +=

                lift;

            result.y +=

                topBias*

                lift*

                .15;

        }

    }

    /* ------------------------------------------------ */

    private computeHybridPass(){

        const blend =

            THREE.MathUtils.smoothstep(

                this.runtime.progress,

                .15,

                .85

            );

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const r =
                this.resultCache[i];

            r.z *=

                THREE.MathUtils.lerp(

                    .85,

                    1.25,

                    blend

                );

        }

    }

    /* ------------------------------------------------ */

    private computeThicknessPass(){

        const thickness =

            this.thickness;

        const progress =

            this.runtime.progress;

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const r =

                this.resultCache[i];

            r.z +=

                thickness*

                progress;

        }

    }

    /* ------------------------------------------------ */

    private computeEdgeResistance(){

        const widthHalf =

            this.pageWidth*.5;

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const source =
                this.vertexCache[i];

            const r =
                this.resultCache[i];

            const edge =

                Math.abs(

                    source.x

                )/

                widthHalf;

            const resistance =

                THREE.MathUtils.smoothstep(

                    edge,

                    .7,

                    1

                );

            r.x =

                THREE.MathUtils.lerp(

                    r.x,

                    source.x,

                    resistance*

                    .28*

                    this.paper.edgeWeight

                );

        }

    }

    /* ------------------------------------------------ */

    private computeCornerResistance(){

        // Continue in Part 3...
            const widthHalf =

            this.pageWidth * .5;

        const heightHalf =

            this.pageHeight * .5;

        for (

            let i = 0;

            i < this.resultCache.length;

            i++

        ) {

            const source =

                this.vertexCache[i];

            const result =

                this.resultCache[i];

            const edgeX =

                Math.abs(

                    source.x

                ) / widthHalf;

            const edgeY =

                Math.abs(

                    source.y

                ) / heightHalf;

            const cornerStrength =

                THREE.MathUtils.clamp(

                    edgeX * edgeY,

                    0,

                    1

                );

            const restore =

                cornerStrength *

                this.paper.cornerWeight *

                .42;

            result.x =

                THREE.MathUtils.lerp(

                    result.x,

                    source.x,

                    restore

                );

            result.y =

                THREE.MathUtils.lerp(

                    result.y,

                    source.y,

                    restore * .75

                );

        }

    }

    /* ------------------------------------------------ */

    private computeSpineResistance() {

        const progress =

            this.runtime.progress;

        const spineX =

            this.runtime.direction === "next"

                ? -this.pageWidth * .5

                : this.pageWidth * .5;

        for (

            let i = 0;

            i < this.resultCache.length;

            i++

        ) {

            const source =

                this.vertexCache[i];

            const result =

                this.resultCache[i];

            const distance =

                Math.abs(

                    source.x -

                    spineX

                );

            const spineInfluence =

                1 -

                THREE.MathUtils.clamp(

                    distance /

                    (this.pageWidth * .18),

                    0,

                    1

                );

            const stiffness =

                spineInfluence *

                this.paper.spineWeight *

                (1 - progress);

            result.x =

                THREE.MathUtils.lerp(

                    result.x,

                    source.x,

                    stiffness

                );

            result.z *=

                1 -

                stiffness * .92;

        }

    }

    /* ------------------------------------------------ */

    private computeRelaxation() {

        const relaxation =

            1 -

            this.runtime.progress * .08;

        for (

            let i = 0;

            i < this.resultCache.length;

            i++

        ) {

            const r =

                this.resultCache[i];

            r.x *=

                relaxation;

            r.y *=

                relaxation;

        }

    }

    /* ------------------------------------------------ */

    private computeNormals() {

        for (

            let i = 0;

            i < this.resultCache.length;

            i++

        ) {

            const current =

                this.resultCache[i];

            const prev =

                this.resultCache[
                    Math.max(
                        0,
                        i - 1
                    )
                ];

            const next =

                this.resultCache[
                    Math.min(
                        this.resultCache.length - 1,
                        i + 1
                    )
                ];

            this.tmpVecA.set(

                next.x - prev.x,

                next.y - prev.y,

                next.z - prev.z

            );

            this.tmpVecB.set(

                0,

                1,

                0

            );

            this.tmpCross

                .crossVectors(

                    this.tmpVecA,

                    this.tmpVecB

                )

                .normalize();

            current.nx =

                this.tmpCross.x;

            current.ny =

                this.tmpCross.y;

            current.nz =

                this.tmpCross.z;

        }

    }

    /* ------------------------------------------------ */

    private commitGeometry(

        geometry: THREE.PlaneGeometry

    ) {

        const position =

            geometry.attributes
                .position as THREE.BufferAttribute;

        const normal =

            geometry.attributes
                .normal as THREE.BufferAttribute;

        for (

            let i = 0;

            i < this.resultCache.length;

            i++

        ) {

            const r =

                this.resultCache[i];

            position.setXYZ(

                i,

                r.x,

                r.y,

                r.z

            );

            normal.setXYZ(

                i,

                r.nx,

                r.ny,

                r.nz

            );

        }

        position.needsUpdate = true;

        normal.needsUpdate = true;

        geometry.computeBoundingSphere();

        geometry.computeBoundingBox();

    }

    /* ------------------------------------------------ */

    public reset(

        geometry: THREE.PlaneGeometry

    ) {

        const position =

            geometry.attributes
                .position as THREE.BufferAttribute;

        const normal =

            geometry.attributes
                .normal as THREE.BufferAttribute;

        for (

            let i = 0;

            i < this.vertexCache.length;

            i++

        ) {

            const source =

                this.vertexCache[i];

            position.setXYZ(

                i,

                source.x,

                source.y,

                source.z

            );

            normal.setXYZ(

                i,

                0,

                0,

                1

            );

        }

        position.needsUpdate = true;

        normal.needsUpdate = true;

    }

    /* ------------------------------------------------ */

    private validateGeometry(

        geometry: THREE.PlaneGeometry

    ) {

        if (

            geometry.attributes.position.count !==

            this.vertexCache.length

        ) {

            throw new Error(

                "Vertex cache mismatch."

            );

        }

    }

    /* ------------------------------------------------ */

    private disposeCaches() {

        this.vertexCache.length = 0;

        this.resultCache.length = 0;

        this.initialized = false;

    }

    /* ------------------------------------------------ */

    public dispose() {

        this.disposeCaches();

    }

}                                                                                        
