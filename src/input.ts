import { ticks } from './shared'

export default class Input {


  get left() {
    return this.btn('left')
  }

  get right() {
    return this.btn('right')
  }


  _btn = new Map()

  private press = (key: string) => {
    if (!this._btn.has(key) || this._btn.get(key) === 0) {
      this._btn.set(key, ticks.one)
    }
  }


  private release = (key: string) => {
    this._btn.set(key, -ticks.three)
  }

  btn = (key: string) => {
    return this._btn.get(key) || 0
  }

  update = (dt: number, dt0: number) => {
    for (let [key, t] of this._btn) {
      let sign = Math.sign(t)
      if (t !== 0) {
        t += dt
        if (Math.sign(t) !== sign) {
          t = 0
        }
      }
      this._btn.set(key, t)
    }
  }


  constructor() {

    let { press, release } = this

    document.addEventListener('keydown', e => {
      switch(e.key) {
        case 'ArrowUp':
          press('up');
          break;
        case 'ArrowDown':
          press('down');
          break;
        case 'ArrowLeft':
          press('left');
          break;
        case 'ArrowRight':
          press('right');
          break;
        case 'x':
          press('x');
          break;
        case 'c':
          press('c');
          break;
        case 'z':
          press('z')
          break;
        case 'e':
          press('e')
          break;
      }
    });

    document.addEventListener('keyup', e => {
      switch(e.key) {
        case 'ArrowUp':
          release('up');
          break;
        case 'ArrowDown':
          release('down');
          break;
        case 'ArrowLeft':
          release('left');
          break;
        case 'ArrowRight':
          release('right');
          break;
        case 'c':
          release('c');
          break;
        case 'x':
          release('x');
          break;      
        case 'z':
          release('z');
          break;
        case 'e':
          release('e')
          break
      }
    });
  }
}
