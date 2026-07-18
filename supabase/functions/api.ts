// Supabase Edge Function - 排课系统 API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Supabase 客户端
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// CORS 处理
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }
}

// 验证时间槽
function validSlotSpan(slot: number, duration: number): boolean {
  return duration >= 1 && (
    (slot === 1 && duration === 1) ||
    (slot >= 2 && slot <= 6 && slot + duration - 1 <= 6) ||
    (slot >= 7 && slot <= 10 && slot + duration - 1 <= 10) ||
    (slot === 11 && duration === 1)
  )
}

// 获取所有数据
async function getModel() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const [teachersRes, studentsRes, roomsRes, coursesRes, adminClassesRes, sectionsRes, allocationsRes] = await Promise.all([
    supabase.from('entities').select('*').eq('kind', 'teacher'),
    supabase.from('entities').select('*').eq('kind', 'student'),
    supabase.from('entities').select('*').eq('kind', 'room'),
    supabase.from('entities').select('*').eq('kind', 'course'),
    supabase.from('entities').select('*').eq('kind', 'adminClass'),
    supabase.from('entities').select('*').eq('kind', 'section'),
    supabase.from('allocations').select('*')
  ])

  return {
    teachers: teachersRes.data?.map(r => JSON.parse(r.payload)) || [],
    students: studentsRes.data?.map(r => JSON.parse(r.payload)) || [],
    rooms: roomsRes.data?.map(r => JSON.parse(r.payload)) || [],
    courses: coursesRes.data?.map(r => JSON.parse(r.payload)) || [],
    adminClasses: adminClassesRes.data?.map(r => JSON.parse(r.payload)) || [],
    sections: sectionsRes.data?.map(r => JSON.parse(r.payload)) || [],
    allocations: allocationsRes.data?.map(a => ({ ...a, locked: Boolean(a.locked) })) || []
  }
}

// 主处理函数
serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const url = new URL(req.url)
  const path = url.pathname

  try {
    // 路由处理
    if (path === '/api/bootstrap' && req.method === 'GET') {
      const model = await getModel()

      // 简单的冲突检测（可以后续增强）
      const conflicts: any[] = []

      return new Response(
        JSON.stringify({
          ...model,
          conflicts,
          term: { name: '2026—2027学年 第一学期', version: '初稿 V1', status: 'DRAFT' }
        }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    if (path === '/api/health' && req.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'scheduler-api' }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 创建排课分配
    if (path === '/api/allocations' && req.method === 'POST') {
      const body = await req.json()
      const model = await getModel()

      const sectionId = Number(body.sectionId)
      const roomId = Number(body.roomId)
      const day = Number(body.day)
      const slot = Number(body.slot)
      const duration = Number(body.duration || 1)
      const weekPattern = String(body.weekPattern || 'EVERY_WEEK')

      const allowedPatterns = ['EVERY_WEEK', 'ODD_WEEK', 'EVEN_WEEK', 'EVERY_3_WEEKS', 'MONTHLY']

      if (!model.sections.some(s => s.id === sectionId)) {
        return new Response(JSON.stringify({ message: '请选择有效的教学班' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      if (!model.rooms.some(r => r.id === roomId)) {
        return new Response(JSON.stringify({ message: '请选择有效的教室' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      if (day < 1 || day > 5 || !validSlotSpan(slot, duration)) {
        return new Response(JSON.stringify({ message: '课位超出教学时段' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      if (!allowedPatterns.includes(weekPattern)) {
        return new Response(JSON.stringify({ message: '无效的课程轮次' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      // 获取新 ID
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const maxIdRes = await supabase.from('allocations').select('id').order('id', { ascending: false }).limit(1)
      const maxId = maxIdRes.data?.[0]?.id || 0
      const id = maxId + 1

      const allocation = {
        id,
        section_id: sectionId,
        day,
        slot,
        duration,
        room_id: roomId,
        week_pattern: weekPattern,
        locked: false
      }

      const { error } = await supabase.from('allocations').insert(allocation)

      if (error) {
        return new Response(JSON.stringify({ message: '创建失败', error: error.message }), {
          status: 500,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      return new Response(
        JSON.stringify({ allocation: { ...allocation, locked: false }, conflicts: [] }),
        { status: 201, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 删除排课分配
    if (path.match(/\/api\/allocations\/\d+/) && req.method === 'DELETE') {
      const id = Number(path.split('/').pop())
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { error } = await supabase.from('allocations').delete().eq('id', id)

      return new Response(
        JSON.stringify({ ok: true, deleted: 1 }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 移动课位
    if (path.match(/\/api\/allocations\/\d+\/move/) && req.method === 'POST') {
      const id = Number(path.split('/')[3])
      const body = await req.json()
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { data: current } = await supabase.from('allocations').select('*').eq('id', id).single()

      if (!current) {
        return new Response(JSON.stringify({ message: '课次不存在' }), {
          status: 404,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      if (current.locked) {
        return new Response(JSON.stringify({ message: '该课次已锁定' }), {
          status: 409,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      const candidate = {
        day: Number(body.day),
        slot: Number(body.slot),
        room_id: Number(body.roomId ?? current.room_id),
        week_pattern: String(body.weekPattern || current.week_pattern)
      }

      if (candidate.day < 1 || candidate.day > 5 || !validSlotSpan(candidate.slot, current.duration)) {
        return new Response(JSON.stringify({ message: '目标时间超出教学时段' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      const { error } = await supabase.from('allocations').update({
        day: candidate.day,
        slot: candidate.slot,
        room_id: candidate.room_id,
        week_pattern: candidate.week_pattern
      }).eq('id', id)

      if (error) {
        return new Response(JSON.stringify({ message: '移动失败', error: error.message }), {
          status: 500,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        })
      }

      return new Response(
        JSON.stringify({
          allocation: { ...current, ...candidate, locked: false },
          conflicts: []
        }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 切换锁定状态
    if (path.match(/\/api\/allocations\/\d+\/toggle-lock/) && req.method === 'POST') {
      const id = Number(path.split('/')[3])
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { data: current } = await supabase.from('allocations').select('locked').eq('id', id).single()

      await supabase.from('allocations').update({ locked: !current?.locked }).eq('id', id)

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 获取版本列表
    if (path === '/api/versions' && req.method === 'GET') {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { data } = await supabase
        .from('schedule_versions')
        .select('id, name, status, created_at')
        .order('id', { ascending: false })

      return new Response(
        JSON.stringify(data || []),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 创建版本
    if (path === '/api/versions' && req.method === 'POST') {
      const body = await req.json()
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const model = await getModel()
      const now = new Date().toISOString()
      const name = body.name || `课表快照 ${now.slice(0, 16)}`

      const { data } = await supabase.from('schedule_versions').insert({
        name,
        status: 'DRAFT',
        snapshot: JSON.stringify(model.allocations),
        created_at: now
      }).select()

      return new Response(
        JSON.stringify({ id: data?.[0]?.id, createdAt: now }),
        { status: 201, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 获取审计日志
    if (path === '/api/audit-logs' && req.method === 'GET') {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const limit = Number(url.searchParams.get('limit')) || 200

      const { data } = await supabase
        .from('audit_logs')
        .select('id, occurred_at, actor_ip, action, resource, summary')
        .order('id', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 1000))

      return new Response(
        JSON.stringify(data || []),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // 路由未找到
    return new Response(
      JSON.stringify({ message: 'API endpoint not found' }),
      { status: 404, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({ message: 'Internal Server Error', error: String(error) }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
