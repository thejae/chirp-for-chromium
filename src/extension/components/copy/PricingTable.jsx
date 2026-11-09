import React from 'react'

/**
 * Human-readable credit capacity breakdown by Google Cloud voice tier for the
 * $9.75 credit pack, with tabular numerals for scannability.
 */
export const PricingTable = () => (
  <div className="rounded-md border border-neutral-200 overflow-hidden text-xs">
    <table className="min-w-full border-collapse table-auto">
      <thead className="bg-neutral-100/80">
        <tr className="font-semibold text-neutral-700 text-left text-xxs">
          <th className="py-1.5 px-3 border-b border-neutral-200">Voice tier</th>
          <th className="py-1.5 px-3 border-b border-neutral-200">
            Included in $9.75 pack
          </th>
          <th className="py-1.5 px-3 border-b border-neutral-200 text-right">
            Rate / 1k chars
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-200/70 tabular-nums text-neutral-700">
        <tr className="even:bg-neutral-50/60">
          <td className="py-1.5 px-3 font-medium text-neutral-900">Standard</td>
          <td className="py-1.5 px-3">~6,000 sentences (~600k chars)</td>
          <td className="py-1.5 px-3 text-right text-neutral-500">$0.016</td>
        </tr>
        <tr className="even:bg-neutral-50/60">
          <td className="py-1.5 px-3 font-medium text-neutral-900">
            WaveNet · Neural2 · News · Polyglot
          </td>
          <td className="py-1.5 px-3">~2,000 sentences (~200k chars)</td>
          <td className="py-1.5 px-3 text-right text-neutral-500">$0.048</td>
        </tr>
        <tr className="even:bg-neutral-50/60">
          <td className="py-1.5 px-3 font-medium text-neutral-900">Studio</td>
          <td className="py-1.5 px-3">~400 sentences (~40k chars)</td>
          <td className="py-1.5 px-3 text-right text-neutral-500">$0.240</td>
        </tr>
      </tbody>
    </table>
  </div>
)
