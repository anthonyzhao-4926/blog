---
title: mysql_settlement_line_demo
date: 2026-03-29
tags: [go, mcp, ai]
column: golang-mcp
order: 15
viewable: true
---

# 测试 Demo：`f_settlement_line_00` 表字段释义（MySQL 8）

> 虚构业务：跨境 B2C 订单在多国税务与货币归集场景下的「结算行」明细；下列字段用于演示复杂含义说明，勿当作真实生产 DDL。

## 主键与分片

| 字段 | 类型 | 含义与约定 |
| --- | --- | --- |
| `id` | `BINARY(16)` | UUIDv7 有序主键；**不得**用 `UUID()` 随机函数插入，避免 InnoDB 页分裂；应用层生成后写入。 |
| `shard_tag` | `TINYINT UNSIGNED` | 分片标签：`shard_tag = id[0] & 0xFF` 的派生冗余，供路由层 O(1) 校验「行是否属于本库」；与 `PARTITION BY HASH(shard_tag)` 对齐。 |

## 订单与金额（多币种）

| 字段 | 类型 | 含义与约定 |
| --- | --- | --- |
| `order_no` | `CHAR(26)` | 全渠订单号；前 2 位渠道码 + ULID；**唯一索引**与 `(id)` 共存，用于对账文件关联。 |
| `line_seq` | `SMALLINT UNSIGNED` | 同一 `order_no` 下第几条结算行；从 1 递增；删除中间行后**不回收**序号，避免出现「复活」的历史版本混淆。 |
| `amount_minor` | `BIGINT` | 以 `quote_currency_iso` 为单位的**最小货币单位**（integer cents）；波兰兹罗提等无辅币也通过 ISO-4217 `minor unit` 换算，禁止存浮点。 |
| `fx_rate_micro` | `DECIMAL(20,10)` | 相对 `base_currency_iso`**（账簿本位币）** 的汇率，放大 1e6 后的小数形式存库；示例：`6.5595701234` 表示 1 quote = 6.5595701234 base；对账差异阈值为 ±0.5 ulp。 |

## 状态机与位图

| 字段 | 类型 | 含义与约定 |
| --- | --- | --- |
| `status` | `ENUM('DRAFT','PENDING_TAX','LOCKED','POSTED','VOID','CHARGEBACK')` | 结算行生命周期；`LOCKED` 后仅允许 `POSTED` 或审计回滚到 `VOID`（需二段提交流水表配合，本表不展开）。 |
| `risk_flags` | `SET('AML_HOLD','SANCTIONS_LIST','VELOCITY','MANUAL_REVIEW','THIRD_PARTY_3DS')` | 风控标签多选；与上游 `risk_engine_rev` 版本绑定解释，**不得**在下游自行重排 bit 含义。 |
| `posting_bitmap` | `BIGINT UNSIGNED` | 按位标记已过账子分类：`bit0` 应收、`bit1` 递延收入、`bit2` 税务负债…；未定义位须为 0；扩展时只追加高位并 bump `schema_version`。 |

## JSON 与扩展元数据

| 字段 | 类型 | 含义与约定 |
| --- | --- | --- |
| `tax_breakdown` | `JSON` | 各国税种拆分；**结构受约束**于 `CHECK (json_schema_valid(...))`（MySQL 8.0.16+）；示例键：`VAT`、`GST`、`IOSS`、`marketplace_deemed_supplier`。缺失键表示该税种不适用，而非税率为 0。 |
| `ext` | `JSON` | 业务扩展袋；仅允许**白名单键**；`$.source_event_id` 指向 Kafka 幂等键；`$.compensation_of` 若非空，本行为对冲行，金额符号与原始行相反。 |

## 时间与审计

| 字段 | 类型 | 含义与约定 |
| --- | --- | --- |
| `business_date` | `DATE` | **账期日**（非自然日创建时间）；跨日切批以机构时区 `Asia/Shanghai` 的 05:00 为界，与 `posting_batch_id` 一并用于 GL 接口。 |
| `created_at` | `DATETIME(6)` | 行首次落库时间；**会话时区写死 UTC**，应用层 `SET time_zone = '+00:00'`。 |
| `updated_at` | `DATETIME(6)` | 末次变更；触发器禁止回拨；乐观锁由应用用 `WHERE updated_at = ?` 提交。 |

## 生成列（示例）

| 字段 | 类型 | 含义与约定 |
| --- | --- | --- |
| `amount_base_minor` | `BIGINT AS ((amount_minor * CAST(fx_rate_micro * 1000000 AS SIGNED)) / 1000000) STORED` | **账簿币金额**生成列；与批处理重算结果须在容差内一致，否则触发对账告警 `SETTLE_FX_DRIFT`。 |

---

**测试用途**：本文件仅供 MCP `resources/read` 拉取与展示 Markdown 能力验证。
