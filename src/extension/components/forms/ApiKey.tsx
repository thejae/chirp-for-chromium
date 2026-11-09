import React from 'react'
import { useState } from 'react'
import { CheckCircle, CreditCard, Key, Lock } from 'react-feather'
import { Text } from '../../../components/inputs/Text.jsx'
import { Button } from '../../../components/Button.js'
import { useSync } from '../../../hooks/useSync.js'

export function ApiKeyForm() {}

ApiKeyForm.Content = function ({ form, sync, setSync }) {
  return (
    <div className="flex flex-col gap-2">
      <Text
        type="password"
        error={form.error}
        label="Google Cloud API key"
        placeholder="Ex: AIzaSyDRIlE4ioDeZ03fya3385XeyUAvMorxWjw"
        value={sync.apiKey}
        onChange={(apiKey) => setSync({ ...sync, apiKey, apiKeyValid: false })}
      />
      <div className="flex items-center justify-between text-xxs text-neutral-500 px-0.5">
        <span className="flex items-center gap-1">
          <Lock size={11} className="shrink-0 text-neutral-400" />
          Stored locally in your browser sync storage.
        </span>
        {sync.apiKeyValid && !form.error && (
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle size={11} />
            Verified
          </span>
        )}
      </div>
    </div>
  )
}

ApiKeyForm.Buttons = function ({ form, sync, setSync }) {
  return (
    <div className="flex gap-2">
      <Button
        Icon={CreditCard}
        onClick={() => setSync({ ...sync, mode: 'paid' })}
      >
        {sync.user?.credits > 0
          ? 'Use credits instead'
          : 'Purchase credits instead'}
      </Button>
      <Button
        type="primary"
        Icon={Key}
        onClick={form.validate}
        submitting={form.validating}
      >
        Save & verify key
      </Button>
    </div>
  )
}

ApiKeyForm.Validator = function (callback) {
  const { sync, setSync } = useSync()
  const [error, setError] = useState(null)
  const [validating, setValidating] = useState(false)

  async function validate() {
    if (!sync.apiKey?.trim()) {
      setError('Please enter your Google Cloud API key')
      return setSync({ ...sync, apiKeyValid: false })
    }

    setValidating(true)

    if (!(await chrome.runtime.sendMessage({ id: 'validateApiKey' }))) {
      setError('API key could not be verified. Check that the Cloud Text-to-Speech API is enabled.')
      setValidating(false)
      return setSync({ ...sync, apiKeyValid: false })
    }

    await setSync({ ...sync, apiKeyValid: true })
    setValidating(false)
    setError('')
    callback()
  }

  return { error, validating, validate }
}
