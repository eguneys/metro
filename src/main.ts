import Iksir, { Play, Quad } from 'iksir'
import sprites_png from '../assets/sprites.png'


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

  constructor(readonly ctx: Context) {
    this.init()
  }

  abstract init(): void;
  abstract update(dt: number): void;
  abstract draw(): void;

}

class AllMetro extends IMetro {

  init() {
  }

  update(dt: number) {
  }

  draw() {
    this.play.draw(this.q_dark, 0, 0, 0, 10, 10)
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


    metro.draw()
    play.flush()
  })
}
