# 本地音乐目录

把音乐文件放在这里，例如：

- `static/music/song.mp3`
- `static/music/cover/song.webp`
- `static/music/lrc/song.lrc`

页面访问路径分别是：

- `/music/song.mp3`
- `/music/cover/song.webp`
- `/music/lrc/song.lrc`

如果不在 `data/music.toml` 里写 `[[playlist]]`，站点会自动扫描 `static/music/` 下的音频文件，并用文件名当歌名。
