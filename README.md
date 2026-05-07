# 霓虹街机 - Neon Arcade

霓虹风格的用户登录注册系统


### 1. 打开浏览器

访问 `https://caring-wonder-production-d5c1.up.railway.app`

## 功能

- ✅ 用户注册（用户名、邮箱、密码）
- ✅ 用户登录（密码加密验证）
- ✅ Session 会话管理
- ✅ SQLite 数据库存储
- ✅ 霓虹风格 UI

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite
- **密码加密**: bcryptjs
- **会话管理**: express-session

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/register | 用户注册 |
| POST | /api/login | 用户登录 |
| POST | /api/logout | 用户登出 |
| GET | /api/auth/status | 检查登录状态 |

## 页面流程

```
登录页 → 资料页 → 菜单页 ←→ 画廊页
                    ↓
              仪表板页 → 回忆画廊页
                    ↓
              多排画廊页
```
