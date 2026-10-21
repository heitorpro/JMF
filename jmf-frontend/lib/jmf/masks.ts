/** Máscaras e validações de formulário (cliente). O backend valida de novo. */

/** "98988887777" -> "(98) 98888-7777"; "9832221111" -> "(98) 3222-1111" */
export function maskPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function isValidPhone(value: string) {
  const d = value.replace(/\D/g, '')
  if (d.length !== 10 && d.length !== 11) return false
  if (d[0] === '0' || d[1] === '0') return false
  if (d.length === 11 && d[2] !== '9') return false
  return new Set(d).size > 1
}

/** "65075000" -> "65075-000" */
export function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value))
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'Pelo menos 8 caracteres', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'Um número', test: (p: string) => /\d/.test(p) },
  { id: 'symbol', label: 'Um símbolo (ex.: ! @ # $ %)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

export function passwordScore(password: string) {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length
}

export function isStrongPassword(password: string) {
  return passwordScore(password) === PASSWORD_RULES.length
}

/** Gera uma senha forte de 14 caracteres usando o gerador criptográfico do navegador. */
export function generateStrongPassword(length = 14) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?-_']
  const all = sets.join('')
  const random = (max: number) => {
    const buffer = new Uint32Array(1)
    crypto.getRandomValues(buffer)
    return buffer[0] % max
  }
  const chars = sets.map((set) => set[random(set.length)])
  while (chars.length < length) chars.push(all[random(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** "52998224725" -> "529.982.247-25" */
export function maskCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '')
  if (cpf.length !== 11 || new Set(cpf).size === 1) return false
  const digit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}
