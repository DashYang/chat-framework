---
title: 林警官
profiles: ../profiles.yml
chat: ../chats/incident.yml
articles: ../articles
theme: wechat
specVersion: '3.0'
---

@detective #case-open [2026-07-18 19:40:00]
周屿，今晚那位独自来店里的客人，从点餐开始说。任何细节都别漏。

@waiter #order [+1m] [quote:case-open]
他只点了一碗海龟汤。汤端上去后，他尝了一口，马上问我：“这真的是海龟汤吗？”

@waiter #receipt [+1m] [image]
../assets/restaurant-receipt.svg
19:32 的点菜单：海龟汤一份，除此之外什么也没有。

@detective #confirm [+1m]
你确认那是真海龟熬的？

@waiter #answer-confirm [+1m] [quote:confirm]
确认。主厨也当面告诉了他。他听完脸色惨白，只说了一句“原来如此”，结账离开。后来警方通知我们，他当晚死了。

@detective #investigation-choice [+1m] [choice]
prompt: 先从哪条线索查起？
speaker: waiter
scope: global
options:
  menu:
    label: 核对菜单与旧报道
    text: 我去找菜单和本地旧报。
    score: 1
    flags:
      - case-open
  identity:
    label: 调查客人的过去
    text: 我先查这位客人的身份。
    score: 1
    flags:
      - case-open

@detective #case-status [+1m] [status] [require-flag:case-open]
案件调查已开启：新的对话、社交动态与文章将在下一阶段出现
