# Profile QR Tags

一个简单的 profile + QR code + 固定 tags 示例。流程：注册 -> 生成 QR -> 他人扫码后为你添加标签 -> profile 展示标签。

## 功能

- Signup 创建个人资料
- Profile 页面展示照片、名字、已添加标签
- 生成 QR Code（带 5 分钟过期）
- 扫码页面选择固定标签并提交

## 运行

先安装依赖，然后启动服务：

```bash
npm install
npm start
```

打开 `http://localhost:3000`。

## 测试

```bash
npm test
```

## 可调整项

- 在 `server.js` 中修改 `QR_TTL_MS` 与 `ALLOWED_TAGS`
- 在 `public/styles.css` 中调整 UI
