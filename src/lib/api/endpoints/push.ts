import { appApi } from '../client'
import type { Result } from '../types'

// Per-app push notifications (`@Path /v2/push-notification`).
export function push(app: string) {
  const c = appApi(app)
  return {
    subscriberAuthToken: (subscriberId: string, timeoutSeconds: number, signal?: AbortSignal) =>
      c.get<Result>('/push-notification/subscriber-auth-token', { query: { subscriberId, timeoutSeconds }, signal }),
    sendToSubscribers: (payload: unknown, serviceName?: string) =>
      c.post<Result>('/push-notification/subscribers', payload, { query: { serviceName } }),
    sendToTopic: (topic: string, message: unknown, serviceName?: string) =>
      c.post<Result>(`/push-notification/topics/${encodeURIComponent(topic)}`, message, { query: { serviceName } }),
  }
}
