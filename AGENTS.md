# 代码格式化

- 修改代码后，交付前用项目内的 Prettier 格式化本次改动的文件。可以用 `npm exec -- prettier --write --`，后面附上文件路径。
- 运行 `npm run format:check` 验证格式。只有在需要全仓库格式化时才运行 `npm run format`。
- Git 提交钩子会再次格式化暂存文件。提交时保留钩子检查。
