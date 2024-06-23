//A small scaffold specifically to help me design code pen interactions

//Math extensions
Math.lerp = (first, second, percentage) => {
  return first + (second - first) * percentage;
};

Math.clamp = (value, min, max) => {
  return value < min ? min : value > max ? max : value;
};

class Vector2 {
  static zero() {
    return { x: 0, y: 0 };
  }

  static sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  static add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  static mult(a, b) {
    return { x: a.x * b.x, y: a.y * b.y };
  }

  static scale(v, scaleFactor) {
    return { x: v.x * scaleFactor, y: v.y * scaleFactor };
  }

  static mag(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  static normalized(v) {
    const mag = Vector2.mag(v);

    if (mag === 0) {
      return Vector2.zero();
    }
    return { x: v.x / mag, y: v.y / mag };
  }}


class App {
  constructor(
  window,
  canvas,
  context,
  updateHandler,
  drawHandler,
  frameRate = 60)
  {
    this._window = window;
    this._canvas = canvas;
    this._context = context;
    this._updateHandler = updateHandler;
    this._drawHandler = drawHandler;
    this._frameRate = frameRate;
    this._lastTime = 0;
    this._currentTime = 0;
    this._deltaTime = 0;
    this._interval = 0;
    this.onMouseMoveHandler = (x, y) => {};
    this.onMouseDownHandler = (x, y) => {};
    this.start = this.start.bind(this);
    this._onMouseEventHandlerWrapper = this._onMouseEventHandlerWrapper.bind(
    this);

    this._onRequestAnimationFrame = this._onRequestAnimationFrame.bind(this);
  }

  start() {
    this._lastTime = new Date().getTime();
    this._currentTime = 0;
    this._deltaTime = 0;
    this._interval = 1000 / this._frameRate;

    this._canvas.addEventListener(
    "mousemove",
    e => {
      this._onMouseEventHandlerWrapper(e, this.onMouseMoveHandler);
    },
    false);


    this._canvas.addEventListener(
    "mousedown",
    e => {
      this._onMouseEventHandlerWrapper(e, this.onMouseDownHandler);
    },
    false);


    this._onRequestAnimationFrame();
  }

  _onMouseEventHandlerWrapper(e, callback) {
    let element = this._canvas;
    let offsetX = 0;
    let offsetY = 0;

    if (element.offsetParent) {
      do {
        offsetX += element.offsetLeft;
        offsetY += element.offsetTop;
      } while (element = element.offsetParent);
    }

    const x = e.pageX - offsetX;
    const y = e.pageY - offsetY;

    callback(x, y);
  }

  _onRequestAnimationFrame() {
    this._window.requestAnimationFrame(this._onRequestAnimationFrame);

    this._currentTime = new Date().getTime();
    this._deltaTime = this._currentTime - this._lastTime;

    if (this._deltaTime > this._interval) {

      //delta time in seconds
      const dts = this._deltaTime * 0.001;

      this._updateHandler(dts);

      this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._drawHandler(this._canvas, this._context, dts);

      this._lastTime = this._currentTime - this._deltaTime % this._interval;
    }
  }}

//each rope part is one of these
//uses a high precison varient of Störmer–Verlet integration
//to keep the simulation consistant otherwise it would "explode"!
class RopePoint {
  //integrates motion equations per node without taking into account relationship
  //with other nodes...
  static integrate(point, gravity, dt, previousFrameDt) {
    point.velocity = Vector2.sub(point.pos, point.oldPos);
    point.oldPos = { ...point.pos };

    //drastically improves stability
    let timeCorrection = previousFrameDt != 0.0 ? dt / previousFrameDt : 0.0;

    let accel = Vector2.add(gravity, { x: 0, y: point.mass });

    const velCoef = timeCorrection * point.damping;
    const accelCoef = Math.pow(dt, 2);

    point.pos.x += point.velocity.x * velCoef + accel.x * accelCoef;
    point.pos.y += point.velocity.y * velCoef + accel.y * accelCoef;
  }

  //apply constraints related to other nodes next to it
  //(keeps each node within distance)
  static constrain(point) {
    if (point.next) {
      const delta = Vector2.sub(point.next.pos, point.pos);
      const len = Vector2.mag(delta);
      const diff = len - point.distanceToNextPoint;
      const normal = Vector2.normalized(delta);

      if (!point.isFixed) {
        point.pos.x += normal.x * diff * 0.25;
        point.pos.y += normal.y * diff * 0.25;
      }

      if (!point.next.isFixed) {
        point.next.pos.x -= normal.x * diff * 0.25;
        point.next.pos.y -= normal.y * diff * 0.25;
      }
    }
    if (point.prev) {
      const delta = Vector2.sub(point.prev.pos, point.pos);
      const len = Vector2.mag(delta);
      const diff = len - point.distanceToNextPoint;
      const normal = Vector2.normalized(delta);

      if (!point.isFixed) {
        point.pos.x += normal.x * diff * 0.25;
        point.pos.y += normal.y * diff * 0.25;
      }

      if (!point.prev.isFixed) {
        point.prev.pos.x -= normal.x * diff * 0.25;
        point.prev.pos.y -= normal.y * diff * 0.25;
      }
    }
  }

  constructor(initialPos, distanceToNextPoint) {
    this.pos = initialPos;
    this.distanceToNextPoint = distanceToNextPoint;
    this.isFixed = false;
    this.oldPos = { ...initialPos };
    this.velocity = Vector2.zero();
    this.mass = 1.0;
    this.damping = 1.0;
    this.prev = null;
    this.next = null;
  }}


//manages a collection of rope points and executes
//the integration
class Rope {
  //generate an array of points suitable for a dynamic
  //rope contour
  static generate(start, end, resolution, mass, damping) {
    const delta = Vector2.sub(end, start);
    const len = Vector2.mag(delta);

    let points = [];
    const pointsLen = len / resolution;

    for (let i = 0; i < pointsLen; i++) {
      const percentage = i / (pointsLen - 1);

      const lerpX = Math.lerp(start.x, end.x, percentage);
      const lerpY = Math.lerp(start.y, end.y, percentage);

      points[i] = new RopePoint({ x: lerpX, y: lerpY }, resolution);
      points[i].mass = mass;
      points[i].damping = damping;
    }

    //Link nodes into a doubly linked list
    for (let i = 0; i < pointsLen; i++) {
      const prev = i != 0 ? points[i - 1] : null;
      const curr = points[i];
      const next = i != pointsLen - 1 ? points[i + 1] : null;

      curr.prev = prev;
      curr.next = next;
    }

    try{
      points[0].isFixed = points[points.length - 1].isFixed = true;
    }
    catch(e){
      console.log(e);
    }
    console.log(points)
    return points;
  }

  constructor(points, solverIterations) {
    this._points = points;
    this.update = this.update.bind(this);
    this._prevDelta = 0;
    this._solverIterations = solverIterations;

    this.getPoint = this.getPoint.bind(this);
  }

  getPoint(index) {
    return this._points[index];
  }

  update(gravity, dt) {
    for (let i = 1; i < this._points.length - 1; i++) {
      let point = this._points[i];

      let accel = { ...gravity };

      RopePoint.integrate(point, accel, dt, this._prevDelta);
    }

    for (let iteration = 0; iteration < this._solverIterations; iteration++)
    for (let i = 1; i < this._points.length - 1; i++) {
      let point = this._points[i];
      RopePoint.constrain(point);
    }

    this._prevDelta = dt;
  }}


//APP SETUP!

export interface Point{
  x:number,
  y:number
}
export interface Arguments {
  resolution?: number, //8
  mass?: number,
  damping?: number,
  gravity?: Point,
  solverIterations?: number,
  ropeColour?: string | CanvasGradient,
  ropeSize?: number ;
}

export function createRope(canvas:HTMLCanvasElement, context:CanvasRenderingContext2D, start:Point, end:Point, params?:Arguments){
 
  

  
  
  const args = {
      start: { x: 100, y: canvas.height / 2 },
      end: { x: canvas.width - 100, y: canvas.height / 2 },
      resolution: 8,
      mass: 0.88,
      damping: 0.95,
      gravity: { x: 0, y: 3000 },
      solverIterations: 500,
      ropeColour: "white",
      ropeSize: 4
  }
  if(typeof Args == 'object'){
    let keys:Array<string> = Array.from(Object.keys(params))
    for(let i=0; i<keys.length; i++){
      args[keys[i]] = params[keys[i]];
    }
  }
  args.start = start;
  args.end = end;

  const points = Rope.generate(
  args.start,
  args.end,
  args.resolution,
  args.mass,
  args.damping);


  let rope = new Rope(points, args.solverIterations);

  const tick = dt => {
    rope.update(args.gravity, dt);
  };

  const drawRopePoints = (context, points, colour, width) => {
    for (let i = 0; i < points.length; i++) {
      let p = points[i];
      if(i == 0){
        ctx.beginPath();
        ctx.arc(95, 50, 40, 0, 2 * Math.PI);
        ctx.stroke();
      }
      const prev = i > 0 ? points[i - 1] : null;

      if (prev) {
        context.beginPath();
        context.moveTo(prev.pos.x, prev.pos.y);
        context.lineTo(p.pos.x, p.pos.y);
        context.lineWidth = width;
        context.strokeStyle = colour;
        context.stroke();
      }
    }
  };

  //render a rope using the verlet points
  const draw = (canvas, context, dt) => {
    drawRopePoints(context, points, args.ropeColour, args.ropeSize);
  };

  function generateMouseMove(rope:Rope){
    const bigRope = rope
    const onMouseMove = (x, y) => {
      console.log(x,y);
      try{
        let point = rope.getPoint(0);
        point.pos.x = x;
        point.pos.y = y;
      }
      catch(e){
        console.log(e);
      }
    };
    return onMouseMove.bind(rope);
  }
  let point = rope.getPoint(0);
  point.pos.x = 42;
  point.pos.y = 310;
  //const app = new App(window, canvas, context, tick, draw, 60);

  
  return {canvas, context, update:tick, draw:draw, mouseHandler:generateMouseMove(rope)}
}