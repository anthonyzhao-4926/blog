---
title: linux 常用命令
date: 2025-06-01
tags:
  - linux
column: linux 命令入门
order: 2
viewable: true
---
## 目录处理命令

### 命令格式

- 命令格式：`命令 [-选项] [参数]`

例：`ls -la /etc`

- 说明：

- 个别命令使用不遵循此格式
- 当有多个选项时可以写在一起
- 简化选项与完整选项： `-a` 等同于 `--all`

### ls命令

- 命令名称：ls
- 命令英文原意：list
- 命令所在路径：/bin/ls
- 执行权限：所有用户
- 功能描述：显示目录文件
- 语法：ls 选项[-ald] [文件或目录]

- -a 显示所有文件，包括隐藏文件
- -l long以长格式，详细显示信息
- -d 只显示当前目录的信息
- -i 查看inode号
- -h human，人性化显示文件大小

```
$ ls -l
total 20
lrwxrwxrwx.   1 root root    7 May 11  2019 bin -> usr/bin
dr-xr-xr-x.   5 root root 4096 Sep 14  2020 boot
drwxr-xr-x   19 root root 2960 May  9 12:08 dev
drwxr-xr-x.  94 root root 8192 May  9 11:56 etc
```

每列的含义如下：

```
权限     引用计数    所有者    所属组    文件大小    修改时间      文件名
lrwxrwxrwx.   1         root     root       7      May 11 2019     bin -> usr/bin
```

对于权限，权限由10个字母组成，第一个表示文件类型。然后接下来分三组，分别是所有者权限、所属组权限和其他人权限。权限有三种，读、写和执行，分别用r、w和x表示，没有该权限用`-`表示。如下图：

![linux-ls权限说明](assets/linux-ls权限说明.png)

文件类型：

- `-`：二进制文件
- `d`：目录
- `l`：软链接文件

### mkdir命令

- 命令名称：mkdir
- 命令英文原意：make directories
- 命令所在路径：/bin/mkdir
- 执行权限：所有用户
- 功能描述：创建新目录
- 语法：mkdir [-p] 目录名

- -p 递归创建目录

```
$ mkdir -p Japan/canglaoshi/2023
```

### pwd命令

- 命令名称：pwd
- 命令英文原意：print working directory
- 命令所在路径：/bin/pwd
- 执行权限：所有用户
- 功能描述：显示当前目录
- 语法：pwd

```
$ pwd
/root/Japan/canglaoshi/2023
```

### rmdir命令

- 命令名称：rmdir
- 命令英文原意：remove empty directories
- 命令所在路径：/bin/rmdir
- 执行权限：所有用户
- 功能描述：删除空目录
- 语法：rmdir Japan/canglaoshi/2023/

```
$ rmdir Japan/canglaoshi/2023/
```

### cp命令

- 命令名称：cp
- 命令英文原意：copy
- 命令所在路径：/bin/cp
- 执行权限：所有用户
- 功能描述：复制文件或目录
- 语法：cp -rp [原文件或目录] [目标目录]

- -r 复制目录
- -p 保留文件属性

```
$ cp -pr ori tar
```

### mv命令

- 命令名称：mv
- 命令英文原意：move
- 命令所在路径：/bin/mv
- 执行权限：所有用户
- 功能描述：剪切文件、改名。在剪切过程中可以重命名，如果是剪切到本文件夹下就是重命名喽。
- 语法：mv［原文件或目录］［目标目录］

```
// 将ori/test 文件夹复制到 tar目录下，并改名为tt
$ mv ori/test tar/tt
```

### rm命令

- 命令名称：rm
- 命令英文原意：remove
- 命令所在路径：/bin/rm
- 执行权限：所有用户
- 功能描述：删除文件或目录
- 语法：rm -rf [文件或目录]

- -r 删除目录
- -f 强制执行

```
$ rm -rf admin/
```

## 文件处理命令

### touch命令

- 命令名称：touch
- 命令英文原意：
- 命令所在路径：/bin/touch
- 执行权限：所有用户
- 功能描述：创建空文件
- 语法：touch Japanlovestory.list

touch的含义是触摸，所以touch命令在使用时，是去摸指定的文件，如果没有就创建出来。

### cat命令

- 命令名称：cat
- 命令英文原意：
- 命令所在路径：/bin/cat
- 执行权限：所有用户
- 功能描述：显示文件内容
- 语法：cat -n /etc/services

- -n 显示行号

诶嘛呀😂，在输出来这老些。我就不贴了，你自己试试看吧。

```
$ cat booklist.txt 
1.《计算机系统要素》- Randy Bryant 和 O’Hallaron
2.《操作系统概念》- Abraham Silberschatz、Peter B. Galvin 和 Greg Gagne
3.《编译原理》- Alfred V. Aho 和 Jeffrey D. Ullman
4.《算法导论》- Thomas H. Cormen、Charles E. Leiserson、Ronald L. Rivest 和 Clifford Stein
5.《计算机网络：自顶向下方法》- James F. Kurose 和 Keith W. Ross
6.《深入理解计算机系统》- Randal E. Bryant 和 David R. O’Hallaron
7.《数据库系统概念》- Abraham Silberschatz、Henry F. Korth 和 S. Sudarshan
8.《现代操作系统》- Andrew S. Tanenbaum 和 Herbert Bos
9.《计算机组成与设计：硬件/软件接口》- David A. Patterson 和 John L. Hennessy
10.《计算机视觉：模型、学习和推断》- Simon J.D. Prince
11.《计算机科学导论》- John Zelle
12.《计算机安全：艺术与科学》- Matt Bishop
13.《机器学习》- Tom M. Mitchell
14.《编程珠玑》- Jon Bentley
15.《高可用性MySQL》- Charles Bell、Mats Kindahl 和 Lars Thalmann
16.《Java编程思想》- Bruce Eckel
17.《HTTP权威指南》- David Gourley 和 Brian Totty
18.《Python编程导论》- John Zelle
19.《Linux命令行和Shell脚本编程大全》- Richard Blum
20.《Web安全机制详解》- Ryan Barnett
```

### tac命令

- 命令名称：tac
- 命令英文原意：
- 命令所在路径：/usr/bin/tac
- 执行权限：所有用户
- 功能描述：反向显示文件内容
- 语法：tac /etc/issue

### more命令

- 命令名称：more
- 命令英文原意：
- 命令所在路径：/bin/more
- 执行权限：所有用户
- 功能描述：分页显示文件内容，只能向下看，不能回去
- 语法：more [文件名]

- `空格`或`f` 翻页
- `Enter` 换行
- `q`或`Q` 退出

```
$ more /etc/services
```

### less命令

- 命令名称：less
- 命令英文原意：
- 命令所在路径：/usr/bin/less
- 执行权限：所有用户
- 功能描述：分页显示文件内容，可向上翻页
- 语法：less [文件名]

- `pageup`向上翻页
- `↑` 向上一行
- `g` 移到文件的开头
- `G` 移动到文件的末尾
- `/` 搜索

- n 下一个匹配项
- N 上一个匹配项

![linux-less分页](assets/linux-less分页.png)

### head命令

- 命令名称：head
- 命令英文原意：
- 命令所在路径：/usr/
- 执行权限：所有用户
- 功能描述：显示文件前面几行
- 语法：head -n [文件名]

- -n 执行要显示的行数，默认是10

```
$ head -5 /etc/services 
/etc/services:
Id: services,v 1.49 2017/08/18 12:43:23 ovasik Exp $
Network services, Internet style
IANA services version: last updated 2016-07-08
```

### tail命令

- 命令名称：tail
- 命令英文原意：
- 命令所在路径：/usr/bin/tail
- 执行权限：所有用户
- 功能描述：显示文件后边几行
- 语法：tail [文件名]

- -n 指定行数
- -f 该选项会使得命令行窗口停留在输出文件内容状态，当文件中有新内容写入时，就会动态输出。

```
$ tail booklist.txt 
11.《计算机科学导论》- John Zelle
12.《计算机安全：艺术与科学》- Matt Bishop
13.《机器学习》- Tom M. Mitchell
14.《编程珠玑》- Jon Bentley
15.《高可用性MySQL》- Charles Bell、Mats Kindahl 和 Lars Thalmann
16.《Java编程思想》- Bruce Eckel
17.《HTTP权威指南》- David Gourley 和 Brian Totty
18.《Python编程导论》- John Zelle
19.《Linux命令行和Shell脚本编程大全》- Richard Blum
20.《Web安全机制详解》- Ryan Barnett
```

### ln命令

- 命令名称：ln
- 命令英文原意：link
- 命令所在路径：/bin/ln
- 执行权限：所有用户
- 功能描述：生成链接文件
- 语法：ln -s [源文件] [目标文件]

- -s 创建软链接

```
$ ln -s /etc/issue /home/root/issue.soft
创建文件/etc/issue 的软链接 /home/root/issue.soft

$ ln /etc/issue /home/root/issue.hard
创建文件/etc/issue 的硬链接 /home/root/issue.hard
```

**硬链接特征：**

- 与源文件共用`i节点`
- 拷贝cp -p + 文件同步更新
- 不能跨分区
- 不能针对目录使用

**软链接特征：**

- lrwxrwxrwx l软连接，权限都为lrwxrwxrwx
- 文件很小，只是链接文件
- issue.soft -> /etc/issue 箭头指向源文件

```
$ ls -il /etc/issue issue.soft issue.hard 
    24938 -rw-r--r--. 2 root root 23 Nov 10  2021 /etc/issue
    24938 -rw-r--r--. 2 root root 23 Nov 10  2021 issue.hard
117683269 lrwxrwxrwx  1 root root 10 May 14 16:14 issue.soft -> /etc/issue
```

## 权限管理命令

### chmod命令

- 命令名称：chmod
- 命令英文原意：change the permissions mode of a file
- 命令所在路径：/bin/chmod
- 执行权限：所有用户
- 功能描述：改变文件或目录的权限
- 语法：chmod [{ugoa}{+-=}{rwx}] [文件或目录] [mode=421] [文件或目录]

- -R 递归修改

| 权限字母 | 权限数字 | 权限 | 文件 | 目录 |
| --- | --- | --- | --- | --- |
|r|4|读|查看文件内容|列出目录内容|
|w|2|写|修改文件内容|在目录中创建、删除文件|
|x|1|执行|执行文件|进入目录|

![linux-chmod权限](assets/linux-chmod权限.png)

### chown命令

- 命令名称：chown
- 命令英文原意：change file ownership
- 命令所在路径：/bin/chown
- 执行权限：所有用户
- 功能描述：改变目录或文件的所有者
- 语法：chown [用户] [文件或目录]

```
$ chown Anthony booklist.txt 
改变文件booklist.txt的所有者为Anthony
```

### chgrp命令

- 命令名称：chgrp
- 命令英文原意：change file group ownership
- 命令所在路径：/bin/chgrp
- 执行权限：所有用户
- 功能描述：改变目录或文件的所属组
- 语法：chown [用户] [文件或目录]

```
添加一个用户组
$ groupadd learn_linux
$ chgrp learn_linux booklist.txt
```

### umask命令

- 命令名称：umask
- 命令英文原意：the user file-creation mask
- 命令所在路径：Shell内置命令
- 执行权限：所有用户
- 功能描述：显示设置文件的缺省权限
- 语法：umask [-S]

- -S 以rwx形式显示新建文件缺省权限

```
$ umask -S
u=rwx,g=rx,o=rx
```

## 文件搜索命令

### find命令

- 命令名称：find
- 命令英文原意：
- 命令所在路径：/bin/find
- 执行权限：所有用户
- 功能描述：文件搜索
- 语法：find [搜索范围] [匹配条件]

- -name 根据名字找
- -i 忽略大小写
- -size 根据文件大小查找
- -user 根据所有者查找
- -group 根据所属组查找
- -amin 访问时间 access
- -cmin 文件属性更改时间 change
- -mmin 文件内容更改时间 modify
- -type 类型
- -inum 根据`i节点`查找

- **-size详解**

**+n大于 -n小于 n等于**

```
$ find / -size +204800
```

在根目录下查找大于100MB的文件。n表示的是数据块的大小，在linux中一个数据块是512字节，也就是0.5K。

100M = 102400K = 204800块

- **连接条件**

如果想查找大于80M，小于100M的文件，就需要用到连接条件。连接条件有两种

- -a 同时满足，and
- -o 或

- **-type详解**

**f 文件 d 目录 l 软连接**

- **对查找的结果做进一步操作**

```
find /etc -name inittab -exec ls -l {} \;
```

在/etc下查找inittab文件并，然后显示其详细信息

`-exec或者-ok 命令 {} \;` 对搜索结果执行操作

### locate命令

- 命令名称：locate
- 命令英文原意：
- 命令所在路径：/usr/bin/locate
- 执行权限：所有用户
- 功能描述：在文件资料库中查找文件
- 语法：locate [文件名]

- -i 忽略大小写

```
$ locate inittab
/etc/inittab
/usr/share/vim/vim80/syntax/inittab.vim
```

文件资料库是linux维护的一个索引，定期更新，也可使用`updatedb`手动更新。因此，在更新前可能存在找不到文件的情况

### which命令

- 命令名称：which
- 命令英文原意：
- 命令所在路径：/usr/bin/which
- 执行权限：所有用户
- 功能描述：搜索命令所在目录 及 别名 信息
- 语法：which 要查找的命令

```
$ which ls
alias ls='ls --color=auto'
        /usr/bin/ls
```

### whereis命令

- 命令名称：whereis
- 命令英文原意：
- 命令所在路径：/usr/bin/whereis
- 执行权限：所有用户
- 功能描述：搜索命令所在目录 及 帮助文档路径
- 语法：whereis ls

```
$ whereis ls
ls: /usr/bin/ls /usr/share/man/man1/ls.1.gz /usr/share/man/man1p/ls.1p.gz
```

### grep命令

- 命令名称：grep
- 命令英文原意：
- 命令所在路径：/bin/grep
- 执行权限：所有用户
- 功能描述：在文件**中**搜寻字符串匹配的行并输出
- 语法：grep -iv [指定字符串] [文件]

- -i 忽略大小写
- -v 排除指定字符串

```
$ grep -v ^$ /etc/inittab
```

排除行首的#，所在的行

## 帮助命令

### man命令

- 命令名称：man
- 命令英文原意：manual
- 命令所在路径：/user/bin/man
- 执行权限：所有用户
- 功能描述：获得帮助信息
- 语法：man [命令或配置文件]

```
$ man ls
```

```
$ man services
```

在使用man时，后直接跟命令或配置文件名称即可，不需要加文件的绝对路径

对于像passwd这样的，它比较特殊。既是命令也是配置文件。我们用whereis查看一下，你会发现他有两个路径，他的帮助文档有`1.gz`和`5.gz`。在linux中`1.gz`是命令的帮助文档，`5.gz`是配置文件的帮助文档。

```
$ whereis passwd
passwd: /usr/bin/passwd /etc/passwd /usr/share/man/man1/passwd.1.gz /usr/share/man/man5/passwd.5.gz
```

默认是查看命令的帮助文档，查看配置文件的帮助文档可以加上5.

```
$ man 5 passwd
```

### whatis命令

- 命令名称：whatis
- 命令英文原意：
- 命令所在路径：/usr/bin/whatis
- 执行权限：所有用户
- 功能描述：查看命令的功能，对查询的命令给出介绍
- 语法：

```
$ whatis ifconfig
ifconfig (8)         - configure a network interface
```

### apropos命令

- 命令名称：apropos
- 命令英文原意：
- 命令所在路径：
- 执行权限：
- 功能描述：介绍配置文件Name
- 语法：apropos inittab

### --help选项

![linux-help选项](assets/linux-help选项.png)

### help命令

- 命令名称：help
- 命令英文原意：
- 命令所在路径：Shell内置命令
- 执行权限：所有用户
- 功能描述：获得Shell内置命令的帮助信息
- 语法：help 查询的命令

```
$ help umask
查看umask命令的帮助信息
```

## 用户管理命令

### useradd命令

- 命令名称：useradd
- 命令英文原意：
- 命令所在路径：/usr/sbin/useradd
- 执行权限：root
- 功能描述：添加新用户
- 语法：useradd 用户名

```
$ useradd yangmi
```

### passwd命令

目录处理命令：

- 命令名称：passwd
- 命令英文原意：
- 命令所在路径：/usr/bin/passwd
- 执行权限：所有用户
- 功能描述：设置用户密码
- 语法：passwd 用户名，然后输入密码即可

### who命令

- 命令名称：who
- 命令英文原意：
- 命令所在路径：/usr/bin/who
- 执行权限：所有用户
- 功能描述：查看登录用户信息
- 语法：who

```
$ who
Anthony  pts/0        2023-05-17 08:01 (223.72.44.131)
root     pts/1        2023-05-17 08:31 (223.72.44.131)
```

### w命令

- 命令名称：w
- 命令英文原意：
- 命令所在路径：/usr/bin/w
- 执行权限：所有用户
- 功能描述：查看用户登录详细信息
- 语法：w

```
$ w
 08:38:34 up 7 days, 20:41,  2 users,  load average: 0.03, 0.04, 0.00
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
Anthony  pts/0    223.72.44.131    08:01    0.00s  0.04s  0.00s w
root     pts/1    223.72.44.131    08:31   10.00s  0.02s  0.02s -bash
```

## 压缩命令

### gzip压缩命令

- 命令名称：gzip
- 命令英文原意：GNU zip
- 命令所在路径：/bin/gzip
- 执行权限：所有用户
- 功能描述：压缩文件，**只能压缩文件，不能压缩目录。不保留源文件**
- 语法：gzip [文件]
- 压缩后的格式：.gz

```
$ gzip this_is_a_file
```

### gunzip解压缩命令

- 命令名称：gunzip
- 命令英文原意：GNU unzip
- 命令所在路径：/bin/gunzip
- 执行权限：所有用户
- 功能描述：解压缩.gz文件
- 语法：gunzip [.gz文件]

```
$ gunzip this_is_a_file.gz
```

### tar压缩命令

- 命令名称：tar
- 命令英文原意：
- 命令所在路径：bin/tar
- 执行权限：所有用户
- 功能描述：打包目录、文件
- 语法：tar [-zcf] [压缩后的文件名] [文件或目录]

- -c 打包
- -v 显示打包压缩过程详细信息
- -f 指定文件名
- -z 压缩

- 压缩文件后缀格式：.tar.gz

```
$ tar -zcf a_new_folder.tar.gz a_new_folder
$ ls
a_new_folder  a_new_folder.tar.gz  booklist.txt  issue.hard  issue.soft
```

### tar解压缩命令

- 语法：tar [-zxf] [压缩后的文件名] [文件或目录]

- -x 解包
- -v 显示打包压缩过程详细信息
- -f 指定文件名
- -z 打包同时压缩

```
$ tar -zxf a_new_folder.tar.gz
```

### zip压缩命令

- 命令名称：zip
- 命令英文原意：
- 命令所在路径：/usr/bin/zip
- 执行权限：所有用户
- 功能描述：压缩文件或目录
- 语法：zip [-r] [压缩后的文件名][文件或目录]

- -r 压缩目录

- 压缩后的文件格式：.zip

### unzip解压缩命令

- 命令名称：unzip
- 命令英文原意：
- 命令所在路径：/usr/bin/unzip
- 执行权限：所有用户
- 功能描述：解压.zip文件
- 语法：unzip [.zip文件]

### bzip2压缩命令

- 命令名称：bzip2
- 命令英文原意：
- 命令所在路径：/usr/bin/bzip2
- 执行权限：所有用户
- 功能描述：压缩文件，还是只能压缩文件
- 语法：bzip2 选项[-k] [文件]

- -k 保留原文件

- 压缩后文件格式：.bz2

## 网络命令

### write命令

- 命令名称：write
- 命令英文原意：
- 命令所在路径：/usr/bin/write
- 执行权限：所有用户
- 功能描述：给用户发信息，以Ctrl+D保存结束
- 语法：write <用户名>

```
$ write root
```

### wall

- 命令名称：wall
- 命令英文原意：write all
- 命令所在路径：/usr/bin/wall
- 执行权限：所有用户
- 功能描述：发广播信息
- 语法：wall [message]

```
$ wall nihao
```

### ping命令

- 命令名称：ping
- 命令英文原意：
- 命令所在路径：/bin/ping
- 执行权限：所有用户
- 功能描述：测试网络联通性
- 语法：ping -c 次数 IP地址

- -c 指定ping的次数

```
$ ping -c 10 www.baidu.com
```

### ifconfig命令

- 命令名称：ifconfig
- 命令英文原意：interface configure
- 命令所在路径：/sbin/ifconfig
- 执行权限：root
- 功能描述：查看和设置网卡信息
- 语法：ifconfig 网卡名称 IP地址

```
$ ifconfig
```

### ip addr show命令

- 命令名称：ip addr show
- 命令英文原意：
- 命令所在路径：
- 执行权限：
- 功能描述：查看本地ip
- 语法：

### mail命令

- 命令名称：mail
- 命令英文原意：
- 命令所在路径：/bin/mail
- 执行权限：所有用户
- 功能描述：查看、发送电子邮件给用户
- 语法：mail [用户名]

### last命令

- 命令名称：last
- 命令英文原意：
- 命令所在路径：/usr/bin/last
- 执行权限：所有用户
- 功能描述：列出目前与过去登入系统的用户信息
- 语法：last

```
$ last
```

### lastlog命令

- 命令名称：lastlog
- 命令英文原意：
- 命令所在路径：/usr/bin/lastlog
- 执行权限：所有用户
- 功能描述：只查看用户最后一次登录的信息
- 语法：lastlog [-u]

```
$ lastlog -u 1001
```

### traceroute命令

- 命令名称：traceroute
- 命令英文原意：
- 命令所在路径：/bin/traceroute
- 执行权限：所有用户
- 功能描述：显示数据包到主机间的路由路径
- 语法：traceroute

```
traceroute www.baidu.com
```

### netstat

- 命令名称：netstat
- 命令英文原意：
- 命令所在路径：/bin/netstat
- 执行权限：所有用户
- 功能描述：显示网络相关信息
- 语法：netstat [选项]

- -t TCP协议
- -u UDP协议
- -l 监听
- -r 查看路由表
- -n 显示IP地址和端口号

![linux-netstat](assets/linux-netstat.png)

**更详细的netstat**

`netstat`是一个功能强大的网络工具，用于显示网络相关的统计信息，例如打开的连接、路由表、接口状态等。以下是`netstat`命令的一些常用参数和它们的说明：

- `-a` 或者 `--all`：显示所有的套接字（Socket），包括处于监听状态的。
- `-b`：显示程序名称和相对应的统计信息（在Windows系统中）。
- `-e`：显示以太网统计信息，比如错误的数据包数等（在Windows系统中）。
- `-g`：显示多播组成员列表（仅Linux）。
- `-i`：显示网卡接口的统计信息。
- `-l`：仅显示监听中的服务器套接字。
- `-n`：以数字形式显示地址和端口号，不进行名字解析。
- `-o`：显示每个连接的网络拥塞提供者（TCP控制块）信息（在Windows中）。
- `-p`：显示正在使用套接字的进程标识符和名称。
- `-r`：显示路由表。
- `-s`：按协议显示统计数据，包含TCP、UDP、ICMP等。
- `-t` 或 `--tcp`：显示TCP连接。
- `-u` 或 `--udp`：显示UDP连接。
- `-v`：在某些系統中使用时可以显示非正常的错误信息。
- `-w`：显示Raw套接字信息。
- `-x`：显示Unix套接字信息，只在Linux系统下有效。

这些参数可以组合使用以获得更详细的信息。例如，使用`netstat -ant`可以查看所有处于监听状态以及非监听状态的TCP连接，并以数字形式显示端口号。

根据你的操作系统和权限的不同，某些参数可能会有不同的行为或不被支持。

### mount命令

- 命令名称：mount
- 命令英文原意：
- 命令所在路径：/bin/mount
- 执行权限：所有用户
- 功能描述：
- 语法：mount [-t 文件系统] 设备文件名 挂载点

```
将/dev/sr0 挂载到/mnt/cdrom下
mount /dev/sr0 /mnt/cdrom
```

## 关机重启命令

### shutdown命令

- 命令名称：shutdown
- 命令英文原意：
- 命令所在路径：/usr/sbin/shutdown
- 执行权限：所有用户
- 功能描述：关机
- 语法：shutdown [选项] 时间

- -c 取消前一个关机命令
- -h 关机
- -r 重启

```
shutdown -h now
```

其他关机命令

- halt
- poweroff
- init 0

其他重启命令

- Reboot
- init 6

### logout命令

退出登录，没啥说的

## 系统运行级别

系统以什么模式运行，执行命令方式是init 加下列数字

- 0 关机
- 1 单用户
- 2 不完全多用户，不含NFS服务
- 3 完全多用户
- 4 未分配
- 5 图形界面
- 6 重启