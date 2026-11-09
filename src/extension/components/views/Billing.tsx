import React, { useEffect } from 'react'
import { CreditCard, DollarSign, Key, LogOut } from 'react-feather'
import { FreeNotice, HowToUseTip, Notice } from '../copy/Notice.jsx'
import { PricingTable } from '../copy/PricingTable.jsx'
import { ApiKeyForm } from '../forms/ApiKey.js'
import { useNavigate } from 'react-router-dom'
import { dateFormat, creditFormat } from '../../helpers/formatting-helpers.js'
import { Button } from '../../../components/Button.js'
import { useSession } from '../../../hooks/useSession.js'
import { useSync } from '../../../hooks/useSync.js'
import { useStore } from '../../../hooks/useStore.js'
import { errorStore } from '../../extension.js'
import { isError } from '../../helpers/error-helpers.js'

/**
 * Billing & Credentials view managing prepaid credit purchases, invoice
 * receipts, and BYO Google Cloud API key setup.
 */
export function Billing() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const { session, ready: sessionReady } = useSession()
  const { sync, setSync, ready: syncReady } = useSync()
  const form = ApiKeyForm.Validator(() => navigate('/preferences'))
  const [, setError] = useStore(errorStore)
  const paymentSession = session?.paymentSession

  useEffect(() => {
    chrome.runtime.sendMessage({ id: 'fetchInvoices' }, (response) => {
      if (!response) return

      setInvoices(response)
    })
  }, [sync.user])

  async function pay() {
    setLoading(true)
    const paymentSession = await chrome.runtime.sendMessage({
      id: 'createPaymentSession',
    })
    setLoading(false)

    if (isError(paymentSession)) {
      setError(paymentSession)
      return
    }

    if (!paymentSession?.hosted_invoice_url) {
      throw new Error(
        'Could not create payment session or payment session URL is missing',
      )
    }

    window.open(paymentSession.hosted_invoice_url)
  }

  if (!sessionReady || !syncReady) {
    return (
      <div className="text-xs text-neutral-500 py-6 text-center">
        Loading billing details…
      </div>
    )
  }

  function renderCredentials() {
    if (sync.mode === 'paid') return null

    return (
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Google Cloud Credentials
        </h2>
        <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3">
          <FreeNotice />
          <ApiKeyForm.Content form={form} sync={sync} setSync={setSync} />
          <ApiKeyForm.Buttons form={form} sync={sync} setSync={setSync} />
        </div>
      </div>
    )
  }

  function renderPaymentMethods() {
    if (sync.mode !== 'paid') return null

    return (
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Payment & Credits
        </h2>
        {!sync.user?.credits && (
          <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3">
            <Notice />
            <PricingTable />
            <div className="flex gap-2 pt-1">
              <Button
                className="max-w-fit"
                key="close"
                Icon={Key}
                onClick={() => setSync({ ...sync, mode: 'free' })}
              >
                Use API key
              </Button>
              <Button
                className="w-full"
                type="primary"
                key="support"
                Icon={CreditCard}
                onClick={pay}
                submitting={loading}
                ping={paymentSession}
              >
                {paymentSession
                  ? 'Waiting for payment…'
                  : 'Purchase credits ($9.75)'}
              </Button>
            </div>
          </div>
        )}

        {sync.user?.credits > 0 && (
          <div className="bg-white p-3.5 rounded-lg shadow-sm border border-neutral-200 flex flex-col gap-3 text-xs leading-relaxed text-neutral-700">
            <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200 rounded-md px-3 py-2">
              <span className="text-neutral-700">Available balance</span>
              <span className="font-bold text-emerald-800 tabular-nums text-sm">
                {creditFormat(sync.user.credits)}
              </span>
            </div>
            <p className="text-neutral-600">
              Need to update your payment method or have a billing question?
              Contact{' '}
              <a
                className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2"
                href="mailto:michael.poirierginter@gmail.com"
              >
                michael.poirierginter@gmail.com
              </a>
              .
            </p>
            <div className="flex gap-2">
              <Button
                className="w-full"
                Icon={Key}
                onClick={() => setSync({ ...sync, mode: 'free' })}
              >
                Switch to API key
              </Button>
              <Button
                className="max-w-fit"
                Icon={LogOut}
                onClick={async () => {
                  setSync({ ...sync, mode: 'free', user: null })
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderInvoices() {
    if (sync.mode === 'free') return null
    if (!invoices.length) return null

    return (
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight mb-2 ml-0.5">
          Invoices
        </h2>
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 divide-y divide-neutral-200/70 flex flex-col overflow-hidden">
          {invoices.map((invoice) => (
            <Invoice key={invoice.id} {...invoice} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {renderCredentials()}
      {renderPaymentMethods()}
      {renderInvoices()}
      <HowToUseTip />
    </div>
  )
}

function Invoice(props) {
  return (
    <div className="flex items-center px-3.5 py-2.5 even:bg-neutral-50/70 text-xs">
      <div className="bg-emerald-100 text-emerald-800 rounded p-1 mr-2.5 shrink-0">
        <DollarSign size={14} />
      </div>
      <div className="font-medium text-neutral-700 tabular-nums">
        {dateFormat(props.inserted_at)}
      </div>

      <Button
        className="ml-auto w-fit py-1 px-2.5"
        onClick={() => chrome.tabs.create({ url: props.hosted_invoice_url })}
      >
        Receipt ({creditFormat(props.amount, 100)})
      </Button>
    </div>
  )
}
