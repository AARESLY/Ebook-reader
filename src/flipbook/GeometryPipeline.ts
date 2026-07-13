import * as THREE from "three";

import type {
    VertexCache,
    VertexResult
} from "./CurlDeformer";

/* ==========================================================
    GeometryPipeline.ts
    Part 1 / ?
========================================================== */

export interface PipelinePass {

    name: string;

    enabled: boolean;

    weight: number;

}

export interface PipelineStatistics {

    frame: number;

    updatedVertices: number;

    uploadedVertices: number;

    deformationTime: number;

    normalTime: number;

    uploadTime: number;

}

export interface GeometryPipelineOptions {

    segmentsX: number;

    segmentsY: number;

}

interface DirtyRange {

    start: number;

    end: number;

}

interface CachedBuffer {

    position: THREE.BufferAttribute;

    normal: THREE.BufferAttribute;

    uv: THREE.BufferAttribute;

}

export default class GeometryPipeline {

    private readonly segmentsX:number;

    private readonly segmentsY:number;

    private geometry!:THREE.PlaneGeometry;

    private buffer!:CachedBuffer;

    private vertexCache:VertexCache[]=[];

    private resultCache:VertexResult[]=[];

    private readonly dirtyRanges:DirtyRange[]=[];

    private readonly tmpA=new THREE.Vector3();

    private readonly tmpB=new THREE.Vector3();

    private readonly tmpC=new THREE.Vector3();

    private readonly tmpNormal=new THREE.Vector3();

    private readonly tmpCross=new THREE.Vector3();

    private readonly statistics:PipelineStatistics={

        frame:0,

        updatedVertices:0,

        uploadedVertices:0,

        deformationTime:0,

        normalTime:0,

        uploadTime:0

    };

    private readonly passes:PipelinePass=[

        {

            name:"deformation",

            enabled:true,

            weight:1

        },

        {

            name:"relaxation",

            enabled:true,

            weight:1

        },

        {

            name:"thickness",

            enabled:true,

            weight:1

        },

        {

            name:"normals",

            enabled:true,

            weight:1

        },

        {

            name:"upload",

            enabled:true,

            weight:1

        }

    ];

    constructor(

        options:GeometryPipelineOptions

    ){

        this.segmentsX=

            options.segmentsX;

        this.segmentsY=

            options.segmentsY;

    }

    /* ------------------------------------------------ */

    public initialize(

        geometry:THREE.PlaneGeometry,

        vertexCache:VertexCache[],

        resultCache:VertexResult[]

    ){

        this.geometry=

            geometry;

        this.vertexCache=

            vertexCache;

        this.resultCache=

            resultCache;

        this.buffer={

            position:

                geometry.attributes.position as THREE.BufferAttribute,

            normal:

                geometry.attributes.normal as THREE.BufferAttribute,

            uv:

                geometry.attributes.uv as THREE.BufferAttribute

        };

        this.buildDirtyMap();

    }

    /* ------------------------------------------------ */

    private buildDirtyMap(){

        this.dirtyRanges.length=0;

        this.dirtyRanges.push({

            start:0,

            end:this.vertexCache.length-1

        });

    }

    /* ------------------------------------------------ */

    public beginFrame(){

        this.statistics.frame++;

        this.statistics.updatedVertices=0;

        this.statistics.uploadedVertices=0;

        this.statistics.deformationTime=0;

        this.statistics.normalTime=0;

        this.statistics.uploadTime=0;

    }

    /* ------------------------------------------------ */

    public markDirty(

        vertex:number

    ){

        this.dirtyRanges.push({

            start:vertex,

            end:vertex

        });

    }

    /* ------------------------------------------------ */

    public markDirtyRange(

        start:number,

        end:number

    ){

        this.dirtyRanges.push({

            start,

            end

        });

    }

    /* ------------------------------------------------ */

    public uploadVertices(){

        const begin=

            performance.now();

        for(

            const range

            of

            this.dirtyRanges

        ){

            for(

                let i=range.start;

                i<=range.end;

                i++

            ){

                const result=

                    this.resultCache[i];

                this.buffer.position.setXYZ(

                    i,

                    result.x,

                    result.y,

                    result.z

                );

                this.statistics.uploadedVertices++;

            }

        }

        this.buffer.position.needsUpdate=true;

        this.statistics.uploadTime=

            performance.now()-begin;

    }

    /* ------------------------------------------------ */

    public recomputeNormals(){

        const begin=

            performance.now();

        for(

            let i=1;

            i<this.resultCache.length-1;

            i++

        ){

            const previous=

                this.resultCache[i-1];

            const current=

                this.resultCache[i];

            const next=

                this.resultCache[i+1];

            this.tmpA.set(

                next.x-previous.x,

                next.y-previous.y,

                next.z-previous.z

            );

            this.tmpB.set(

                0,

                1,

                0

            );

            this.tmpCross

                .crossVectors(

                    this.tmpA,

                    this.tmpB

                )

                .normalize();

            current.nx=

                this.tmpCross.x;

            current.ny=

                this.tmpCross.y;

            current.nz=

                this.tmpCross.z;

            this.buffer.normal.setXYZ(

                i,

                current.nx,

                current.ny,

                current.nz

            );

        }

        this.buffer.normal.needsUpdate=true;

        this.statistics.normalTime=

            performance.now()-begin;

    }

    /* ------------------------------------------------ */

    public finishFrame(){

        this.geometry.computeBoundingSphere();

        this.geometry.computeBoundingBox();

        this.dirtyRanges.length=0;

    }

    /* ------------------------------------------------ */

    public getStatistics(){

        return{

            ...this.statistics

        };

    }

    /* ------------------------------------------------ */
    public rebuildTangents(){

        for(

            let i=1;

            i<this.resultCache.length-1;

            i++

        ){

            const previous=

                this.resultCache[i-1];

            const next=

                this.resultCache[i+1];

            const current=

                this.resultCache[i];

            this.tmpA.set(

                next.x-previous.x,

                next.y-previous.y,

                next.z-previous.z

            );

            this.tmpA.normalize();

            current.tx=

                this.tmpA.x;

            current.ty=

                this.tmpA.y;

            current.tz=

                this.tmpA.z;

        }

    }

    /* ------------------------------------------------ */

    public smoothVertices(

        iterations:number=1

    ){

        for(

            let step=0;

            step<iterations;

            step++

        ){

            for(

                let i=1;

                i<this.resultCache.length-1;

                i++

            ){

                const left=

                    this.resultCache[i-1];

                const current=

                    this.resultCache[i];

                const right=

                    this.resultCache[i+1];

                current.x=

                    (left.x+

                    current.x+

                    right.x)/3;

                current.y=

                    (left.y+

                    current.y+

                    right.y)/3;

                current.z=

                    (left.z+

                    current.z+

                    right.z)/3;

            }

        }

    }

    /* ------------------------------------------------ */

    public relaxMesh(

        strength:number

    ){

        strength=

            THREE.MathUtils.clamp(

                strength,

                0,

                1

            );

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const source=

                this.vertexCache[i];

            const current=

                this.resultCache[i];

            current.x=

                THREE.MathUtils.lerp(

                    current.x,

                    source.x,

                    strength

                );

            current.y=

                THREE.MathUtils.lerp(

                    current.y,

                    source.y,

                    strength

                );

            current.z=

                THREE.MathUtils.lerp(

                    current.z,

                    source.z,

                    strength*.25

                );

        }

    }

    /* ------------------------------------------------ */

    public applyThickness(

        thickness:number

    ){

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            this.resultCache[i].z+=

                thickness;

        }

    }

    /* ------------------------------------------------ */

    public applyDisplacement(

        displacement:

        THREE.Vector3

    ){

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const v=

                this.resultCache[i];

            v.x+=

                displacement.x;

            v.y+=

                displacement.y;

            v.z+=

                displacement.z;

        }

    }

    /* ------------------------------------------------ */

    public mirrorX(){

        for(

            const vertex

            of

            this.resultCache

        ){

            vertex.x*=-1;

        }

    }

    /* ------------------------------------------------ */

    public mirrorY(){

        for(

            const vertex

            of

            this.resultCache

        ){

            vertex.y*=-1;

        }

    }

    /* ------------------------------------------------ */

    public resetGeometry(){

        for(

            let i=0;

            i<this.vertexCache.length;

            i++

        ){

            const source=

                this.vertexCache[i];

            const result=

                this.resultCache[i];

            result.x=

                source.x;

            result.y=

                source.y;

            result.z=

                source.z;

            result.nx=0;

            result.ny=0;

            result.nz=1;

            result.tx=1;

            result.ty=0;

            result.tz=0;

        }

    }

    /* ------------------------------------------------ */

    public validateBuffers(){

        if(

            !this.buffer.position||

            !this.buffer.normal||

            !this.buffer.uv

        ){

            throw new Error(

                "GeometryPipeline not initialized."

            );

        }

        if(

            this.buffer.position.count!==

            this.resultCache.length

        ){

            throw new Error(

                "Buffer size mismatch."

            );

        }

    }

    /* ------------------------------------------------ */

    public dispose(){

        this.vertexCache=[];

        this.resultCache=[];

        this.dirtyRanges.length=0;

    }
    /* ------------------------------------------------ */

    public forEachVertex(

        callback:(

            source:VertexCache,

            result:VertexResult,

            index:number

        )=>void

    ){

        const count=

            this.resultCache.length;

        for(

            let i=0;

            i<count;

            i++

        ){

            callback(

                this.vertexCache[i],

                this.resultCache[i],

                i

            );

        }

    }

    /* ------------------------------------------------ */

    public transform(

        matrix:THREE.Matrix4

    ){

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const r=

                this.resultCache[i];

            this.tmpA.set(

                r.x,

                r.y,

                r.z

            );

            this.tmpA.applyMatrix4(

                matrix

            );

            r.x=

                this.tmpA.x;

            r.y=

                this.tmpA.y;

            r.z=

                this.tmpA.z;

        }

    }

    /* ------------------------------------------------ */

    public rotate(

        quaternion:THREE.Quaternion

    ){

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const r=

                this.resultCache[i];

            this.tmpA.set(

                r.x,

                r.y,

                r.z

            );

            this.tmpA.applyQuaternion(

                quaternion

            );

            r.x=

                this.tmpA.x;

            r.y=

                this.tmpA.y;

            r.z=

                this.tmpA.z;

        }

    }

    /* ------------------------------------------------ */

    public scale(

        x:number,

        y:number,

        z:number

    ){

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const r=

                this.resultCache[i];

            r.x*=x;

            r.y*=y;

            r.z*=z;

        }

    }

    /* ------------------------------------------------ */

    public translate(

        x:number,

        y:number,

        z:number

    ){

        for(

            let i=0;

            i<this.resultCache.length;

            i++

        ){

            const r=

                this.resultCache[i];

            r.x+=x;

            r.y+=y;

            r.z+=z;

        }

    }

    /* ------------------------------------------------ */

    public computeBounds(){

        let minX= Infinity;
        let minY= Infinity;
        let minZ= Infinity;

        let maxX=-Infinity;
        let maxY=-Infinity;
        let maxZ=-Infinity;

        for(

            const v

            of

            this.resultCache

        ){

            if(v.x<minX) minX=v.x;
            if(v.y<minY) minY=v.y;
            if(v.z<minZ) minZ=v.z;

            if(v.x>maxX) maxX=v.x;
            if(v.y>maxY) maxY=v.y;
            if(v.z>maxZ) maxZ=v.z;

        }

        return{

            min:new THREE.Vector3(

                minX,

                minY,

                minZ

            ),

            max:new THREE.Vector3(

                maxX,

                maxY,

                maxZ

            )

        };

    }

    /* ------------------------------------------------ */

    public getVertex(

        index:number

    ){

        return this.resultCache[index];

    }

    /* ------------------------------------------------ */

    public getSourceVertex(

        index:number

    ){

        return this.vertexCache[index];

    }

    /* ------------------------------------------------ */

    public getVertexCount(){

        return this.resultCache.length;

    }

    /* ------------------------------------------------ */

    public getGeometry(){

        return this.geometry;

    }

    /* ------------------------------------------------ */

    public getPasses(){

        return this.passes;

    }

    /* ------------------------------------------------ */

    public enablePass(

        name:string

    ){

        const pass=

            this.passes.find(

                p=>p.name===name

            );

        if(pass)

            pass.enabled=true;

    }

    /* ------------------------------------------------ */

    public disablePass(

        name:string

    ){

        const pass=

            this.passes.find(

                p=>p.name===name

            );

        if(pass)

            pass.enabled=false;

    }

    /* ------------------------------------------------ */

    public setPassWeight(

        name:string,

        weight:number

    ){

        const pass=

            this.passes.find(

                p=>p.name===name

            );

        if(

            pass

        ){

            pass.weight=

                THREE.MathUtils.clamp(

                    weight,

                    0,

                    10

                );

        }

    }

    /* ------------------------------------------------ */

    public clearDirtyRanges(){

        this.dirtyRanges.length=0;

    }

    /* ------------------------------------------------ */

    public forceFullUpload(){

        this.markDirtyRange(

            0,

            this.resultCache.length-1

        );

    }

    /* ------------------------------------------------ */

    public cloneResultCache(){

        return this.resultCache.map(

            vertex=>({

                ...vertex

            })

        );

    }

    /* ------------------------------------------------ */

}
