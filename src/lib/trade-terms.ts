// 国际贸易术语 (INCOTERMS)
export const INCOTERMS = [
  'FOB',
  'CIF',
  'CFR',
  'EXW',
  'DAP',
  'DDP',
  'CPT',
  'CIP',
  'FCA',
] as const

export type Incoterm = typeof INCOTERMS[number]

// 付款方式
export const PAYMENT_TERMS = [
  'T/T',
  'L/C',
  'D/P',
  'D/A',
  'PayPal',
  'Western Union',
  'Credit Card',
] as const

export type PaymentTerm = typeof PAYMENT_TERMS[number]

// 获取所有贸易术语选项
export function getIncotermOptions(): { label: string; value: string }[] {
  return INCOTERMS.map(term => ({ label: term, value: term }))
}

// 获取所有付款方式选项
export function getPaymentTermOptions(): { label: string; value: string }[] {
  return PAYMENT_TERMS.map(term => ({ label: term, value: term }))
}

// 验证是否为有效的贸易术语
export function isValidIncoterm(term: string | null | undefined): term is Incoterm {
  if (!term) return false
  return INCOTERMS.includes(term as Incoterm)
}

// 验证是否为有效的付款方式
export function isValidPaymentTerm(term: string | null | undefined): term is PaymentTerm {
  if (!term) return false
  return PAYMENT_TERMS.includes(term as PaymentTerm)
}
