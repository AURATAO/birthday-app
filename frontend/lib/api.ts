import { createClient } from './supabase'

export async function apiFetch(path: string, options: RequestInit = {}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  console.log('Full session object:', JSON.stringify(session))

  if (!session?.access_token) {
    console.error('No access token found! User may not be logged in.')
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options.headers,
    },
  })

  console.log('API response status:', response.status)
  return response
}
