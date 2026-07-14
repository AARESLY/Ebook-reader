
import * as THREE from "three";

export enum PointerDevice{Mouse="mouse",Touch="touch",Pen="pen",Unknown="unknown"}
export enum PointerPhase{Idle,Hover,Down,Drag,Up,Cancelled}

export interface PointerFrame{
  id:number;x:number;y:number;previousX:number;previousY:number;
  worldX:number;worldY:number;
  deltaX:number;deltaY:number;
  velocityX:number;velocityY:number;
  accelerationX:number;accelerationY:number;
  pressure:number;tiltX:number;tiltY:number;twist:number;
  time:number;phase:PointerPhase;
}

export interface PointerTrackerOptions{
  historySize:number;
  dragThreshold:number;
  smoothing:number;
  predictionSamples:number;
}

interface InternalPointer{
  id:number;
  active:boolean;
  device:PointerDevice;
  frame:PointerFrame;
  accumulatedDistance:number;
  downTimestamp:number;
  clickCount:number;
}

export class PointerTracker{
  protected readonly dom:HTMLElement;
  protected readonly camera:THREE.Camera;
  protected readonly raycaster=new THREE.Raycaster();
  protected readonly ndc=new THREE.Vector2();
  protected readonly world=new THREE.Vector3();
  protected readonly pointers=new Map<number,InternalPointer>();
  protected readonly history:PointerFrame[]=[];
  protected readonly options:PointerTrackerOptions;
  protected enabled=true;
  protected dragging=false;
  protected frameIndex=0;

  constructor(dom:HTMLElement,camera:THREE.Camera,options?:Partial<PointerTrackerOptions>){
    this.dom=dom;
    this.camera=camera;
    this.options={
      historySize:options?.historySize??128,
      dragThreshold:options?.dragThreshold??5,
      smoothing:options?.smoothing??0.18,
      predictionSamples:options?.predictionSamples??8
    };
  }

  public initialize():void{this.attachEvents();}

  protected attachEvents():void{
    this.dom.addEventListener("pointerdown",this.onPointerDown);
    this.dom.addEventListener("pointermove",this.onPointerMove);
    this.dom.addEventListener("pointerup",this.onPointerUp);
    this.dom.addEventListener("pointercancel",this.onPointerCancel);
    this.dom.addEventListener("pointerleave",this.onPointerLeave);
  }

  protected resolveDevice(type:string):PointerDevice{
    switch(type){
      case "mouse":return PointerDevice.Mouse;
      case "touch":return PointerDevice.Touch;
      case "pen":return PointerDevice.Pen;
      default:return PointerDevice.Unknown;
    }
  }

  protected createFrame(e:PointerEvent):PointerFrame{
    return{
      id:e.pointerId,x:e.clientX,y:e.clientY,
      previousX:e.clientX,previousY:e.clientY,
      worldX:0,worldY:0,deltaX:0,deltaY:0,
      velocityX:0,velocityY:0,
      accelerationX:0,accelerationY:0,
      pressure:e.pressure,tiltX:e.tiltX,tiltY:e.tiltY,twist:e.twist,
      time:performance.now(),phase:PointerPhase.Down
    };
  }

  
protected readonly onPointerDown=(e:PointerEvent):void=>{
  if(!this.enabled)return;
  const frame=this.createFrame(e);
  const pointer:InternalPointer={
    id:e.pointerId,
    active:true,
    device:this.resolveDevice(e.pointerType),
    frame,
    accumulatedDistance:0,
    downTimestamp:performance.now(),
    clickCount:0
  };
  this.pointers.set(e.pointerId,pointer);
  if(this.dom.setPointerCapture){
    try{this.dom.setPointerCapture(e.pointerId);}catch{}
  }
  this.updateWorld(frame);
  this.history.push({...frame});
};

protected readonly onPointerMove=(e:PointerEvent):void=>{
  if(!this.enabled)return;
  const pointer=this.pointers.get(e.pointerId);
  if(!pointer)return;

  const f=pointer.frame;
  f.previousX=f.x;
  f.previousY=f.y;
  f.x=e.clientX;
  f.y=e.clientY;

  f.deltaX=f.x-f.previousX;
  f.deltaY=f.y-f.previousY;

  pointer.accumulatedDistance+=Math.hypot(f.deltaX,f.deltaY);

  f.pressure=e.pressure;
  f.tiltX=e.tiltX;
  f.tiltY=e.tiltY;
  f.twist=e.twist;

  if(pointer.accumulatedDistance>=this.options.dragThreshold){
    this.dragging=true;
    f.phase=PointerPhase.Drag;
  }else{
    f.phase=PointerPhase.Hover;
  }

  this.updateWorld(f);
  this.updateVelocity(f);
  this.recordFrame(f);
};

protected updateWorld(frame:PointerFrame):void{
  const r=this.dom.getBoundingClientRect();
  this.ndc.set(((frame.x-r.left)/r.width)*2-1,-(((frame.y-r.top)/r.height)*2-1));
  this.world.set(this.ndc.x,this.ndc.y,0).unproject(this.camera);
  frame.worldX=this.world.x;
  frame.worldY=this.world.y;
}

protected updateVelocity(frame:PointerFrame):void{
  const now=performance.now();
  const dt=Math.max((now-frame.time)/1000,0.000001);
  const vx=frame.deltaX/dt;
  const vy=frame.deltaY/dt;
  frame.accelerationX=(vx-frame.velocityX)/dt;
  frame.accelerationY=(vy-frame.velocityY)/dt;
  frame.velocityX+=(vx-frame.velocityX)*this.options.smoothing;
  frame.velocityY+=(vy-frame.velocityY)*this.options.smoothing;
  frame.time=now;
}

protected recordFrame(frame:PointerFrame):void{
  this.history.push({...frame});
  while(this.history.length>this.options.historySize){
    this.history.shift();
  }
}

  
protected readonly onPointerUp=(e:PointerEvent):void=>{
  const pointer=this.pointers.get(e.pointerId);
  if(!pointer)return;
  pointer.active=false;
  pointer.frame.phase=PointerPhase.Up;
  this.dragging=false;
  this.recordFrame(pointer.frame);
  if(this.dom.hasPointerCapture?.(e.pointerId)){
    try{this.dom.releasePointerCapture(e.pointerId);}catch{}
  }
  this.handleClick(pointer);
}

protected readonly onPointerCancel=(e:PointerEvent):void=>{
  const pointer=this.pointers.get(e.pointerId);
  if(!pointer)return;
  pointer.frame.phase=PointerPhase.Cancelled;
  pointer.active=false;
  this.recordFrame(pointer.frame);
  this.pointers.delete(e.pointerId);
}

protected readonly onPointerLeave=(e:PointerEvent):void=>{
  const pointer=this.pointers.get(e.pointerId);
  if(!pointer)return;
  if(!pointer.active){
    pointer.frame.phase=PointerPhase.Idle;
    this.recordFrame(pointer.frame);
  }
}

protected handleClick(pointer:InternalPointer):void{
  const elapsed=performance.now()-pointer.downTimestamp;
  if(pointer.accumulatedDistance>this.options.dragThreshold)return;
  if(elapsed>250)return;
  pointer.clickCount++;
  if(pointer.clickCount===1){
    this.onSingleClick(pointer);
  }else if(pointer.clickCount===2){
    this.onDoubleClick(pointer);
    pointer.clickCount=0;
  }
}

protected onSingleClick(pointer:InternalPointer):void{
  // Hook for PageTurnController.
}

protected onDoubleClick(pointer:InternalPointer):void{
  // Hook for future interactions.
}

public update(delta:number):void{
  this.frameIndex++;
  for(const pointer of this.pointers.values()){
    if(!pointer.active)continue;
    this.updatePrediction(pointer,delta);
  }
}

protected updatePrediction(pointer:InternalPointer,delta:number):void{
  const f=pointer.frame;
  const lookAhead=Math.min(delta,0.016);
  f.worldX+=f.velocityX*lookAhead*0.001;
  f.worldY+=f.velocityY*lookAhead*0.001;
}


protected longPressDuration=500;
protected longPressTriggered=false;

protected updateLongPress(pointer:InternalPointer):void{
  if(this.longPressTriggered)return;
  const elapsed=performance.now()-pointer.downTimestamp;
  if(elapsed<this.longPressDuration)return;
  this.longPressTriggered=true;
  this.onLongPress(pointer);
}

protected onLongPress(pointer:InternalPointer):void{
  // Extension point for PageTurnController.
}

protected updateHoverState():void{
  for(const pointer of this.pointers.values()){
    if(pointer.active)continue;
    pointer.frame.phase=PointerPhase.Hover;
  }
}

protected cleanupReleasedPointers():void{
  const remove:number[]=[];
  for(const [id,pointer] of this.pointers){
    if(pointer.frame.phase===PointerPhase.Up||
       pointer.frame.phase===PointerPhase.Cancelled){
      remove.push(id);
    }
  }
  for(const id of remove){
    this.pointers.delete(id);
  }
}

public tick(delta:number):void{
  this.update(delta);
  this.updateHoverState();
  for(const pointer of this.pointers.values()){
    if(pointer.active){
      this.updateLongPress(pointer);
    }
  }
  this.cleanupReleasedPointers();
}

public getPointerCount():number{
  return this.pointers.size;
}

public getHistory():ReadonlyArray<PointerFrame>{
  return this.history;
}

public getPrimaryPointer():PointerFrame|null{
  const first=this.pointers.values().next();
  return first.done?null:first.value.frame;
}


protected pressureDeadZone=0.02;
protected pressureScale=1.0;

protected normalizePressure(pointer:InternalPointer):void{
  const f=pointer.frame;
  let p=Math.max(0,f.pressure-this.pressureDeadZone);
  p=Math.min(1,p*this.pressureScale);
  f.pressure=p;
}

protected filterStylus(pointer:InternalPointer):void{
  if(pointer.device!==PointerDevice.Pen)return;
  const f=pointer.frame;
  f.tiltX=Math.max(-90,Math.min(90,f.tiltX));
  f.tiltY=Math.max(-90,Math.min(90,f.tiltY));
  f.twist=((f.twist%360)+360)%360;
}

protected updatePointerPipeline(pointer:InternalPointer,delta:number):void{
  this.normalizePressure(pointer);
  this.filterStylus(pointer);
  this.updatePrediction(pointer,delta);
}

public getActivePointerFrames():PointerFrame[]{
  const out:PointerFrame[]=[];
  for(const p of this.pointers.values()){
    if(p.active)out.push(p.frame);
  }
  return out;
}

public findPointer(id:number):PointerFrame|null{
  const p=this.pointers.get(id);
  return p?p.frame:null;
}

public forEachPointer(callback:(frame:PointerFrame)=>void):void{
  for(const p of this.pointers.values()){
    callback(p.frame);
  }
}

public updateAll(delta:number):void{
  this.frameIndex++;
  for(const p of this.pointers.values()){
    this.updatePointerPipeline(p,delta);
  }
  this.cleanupReleasedPointers();
}

  
  protected debugEnabled=false;
  protected readonly metrics={
    frames:0,
    pointerEvents:0,
    activePointers:0,
    averagePressure:0
  };

  protected updateMetrics():void{
    this.metrics.frames++;
    this.metrics.activePointers=this.pointers.size;
    let total=0,count=0;
    for(const p of this.pointers.values()){
      total+=p.frame.pressure;
      count++;
    }
    this.metrics.averagePressure=count?total/count:0;
  }

  public enableDebug(enabled:boolean):void{
    this.debugEnabled=enabled;
  }

  public getMetrics(){
    return {...this.metrics};
  }

  public updateFrame(delta:number):void{
    this.updateAll(delta);
    this.updateMetrics();
    if(this.debugEnabled){
      this.debugDraw();
    }
  }

  protected debugDraw():void{
    // Future debug renderer hook.
  }

  public reset():void{
    this.history.length=0;
    this.pointers.clear();
    this.dragging=false;
    this.frameIndex=0;
    this.longPressTriggered=false;
  }

  public dispose():void{
    this.dom.removeEventListener("pointerdown",this.onPointerDown);
    this.dom.removeEventListener("pointermove",this.onPointerMove);
    this.dom.removeEventListener("pointerup",this.onPointerUp);
    this.dom.removeEventListener("pointercancel",this.onPointerCancel);
    this.dom.removeEventListener("pointerleave",this.onPointerLeave);
    this.reset();
  }

  public destroy():void{
    this.dispose();
  }
}


