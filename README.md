# 东山岛之旅短情长

<!-- AI-HANDOFF-ENTRY -->
**AI接手与运行：**[从这里开始](AI_START_HERE.md) · [安装/启动/数据说明](docs/AI_HANDOFF.md) · [实际验证结果](docs/VERIFICATION.md)。
<!-- /AI-HANDOFF-ENTRY -->


一个给多个家庭共同使用的旅行 AA 记账网页，手机端优先设计。

在线使用：[东山岛之旅短情长](https://shanelau068-a11y.github.io/dongshan-trip-ledger/)

## 可以做什么

- 自定义同行家庭名称
- 登记餐费、住宿、交通、门票、采购等费用
- 自动计算总支出和每家平均金额
- 显示每个家庭已付、应收或应补金额
- 自动给出尽量少的转账结算方案
- 所有人打开同一个网址即可共同填写，数据自动同步

金额以“分”为单位保存，避免小数计算误差。网页每 15 秒自动同步一次，也可以点击右上角手动刷新。

## 本地运行

```bash
npm install
npm run dev
```

## 检查

```bash
npm run lint
npm test
```
