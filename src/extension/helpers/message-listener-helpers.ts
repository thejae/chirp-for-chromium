/**
 * Replies to a runtime message with the handler's result, including when the
 * handler rejects. Without the rejection branch the message port stays open
 * and the caller waits forever.
 */
export function respondWithHandlerResult(
  handlers: Record<string, (payload: any) => Promise<any>>,
  id: string,
  payload: any,
  sendResponse: (response: any) => void,
) {
  handlers[id](payload).then(sendResponse, (error) =>
    sendResponse({
      error: true,
      errorCode: 'MESSAGE_HANDLER_FAILED',
      errorTitle: 'Something went wrong',
      errorMessage: error?.message || String(error),
    }),
  )
}

/**
 * Picks the tab a runtime message should reach: the remembered source tab of
 * a read session, or the active tab when no session is running.
 */
export async function resolveTargetTab(
  tabId: number | null,
  tabs: {
    get: (id: number) => Promise<any>
    query: (query: any) => Promise<any[]>
  },
) {
  if (tabId) {
    try {
      return await tabs.get(tabId)
    } catch {
      return null
    }
  }
  const matches = await tabs.query({ active: true, currentWindow: true })
  return matches[0] || null
}
