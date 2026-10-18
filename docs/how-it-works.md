# 这个模式在 DSH 里是怎么拼出来的

想改造它的话，先理解这三层。

## 一、三层配置

```
bundle 层（官方，别动）
    @deepseek-ai/dsh-base
    @deepseek-ai/dsh-web-app
        ↓ 叠加
profile patch 层（你的，要动的就是这个）
    ~/.dsh/profiles/<profile>/cordis.patch.yml
        ↓ 其中一条 insert 行声明了一个 preset
preset 层（本仓库的 preset/writing.preset.yml）
    一组插件的隔离组合
```

patch 层是**按 id 定位**的：

- `- id: X` + `disabled:` / `config:` → 改一条**已存在**的条目
- `- insert:` + 嵌套列表 → **新增**条目（本仓库用的是这个）

写错成前者的症状是：不报错、不生效、重启无效。这是本仓库最想帮你避开的坑。

## 二、preset 是什么

一个 preset = 一组插件的**隔离组合**。每个会话启动时挑一个 preset，那 12 个插件就组装成那个会话的"大脑"。

所以「模式」不是提示词模板，而是**组件装配**：装哪几个工具、用哪个人格、挂哪个技能目录，都是这里定的。

本仓库装了 12 个：

| 插件 | 作用 | 为什么需要 |
|---|---|---|
| `persona` | 人格前缀 | 把"你是代码助手"换成"你是写作助手" + 四条硬规则 |
| `agent-instructions` | 读 `AGENTS.md` | 让规则手册生效，且你随时能改 |
| `tool-pwsh` | 命令行 | **只**为了跑 python-docx 生成 Word、跑结构检查 |
| `tool-fs` / `tool-fs-search` | 读写与搜索文件 | 读素材、写稿子、找旧作 |
| `tool-ask-user` | 反问 | 动笔前一次性问清需求 |
| `tool-todo` | 待办 | 长篇拆步骤 |
| `tool-web` | 联网 | **引用核查的唯一依据** |
| `skill-filesystem` | 挂技能目录 | 5 个文体技能从这来 |
| `tool-skill` | 加载技能 | 按需读取 `SKILL.md` |
| `compaction`（组） | 上下文压缩 | 写长篇、跑长会话时兜底 |
| `present` | 交付文件卡片 | 把 `.docx` 递到你手里 |

**没装的东西同样是设计**：没有代码相关工具、没有计划模式、没有 goal/ralph、没有子代理编排。写东西不需要这些，装上只是噪音。

## 三、规则放在哪：三处，各有分工

| 位置 | 生效方式 | 适合放什么 |
|---|---|---|
| `preset/writing.preset.yml` 的 persona | 改配置 → 热重载 | 很少变的东西：身份、四条硬红线 |
| `workspace/AGENTS.md` | 每次会话自动读 | **大部分规则放这里**。你能自己改，改完下次会话生效，不用碰配置 |
| `workspace/skills/*/SKILL.md` | 按需加载 | 单文体专属流程（怎么拆题、怎么断章、怎么回填表单） |

分工原则：**所有文体都要遵守的 → AGENTS.md；只有某一文体才关心的 → 技能**。

这样写征文时不会加载论文那一套文献规范，写论文时也不会有网文的爽点节奏表。

## 四、技能为什么能"按需"

技能目录里每个子目录一个 `SKILL.md`，开头是 YAML frontmatter：

```markdown
---
name: web-novel
description: Write and continue Chinese web novels ... Use when the user asks for 网文/连载/续写.
---
```

模型在每个会话里只看到 `name` + `description` 这一行摘要。判断当前任务属于哪类，才去读整篇正文。

所以：

- `description` 写得越具体、触发词越多，越容易被正确加载
- 格式写错**不会报错**——那个技能会静默消失。用 `_tools/check-skills.mjs` 检查
- 正文可以长（几千字都行），因为它只在需要时才进上下文

## 五、字数工具为什么单独做

模型的"字数估计"偏差能到 ±20%。征文写"1500 字以内"、你写到 1800 字，靠估是发现不了的。

`_tools/wordcount.py` 给四种口径，因为**不同赛事对"字数"的定义不一样**：

- 汉字数（不含标点）
- 汉字 + 标点
- 含空格的总字符数
- 中英混合词数（汉字按字算，英文单词按词算）

同一个文件，四种口径能差出 30%。报数时必须说清按哪种口径。

## 六、想改造

| 想做什么 | 改哪 |
|---|---|
| 改语气、加一条硬规则 | `AGENTS.md` |
| 加文体 | `skills/` 下新建目录 + `SKILL.md` |
| 换工具集（比如加子代理） | `preset/writing.preset.yml` 的 plugins 列表 |
| 换模型 | 不在 preset 里，在会话的模型选择器里手动选 |
