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
