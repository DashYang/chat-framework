---
title: 最后一问
profiles: ../profiles.yml
chat: ../chats/answer.yml
articles: ../articles
theme: wechat
specVersion: '3.0'
---

@solver #final-answer [2026-07-20 10:00:00] [choice]
prompt: 男人喝到真正的海龟汤后，为什么会死亡？
speaker: solver
scope: account
options:
  truth:
    label: 他发现了荒岛上的真相
    text: 真正的海龟汤味道不同。他终于意识到，当年同伴给他的“海龟汤”其实来自已经死去的妻子，因此绝望地结束了生命。
    score: 0
    flags:
      - true-end-soup
  poison:
    label: 汤里被人下了毒
    text: 有人利用这碗汤毒死了他。
    score: 0
    flags:
      - bad-end-soup
  allergy:
    label: 他对海龟肉过敏
    text: 他不知道自己严重过敏，离店后发作。
    score: 0
    flags:
      - bad-end-soup
