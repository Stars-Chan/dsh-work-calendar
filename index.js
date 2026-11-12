/**
 * Host half of the work-calendar bundle: it turns the Session log into the
 * per-day activity the calendar panel shows.
 *
 * The panel reads `GET /api/work-calendar/activity` through the browser's
 * authenticated Client connection. Day boundaries arrive from the page,
 * because only the browser knows the reader's time zone.
 */

/** Plugin row name. */
export const name = 'work-calendar'

/** Without these services the calendar has neither data nor a transport. */
export const inject = ['sessionQuery', 'sessionPersistence', 'connection']

const ROUTE_PATH = '/api/work-calendar/activity'
const SESSIONS_PATH = '/api/work-calendar/sessions'
/** Sessions offered as a schedule target in the panel. */
const SESSION_CHOICES = 30
/** Newest Sessions scanned for activity; older ones stay outside the calendar. */
const SESSION_LIMIT = 200
const SESSION_CONCURRENCY = 4
/** How long one Session's event list serves requests when its revision is unknown. */
const CACHE_TTL_MS = 300_000
const MAX_BUCKETS = 70
const DETAIL_SESSION_LIMIT = 30
const PROMPT_LIMIT = 6
const PROMPT_CHARS = 120

/**
 * Register the activity route that the panel reads.
 * @param ctx - Host context carrying `sessionQuery` and `connection`.
 */
export function apply(ctx) {
  const events = new Map()
  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: request => respond(ctx, () => activity(ctx, events, request)),
  }), 'work-calendar: activity route')
  ctx.effect(() => ctx.connection.fetch.register({
    path: SESSIONS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: request => respond(ctx, () => sessionChoices(ctx, request)),
  }), 'work-calendar: sessions route')
  // The chat path: an agent creates schedules only where the schedule service exists.
  ctx.inject(['tools', 'schedule'], (scope) => {
    scope.effect(
      () => scope.tools.register(scheduleTool(scope)),
      'work-calendar: schedule tool',
    )
  })
}

/** Tool the agent calls once the user has settled the time, repeat rule, and target. */
const TOOL_NAME = 'calendar_schedule'

/**
 * @param ctx - Host context carrying `schedule` and `sessionQuery`.
 * @returns the tool definition registered for the agent.
 */
function scheduleTool(ctx) {
  return {
    name: TOOL_NAME,
    description: [
      'Create, list, or delete a work-calendar schedule: a prompt the Harness delivers to a Session at a chosen local time, so that Session then runs the task.',
      'Before creating, settle three things with the user and ask when any is unclear: the exact local date and time, whether it repeats (once, daily, weekly), and which Session runs it.',
      'target=this means the current Session; target=session takes another Session id or part of its title, and an ambiguous title fails with the candidates to choose from; target=new starts a fresh Session in cwd.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'list', 'delete'], description: 'Operation to perform.' },
        title: { type: 'string', description: 'Short name shown on the calendar; required for create.' },
        prompt: { type: 'string', description: 'Text delivered to the target Session when the schedule fires; required for create.' },
        repeat: { type: 'string', enum: ['once', 'daily', 'weekly'], description: 'How often it runs; defaults to once.' },
        date: { type: 'string', description: 'Local start date `YYYY-MM-DD`; required for once, and its weekday is used for weekly when weekdays is omitted.' },
        time: { type: 'string', description: 'Local clock time `HH:mm`; required for create.' },
        weekdays: { type: 'array', items: { type: 'integer' }, description: 'ISO weekdays for weekly: 1 is Monday, 7 is Sunday.' },
        target: { type: 'string', enum: ['session', 'this', 'new'], description: 'Where to deliver; defaults to session.' },
        session: { type: 'string', description: 'Session id or part of its title when target is session.' },
        cwd: { type: 'string', description: 'Working directory for a new Session when target is new.' },
        id: { type: 'string', description: 'Schedule id, required for delete.' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
      render: (_args, value) => [{ type: 'text', text: String(value === null || value === undefined ? '' : value.summary ?? '') }],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const request = args !== null && typeof args === 'object' ? args : {}
      const action = String(request.action ?? '')
      if (action === 'list') return { summary: await listSummary(ctx) }
      if (action === 'delete') return await deleteSummary(ctx, request)
      if (action !== 'create') throw new Error('action must be create, list, or delete')
      return await createSummary(ctx, request, exec)
    },
  }
}

/**
 * @param ctx - Host context carrying `schedule`.
 * @returns the active schedules as text.
 */
async function listSummary(ctx) {
  const entries = await ctx.schedule.catalog()
  const active = entries.filter(entry => entry.status === 'active')
  if (active.length === 0) return 'No active schedule.'
  return active.map(entry => `- ${entry.id} · ${entry.title} · ${describeTiming(entry)} · ${describeTarget(entry.target)} · ${entry.status}`).join('\n')
}

/**
 * @param ctx - Host context carrying `schedule`.
 * @param request - the tool request.
 * @returns the deletion summary.
 */
async function deleteSummary(ctx, request) {
  const id = String(request.id ?? '')
  if (id === '') throw new Error('id is required for delete')
  const result = await ctx.schedule.edit({ id, action: 'delete' })
  if (result !== null && typeof result === 'object' && result.deleted === false) {
    return { summary: `Schedule ${id} does not exist.` }
  }
  return { summary: `Deleted schedule ${id}.` }
}

/**
 * @param ctx - Host context carrying `schedule`.
 * @param request - the tool request, already clarified with the user.
 * @param exec - the running execution, whose agent names the current Session.
 * @returns the creation summary.
 */
async function createSummary(ctx, request, exec) {
  const title = String(request.title ?? '').trim()
  const prompt = String(request.prompt ?? '').trim()
  if (title === '') throw new Error('title is required')
  if (prompt === '') throw new Error('prompt is required')
  const time = clockOf(String(request.time ?? ''))
  if (time === '') throw new Error('time must be HH:mm')
  const repeat = String(request.repeat ?? 'once')
  const date = String(request.date ?? '')
  if (repeat === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD for a one-off schedule')
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timing = repeat === 'daily'
    ? { kind: 'daily', daily: { time, time_zone: timeZone } }
    : repeat === 'weekly'
      ? { kind: 'weekly', weekly: { time, time_zone: timeZone, weekdays: weekdaysOf(request, date) } }
      : { kind: 'at', at: { date, time, time_zone: timeZone } }
  const target = await resolveTarget(ctx, request, exec)
  const entry = await ctx.schedule.create({ title, prompt, timing, target })
  return {
    summary: `Created schedule ${entry.id} "${entry.title}": ${describeTiming(entry)} (${timeZone}), ${describeTarget(entry.target)}; next run ${entry.scheduledAt}.`,
  }
}

/**
 * @param request - the tool request.
 * @param date - the start date, whose weekday fills in a missing weekly rule.
 * @returns ISO weekdays, Monday first.
 */
function weekdaysOf(request, date) {
  const given = Array.isArray(request.weekdays) ? request.weekdays.map(Number).filter(day => Number.isInteger(day) && day >= 1 && day <= 7) : []
  if (given.length > 0) return [...new Set(given)].sort((left, right) => left - right)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('weekdays or date is required for a weekly schedule')
  const [year, month, day] = date.split('-').map(Number)
  return [((new Date(year, month - 1, day).getDay() + 6) % 7) + 1]
}

/**
 * @param ctx - Host context carrying `sessionQuery`.
 * @param request - the tool request.
 * @param exec - the running execution.
 * @returns the schedule target request.
 */
async function resolveTarget(ctx, request, exec) {
  const kind = String(request.target ?? 'session')
  if (kind === 'this') {
    const sessionId = exec.agent === undefined ? undefined : exec.agent.id
    if (sessionId === undefined) throw new Error('The current Session is unknown; name a target session instead')
    return { kind: 'session', sessionId }
  }
  if (kind === 'new') {
    const cwd = String(request.cwd ?? '').trim()
    return cwd === '' ? { kind: 'new' } : { kind: 'new', create: { cwd } }
  }
  const needle = String(request.session ?? '').trim()
  if (needle === '') throw new Error('session is required when target is session')
  return { kind: 'session', sessionId: await resolveSession(ctx, needle) }
}

/**
 * @param ctx - Host context carrying `sessionQuery`.
 * @param needle - a Session id or part of its title.
 * @returns the one matching Session id.
 */
async function resolveSession(ctx, needle) {
  const records = (await ctx.sessionQuery.listSessions()).filter(record => record.header.origin !== 'subagent')
  const direct = records.find(record => record.header.id === needle)
  if (direct !== undefined) return direct.header.id
  const titles = await titlesOf(ctx, records.slice(0, 200).map(record => record.header.id))
  const matches = records.filter(record => (titles.get(record.header.id) ?? '').includes(needle))
  if (matches.length === 1) return matches[0].header.id
  if (matches.length === 0) throw new Error(`No Session matches "${needle}".`)
  const candidates = matches.slice(0, 5).map(record => `${titles.get(record.header.id) ?? 'untitled'} (${record.header.id})`).join('; ')
  throw new Error(`Several Sessions match "${needle}": ${candidates}. Call again with a full id.`)
}

/**
 * @param value - a clock reading such as `9:30` or `09:30:00`.
 * @returns `HH:mm:ss`, or an empty string when unreadable.
 */
function clockOf(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (match === null) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] === undefined ? 0 : Number(match[3])
  if (hour > 23 || minute > 59 || second > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

/**
 * @param entry - one stored schedule.
 * @returns its recurrence as text.
 */
function describeTiming(entry) {
  if (entry.kind === 'daily') return `every day at ${entry.time}`
  if (entry.kind === 'weekly') return `every ${(entry.weekdays ?? []).join(',')} at ${entry.time}`
  if (entry.kind === 'every') return `every ${entry.everySeconds}s`
  if (entry.kind === 'cron') return `cron ${entry.expression}`
  if (entry.kind === 'rrule') return `rule ${entry.rrule}`
  return `once at ${entry.scheduledAt}`
}

/**
 * @param target - one stored schedule target.
 * @returns the target as text.
 */
function describeTarget(target) {
  if (target.kind === 'session') return `session ${target.sessionId}`
  return `new session${target.create?.cwd === undefined ? '' : ` in ${target.create.cwd}`}`
}

/** A request the page can correct, answered with its own status. */
class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * Answer one activity request, keeping failures machine-readable.
 * @param ctx - Host context used for logging.
 * @param produce - builds the JSON body.
 * @returns the HTTP response.
 */
async function respond(ctx, produce) {
  try {
    return json(await produce(), 200)
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status)
    ctx.logger.warn('work-calendar: activity request failed', error)
    return json({ error: 'Session activity is unavailable' }, 500)
  }
}

/**
 * @param body - JSON-serializable body.
 * @param status - HTTP status.
 * @returns a no-store JSON response.
 */
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Build the day buckets the page asked for.
 * @param ctx - Host context carrying `sessionQuery`.
 * @param cache - Session id to cached event list.
 * @param request - the page's request.
 * @returns `{ generatedAt, days }`, one entry per requested day that has activity.
 */
async function activity(ctx, cache, request) {
  const { keys, bounds, detail } = readRequest(request)
  const scanned = await scanSessions(ctx, cache, bounds)
  const titles = await titlesOf(ctx, scanned.map(entry => entry.header.id))

  const days = new Map(keys.map(key => [key, []]))
  for (const entry of scanned) {
    const label = titles.get(entry.header.id) ?? ''
    for (const bucket of entry.buckets) {
      const sessions = days.get(keys[bucket.index])
      if (sessions === undefined) continue
      sessions.push({
        id: entry.header.id,
        title: label,
        cwd: entry.header.cwd ?? '',
        start: bucket.start,
        end: bucket.end,
        userMessages: bucket.user,
        assistantMessages: bucket.assistant,
        toolCalls: bucket.tools,
        turns: bucket.turns,
        tokens: bucket.tokens,
      })
    }
  }

  const assembled = []
  for (const [key, sessions] of days) {
    if (sessions.length === 0) continue
    sessions.sort((left, right) => left.start - right.start)
    if (detail) addDetails(sessions, scanned, bounds, keys.indexOf(key))
    assembled.push({ key, sessions })
  }

  return { generatedAt: Date.now(), days: assembled }
}

/**
 * List recent Sessions a new schedule can target.
 * @param ctx - Host context carrying `sessionQuery`.
 * @param request - the page's request; `limit` bounds the list.
 * @returns newest-first Sessions without their event logs.
 */
async function sessionChoices(ctx, request) {
  const url = new URL(request.url)
  const asked = Number(url.searchParams.get('limit') ?? SESSION_CHOICES)
  const limit = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), 50) : SESSION_CHOICES
  const records = (await ctx.sessionQuery.listSessions())
    .filter(record => record.header.origin !== 'subagent')
    .slice(0, limit)
  const titles = await titlesOf(ctx, records.map(record => record.header.id))
  return {
    sessions: records.map(record => ({
      id: record.header.id,
      title: titles.get(record.header.id) ?? '',
      cwd: record.header.cwd ?? '',
      live: record.live,
    })),
  }
}

/**
 * Read the page's day boundaries.
 * @param request - the incoming request.
 * @returns keys, the boundaries between them, and whether details were requested.
 */
function readRequest(request) {
  const url = new URL(request.url)
  const keys = (url.searchParams.get('keys') ?? '').split(',').filter(key => key !== '')
  const bounds = (url.searchParams.get('bounds') ?? '').split(',').filter(value => value !== '').map(Number)
  if (keys.length === 0) throw new RequestError(400, 'No day buckets were requested')
  if (keys.length > MAX_BUCKETS) throw new RequestError(400, 'Too many day buckets were requested')
  if (bounds.length !== keys.length + 1) throw new RequestError(400, 'Day boundaries do not match the requested days')
  for (let index = 0; index < keys.length; index += 1) {
    if (!Number.isFinite(bounds[index]) || !Number.isFinite(bounds[index + 1])) {
      throw new RequestError(400, 'Day boundaries must be finite timestamps')
    }
    if (bounds[index + 1] <= bounds[index]) throw new RequestError(400, 'Day boundaries must ascend')
  }
  return { keys, bounds, detail: url.searchParams.get('detail') === '1' }
}

/**
 * Load each candidate Session's events and bucket them into the requested days.
 * @param ctx - Host context carrying `sessionQuery`.
 * @param cache - Session id to cached event list.
 * @param bounds - ascending day boundaries.
 * @returns one entry per Session with any activity in range.
 */
async function scanSessions(ctx, cache, bounds) {
  const from = bounds[0]
  const to = bounds[bounds.length - 1]
  const records = await ctx.sessionQuery.listSessions()
  const revisions = await revisionsOf(ctx)
  const roots = records
    .filter(record => record.header.origin !== 'subagent')
    .filter(record => record.header.createdAt < to)
    .slice(0, SESSION_LIMIT)

  const scanned = await mapPool(roots, SESSION_CONCURRENCY, async (record) => {
    let events
    try {
      events = await eventsOf(ctx, cache, record.header.id, revisions.get(record.header.id))
    } catch (error) {
      ctx.logger.debug(`work-calendar: skipped unreadable session ${record.header.id}: ${String(error)}`)
      return undefined
    }
    const buckets = bucketsOf(events, bounds, from, to)
    return buckets.length === 0 ? undefined : { header: record.header, buckets, events }
  })
  return scanned.filter(entry => entry !== undefined)
}

/**
 * Read each stored Session's opaque change token, so a cached event list is
 * reused exactly while its Session log is unchanged.
 * @param ctx - Host context carrying `sessionPersistence`.
 * @returns Session id to revision; empty when persistence cannot list them.
 */
async function revisionsOf(ctx) {
  try {
    const snapshots = await ctx.sessionPersistence.list()
    return new Map(snapshots.map(snapshot => [snapshot.header.id, snapshot.revision]))
  } catch (error) {
    ctx.logger.debug(`work-calendar: session revisions are unavailable: ${String(error)}`)
    return new Map()
  }
}

/**
 * Read one Session's event list, reusing the cached copy while the log is unchanged.
 * @param ctx - Host context carrying `sessionQuery`.
 * @param cache - Session id to cached event list.
 * @param id - the Session to read.
 * @param revision - its current change token, or undefined when unknown.
 * @returns lightweight event records in seq order.
 */
async function eventsOf(ctx, cache, id, revision) {
  const now = Date.now()
  const hit = cache.get(id)
  if (hit !== undefined) {
    if (revision !== undefined && hit.revision === revision) return hit.events
    if (revision === undefined && hit.revision === undefined && now - hit.at < CACHE_TTL_MS) return hit.events
  }
  const snapshot = await ctx.sessionQuery.readSession(id)
  const events = snapshot.events.map(event => ({
    time: event.time,
    type: event.type,
    tokens: event.type === 'assistant/message' ? tokensOf(event.data.usage) : 0,
    prompt: event.type === 'user/message' ? promptOf(event.data) : '',
  }))
  cache.set(id, { at: now, revision, events })
  if (cache.size > SESSION_LIMIT * 2) {
    for (const [key, entry] of cache) {
      if (now - entry.at >= CACHE_TTL_MS) cache.delete(key)
    }
  }
  return events
}

/**
 * Count one Session's activity per requested day.
 * @param events - the Session's event records.
 * @param bounds - ascending day boundaries.
 * @param from - first instant in range.
 * @param to - exclusive end instant in range.
 * @returns non-empty day buckets ordered by start.
 */
/**
 * Read a message the reader typed, ignoring context the Harness injected.
 * @param message - one `user/message` payload.
 * @returns its first line, or an empty string for injected context.
 */
function promptOf(message) {
  if (message.source?.kind !== 'user') return ''
  const blocks = Array.isArray(message.content) ? message.content : []
  const text = blocks.filter(block => block.type === 'text').map(block => block.text).join(' ')
  return firstLine(text)
}

/**
 * @param usage - one assistant message's reported usage.
 * @returns the tokens that message consumed.
 */
function tokensOf(usage) {
  if (usage === undefined) return 0
  return usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
}

function bucketsOf(events, bounds, from, to) {
  const buckets = new Map()
  for (const event of events) {
    if (event.time < from || event.time >= to) continue
    const index = bucketIndexOf(bounds, event.time)
    let bucket = buckets.get(index)
    if (bucket === undefined) {
      bucket = { index, start: event.time, end: event.time, user: 0, assistant: 0, tools: 0, turns: 0, tokens: 0 }
      buckets.set(index, bucket)
    }
    if (event.time < bucket.start) bucket.start = event.time
    if (event.time > bucket.end) bucket.end = event.time
    bucket.tokens += event.tokens
    if (event.type === 'user/message') bucket.user += 1
    else if (event.type === 'assistant/message') bucket.assistant += 1
    else if (event.type === 'tool/call') bucket.tools += 1
    else if (event.type === 'turn/end') bucket.turns += 1
  }
  return [...buckets.values()].sort((left, right) => left.index - right.index)
}

/**
 * @param bounds - ascending day boundaries.
 * @param time - instant inside the range.
 * @returns the day bucket index holding `time`.
 */
function bucketIndexOf(bounds, time) {
  for (let index = 0; index < bounds.length - 1; index += 1) {
    if (time < bounds[index + 1]) return index
  }
  return bounds.length - 2
}

/**
 * Fold the latest log-backed title for each Session.
 * @param ctx - Host context carrying `sessionQuery`.
 * @param ids - Sessions to read.
 * @returns Session id to title, omitting Sessions without one.
 */
async function titlesOf(ctx, ids) {
  const titles = new Map()
  if (ids.length === 0) return titles
  try {
    const results = await ctx.sessionQuery.readTitleSnapshots(ids)
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const title = result.value.title?.title?.trim()
      if (title !== undefined && title !== '') titles.set(result.sessionId, title)
    }
  } catch (error) {
    ctx.logger.debug(`work-calendar: titles are unavailable: ${String(error)}`)
  }
  return titles
}

/**
 * Fill one day's sessions with the prompts, tools, and files behind them.
 * @param ctx - Host context carrying `sessionQuery`.
 * @param sessions - the day's sessions, already ordered by start.
 * @param bounds - ascending day boundaries.
 * @param index - the requested day's bucket index.
 * @returns resolution once the sessions carry their details.
 */
function addDetails(sessions, scanned, bounds, index) {
  const from = bounds[index]
  const to = bounds[index + 1]
  const bySession = new Map(scanned.map(entry => [entry.header.id, entry.events]))
  for (const session of sessions.slice(0, DETAIL_SESSION_LIMIT)) {
    const events = bySession.get(session.id) ?? []
    const prompts = []
    for (const event of events) {
      if (event.time < from || event.time >= to) continue
      if (event.prompt !== '' && !prompts.includes(event.prompt)) prompts.push(event.prompt)
    }
    session.prompts = prompts.slice(0, PROMPT_LIMIT)
  }
}

/**
 * Reduce one Session's semantic event documents to the day's work evidence.
 * @param documents - matching event documents in seq order.
 * @returns the prompts asked, tool counts, and files written.
 */
/**
 * @param text - one event's semantic text.
 * @returns its first non-empty line, collapsed and clipped.
 */
function firstLine(text) {
  const line = text.split('\n').find(candidate => candidate.trim() !== '') ?? ''
  return line.replace(/\s+/g, ' ').trim().slice(0, PROMPT_CHARS)
}

/**
 * Run one asynchronous step per item with bounded concurrency.
 * @param items - items to process.
 * @param limit - maximum concurrent steps.
 * @param step - the step, allowed to fail per item.
 * @returns results in input order.
 */
async function mapPool(items, limit, step) {
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await step(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}
