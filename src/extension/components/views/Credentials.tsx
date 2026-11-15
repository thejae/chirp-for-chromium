import { FreeNotice, HowToUseTip } from '../copy/Notice.jsx'
import { ApiKeyForm } from '../forms/ApiKey.js'
import { useNavigate } from 'react-router-dom'
import { useSync } from '../../../hooks/useSync.js'

/**
 * Credentials view for configuring the Google Cloud Text-to-Speech API key
 * used by the open-source extension.
 */
export function Credentials() {
  const navigate = useNavigate()
  const { sync, setSync, ready } = useSync()
  const form = ApiKeyForm.Validator(() => {
    chrome.runtime.sendMessage({ id: 'fetchVoices' })
    navigate('/preferences')
  })

  if (!ready) {
    return (
      <div className="text-xs text-neutral-500 dark:text-neutral-400 py-6 text-center">
        Loading credentials…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight mb-2 ml-0.5">
          Google Cloud Credentials
        </h2>
        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 flex flex-col gap-3">
          <FreeNotice />
          <ApiKeyForm.Content form={form} sync={sync} setSync={setSync} />
          <ApiKeyForm.Buttons form={form} sync={sync} setSync={setSync} />
        </div>
      </div>
      <HowToUseTip />
    </div>
  )
}
