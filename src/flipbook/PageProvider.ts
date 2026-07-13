export interface PageSnapshot {
    pageNumber: number;
    cfi: string;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    timestamp: number;
}

export interface PageDescriptor {
    pageNumber: number;
    cfi: string;
    chapter?: string;
    title?: string;
}

export default class PageProvider {
    private current: PageSnapshot | null = null;
    private previous: PageSnapshot | null = null;
    private next: PageSnapshot | null = null;
    private readonly history: PageSnapshot[] = [];
    private readonly future: PageSnapshot[] = [];
    private readonly maxHistory = 24;
    private readonly maxFuture = 24;
    private dirty = false;

    public setCurrent(snapshot: PageSnapshot | null) {
        this.current = snapshot;
        this.dirty = true;
        if (snapshot) {
            this.pushHistory(snapshot);
        }
    }

    public setPrevious(snapshot: PageSnapshot | null) {
        this.previous = snapshot;
        this.dirty = true;
        if (snapshot) {
            this.pushHistory(snapshot);
        }
    }

    public setNext(snapshot: PageSnapshot | null) {
        this.next = snapshot;
        this.dirty = true;
        if (snapshot) {
            this.pushFuture(snapshot);
        }
    }

    public getCurrent() {
        return this.current;
    }

    public getPrevious() {
        return this.previous;
    }

    public getNext() {
        return this.next;
    }

    public getHistory(): readonly PageSnapshot[] {
        return this.history;
    }

    public getFuture(): readonly PageSnapshot[] {
        return this.future;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    public markClean(): void {
        this.dirty = false;
    }

    public swapForward(): void {
        if (!this.current || !this.next) {
            return;
        }
        this.previous = this.current;
        this.current = this.next;
        this.next = null;
        this.future.length = 0;
        this.pushHistory(this.previous);
        this.pushHistory(this.current);
        this.dirty = true;
    }

    public swapBackward(): void {
        if (!this.current || !this.previous) {
            return;
        }
        this.next = this.current;
        this.current = this.previous;
        this.previous = null;
        this.history.pop();
        this.dirty = true;
    }

    public clear(): void {
        this.current = null;
        this.previous = null;
        this.next = null;
        this.history.length = 0;
        this.future.length = 0;
        this.dirty = true;
    }

    public invalidateCurrent(): void {
        this.current = null;
        this.dirty = true;
    }

    public invalidatePrevious(): void {
        this.previous = null;
        this.dirty = true;
    }

    public invalidateNext(): void {
        this.next = null;
        this.dirty = true;
    }

    public createSnapshot(
        pageNumber: number,
        cfi: string,
        canvas: HTMLCanvasElement,
        width: number,
        height: number
    ): PageSnapshot {
        return {
            pageNumber,
            cfi,
            canvas,
            width,
            height,
            timestamp: performance.now()
        };
    }

    public createDescriptor(pageNumber: number, cfi: string, chapter?: string, title?: string): PageDescriptor {
        return { pageNumber, cfi, chapter, title };
    }

    public findSnapshotByPage(pageNumber: number): PageSnapshot | null {
        const stacks = [this.current, this.previous, this.next, ...this.history, ...this.future];
        return stacks.find(s => s?.pageNumber === pageNumber) ?? null;
    }

    public findSnapshotByCfi(cfi: string): PageSnapshot | null {
        const stacks = [this.current, this.previous, this.next, ...this.history, ...this.future];
        return stacks.find(s => s?.cfi === cfi) ?? null;
    }

    public disposeSnapshots(): void {
        const stacks = [this.current, this.previous, this.next, ...this.history, ...this.future];
        for (const snapshot of stacks) {
            snapshot?.canvas.getContext("2d")?.clearRect(0, 0, snapshot.canvas.width, snapshot.canvas.height);
        }
    }

    private pushHistory(snapshot: PageSnapshot): void {
        this.history.push(snapshot);
        while (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    private pushFuture(snapshot: PageSnapshot): void {
        this.future.push(snapshot);
        while (this.future.length > this.maxFuture) {
            this.future.shift();
        }
    }
}
