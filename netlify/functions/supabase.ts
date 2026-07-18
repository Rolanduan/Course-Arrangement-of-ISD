// Netlify Function - 直接连接 Supabase
export async function handler(event, context) {
  const supabaseUrl = 'https://vxsetefeaquvxbwarmis.supabase.co'
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4c2V0ZWZlYXF1dnhid2FybWlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI5ODc2NiwiZXhwIjoyMDk5ODc0NzY2fQ.Jj0AUbYQQSLJvkkGw9t0h_IKMgGS6iPYFBY4mXcJRkY'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  const path = event.path.replace('/.netlify/functions/supabase', '')

  try {
    // Bootstrap endpoint
    if (path === '/bootstrap' && event.httpMethod === 'GET') {
      const response = await fetch(`${supabaseUrl}/rest/v1/entities?select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      })

      const data = await response.json()

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teachers: data.filter(r => r.kind === 'teacher').map(r => JSON.parse(r.payload)),
          students: data.filter(r => r.kind === 'student').map(r => JSON.parse(r.payload)),
          rooms: data.filter(r => r.kind === 'room').map(r => JSON.parse(r.payload)),
          courses: data.filter(r => r.kind === 'course').map(r => JSON.parse(r.payload)),
          adminClasses: data.filter(r => r.kind === 'adminClass').map(r => JSON.parse(r.payload)),
          sections: data.filter(r => r.kind === 'section').map(r => JSON.parse(r.payload)),
          allocations: [],
          conflicts: [],
          term: { name: '2026—2027学年 第一学期', version: '初稿 V1', status: 'DRAFT' }
        })
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ status: 'ok' })
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(error) })
    }
  }
}
