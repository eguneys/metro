export type Vec2 = {
  x: number,
  y: number
}

const v_zero = () => vec(0, 0)
const v_unit = () => vec(1, 1)

export function vec(x: number, y: number) {
  return { x, y }
}

export function v_scale(v: Vec2, k: number) {
  return vec(v.x * k, v.y * k)
}

export type Body = {
  force: Vec2,
  mass: number,
  air_friction: number,
  t_scale: number,
  t_scale0: number,
  x: number,
  y: number,
  x0: number,
  y0: number,
  vx: number,
  vy: number
}

const defaults_body = {
  force: v_zero(),
  mass: 1,
  air_friction: 0.1,
  x: 0,
  y: 0,
  x0: 0,
  y0: 0,
  vx: 0,
  vy: 0,
  t_scale: 1,
  t_scale0: 1
}

export function body_make(opts: Partial<Body>): Body {
  return merge(defaults_body, opts)
}

function merge(base: any, extend: any) {
  for (let key in base) {
    if (!extend[key]) {
      if (typeof base[key] === 'object') {
        extend[key] = merge(base[key], {})
      } else {
        extend[key] = base[key]
      }
    }
  }
  return extend
}


/* Verlet https://stackoverflow.com/a/28061393/3994249 */
export function body_update(body: Body, dt: number, dt0: number) {

  let { force, mass } = body

  let a = v_scale(force, 1/mass)

  let { x, x0, y, y0 } = body

  let { air_friction } = body

  let { t_scale, t_scale0 } = body

  dt *= t_scale
  dt0 *= t_scale0

  let v0_x = x - x0,
    v0_y = y - y0

  let new_vx = v0_x * air_friction * dt / dt0 + a.x * dt * (dt + dt0) / 2,
    new_vy = v0_y * air_friction * dt / dt0 + a.y * dt * (dt + dt0) / 2

 body.t_scale0 = body.t_scale 

  let new_x0 = x,
    new_y0 = y,
    new_x = x + new_vx,
    new_y = y + new_vy


  body.x0 = new_x0
  body.y0 = new_y0
  body.x = new_x
  body.y = new_y
  body.vx = new_vx
  body.vy = new_vy
}
