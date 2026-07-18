// Netlify Function - API Proxy to Supabase
export async function handler(event, context) {
  const supabaseUrl = 'https://vxsetefeaquvxbwarmis.supabase.co'
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4c2V0ZWZlYXF1dnhid2FybWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTg3NjYsImV4cCI6MjA5OTg3NDc2Nn0._TKugESPqtyI4LcSnuKi7n4nIXIE_OkgdufbFJXNm24'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  const path = event.path.replace('/.netlify/functions/proxy', '')

  try {
    // Bootstrap endpoint - get all data
    if (path === '/api/bootstrap' && event.httpMethod === 'GET') {
      const [teachers, students, rooms, courses, adminClasses, sections, allocations] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/entities?kind=eq.teacher&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        }).then(r => r.json()),
        fetch(`${supabaseUrl}/rest/v1/entities?kind=eq.student&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        }).then(r => r.json()),
        fetch(`${supabaseUrl}/rest/v1/entities?kind=eq.room&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        }).then(r => r.json()),
        fetch(`${supabaseUrl}/rest/v1/entities?kind=eq.course&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        }).then(r => r.json()),
        fetch(`${supabaseUrl}/rest/v1/entities?kind=eq.adminClass&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        }).then(r => r.json()),
        fetch(`${supabaseUrl}/rest/v1/entities?kind=eq.section&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        }).then(r => r.json()),
        fetch(`${supabaseUrl}/rest/v1/allocations?select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        }).then(r => r.json())
      ])

      const data = {
        teachers: teachers.map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload),
        students: students.map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload),
        rooms: rooms.map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload),
        courses: courses.map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload),
        adminClasses: adminClasses.map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload),
        sections: sections.map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload),
        allocations: allocations.map(a => ({ ...a, locked: Boolean(a.locked) })),
        conflicts: [],
        term: { name: '2026—2027学年 第一学期', version: '初稿 V1', status: 'DRAFT' }
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }
    }

    // Health check
    if (path === '/api/health' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ok' })
      }
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Not found' })
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(error) })
    }
  }
}
