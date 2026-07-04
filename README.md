# FluxGrab — 官网（Landing Site）

FluxGrab 产品官网的静态源码，可直接部署到 **GitHub Pages**（或任意静态托管：Cloudflare Pages、Netlify、Vercel）。

## 目录结构

```
FluxGrab-Site/
├── index.html        # 落地页（Hero / 功能 / 定价 / 下载 / FAQ）
├── terms.html        # 服务条款（支付审核需要）
├── privacy.html      # 隐私政策（支付审核需要）
├── refund.html       # 退款政策（支付审核需要）
├── assets/
│   ├── style.css     # 全站样式
│   ├── app.js        # 站点配置（把链接换成你的真实地址）
│   └── logo.svg      # 品牌图标
├── .nojekyll         # 让 GitHub Pages 原样输出静态文件
└── README.md
```

## 上线前只需改 3 个链接

打开 `assets/app.js`，把顶部的占位符换成你的真实地址：

```js
window.FLUXGRAB_CONFIG = {
  WEB_APP_URL:      "https://app.fluxgrab.com",                       // 在线体验版
  BUY_URL:          "https://fluxgrab.lemonsqueezy.com/buy/xxxx",     // 结账链接
  DOWNLOAD_WIN_URL: "https://github.com/<you>/fluxgrab/releases/latest" // Windows 安装包
};
```

页面上的「Web app / Get Pro / Windows 下载」按钮会自动指向这些地址。
另外把各页页脚、`support@fluxgrab.com` 邮箱换成你自己的联系邮箱。

## 部署到 GitHub Pages

> 提示：GitHub 用户名/组织名不能有空格。若想要 `https://<name>.github.io/...`，
> 需先注册一个合法用户名（如 `fluxgrab` 或 `myomni-downloader`）。

```bash
# 在本目录初始化并推送
git init
git add .
git commit -m "FluxGrab landing site"
git branch -M main
git remote add origin https://github.com/<你的用户名>/fluxgrab-site.git
git push -u origin main
```

然后在仓库 **Settings → Pages** 里：
- Source 选 `Deploy from a branch`
- Branch 选 `main` / 根目录 `/ (root)`

几分钟后即可通过 `https://<你的用户名>.github.io/fluxgrab-site/` 访问。

### 绑定自定义域名（推荐 fluxgrab.com）

1. 到注册商（Cloudflare / Porkbun / Namecheap）注册并解析 `fluxgrab.com`。
2. 在仓库 **Settings → Pages → Custom domain** 填 `fluxgrab.com`。
3. 在 DNS 处按 GitHub 提示添加记录（`A` 记录指向 GitHub Pages IP，或 `CNAME` 指向 `<用户名>.github.io`）。
4. GitHub 会自动创建 `CNAME` 文件并签发 HTTPS 证书。

## 本地预览

```powershell
# 任意静态服务器均可，例如：
python -m http.server 5500
# 然后浏览器打开 http://127.0.0.1:5500
```

## 合规提示（重要）

- 文案刻意采用通用「媒体备份工具」定位，**不点名任何第三方平台**，主打"下载你拥有或已授权的内容"。这对通过 Lemon Squeezy / Paddle 等支付审核很关键。
- 上线前请确保 `terms.html`、`privacy.html`、`refund.html` 内容与你的真实运营主体、联系方式一致。
