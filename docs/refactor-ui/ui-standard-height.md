页面内的卡片的标准高度：

          height: calc(100vh - 240px)

   包含了：
   •  Header: 50px
   •  Content padding top: 24px
   •  标题区域（Title + Text + margins）: 约 100px
   •  Content padding bottom: 24px
   •  其他边距: 约 42px

   总计约 240px，这样卡片应该正好填充可视区域，不会
   出现额外的滚动条了。

---

## 行动任务详情页面高度计算

行动任务详情页面（ActionTaskDetail）的内容区域高度：

          height: calc(100vh - 168px)

   包含了：
   •  Header: 50px
   •  页面头部（page-header + marginBottom 8px）: 约 50px
   •  Card body padding: 12px × 2 = 24px
   •  其他边距: 约 44px

   总计约 168px，确保任务交互记录框的底部边距与左右边距（Card padding 12px）保持一致。