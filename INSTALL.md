# 安装

三步。全程大约五分钟。

---

## 第 0 步：确认你的 DSH 是哪种

这个模式依赖两个东西：**Agent Preset**（模式机制）和 **Skill**（技能机制）。官方的 DSH 桌面版都有。

先找到你的 profile 目录，通常在：

```
C:\Users\<你>\.dsh\profiles\<profile名>\      (Windows)
~/.dsh/profiles/<profile名>/                  (macOS / Linux)
```

里面应该有两个文件：`cordis.yml`（bundle 层，别动）和 `cordis.patch.yml`（**你的补丁层，要动的是这个**）。

---

## 第 1 步：放置写作根目录

把仓库里的 `workspace/` 整个复制到你想要的位置，例如：

```
D:\AI_Workspace\writing\
```

> 建议路径里**不要有空格和中文**。技能目录的路径会写进配置，空格在 YAML 里容易出问题。

然后：

- 如果你要用个人事实库：`facts\个人事实库.template.md` 复制一份为 `facts\个人事实库.md`，再填内容
- 想让它更像你：把几篇旧作丢进 `style-samples\`

---

## 第 2 步：装模式

打开 profile 的 `cordis.patch.yml`，**在文件末尾追加** `preset/writing.preset.yml` 的内容，并把里面的路径占位符换掉：

```yaml
          customSkillDirs:
            - '<WRITING_ROOT>\skills'      # ← 换成你第 1 步的路径
```

例如：

```yaml
          customSkillDirs:
            - 'D:\AI_Workspace\writing\skills'
```

### ⚠️ 这一步最容易错的地方

**新增条目必须写在 `- insert:` 下面。**

```yaml
# ✅ 对：insert 块，把新条目插进配置树
- insert:
    - id: preset-writing
      name: "@deepseek-ai/dsh-agent-preset"
      config:
        ...

# ❌ 错：平铺一行。patch 层会把它当成"去改一个已存在的 preset-writing"，
#        而它不存在 → 静默丢弃，不报错，重启多少次都不会出现
- id: preset-writing
  name: "@deepseek-ai/dsh-agent-preset"
```

这个坑我踩过，症状是"配置看着没问题、日志没有错误、模式就是不出现"。详见 [gotchas](gotchas.md#1-新增条目被静默丢弃)。

---

## 第 3 步：验证

### 3.1 配置本身合法吗

```bash
node workspace/_tools/validate-profile.mjs <你的 profile>/cordis.patch.yml
```

应该输出 `OK: writing preset is well-formed under insert:`，并且 `insertedIds` 里有 `preset-writing`、`pluginCount` 为 `12`。

### 3.2 技能格式合法吗

```bash
node workspace/_tools/check-skills.mjs <你的写作根目录>/skills
```

应该输出 `verdict: "pass"`，`count: 5`。

> 技能 frontmatter 写错**不会报错**，那个技能会静默消失。所以这个检查值得跑。

### 3.3 模式真的加载了吗

保存 `cordis.patch.yml` 后，DSH 的 HMR 通常 **1 秒内**自动重组，不用重启。

**新建会话**，在空白页的模式选单里找「写作模式」。找到即成功。

### 3.4 技能挂上了吗

在写作模式的会话里问一句"你现在有哪些技能"。应该能列出 5 个（外加内置的 office-docx/pptx/xlsx）。

如果内置的那三个不见了，说明 `customSkillDirs` 是"替换"而非"追加"——把内置目录也加进去：

```yaml
          customSkillDirs:
            - '<WRITING_ROOT>\skills'
            - '<你的 DSH 安装目录>\resources\runtime\office-skills'
```

---

## 回滚

把这个整段从 `cordis.patch.yml` 里删掉：

```yaml
- insert:
    - id: preset-writing
      ...
```

或从备份恢复。如果你照上面的说明操作，安装前应该已经备份过 `cordis.patch.yml`。

删掉后 HMR 同样会在一秒内卸载模式。写作根目录里的文件不受影响，可以留着或整个删掉。

---

## 故障排查

| 症状 | 最可能的原因 |
|---|---|
| 选单里没有「写作模式」 | ① 没写成 `insert:` 块；② 客户端缓存了旧名录 → 刷新页面或重启 DSH |
| 出现了但标了 broken | 12 个插件里有解析失败的，看具体报错是哪个 `name` |
| 技能列表里没有我的 5 个 | `customSkillDirs` 路径不对；或前端没有通配符/反斜杠问题 |
| 技能列表里有但写东西时不加载 | 技能的 `description` 太模糊，模型判断不出该用 → 把触发词写进去 |
| 生成 docx 时报 `spawn EPERM` | 见 [gotchas#3](gotchas.md#3-pdf-与渲染需要更高权限)：渲染/PDF 需要 danger-full-access，纯生成不需要 |

---

## 平台差异

- **路径分隔符**：配置里用你所在平台的形式。Windows 用 `D:\...`，macOS/Linux 用 `/...`。
- **命令行**：Windows 上是 PowerShell，macOS/Linux 上是 bash。规则里写的"命令行只用于文档生成"对两者都成立。
- **字体**：中文 `.docx` 必须显式设 `w:eastAsia` 字体，否则在部分环境渲染成方框。技能里已经处理了。
