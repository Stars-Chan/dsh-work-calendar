/**
 * Browser half of the work-calendar bundle: the "Work calendar" panel in the
 * main column.
 *
 * The month grid shows what each day's Sessions did; selecting a day asks the
 * Host for that day's prompts, tools, and files. Nothing here reads the Session
 * log directly — the Host digests it behind `/api/work-calendar/activity`.
 */

window.__ModuleLoader__.load({
  id: 'dsh-work-calendar',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useState } = React

    const NS = 'work-calendar'
    const PANEL_ID = 'work-calendar'
    const ROUTE = '/api/work-calendar/activity'
    const PEEK_ROWS = 5
    const SCHEDULE_ROWS = 3
    const PEEK_MIN_HEIGHT = 195

    const ZH = {
      panel: '工作日历',
      title: '工作日历',
      today: '今天',
      refresh: '刷新',
      previousMonth: '上个月',
      nextMonth: '下个月',
      monthNames: '1月|2月|3月|4月|5月|6月|7月|8月|9月|10月|11月|12月',
      monthLabel: '{year}年{month}',
      dayLabel: '{month}{day}日',
      dayWithWeekday: '{day} · 周{weekday}',
      weekdays: '一,二,三,四,五,六,日',
      loading: '正在读取会话记录',
      loadFailed: '无法读取会话记录',
      retry: '重试',
      emptyMonth: '这个月还没有工作记录',
      emptyDay: '这一天没有工作记录',
      untitled: '未命名会话',
      turns: '{count} 轮',
      sessionCount: '{count} 个会话',
      tokens: '{count} tok',
      more: '还有 {count} 个会话',
      schedules: '日程',
      sessionsLabel: '会话',
      newSchedule: '新建日程',
      noSchedules: '这一天没有日程',
      scheduleCount: '{count} 个日程',
      repeatOnce: '一次性',
      repeatDaily: '每天',
      repeatWeekly: '每周{weekdays}',
      repeatWeeklyPlain: '每周',
      repeatEvery: '每 {minutes} 分钟',
      repeatRule: '自定义规则',
      statusActive: '已启用',
      statusPaused: '已暂停',
      statusEnded: '已执行',
      targetSession: '会话「{title}」',
      targetNew: '新会话',
      historyLast: '上次执行 {time}',
      historyEmpty: '还没有执行记录',
      historyDelivered: '已投递',
      moreSchedules: '还有 {count} 个日程',
      actionRun: '立即执行',
      actionPause: '暂停',
      actionResume: '恢复',
      actionEdit: '编辑',
      actionDelete: '删除',
      actionHistory: '历史',
      formTitle: '标题',
      formPrompt: '到点发送的内容',
      formDate: '日期',
      formTime: '时间',
      formRepeat: '重复',
      formTarget: '执行会话',
      formTargetNew: '新会话…',
      formCwd: '工作目录',
      formCwdPlaceholder: '留空则使用默认目录',
      formPickDirectory: '选择',
      formSave: '保存',
      formSaving: '保存中',
      formCancel: '取消',
      formWeekdays: '星期',
      showAll: '展开全部 {count} 条',
      showLess: '收起',
      actionDeleteConfirm: '确认删除',
      formRequired: '标题和内容不能为空',
      errorArchived: '目标会话已归档',
      errorConflict: '日程已被改动，请重试',
      errorPending: '上一次执行还没结束',
      errorGeneric: '操作失败',
      openSession: '打开会话',
      hours: '{hours} 小时',
      minutes: '{minutes} 分钟',
      hoursMinutes: '{hours} 小时 {minutes} 分',
    }

    const EN = {
      panel: 'Work calendar',
      title: 'Work calendar',
      today: 'Today',
      refresh: 'Refresh',
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      monthNames: 'January|February|March|April|May|June|July|August|September|October|November|December',
      monthLabel: '{month} {year}',
      dayLabel: '{month} {day}',
      dayWithWeekday: '{weekday}, {day}',
      weekdays: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
      loading: 'Reading session history',
      loadFailed: 'Session history is unavailable',
      retry: 'Retry',
      emptyMonth: 'No work recorded this month',
      emptyDay: 'No work recorded this day',
      untitled: 'Untitled session',
      turns: '{count} turns',
      sessionCount: '{count} sessions',
      tokens: '{count} tok',
      more: '{count} more sessions',
      schedules: 'Schedules',
      sessionsLabel: 'Sessions',
      newSchedule: 'New schedule',
      noSchedules: 'No schedule on this day',
      scheduleCount: '{count} schedules',
      repeatOnce: 'Once',
      repeatDaily: 'Every day',
      repeatWeekly: 'Every {weekdays}',
      repeatWeeklyPlain: 'Every week',
      repeatEvery: 'Every {minutes} min',
      repeatRule: 'Custom rule',
      statusActive: 'Active',
      statusPaused: 'Paused',
      statusEnded: 'Delivered',
      targetSession: 'Session "{title}"',
      targetNew: 'New session',
      historyLast: 'Last run {time}',
      historyEmpty: 'No delivery yet',
      historyDelivered: 'Delivered',
      moreSchedules: '{count} more schedules',
      actionRun: 'Run now',
      actionPause: 'Pause',
      actionResume: 'Resume',
      actionEdit: 'Edit',
      actionDelete: 'Delete',
      actionHistory: 'History',
      formTitle: 'Title',
      formPrompt: 'What to send',
      formDate: 'Date',
      formTime: 'Time',
      formRepeat: 'Repeat',
      formTarget: 'Target session',
      formTargetNew: 'New session…',
      formCwd: 'Working directory',
      formCwdPlaceholder: 'Leave empty for the default',
      formPickDirectory: 'Choose',
      formSave: 'Save',
      formSaving: 'Saving',
      formCancel: 'Cancel',
      formWeekdays: 'Weekdays',
      showAll: 'Show all {count}',
      showLess: 'Show less',
      actionDeleteConfirm: 'Confirm',
      formRequired: 'A title and a message are required',
      errorArchived: 'The target session is archived',
      errorConflict: 'The schedule changed meanwhile',
      errorPending: 'The previous run is still finishing',
      errorGeneric: 'That did not work',
      openSession: 'Open session',
      hours: '{hours} h',
      minutes: '{minutes} min',
      hoursMinutes: '{hours} h {minutes} min',
    }

    const CSS = `
.wc-page, .wc-page * { box-sizing: border-box; }
.wc-page {
  --wc-canvas: #f7f4ee;
  --wc-surface: #fcf9f3;
  --wc-surface-2: #efe9de;
  --wc-line: rgba(27, 42, 37, 0.10);
  --wc-line-strong: rgba(27, 42, 37, 0.20);
  --wc-accent: #2e5e54;
  --wc-accent-soft: #e9f0ec;
  --wc-accent-line: rgba(46, 94, 84, 0.32);
  --wc-accent-ink: #fffefb;
  --wc-ink: #1b2a25;
  --wc-ink-soft: #68766f;
  display: flex; flex-direction: column; height: 100%; min-width: 0; min-height: 0; overflow: hidden;
  background-color: var(--wc-canvas); color: var(--wc-ink); font-size: 13px; line-height: 1.5;
}
body[data-ds-dark-theme] .wc-page {
  --wc-canvas: #131618;
  --wc-surface: #191d1f;
  --wc-surface-2: #21262a;
  --wc-line: rgba(255, 255, 255, 0.08);
  --wc-line-strong: rgba(255, 255, 255, 0.18);
  --wc-accent: #86b7a6;
  --wc-accent-soft: rgba(134, 183, 166, 0.14);
  --wc-accent-line: rgba(134, 183, 166, 0.34);
  --wc-accent-ink: #0e1214;
  --wc-ink: #eae7e0;
  --wc-ink-soft: #96a29c;
}
.wc-head { display: flex; flex: none; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 28px clamp(24px, 4vw, 48px) 16px; }
.wc-pagetitle { font-size: 20px; font-weight: 500; line-height: 28px; margin: 0; letter-spacing: 0.01em; }
.wc-subtitle { margin: 4px 0 0; color: var(--wc-ink-soft); font-size: 13px; font-variant-numeric: tabular-nums; }
.wc-nav { display: flex; align-items: center; gap: 8px; }
.wc-navgroup { display: flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--wc-line); border-radius: var(--dsw-radius-md); background-color: var(--wc-surface); }
.wc-button { display: inline-flex; align-items: center; justify-content: center; height: 28px; min-width: 28px; padding: 0 10px; border: 1px solid var(--wc-line); border-radius: var(--dsw-radius-sm); background-color: var(--wc-surface); color: var(--wc-ink); font: inherit; cursor: pointer; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease; }
.wc-navgroup .wc-button { border-color: transparent; background-color: transparent; }
.wc-button:hover { border-color: var(--wc-line-strong); }
.wc-button:focus-visible { outline: 2px solid var(--wc-accent); outline-offset: 1px; }
.wc-button[data-primary='true'] { border-color: transparent; background-color: var(--wc-accent); color: var(--wc-accent-ink); font-weight: 500; }
.wc-button[data-primary='true']:hover { background-color: var(--wc-accent); border-color: transparent; opacity: 0.92; }
.wc-scroll { display: flex; flex: 1; flex-direction: column; min-height: 0; overflow: hidden; padding: 0 clamp(24px, 4vw, 48px); }
.wc-body { display: grid; flex: 1; grid-template-columns: minmax(0, 1fr) minmax(288px, 336px); grid-template-rows: minmax(0, 1fr); align-items: stretch; gap: 24px; min-height: 0; max-width: 1180px; width: 100%; margin: 0 auto; }
.wc-calendar { min-width: 0; min-height: 0; overflow: auto; padding-bottom: 40px; scrollbar-gutter: stable; }
.wc-weekdays { position: sticky; top: 0; z-index: 1; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 0 0 8px; background: var(--wc-canvas); }
.wc-weekday { padding-left: 12px; color: var(--wc-ink-soft); font-size: 11px; letter-spacing: 0.06em; }
.wc-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); overflow: hidden; border: 1px solid var(--wc-line); border-radius: var(--dsw-radius-xl); background-color: transparent; }
.wc-cell { position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; min-height: 88px; padding: 10px 12px; border: 0; background-color: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background-color 120ms ease; }
.wc-cell[data-row='1'], .wc-cell[data-row='2'], .wc-cell[data-row='3'], .wc-cell[data-row='4'], .wc-cell[data-row='5'] { box-shadow: inset 0 1px 0 var(--wc-line); }
.wc-cell::before { content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none; background-color: var(--wc-accent); opacity: calc(var(--wc-heat, 0) * 0.07); }
.wc-cell > * { position: relative; z-index: 1; }
.wc-cell:hover { background-color: var(--wc-surface-2); }
.wc-cell:focus-visible { outline: 2px solid var(--wc-accent); outline-offset: -2px; }
.wc-cell[data-outside='true'] { color: var(--wc-ink-soft); opacity: 0.45; }
.wc-cell[data-outside='true']::before { opacity: 0; }
.wc-cell[data-selected='true'] { box-shadow: inset 0 0 0 2px var(--wc-accent); background-color: var(--wc-accent-soft); }
.wc-cell[data-selected='true']:hover { background-color: var(--wc-accent-soft); }
.wc-day { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 20px; }
.wc-daynum { font-size: 12px; font-variant-numeric: tabular-nums; }
.wc-cell[data-weekend='true'] .wc-daynum { color: var(--wc-ink-soft); }
.wc-cell[data-today='true'] .wc-daynum { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; margin-left: -4px; border-radius: 50%; corner-shape: round; background-color: var(--wc-accent); color: var(--wc-accent-ink); font-weight: 500; }
.wc-stats { display: -webkit-box; margin-top: auto; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: var(--wc-ink-soft); font-size: 10px; line-height: 1.45; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.wc-peek .wc-schedcount { cursor: pointer; }
.wc-peek .wc-schedcount:hover { background-color: var(--wc-accent); color: var(--wc-accent-ink); }
.wc-schedcount { flex: none; min-width: 16px; padding: 0 4px; border: 1px solid var(--wc-accent-line); border-radius: 999px; corner-shape: round; background-color: var(--wc-accent-soft); color: var(--wc-accent); font-size: 10px; line-height: 14px; text-align: center; font-variant-numeric: tabular-nums; }
.wc-peek { position: fixed; z-index: 60; left: var(--wc-to-left); top: var(--wc-to-top); width: var(--wc-to-width); height: var(--wc-to-height); display: flex; flex-direction: column; gap: 4px; overflow: hidden; padding: 14px 16px; border: 0; border-radius: var(--dsw-radius-xl); background-color: var(--wc-surface); box-shadow: 0 0 0 1px var(--wc-line), 0 24px 48px -24px rgba(27, 42, 37, 0.45); cursor: pointer; animation: wc-peek-grow 360ms cubic-bezier(0.24, 0.72, 0.24, 1) both; }
.wc-peek[data-closing='true'] { animation: wc-peek-shrink 170ms cubic-bezier(0.4, 0, 1, 1) both; }
@keyframes wc-peek-grow {
  from { left: var(--wc-from-left); top: var(--wc-from-top); width: var(--wc-from-width); height: var(--wc-from-height); padding: 10px; border-radius: 0; box-shadow: none; }
  to { left: var(--wc-to-left); top: var(--wc-to-top); width: var(--wc-to-width); height: var(--wc-to-height); padding: 14px 16px; border-radius: var(--dsw-radius-xl); box-shadow: 0 0 0 1px var(--wc-line), 0 24px 48px -24px rgba(27, 42, 37, 0.45); }
}
@keyframes wc-peek-shrink {
  from { left: var(--wc-to-left); top: var(--wc-to-top); width: var(--wc-to-width); height: var(--wc-to-height); padding: 14px 16px; border-radius: var(--dsw-radius-xl); box-shadow: 0 0 0 1px var(--wc-line), 0 24px 48px -24px rgba(27, 42, 37, 0.45); opacity: 1; }
  to { left: var(--wc-from-left); top: var(--wc-from-top); width: var(--wc-from-width); height: var(--wc-from-height); padding: 10px; border-radius: 0; box-shadow: none; opacity: 0.5; }
}
.wc-peek-body { position: relative; flex: 1; min-height: 0; }
.wc-peek-counts { position: absolute; left: 0; right: 0; bottom: 0; animation: wc-peek-fade-out 140ms ease 60ms forwards; }
.wc-peek-list { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; animation: wc-peek-fade-in 200ms ease 140ms forwards; }
.wc-peek-rows { display: flex; flex-direction: column; gap: 5px; max-width: 100%; min-width: 0; }
@keyframes wc-peek-fade-out { to { opacity: 0; } }
@keyframes wc-peek-fade-in { to { opacity: 1; } }
.wc-section { display: flex; flex-direction: column; gap: 8px; }
.wc-sectionhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
.wc-sectiontitle { display: flex; align-items: center; gap: 6px; color: var(--wc-ink-soft); font-size: 11px; letter-spacing: 0.06em; }
.wc-sectiontitle::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background-color: currentColor; opacity: 0.6; }
.wc-section[data-kind='schedules'] .wc-sectiontitle { color: var(--wc-accent); }
.wc-sectionempty { margin: 0; color: var(--wc-ink-soft); font-size: 11px; }
.wc-sectionerror { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 11px; }
.wc-sectionmore { align-self: flex-start; }
.wc-sched { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border: 1px solid var(--wc-accent-line); border-radius: var(--dsw-radius-lg); background-color: var(--wc-accent-soft); transition: border-color 120ms ease, background-color 120ms ease; }
.wc-sched:hover { border-color: var(--wc-accent); }
.wc-schedtop { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--wc-ink-soft); font-size: 11px; font-variant-numeric: tabular-nums; }
.wc-schedtime { color: var(--wc-accent); font-weight: 500; }
.wc-schedtitle { font-size: 13px; font-weight: 500; color: var(--wc-ink); overflow-wrap: anywhere; }
.wc-schedmeta { color: var(--wc-ink-soft); font-size: 11px; }
.wc-schedactions { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 2px; }
.wc-schedhistory { display: flex; flex-direction: column; gap: 2px; padding-top: 3px; border-top: 1px solid var(--wc-accent-line); }
.wc-action { padding: 2px 6px; border: 0; border-radius: var(--dsw-radius-xs); background-color: transparent; color: var(--wc-ink-soft); font: inherit; font-size: 11px; cursor: pointer; }
.wc-action:hover { background-color: var(--wc-surface-2); color: var(--wc-ink); }
.wc-action:focus-visible { outline: 2px solid var(--wc-accent); outline-offset: 1px; }
.wc-form { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--wc-line); border-radius: var(--dsw-radius-lg); background-color: var(--wc-surface); }
.wc-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.wc-fieldrow { display: flex; align-items: center; gap: 8px; }
.wc-fieldrow .wc-field { flex: 1; }
.wc-fieldlabel { color: var(--wc-ink-soft); font-size: 11px; }
.wc-input, .wc-select, .wc-textarea { width: 100%; min-width: 0; border: 1px solid var(--wc-line); border-radius: var(--dsw-radius-sm); background-color: var(--wc-surface); color: var(--wc-ink); font: inherit; font-size: 12px; }
.wc-input, .wc-select { height: 26px; padding: 3px 8px; }
.wc-textarea { min-height: 54px; padding: 4px 8px; resize: vertical; }
.wc-input:focus-visible, .wc-select:focus-visible, .wc-textarea:focus-visible { outline: 2px solid var(--wc-accent); outline-offset: 1px; }
.wc-weekdays-pick { display: flex; flex-wrap: wrap; gap: 4px; }
.wc-weekdaytoggle { min-width: 24px; height: 22px; padding: 0 4px; border: 1px solid var(--wc-line); border-radius: var(--dsw-radius-xs); background-color: transparent; color: var(--wc-ink-soft); font: inherit; font-size: 11px; cursor: pointer; }
.wc-weekdaytoggle[data-on='true'] { border-color: var(--wc-accent-line); background-color: var(--wc-accent-soft); color: var(--wc-accent); }
.wc-weekdaytoggle:focus-visible { outline: 2px solid var(--wc-accent); outline-offset: 1px; }
.wc-formerror { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 11px; }
.wc-formactions { display: flex; justify-content: flex-end; gap: 8px; }
.wc-detail { display: flex; flex-direction: column; gap: 14px; min-width: 0; min-height: 0; overflow: auto; padding-bottom: 40px; scrollbar-gutter: stable; }
.wc-detailhead { display: flex; flex-direction: column; gap: 2px; padding-bottom: 10px; border-bottom: 1px solid var(--wc-line); }
.wc-detailtitle { font-size: 15px; font-weight: 500; line-height: 22px; margin: 0; letter-spacing: 0.01em; }
.wc-detailmeta { color: var(--wc-ink-soft); font-size: 12px; margin: 0; font-variant-numeric: tabular-nums; }
.wc-sessions { display: flex; flex-direction: column; gap: 8px; }
.wc-session { display: flex; flex-direction: column; gap: 5px; padding: 10px 12px; border: 1px solid var(--wc-line); border-radius: var(--dsw-radius-lg); background-color: var(--wc-surface); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color 120ms ease, background-color 120ms ease; }
.wc-session:hover { border-color: var(--wc-accent-line); background-color: var(--wc-surface-2); }
.wc-session:focus-visible { outline: 2px solid var(--wc-accent); outline-offset: 2px; }
.wc-sessiontop { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--wc-ink-soft); font-size: 11px; font-variant-numeric: tabular-nums; }
.wc-sessiontitle { margin: 0; font-size: 13px; font-weight: 500; line-height: 1.45; overflow-wrap: anywhere; }
.wc-sessionmeta { margin: 0; overflow: hidden; color: var(--wc-ink-soft); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.wc-prompts { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.wc-prompt { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin: 0; padding-left: 8px; border-left: 2px solid var(--wc-accent-line); color: var(--wc-ink-soft); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.wc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 120px; padding: 16px; color: var(--wc-ink-soft); font-size: 12px; text-align: center; }
.wc-spinner { width: 16px; height: 16px; border: 2px solid var(--wc-line-strong); border-top-color: var(--wc-accent); border-radius: 50%; animation: wc-spin 0.8s linear infinite; }
@keyframes wc-spin { to { transform: rotate(360deg); } }
.wc-notice { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: var(--dsw-radius-md); background-color: var(--wc-surface); font-size: 12px; }
.wc-row { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.wc-rowtime { flex: none; color: var(--wc-accent); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
.wc-index { flex: none; min-width: 11px; color: var(--wc-ink-soft); font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; }
.wc-item { flex: 1; min-width: 0; overflow: hidden; font-size: 12px; line-height: 1.5; text-overflow: ellipsis; white-space: nowrap; }
.wc-peekmore { color: var(--wc-ink-soft); font-size: 11px; }
@media (max-width: 1000px) {
  .wc-scroll { display: block; overflow: auto; padding-bottom: 40px; }
  .wc-body { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; height: auto; }
  .wc-calendar, .wc-detail { overflow: visible; padding-bottom: 0; }
  .wc-weekdays { position: static; }
}
@media (max-width: 720px) {
  .wc-weekday { padding-left: 0; text-align: center; }
  .wc-grid { border-radius: var(--dsw-radius-md); }
  .wc-cell { min-height: 52px; padding: 6px 4px; align-items: center; justify-content: center; }
  .wc-day { flex-direction: column; align-items: center; gap: 3px; }
  .wc-cell .wc-stats { display: none; }
  .wc-cell[data-selected='true'] { box-shadow: inset 0 0 0 1px var(--wc-accent); }
}
@media (hover: none) { .wc-peek { display: none; } }
@media (prefers-reduced-motion: reduce) { .wc-peek, .wc-peek-counts, .wc-peek-list { animation: none; } .wc-peek-counts { display: none; } .wc-peek-list { opacity: 1; } }
[data-platform='darwin'] .wc-head { padding-top: calc(28px + var(--dsw-frame-top-clearance, 0px)); }
`

    /**
     * @param value - a date inside the month to show.
     * @returns its first day at local midnight.
     */
    function startOfMonth(value) {
      return new Date(value.getFullYear(), value.getMonth(), 1)
    }

    /**
     * @param value - a month anchor.
     * @param delta - months to move, positive or negative.
     * @returns the moved month's first day.
     */
    function addMonths(value, delta) {
      return new Date(value.getFullYear(), value.getMonth() + delta, 1)
    }

    /**
     * @param value - a local date.
     * @returns its `YYYY-MM-DD` key.
     */
    function dayKeyOf(value) {
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    }

    /**
     * @param key - a `YYYY-MM-DD` key.
     * @returns that local date at midnight.
     */
    function dateOfKey(key) {
      const parts = key.split('-').map(Number)
      return new Date(parts[0], parts[1] - 1, parts[2])
    }

    /**
     * @param value - a number below 10.
     * @returns its two-digit form.
     */
    function pad(value) {
      return String(value).padStart(2, '0')
    }

    /**
     * @param month - the shown month.
     * @returns the 42 day cells, Monday first, with their boundaries.
     */
    function monthGrid(month) {
      const first = startOfMonth(month)
      const offset = (first.getDay() + 6) % 7
      const cells = []
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + index)
        cells.push({
          key: dayKeyOf(date),
          date,
          outside: date.getMonth() !== first.getMonth(),
          from: date.getTime(),
          to: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime(),
        })
      }
      return cells
    }

    /**
     * @param cells - the grid.
     * @param detail - whether the Host should add prompts, tools, and files.
     * @returns the query string for the activity route.
     */
    function queryOf(cells, detail) {
      const keys = cells.map(cell => cell.key).join(',')
      const bounds = [cells[0].from, ...cells.map(cell => cell.to)].join(',')
      return `keys=${encodeURIComponent(keys)}&bounds=${encodeURIComponent(bounds)}&detail=${detail ? 1 : 0}`
    }

    /**
     * Read one activity query, aborting the previous read.
     * @param query - the query string, or undefined to skip reading.
     * @param token - changes when the reader asks for a fresh read.
     * @returns the read state.
     */
    function useActivity(query, token) {
      const [state, setState] = useState({ status: 'loading' })
      useEffect(() => {
        if (query === undefined) return undefined
        const controller = new AbortController()
        setState(previous => ({ status: 'loading', data: previous.data }))
        fetch(`${ROUTE}?${query}`, {
          signal: controller.signal,
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.json()
          })
          .then(data => {
            if (!controller.signal.aborted) setState({ status: 'ready', data })
          })
          .catch(error => {
            if (controller.signal.aborted) return
            setState({ status: 'error', message: String(error && error.message ? error.message : error) })
          })
        return () => {
          controller.abort()
        }
      }, [query, token])
      return state
    }

    /**
     * @param t - the panel's translate function.
     * @param session - one day's session entry.
     * @returns the label to show for it.
     */
    function sessionLabel(t, session) {
      return session.title === '' ? t('untitled') : session.title
    }

    /**
     * @param t - the panel's translate function.
     * @param session - one day's session entry.
     * @returns the workspace directory name the Session ran in.
     */
    function projectOf(t, session) {
      const base = session.cwd.split(/[\\/]/).filter(Boolean).pop()
      return base === undefined ? t('untitled') : base
    }

    /**
     * Put a day's busiest Session first, so the ranks agree everywhere.
     * @param sessions - one day's session entries.
     * @returns a new array ordered by tool calls, descending.
     */
    function rankedSessions(sessions) {
      return [...sessions].sort((left, right) => right.toolCalls - left.toolCalls)
    }

    /**
     * @param t - the panel's translate function.
     * @param sessions - how many Sessions the line covers.
     * @param tokens - how many tokens they spent.
     * @returns one line naming both totals.
     */
    function totalsLine(t, sessions, tokens) {
      const count = t('sessionCount', { count: sessions })
      return tokens === 0 ? count : `${count} · ${t('tokens', { count: formatTokens(tokens) })}`
    }

    /**
     * The day's totals: how many Sessions ran and how many tokens they spent.
     * @param props - the day's Sessions and the panel copy.
     * @returns the totals block.
     */
    function DayStats({ t, sessions }) {
      const tokens = sessions.reduce((total, session) => total + (session.tokens ?? 0), 0)
      const count = t('sessionCount', { count: sessions.length })
      return h('span', { className: 'wc-stats' },
        tokens === 0 ? count : `${count} · ${t('tokens', { count: formatTokens(tokens) })}`)
    }

    /**
     * @param total - a token count.
     * @returns its compact form, such as `18.2k`.
     */
    function formatTokens(total) {
      if (total >= 1_000_000) return `${Math.round(total / 100_000) / 10}M`
      if (total >= 100_000) return `${Math.round(total / 1_000)}k`
      if (total >= 1_000) return `${Math.round(total / 100) / 10}k`
      return String(total)
    }

    /**
     * One numbered work item: the rank the day gives it, then its label.
     * @param props - one-based rank and the Session label.
     * @returns the row.
     */
    function LineItem({ index, label }) {
      return h('span', { className: 'wc-row' },
        h('span', { className: 'wc-index' }, String(index)),
        h('span', { className: 'wc-item' }, label),
      )
    }

    /**
     * @param ms - a timestamp.
     * @returns its local `HH:MM`.
     */
    function clockOf(ms) {
      const date = new Date(ms)
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    /**
     * @param t - the panel's translate function.
     * @param ms - a duration in milliseconds.
     * @returns a short human duration.
     */
    function durationOf(t, ms) {
      const minutes = Math.max(1, Math.round(ms / 60_000))
      if (minutes < 60) return t('minutes', { minutes })
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return rest === 0 ? t('hours', { hours }) : t('hoursMinutes', { hours, minutes: rest })
    }

    /**
     * The calendar page: month grid plus the selected day's work report.
     * @param props - the slot's translate function and the Session opener.
     * @returns the rendered panel.
     */
    function WorkCalendarPage({ t, openSession, scheduleApi, pickDirectory }) {
      const [month, setMonth] = useState(() => startOfMonth(new Date()))
      const [selectedKey, setSelectedKey] = useState(() => dayKeyOf(new Date()))
      const [token, setToken] = useState(0)
      const [peek, setPeek] = useState(null)
      const peekCard = React.useRef(null)
      const [schedules, setSchedules] = useState({ status: 'loading', items: [] })
      const [sessionChoices, setSessionChoices] = useState([])
      const [form, setForm] = useState(null)
      const [notice, setNotice] = useState(null)
      const [pendingDelete, setPendingDelete] = useState(null)
      const [history, setHistory] = useState(null)
      const [allSchedules, setAllSchedules] = useState(false)
      const calendarRef = React.useRef(null)
      const closeTimer = React.useRef(null)
      const grid = useMemo(() => monthGrid(month), [month])
      const monthQuery = useMemo(() => queryOf(grid, false), [grid])
      const dayQuery = useMemo(() => queryOf([dayCellOf(selectedKey)], true), [selectedKey])
      const monthState = useActivity(monthQuery, token)
      const dayState = useActivity(dayQuery, token)

      useEffect(() => {
        const refreshOnFocus = () => setToken(value => value + 1)
        window.addEventListener('focus', refreshOnFocus)
        return () => window.removeEventListener('focus', refreshOnFocus)
      }, [])

      useEffect(() => {
        if (calendarRef.current !== null) calendarRef.current.scrollTop = 0
        setPeek(null)
      }, [month])

      useEffect(() => {
        setAllSchedules(false)
        setHistory(null)
        setPendingDelete(null)
      }, [selectedKey])

      /**
       * Grow one day out of its own cell into a larger card centered on it.
       * The card starts on the cell's exact rectangle, so the first frame of
       * the animation is the cell itself.
       * @param element - the cell the pointer or focus is on.
       * @param cell - that day's grid cell.
       * @param sessions - the day's sessions, empty for a day without work.
       */
      const openPeek = (element, cell, sessions, mode = 'sessions') => {
        if (cell.outside || sessions.length === 0) return
        clearTimeout(closeTimer.current)
        const from = element.getBoundingClientRect()
        const width = Math.min(Math.max(from.width * 2.4, 240), window.innerWidth - 24)
        const height = Math.min(Math.max(from.height * 1.65, PEEK_MIN_HEIGHT), window.innerHeight - 24)
        const margin = 12
        const centerX = from.left + from.width / 2
        const centerY = from.top + from.height / 2
        const left = Math.min(Math.max(centerX, width / 2 + margin), window.innerWidth - width / 2 - margin)
        const top = Math.min(Math.max(centerY, height / 2 + margin), window.innerHeight - height / 2 - margin)
        setPeek({
          key: cell.key,
          date: cell.date,
          sessions,
          schedules: scheduleDays.get(cell.key) ?? [],
          mode,
          from: { left: from.left, top: from.top, width: from.width, height: from.height },
          to: { left: left - width / 2, top: top - height / 2, width, height },
          closing: false,
        })
      }

      /** @returns nothing; starts shrinking the card back into its cell. */
      /**
       * Switch the open preview between the day's work and its schedules.
       * @param mode - which list the card shows.
       * @returns nothing.
       */
      const setPeekMode = (mode) => {
        setPeek(current => current === null || current.closing || current.mode === mode ? current : { ...current, mode })
      }

      const closePeek = () => {
        clearTimeout(closeTimer.current)
        setPeek(current => current === null || current.closing ? current : { ...current, closing: true })
        closeTimer.current = setTimeout(() => {
          setPeek(current => current !== null && current.closing ? null : current)
        }, 170)
      }

      useEffect(() => () => clearTimeout(closeTimer.current), [])

      const api = scheduleApi ?? {
        list: async () => ({ ok: false, code: 'schedule_unavailable' }),
        create: async () => ({ ok: false, code: 'schedule_unavailable' }),
        edit: async () => ({ ok: false, code: 'schedule_unavailable' }),
        run: async () => ({ ok: false, code: 'schedule_unavailable' }),
        subscribe: () => () => {},
      }
      const apiRef = React.useRef(api)
      apiRef.current = api

      const loadSchedules = React.useCallback(async () => {
        const result = await callRemote(() => apiRef.current.list())
        if (result.ok) setSchedules({ status: 'ready', items: Array.isArray(result.value) ? result.value : [] })
        else setSchedules({ status: 'error', items: [] })
      }, [])

      useEffect(() => {
        void loadSchedules()
      }, [loadSchedules])

      useEffect(() => {
        const unsubscribe = apiRef.current.subscribe(() => { void loadSchedules() })
        return () => { void unsubscribe() }
      }, [loadSchedules])

      useEffect(() => {
        let cancelled = false
        fetch('/api/work-calendar/sessions?limit=30', { credentials: 'same-origin', headers: { accept: 'application/json' } })
          .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
          .then(data => { if (!cancelled) setSessionChoices(Array.isArray(data.sessions) ? data.sessions : []) })
          .catch(() => { if (!cancelled) setSessionChoices([]) })
        return () => { cancelled = true }
      }, [])

      /**
       * Open the editor for a new schedule on the selected day.
       * @returns nothing.
       */
      const openCreateForm = () => {
        setNotice(null)
        setForm({
          mode: 'create',
          id: null,
          title: '',
          prompt: '',
          date: selectedKey,
          time: '09:00',
          repeat: 'once',
          weekdays: [((dateOfKey(selectedKey).getDay() + 6) % 7) + 1],
          target: sessionChoices[0]?.id ?? '__new__',
          cwd: '',
          busy: false,
          error: null,
        })
      }

      /**
       * Open the editor over one stored schedule.
       * @param schedule - the catalog entry to edit.
       * @returns nothing.
       */
      const openEditForm = (schedule) => {
        const at = new Date(schedule.scheduledAt)
        const known = !Number.isNaN(at.getTime())
        setNotice(null)
        setForm({
          mode: 'edit',
          id: schedule.id,
          title: schedule.title,
          prompt: schedule.prompt,
          date: known ? dayKeyOf(at) : selectedKey,
          time: known ? `${pad(at.getHours())}:${pad(at.getMinutes())}` : '09:00',
          repeat: schedule.kind === 'daily' ? 'daily' : schedule.kind === 'weekly' ? 'weekly' : 'once',
          weekdays: Array.isArray(schedule.weekdays) && schedule.weekdays.length > 0
            ? [...schedule.weekdays]
            : [(((Number.isNaN(at.getTime()) ? new Date() : at).getDay() + 6) % 7) + 1],
          target: schedule.target.kind === 'session' ? schedule.target.sessionId : '__new__',
          cwd: schedule.target.kind === 'session' ? '' : (schedule.target.create?.cwd ?? ''),
          busy: false,
          error: null,
        })
      }

      /** @returns nothing; writes the open editor. */
      const submitForm = async () => {
        if (form === null || form.busy) return
        if (form.title.trim() === '' || form.prompt.trim() === '' || form.date === '' || form.time === '') {
          setForm({ ...form, error: t('formRequired') })
          return
        }
        setForm({ ...form, busy: true, error: null })
        const request = {
          title: form.title.trim(),
          prompt: form.prompt.trim(),
          timing: timingOfForm(form),
          target: targetOfForm(form),
        }
        const result = form.mode === 'edit'
          ? await callRemote(() => scheduleApi.edit({ id: form.id, action: 'update', patch: request }))
          : await callRemote(() => scheduleApi.create(request))
        if (!result.ok) {
          setForm({ ...form, busy: false, error: describeFailure(t, result.code) })
          return
        }
        const value = result.value
        if (value !== null && typeof value === 'object' && typeof value.code === 'string') {
          setForm({ ...form, busy: false, error: describeFailure(t, value.code) })
          return
        }
        setForm(null)
        setNotice(null)
        await loadSchedules()
      }

      /**
       * Open or close one schedule's recent deliveries.
       * @param schedule - the catalog entry to read.
       * @returns nothing.
       */
      const toggleHistory = async (schedule) => {
        if (history !== null && history.id === schedule.id) {
          setHistory(null)
          return
        }
        setHistory({ id: schedule.id, status: 'loading', items: [] })
        const result = await callRemote(() => apiRef.current.history({ id: schedule.id, limit: 5 }))
        if (!result.ok) {
          setHistory({ id: schedule.id, status: 'error', items: [] })
          return
        }
        const page = result.value
        const records = page === null || typeof page !== 'object' || !Array.isArray(page.records) ? [] : page.records
        setHistory({ id: schedule.id, status: 'ready', items: records })
      }

      /**
       * Deliver one schedule now.
       * @param schedule - the catalog entry to run.
       * @returns nothing.
       */
      const runSchedule = async (schedule) => {
        const result = await callRemote(() => scheduleApi.run(schedule.id))
        if (!result.ok) {
          setNotice(describeFailure(t, result.code))
          return
        }
        const value = result.value
        if (value !== null && typeof value === 'object' && typeof value.code === 'string') {
          setNotice(describeFailure(t, value.code))
          return
        }
        setNotice(null)
        await loadSchedules()
      }

      /**
       * Pause a running schedule or resume a paused one.
       * @param schedule - the catalog entry to switch.
       * @returns nothing.
       */
      const toggleSchedule = async (schedule) => {
        const result = await callRemote(() => scheduleApi.edit({
          id: schedule.id,
          action: 'update',
          patch: { active: schedule.status !== 'active' },
        }))
        if (!result.ok) {
          setNotice(describeFailure(t, result.code))
          return
        }
        setNotice(null)
        await loadSchedules()
      }

      /**
       * Remove one schedule.
       * @param schedule - the catalog entry to delete.
       * @returns nothing.
       */
      const deleteSchedule = async (schedule) => {
        if (pendingDelete !== schedule.id) {
          setPendingDelete(schedule.id)
          return
        }
        setPendingDelete(null)
        const result = await callRemote(() => scheduleApi.edit({ id: schedule.id, action: 'delete' }))
        if (!result.ok) {
          setNotice(describeFailure(t, result.code))
          return
        }
        setNotice(null)
        await loadSchedules()
      }

      const todayKey = dayKeyOf(new Date())
      const monthNames = t('monthNames').split('|')
      const weekdays = t('weekdays').split(',')
      const monthLabel = t('monthLabel', { year: month.getFullYear(), month: monthNames[month.getMonth()] })
      const selectedDate = dateOfKey(selectedKey)
      const dayLabel = t('dayLabel', { month: monthNames[selectedDate.getMonth()], day: selectedDate.getDate() })
      const dayHeading = t('dayWithWeekday', { day: dayLabel, weekday: weekdays[(selectedDate.getDay() + 6) % 7] })
      const monthPrefix = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`

      const days = monthState.data !== undefined && Array.isArray(monthState.data.days) ? monthState.data.days : []
      const byDay = new Map(days.map(day => [day.key, Array.isArray(day.sessions) ? day.sessions : []]))
      const monthSessions = days.filter(day => day.key.startsWith(monthPrefix))
      const monthTotals = monthSessions.flatMap(day => day.sessions)
      const sessionCount = monthTotals.length
      const tokenCount = monthTotals.reduce((total, session) => total + (session.tokens ?? 0), 0)
      const detailDays = dayState.data !== undefined && Array.isArray(dayState.data.days) ? dayState.data.days : []
      const dayEntry = detailDays.find(day => day.key === selectedKey)
      const daySessions = dayEntry === undefined || !Array.isArray(dayEntry.sessions) ? [] : dayEntry.sessions
      const dayTokens = daySessions.reduce((total, session) => total + (session.tokens ?? 0), 0)
      const dayTokensOf = (sessions) => sessions.reduce((total, session) => total + (session.tokens ?? 0), 0)
      const peakTokens = days.reduce((peak, day) => Math.max(peak, dayTokensOf(day.sessions)), 0)
      const heatOf = (sessions) => {
        const tokens = dayTokensOf(sessions)
        if (tokens === 0 || peakTokens === 0) return 0
        return Math.min(4, 1 + Math.floor(4 * Math.sqrt(tokens / peakTokens)))
      }
      const scheduleDays = useMemo(() => {
        const from = new Date(grid[0].from)
        const to = new Date(grid[grid.length - 1].to)
        const map = new Map()
        for (const schedule of schedules.items) {
          for (const at of occurrencesOf(schedule, from, to)) {
            const key = dayKeyOf(at)
            const list = map.get(key) ?? []
            list.push({ schedule, at })
            map.set(key, list)
          }
        }
        for (const list of map.values()) list.sort((left, right) => left.at - right.at)
        return map
      }, [schedules.items, grid])
      const daySchedules = scheduleDays.get(selectedKey) ?? []

      const selectMonth = (delta) => {
        const next = addMonths(month, delta)
        const now = new Date()
        const sameMonth = next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth()
        setMonth(next)
        setSelectedKey(sameMonth ? dayKeyOf(now) : dayKeyOf(next))
      }

      return h('div', { className: 'wc-page' },
        h('style', null, CSS),
        peek === null ? null : h(PeekCard, {
          peek,
          t,
          cardRef: peekCard,
          onLeave: closePeek,
          onSelect: () => setSelectedKey(peek.key),
          onModeChange: setPeekMode,
        }),
        h('header', { className: 'wc-head' },
          h('div', null,
            h('h1', { className: 'wc-pagetitle' }, t('title')),
            h('p', { className: 'wc-subtitle' },
              monthState.status === 'error'
                ? t('loadFailed')
                : monthState.data === undefined
                  ? t('loading')
                  : sessionCount === 0
                    ? t('emptyMonth')
                    : `${monthLabel} · ${totalsLine(t, sessionCount, tokenCount)}`),
          ),
          h('div', { className: 'wc-nav' },
            h('div', { className: 'wc-navgroup' },
              h('button', { type: 'button', className: 'wc-button', 'aria-label': t('previousMonth'), onClick: () => selectMonth(-1) }, '‹'),
              h('button', {
                type: 'button',
                className: 'wc-button',
                onClick: () => {
                  const now = new Date()
                  setMonth(startOfMonth(now))
                  setSelectedKey(dayKeyOf(now))
                },
              }, t('today')),
              h('button', { type: 'button', className: 'wc-button', 'aria-label': t('nextMonth'), onClick: () => selectMonth(1) }, '›'),
            ),
            h('button', { type: 'button', className: 'wc-button', 'data-primary': 'true', onClick: openCreateForm }, t('newSchedule')),
            h('button', { type: 'button', className: 'wc-button', onClick: () => setToken(value => value + 1) }, t('refresh')),
          ),
        ),
        h('div', { className: 'wc-scroll' },
          h('div', { className: 'wc-body' },
            h('div', { className: 'wc-calendar', ref: calendarRef, onScroll: closePeek },
              h('div', { className: 'wc-weekdays' },
                weekdays.map(name => h('span', { key: name, className: 'wc-weekday' }, name)),
              ),
              h('div', { className: 'wc-grid' },
                grid.map((cell, index) => {
                  const sessions = byDay.get(cell.key) ?? []
                  return h('div', {
                    key: cell.key,
                    className: 'wc-cell',
                    role: 'button',
                    tabIndex: 0,
                    'data-outside': cell.outside ? 'true' : 'false',
                    'data-today': cell.key === todayKey ? 'true' : 'false',
                    'data-selected': cell.key === selectedKey ? 'true' : 'false',
                    'data-row': String(Math.floor(index / 7)),
                    'data-weekend': cell.date.getDay() === 0 || cell.date.getDay() === 6 ? 'true' : 'false',
                    style: { '--wc-heat': String(heatOf(sessions)) },
                    'aria-pressed': cell.key === selectedKey ? 'true' : 'false',
                    'aria-label': `${dayLabelOf(t, monthNames, cell.date, sessions.length)}`,
                    onClick: () => {
                      if (cell.outside) setMonth(startOfMonth(cell.date))
                      setSelectedKey(cell.key)
                    },
                    onKeyDown: (event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      if (cell.outside) setMonth(startOfMonth(cell.date))
                      setSelectedKey(cell.key)
                    },
                    onMouseEnter: (event) => {
                      if (event.target instanceof Element && event.target.closest('.wc-schedcount') !== null) return
                      openPeek(event.currentTarget, cell, sessions, 'sessions')
                    },
                    onMouseLeave: (event) => {
                      const next = event.relatedTarget
                      if (peekCard.current !== null && next instanceof Node && peekCard.current.contains(next)) return
                      closePeek()
                    },
                    onFocus: (event) => openPeek(event.currentTarget, cell, sessions),
                    onBlur: closePeek,
                  },
                    h('span', { className: 'wc-day' },
                      h('span', { className: 'wc-daynum' }, cell.date.getDate()),
                      (scheduleDays.get(cell.key)?.length ?? 0) === 0
                        ? null
                        : h('span', {
                          className: 'wc-schedcount',
                          title: t('scheduleCount', { count: scheduleDays.get(cell.key).length }),
                          onMouseEnter: (event) => {
                            event.stopPropagation()
                            const host = event.currentTarget.closest('.wc-cell')
                            if (host !== null) openPeek(host, cell, sessions, 'schedules')
                          },
                          onMouseLeave: () => setPeekMode('sessions'),
                        }, String(scheduleDays.get(cell.key).length)),
                    ),
                    cell.outside || sessions.length === 0
                      ? null
                      : h(DayStats, { t, sessions }),
                  )
                }),
              ),
            ),
            h('aside', { className: 'wc-detail', 'aria-label': dayLabel },
              h('div', { className: 'wc-detailhead' },
                h('h2', { className: 'wc-detailtitle' }, dayHeading),
                dayState.status === 'error'
                  ? h('p', { className: 'wc-detailmeta' }, t('loadFailed'))
                  : dayState.data === undefined
                    ? h('p', { className: 'wc-detailmeta' }, t('loading'))
                    : daySessions.length === 0
                      ? null
                      : h('p', { className: 'wc-detailmeta' }, totalsLine(t, daySessions.length, dayTokens)),
              ),
              h('section', { className: 'wc-section', 'data-kind': 'schedules' },
                h('div', { className: 'wc-sectionhead' },
                  h('span', { className: 'wc-sectiontitle' },
                    daySchedules.length === 0 ? t('schedules') : `${t('schedules')} · ${daySchedules.length}`),
                  form === null
                    ? h('button', { type: 'button', className: 'wc-action', onClick: openCreateForm }, t('newSchedule'))
                    : null,
                ),
                notice === null ? null : h('p', { className: 'wc-sectionerror' }, notice),
                form === null
                  ? null
                  : h(ScheduleForm, {
                    t,
                    form,
                    sessions: sessionChoices,
                    weekdays,
                    onChange: next => setForm({ ...form, ...next }),
                    onSubmit: submitForm,
                    onCancel: () => setForm(null),
                    onPickDirectory: pickDirectory === undefined
                      ? undefined
                      : async () => {
                        const picked = await pickDirectory()
                        if (picked !== null) setForm({ ...form, cwd: picked })
                      },
                  }),
                form !== null || daySchedules.length === 0
                  ? (form === null ? h('p', { className: 'wc-sectionempty' }, t('noSchedules')) : null)
                  : h(React.Fragment, null,
                    (allSchedules ? daySchedules : daySchedules.slice(0, SCHEDULE_ROWS)).map(item => h(ScheduleRow, {
                    key: `${item.schedule.id}@${item.at.getTime()}`,
                    t,
                    item,
                    sessions: sessionChoices,
                    weekdays,
                    onRun: runSchedule,
                    onToggle: toggleSchedule,
                    onEdit: openEditForm,
                    onDelete: deleteSchedule,
                    deleting: pendingDelete === item.schedule.id,
                    onHistory: toggleHistory,
                    history: history !== null && history.id === item.schedule.id ? history : null,
                    onOpen: openSession,
                    })),
                    daySchedules.length > SCHEDULE_ROWS
                      ? h('button', {
                        type: 'button',
                        className: 'wc-action wc-sectionmore',
                        onClick: () => setAllSchedules(value => !value),
                      }, allSchedules ? t('showLess') : t('showAll', { count: daySchedules.length }))
                      : null,
                  ),
              ),
              h('section', { className: 'wc-section', 'data-kind': 'sessions' },
                h('div', { className: 'wc-sectionhead' },
                  h('span', { className: 'wc-sectiontitle' }, t('sessionsLabel')),
                ),
              dayState.status === 'error'
                ? h('div', { className: 'wc-notice' },
                  h('span', null, t('loadFailed')),
                  h('button', { type: 'button', className: 'wc-button', onClick: () => setToken(value => value + 1) }, t('retry')),
                )
                : dayState.status === 'loading' && daySessions.length === 0
                  ? h('div', { className: 'wc-empty' }, h('span', { className: 'wc-spinner', 'aria-hidden': true }), h('span', null, t('loading')))
                  : daySessions.length === 0
                    ? h('div', { className: 'wc-empty' }, t('emptyDay'))
                    : h('div', { className: 'wc-sessions' },
                      daySessions.map((session, index) => h(SessionCard, {
                        key: session.id,
                        t,
                        session,
                        openSession,
                        showProject: index === 0 || daySessions[index - 1].cwd !== session.cwd,
                      })),
                    ),
              ),
            ),
          ),
        ),
      )
    }

    /**
     * @param t - the panel's translate function.
     * @param monthNames - month names in the active locale.
     * @param date - the cell's day.
     * @param sessions - how many Sessions that day has.
     * @returns the cell's accessible name.
     */
    function dayLabelOf(t, monthNames, date, sessions) {
      const label = t('dayLabel', { month: monthNames[date.getMonth()], day: date.getDate() })
      return `${label} · ${t('sessionCount', { count: sessions })}`
    }

    /**
     * @param key - a `YYYY-MM-DD` key.
     * @returns one day cell with its boundaries.
     */
    function dayCellOf(key) {
      const date = dateOfKey(key)
      return {
        key,
        date,
        outside: false,
        from: date.getTime(),
        to: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime(),
      }
    }

    /**
     * Normalize one Remote call into an outcome the panel can show.
     * @param thunk - the call, which may return a value or a result envelope.
     * @returns the value, or the failure code.
     */
    async function callRemote(thunk) {
      try {
        const result = await thunk()
        if (result !== null && typeof result === 'object' && typeof result.ok === 'boolean') {
          return result.ok
            ? { ok: true, value: result.value }
            : { ok: false, code: String(result.error?.code ?? 'remote_error') }
        }
        return { ok: true, value: result }
      } catch (error) {
        return { ok: false, code: String(error?.message ?? error) }
      }
    }

    /**
     * @param value - a local date.
     * @param days - whole days to move, positive or negative.
     * @returns the moved date, keeping the local clock time.
     */
    function addDays(value, days) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days, value.getHours(), value.getMinutes(), value.getSeconds())
    }

    /**
     * Expand one schedule into the instants that fall inside a range.
     *
     * Daily and weekly rules step by whole local days from their next
     * occurrence; every other rule contributes that next occurrence only.
     * @param schedule - one catalog entry.
     * @param from - inclusive range start.
     * @param to - exclusive range end.
     * @returns the occurrences, ascending.
     */
    function occurrencesOf(schedule, from, to) {
      const start = new Date(schedule.scheduledAt)
      if (Number.isNaN(start.getTime())) return []
      if (schedule.kind !== 'daily' && schedule.kind !== 'weekly') {
        return start >= from && start < to ? [start] : []
      }
      const step = schedule.kind === 'daily' ? 1 : 7
      let cursor = start
      let guard = 0
      while (cursor >= from && guard < 500) {
        cursor = addDays(cursor, -step)
        guard += 1
      }
      cursor = addDays(cursor, step)
      const found = []
      guard = 0
      while (cursor < to && guard < 500) {
        found.push(cursor)
        cursor = addDays(cursor, step)
        guard += 1
      }
      return found
    }

    /**
     * @param t - the panel's translate function.
     * @param schedule - one catalog entry.
     * @param weekdays - weekday labels in reading order, Monday first.
     * @returns how often the schedule repeats.
     */
    function repeatLabel(t, schedule, weekdays) {
      if (schedule.kind === 'daily') return t('repeatDaily')
      if (schedule.kind === 'weekly') {
        const days = (Array.isArray(schedule.weekdays) ? schedule.weekdays : [])
          .map(day => weekdays[day - 1] ?? '')
          .filter(label => label !== '')
        return days.length === 0 ? t('repeatWeeklyPlain') : t('repeatWeekly', { weekdays: days.join('、') })
      }
      if (schedule.kind === 'every') return t('repeatEvery', { minutes: Math.max(1, Math.round((schedule.everySeconds ?? 0) / 60)) })
      if (schedule.kind === 'cron' || schedule.kind === 'rrule') return t('repeatRule')
      return t('repeatOnce')
    }

    /**
     * @param t - the panel's translate function.
     * @param status - one catalog status.
     * @returns the localized status.
     */
    function statusLabel(t, status) {
      if (status === 'paused') return t('statusPaused')
      if (status === 'ended') return t('statusEnded')
      return t('statusActive')
    }

    /**
     * @param t - the panel's translate function.
     * @param code - a Remote failure or result code.
     * @returns a short message for the panel.
     */
    function describeFailure(t, code) {
      if (code === 'target-archived') return t('errorArchived')
      if (code === 'schedule_conflict') return t('errorConflict')
      if (code === 'schedule_execution_pending') return t('errorPending')
      if (code === undefined || code === '') return t('errorGeneric')
      console.warn('[work-calendar] schedule call failed:', code)
      return `${t('errorGeneric')}（${code}）`
    }

    /**
     * @param form - the open editor.
     * @returns the timing request its fields describe.
     */
    function timingOfForm(form) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const time = clockTime(form.time)
      if (form.repeat === 'daily') return { kind: 'daily', daily: { time, time_zone: timeZone } }
      if (form.repeat === 'weekly') {
        const fallback = [((dateOfKey(form.date).getDay() + 6) % 7) + 1]
        const weekdays = Array.isArray(form.weekdays) && form.weekdays.length > 0 ? form.weekdays : fallback
        return { kind: 'weekly', weekly: { time, time_zone: timeZone, weekdays } }
      }
      return { kind: 'at', at: { date: form.date, time, time_zone: timeZone } }
    }

    /**
     * @param value - a clock reading such as `09:30`.
     * @returns the `HH:mm:ss` form the scheduler expects.
     */
    function clockTime(value) {
      const trimmed = String(value).trim()
      return /^\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed
    }

    /**
     * @param form - the open editor.
     * @returns the delivery target its fields describe.
     */
    function targetOfForm(form) {
      if (form.target === '__new__') {
        const cwd = form.cwd.trim()
        return cwd === '' ? { kind: 'new' } : { kind: 'new', create: { cwd } }
      }
      return { kind: 'session', sessionId: form.target }
    }

    /**
     * The card one day grows into while its cell is hovered or focused.
     *
     * It repeats the cell's own content — day number, activity dots, summary,
     * operation count — with the same classes, so the first animated frame at
     * the cell's rectangle is indistinguishable from the cell. The per-session
     * breakdown is appended below and unfolds once the card has grown.
     * @param props - the open day with its start and end rectangles, and the panel copy.
     * @returns the rendered card.
     */
    function PeekCard({ peek, t, cardRef, onLeave, onSelect, onModeChange }) {
      const sessions = rankedSessions(peek.sessions)
      return h('div', {
        className: 'wc-peek',
        'data-closing': peek.closing ? 'true' : 'false',
        'aria-hidden': 'true',
        ref: cardRef,
        onMouseLeave: onLeave,
        onClick: onSelect,
        style: {
          '--wc-from-left': `${peek.from.left}px`,
          '--wc-from-top': `${peek.from.top}px`,
          '--wc-from-width': `${peek.from.width}px`,
          '--wc-from-height': `${peek.from.height}px`,
          '--wc-to-left': `${peek.to.left}px`,
          '--wc-to-top': `${peek.to.top}px`,
          '--wc-to-width': `${peek.to.width}px`,
          '--wc-to-height': `${peek.to.height}px`,
        },
      },
        h('span', { className: 'wc-day' },
          h('span', { className: 'wc-daynum' }, peek.date.getDate()),
          peek.schedules.length === 0
            ? null
            : h('span', {
              className: 'wc-schedcount',
              title: t('scheduleCount', { count: peek.schedules.length }),
              onMouseEnter: () => onModeChange('schedules'),
              onMouseLeave: () => onModeChange('sessions'),
            }, String(peek.schedules.length)),
        ),
        h('div', { className: 'wc-peek-body' },
          h('div', { className: 'wc-peek-counts' }, h(DayStats, { t, sessions: peek.sessions })),
          h('div', { className: 'wc-peek-list' },
            h('div', { className: 'wc-peek-rows' },
              peek.mode === 'schedules'
                ? h(React.Fragment, null,
                  peek.schedules.slice(0, PEEK_ROWS).map(item => h('div', {
                    key: `${item.schedule.id}@${item.at.getTime()}`,
                    className: 'wc-row',
                  },
                    h('span', { className: 'wc-rowtime' }, clockOf(item.at.getTime())),
                    h('span', { className: 'wc-item' }, item.schedule.title),
                  )),
                  peek.schedules.length > PEEK_ROWS
                    ? h('span', { className: 'wc-peekmore' }, t('moreSchedules', { count: peek.schedules.length - PEEK_ROWS }))
                    : null,
                )
                : h(React.Fragment, null,
                  sessions.slice(0, PEEK_ROWS).map((session, index) => h(LineItem, {
                    key: session.id,
                    index: index + 1,
                    label: sessionLabel(t, session),
                  })),
                  sessions.length > PEEK_ROWS
                    ? h('span', { className: 'wc-peekmore' }, t('more', { count: sessions.length - PEEK_ROWS }))
                    : null,
                ),
            ),
          ),
        ),
      )
    }

    /**
     * One stored schedule as the selected day shows it.
     * @param props - the occurrence, the catalog entry, and the panel actions.
     * @returns the rendered row.
     */
    function ScheduleRow({ t, item, sessions, weekdays, onRun, onToggle, onEdit, onDelete, onOpen, onHistory, history, deleting }) {
      const schedule = item.schedule
      const target = schedule.target
      const known = target.kind === 'session' ? sessions.find(option => option.id === target.sessionId) : undefined
      const title = known === undefined ? undefined : known.title
      const targetLabel = target.kind === 'session'
        ? t('targetSession', {
          title: title === undefined || title === ''
            ? (known === undefined ? `${String(target.sessionId).slice(0, 8)}…` : t('untitled'))
            : title,
        })
        : t('targetNew')
      const lastDelivery = schedule.lastDelivery ?? null
      return h('div', { className: 'wc-sched' },
        h('div', { className: 'wc-schedtop' },
          h('span', { className: 'wc-schedtime' }, clockOf(item.at.getTime())),
          h('span', null, repeatLabel(t, schedule, weekdays)),
        ),
        h('div', { className: 'wc-schedtitle' }, schedule.title),
        h('div', { className: 'wc-schedmeta' }, `${targetLabel} · ${statusLabel(t, schedule.status)}`),
        lastDelivery === null
          ? null
          : h('div', { className: 'wc-schedmeta' }, t('historyLast', { time: clockOf(new Date(lastDelivery.deliveredAt).getTime()) })),
        h('div', { className: 'wc-schedactions' },
          h('button', { type: 'button', className: 'wc-action', onClick: () => onRun(schedule) }, t('actionRun')),
          h('button', { type: 'button', className: 'wc-action', onClick: () => onToggle(schedule) },
            schedule.status === 'active' ? t('actionPause') : t('actionResume')),
          h('button', { type: 'button', className: 'wc-action', onClick: () => onEdit(schedule) }, t('actionEdit')),
          h('button', { type: 'button', className: 'wc-action', onClick: () => onHistory(schedule) }, t('actionHistory')),
          h('button', { type: 'button', className: 'wc-action', onClick: () => onDelete(schedule) }, deleting ? t('actionDeleteConfirm') : t('actionDelete')),
          target.kind === 'session'
            ? h('button', { type: 'button', className: 'wc-action', onClick: () => onOpen(target.sessionId) }, t('openSession'))
            : null,
        ),
        history === null
          ? null
          : h('div', { className: 'wc-schedhistory' },
            history.status === 'loading'
              ? h('span', { className: 'wc-schedmeta' }, t('loading'))
              : history.status === 'error'
                ? h('span', { className: 'wc-schedmeta' }, t('errorGeneric'))
                : history.items.length === 0
                  ? h('span', { className: 'wc-schedmeta' }, t('historyEmpty'))
                  : history.items.map(record => h('div', { key: String(record.messageId), className: 'wc-schedmeta' },
                    `${clockOf(new Date(record.deliveredAt).getTime())} · ${t('historyDelivered')}`)),
          ),
      )
    }

    /**
     * The inline editor that creates or rewrites one schedule.
     * @param props - the draft, the target candidates, and the panel actions.
     * @returns the rendered form.
     */
    function ScheduleForm({ t, form, sessions, weekdays, onChange, onSubmit, onCancel, onPickDirectory }) {
      return h('div', { className: 'wc-form' },
        h('label', { className: 'wc-field' },
          h('span', { className: 'wc-fieldlabel' }, t('formTitle')),
          h('input', {
            className: 'wc-input',
            value: form.title,
            onChange: event => onChange({ title: event.target.value }),
          }),
        ),
        h('label', { className: 'wc-field' },
          h('span', { className: 'wc-fieldlabel' }, t('formPrompt')),
          h('textarea', {
            className: 'wc-textarea',
            value: form.prompt,
            onChange: event => onChange({ prompt: event.target.value }),
          }),
        ),
        h('div', { className: 'wc-fieldrow' },
          h('label', { className: 'wc-field' },
            h('span', { className: 'wc-fieldlabel' }, t('formDate')),
            h('input', {
              className: 'wc-input',
              type: 'date',
              value: form.date,
              onChange: event => onChange({ date: event.target.value }),
            }),
          ),
          h('label', { className: 'wc-field' },
            h('span', { className: 'wc-fieldlabel' }, t('formTime')),
            h('input', {
              className: 'wc-input',
              type: 'time',
              value: form.time,
              onChange: event => onChange({ time: event.target.value }),
            }),
          ),
        ),
        h('label', { className: 'wc-field' },
          h('span', { className: 'wc-fieldlabel' }, t('formRepeat')),
          h('select', {
            className: 'wc-select',
            value: form.repeat,
            onChange: event => onChange({ repeat: event.target.value }),
          },
            h('option', { value: 'once' }, t('repeatOnce')),
            h('option', { value: 'daily' }, t('repeatDaily')),
            h('option', { value: 'weekly' }, t('repeatWeeklyPlain')),
          ),
        ),
        form.repeat === 'weekly'
          ? h('div', { className: 'wc-field' },
            h('span', { className: 'wc-fieldlabel' }, t('formWeekdays')),
            h('div', { className: 'wc-weekdays-pick' },
              weekdays.map((label, index) => h('button', {
                key: label,
                type: 'button',
                className: 'wc-weekdaytoggle',
                'data-on': form.weekdays.includes(index + 1) ? 'true' : 'false',
                onClick: () => onChange({
                  weekdays: form.weekdays.includes(index + 1)
                    ? form.weekdays.filter(day => day !== index + 1)
                    : [...form.weekdays, index + 1].sort((left, right) => left - right),
                }),
              }, label)),
            ),
          )
          : null,
        h('label', { className: 'wc-field' },
          h('span', { className: 'wc-fieldlabel' }, t('formTarget')),
          h('select', {
            className: 'wc-select',
            value: form.target,
            onChange: event => onChange({ target: event.target.value }),
          },
            sessions.map(option => h('option', { key: option.id, value: option.id }, option.title === '' ? t('untitled') : option.title)),
            form.target === '__new__' || sessions.some(option => option.id === form.target)
              ? null
              : h('option', { value: form.target }, `${String(form.target).slice(0, 8)}…`),
            h('option', { value: '__new__' }, t('formTargetNew')),
          ),
        ),
        form.target === '__new__'
          ? h('label', { className: 'wc-field' },
            h('span', { className: 'wc-fieldlabel' }, t('formCwd')),
            h('span', { className: 'wc-fieldrow' },
              h('input', {
                className: 'wc-input',
                value: form.cwd,
                placeholder: t('formCwdPlaceholder'),
                onChange: event => onChange({ cwd: event.target.value }),
              }),
              onPickDirectory === undefined
                ? null
                : h('button', { type: 'button', className: 'wc-action', onClick: onPickDirectory }, t('formPickDirectory')),
            ),
          )
          : null,
        form.error === null ? null : h('p', { className: 'wc-formerror' }, form.error),
        h('div', { className: 'wc-formactions' },
          h('button', { type: 'button', className: 'wc-button', onClick: onCancel }, t('formCancel')),
          h('button', {
            type: 'button',
            className: 'wc-button',
            'data-primary': 'true',
            disabled: form.busy,
            onClick: onSubmit,
          }, form.busy ? t('formSaving') : t('formSave')),
        ),
      )
    }

    /**
     * One Session's work report for the selected day.
     * @param props - the translate function, the session entry, and the opener.
     * @returns the rendered card.
     */
    function SessionCard({ t, session, openSession, showProject }) {
      const prompts = Array.isArray(session.prompts) ? session.prompts : []
      const label = sessionLabel(t, session)
      const meta = [
        showProject ? projectOf(t, session) : '',
        t('turns', { count: session.turns }),
        durationOf(t, session.end - session.start),
      ].filter(part => part !== '').join(' · ')
      return h('div', {
        className: 'wc-session',
        role: 'button',
        tabIndex: 0,
        'aria-label': `${t('openSession')}: ${label}`,
        onClick: () => openSession(session.id),
        onKeyDown: (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          openSession(session.id)
        },
      },
        h('div', { className: 'wc-sessiontop' },
          h('span', null, `${clockOf(session.start)} – ${clockOf(session.end)}`),
          session.tokens > 0 ? h('span', null, t('tokens', { count: formatTokens(session.tokens) })) : null,
        ),
        h('h3', { className: 'wc-sessiontitle' }, label),
        h('p', { className: 'wc-sessionmeta' }, meta),
        prompts.length === 0
          ? null
          : h('ul', { className: 'wc-prompts' },
            prompts.map(prompt => h('li', { key: prompt, className: 'wc-prompt' }, prompt)),
          ),
      )
    }

    /**
     * The sidebar entry: a calendar whose dot stands for a recorded day.
     * @param props - the sidebar's requested icon edge.
     * @returns the icon element.
     */
    function CalendarIcon({ size }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
      },
        h('rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 3 }),
        h('path', { d: 'M3.5 9.5h17' }),
        h('path', { d: 'M8 3.5v3M16 3.5v3' }),
        h('circle', { cx: 12, cy: 14.5, r: 1.5, fill: 'currentColor', stroke: 'none' }),
      )
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace', 'remote', 'remote.schedule'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', ZH), 'work-calendar: zh copy')
        ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'work-calendar: en copy')
        const t = ctx.locale.bind(NS)
        const scheduleApi = {
          list: () => ctx.remote.schedule.catalog(),
          create: request => ctx.remote.schedule.create(request),
          edit: request => ctx.remote.schedule.edit(request),
          run: id => ctx.remote.schedule.run({ id }),
          history: request => ctx.remote.schedule.history(request),
          subscribe: listener => ctx.remote.$on('schedule/changed', listener),
        }
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('panel'),
        }, CalendarIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({
            openSession: id => ctx.uiWorkspace.openSession(id),
            scheduleApi,
            pickDirectory: ctx.uiWorkspace.pickDirectory === undefined
              ? undefined
              : () => ctx.uiWorkspace.pickDirectory(),
          }),
        }, WorkCalendarPage))
      },
    }
  },
})
