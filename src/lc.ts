// LC 공진: f = 1 / (2π√(LC))

export type Target = 'f' | 'L' | 'C'

export interface Unit {
  label: string
  factor: number
}

export const UNITS: Record<Target, Unit[]> = {
  f: [
    { label: 'Hz', factor: 1 },
    { label: 'kHz', factor: 1e3 },
    { label: 'MHz', factor: 1e6 },
    { label: 'GHz', factor: 1e9 },
  ],
  L: [
    { label: 'H', factor: 1 },
    { label: 'mH', factor: 1e-3 },
    { label: 'µH', factor: 1e-6 },
    { label: 'nH', factor: 1e-9 },
    { label: 'pH', factor: 1e-12 },
  ],
  C: [
    { label: 'F', factor: 1 },
    { label: 'mF', factor: 1e-3 },
    { label: 'µF', factor: 1e-6 },
    { label: 'nF', factor: 1e-9 },
    { label: 'pF', factor: 1e-12 },
  ],
}

const TWO_PI = 2 * Math.PI

export function solve(target: Target, v: { f: number; L: number; C: number }): number {
  switch (target) {
    case 'f':
      return 1 / (TWO_PI * Math.sqrt(v.L * v.C))
    case 'L':
      return 1 / ((TWO_PI * v.f) ** 2 * v.C)
    case 'C':
      return 1 / ((TWO_PI * v.f) ** 2 * v.L)
  }
}

/** "4.7", "4.7e-6", "10u", "100p", "2.2k" 같은 입력을 숫자로 (접두어가 있으면 단위 선택보다 우선) */
const PREFIX: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
}

export function parseInput(raw: string): { value: number; prefixed: boolean } | null {
  const s = raw.trim().replace(/,/g, '').replace(/\s+/g, '')
  if (!s) return null
  const m = s.match(/^([+]?\d*\.?\d+(?:e[+-]?\d+)?)([pnuµμmkKMG]?)[a-zA-Z]*$/i)
  if (!m) return null
  const num = Number(m[1])
  if (!isFinite(num) || num <= 0) return null
  // e 지수 표기의 'e'와 헷갈리지 않도록 접두어는 대소문자 그대로 사용
  const pre = s.slice(m[1].length, m[1].length + 1)
  const factor = PREFIX[pre]
  return factor ? { value: num * factor, prefixed: true } : { value: num, prefixed: false }
}

/** 값을 보기 좋은 단위로 (1 ≤ 숫자 < 1000) */
export function pretty(value: number, target: Target): { num: string; unit: string } {
  const units = [...UNITS[target]].sort((a, b) => b.factor - a.factor)
  // 반올림 후 기준으로 단위를 고른다 (0.99999µs → 1,000ns 가 아니라 1µs)
  const unit = units.find((u) => round4(value / u.factor) >= 1) ?? units[units.length - 1]
  return { num: sig(value / unit.factor), unit: unit.label }
}

const round4 = (n: number) => Number(n.toPrecision(4))

/** 유효숫자 4자리, 끝의 0 제거 */
export function sig(n: number, digits = 4): string {
  if (!isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a !== 0 && (a >= 1e12 || a < 1e-3)) return n.toExponential(digits - 1).replace(/\.?0+e/, 'e')
  return Number(n.toPrecision(digits)).toLocaleString('en-US', { maximumFractionDigits: 6 })
}

/** 단위 접두어가 붙은 일반 표기 (ω, T, Z 등) */
export function eng(value: number, base: string): string {
  const steps: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ]
  const [f, p] = steps.find(([f]) => Math.abs(round4(value / f)) >= 1) ?? steps[steps.length - 1]
  return `${sig(value / f)} ${p}${base}`
}
