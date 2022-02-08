import Iksir, { Play, Quad } from 'iksir'
import sprites_png from '../assets/sprites.png'

import Input from './input'
import { ticks } from './shared'

import { Body, body_make, body_update } from './rigid'
import { Vec2, vec } from './rigid'

import * as asdf from './curves'
function load_image(path: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    let res = new Image()
    res.onload = () => resolve(res)
    res.src = path
  })
}

type Context = {
  play: Play,
  input: Input,
  image: HTMLImageElement
}

abstract class IMetro {

  get play(): Play { return this.ctx.play }
  get a(): HTMLImageElement { return this.ctx.image }
  get input(): Input { return this.ctx.input }


  q_dark: Quad = Quad.make(this.a, 0, 0, 1, 1)
  q_red: Quad = Quad.make(this.a, 4, 0, 1, 1)
  q_tile: Quad = Quad.make(this.a, 0, 16, 4, 4)
  q_player: Quad = Quad.make(this.a, 16, 16, 12, 20)

  constructor(readonly ctx: Context) {
    this.init()
  }

  abstract init(): void;
  abstract update(dt: number, dt0: number): void;
  abstract draw(): void;

}

function appr(value: number, target: number, by: number) {
  if (value < target) {
    return Math.min(value + by, target)
  } else {
    return Math.max(value - by, target)
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

class Grid {
  data: Array<boolean>

  constructor(readonly width: number,
    readonly height: number,
    readonly cell_size: number) {

    this.data = Array(width * height)
  }


  get(ix: number, iy: number) {
    return this.data[iy * this.width + ix] || false
  }

  set(ix: number, iy: number, value: boolean) {
    this.data[iy * this.width + ix] = value
  }

  get_world(wx: number, wy: number) {
    let ix = Math.floor(wx / this.cell_size),
      iy = Math.floor(wy / this.cell_size)
    return this.get(ix, iy)
  }
}

class BodyAlign {

  x: number
  y: number

  ialign_y: number
  moving_y0: boolean
  
  ialign_x: number
  moving_x0: boolean




  get target_y(): number {
    let { size, body } = this

    return Math.round(body.y / size) * size
  }

  get moving_y(): boolean { 
    let { body, size } = this

    return Math.abs(body.y - body.y0) > size * 0.01
  }

  get desired_y(): number {

    let { moving_y, body, size } = this

    return moving_y ? body.y : (body.vy < 0 ? Math.round(body.y / size) : Math.round(body.y / size)) * size
  }



  get target_x(): number {
    let { size, body } = this

    return Math.round(body.x / size) * size
  }

  get moving_x(): boolean { 
    let { body, size } = this

    return Math.abs(body.x - body.x0) > size * 0.01
  }

  get desired_x(): number {

    let { moving_x, body, size } = this

    return moving_x ? body.x : (body.vx < 0 ? Math.round(body.x / size) : Math.round(body.x / size)) * size
  }

  constructor(readonly body: Body,
    readonly size: number) {
    this.x = this.desired_x
    this.y = this.desired_y

    this.moving_x0 = this.moving_x
    this.ialign_x = 0

    this.moving_y0 = this.moving_y
    this.ialign_y = 0
  }

  force_smooth_y() {
    this.ialign_y = ticks.five
  }

  update(dt: number, dt0: number) {
    if (this.ialign_x === 0) {
      if (this.moving_x0 === this.moving_x) {
        this.x = this.desired_x
      } else {
        this.ialign_x = ticks.five
      }
    } else {
    }

    if (this.ialign_x > 0) {
      this.x = lerp(this.x, this.desired_x, 1.0 - this.ialign_x / ticks.five)
    }

    this.ialign_x = appr(this.ialign_x, 0, dt)

    this.moving_x0 = this.moving_x

    if (this.ialign_y === 0) {
      if (this.moving_y0 === this.moving_y) {
        this.y = this.desired_y
      } else {
        this.ialign_y = ticks.five
      }
    } else {
    }

    if (this.ialign_y > 0) {
      this.y = lerp(this.y, this.desired_y, 1.0 - this.ialign_y / ticks.five)
    }

    this.ialign_y = appr(this.ialign_y, 0, dt)

    this.moving_y0 = this.moving_y


  }
} 

class Sensor {

  get size() {
    return this.grid.cell_size * 4
  }

  get x() {
    return Math.floor(this.body.x + this.ox)
  }

  get y() {
    return Math.floor(this.body.y + this.oy)
  }

  get down_extend() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x, y + i)
      if (tile) {
        return i
      }
    }
    return size 
  }

  get down_regress() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x, y - i)
      if (!tile) {
        return 1-i
      }
    }
    return -size 
  }

  get down() {
    let { x, y } = this
    let tile = this.grid.get_world(x, y)
    if (!tile) {
      return this.down_extend
    }
    return this.down_regress
  }


  constructor(readonly grid: Grid,
    readonly body: Vec2,
    readonly ox: number,
    readonly oy: number) {}
}

class AllMetro extends IMetro {

  elapsed!: number

  gravity!: Vec2
  body!: Body
  align!: BodyAlign
  grid!: Grid

  sensor!: Sensor

  init() {

    this.elapsed = 0

    this.gravity = vec(0, 0.001)

    this.grid = new Grid(320, 180, 4)


    for (let i = 0; i < 80; i++) {
      this.grid.set(i, 41, true)
      this.grid.set(i+40, 40, true)
      this.grid.set(i+42, 39, true)
      this.grid.set(i+44, 38, true)

      this.grid.set(i+60, 37, true)
      this.grid.set(i+60, 36, true)

      this.grid.set(i+66, 35, true)
      this.grid.set(i+66, 34, true)
      this.grid.set(i+66, 33, true)
    }

    this.body = body_make({air_friction: 0.8})

    this.align = new BodyAlign(this.body, 4)

    this.sensor = new Sensor(this.grid, this.body, 4, 20)

  }

  update(dt: number, dt0: number) {

    this.elapsed += dt

    let { body, align, gravity } = this

    let i_x = 0
    if (this.input.btn('right') !== 0) {
      i_x = 1
    } else if (this.input.btn('left') !== 0) {
      i_x = -1
    }

    body.force.x += i_x * 0.001

    if (this.sensor.down > 0) {
      body.force.x += gravity.x
      body.force.y += gravity.y
      if (this.sensor.down < 4) {
        //this.align.force_smooth_y()
      }
    }

    body_update(body, dt, dt0)
    
    body.force.x = 0
    body.force.y = 0

    if (this.sensor.down < 0) {
      body.y += this.sensor.down
      body.y0 = body.y
      this.align.force_smooth_y()
    }

    this.align.update(dt, dt0)
  }

  draw() {
    this.play.draw(this.q_dark, 0, 80, 0, 10, 2)

    for (let i = 0; i < this.grid.height; i++) {
      for (let j = 0; j < this.grid.width; j++) {
        let tile = this.grid.get(j, i)
        if (tile) {
          this.play.draw(this.q_tile, j*4, i*4, 0, 1, 1)
        }
      }
    }

    let { x, y } = this.align

    this.play.draw(this.q_player, x, y, 0, 1, 1)

    let { down } = this.sensor

    if (down < 0) {
      this.play.draw(this.q_red, this.sensor.x, this.sensor.y + down, 0, 1, -down)
    } else {
      this.play.draw(this.q_red, this.sensor.x, this.sensor.y, 0, 1, down)
    }
  }
}



export default function app(element: HTMLElement) {
  let input: Input = new Input()
  let play = Iksir(element)

  load_image(sprites_png).then((image: HTMLImageElement) => {

    play.glOnce(image)

    let ctx: Context = {
      input,
      play,
      image
    }

    let metro = new AllMetro(ctx)

    let fixed_dt = 1000/60
    let timestamp0: number | undefined,
      min_dt = fixed_dt,
      max_dt = fixed_dt * 2,
      dt0 = fixed_dt

    function step(timestamp: number) {

      let dt = timestamp0 ? timestamp - timestamp0 : fixed_dt


      dt = Math.max(min_dt, dt)
      dt = Math.min(max_dt, dt)

      input.update(dt, dt0)
      metro.update(dt, dt0)
      metro.draw()
      play.flush()
      dt0 = dt 
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}
