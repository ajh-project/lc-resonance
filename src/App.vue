<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { UNITS, eng, parseInput, pretty, sig, solve, type Target } from './lc'

const target = ref<Target>('f')

const inputs = reactive({
  f: { raw: '1', unit: 'MHz' },
  L: { raw: '100', unit: 'µH' },
  C: { raw: '253.3', unit: 'pF' },
})

const META: Record<Target, { name: string; sym: string; hint: string }> = {
  f: { name: '공진 주파수', sym: 'f₀', hint: '예: 1, 13.56, 2.4G' },
  L: { name: '인덕턴스', sym: 'L', hint: '예: 100, 4.7u, 10mH' },
  C: { name: '커패시턴스', sym: 'C', hint: '예: 100, 4.7n, 22pF' },
}

const knowns = computed(() => (['f', 'L', 'C'] as Target[]).filter((t) => t !== target.value))

/** 입력값을 기본 단위(Hz, H, F)로. 숫자에 접두어(u, n, p…)를 붙이면 단위 선택보다 우선 */
function siValue(t: Target): number | null {
  const parsed = parseInput(inputs[t].raw)
  if (!parsed) return null
  if (parsed.prefixed) return parsed.value
  const unit = UNITS[t].find((u) => u.label === inputs[t].unit)!
  return parsed.value * unit.factor
}

const values = computed(() => {
  const v = { f: siValue('f'), L: siValue('L'), C: siValue('C') }
  return v
})

const errors = computed(() => {
  const e: Partial<Record<Target, boolean>> = {}
  for (const t of knowns.value) e[t] = inputs[t].raw.trim() !== '' && values.value[t] === null
  return e
})

const result = computed(() => {
  const v = values.value
  if (knowns.value.some((t) => v[t] === null)) return null
  return solve(target.value, { f: v.f ?? 0, L: v.L ?? 0, C: v.C ?? 0 })
})

const shown = computed(() => (result.value ? pretty(result.value, target.value) : null))

/** 결과까지 합친 세 값 (부가 정보 계산용) */
const all = computed(() => {
  if (result.value === null) return null
  return { ...values.value, [target.value]: result.value } as { f: number; L: number; C: number }
})

const details = computed(() => {
  const a = all.value
  if (!a) return []
  const w = 2 * Math.PI * a.f
  return [
    { label: '각주파수 ω₀ = 2πf₀', value: eng(w, 'rad/s') },
    { label: '주기 T = 1/f₀', value: eng(1 / a.f, 's') },
    { label: '특성 임피던스 Z₀ = √(L/C)', value: eng(Math.sqrt(a.L / a.C), 'Ω') },
    { label: '공진 시 리액턴스 X_L = X_C', value: eng(w * a.L, 'Ω') },
  ]
})

const steps = computed(() => {
  const a = all.value
  if (!a) return ''
  const L = eng(a.L, 'H')
  const C = eng(a.C, 'F')
  const f = eng(a.f, 'Hz')
  switch (target.value) {
    case 'f':
      return `f₀ = 1 / (2π × √(${L} × ${C}))`
    case 'L':
      return `L = 1 / ((2π × ${f})² × ${C})`
    case 'C':
      return `C = 1 / ((2π × ${f})² × ${L})`
  }
})

function setTarget(t: Target) {
  // 방금 구한 값을 입력칸으로 옮겨서, 다른 값을 구할 때 이어서 쓸 수 있게
  if (result.value && shown.value) {
    inputs[target.value].raw = shown.value.num.replace(/,/g, '')
    inputs[target.value].unit = shown.value.unit
  }
  target.value = t
}

const EXAMPLES: { name: string; set: Partial<Record<Target, [string, string]>>; target: Target }[] = [
  { name: 'AM 라디오 ~1 MHz', target: 'f', set: { L: ['250', 'µH'], C: ['100', 'pF'] } },
  { name: 'RFID 13.56 MHz', target: 'C', set: { f: ['13.56', 'MHz'], L: ['1', 'µH'] } },
  { name: 'FM 100 MHz', target: 'L', set: { f: ['100', 'MHz'], C: ['10', 'pF'] } },
  { name: '오디오 1 kHz', target: 'f', set: { L: ['10', 'mH'], C: ['2.533', 'µF'] } },
  { name: '테라헤르츠 ~5 THz', target: 'f', set: { L: ['1', 'pH'], C: ['1', 'fF'] } },
]

function applyExample(ex: (typeof EXAMPLES)[number]) {
  target.value = ex.target
  for (const [t, [raw, unit]] of Object.entries(ex.set) as [Target, [string, string]][]) {
    inputs[t].raw = raw
    inputs[t].unit = unit
  }
}

const BASE_UNITS = [
  { sym: 'Hz', name: '헤르츠 · 주파수', desc: '1초에 몇 번 진동하는지. 1 kHz = 1초에 1,000번' },
  { sym: 'H', name: '헨리 · 인덕턴스 L', desc: '코일이 전류 변화를 막으려는 정도. 보통 µH, nH 단위를 많이 써요' },
  { sym: 'F', name: '패럿 · 커패시턴스 C', desc: '커패시터가 전하를 저장하는 정도. 보통 pF, nF, µF 단위를 많이 써요' },
  { sym: 'rad/s', name: '라디안/초 · 각주파수 ω', desc: 'ω = 2πf. 회로 계산식에서 주로 쓰는 주파수 표현' },
  { sym: 's', name: '초 · 주기 T', desc: '한 번 진동하는 데 걸리는 시간. T = 1/f' },
  { sym: 'Ω', name: '옴 · 임피던스', desc: '교류에서 전류를 방해하는 정도. 공진 때는 X_L = X_C' },
]

const PREFIXES = [
  { sym: 'T', name: '테라', exp: '12', ex: '1 THz = 1,000 GHz' },
  { sym: 'G', name: '기가', exp: '9', ex: '2.4 GHz (와이파이)' },
  { sym: 'M', name: '메가', exp: '6', ex: '100 MHz (FM 라디오)' },
  { sym: 'k', name: '킬로', exp: '3', ex: '1 kHz = 1,000 Hz' },
  { sym: 'm', name: '밀리', exp: '−3', ex: '10 mH = 0.01 H' },
  { sym: 'µ', name: '마이크로', exp: '−6', ex: '4.7 µF = 0.0000047 F' },
  { sym: 'n', name: '나노', exp: '−9', ex: '1 nF = 1,000 pF' },
  { sym: 'p', name: '피코', exp: '−12', ex: '22 pF' },
  { sym: 'f', name: '펨토', exp: '−15', ex: '1 fF = 0.001 pF' },
]

const copied = ref(false)
async function copy() {
  if (!shown.value) return
  await navigator.clipboard.writeText(`${shown.value.num} ${shown.value.unit}`)
  copied.value = true
  setTimeout(() => (copied.value = false), 1400)
}

const rawResult = computed(() => {
  if (result.value === null) return ''
  const base = { f: 'Hz', L: 'H', C: 'F' }[target.value]
  return `= ${sig(result.value, 6)} ${base}`
})
</script>

<template>
  <main class="wrap">
    <header>
      <p class="eyebrow">LC Resonance Calculator</p>
      <h1>공진 주파수 계산기</h1>
    </header>

    <!-- 공식 -->
    <section class="formula" aria-label="f0 = 1 / (2π√LC)">
      <span class="var">f<sub>0</sub></span>
      <span class="eq">=</span>
      <span class="frac">
        <span class="num">1</span>
        <span class="den">2π<span class="sqrt"><span class="var">LC</span></span></span>
      </span>
    </section>

    <!-- 무엇을 구할지 -->
    <section class="card">
      <p class="label">무엇을 구할까요?</p>
      <div class="seg" role="tablist">
        <button
          v-for="t in ['f', 'L', 'C'] as Target[]"
          :key="t"
          role="tab"
          type="button"
          :aria-selected="target === t"
          :class="{ on: target === t }"
          @click="setTarget(t)"
        >
          <b>{{ META[t].sym }}</b>
          <small>{{ META[t].name }}</small>
        </button>
      </div>

      <div class="fields">
        <label v-for="t in knowns" :key="t" class="field" :class="{ bad: errors[t] }">
          <span class="fname">{{ META[t].name }} <i>{{ META[t].sym }}</i></span>
          <span class="inrow">
            <input
              v-model="inputs[t].raw"
              inputmode="decimal"
              autocomplete="off"
              spellcheck="false"
              :placeholder="META[t].hint"
            />
            <select v-model="inputs[t].unit" :aria-label="`${META[t].name} 단위`">
              <option v-for="u in UNITS[t]" :key="u.label" :value="u.label">{{ u.label }}</option>
            </select>
          </span>
          <span v-if="errors[t]" class="err">0보다 큰 숫자를 입력하세요</span>
        </label>
      </div>
    </section>

    <!-- 결과 -->
    <section class="card result" :class="{ empty: !shown }" aria-live="polite">
      <p class="label">{{ META[target].name }} {{ META[target].sym }}</p>
      <template v-if="shown">
        <div class="big">
          <span class="n">{{ shown.num }}</span>
          <span class="u">{{ shown.unit }}</span>
          <button class="copy" type="button" @click="copy">{{ copied ? '복사됨' : '복사' }}</button>
        </div>
        <p class="raw">{{ rawResult }}</p>
        <p class="steps">{{ steps }}</p>
      </template>
      <p v-else class="placeholder">값을 입력하면 바로 계산돼요</p>
    </section>

    <section v-if="details.length" class="card">
      <p class="label">함께 보기</p>
      <dl class="details">
        <template v-for="d in details" :key="d.label">
          <dt>{{ d.label }}</dt>
          <dd>{{ d.value }}</dd>
        </template>
      </dl>
    </section>

    <section class="examples">
      <p class="label">예시</p>
      <div class="chips">
        <button v-for="ex in EXAMPLES" :key="ex.name" type="button" @click="applyExample(ex)">{{ ex.name }}</button>
      </div>
      <p class="tip">팁: 숫자 뒤에 <code>f p n u m k M G T</code>를 붙여도 돼요 (예: <code>4.7u</code>, <code>22pF</code>, <code>2.4G</code>, <code>1.5T</code>)</p>
    </section>

    <!-- 단위 설명 -->
    <section class="card units">
      <p class="label">단위 설명</p>

      <h3>기본 단위</h3>
      <table>
        <tbody>
          <tr v-for="u in BASE_UNITS" :key="u.sym">
            <th>{{ u.sym }}</th>
            <td>
              <b>{{ u.name }}</b>
              <span>{{ u.desc }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <h3>접두어 (크기)</h3>
      <table class="prefix">
        <thead>
          <tr>
            <th>기호</th>
            <th>읽기</th>
            <th>배수</th>
            <th>예시</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in PREFIXES" :key="p.sym">
            <th>{{ p.sym }}</th>
            <td>{{ p.name }}</td>
            <td class="mono">10<sup>{{ p.exp }}</sup></td>
            <td class="mono">{{ p.ex }}</td>
          </tr>
        </tbody>
      </table>
      <p class="tip">입력할 때 <code>u</code>는 µ(마이크로) 대신 쓸 수 있어요. 대소문자를 구분해요: <code>m</code> = 밀리, <code>M</code> = 메가.</p>
    </section>

    <footer>f₀ = 1 / (2π√LC) · 이상적인 LC 회로 기준 (저항 무시)</footer>
  </main>
</template>
