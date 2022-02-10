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


  t_life!: number

  q_dark: Quad = Quad.make(this.a, 0, 0, 1, 1)
  q_red: Quad = Quad.make(this.a, 4, 0, 1, 1)
  q_tile: Quad = Quad.make(this.a, 0, 16, 4, 4)
  q_player: Quad = Quad.make(this.a, 16, 16, 12, 20)

  constructor(readonly ctx: Context) {}

  init(...args: any[]): this {
    
    this.t_life = 0

    this._init(...args)
    return this
  }

  update(dt: number, dt0: number) {
    this.t_life += dt
    this._update(dt, dt0)
  }
  
  draw() {
    this._draw()
  }

  abstract _init(...args: any[]): void;
  abstract _update(dt: number, dt0: number): void;
  abstract _draw(): void;


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

    this.quads = [0, 1, 2, 3, 4, 5, 6, 7].map((_, i) =>
      Quad.make(image, f_x + i * f_w, f_y, f_w, f_h))

    this.frame = 0
  }


  draw(play: Play, x: number, y: number, facing_x: number = 1) {
    x = Math.floor(x)
    y = Math.floor(y)
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
  return a * (1-t) + b * t
}

class GridBuilder {

  get w() {
    return this.grid.width
  }

  get hw() {
    return Math.floor(this.w / 2)
  }

  get qw() {
    return Math.floor(this.w / 4)
  }


  get h() {
    return this.grid.height
  }

  get hh() {
    return Math.floor(this.h / 2)
  }

  get bottom() {
    return this.h - 2
  }

  get _short() {
    return 4
  }


  constructor(readonly grid: Grid) {}

  init() {

    this.floor(0, this.bottom, this.w)

    this.box(this.qw, this.bottom - 4, 4)
    this.box(this.qw + 4, this.bottom - 2, 2)

    this.stairs(this.hw, this.bottom - 1, 16)
    
    this.floor(0, this.bottom - 16, this.hw)
    this.floor(0, this.bottom - 19, this.hw - 10)

    return this
  }

  _line(x: number, y: number, length: number) {
    for (let i = 0; i < length; i++) {
      this.grid.set(x + i, y, true)
    }
  }

  stairs(x: number, y: number, steps: number, facing: number = 1) {
    for (let i = 0; i < steps; i++) {
      this._line(x + 2 * i * facing, y - i, 4)
    }
  }

  floor(x: number, y: number, length: number) {
    this._line(x, y, length)
    this._line(x, y+1, length)
  }

  box(x: number, y: number, size: number) {
    for (let i = 0; i < size; i++) {
      this._line(x, y + i, size)
    }
  }

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

  ialign_y_time: number
  ialign_y: number
  moving_y0: boolean
  
  ialign_x: number
  moving_x0: boolean

  moving0: boolean

  get moving_y(): boolean { 
    let { body, size } = this

    return Math.abs(body.y - body.y0) > size * 0.01
  }

  get desired_y(): number {

    let { moving_y, body, size } = this

    return moving_y ? body.y : Math.round(body.y / size) * size
  }


  get moving_x(): boolean { 
    let { body, size } = this

    return Math.abs(body.x - body.x0) > size * 0.01
  }

  get moving(): boolean {
    return this.moving_x || this.moving_y
  }

  get desired_x(): number {

    let { moving, body, size } = this
    return moving ? body.x : Math.round(body.x / size) * size
  }

  constructor(readonly body: Body,
    readonly size: number) {
    this.x = this.desired_x
    this.y = this.desired_y

    this.moving0 = this.moving

    this.moving_x0 = this.moving_x
    this.ialign_x = 0

    this.moving_y0 = this.moving_y
    this.ialign_y = 0
    this.ialign_y_time = ticks.five
  }

  force_smooth_y(time: number = ticks.five) {
    this.ialign_y_time = time
    this.ialign_y = this.ialign_y_time
  }

  update(dt: number, dt0: number) {

    if (this.ialign_x === 0) {
      if (this.moving0 === this.moving) {
        this.x = this.desired_x
      } else {
        this.ialign_x = ticks.five
      }
    }

    if (this.ialign_x > 0) {
      this.x = lerp(this.x, this.desired_x, 1.0 - this.ialign_x / ticks.five)
      this.ialign_x = appr(this.ialign_x, 0, dt)
    }


    if (this.ialign_y === 0) {
      if (this.moving0 === this.moving) {
        this.y = this.desired_y
      } else {
        this.ialign_y_time = ticks.five
        this.ialign_y = this.ialign_y_time
      }
    }

    if (this.ialign_y > 0) {
      this.y = lerp(this.y, this.desired_y, 1.0 - this.ialign_y / this.ialign_y_time)
      this.ialign_y = appr(this.ialign_y, 0, dt)
    }

    this.moving0 = this.moving
  }
}

type HasFacing = {
  facing: number
}

class Facing {


  get facing(): number {
    return this.has_facing.facing
  }

  get front(): Sensor {
    return this.facing < 0 ? this.left : this.right
  }

  get back(): Sensor {
    return this.facing < 0 ? this.right : this.left
  }

  get a_front(): number {
    return this.facing < 0 ? this.left.left : this.right.right
  }

  get a_back(): number {
    return this.facing < 0 ? this.right.right : this.left.left
  }

  constructor(readonly has_facing: HasFacing, 
    readonly left: Sensor,
    readonly right: Sensor) {}

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


  get left_extend() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x - i, y)
      if (tile) {
        return i
      }
    }
    return size 
  }

  get left_regress() {
    let { x, y, size } = this

    for (let i = 1; i < size; i++) {
      let tile = this.grid.get_world(x + i, y)
      if (!tile) {
        return 1-i
      }
    }
    return -size 
  }

  get left() {
    let { x, y } = this
    let tile = this.grid.get_world(x, y)
    if (!tile) {
      return this.left_extend
    }
    return this.left_regress
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

class Player extends IMetro {


  anim!: Anim
  anim_arms!: Anim


  gravity!: Vec2
  body!: Body
  align!: BodyAlign
  grid!: Grid

  builder!: GridBuilder

  sensor_up!: Sensor
  sensor_down!: Sensor
  sensor_left_right!: Facing

  sensor_up_hung!: Facing
  sensor_up_hung_pre!: Facing


  sensor_hl!: Facing
  sensor_hlo!: Facing

  facing_x!: number
  get facing(): number { return this.facing_x }


  _init() {

    this.anim = new Anim(this.a, 0, 48, 12, 20)
    this.anim_arms = new Anim(this.a, 64, 48, 12, 20)

    this.gravity = vec(0, 0.001)

    this.grid = new Grid(80, 45, 4)

    this.builder = new GridBuilder(this.grid).init()

    this.body = body_make({y0: 30 * 4, y: 30 * 4, air_friction: 0.8})

    this.align = new BodyAlign(this.body, 4)

    this.sensor_up = new Sensor(this.grid, this.body, 6, 0)
    this.sensor_down = new Sensor(this.grid, this.body, 6, 20)

    this.sensor_left_right = new Facing(this,
      new Sensor(this.grid, this.body, 0, 10),
      new Sensor(this.grid, this.body, 12, 10))

    this.sensor_up_hung = new Facing(this,
      new Sensor(this.grid, this.body, 2, -8),
      new Sensor(this.grid, this.body, 10, -8))

    this.sensor_up_hung_pre = new Facing(this,
      new Sensor(this.grid, this.align, 1, -12),
      new Sensor(this.grid, this.align, 11, -12))

    this.sensor_hl = new Facing(this,
      new Sensor(this.grid, this.align, 3, 20),
      new Sensor(this.grid, this.align, 9, 20))

    this.sensor_hlo = new Facing(this,
      new Sensor(this.grid, this.align, 0, 20),
      new Sensor(this.grid, this.align, 12, 20))

  }

  max_v: number = 0
  t_jump: number = 0

  t_ledge_up0: number = 0
  t_ledge_up: number = 0

  _update(dt: number, dt0: number) {

    let { body, align, gravity } = this


    if (this.input.btn('x') > 0) {
      body.t_scale = 0.3
    } else {
      body.t_scale = 1
    }

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

    let t_max = ticks.lengths

    if (this.sensor_down.down === 0) {
      if (this.t_jump === 0 && i_y > 0) {
        this.t_jump = t_max
      }
    }

    if (this.t_jump > 0) {
      body.force.y -= i_y * 0.02 * (this.t_jump / t_max) * (1 - this.t_jump / t_max)

      this.t_jump = appr(this.t_jump, 0, dt * body.t_scale * body.t_scale)
    }

    body.force.x += i_x * 0.001

    if (Math.abs(body.vx) > 4 * 0.125) {
      if (this.t_life % ticks.lengths < ticks.three) {
        body.force.y -= gravity.y *1.2 
      }
    }

    if (this.sensor_down.down > 0) {
      body.force.x += gravity.x
      if (body.vy > 0) {
        body.force.y += gravity.y * 3
      } else {
        body.force.y += gravity.y
      }
    }


    if (this.sensor_up_hung.front.down < 8 &&
      this.sensor_up_hung.back.down === 16) {
      body.y += this.sensor_up_hung.front.down
      body.y0 = body.y
      body.force.y = 0
      body.force.x = 0
      body.x0 = body.x

      if (this.t_ledge_up0 === 0) {
        this.t_ledge_up0 = ticks.lengths
      }
    }


    body_update(body, dt, dt0)
    
    body.force.x = 0
    body.force.y = 0

    if (this.t_ledge_up0 > 0) {
      this.t_ledge_up0 = appr(this.t_ledge_up0, 0, dt)

      if (this.t_ledge_up0 === 0) {
        body.y -= 8 + 20 
        body.y0 = body.y
        body.x += this.facing * 4
        body.x0 = body.x
        this.align.force_smooth_y(ticks.half)
        this.t_ledge_up = ticks.half
      }
    }


    if (this.t_ledge_up > 0) {
      this.t_ledge_up = appr(this.t_ledge_up, 0, dt)

    }

    if (this.sensor_left_right.a_front < 0) {
      body.x += this.facing * this.sensor_left_right.a_front
      body.x0 = body.x
      //this.align.force_smooth_x()
    }

    if (this.sensor_up.up < 0) {
      body.y -= this.sensor_up.up
      body.y0 = body.y
      this.align.force_smooth_y()
    }

    if (this.sensor_down.down < 0) {
      body.y += this.sensor_down.down
      body.y0 = body.y
      this.align.force_smooth_y()
    }


    if (body.x <= 0) {
      body.x = 0
      body.x0 = 0
    }

    if (body.x >= 320 - 12) {
      body.x = 320 - 12
      body.x0 = 320 - 12
    }

    this.align.update(dt, dt0)

    let { front: hung_pre_front } = this.sensor_up_hung_pre

    if (hung_pre_front.down < 0) {
      this.anim_arms.frame = 1
    } else if (hung_pre_front.down < 4) {
      this.anim_arms.frame = 2
    } else if (hung_pre_front.down < 6) {
      this.anim_arms.frame = 3
    } else if (hung_pre_front.down < 12) {
      this.anim_arms.frame = 4
    } else if (this.t_ledge_up > ticks.lengths) {
      this.anim_arms.frame = 5
    } else {
      this.anim_arms.frame = 0 
    }

    let sensor_f = this.sensor_hl.front,
      sensor_fo = this.sensor_hlo.front,
      sensor_b = this.sensor_hl.back,
      sensor_bo = this.sensor_hlo.back

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

  _draw() {
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

    let arms_off_y = 0
    if (this.anim_arms.frame === 3) {
      arms_off_y = -8
    } else if (this.anim_arms.frame === 2) {
      arms_off_y = -4
    } else if (this.anim_arms.frame === 4) {
      arms_off_y = -12
    } else if (this.anim_arms.frame === 5) {
      arms_off_y = -6 + 8 * (this.t_ledge_up/ticks.half) *  (1.0 - this.t_ledge_up / ticks.half)
    }

    this.anim_arms.draw(this.play, x, y + arms_off_y, this.facing_x)

    this.sensor_draw_up(this.sensor_up)
    //this.sensor_draw_down(this.sensor_up_hung_pre.front)
    //this.sensor_draw_down(this.sensor_up_hung_pre.back)
    //this.sensor_draw_right(this.sensor_left_right.front)
  }


  sensor_draw_right(sensor: Sensor) {
    let { right } = sensor


    if (right < 0) {
      this.play.draw(this.q_red, sensor.x + right, sensor.y, 0, -right, 1)
    } else {
      this.play.draw(this.q_red, sensor.x - 2, sensor.y, 0, right + 2, 1)
    }
  }

  sensor_draw_down(sensor: Sensor) {
    let { down } = sensor

    if (down < 0) {
      this.play.draw(this.q_red, sensor.x, sensor.y + down, 0, 1, -down)
    } else {
      this.play.draw(this.q_red, sensor.x, sensor.y - 2, 0, 1, down + 2)
    }
  }

  sensor_draw_up(sensor: Sensor) {
    let { up } = sensor

    if (up < 0) {
      this.play.draw(this.q_red, sensor.x, sensor.y + up, 0, 1, -up)
    } else {
      this.play.draw(this.q_red, sensor.x, sensor.y - up - 2, 0, 1, up + 2)
    }
  }
}

abstract class GMetro extends IMetro {

  constructor(ctx: Context, readonly group: Array<GMetro>) {
    super(ctx)
  }

  init(...args: any[]) {
    super.init(...args)
    this.group.push(this)
    return this
  }

  remove() {
    this.group.splice(this.group.indexOf(this), 1)
  }
}

class Bullet extends GMetro {

  anim!: Anim
  body!: Body

  _init(x: number, y: number) {

    this.anim = new Anim(this.a, 32, 0, 4, 4)

    this.body = body_make({ x0: x, y0: y, x, y, mass: 0.5 })
  }

  _update(dt: number, dt0: number) {
    if (this.t_life > ticks.seconds) {
      this.remove()
      return 
    }

    this.body.force.x = (1 - (this.t_life / ticks.seconds)) * 0.035 * 0.5
    this.body.force.y = (this.t_life/ ticks.seconds) * 0.0005 * 0.5

    body_update(this.body, dt, dt0)


    this.anim.frame = Math.floor((this.t_life % ticks.sixth /  ticks.sixth) * 2) % 2
  }

  _draw() {
    let { x, y } = this.body
    this.anim.draw(this.play, x, y)
  }

}

class AllMetro extends IMetro {

  bullets!: Array<Bullet>
  player!: Player

  _init() {
    this.player = new Player(this.ctx).init()

    this.bullets = []
  }

  _update(dt: number, dt0: number) {

    if (this.t_life % ticks.sixth <= dt) {
      //new Bullet(this.ctx, this.bullets).init(0, Math.random() * 180)
    }

    this.player.update(dt, dt0)

    this.bullets.forEach(_ => _.update(dt, dt0))
  }


  _draw() {
    this.player.draw()
    this.bullets.forEach(_ => _.draw())
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

    let metro = new AllMetro(ctx).init()

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

      if (input.btn('e') > 0) {
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
