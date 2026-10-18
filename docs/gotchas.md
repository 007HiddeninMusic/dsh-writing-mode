# 踩过的坑

这些不是理论风险，是实际撞出来的。每一条都有症状和成因。

---

## 1. 新增条目被静默丢弃

**症状**：配置写好、YAML 合法、日志无报错、重启多少次，模式就是不出现。

**成因**：`cordis.patch.yml` 的条目是**按 id 定位**的。`- id: xxx` 的语义是"去改一个**已经存在**的 xxx"，写一个不存在的 id 不会创建它——直接被丢掉，且不报错。

**正确写法**：新增条目放进 `- insert:` 的嵌套列表。

```yaml
- insert:
    - id: preset-writing
      name: "@deepseek-ai/dsh-agent-preset"
```

**怎么快速确认**：DSH 的 Inspect 查询里，如果 `include:preset-writing` 报 `unknown entry id`，就是没被加载；如果返回了条目和 schema，就是加载成功。

---

## 2. PowerShell 5.1 的编码坑（Windows）

**症状**：同一份脚本，中文字面量变成乱码；`-Encoding utf8NoBOM` 报"无法将标识符名称与有效的枚举器名称相匹配"；`.ps1` 被执行策略拒绝运行。

**成因**：很多环境里的 `pwsh` 实际是 **Windows PowerShell 5.1**，不是 PowerShell 7：

- `utf8NoBOM` 是 PS7 才有的编码值，5.1 没有
- `Get-Content -Raw` 在 5.1 下按 ANSI（中文系统是 GBK）读取 UTF-8 文件 → 中文字面量损坏
- 默认执行策略会拦住未签名的 `.ps1`

**后果实例**：用 `New-Item` 创建的中文目录名，落到磁盘上是 `寰佹枃` 这种乱码。

**怎么绕**：

- 写文件用编辑器或语言层（Python `pathlib.write_text(..., encoding='utf-8')`），**不要用 shell 重定向**
- 非写不可时，脚本里**只用纯 ASCII**，中文用 Unicode 码点构造：`[string][char]0x5F81 + [string][char]0x6587`（= 征文）
- 传参给 Python 时，外层用双引号、内层用单引号：`python -c "p=Path(r'D:\x')"`。反过来会被吞引号

---

## 3. PDF 与渲染需要更高权限

**症状**：把 docx 渲染成图片或转 PDF 时报 `{"code":"failed","error":"spawn EPERM"}`。生成 `.docx` 本身却完全正常。

**成因**：文件沙箱禁止程序通过管道捕获子进程输出。LibreOffice Kit 要 spawn `soffice` 并收集它的输出，所以被拦。而 `python-docx` 不派生子进程，因此不受影响。

**实际影响**：

| 操作 | workspace-write | danger-full-access |
|---|---|---|
| 生成 `.docx` | ✅ | ✅ |
| 结构/字数检查 | ✅ | ✅ |
| 渲染成图（排版质检） | ❌ | ✅ |
| 转 PDF | ❌ | ✅ |

**降级方案**：不升权时用结构检查兜底（ZIP/XML 完整性、段落数、表格尺寸、字数），并明确告诉用户"**未做视觉排版检查**"。别假装看过。

---

## 4. 中文 docx 不设 eastAsia 字体会渲染成方框

**症状**：生成的 Word 打开是中文，但在某些环境/渲染器里，中文变成一排方框（豆腐块）。而 `run.font.name = "宋体"` 看起来已经设了字体。

**成因**：OOXML 里拉丁字体和东亚字体是**两个属性**。`font.name` 只写 `w:ascii` / `w:hAnsi`，中文走的是 `w:eastAsia`。不显式设置就回退到渲染器的默认东亚字体，环境没装就出方框。

**正确写法**：

```python
from docx.oxml.ns import qn
run.font.name = "Times New Roman"
run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), "宋体")
```

样式层也设一遍（`doc.styles["Normal"]` 的 `rPr/rFonts`），双保险。

---

## 5. 技能 frontmatter 写错，技能会静默消失

**症状**：`SKILL.md` 明明在，模型就是说没有这个技能，没有任何报错。

**成因**：技能靠 frontmatter 的 `name` + `description` 注册。YAML 不合法、缺字段、文件开头有 BOM、`description` 里有未转义的 `: `——都会导致解析失败，然后被安静跳过。

**怎么防**：装完/加完技能跑一次 `_tools/check-skills.mjs`。它会检查 YAML 是否可解析、`name` 是否与目录名一致、有无 BOM、有无多余键。

---

## 6. 模式只能在会话开始前选

**症状**：想给已经在跑的会话换模式，找不到入口。

**成因**：这是设计如此——preset 在会话第一轮之前确定，之后锁定。

**怎么用**：要写东西就**新建会话**选「写作模式」。这也解释了为什么本仓库是"一个模式 + 五个技能"而不是"五个模式"：技能能在一个会话内按需切换，模式不能。

---

## 7. `customSkillDirs` 是追加还是替换（未确认）

**症状**：装上后，内置的 `office-docx` / `office-pptx` / `office-xlsx` 三个技能不见了。

**成因**：`customSkillDirs` 的语义是"追加到内置目录"还是"替换内置目录"，官方文档没写清。从官方预设的用法推断是追加（否则官方预设会丢掉全部内置技能），但**本仓库作者没有实测**。

**如果真丢了**：把内置目录一并列出。

```yaml
customSkillDirs:
  - '<WRITING_ROOT>/skills'
  - '<DSH 安装目录>/resources/runtime/office-skills'
```

**怎么验证**：在写作模式会话里问一句"你现在有哪些技能"。

---

## 8. 会话工作区内执行脚本可能挂起（特定环境）

**症状**：命令行跑一个再普通不过的脚本，不报错、不产出、进程都不存在，一直挂着。

**成因**：某些 DSH 版本在沙箱策略被切换后，执行**位于会话工作区内**的脚本会死锁。同样的脚本放在工作区外就正常。

**怎么绕**：工具脚本（字数统计、校验器）放**工作区外**，例如本仓库的 `_tools/`；执行时用绝对路径调用。

这条是环境相关，不保证你也会遇到。但如果遇到"命令无缘无故挂着"，先换个目录试试。
