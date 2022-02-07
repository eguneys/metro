import Iksir, { Play, Quad } from 'iksir'
import sprites_png from '../assets/sprites.png'

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
  image: HTMLImageElement
}

abstract class IMetro {

  get play(): Play { return this.ctx.play }
  get a(): HTMLImageElement { return this.ctx.image }


  q_dark: Quad = Quad.make(this.a, 0, 0, 1, 1)
  q_red: Quad = Quad.make(this.a, 4, 0, 1, 1)
  q_tile: Quad = Quad.make(this.a, 0, 16, 8, 8)
  q_player: Quad = Quad.make(this.a, 16, 16, 24, 40)

  constructor(readonly ctx: Context) {
    this.init()
  }

  abstract init(): void;
  abstract update(dt: number, dt0: number): void;
  abstract draw(): void;

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

class AllMetro extends IMetro {

  gravity!: Vec2
  body!: Body
  grid!: Grid

  init() {

    this.gravity = vec(0, 0.001)

    this.grid = new Grid(320, 180, 8)


    for (let i = 0; i < 40; i++) {
      this.grid.set(i, 21, true)
    }


    this.body = body_make({air_friction: 0.04})


  }

  elapsed = 0

  update(dt: number, dt0: number) {

    this.elapsed += dt

    let { body, gravity } = this

    body.force.x += gravity.x
    body.force.y += gravity.y

    body_update(body, dt, dt0)
    
    body.force.x = 0
    body.force.y = 0

    body.y %= 500
    body.y0 %= 500
  }

  draw() {
    this.play.draw(this.q_dark, 0, 80, 0, 10, 2)

    for (let i = 0; i < this.grid.height; i++) {
      for (let j = 0; j < this.grid.width; j++) {
        let tile = this.grid.get(j, i)
        if (tile) {
          this.play.draw(this.q_tile, j*8, i*8, 0, 1, 1)
        }
      }
    }

    let { x, y, vy } = this.body

    this.play.draw(this.q_player, x, y, 0, 1, 1)

  }
}



export default function app(element: HTMLElement) {
  let play = Iksir(element)

  load_image(sprites_png).then((image: HTMLImageElement) => {

    play.glOnce(image)

    let ctx = {
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

      metro.update(dt, dt0)
      metro.draw()
      play.flush()
      dt0 = dt 
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}
