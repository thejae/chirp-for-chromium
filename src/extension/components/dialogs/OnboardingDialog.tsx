import React from 'react'
import { Dialog } from '../../../components/Dialog.js'
import { FreeNotice, HowToUseTip } from '../copy/Notice.jsx'
import { ApiKeyForm } from '../forms/ApiKey.js'
import { Button } from '../../../components/Button.js'
import { useSync } from '../../../hooks/useSync.js'

/**
 * First-run and missing-credentials onboarding dialog injected when a user
 * triggers speech before configuring an API key.
 */
export function OnboardingDialog({ onClose }) {
  const { sync, setSync, ready } = useSync()
  const form = ApiKeyForm.Validator(() => {
    chrome.runtime.sendMessage({ id: 'fetchVoices' })
    onClose()
  })

  if (!ready) {
    return null
  }

  return (
    <Dialog
      title="Connect your Google Cloud API key"
      content={
        <div className="flex flex-col gap-3">
          <FreeNotice />
          <ApiKeyForm.Content form={form} sync={sync} setSync={setSync} />
          <HowToUseTip />
        </div>
      }
      onClose={onClose}
      buttons={
        <ApiKeyForm.Buttons form={form} sync={sync} setSync={setSync} />
      }
    />
  )
}
