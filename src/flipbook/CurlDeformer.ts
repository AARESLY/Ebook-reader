import * as THREE from "three";
import type { CurlState, FlipCorner, FlipDirection } from "./types";

export interface CurlDeformerOptions {
    pageWidth: number;
    pageHeight: number;
    thickness: number;
    segmentsX: number;
    segmentsY: number;
}

export default class CurlDeformer {
    private readonly pageWidth: number;
    private readonly pageHeight: number;
    private readonly thickness: number;
    private readonly segmentsX: number;
    private readonly segmentsY: number;

    constructor(options: CurlDeformerOptions) {
        this.pageWidth = options.pageWidth;
        this.pageHeight = options.pageHeight;
        this.thickness = options.thickness;
        this.segmentsX = options.segmentsX;
        this.segmentsY = options.segmentsY;
    }

    public deform(
        geometry: THREE.PlaneGeometry,
        state: CurlState
    ): void {
        const position = geometry.attributes.position as THREE.BufferAttribute;
        const normal = geometry.attributes.normal as THREE.BufferAttribute;
        const uv = geometry.attributes.uv as THREE.BufferAttribute;

        const widthHalf = this.pageWidth / 2;
        const heightHalf = this.pageHeight / 2;
        const curlRadius = Math.max(0.04, state.radius);
        const foldAngle = state.angle;
        const progress = THREE.MathUtils.clamp(state.progress, 0, 1);
        const corner = state.corner;
        const direction = state.direction;

        const curlCenterX = this.cornerToX(corner, direction, widthHalf);
        const curlCenterY = this.cornerToY(corner, heightHalf);

        const dirSign = direction === "next" ? -1 : 1;
        const cornerSignX = corner.includes("left") ? -1 : 1;
        const cornerSignY = corner.includes("top") ? 1 : -1;
        const curlAxis = new THREE.Vector2(dirSign, 0).normalize();
        const curlPerp = new THREE.Vector2(0, cornerSignY).normalize();

        const tmp = new THREE.Vector3();
        const normalTmp = new THREE.Vector3();

        for (let i = 0; i < position.count; i++) {
            const ix = uv.getX(i);
            const iy = uv.getY(i);

            const px = ix * this.pageWidth - widthHalf;
            const py = iy * this.pageHeight - heightHalf;

            const dx = px - curlCenterX;
            const dy = py - curlCenterY;

            const axisDistance = dx * curlAxis.x + dy * curlAxis.y;
            const perpDistance = dx * curlPerp.x + dy * curlPerp.y;

            const foldWeight = this.computeFoldWeight(progress, axisDistance, dirSign, widthHalf);
            const bendWeight = this.computeBendWeight(progress, perpDistance, heightHalf);
            const curlAmount = THREE.MathUtils.clamp(foldWeight * bendWeight, 0, 1);

            const localAngle = foldAngle * curlAmount;
            const arcLength = Math.min(Math.abs(axisDistance), curlRadius * Math.PI * 2);
            const bendY = Math.sin(localAngle) * curlRadius * bendWeight * cornerSignY;
            const bendZ = (1 - Math.cos(localAngle)) * curlRadius * curlAmount;

            tmp.set(px, py, 0);

            if (direction === "next") {
                tmp.x = px + Math.min(0, axisDistance) * 0.15 * curlAmount;
            } else {
                tmp.x = px - Math.max(0, axisDistance) * 0.15 * curlAmount;
            }

            tmp.y += bendY;
            tmp.z += bendZ * dirSign;

            if (Math.abs(axisDistance) > curlRadius * Math.PI) {
                const extra = Math.abs(axisDistance) - curlRadius * Math.PI;
                tmp.z += extra * 0.35 * dirSign;
            }

            position.setXYZ(i, tmp.x, tmp.y, tmp.z);

            normalTmp.set(0, 0, 1);
            normalTmp.applyAxisAngle(new THREE.Vector3(0, 1, 0), localAngle * dirSign);
            normalTmp.applyAxisAngle(new THREE.Vector3(1, 0, 0), bendWeight * 0.12 * cornerSignY);
            normal.setXYZ(i, normalTmp.x, normalTmp.y, normalTmp.z);
        }

        position.needsUpdate = true;
        normal.needsUpdate = true;
        uv.needsUpdate = true;
    }

    public reset(geometry: THREE.PlaneGeometry): void {
        const position = geometry.attributes.position as THREE.BufferAttribute;
        const normal = geometry.attributes.normal as THREE.BufferAttribute;

        const widthHalf = this.pageWidth / 2;
        const heightHalf = this.pageHeight / 2;
        const zOffset = 0;

        for (let i = 0; i < position.count; i++) {
            const ix = i % (this.segmentsX + 1);
            const iy = Math.floor(i / (this.segmentsX + 1));
            const x = (ix / this.segmentsX) * this.pageWidth - widthHalf;
            const y = (iy / this.segmentsY) * this.pageHeight - heightHalf;

            position.setXYZ(i, x, y, zOffset);
            normal.setXYZ(i, 0, 0, 1);
        }

        position.needsUpdate = true;
        normal.needsUpdate = true;
    }

    private computeFoldWeight(
        progress: number,
        axisDistance: number,
        dirSign: number,
        widthHalf: number
    ): number {
        const normalized = THREE.MathUtils.clamp((axisDistance * dirSign + widthHalf) / (widthHalf * 2), 0, 1);
        const pull = dirSign === -1 ? 1 - normalized : normalized;
        const soft = THREE.MathUtils.smoothstep(progress * 1.12, 0, 1);
        return THREE.MathUtils.clamp(soft * pull, 0, 1);
    }

    private computeBendWeight(
        progress: number,
        perpDistance: number,
        heightHalf: number
    ): number {
        const y = THREE.MathUtils.clamp(1 - Math.abs(perpDistance) / heightHalf, 0, 1);
        const edgeBoost = 0.35 + 0.65 * y;
        return THREE.MathUtils.clamp(progress * edgeBoost, 0, 1);
    }

    private cornerToX(corner: FlipCorner, direction: FlipDirection, widthHalf: number): number {
        if (corner.includes("left")) {
            return -widthHalf;
        }
        if (corner.includes("right")) {
            return widthHalf;
        }
        return direction === "next" ? widthHalf : -widthHalf;
    }

    private cornerToY(corner: FlipCorner, heightHalf: number): number {
        if (corner.includes("top")) {
            return heightHalf;
        }
        if (corner.includes("bottom")) {
            return -heightHalf;
        }
        return 0;
    }
}
