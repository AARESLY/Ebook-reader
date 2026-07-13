export interface PageSnapshot {
    pageNumber: number;
    cfi: string;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    timestamp: number;
}

export default class PageProvider {
    private current: PageSnapshot | null = null;
    private previous: PageSnapshot | null = null;
    private next: PageSnapshot | null = null;

    public setCurrent(snapshot: PageSnapshot | null) {
        this.current = snapshot;
    }

    public setPrevious(snapshot: PageSnapshot | null) {
        this.previous = snapshot;
    }

    public setNext(snapshot: PageSnapshot | null) {
        this.next = snapshot;
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

    public swapForward(): void {
        if (!this.current || !this.next) {
            return;
        }
        this.previous = this.current;
        this.current = this.next;
        this.next = null;
    }

    public swapBackward(): void {
        if (!this.current || !this.previous) {
            return;
        }
        this.next = this.current;
        this.current = this.previous;
        this.previous = null;
    }

    public invalidateCurrent(): void {
        this.current = null;
    }

    public invalidatePrevious(): void {
        this.previous = null;
    }

    public invalidateNext(): void {
        this.next = null;
    }

    public clear() {
        this.current = null;
        this.previous = null;
        this.next = null;
    }
}
