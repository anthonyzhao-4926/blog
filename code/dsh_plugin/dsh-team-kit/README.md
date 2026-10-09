# dsh-team-kit

团队装配包。装上它，你的 dsh profile 会多一层配置：关掉自动起标题，并把团队约定写进每个会话的系统提示。

## 装

```sh
dsh plugin --profile <你的 profile 名> add github:anthonyzhao-4926/dsh-team-kit
```

pnpm ≥10 默认拒绝运行 git 依赖的构建脚本，所以第一次会失败。按它打印的提示，把包名加进 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-team-kit: true
```

然后重跑上面那条命令。

这一步等于允许这个包的代码在安装时于你的机器上执行，而且不在 agent 运行的任何沙箱之内。只对源码可信的包这么做；要更稳妥就锁 commit（`github:anthonyzhao-4926/dsh-team-kit#<sha>`），或者直接用 npm 上的预构建版本。

## 装了什么

- `session-title-llm` 被关掉——自动起标题会额外花一次模型调用。
- 一条系统提示片段：文本在 `cordis.patch.yml` 里，改那里的 `conventions` 即可，不用改代码。

## 不想要了

```sh
dsh plugin --profile <你的 profile 名> remove dsh-team-kit
```

依赖和那一层配置一起消失，profile 自己的 `cordis.patch.yml` 不受影响。
