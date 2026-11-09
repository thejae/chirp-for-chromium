import { CreditCard, Key } from 'react-feather'
import { Dialog } from '../../../components/Dialog.js'
import * as React from 'react'
import { FreeNotice, HowToUseTip, Notice } from '../copy/Notice.jsx'
import { PricingTable } from '../copy/PricingTable.jsx'
import { ApiKeyForm } from '../forms/ApiKey.js'
import { Button } from '../../../components/Button.js'
import { useSync } from '../../../hooks/useSync.js'
import { useSession } from '../../../hooks/useSession.js'
import { useStore } from '../../../hooks/useStore.js'
import { errorStore } from '../../extension.js'
import { isError } from '../../helpers/error-helpers.js'

/**
 * First-run and missing-credentials onboarding dialog injected when a user
 * triggers speech before configuring an API key or purchasing credits.
 */
export function OnboardingDialog({ onClose }) {
  const { sync, setSync, ready: syncReady } = useSync()
  const { session, ready: sessionReady } = useSession()
  const form = ApiKeyForm.Validator(onClose)
  const [loading, setLoading] = React.useState(false)
  const [, setError] = useStore(errorStore)

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

  function useMyOwnApiKey() {
    if (sync.apiKey && sync.apiKeyValid) {
      onClose()
    }

    setSync({ ...sync, mode: 'free' })
  }

  function renderContent() {
    if (sync.mode === 'paid') {
      if (sync.user?.credits) {
        onClose()
      }

      return (
        <div className="flex flex-col gap-3">
          <Notice />
          <PricingTable />
          <HowToUseTip />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <FreeNotice />
        <ApiKeyForm.Content form={form} sync={sync} setSync={setSync} />
        <HowToUseTip />
      </div>
    )
  }

  function renderButtons() {
    if (sync.mode === 'free') {
      return <ApiKeyForm.Buttons form={form} sync={sync} setSync={setSync} />
    }

    return [
      <Button
        className="max-w-fit"
        key="mode-switch-button"
        Icon={Key}
        onClick={useMyOwnApiKey}
        submitting={loading}
      >
        Use my own API key
      </Button>,
      <Button
        className="max-w-fit"
        type="primary"
        key="payment-button"
        Icon={CreditCard}
        onClick={pay}
        submitting={loading}
        ping={session.paymentSession}
      >
        {session.paymentSession
          ? 'Waiting for payment…'
          : 'Purchase credits ($9.75)'}
      </Button>,
    ]
  }

  if (!syncReady || !sessionReady) {
    return null
  }

  return (
    <Dialog
      title={
        sync.mode === 'paid'
          ? 'Set up Wavenet to start listening'
          : 'Connect your Google Cloud API key'
      }
      content={renderContent()}
      onClose={onClose}
      buttons={renderButtons()}
    />
  )
}
