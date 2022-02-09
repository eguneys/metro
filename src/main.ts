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

class Anim {

  quads: Array<Quad>;

  frame: number 

  get quad(): Quad {
    return this.quads[this.frame]
  }

  constructor(readonly image: HTMLImageElement,
    readonly f_x: number,
    readonly f_y: number, 
    readonly f_w: number,
    readonly f_h: number) {

    this.quads = [0, 1, 2, 3, 4, 5].map((_, i) =>
      Quad.make(image, f_x + i * f_w, f_y, f_w, f_h))

    this.frame = 0
  }


  draw(play: Play, x: number, y: number, facing_x: number) {
    play.draw(this.quad, x + (facing_x < 0 ? this.f_w : 0), y, 0, facing_x)
  }

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


  get right_extend() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x + i, y)
      if (tile) {
        return i
      }
    }
    return size 
  }

  get right_regress() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x - i, y)
      if (!tile) {
        return 1-i
      }
    }
    return -size 
  }

  get right() {
    let { x, y } = this
    let tile = this.grid.get_world(x, y)
    if (!tile) {
      return this.right_extend
    }
    return this.right_regress
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


  get up_extend() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x, y - i)
      if (tile) {
        return i
      }
    }
    return size 
  }

  get up_regress() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x, y + i)
      if (!tile) {
        return 1-i
      }
    }
    return -size 
  }

  get up() {
    let { x, y } = this
    let tile = this.grid.get_world(x, y)
    if (!tile) {
      return this.up_extend
    }
    return this.up_regress
  }


  constructor(readonly grid: Grid,
    readonly body: Vec2,
    readonly ox: number,
    readonly oy: number) {}
}

class AllMetro extends IMetro {


  anim!: Anim


  elapsed!: number

  gravity!: Vec2
  body!: Body
  align!: BodyAlign
  grid!: Grid

  sensor!: Sensor
  sensor_right!: Sensor
  sensor_up!: Sensor

  sensor_l!: Sensor
  sensor_lo!: Sensor
  sensor_h!: Sensor
  sensor_ho!: Sensor


  facing_x!: number

  get sensor_f(): Sensor {
    return this.facing_x < 0 ? this.sensor_h: this.sensor_l
  }

  get sensor_fo(): Sensor {
    return this.facing_x < 0 ? this.sensor_ho : this.sensor_lo
  }

  get sensor_b(): Sensor {
    return this.facing_x < 0 ? this.sensor_l : this.sensor_h
  }

  get sensor_bo(): Sensor {
    return this.facing_x < 0 ? this.sensor_lo : this.sensor_ho
  }

  init() {

    this.anim = new Anim(this.a, 0, 48, 12, 20)

    this.elapsed = 0

    this.gravity = vec(0, 0.001)

    this.grid = new Grid(320, 180, 4)


    for (let i = 0; i < 80; i++) {
      this.grid.set(i, 42, true)
      this.grid.set(i, 41, true)
      this.grid.set(i+40, 40, true)
      this.grid.set(i+42, 39, true)
      this.grid.set(i+44, 38, true)

      this.grid.set(i+60, 30, true)
      this.grid.set(i+60, 29, true)

      this.grid.set(i+66, 28, true)
      this.grid.set(i+66, 27, true)
      this.grid.set(i+66, 26, true)

      if (i < 10) {
        this.grid.set(i, 38, true)
        this.grid.set(i + 2, 39, true)
        this.grid.set(i + 4, 40, true)


        this.grid.set(54, 31+i, true)
        this.grid.set(i+54, 31, true)
      }


      this.grid.set(i, 10, true)
      this.grid.set(i, 9, true)
      this.grid.set(i, 13, true)
      this.grid.set(i, 14, true)
    }

    for (let i = 0; i < 4; i++) {
      this.grid.set(6 + i, 30, true)
    }

    this.body = body_make({y0: 30 * 4, y: 30 * 4, air_friction: 0.8})

    this.align = new BodyAlign(this.body, 4)

    this.sensor = new Sensor(this.grid, this.body, 6, 20)
    this.sensor_right = new Sensor(this.grid, this.body, 12, 10)
    this.sensor_up = new Sensor(this.grid, this.body, 6, 0)

    this.sensor_l = new Sensor(this.grid, this.align, 9, 20)
    this.sensor_lo = new Sensor(this.grid, this.align, 12, 20)

    this.sensor_h = new Sensor(this.grid, this.align, 3, 20)
    this.sensor_ho = new Sensor(this.grid, this.align, 0, 20)



  }

  max_v: number = 0
  t_jump: number = 0

  update(dt: number, dt0: number) {

    this.elapsed += dt

    let { body, align, gravity } = this

    let i_x = 0
    let { left, right } = this.input
    if (left > 0 && right > 0) {
      i_x = left < right ? -1 : 1
    } else if (right !== 0) {
      i_x = 1
      this.facing_x = 1
    } else if (left !== 0) {
      i_x = -1
      this.facing_x = -1
    }


    let i_y = 0
    if (this.input.btn('c') !== 0) {
      i_y = 1
    }

    if (this.sensor.down === 0) {
      if (this.t_jump === 0 && i_y > 0) {
        this.t_jump = ticks.lengths
      }
    }

    if (this.t_jump > 0) {
      body.force.y -= i_y * 0.02 * (this.t_jump / ticks.lengths) * (1 - this.t_jump / ticks.lengths)
    }

    this.t_jump = appr(this.t_jump, 0, dt)


    if (this.sensor_right.right > 0) {
      body.force.x += i_x * 0.001
    } else {
      if (i_x < 0) {
        body.force.x += i_x * 0.001
      }
    }

    if (this.sensor.down > 0) {
      body.force.x += gravity.x
      if (body.vy > 0) {
        body.force.y += gravity.y * 3
      } else {
        body.force.y += gravity.y
      }
    }

    let before = this.sensor_up.up
    body_update(body, dt, dt0)
    
    body.force.x = 0
    body.force.y = 0

    if (this.sensor_right.right < 0) {
      body.x += this.sensor_right.right
      body.x0 = body.x
      //this.align.force_smooth_x()
    }

    if (this.sensor_up.up < 0) {
      body.y -= this.sensor_up.up
      body.y0 = body.y
      this.align.force_smooth_y()
    }

    if (this.sensor.down < 0) {
      body.y += this.sensor.down
      body.y0 = body.y
      this.align.force_smooth_y()
    }

    this.align.update(dt, dt0)

    let { sensor_f, sensor_fo, sensor_bo, sensor_b } = this

    if (sensor_f.down > 0 && sensor_bo.down === 0) {
      this.anim.frame = 3
    } else if (sensor_f.down === 0 && sensor_bo.down < 0) {
      this.anim.frame = 4
    } else if (sensor_f.down > 0 && sensor_bo.down < 0) {
      this.anim.frame = 4
    } else if (sensor_f.down < 0 && sensor_fo.down < 0) {
      this.anim.frame = 2
    } else if (sensor_bo.down > 0) {
      this.anim.frame = 1
    } else {
      this.anim.frame = 0
    }
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

    //this.play.draw(this.q_player, x, y)
    this.anim.draw(this.play, x, y, this.facing_x)


    let { up } = this.sensor_up

    if (up < 0) {
      this.play.draw(this.q_red, this.sensor_up.x, this.sensor_up.y + up, 0, 1, -up)
    } else {
      this.play.draw(this.q_red, this.sensor_up.x, this.sensor_up.y - up - 2, 0, 1, up + 2)
    }


    let { down } = this.sensor

    if (down < 0) {
      this.play.draw(this.q_red, this.sensor.x, this.sensor.y + down, 0, 1, -down)
    } else {
      this.play.draw(this.q_red, this.sensor.x, this.sensor.y - 2, 0, 1, down + 2)
    }

    let { right } = this.sensor_right


    if (right < 0) {
      this.play.draw(this.q_red, this.sensor_right.x + right, this.sensor_right.y, 0, -right, 1)
    } else {
      this.play.draw(this.q_red, this.sensor_right.x - 2, this.sensor_right.y, 0, right + 2, 1)
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

    let elapsed = 0
    function step(timestamp: number) {

      let dt = timestamp0 ? timestamp - timestamp0 : fixed_dt

      dt = Math.max(min_dt, dt)
      dt = Math.min(max_dt, dt)

      input.update(dt, dt0)

      if (input.btn('z') > 0) {
        metro.init()
      }

      if (input.btn('x') > 0) {
        if (elapsed++ % 24 === 0) {
          metro.update(dt, dt0)
        }
      } else {
        metro.update(dt, dt0)
      }
      metro.draw()
      play.flush()
      dt0 = dt 
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}
