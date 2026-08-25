---
title: dsh 插件开发教程
tags:
  - ai
  - dsh
date: 2026-08-25
---
## 几个核心概念

DeepSeek Harness 官网最醒目的就是 “一切皆插件” 。DeepSeek Harness 你可以理解为就是一个空壳，所有够能都是靠着可插拔的插件实现的。

![](assets/Pasted%20image%2020260825214411.png)

在进入插件开发教程前，我们先来了解下插件时如何协同工作的。

OK， 现在我们来理解几个词的含义。

| 名词       | 含义                                                                                |
| -------- | --------------------------------------------------------------------------------- |
| Bundle   | 聚合多个能力或者叫多种特性的组合包。通常我们说的插件就是这个Bundle, 对外提供多种能力。                                   |
| Manifest | Bundle 的元数据说明书，是一份写在 `package.json`中的文件。用来告诉系统 这个Bundle 所具备的能力或特性。                |
| Patch    | 直译是补丁，可以理解为是特性的覆盖。例如，A插件设置聊天背景是图片1， B插件设置聊天背景是图片2。当B插件晚于A插件加载时，B插件的特性就将A插件的特性覆盖了。 |

如下是dsh 插件安装命令，我们来理解一下 profile 的含义。
```
dsh plugin --profile <档案名> add <插件来源>
````
以我为例，我和我老婆在家里共用这一台电脑。我俩使用场景不同，我老婆会使用 A， B， C 插件， 而我使用 A， E， F 插件。另外，我俩的工作内容不希望互相关联。因此，就为 我俩每个人各自创建一个profile。
她在她的 wife_profile 下安装 A， B， C插件，在她的 wife_profile 下工作。
我在我的 husband_profile 下安装 A， E， F插件，在我的 husband_profile 工作。
现在是不是就好理解了，其实 profile 就是一个环境的隔离。

DSH 默认的 profile 名字叫做web, 所以你会看到很多插件的安装命令都是用web `dsh plugin --profile web add dsh-better-sidebar`
DSH 快速启动执行的命令也是 `dsh web`。 所以，可以理解了 这里的 web 原来是指定 profile 启动呀。




