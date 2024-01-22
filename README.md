# NexusphpStaffBot

nexusphp 通用 TG 站务机器人

## 设计目标
* 便捷处理站务, 避免用户等待太久, 也减轻了管理组的负担
* 定时通知, 比如候选有的时候就会忘掉
* 使用皮套统一回复
## 用途
> 也可以简单作为私信的 TG 机器人使用, 其他功能没权限没数据会跳过

* mod+ 单独拉个群, 群里面用机器人统一处理站务. 机器人的用户信息群内共享. 消息处理完之后在消息上面使用表情进行回复, 用于区分和标记状态.
* 简单的`管理组私信`和`私信`可以直接在 TG 里面回复对应消息, 机器人会自动转发到站内.
* ~~有时站点确实不如 TG 看的多~~
## 支持的功能
* 管理组私信, 翻页
* 举报处理
* 私信, 翻页
* 候选
* 设置为已处理: 管理组私信, 举报
* 已处理信息自动删除
* TG 回复: 管理组私信, 举报, 私信

## 支持的站点
> 基于原版 nexusphp 开发, 有些站点可能需要适配才能使用

* [x] PterClub
* [x] 2xfree
* [ ] Audiences
* [ ] OurBits

## 运行
> 部署多个的时候务必修改目录, 保证一个目录对应一个容器  
>

1. 修改 compose 文件里面以下内容
2. `docker-compose up -d` 即可

```
    environment:
      - TZ=Asia/Shanghai
      # tg 机器人 token
      - BOT_TOKEN=xxxxxxxx
      # tg 群组 id
      - GROUP_ID=
      # 通用话题 id
      - GENERAL_THREAD_ID=
      # 管理组消息 话题 id
      - GENERAL_MSG_THREAD_ID=
      # 服务
      # 开启定时任务, 默认 15 分钟一次
      - STAFF_MSG_ENABLE=true
      # - STAFF_MSG_ENABLE=false
      # 服务配置
      # mod+ 用户的 cookie, 要不然看不消息...
      - STAFF_MSG_COOKIE=xxxxxxxx
      ## 单独控制可选功能, 比如候选单独给种审拉个群
      # GROUP_ID 和 THREAD_ID 相关配置支持向上 fallback
      # XXXX_MSG_THREAD_ID=false 时, 支持发送消息到非话题群组, 除了 GENERAL_MSG_THREAD_ID
      # 管理组私信
      - STAFF_MSG_GROUP_ID=
      - STAFF_MSG_THREAD_ID=
      - STAFF_MSG_DISABLE_STAFF=false
      # 举报
      - REPORT_MSG_GROUP_ID=
      - REPORT_MSG_THREAD_ID=
      - STAFF_MSG_DISABLE_REPORT=false
      # 私信
      - MSG_MSG_GROUP_ID=
      - MSG_MSG_THREAD_ID=
      - STAFF_MSG_DISABLE_MESSAGE=false
      # 候选
      - OFFER_MSG_GROUP_ID=
      - OFFER_MSG_THREAD_ID=
      - STAFF_MSG_DISABLE_OFFER=false
      # 站点schema
      - STAFF_MSG_SITE=PterClub
      # - STAFF_MSG_SITE=Xfree
      # - STAFF_MSG_SITE=Audiences
      # - STAFF_MSG_SITE=Ourbits
```

## 可用机器人命令列表
> 编辑机器人命令时可以直接用这个发给 `@BotFather`  

```
id - 获取 ChatId 等
staff - 获取管理组消息
json - 以 json 格式获取消息内容-调试用
```

## ID 信息怎么获取?

1. 使用 id 命令
2. 使用其他 bot 获取
3. 将机器人添加到群组后, 设置为管理员, 从日志里面能看出来
4. https://iitii.github.io/2022/09/28/1/

## 适配新站点
* 站点信息位于: `libs/staff/sites/index.js`, 基于 `libs/staff/sites/NexusphpSchema.js` 模板进行开发, 所有方法均已抽象, 按需实现即可.
* 管理站内信私信我
----
* 并不是所有站点都需要这个功能, 或许也有一些站点已经自己实现了部分功能, 但是没有开源出来
* 开源的目的是为了减少重复劳动, 也是为了方便站点管理组, 方便用户.
* 如果你需要这个功能, 请提 issue, 或者自己实现, 希望可以提 PR
