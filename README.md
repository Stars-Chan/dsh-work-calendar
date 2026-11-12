# dsh-work-calendar

在 DeepSeek Harness 里按月看「每天做了什么」：会话、token 消耗、以及定时日程。

## 安装

```sh
# npm
dsh plugin --profile desktop add dsh-work-calendar

# GitHub（始终最新）
dsh plugin --profile desktop add github:Stars-Chan/dsh-work-calendar
```

也可以在 Harness 的 **Plugins 面板 → 添加** 里直接填包名。装完刷新页面，左侧边栏会出现日历图标。

## 用法

**月视图**：每格显示日期、当天会话数、当天 token 消耗（`tok` 是 tokens 的缩写）。有工作的日子会带一层绿色热度，忙的那几天更深；有日程的日子右上角有数字徽标。

**悬停放大**：鼠标停在格子上，格子会长成一张卡片，列出当天按操作量排序的会话；把指针移到卡片右上角的日程徽标上，列表切换成当天的日程。

**右侧详情**：上半是「日程」（品牌绿底卡片，可立即执行 / 暂停 / 编辑 / 历史 / 删除 / 打开目标会话），下半是「会话」（时间、token、项目、轮数、你说过的话）。点会话卡片可直接打开那个会话。

**新建日程**：两种方式。

- **表单**：顶部「新建日程」，或右侧「＋ 新建日程」——填标题、内容、日期时间、重复规则、执行会话。
- **跟 Agent 说**：右侧「让 Agent 帮我建」，会打开一个新会话并带上当前选中的日期；Agent 会先问清时间、是否重复、由哪个会话执行，再用 `calendar_schedule` 工具创建。也可以直接在任意会话里说「帮我每周一 9 点在这个会话里做 X」，Agent 会用同一个工具完成。

日程就是 Harness 的定时任务：到点把一段内容投递给你指定的会话（或新会话），由它执行。

## Agent 工具

插件注册了一个工具 `calendar_schedule`（`action`: `create` / `list` / `delete`），让 Agent 能在聊天里创建、列出、删除日程：

- `target: this` 在当前会话执行；`target: session` 按会话 id 或标题片段指定会话（标题有歧义时会返回候选让你确认）；`target: new` 在新会话执行，可指定工作目录；
- 时间按本机时区解析，支持一次性 / 每天 / 每周（可指定星期几）；
- 工具只在 Harness 的调度服务存在时注册，日历面板本身不依赖它。

## 数据与隐私

- Host 侧读取**本机**的会话日志（标题、token 用量、你输入的消息文本），汇总后只通过本机已认证的页面接口返回；
- 不发起任何外网请求，不读取凭据，不上传任何数据；
- 日程的读写走 Harness 自带的调度服务，数据保存在你自己的 profile 里。

## 兼容性

依赖 Harness 的预发布接口（`sessionQuery`、`sessionPersistence`、`connection`、插槽、`ctx.remote.schedule`）。`package.json` 的 `dsh.engines.dsh` 写明了实测版本；Harness 升级后如果面板空白或日程区报错，先确认版本，再提 issue。

## 开发

纯 JavaScript，无构建步骤：

```
index.js          Host 侧：两个只读接口（当天活动、可选会话）
client.js         面板 UI（月视图 / 悬停卡片 / 右侧详情 / 日程表单）
cordis.patch.yml  往 profile 里插入插件行
locale/*.json     插件列表里的标题和描述
icon.svg          侧边栏图标
```

本地改动后：`dsh plugin --profile <name> add <本目录>`，然后刷新页面。

## License

MIT
