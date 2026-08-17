# B站时光机 2018—2020

一个可直接部署到 GitHub Pages 的纯静态网站。无需安装依赖或执行构建命令。

## 部署到 GitHub Pages

1. 在 GitHub 新建一个 **Public** 仓库，例如 `bilibili-time-capsule`。
2. 解压本压缩包，将 `index.html` 和 `README.md` 上传到仓库根目录并提交。
3. 打开仓库的 **Settings → Pages**。
4. 在 **Build and deployment** 下将 **Source** 设为 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/ (root)`，点击 **Save**。
6. 等待约 1—3 分钟，GitHub 会显示网站链接。

最终网址通常是：`https://你的用户名.github.io/bilibili-time-capsule/`

## 功能

- 只包含 2018—2020 年的演示视频数据
- 支持关键词搜索、年份筛选和分区筛选
- 支持电脑和手机页面
- 所有代码包含在单个 `index.html` 中

> 非哔哩哔哩官方网站；演示内容仅用于页面展示。
