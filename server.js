const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Wavespeed API 配置
const WAVESPEED_API_KEY = '5f1c528cca5f7931bcfbd2d39742a9cefae16d14541343c256d15faad72fb939';
const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo';

// 讯飞 AI API 配置（赛博小猫对话）
const XUNFEI_API_KEY = '573b982e148e35dc008176409d7478ae:MGZlOTc5YzdkYWEzZTA0MjhmNDkzNjJm';
const XUNFEI_API_URL = 'https://maas-coding-api.cn-huabei-1.xf-yun.com/anthropic/v1/messages';
const XUNFEI_MODEL = 'astron-code-latest';

// 中间件
app.use(cors({
  origin: ['http://localhost:3000', 'https://thriving-appreciation-production-92de.up.railway.app'],
  credentials: true
}));
app.use(express.json());
// 使用正斜杠路径，确保静态文件正确服务
app.use(express.static(__dirname.replace(/\\/g, '/')));
app.use(session({
  secret: 'neon-arcade-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 小时
  }
}));

// 初始化 SQLite 数据库
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('已连接到 SQLite 数据库');
    // 创建用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('创建表失败:', err);
      } else {
        console.log('用户表已就绪');
      }
    });

    // 创建图片表
    db.run(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        image_url TEXT NOT NULL,
        api_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_date TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        console.error('创建图片表失败:', err);
      } else {
        console.log('图片表已就绪');
        // 添加 created_date 列（如果不存在）
        db.run(`ALTER TABLE images ADD COLUMN created_date TEXT`, () => {});
      }
    });
  }
});

// 注册 API
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  // 验证输入
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: '请填写所有字段' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: '密码至少需要 6 位' });
  }

  try {
    // 检查用户是否已存在
    const checkSql = 'SELECT * FROM users WHERE username = ? OR email = ?';

    db.get(checkSql, [username, email], async (err, user) => {
      if (err) {
        console.error('查询错误:', err);
        return res.status(500).json({ success: false, message: '服务器错误' });
      }

      if (user) {
        return res.status(400).json({
          success: false,
          message: user.username === username ? '用户名已存在' : '邮箱已被注册'
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 插入新用户
      const insertSql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';

      db.run(insertSql, [username, email, hashedPassword], function(err) {
        if (err) {
          console.error('插入错误:', err);
          return res.status(500).json({ success: false, message: '注册失败' });
        }

        // 设置 session
        req.session.userId = this.lastID;
        req.session.username = username;

        res.json({
          success: true,
          message: '注册成功',
          user: { id: this.lastID, username, email }
        });
      });
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 登录 API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // 验证输入
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请填写用户名和密码' });
  }

  const sql = 'SELECT * FROM users WHERE username = ?';

  db.get(sql, [username], async (err, user) => {
    if (err) {
      console.error('查询错误:', err);
      return res.status(500).json({ success: false, message: '服务器错误' });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 设置 session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
      success: true,
      message: '登录成功',
      user: { id: user.id, username: user.username, email: user.email }
    });
  });
});

// 登出 API
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('登出错误:', err);
      return res.status(500).json({ success: false, message: '登出失败' });
    }
    res.json({ success: true, message: '登出成功' });
  });
});

// 检查登录状态 API
app.get('/api/auth/status', (req, res) => {
  if (req.session.userId) {
    res.json({
      success: true,
      loggedIn: true,
      user: { id: req.session.userId, username: req.session.username }
    });
  } else {
    res.json({ success: true, loggedIn: false });
  }
});

// 保存资料 API
app.post('/api/profile', (req, res) => {
  const { country, age, occupation, gender } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }

  res.json({ success: true, message: '资料已保存', profile: { country, age, occupation, gender } });
});

// 文生图 API - 调用 Wavespeed Z-Image-Turbo
app.post('/api/generate-image', async (req, res) => {
  const { prompt, userProfile } = req.body;
  const userId = req.session.userId;

  if (!prompt) {
    return res.status(400).json({ success: false, message: '请输入描述文字' });
  }

  // 整合用户资料到 prompt 中（降低权重，仅轻微影响）
  let enhancedPrompt = prompt;
  if (userProfile && Object.keys(userProfile).length > 0 && prompt.length > 50) {
    // 只在 prompt 较长时轻微添加用户背景，且放在末尾作为次要上下文
    const profileParts = [];
    if (userProfile.occupation) profileParts.push(`${userProfile.occupation}`);
    if (userProfile.age) profileParts.push(`${userProfile.age}年龄段`);

    if (profileParts.length > 0) {
      // 使用较弱的连接词，降低对用户 prompt 主干的影响
      enhancedPrompt = `${prompt} （风格参考：${profileParts.join('、')}的视角）`;
    }
  }

  console.log('增强后的 prompt:', enhancedPrompt);

  const postData = JSON.stringify({
    prompt: enhancedPrompt,
    size: '1024*1024',
    output_format: 'png',
    enable_sync_mode: true,
    enable_base64_output: false
  });

  const options = {
    hostname: 'api.wavespeed.ai',
    port: 443,
    path: '/api/v3/wavespeed-ai/z-image/turbo',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        // Wavespeed API 返回格式：code: 200 表示成功，data.status: completed 表示完成
        const isSuccess = result.code === 200 || (result.data && result.data.status === 'completed');

        if (isSuccess && result.data && result.data.outputs && result.data.outputs.length > 0) {
          const imageUrl = result.data.outputs[0];
          const apiId = result.data.id;

          console.log('生成成功，userId:', userId, 'prompt:', prompt);

          // 如果用户已登录，保存图片到数据库
          if (userId) {
            const createdDate = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
            db.run(
              'INSERT INTO images (user_id, prompt, image_url, api_id, created_date) VALUES (?, ?, ?, ?, ?)',
              [userId, prompt, imageUrl, apiId, createdDate],
              (err) => {
                if (err) {
                  console.error('保存图片失败:', err);
                } else {
                  console.log('图片已保存到数据库:', imageUrl);
                }
              }
            );
          }

          res.json({
            success: true,
            imageUrl: imageUrl,
            id: apiId
          });
        } else {
          res.status(500).json({
            success: false,
            message: '图片生成失败',
            status: result.data?.status || 'unknown',
            detail: result
          });
        }
      } catch (e) {
        res.status(500).json({
          success: false,
          message: '解析响应失败',
          error: e.message
        });
      }
    });
  });

  apiReq.on('error', (e) => {
    res.status(500).json({
      success: false,
      message: 'API 请求失败',
      error: e.message
    });
  });

  apiReq.write(postData);
  apiReq.end();
});

// 获取用户图片列表 API
app.get('/api/images', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.json({ success: true, images: [] });
  }

  db.all('SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
    if (err) {
      console.error('查询图片失败:', err);
      return res.status(500).json({ success: false, message: '查询失败' });
    }
    res.json({ success: true, images: rows });
  });
});

// 赛博小猫对话 API
app.post('/api/cat-chat', async (req, res) => {
  const { prompt, userProfile } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, message: '请输入内容' });
  }

  // 构建系统提示词，定义赛博小猫的人设
  const systemPrompt = `你是一只生活在赛博空间的霓虹小猫，名叫"霓虹喵"。
你的特点：
- 语气可爱、俏皮，喜欢用"喵~"、"呐~"、"哦~"等语气词
- 对用户的输入表现出好奇和兴趣
- 会用猫咪的视角理解事物，比如把电脑屏幕当成"发光的盒子"
- 偶尔提到赛博世界的元素，如数据流、霓虹灯、虚拟空间等
- 回复简短有趣，2-3 句话，不要太长
- 适当使用 emoji，如 🐱 ✨ 🌆 💻 🔮

请用这样的风格回复用户的输入。`;

  const userMessage = `用户刚刚生成了这样一张图片，描述是："${prompt}"${userProfile ? `\n用户信息：${JSON.stringify(userProfile)}` : ''}\n请以赛博小猫的身份，对这个描述说点什么有趣的话吧！喵~`;

  const postData = JSON.stringify({
    model: XUNFEI_MODEL,
    max_tokens: 150,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage
      }
    ]
  });

  const options = {
    hostname: 'maas-coding-api.cn-huabei-1.xf-yun.com',
    port: 443,
    path: '/anthropic/v1/messages',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${XUNFEI_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('讯飞 AI 响应:', result);

        // 提取回复内容
        let catReply = '';
        if (result.content && result.content.length > 0) {
          catReply = result.content[0].text || '';
        } else if (result.choices && result.choices.length > 0) {
          catReply = result.choices[0].message?.content || '';
        }

        if (catReply) {
          res.json({
            success: true,
            message: catReply
          });
        } else {
          res.status(500).json({
            success: false,
            message: '无法生成回复',
            detail: result
          });
        }
      } catch (e) {
        res.status(500).json({
          success: false,
          message: '解析响应失败',
          error: e.message,
          rawResponse: data
        });
      }
    });
  });

  apiReq.on('error', (e) => {
    res.status(500).json({
      success: false,
      message: 'AI 请求失败',
      error: e.message
    });
  });

  apiReq.write(postData);
  apiReq.end();
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🎮 霓虹街机服务器运行在 http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('关闭数据库错误:', err);
    }
    console.log('数据库连接已关闭');
    process.exit(0);
  });
});
