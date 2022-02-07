export type Vec2 = {
  x: number,
  y: number
}
const v_unit = vec(1, 1)

export function vec(x: number, y: number) {
  return { x, y }
}

export function vec_distance(v1: Vec2, v2: Vec2) {
  let dx = v1.x - v2.x,
    dy = v1.y - v2.y

  return Math.sqrt(dx * dx + dy * dy)
}

export function vec_length(v1: Vec2) {
  return Math.sqrt(v1.x * v1.x + v1.y * v1.y)
}

export function vec_normalize(v1: Vec2) {
  return vec_scale(v1, 1/vec_length(v1))
}

export function vec_sub(v1: Vec2, v2: Vec2) {
  return vec(v1.x - v2.x, v1.y - v2.y)
}

export function vec_add(v1: Vec2, v2: Vec2) {
  return vec(v1.x + v2.x, v1.y + v2.y)
}

export function vec_scale(v1: Vec2, s: number) {
  return vec(v1.x * s, v1.y * s)
}

export type Segment = Array<Vec2>

export class GraphicsBuilder {

  constructor(readonly unit_length: number) {}

  line_segment(x: number, y: number, x2: number, y2: number) {


    let v1 = vec(x, y)
    let v2 = vec(x2, y2)

    let v_normal = vec_normalize(vec_sub(v2, v1))
    let length = vec_distance(v1, v2)

    let segments = []

    let nb = length / this.unit_length

    let v_unit = vec_scale(v_normal, this.unit_length)

    let v_last = v1

    segments.push(v_last)

    for (let i = 0; i < nb; i++) {
      v_last = vec_add(v_last, v_unit)
      segments.push(v_last)
    }

    return segments
  }
}
