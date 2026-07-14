import * as THREE from "three";

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

export interface PointerTrackerOptions {
  historySize:number;
  dragThreshold:number;
  smoothing:number;
}

interface InternalPointer {
  id:number;
  active:boolean;
  device:PointerDevice;
  frame:PointerFrame;
}

export default class PointerTracker {
  protected readonly dom:HTMLElement;
  protected readonly camera:THREE.Camera;
  protected readonly raycaster=new THREE.Raycaster();
  protected readonly ndc=new THREE.Vector2();
  protected readonly world=new THREE.Vector3();
  protected readonly pointers=new Map<number,InternalPointer>();
  protected readonly history:PointerFrame[]=[];
  protected readonly options:PointerTrackerOptions;
  protected enabled=true;

  constructor(dom:HTMLElement,camera:THREE.Camera,options?:Partial<PointerTrackerOptions>){
    this.dom=dom;
    this.camera=camera;
    this.options={
      historySize:options?.historySize??64,
      dragThreshold:options?.dragThreshold??6,
      smoothing:options?.smoothing??0.2
    };
  }

  public initialize():void{
    this.dom.addEventListener("pointerdown",this.onPointerDown);
    this.dom.addEventListener("pointermove",this.onPointerMove);
  }
    
  protected readonly onPointerDown=(e:PointerEvent):void=>{
  const frame:PointerFrame={
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
    };
    this.pointers.set(e.pointerId,{
      id:e.pointerId,
      active:true,
      device:(e.pointerType==="mouse"?PointerDevice.Mouse:e.pointerType==="touch"?PointerDevice.Touch:e.pointerType==="pen"?PointerDevice.Pen:PointerDevice.Unknown),
      frame
    });
    this.dom.setPointerCapture?.(e.pointerId);
  };

  protected readonly onPointerMove=(e:PointerEvent):void=>{
    const pointer=this.pointers.get(e.pointerId);
    if(!pointer)return;
    const f=pointer.frame;
    f.previousX=f.x;
    f.previousY=f.y;
    f.x=e.clientX;
    f.y=e.clientY;
    f.deltaX=f.x-f.previousX;
    f.deltaY=f.y-f.previousY;
    f.pressure=e.pressure;
    f.tiltX=e.tiltX;
    f.tiltY=e.tiltY;
    f.twist=e.twist;
    f.phase=pointer.active?PointerPhase.Drag:PointerPhase.Hover;
  };

  protected updateWorld(frame:PointerFrame):void{
    const r=this.dom.getBoundingClientRect();
    this.ndc.set(((frame.x-r.left)/r.width)*2-1,-(((frame.y-r.top)/r.height)*2-1));
    this.world.set(this.ndc.x,this.ndc.y,0).unproject(this.camera);
    frame.worldX=this.world.x;
    frame.worldY=this.world.y;
  }
  protected readonly onPointerUp=(e:PointerEvent):void=>{
    const pointer=this.pointers.get(e.pointerId);
    if(!pointer)return;
    pointer.active=false;
    pointer.frame.phase=PointerPhase.Up;
    this.pushHistory(pointer.frame);
    if(this.dom.hasPointerCapture?.(e.pointerId)){
      this.dom.releasePointerCapture(e.pointerId);
    }
  };

  protected readonly onPointerCancel=(e:PointerEvent):void=>{
    const pointer=this.pointers.get(e.pointerId);
    if(!pointer)return;
    pointer.active=false;
    pointer.frame.phase=PointerPhase.Cancelled;
    this.pointers.delete(e.pointerId);
  };

  protected pushHistory(frame:PointerFrame):void{
    this.history.push({...frame});
    if(this.history.length>this.options.historySize){
      this.history.shift();
    }
  }

  public getPointer(id:number){
    return this.pointers.get(id)??null;
  }

  public getPointers(){
    return this.pointers;
  }

  public clearHistory():void{
    this.history.length=0;
  }

  public setEnabled(value:boolean):void{
    this.enabled=value;
  }

  public isEnabled():boolean{
    return this.enabled;
  }

  public update(delta:number):void{
    for(const pointer of this.pointers.values()){
      this.updateWorld(pointer.frame);
      this.updateVelocity(pointer.frame,delta);
      this.pushHistory(pointer.frame);
    }
  }

  protected updateVelocity(frame:PointerFrame,delta:number):void{
    const dt=Math.max(delta,0.000001);
    const vx=frame.deltaX/dt;
    const vy=frame.deltaY/dt;
    frame.accelerationX=(vx-frame.velocityX)/dt;
    frame.accelerationY=(vy-frame.velocityY)/dt;
    frame.velocityX+=
      (vx-frame.velocityX)*this.options.smoothing;
    frame.velocityY+=
      (vy-frame.velocityY)*this.options.smoothing;
  }

  public removePointer(id:number):void{
    this.pointers.delete(id);
  }

  public reset():void{
    this.history.length=0;
    this.pointers.clear();
  }

  public dispose():void{
    this.dom.removeEventListener("pointerdown",this.onPointerDown);
    this.dom.removeEventListener("pointermove",this.onPointerMove);
    this.dom.removeEventListener("pointerup",this.onPointerUp);
    this.dom.removeEventListener("pointercancel",this.onPointerCancel);
    this.reset();
  }

  public getHistory():ReadonlyArray<PointerFrame>{
    return this.history;
  }

  public getActivePointers():ReadonlyArray<PointerFrame>{
    const frames:PointerFrame[]=[];
    for(const p of this.pointers.values()){
      if(p.active)frames.push(p.frame);
    }
    return frames;
  }

  public getPrimaryPointer():PointerFrame|null{
    const first=this.pointers.values().next();
    return first.done?null:first.value.frame;
  }

  public hasActivePointers():boolean{
    for(const p of this.pointers.values()){
      if(p.active)return true;
    }
    return false;
  }

  public forEachPointer(
    callback:(frame:PointerFrame)=>void
  ):void{
    for(const p of this.pointers.values()){
      callback(p.frame);
    }
  }

  public destroy():void{
    this.dispose();
    this.history.length=0;
    this.pointers.clear();
  }
}

