export interface PageSnapshot {

    canvas: HTMLCanvasElement;

    width: number;

    height: number;

    page: number;

}

export default class PageProvider {

    private current: PageSnapshot | null = null;

    private previous: PageSnapshot | null = null;

    private next: PageSnapshot | null = null;

    public setCurrent(snapshot: PageSnapshot) {

        this.current = snapshot;

    }

    public setPrevious(snapshot: PageSnapshot) {

        this.previous = snapshot;

    }

    public setNext(snapshot: PageSnapshot) {

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

    public clear() {

        this.current = null;
        this.previous = null;
        this.next = null;

    }

}