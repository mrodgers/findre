import { useState } from 'react'
import { Calculator } from 'lucide-react'

interface Props {
  price: number
}

export function MortgageCalc({ price }: Props) {
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(7.0)
  const [years, setYears] = useState<15 | 30>(30)
  const [open, setOpen] = useState(false)

  const downAmt = price * (downPct / 100)
  const loan = price - downAmt
  const monthlyRate = rate / 100 / 12
  const n = years * 12
  const monthly = loan * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
  const totalPaid = monthly * n
  const totalInterest = totalPaid - loan

  const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 })

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-300">Mortgage Calculator</span>
        </div>
        {!open && (
          <span className="text-xs text-gray-500">tap to estimate</span>
        )}
        <span className="text-gray-600 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800">
          {/* Controls */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            {/* Down payment */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Down payment</label>
              <div className="flex items-center gap-1">
                <input
                  type="range" min={3} max={50} step={1} value={downPct}
                  onChange={e => setDownPct(Number(e.target.value))}
                  className="flex-1 accent-sky-500"
                />
                <span className="text-xs text-white w-8 text-right">{downPct}%</span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">${fmt(downAmt)}</div>
            </div>

            {/* Interest rate */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rate (APR)</label>
              <div className="flex items-center gap-1">
                <input
                  type="range" min={3} max={12} step={0.1} value={rate}
                  onChange={e => setRate(Number(e.target.value))}
                  className="flex-1 accent-sky-500"
                />
                <span className="text-xs text-white w-10 text-right">{rate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Term toggle */}
          <div className="flex gap-2">
            {([30, 15] as const).map(y => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                  years === y
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {y}-year fixed
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="bg-gray-900 rounded-xl p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">Est. monthly payment</span>
              <span className="text-xl font-bold text-white">${fmt(monthly)}<span className="text-xs text-gray-500 font-normal">/mo</span></span>
            </div>
            <div className="h-px bg-gray-800" />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-500">Loan</div>
                <div className="text-gray-300">${fmt(loan)}</div>
              </div>
              <div>
                <div className="text-gray-500">Total paid</div>
                <div className="text-gray-300">${fmt(totalPaid)}</div>
              </div>
              <div>
                <div className="text-gray-500">Interest</div>
                <div className="text-red-400">${fmt(totalInterest)}</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-600">Estimate only — excludes taxes, insurance, HOA. Consult a lender for accurate quotes.</p>
        </div>
      )}
    </div>
  )
}
